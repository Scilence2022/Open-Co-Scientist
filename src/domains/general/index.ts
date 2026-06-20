/**
 * General Co-Scientist — a deliberately domain-neutral DomainPack. It carries no
 * field-specific vocabulary, presets, tools, or safety vetoes: it lets a
 * scientist run the full Co-Scientist machinery (generation, tournament,
 * evolution, the predict→measure→recalibrate learn loop) against ANY research
 * goal, leaning entirely on the natural-language goal statement to supply the
 * domain. It is the catch-all the user reaches for when no specialised pack fits.
 *
 * Like every pack it changes ZERO engine code — it only fills the
 * {@link DomainPack} contract with neutral nouns and prompts.
 */
import type { Campaign, EvolutionStrategy, Hypothesis, ReviewType } from '@shared/domain'
import type {
  CriterionDescriptor,
  DomainPack,
  MetricOption,
  PackLabels,
  SystemPreset,
  VocabOption
} from '@shared/domainpack'
import { systemPreset } from '@shared/domainpack'

const LABELS: PackLabels = {
  appName: 'General Co-Scientist',
  tagline: 'Domain-neutral research co-scientist',
  hypothesis: 'Hypothesis',
  hypothesisPlural: 'Hypotheses',
  system: 'System',
  systemPlural: 'Systems',
  method: 'Approach',
  methodPlural: 'Approaches',
  target: 'Research target',
  targetPlaceholder: 'the quantity, property, or outcome to improve…',
  validationVenue: 'experiment',
  measuredResults: 'Measured results',
  planSectionTitle: 'Experimental plan',
  mechanism: 'Mechanism / rationale',
  predictedEffect: 'Predicted effect'
}

const OBJECTIVES: VocabOption[] = [
  { id: 'increase-metric', label: 'Increase a target metric' },
  { id: 'decrease-metric', label: 'Decrease a target metric' },
  { id: 'improve-quality', label: 'Improve quality / performance' },
  { id: 'improve-robustness', label: 'Improve robustness / reliability' },
  { id: 'broaden-scope', label: 'Broaden scope / applicability' },
  { id: 'reduce-cost', label: 'Reduce cost / resource use' },
  { id: 'other', label: 'Other' }
]

const OBJECTIVE_PROMPT_LABELS: Record<string, string> = {
  'increase-metric': 'increase the target metric',
  'decrease-metric': 'decrease the target metric',
  'improve-quality': 'improve overall quality / performance',
  'improve-robustness': 'improve robustness / reliability',
  'broaden-scope': 'broaden scope / applicability',
  'reduce-cost': 'reduce cost / resource use',
  other: 'achieve the stated objective'
}

const METHOD_TYPES: VocabOption[] = [
  { id: 'add-component', label: 'Add component', gloss: 'introduce a new element/component to the system' },
  { id: 'remove-component', label: 'Remove component', gloss: 'eliminate an element to reduce cost or a failure mode' },
  { id: 'substitute-component', label: 'Substitute component', gloss: 'replace an element with a better-suited alternative' },
  { id: 'modify-parameter', label: 'Modify parameter', gloss: 'tune a quantitative setting or condition' },
  { id: 'restructure', label: 'Restructure', gloss: 'change how the parts are organised or connected' },
  { id: 'combine-approaches', label: 'Combine approaches', gloss: 'merge two known approaches into one' },
  { id: 'other', label: 'Other' }
]

const METRICS: MetricOption[] = [
  { id: 'primary-metric', label: 'Primary metric' },
  { id: 'secondary-metric', label: 'Secondary metric' },
  { id: 'cost', label: 'Cost / resource use' },
  { id: 'other', label: 'Other' }
]

const PLAN_PHASES: VocabOption[] = [
  { id: 'design', label: 'Design' },
  { id: 'build', label: 'Build' },
  { id: 'test', label: 'Test' },
  { id: 'learn', label: 'Learn' }
]

const OUTCOMES: VocabOption[] = [
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'partial', label: 'Partial' },
  { id: 'refuted', label: 'Refuted' },
  { id: 'inconclusive', label: 'Inconclusive' }
]

