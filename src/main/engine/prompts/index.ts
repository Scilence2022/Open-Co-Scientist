import type {
  Campaign,
  EvolutionStrategy,
  ExperimentalResult,
  Hypothesis,
  ReviewType
} from '@shared/domain'
import { EVIDENCE_GRADE_LABELS, EVOLUTION_STRATEGY_LABELS } from '@shared/domain'
import type { DomainPack } from '@shared/domainpack'
import { labelFor, systemPreset } from '@shared/domainpack'
import { resolvePack } from '@shared/packRegistry'

/**
 * Prompt library for the Co-Scientist engine. Each builder mirrors a strategy
 * from the Co-Scientist paper (Methods + Supplementary). The DOMAIN-specific
 * content — agent persona, goal framing, output schema, vocabulary, judging
 * criteria, and per-strategy/-mode instructions — is supplied by the active
 * {@link DomainPack}; these functions assemble it into the neutral prompt
 * structure (existing designs, literature, meta feedback, results, JSON spec).
 *
 * Every generation/evolution prompt asks for strict JSON so the engine can parse
 * hypotheses deterministically; the schema is described by the pack.
 */

/** The agent persona for the active pack (was the SYSTEM_PREAMBLE constant). */
export function systemPreamble(campaign: Campaign): string {
  return resolvePack(campaign.packId).systemPreamble()
}

/** Domain-rendered research-goal context for the active pack. */
export function goalContext(campaign: Campaign): string {
  return resolvePack(campaign.packId).renderGoalContext(campaign)
}

// ---------------------------------------------------------------------------
// Hypothesis serialisers (neutral; resolve labels from the pack)
// ---------------------------------------------------------------------------

export function designToText(d: Hypothesis, pack: DomainPack, results?: ExperimentalResult[]): string {
  const methods = d.methods
    .map((m) => `  - [${labelFor(pack.methodTypes, m.type)}] ${m.targets.join(', ')}: ${m.details}`)
    .join('\n')
  const prediction = d.quantPrediction
    ? `\nQuantitative prediction: ${d.quantPrediction.direction} ${labelFor(pack.metrics, d.quantPrediction.metric)}${
        typeof d.quantPrediction.relativeChange === 'number'
          ? ` by ~${Math.round(Math.abs(d.quantPrediction.relativeChange) * 100)}%`
          : ''
      }${typeof d.quantPrediction.confidence === 'number' ? ` (confidence ${d.quantPrediction.confidence})` : ''}`
    : ''
  const evidenceLine =
    d.evidence && d.evidence !== 'predicted-only'
      ? `\nEvidence grade: ${EVIDENCE_GRADE_LABELS[d.evidence]} (measured — outranks prediction)`
      : ''
  const measured = results?.length ? `\n${resultsToText(results, pack)}` : ''
  return `Title: ${d.title}
Summary: ${d.summary}
${pack.labels.system}: ${d.system}
${pack.labels.methodPlural}:
${methods || '  (none)'}
${pack.labels.mechanism}: ${d.mechanism}
${pack.labels.predictedEffect}: ${d.predictedEffect}${prediction}
Risks: ${d.risks.join('; ') || 'none noted'}
Novelty (self/assessed): ${d.novelty}/10${evidenceLine}${measured}`
}

/** Render a hypothesis's measured results as decisive, ground-truth evidence. */
export function resultsToText(results: ExperimentalResult[], pack: DomainPack): string {
  const recorded = results.filter((r) => r.status === 'recorded')
  if (!recorded.length) return ''
  const lines = recorded.map((r) => {
    const delta =
      typeof r.measuredValue === 'number' && typeof r.baselineValue === 'number' && r.baselineValue !== 0
        ? ` (${r.measuredValue}${r.unit ?? ''} vs baseline ${r.baselineValue}${r.unit ?? ''}, ${
            r.measuredValue >= r.baselineValue ? '+' : ''
          }${Math.round(((r.measuredValue - r.baselineValue) / r.baselineValue) * 100)}%)`
        : ''
    const reps = r.replicates ? ` [n=${r.replicates}]` : ''
    return `  - ${labelFor(pack.outcomes, r.outcome)}${delta}${reps}: ${r.observations}`
  })
  return `MEASURED RESULTS (ground truth — weigh ABOVE predicted reasoning):\n${lines.join('\n')}`
}

// ---------------------------------------------------------------------------
// Supervisor — parse goal into a research-plan configuration
// ---------------------------------------------------------------------------

export function parseGoalPrompt(campaign: Campaign): string {
  const pack = resolvePack(campaign.packId)
  const unspecified = systemPreset(pack, campaign.context.systemId)?.isUnspecified
  return `${goalContext(campaign)}

TASK: Parse this research goal into a structured research-plan configuration for the campaign.

Return STRICT JSON:
{
  "restatedGoal": "a crisp restatement of the objective",
  "focusAreas": ["3-6 distinct focus areas / strategy families to explore"],
  "derivedConstraints": ["constraints implied by the goal/system that hypotheses must honour"],
  "evaluationRubric": "a short rubric describing what a high-quality hypothesis looks like for THIS goal",
  "recommendedSystem": "${unspecified ? `recommend the best ${pack.labels.system.toLowerCase()} for this target and justify briefly` : 'leave empty string'}"
}`
}

