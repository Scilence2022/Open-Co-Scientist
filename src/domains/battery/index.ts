/**
 * Cell Co-Scientist — a second DomainPack, deliberately non-biological, that
 * proves the seam. Rational design of lithium-ion battery electrode
 * formulations. It changes ZERO engine / tournament / learn-loop / Elo /
 * calibration code — it only fills the {@link DomainPack} contract, exactly as a
 * contributor would when adding a new research domain.
 */
import type { Campaign, EvolutionStrategy, Hypothesis, ReviewType } from '@shared/domain'
import type {
  CriterionDescriptor,
  DomainPack,
  MetricOption,
  PackLabels,
  SafetyGate,
  SystemPreset,
  VocabOption
} from '@shared/domainpack'
import { systemPreset } from '@shared/domainpack'

const LABELS: PackLabels = {
  appName: 'Cell Co-Scientist',
  tagline: 'Rational battery-electrode design',
  hypothesis: 'Formulation',
  hypothesisPlural: 'Formulations',
  system: 'Cell format',
  systemPlural: 'Cell formats',
  method: 'Modification',
  methodPlural: 'Modifications',
  target: 'Performance target',
  targetPlaceholder: 'energy density, fast-charge, cycle life…',
  validationVenue: 'coin-cell test',
  measuredResults: 'Cell-test results',
  planSectionTitle: 'Synthesis–assembly–cycling plan',
  mechanism: 'Mechanism',
  predictedEffect: 'Predicted effect'
}

const OBJECTIVES: VocabOption[] = [
  { id: 'increase-energy-density', label: 'Increase energy density' },
  { id: 'increase-fast-charge', label: 'Improve fast-charge' },
  { id: 'extend-cycle-life', label: 'Extend cycle life' },
  { id: 'improve-thermal-safety', label: 'Improve thermal safety' },
  { id: 'reduce-cobalt-content', label: 'Reduce cobalt content' },
  { id: 'lower-cost', label: 'Lower cost' },
  { id: 'other', label: 'Other' }
]

const OBJECTIVE_PROMPT_LABELS: Record<string, string> = {
  'increase-energy-density': 'increase energy density',
  'increase-fast-charge': 'improve fast-charge capability',
  'extend-cycle-life': 'extend cycle life',
  'improve-thermal-safety': 'improve thermal safety',
  'reduce-cobalt-content': 'reduce cobalt content',
  'lower-cost': 'lower the materials/process cost',
  other: 'achieve the stated objective'
}

const METHOD_TYPES: VocabOption[] = [
  { id: 'cation-doping', label: 'Cation doping', gloss: 'substitute a dopant on a cation site to stabilise the structure' },
  { id: 'surface-coating', label: 'Surface coating', gloss: 'apply a protective coating to suppress interfacial side reactions' },
  { id: 'electrolyte-additive', label: 'Electrolyte additive', gloss: 'add a film-forming/sacrificial additive to tune SEI/CEI' },
  { id: 'particle-morphology', label: 'Particle morphology', gloss: 'engineer particle size/shape/single-vs-poly-crystal' },
  { id: 'binder-conductive-additive', label: 'Binder / conductive additive', gloss: 'change binder or conductive-carbon network' },
  { id: 'anode-substitution', label: 'Anode substitution', gloss: 'swap or blend the anode active material, e.g. Si–C' },
  { id: 'electrode-architecture', label: 'Electrode architecture', gloss: 'alter loading/porosity/thickness/calendering' },
  { id: 'other', label: 'Other' }
]

const METRICS: MetricOption[] = [
  { id: 'specific-capacity', label: 'Specific capacity', defaultUnit: 'mAh/g' },
  { id: 'energy-density', label: 'Energy density', defaultUnit: 'Wh/kg' },
  { id: 'capacity-retention', label: 'Capacity retention', defaultUnit: '%' },
  { id: 'coulombic-efficiency', label: 'Coulombic efficiency', defaultUnit: '%' },
  { id: 'rate-capability', label: 'Rate capability', defaultUnit: 'C' },
  { id: 'other', label: 'Other' }
]

const PLAN_PHASES: VocabOption[] = [
  { id: 'synthesize', label: 'Synthesize' },
  { id: 'assemble', label: 'Assemble' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'analyze', label: 'Analyze' }
]

const OUTCOMES: VocabOption[] = [
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'partial', label: 'Partial' },
  { id: 'refuted', label: 'Refuted' },
  { id: 'inconclusive', label: 'Inconclusive' },
  { id: 'synthesis-failed', label: 'Synthesis failed' }
]

