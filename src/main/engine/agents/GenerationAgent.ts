import type { Campaign, Hypothesis } from '@shared/domain'
import { resolvePack } from '@shared/packRegistry'
import type { EngineContext } from '../context'
import { parseJsonLoose } from '../../llm'
import { generationPrompt, systemPreamble, type GenerationStrategy } from '../prompts'
import { coerceDesign, toDesignObjects } from './util'

/**
 * Generation agent. Produces an initial set of hypotheses (and later expansions)
 * using a rotating library of strategies, grounding in literature via the
 * deep-research MCP when available.
 */
export class GenerationAgent {
  constructor(private ctx: EngineContext) {}

  async generate(
    campaign: Campaign,
    strategy: GenerationStrategy,
    count: number,
    cycle: number,
    metaFeedback?: string,
    empiricalPriors?: string
  ): Promise<Hypothesis[]> {
    const existingTitles = this.ctx.store.getDesigns(campaign.id).map((d) => d.title)

    // Literature grounding (best-effort).
    let literature: string | undefined
    if (strategy === 'literature' && this.ctx.deepResearch.available) {
      const finding = await this.ctx.deepResearch.search([
        {
          query: resolvePack(campaign.packId).literatureQuery(campaign, 'generation'),
          researchGoal: campaign.goal
        }
      ])
      if (finding) literature = finding.summary
    }

    const prompt = generationPrompt(campaign, strategy, {
      count,
      literature,
      metaFeedback,
      empiricalPriors,
      existingTitles: existingTitles.slice(-20)
    })

    // Budget scales with the number of designs requested: each full design is
    // ~2.5K tokens of JSON, plus headroom for adaptive thinking. The client
    // clamps this to the model's real max-output ceiling, so asking generously
    // is safe — it prevents the truncated-JSON → 0-designs failure mode.
    const res = await this.ctx.llm.complete({
      agent: 'generation',
      system: systemPreamble(campaign),
      prompt,
      effort: 'high',
      think: true,
      maxTokens: Math.max(16000, count * 3000 + 4000)
    })

    const list = toDesignObjects(parseJsonLoose<any>(res.text))
    const designs = list
      .map((o) => coerceDesign(o, campaign, 'generated', () => this.ctx.newId()))
      .filter((d): d is Hypothesis => !!d)

    designs.forEach((d) => this.ctx.upsertDesign(d))
    if (designs.length === 0) {
      // Make the failure diagnosable instead of a bland "0 designs": record the
      // stop reason, output-token count, and a snippet of the raw model output.
      const truncated = res.stopReason === 'max_tokens' || res.stopReason === 'length'
      this.ctx.log(
        campaign.id,
        'generation',
        'warning',
        `Generated 0 designs via ${strategy} strategy${literature ? ' (literature-grounded)' : ''} — ` +
          `no parseable design in model output (stop: ${res.stopReason ?? 'unknown'}, ` +
          `${res.usage.outputTokens} output tokens)${truncated ? '; output was truncated — raise the model max output tokens' : ''}.`,
        {
          strategy,
          stopReason: res.stopReason,
          outputTokens: res.usage.outputTokens,
          rawSnippet: res.text.slice(0, 400)
        }
      )
    } else {
      this.ctx.log(
        campaign.id,
        'generation',
        'success',
        `Generated ${designs.length} designs via ${strategy} strategy${literature ? ' (literature-grounded)' : ''}`,
        { strategy }
      )
    }
    return designs
  }
}