// ---------------------------------------------------------------------------
// Generation agent
// ---------------------------------------------------------------------------

export type GenerationStrategy = 'literature' | 'debate' | 'assumptions' | 'expansion'

export function generationPrompt(
  campaign: Campaign,
  strategy: GenerationStrategy,
  opts: {
    count: number
    literature?: string
    metaFeedback?: string
    existingTitles?: string[]
    empiricalPriors?: string
  }
): string {
  const pack = resolvePack(campaign.packId)
  const instruction = pack.generationStrategyInstructions()[strategy] ?? ''
  const unit = pack.labels.hypothesisPlural.toLowerCase()

  return `${goalContext(campaign)}

${instruction}
${opts.literature ? `\nLITERATURE EVIDENCE:\n${opts.literature}\n` : ''}
${opts.metaFeedback ? `\nMETA-REVIEW FEEDBACK (apply selectively, do not overfit):\n${opts.metaFeedback}\n` : ''}
${opts.empiricalPriors ? `\nEMPIRICAL PRIORS FROM THIS CAMPAIGN'S MEASURED RESULTS (treat as ground truth — amplify what worked, avoid what failed, and recalibrate predicted magnitudes):\n${opts.empiricalPriors}\n` : ''}
${opts.existingTitles?.length ? `\nEXISTING ${pack.labels.hypothesisPlural.toUpperCase()} (avoid duplicating these):\n- ${opts.existingTitles.join('\n- ')}\n` : ''}

TASK: Generate ${opts.count} distinct, concrete ${unit} for this goal. Each must be mechanistically grounded and experimentally testable in the specified ${pack.labels.system.toLowerCase()}.

Return STRICT JSON: an array of ${opts.count} objects, each shaped as:
${pack.hypothesisJsonSchema()}`
}

// ---------------------------------------------------------------------------
// Reflection agent — review modes
// ---------------------------------------------------------------------------

export function reviewPrompt(
  campaign: Campaign,
  design: Hypothesis,
  type: ReviewType,
  literature?: string,
  domainEvidence?: string,
  results?: ExperimentalResult[]
): string {
  const pack = resolvePack(campaign.packId)
  const instruction = pack.reviewModeInstructions()[type] ?? ''
  const scoreKeys = pack.criteria.map((c) => c.id)
  const scoresExample = `{ ${scoreKeys.map((k) => `"${k}": n`).join(', ')} }`

  return `${goalContext(campaign)}

${pack.labels.hypothesis.toUpperCase()} UNDER REVIEW:
${designToText(design, pack, results)}
${literature ? `\nLITERATURE EVIDENCE:\n${literature}\n` : ''}
${domainEvidence ? `\nDOMAIN EVIDENCE:\n${domainEvidence}\n` : ''}

You are the Reflection agent acting as a rigorous peer reviewer.
${instruction}

Score each criterion 0-10 where relevant: ${pack.criteria.map((c) => c.label).join(', ')}.

Return STRICT JSON:
{
  "scores": ${scoresExample},
  "verdict": "pass|revise|reject",
  "narrative": "the review, with specific, actionable critique",
  "evidence": ["concrete evidence points used (cite literature/domain facts where used)"]
}`
}

// ---------------------------------------------------------------------------
// Ranking agent — pairwise scientific-debate match
// ---------------------------------------------------------------------------

export function matchPrompt(
  campaign: Campaign,
  a: Hypothesis,
  b: Hypothesis,
  mode: 'debate' | 'single-turn',
  resultsA?: ExperimentalResult[],
  resultsB?: ExperimentalResult[]
): string {
  const pack = resolvePack(campaign.packId)
  const weights = campaign.tournamentConfig?.weights ?? {}
  // Only the dimensions the scientist actually weights are judged.
  const judged = pack.criteria.filter((c) => (weights[c.id] ?? 0) > 0)
  const rubric = judged.map((c) => `  - ${c.label} (weight ${weights[c.id]}): ${c.gloss}`).join('\n')
  const scoresExample = `{ ${judged.map((c) => `"${c.id}": <integer 0-10>`).join(', ')} }`
  const style =
    mode === 'debate'
      ? `Conduct a concise multi-turn scientific debate (2-3 exchanges) for THIS goal and ${pack.labels.system.toLowerCase()}, then score.`
      : `Do a single-turn comparison for THIS goal and ${pack.labels.system.toLowerCase()}, then score.`

  return `${goalContext(campaign)}

You are the Ranking agent running a tournament match. Compare the two candidate ${pack.labels.hypothesisPlural.toLowerCase()} for this goal. ${style} Avoid positional bias — judge on merits, not order.

Score BOTH ${pack.labels.hypothesisPlural.toLowerCase()} 0-10 on each weighted criterion below. The system decides the winner deterministically from the weighted totals, so score honestly and independently — do NOT pre-pick a winner. Weights reflect this campaign's priorities (higher weight = more decisive).

CRITICAL: where a ${pack.labels.hypothesis.toLowerCase()} carries MEASURED RESULTS, that is ground truth and must dominate your scoring — one empirically confirmed to work outranks one that only argues well, and a refuted one must score low on effectiveness/plausibility however elegant its rationale.

WEIGHTED CRITERIA:
${rubric}

${pack.labels.hypothesis.toUpperCase()} A:
${designToText(a, pack, resultsA)}

${pack.labels.hypothesis.toUpperCase()} B:
${designToText(b, pack, resultsB)}

Return STRICT JSON:
{
  "scoresA": ${scoresExample},
  "scoresB": ${scoresExample},
  "transcript": "the debate / comparison reasoning",
  "rationale": "one-paragraph justification grounded in the per-criterion scores"
}`
}

// ---------------------------------------------------------------------------
// Evolution agent
// ---------------------------------------------------------------------------

export function evolutionPrompt(
  campaign: Campaign,
  parents: Hypothesis[],
  strategy: EvolutionStrategy,
  opts: {
    literature?: string
    metaFeedback?: string
    empiricalPriors?: string
    parentResults?: ExperimentalResult[]
  }
): string {
  const pack = resolvePack(campaign.packId)
  const instruction = pack.evolutionStrategyInstructions()[strategy] ?? ''

  return `${goalContext(campaign)}

You are the Evolution agent. ${EVOLUTION_STRATEGY_LABELS[strategy]}: ${instruction}
Produce a brand-new ${pack.labels.hypothesis.toLowerCase()} (do not merely restate a parent). It will compete in the tournament on its own merits.
${opts.literature ? `\nLITERATURE EVIDENCE:\n${opts.literature}\n` : ''}
${opts.metaFeedback ? `\nMETA-REVIEW FEEDBACK:\n${opts.metaFeedback}\n` : ''}
${opts.empiricalPriors ? `\nEMPIRICAL PRIORS FROM MEASURED RESULTS (ground truth — amplify what worked, avoid what failed):\n${opts.empiricalPriors}\n` : ''}

PARENT ${pack.labels.hypothesisPlural.toUpperCase()}:
${parents
  .map(
    (p, i) =>
      `--- Parent ${i + 1} ---\n${designToText(p, pack, opts.parentResults?.filter((r) => r.designId === p.id))}`
  )
  .join('\n\n')}

Return STRICT JSON shaped as a single object:
${pack.hypothesisJsonSchema()}`
}

// ---------------------------------------------------------------------------
// Meta-review agent
// ---------------------------------------------------------------------------

export function metaReviewPrompt(
  campaign: Campaign,
  topDesigns: Hypothesis[],
  reviewExcerpts: string[],
  matchPatterns: string[],
  calibrationNote?: string,
  resultsSummary?: string
): string {
  return `${goalContext(campaign)}

You are the Meta-review agent. Synthesise insights from the reviews, tournament debates, and any MEASURED RESULTS of this campaign into (1) recurring critique patterns, (2) targeted feedback for each agent to apply next cycle (NO model retraining — this feedback is simply appended to prompts), and (3) a research overview that serves as an iterative roadmap for the scientist. Where measured results exist, they are ground truth: anchor the roadmap on what has been validated/refuted, and use the calibration signal to tell the agents where their predictions are systematically off.

TOP-RANKED HYPOTHESES (evidence grade dominates rank; Elo breaks ties):
${topDesigns
  .map(
    (d, i) =>
      `#${i + 1} (Elo ${d.elo}${d.evidence && d.evidence !== 'predicted-only' ? `, ${EVIDENCE_GRADE_LABELS[d.evidence]}` : ''}): ${d.title} — ${d.summary}`
  )
  .join('\n')}
${resultsSummary ? `\nMEASURED RESULTS SO FAR:\n${resultsSummary}\n` : ''}${calibrationNote ? `\nPREDICTION CALIBRATION (correct for these biases in agentFeedback):\n${calibrationNote}\n` : ''}
REVIEW EXCERPTS:
${reviewExcerpts.slice(0, 20).join('\n')}

TOURNAMENT DEBATE PATTERNS:
${matchPatterns.slice(0, 20).join('\n')}

Return STRICT JSON:
{
  "critiquePatterns": ["recurring issues seen across reviews/debates"],
  "agentFeedback": {
    "generation": "guidance to improve next generation pass",
    "reflection": "review angles that were missed and must be covered",
    "evolution": "which refinement strategies are paying off",
    "ranking": "any bias or comparison issues to correct"
  },
  "overview": {
    "summary": "executive summary of the campaign's research roadmap",
    "areas": [
      { "title": "research area", "justification": "why it matters", "exampleExperiments": ["concrete experiments"], "relatedDesigns": [<numbers of the TOP-RANKED HYPOTHESES above that belong to this area, e.g. 1, 3>] }
    ]
  },
  "suggestedExperts": [ { "name": "role/archetype (no real individuals required)", "expertise": "...", "rationale": "why consult them" } ]
}`
}