const CRITERIA: CriterionDescriptor[] = [
  { id: 'alignment', label: 'Alignment', defaultWeight: 1, gloss: 'fit to the stated goal and constraints' },
  {
    id: 'effectiveness',
    label: 'Effectiveness',
    defaultWeight: 3,
    gloss: 'expected magnitude of improvement in the target metric if the modification works'
  },
  {
    id: 'plausibility',
    label: 'Plausibility',
    defaultWeight: 1,
    gloss: 'thermodynamic/kinetic feasibility — is the mechanism likely to work at all'
  },
  { id: 'novelty', label: 'Novelty', defaultWeight: 1, gloss: 'how non-obvious vs. known approaches' },
  {
    id: 'testability',
    label: 'Testability',
    defaultWeight: 1,
    gloss: 'synthesizability + characterization availability'
  },
  {
    id: 'manufacturability',
    label: 'Manufacturability',
    defaultWeight: 1,
    gloss: 'scalability, cost, and process compatibility'
  },
  { id: 'safety', label: 'Safety', defaultWeight: 1, gloss: 'thermal-runaway / hazardous-precursor risk' }
]

const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'coin-cell-2032',
    name: 'CR2032 coin half-cell',
    shortName: 'CR2032',
    promptHints: [
      'Use: fast screening of a single electrode',
      'Counter electrode: Li metal',
      'Idioms: narrow voltage window for screening; small areal loading'
    ]
  },
  {
    id: 'pouch-single-layer',
    name: 'Single-layer pouch full-cell',
    shortName: 'Pouch',
    promptHints: [
      'Use: realistic full-cell performance at moderate loading',
      'Idioms: balance the N/P ratio; formation protocol matters; track gassing'
    ]
  },
  {
    id: 'cylindrical-18650',
    name: 'Cylindrical 18650 full-cell',
    shortName: '18650',
    promptHints: [
      'Use: scaled cylindrical cell for thermal/mechanical realism',
      'Idioms: thermal management, jelly-roll mechanics, tab design'
    ]
  },
  {
    id: 'custom',
    name: 'Custom cell format',
    shortName: 'Custom',
    isCustom: true,
    promptHints: ['Use the cell format and notes provided by the scientist.']
  },
  {
    id: 'unspecified',
    name: 'Format-agnostic (recommend one)',
    shortName: 'Agnostic',
    isUnspecified: true,
    promptHints: ['Recommend the best cell format for the target and justify the choice.']
  }
]

const SAFETY_GATES: SafetyGate[] = [
  {
    settingKey: 'enforceThermalSafety',
    toggleLabel: 'Enforce thermal-safety gate (auto-reject unsafe formulations)',
    defaultEnabled: true,
    criterionId: 'safety',
    threshold: 3,
    rejectNarrative: 'Rejected on thermal-safety grounds.'
  }
]

const SYSTEM_PREAMBLE = `You are an agent in Cell Co-Scientist, a multi-agent system for the rational design of lithium-ion battery electrode formulations, adapted from Google's Co-Scientist (Nature 2026).

Your domain is battery materials and electrochemistry: improving energy density, fast-charge capability, cycle life, and thermal safety while controlling cost and cobalt content.

You reason like an expert electrochemist. You ground claims in crystal structure and phase stability, Li+ transport and diffusion kinetics, the electrode/electrolyte interphase (SEI/CEI) chemistry, mechanical strain on (de)lithiation, areal loading and porosity, and the rate-capability vs energy-density trade-off. You propose concrete material modifications (cation doping, surface coatings, electrolyte additives, particle morphology, binder/conductive-additive changes, anode substitution, electrode architecture) with a clear mechanism and a synthesis→assembly→cycling plan.

You honour the default criteria: alignment, plausibility (thermodynamic/kinetic feasibility), novelty, testability (synthesizability + characterization), manufacturability (scalability/cost), and safety (thermal runaway / hazardous precursors). You never propose hazardous or non-manufacturable formulations.`

const DESIGN_JSON_SCHEMA = `Return STRICT JSON (no prose outside the JSON) shaped as:
{
  "title": "short imperative title",
  "summary": "one-paragraph summary categorising the core idea",
  "system": "the specific cell format this formulation targets",
  "methods": [
    { "type": "cation-doping|surface-coating|electrolyte-additive|particle-morphology|binder-conductive-additive|anode-substitution|electrode-architecture|other",
      "targets": ["material/site/component names, e.g. 'Ni site', 'NMC811 surface'"],
      "details": "what is done and why, at the materials level" }
  ],
  "mechanism": "the mechanistic rationale: why this should improve the objective (structure, kinetics, interphase, mechanics)",
  "predictedEffect": "qualitative predicted effect on the target metric and the reasoning",
  "quantPrediction": { "metric": "specific-capacity|energy-density|capacity-retention|coulombic-efficiency|rate-capability|other", "direction": "increase|decrease", "relativeChange": <fraction vs baseline, e.g. 0.15 for +15%>, "confidence": <0-1>, "baselineNote": "what the change is measured against" },
  "plan": [ { "phase": "synthesize|assemble|cycle|analyze", "description": "..." } ],
  "risks": ["thermal runaway, gassing, capacity fade, manufacturability, cost, etc."],
  "novelty": <integer 0-10>,
  "citations": [ { "title": "...", "url": "...", "note": "..." } ]
}`