const CRITERIA: CriterionDescriptor[] = [
  { id: 'alignment', label: 'Alignment', defaultWeight: 1, gloss: 'fit to the stated goal and constraints' },
  {
    id: 'effectiveness',
    label: 'Effectiveness',
    defaultWeight: 3,
    gloss: 'expected magnitude of improvement toward the objective if the hypothesis holds'
  },
  {
    id: 'plausibility',
    label: 'Plausibility',
    defaultWeight: 1,
    gloss: 'is the proposed mechanism sound and likely to work at all'
  },
  { id: 'novelty', label: 'Novelty', defaultWeight: 1, gloss: 'how non-obvious vs. known approaches' },
  {
    id: 'testability',
    label: 'Testability',
    defaultWeight: 1,
    gloss: 'can it be built and measured with a clear, decisive experiment'
  },
  {
    id: 'feasibility',
    label: 'Feasibility',
    defaultWeight: 1,
    gloss: 'practicality given resources, cost, and the stated constraints'
  }
]

const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'unspecified',
    name: 'Described in the goal',
    shortName: 'In goal',
    isUnspecified: true,
    promptHints: ['Take the system entirely from the research goal and notes provided by the scientist.']
  },
  {
    id: 'custom',
    name: 'Custom system',
    shortName: 'Custom',
    isCustom: true,
    promptHints: ['Use the system name and notes provided by the scientist.']
  }
]

const SYSTEM_PREAMBLE = `You are an agent in General Co-Scientist, a domain-neutral multi-agent system for scientific and engineering hypothesis generation, adapted from Google's Co-Scientist (Nature 2026).

You are not specialised to any single field. You adapt your reasoning to whatever domain the research goal describes, applying the general method of good science: form a clear, mechanistic hypothesis; tie it to a measurable prediction; and design a decisive experiment to test it.

You reason like a rigorous, broadly-trained scientist. You ground claims in first principles and the relevant prior art for the stated domain, state your assumptions explicitly, quantify predictions where possible, and prefer experiments that can clearly confirm or refute the idea. You propose concrete, actionable changes to the system with a clear rationale and a design→build→test→learn plan.

You honour the default criteria: alignment with the goal, plausibility (is the mechanism sound), novelty, testability (can it be measured decisively), effectiveness (how much it would help), and feasibility (practicality given the constraints). You never propose unsafe, unethical, or dual-use work; if a goal as stated has a clear safety or ethical hazard, you flag it rather than pursue it.`

const DESIGN_JSON_SCHEMA = `Return STRICT JSON (no prose outside the JSON) shaped as:
{
  "title": "short imperative title",
  "summary": "one-paragraph summary categorising the core idea",
  "system": "the specific system this hypothesis targets (as described in the goal)",
  "methods": [
    { "type": "add-component|remove-component|substitute-component|modify-parameter|restructure|combine-approaches|other",
      "targets": ["the specific parts/parameters this acts on"],
      "details": "what is done and why" }
  ],
  "mechanism": "the rationale: why this should improve the objective, grounded in the mechanism of the domain at hand",
  "predictedEffect": "qualitative predicted effect on the target and the reasoning",
  "quantPrediction": { "metric": "primary-metric|secondary-metric|cost|other", "direction": "increase|decrease", "relativeChange": <fraction vs baseline, e.g. 0.25 for +25%>, "confidence": <0-1>, "baselineNote": "what the change is measured against" },
  "plan": [ { "phase": "design|build|test|learn", "description": "..." } ],
  "risks": ["the main ways this could fail or have side effects"],
  "novelty": <integer 0-10>,
  "citations": [ { "title": "...", "url": "...", "note": "..." } ]
}`

const GENERATION_STRATEGY_INSTRUCTIONS: Record<string, string> = {
  literature: `Strategy — Literature-grounded exploration. Use the literature evidence below to ground your reasoning. Synthesise prior findings into NOVEL hypotheses rather than restating them.`,
  debate: `Strategy — Simulated scientific debate. Internally simulate a debate between a domain theorist, a hard-nosed empiricist/experimentalist, and a practitioner concerned with feasibility and cost. Surface the strongest hypothesis that survives their critique.`,
  assumptions: `Strategy — Iterative assumption decomposition. Identify testable intermediate assumptions that, if true, unlock a large improvement; aggregate them into a coherent hypothesis.`,
  expansion: `Strategy — Research expansion. Review the existing hypothesis titles and the meta-review feedback, then deliberately explore UNDER-EXPLORED regions of the solution space (different mechanisms, different levers, different framings of the problem).`
}

