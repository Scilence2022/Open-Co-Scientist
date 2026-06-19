import type { Campaign, Review, ReviewType, Hypothesis } from '@shared/domain'
import { resolvePack } from '@shared/packRegistry'
import type { EngineContext } from '../context'
import { parseJsonLoose } from '../../llm'
import { reviewPrompt, systemPreamble } from '../prompts'
import { clampScore } from './util'

/**
 * Reflection agent — the scientific peer reviewer. Implements the paper's
 * review modes (initial / full / deep-verification / observation / simulation /
 * tournament). Full reviews use literature + pack tool grounding when available.
 */
export class ReflectionAgent {
  constructor(private ctx: EngineContext) {}

  async review(
    campaign: Campaign,
    design: Hypothesis,
    type: ReviewType,
    metaFeedback?: string
  ): Promise<Review> {
    const review = await this.llmReview(campaign, design, type, metaFeedback)

    // Persist review + bump the design's review count.
    this.ctx.addReview(review)
    design.reviewCount += 1
    // Reflection can refine the design's novelty estimate.
    if (typeof review.scores.novelty === 'number') design.novelty = review.scores.novelty
    this.ctx.upsertDesign(design)

    this.ctx.log(
      campaign.id,
      'reflection',
      review.verdict === 'reject' ? 'warning' : 'info',
      `${type} review of "${design.title}" → ${review.verdict}`,
      { designId: design.id, type }
    )
    return review
  }

  private async llmReview(
    campaign: Campaign,
    design: Hypothesis,
    type: ReviewType,
    metaFeedback?: string
  ): Promise<Review> {
    const pack = resolvePack(campaign.packId)
    let literature: string | undefined
    let domainEvidence: string | undefined

    if (type === 'full' || type === 'deep-verification') {
      if (this.ctx.deepResearch.available) {
        const finding = await this.ctx.deepResearch.search([
          { query: pack.literatureQuery(campaign, 'review', design), researchGoal: campaign.goal }
        ])
        if (finding) literature = finding.summary
      }
      // Ground on any pack tool that offers evidence gathering (e.g. genomics).
      for (const tool of pack.tools) {
        if (!tool.gatherEvidence) continue
        const conn = this.ctx.toolConn(tool.id)
        if (!conn?.enabled) continue
        const ev = await tool.gatherEvidence(design, conn)
        if (ev) {
          domainEvidence = ev
          break
        }
      }
    }

    // Ground the review on any measured results for this hypothesis — decisive
    // for a calibration review, and useful context for every other mode.
    const results = this.ctx.store.getResultsForDesign(campaign.id, design.id)
    const prompt = `${reviewPrompt(
      campaign,
      design,
      type,
      literature,
      domainEvidence,
      results.length ? results : undefined
    )}${metaFeedback ? `\n\nMETA-REVIEW FEEDBACK TO HONOUR:\n${metaFeedback}` : ''}`

    const res = await this.ctx.llm.complete({
      agent: 'reflection',
      system: systemPreamble(campaign),
      prompt,
      effort: type === 'initial' ? 'medium' : 'high',
      think: type !== 'initial',
      maxTokens: 3000
    })

    const parsed = parseJsonLoose<any>(res.text) ?? {}
    const scores: Partial<Record<string, number>> = {}
    for (const c of pack.criteria) {
      if (parsed.scores && parsed.scores[c.id] != null) scores[c.id] = clampScore(parsed.scores[c.id], 5)
    }
    const verdict: Review['verdict'] = ['pass', 'revise', 'reject'].includes(parsed.verdict)
      ? parsed.verdict
      : 'revise'

    // Enforce pack-declared hard-veto safety gates.
    for (const gate of pack.safetyGates) {
      const enabled = this.ctx.settings.safety[gate.settingKey] ?? gate.defaultEnabled
      if (enabled && (scores[gate.criterionId] ?? 10) <= gate.threshold) {
        return {
          id: this.ctx.newId(),
          createdAt: Date.now(),
          designId: design.id,
          campaignId: campaign.id,
          type,
          scores,
          verdict: 'reject',
          narrative: `${gate.rejectNarrative} ${String(parsed.narrative ?? '')}`,
          evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String) : [],
          author: 'Reflection'
        }
      }
    }

    return {
      id: this.ctx.newId(),
      createdAt: Date.now(),
      designId: design.id,
      campaignId: campaign.id,
      type,
      scores,
      verdict,
      narrative: String(parsed.narrative ?? ''),
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String) : [],
      author: 'Reflection'
    }
  }
}