const GENERATION_STRATEGY_INSTRUCTIONS: Record<string, string> = {
  literature: `Strategy — Literature-grounded exploration. Use the literature evidence below to ground your reasoning. Synthesise prior findings into NOVEL formulations rather than restating them.`,
  debate: `Strategy — Simulated scientific debate. Internally simulate a debate between (a) a crystal-structure/materials chemist, (b) an interphase/electrolyte specialist, and (c) a cell-engineering/manufacturing expert. Surface the strongest formulation that survives their critique.`,
  assumptions: `Strategy — Iterative assumption decomposition. Identify testable intermediate assumptions that, if true, unlock a large improvement; aggregate them into a coherent formulation.`,
  expansion: `Strategy — Research expansion. Review the existing formulation titles and the meta-review feedback, then deliberately explore UNDER-EXPLORED regions of the design space (different modification classes, different materials systems, different failure modes).`
}

const EVOLUTION_STRATEGY_INSTRUCTIONS: Record<EvolutionStrategy, string> = {
  'grounding-enhancement': `Improve the parent formulation by identifying its weaknesses, then strengthening it with literature-grounded detail and filling reasoning gaps.`,
  feasibility: `Improve coherence, practicality, and feasibility — rectify invalid assumptions and make the formulation more synthesizable and testable.`,
  inspiration: `Create a NEW formulation inspired by the strongest ideas in the parent(s), taken in a fresh direction.`,
  combination: `Combine the best aspects of the parent formulations into a single, coherent new one.`,
  simplification: `Simplify the formulation for easier synthesis and testing while preserving the mechanism that drives the improvement.`,
  'out-of-box': `Move away from the parents and propose a divergent, out-of-the-box formulation that attacks the goal from an unconventional angle.`,
  'empirical-refinement': `Refine the formulation in light of the MEASURED RESULTS below. Keep and amplify the modifications empirically shown to help; remove or replace the ones shown to fail; address the observed failure modes (fade, gassing, impedance rise) directly. Ground the new formulation in what the cell test actually showed.`
}

const REVIEW_MODE_INSTRUCTIONS: Record<ReviewType, string> = {
  initial: `INITIAL REVIEW (no external tools). Quickly assess correctness, quality, novelty, and a preliminary safety check. Aim to discard flawed, trivial, or unsafe formulations. Be decisive.`,
  full: `FULL REVIEW (with literature). Evaluate correctness, quality, and novelty using the literature evidence. Scrutinise assumptions and reasoning; judge novelty against what is already known.`,
  'deep-verification': `DEEP VERIFICATION REVIEW. Decompose the formulation into its constituent assumptions and sub-assumptions. Independently evaluate each for correctness. Identify any invalidating element and whether it is fundamental or fixable.`,
  observation: `OBSERVATION REVIEW. Determine whether this formulation could explain or exploit known long-tail electrochemical phenomena that existing formulations do not. Note any such observations.`,
  simulation: `SIMULATION REVIEW. Mentally simulate the mechanism and the proposed test step-by-step (lithiation, interphase formation, expected capacity/impedance). Identify failure scenarios and where it could break.`,
  tournament: `TOURNAMENT REVIEW. Using recurring issues seen across the campaign, re-review this formulation focusing on the most common failure modes.`,
  expert: `EXPERT REVIEW.`,
  calibration: `CALIBRATION REVIEW. The MEASURED RESULTS below are ground truth from the cell test. Compare them against the formulation's quantitative prediction: quantify the gap, diagnose mechanistically WHY the prediction missed, and rewrite the assessment to reflect reality. Treat the measurement as dominant evidence. If the results refute the formulation, say so plainly (verdict reject); if they confirm it, recognise the validated mechanism.`
}

function systemBlock(campaign: Campaign): string {
  const preset = systemPreset(BATTERY_PACK, campaign.context.systemId)
  const name = preset?.isCustom
    ? campaign.context.customName?.trim() || 'Custom cell'
    : preset?.shortName ?? 'Unknown cell'
  const lines = [
    `Cell format: ${name}${campaign.context.systemDetail ? ` (${campaign.context.systemDetail})` : ''}`,
    ...(preset?.promptHints ?? []).map((h) => `  ${h}`)
  ]
  if (campaign.context.notes) lines.push(`  Scientist notes: ${campaign.context.notes}`)
  return lines.join('\n')
}