const EVOLUTION_STRATEGY_INSTRUCTIONS: Record<EvolutionStrategy, string> = {
  'grounding-enhancement': `Improve the parent hypothesis by identifying its weaknesses, then strengthening it with literature-grounded detail and filling reasoning gaps.`,
  feasibility: `Improve coherence, practicality, and feasibility — rectify invalid assumptions and make the hypothesis more buildable and testable.`,
  inspiration: `Create a NEW hypothesis inspired by the strongest ideas in the parent(s), taken in a fresh direction.`,
  combination: `Combine the best aspects of the parent hypotheses into a single, coherent new one.`,
  simplification: `Simplify the hypothesis for easier execution and testing while preserving the mechanism that drives the improvement.`,
  'out-of-box': `Move away from the parents and propose a divergent, out-of-the-box hypothesis that attacks the goal from an unconventional angle.`,
  'empirical-refinement': `Refine the hypothesis in light of the MEASURED RESULTS below. Keep and amplify what the data shows helps; remove or replace what it shows fails; address the observed failure modes directly. Ground the new hypothesis in what was actually observed, not in the original prediction.`
}

const REVIEW_MODE_INSTRUCTIONS: Record<ReviewType, string> = {
  initial: `INITIAL REVIEW (no external tools). Quickly assess correctness, quality, novelty, and a preliminary safety/ethics check. Aim to discard flawed, trivial, or unsafe hypotheses. Be decisive.`,
  full: `FULL REVIEW (with literature). Evaluate correctness, quality, and novelty using the literature evidence. Scrutinise assumptions and reasoning; judge novelty against what is already known in the domain.`,
  'deep-verification': `DEEP VERIFICATION REVIEW. Decompose the hypothesis into its constituent assumptions and sub-assumptions. Independently evaluate each for correctness. Identify any invalidating element and whether it is fundamental to the hypothesis or fixable during refinement.`,
  observation: `OBSERVATION REVIEW. Determine whether this hypothesis could explain or exploit known long-tail observations/phenomena in the domain that existing hypotheses do not. Note any such observations.`,
  simulation: `SIMULATION REVIEW. Mentally simulate the mechanism and the proposed experiment step-by-step. Identify failure scenarios and where the hypothesis could break.`,
  tournament: `TOURNAMENT REVIEW. Using recurring issues seen across the campaign, re-review this hypothesis focusing on the most common failure modes.`,
  expert: `EXPERT REVIEW.`,
  calibration: `CALIBRATION REVIEW. The MEASURED RESULTS below are ground truth from the experiment. Compare them against the hypothesis's quantitative prediction and predicted effect: quantify the prediction gap, diagnose mechanistically WHY the prediction missed (which assumption was wrong), and rewrite the assessment to reflect reality. Treat the measurement as the dominant evidence. If the results refute the hypothesis, say so plainly (verdict reject); if they confirm it, recognise the validated mechanism.`
}

function systemBlock(campaign: Campaign): string {
  const preset = systemPreset(GENERAL_PACK, campaign.context.systemId)
  const name = preset?.isCustom
    ? campaign.context.customName?.trim() || 'Custom system'
    : campaign.context.customName?.trim() || preset?.shortName || 'As described in the goal'
  const lines = [
    `System: ${name}${campaign.context.systemDetail ? ` (${campaign.context.systemDetail})` : ''}`,
    ...(preset?.promptHints ?? []).map((h) => `  ${h}`)
  ]
  if (campaign.context.notes) lines.push(`  Scientist notes: ${campaign.context.notes}`)
  return lines.join('\n')
}