const EXAMPLE = {
  target: '4C fast-charge of an NMC811 || graphite full cell',
  systemId: 'pouch-single-layer',
  systemDetail: 'Single-layer pouch, ~3 mAh/cm² cathode, N/P ≈ 1.1, 1 M LiPF6 EC/EMC + 2% VC',
  notes: 'Baseline: 80% capacity retention after 500 cycles at 1C; charging at 4C plates Li on graphite and fades fast.',
  objective: 'increase-fast-charge',
  goal: `Enable 4C fast-charge (15 min to 80% SOC) of a single-layer NMC811 || graphite pouch full cell while keeping ≥80% capacity retention over 500 cycles and avoiding lithium plating on the graphite anode.

Failure mode: at 4C the cell plates Li (post-mortem shows grey dead Li) because the graphite lithiation potential drops below 0 V vs Li/Li+ under high overpotential. The limits are slow Li+ solid-state diffusion in graphite, sluggish charge-transfer/desolvation at the anode SEI, and electrolyte transport through the thick (~70 µm) electrode.

Known levers: anode — Si–C blending to raise the potential plateau, smaller particles / secondary porosity, surface coatings to lower charge-transfer resistance; electrolyte — additives/solvents that lower desolvation energy and build a thinner, more conductive SEI; architecture — lower loading / higher porosity / dual-layer electrodes.

Prior attempts: lowering loading met the fast-charge target but cut energy density ~18% (unacceptable); a 5% Si blend improved rate but faded faster from expansion. Reference-electrode data shows the anode hits 0 V at ~3.2C.

Consider combinations that attack the rate limit without sacrificing energy density or cycle life, and reason explicitly about the Li-plating margin.`,
  preferences:
    'Prefer modifications compatible with existing slurry-casting and roll-to-roll manufacturing, avoid exotic or scarce precursors, and keep volumetric energy density within 10% of baseline. Favour formulations testable in our coin- and single-layer-pouch workflow with reference-electrode plating detection.',
  availableTools: [
    'slurry casting + calendering',
    'single-layer pouch assembly',
    'reference-electrode cells',
    'dQ/dV + EIS',
    'post-mortem (plating / SEM)',
    'electrolyte additive screen'
  ],
  forbiddenActions: ['lithium-metal anode', 'flammable / unstable additives'],
  onlyNovel: false
} satisfies DomainPack['example']

const BATTERY_PACK: DomainPack = {
  id: 'battery',
  labels: LABELS,
  example: EXAMPLE,
  objectives: OBJECTIVES,
  methodTypes: METHOD_TYPES,
  metrics: METRICS,
  planPhases: PLAN_PHASES,
  outcomes: OUTCOMES,
  complianceLevels: [], // no regulatory tier — the compliance field is hidden
  criteria: CRITERIA,
  systemPresets: SYSTEM_PRESETS,
  safetyGates: SAFETY_GATES,
  tools: [
    {
      id: 'matproj',
      label: 'Materials Project (phase data)',
      description: 'Verify a proposed phase/composition exists and fetch formation energy / e-above-hull / band gap.',
      defaultConfig: { enabled: false, url: 'http://localhost:3003' },
      async gatherEvidence(hyp, conn) {
        const target = hyp.methods.flatMap((m) => m.targets)[0]
        if (!target || !conn.enabled) return undefined
        for (const name of ['get_summary', 'search_materials', 'find_structure']) {
          if (!conn.hasTool(name)) continue
          try {
            const raw = await conn.callText(name, { formula: target, query: target })
            if (raw) return `Materials Project for "${target}": ${raw.slice(0, 2000)}`
          } catch {
            return undefined
          }
        }
        return undefined
      }
    }
  ],

  systemPreamble: () => SYSTEM_PREAMBLE,

  renderGoalContext(campaign) {
    return `RESEARCH GOAL
Performance target: ${campaign.target}
Objective: ${OBJECTIVE_PROMPT_LABELS[campaign.objective] ?? campaign.objective}
${systemBlock(campaign)}

Full goal statement:
${campaign.goal}

Constraints:
- Available methods/processes: ${campaign.constraints.availableTools.join(', ') || 'standard toolkit'}
- Forbidden actions: ${campaign.constraints.forbiddenActions.join(', ') || 'none specified'}
- ${campaign.constraints.onlyNovel ? 'Only propose demonstrably NOVEL formulations (not already published).' : 'Novel and established formulations are both acceptable; prefer novel where possible.'}
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
      return `battery electrode strategies to ${campaign.objective} for ${campaign.target} in ${campaign.context.systemId}`
    }
    if (kind === 'review') {
      return `${hyp?.title ?? ''} ${campaign.target} battery prior work`
    }
    return `improve ${hyp?.title ?? ''} ${campaign.target} battery electrode`
  },

  defaultCampaignTitle: ({ target, systemShortName }) => `${target} — ${systemShortName}`
}

export default BATTERY_PACK