const EXAMPLE = {
  target: 'Sepsis early-warning model (AUROC ≥ 0.90 at 6 h lead time)',
  systemId: 'unspecified',
  notes: 'ICU EHR time-series (vitals, labs, meds); current gradient-boosted model AUROC 0.82 with a high false-alarm rate at the 6 h horizon.',
  objective: 'improve-quality',
  goal: `Improve a sepsis early-warning model so it predicts onset 6 hours ahead at AUROC ≥ 0.90 (currently 0.82) while cutting the false-alarm rate at fixed sensitivity (currently ~8 false alarms per true alert at 80% sensitivity), using routinely-collected ICU EHR data (vitals, labs, meds).

Known bottlenecks:
1. Label leakage and ambiguity in the Sepsis-3 onset definition inflate offline metrics and hurt real deployment.
2. Irregular, missing, artifact-laden time series (especially labs) limit the current gradient-boosted tabular model.
3. Distribution shift across units/sites degrades performance.
4. Clinicians ignore alerts because of poor calibration and no explanation.

Prior attempts: more hand-engineered features gave <0.01 AUROC gain; a vanilla LSTM overfit and didn't beat the GBM.

Consider better temporal representations, principled missing-data handling, label-noise-robust training, calibration and alarm-suppression logic, and validation that reflects prospective deployment. Treat any AUROC gain skeptically until it survives a temporally- and site-held-out test.`,
  preferences:
    'Prefer approaches deployable on routine EHR data without new instrumentation, interpretable enough for clinician trust, robust to missingness and site shift, and validated with prospective-style temporal/site holdouts rather than random splits.',
  availableTools: [
    'retrospective multi-site ICU EHR dataset',
    'Python / PyTorch',
    'gradient-boosting baseline',
    'calibration + decision-curve analysis',
    'temporal & site-stratified cross-validation'
  ],
  forbiddenActions: ['using post-onset features (label leakage)', 'patient-identifying data outside the secure environment'],
  onlyNovel: false
} satisfies DomainPack['example']

const GENERAL_PACK: DomainPack = {
  id: 'general',
  labels: LABELS,
  example: EXAMPLE,
  objectives: OBJECTIVES,
  methodTypes: METHOD_TYPES,
  metrics: METRICS,
  planPhases: PLAN_PHASES,
  outcomes: OUTCOMES,
  complianceLevels: [], // domain-neutral — the compliance field is hidden
  criteria: CRITERIA,
  systemPresets: SYSTEM_PRESETS,
  safetyGates: [], // no field-specific hard veto; safety remains a scored criterion
  tools: [], // deep-research stays a shared core tool; no pack-specific binding

  systemPreamble: () => SYSTEM_PREAMBLE,

  renderGoalContext(campaign) {
    return `RESEARCH GOAL
Research target: ${campaign.target}
Objective: ${OBJECTIVE_PROMPT_LABELS[campaign.objective] ?? campaign.objective}
${systemBlock(campaign)}

Full goal statement:
${campaign.goal}

Constraints:
- Available tools/methods: ${campaign.constraints.availableTools.join(', ') || 'unspecified'}
- Forbidden actions: ${campaign.constraints.forbiddenActions.join(', ') || 'none specified'}
- ${campaign.constraints.onlyNovel ? 'Only propose demonstrably NOVEL hypotheses (not already established).' : 'Novel and established hypotheses are both acceptable; prefer novel where possible.'}
${campaign.constraints.regulatoryNotes ? `- Notes: ${campaign.constraints.regulatoryNotes}` : ''}

Desirable attributes / preferences:
${campaign.preferences || '(none specified)'}`
  },

  hypothesisJsonSchema: () => DESIGN_JSON_SCHEMA,
  generationStrategyInstructions: () => GENERATION_STRATEGY_INSTRUCTIONS,
  evolutionStrategyInstructions: () => EVOLUTION_STRATEGY_INSTRUCTIONS,
  reviewModeInstructions: () => REVIEW_MODE_INSTRUCTIONS,

  literatureQuery(campaign, kind, hyp?: Hypothesis) {
    if (kind === 'generation') {
      return `approaches to ${campaign.objective} ${campaign.target}`
    }
    if (kind === 'review') {
      return `${hyp?.title ?? ''} ${campaign.target} prior work`
    }
    return `improve ${hyp?.title ?? ''} ${campaign.target}`
  },

  defaultCampaignTitle: ({ target, systemShortName }) =>
    systemShortName && systemShortName !== 'In goal' ? `${target} — ${systemShortName}` : target
}

export default GENERAL_PACK
