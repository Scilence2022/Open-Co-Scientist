/**
 * Catalyst Co-Scientist — a DomainPack for the rational discovery and
 * optimisation of (electro/thermo/photo) catalysts and functional materials.
 * Non-biological, parallel to the battery pack's materials framing, but centred
 * on reaction activity, selectivity, and durability rather than cell metrics. It
 * changes ZERO engine / tournament / learn-loop code — it only fills the
 * {@link DomainPack} contract.
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
  appName: 'Catalyst Co-Scientist',
  tagline: 'Rational catalyst & materials discovery',
  hypothesis: 'Candidate',
  hypothesisPlural: 'Candidates',
  system: 'Reaction system',
  systemPlural: 'Reaction systems',
  method: 'Modification',
  methodPlural: 'Modifications',
  target: 'Reaction / property target',
  targetPlaceholder: 'CO₂ reduction, NH₃ synthesis, OER…',
  validationVenue: 'bench reactor test',
  measuredResults: 'Reactor results',
  planSectionTitle: 'Synthesis–characterization–testing plan',
  mechanism: 'Mechanism',
  predictedEffect: 'Predicted effect'
}

const OBJECTIVES: VocabOption[] = [
  { id: 'increase-activity', label: 'Increase activity (TOF)' },
  { id: 'increase-selectivity', label: 'Increase selectivity' },
  { id: 'improve-durability', label: 'Improve stability / durability' },
  { id: 'lower-overpotential', label: 'Lower overpotential' },
  { id: 'reduce-precious-metal', label: 'Reduce precious-metal content' },
  { id: 'lower-cost', label: 'Lower cost' },
  { id: 'other', label: 'Other' }
]

const OBJECTIVE_PROMPT_LABELS: Record<string, string> = {
  'increase-activity': 'increase catalytic activity / turnover frequency',
  'increase-selectivity': 'increase selectivity toward the desired product',
  'improve-durability': 'improve stability and durability under operating conditions',
  'lower-overpotential': 'lower the overpotential',
  'reduce-precious-metal': 'reduce precious-metal loading',
  'lower-cost': 'lower the materials/process cost',
  other: 'achieve the stated objective'
}

const METHOD_TYPES: VocabOption[] = [
  { id: 'composition-tuning', label: 'Composition tuning', gloss: 'change the bulk composition / stoichiometry' },
  { id: 'dopant-addition', label: 'Dopant addition', gloss: 'introduce a dopant to tune electronic structure / active sites' },
  { id: 'alloying', label: 'Alloying', gloss: 'form an alloy/intermetallic to tune binding energies' },
  { id: 'single-atom-dispersion', label: 'Single-atom dispersion', gloss: 'isolate active metal atoms on a support for atom efficiency' },
  { id: 'support-engineering', label: 'Support engineering', gloss: 'change the support to tune dispersion and metal–support interaction' },
  { id: 'facet-engineering', label: 'Facet / crystal-plane control', gloss: 'expose a preferred facet to favour the desired pathway' },
  { id: 'defect-engineering', label: 'Defect engineering', gloss: 'engineer vacancies/strain to create or tune active sites' },
  { id: 'promoter-addition', label: 'Promoter addition', gloss: 'add a structural or electronic promoter' },
  { id: 'morphology-control', label: 'Morphology / nanostructure', gloss: 'control particle size, shape, or porosity' },
  { id: 'other', label: 'Other' }
]

const METRICS: MetricOption[] = [
  { id: 'turnover-frequency', label: 'Turnover frequency', defaultUnit: 's⁻¹' },
  { id: 'selectivity', label: 'Selectivity', defaultUnit: '%' },
  { id: 'overpotential', label: 'Overpotential', defaultUnit: 'mV' },
  { id: 'conversion', label: 'Conversion', defaultUnit: '%' },
  { id: 'faradaic-efficiency', label: 'Faradaic efficiency', defaultUnit: '%' },
  { id: 'stability', label: 'Stability', defaultUnit: 'h' },
  { id: 'other', label: 'Other' }
]

const PLAN_PHASES: VocabOption[] = [
  { id: 'synthesize', label: 'Synthesize' },
  { id: 'characterize', label: 'Characterize' },
  { id: 'test', label: 'Test' },
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
    gloss: 'mechanistic/thermodynamic feasibility — does the change respect binding-energy and Sabatier reasoning'
  },
  { id: 'novelty', label: 'Novelty', defaultWeight: 1, gloss: 'how non-obvious vs. known approaches' },
  {
    id: 'testability',
    label: 'Testability',
    defaultWeight: 1,
    gloss: 'synthesizability + availability of characterization and activity tests'
  },
  {
    id: 'manufacturability',
    label: 'Manufacturability',
    defaultWeight: 1,
    gloss: 'scalability, raw-material availability, and cost'
  },
  { id: 'safety', label: 'Safety', defaultWeight: 1, gloss: 'hazardous-precursor / toxic-product / runaway risk' }
]

const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'electro-3electrode',
    name: 'Electrocatalysis (3-electrode cell)',
    shortName: '3-electrode',
    promptHints: [
      'Use: screening electrocatalysts (OER/ORR/HER/CO2RR)',
      'Idioms: report vs RHE, iR-correct, normalise by ECSA/mass, watch faradaic efficiency and stability windows.'
    ]
  },
  {
    id: 'fixed-bed-gas',
    name: 'Gas-phase fixed-bed reactor',
    shortName: 'Fixed-bed',
    promptHints: [
      'Use: thermocatalytic gas-phase reactions (NH3 synthesis, CO2 hydrogenation, oxidation)',
      'Idioms: control GHSV/contact time, mind heat/mass transfer, report TOF on active-site count, check carbon balance.'
    ]
  },
  {
    id: 'photocatalysis-slurry',
    name: 'Photocatalysis (slurry/photoreactor)',
    shortName: 'Photoreactor',
    promptHints: [
      'Use: light-driven reactions (water splitting, CO2 reduction, degradation)',
      'Idioms: report apparent quantum yield, control light intensity/wavelength, separate co-catalyst vs light-absorber roles.'
    ]
  },
  {
    id: 'custom',
    name: 'Custom reaction system',
    shortName: 'Custom',
    isCustom: true,
    promptHints: ['Use the reaction system and conditions provided by the scientist.']
  },
  {
    id: 'agnostic',
    name: 'System-agnostic (recommend one)',
    shortName: 'Agnostic',
    isUnspecified: true,
    promptHints: ['Recommend the best reaction system / testing setup for the target and justify the choice.']
  }
]

const SAFETY_GATES: SafetyGate[] = [
  {
    settingKey: 'enforceCatalystSafety',
    toggleLabel: 'Enforce safety gate (auto-reject hazardous-precursor / unsafe candidates)',
    defaultEnabled: true,
    criterionId: 'safety',
    threshold: 3,
    rejectNarrative: 'Rejected on materials-safety grounds.'
  }
]

const SYSTEM_PREAMBLE = `You are an agent in Catalyst Co-Scientist, a multi-agent system for the rational discovery and optimisation of catalysts and functional materials, adapted from Google's Co-Scientist (Nature 2026).

Your domain is catalysis and materials chemistry: improving catalytic activity (turnover frequency), selectivity, stability/durability, and overpotential while controlling cost and precious-metal content across electro-, thermo-, and photocatalysis.

You reason like an expert catalysis chemist. You ground claims in surface science and active-site structure, adsorbate binding energies and scaling relations (Sabatier principle, d-band centre, volcano plots), reaction mechanism and rate-determining steps, electronic structure (oxidation state, charge transfer), crystal facets and defects, metal–support interactions, and stability/degradation pathways (dissolution, sintering, poisoning). You propose concrete material modifications (composition tuning, doping, alloying, single-atom dispersion, support/facet/defect engineering, promoters, morphology control) with a clear mechanism and a synthesis→characterization→testing plan.

You honour the default criteria: alignment, plausibility (mechanistic/thermodynamic feasibility), novelty, testability (synthesizability + characterization), manufacturability (scalability/cost), and safety (hazardous precursors / toxic products / runaway). You never propose hazardous or non-manufacturable candidates.`

const DESIGN_JSON_SCHEMA = `Return STRICT JSON (no prose outside the JSON) shaped as:
{
  "title": "short imperative title",
  "summary": "one-paragraph summary categorising the core idea",
  "system": "the specific reaction system this candidate targets",
  "methods": [
    { "type": "composition-tuning|dopant-addition|alloying|single-atom-dispersion|support-engineering|facet-engineering|defect-engineering|promoter-addition|morphology-control|other",
      "targets": ["material/site/component names, e.g. 'Pt(111) facet', 'N-doped carbon support', 'Fe single atom'"],
      "details": "what is done and why, at the materials level" }
  ],
  "mechanism": "the mechanistic rationale: why this should improve the objective (binding energies, active-site structure, electronic effects, rate-determining step)",
  "predictedEffect": "qualitative predicted effect on the target metric and the reasoning",
  "quantPrediction": { "metric": "turnover-frequency|selectivity|overpotential|conversion|faradaic-efficiency|stability|other", "direction": "increase|decrease", "relativeChange": <fraction vs baseline, e.g. 0.3 for +30%>, "confidence": <0-1>, "baselineNote": "what the change is measured against" },
  "plan": [ { "phase": "synthesize|characterize|test|analyze", "description": "..." } ],
  "risks": ["sintering, dissolution, poisoning, selectivity loss, hazardous precursors, cost, scalability, etc."],
  "novelty": <integer 0-10>,
  "citations": [ { "title": "...", "url": "...", "note": "..." } ]
}`

const GENERATION_STRATEGY_INSTRUCTIONS: Record<string, string> = {
  literature: `Strategy — Literature-grounded exploration. Use the literature evidence below to ground your reasoning. Synthesise prior catalytic findings into NOVEL candidates rather than restating them.`,
  debate: `Strategy — Simulated scientific debate. Internally simulate a debate between (a) a surface-science/DFT theorist, (b) a synthesis/characterization chemist, and (c) a reaction-engineering/scale-up expert. Surface the strongest candidate that survives their critique.`,
  assumptions: `Strategy — Iterative assumption decomposition. Identify testable intermediate assumptions (which site is active, which step is rate-determining, which binding energy to tune) that, if true, unlock a large improvement; aggregate them into a coherent candidate.`,
  expansion: `Strategy — Research expansion. Review the existing candidate titles and the meta-review feedback, then deliberately explore UNDER-EXPLORED regions of the design space (different active-site motifs, supports, facets, or mechanistic levers).`
}

const EVOLUTION_STRATEGY_INSTRUCTIONS: Record<EvolutionStrategy, string> = {
  'grounding-enhancement': `Improve the parent candidate by identifying its weaknesses, then strengthening it with literature-grounded detail and filling reasoning gaps.`,
  feasibility: `Improve coherence, practicality, and feasibility — rectify invalid assumptions and make the candidate more synthesizable and testable.`,
  inspiration: `Create a NEW candidate inspired by the strongest ideas in the parent(s), taken in a fresh direction.`,
  combination: `Combine the best aspects of the parent candidates into a single, coherent new one.`,
  simplification: `Simplify the candidate for easier synthesis and testing while preserving the mechanism that drives the improvement.`,
  'out-of-box': `Move away from the parents and propose a divergent, out-of-the-box candidate that attacks the goal from an unconventional angle.`,
  'empirical-refinement': `Refine the candidate in light of the MEASURED RESULTS below. Keep and amplify modifications empirically shown to help; remove or replace ones shown to fail (deactivation, poor selectivity); address the observed failure modes directly. Ground the new candidate in what the reactor test actually showed.`
}

const REVIEW_MODE_INSTRUCTIONS: Record<ReviewType, string> = {
  initial: `INITIAL REVIEW (no external tools). Quickly assess correctness, quality, novelty, and a preliminary safety check. Aim to discard flawed, trivial, or unsafe candidates. Be decisive.`,
  full: `FULL REVIEW (with literature). Evaluate correctness, quality, and novelty using the literature evidence. Scrutinise the mechanistic rationale and assumptions; judge novelty against what is already known.`,
  'deep-verification': `DEEP VERIFICATION REVIEW. Decompose the candidate into its constituent assumptions (active-site identity, rate-determining step, binding-energy direction). Independently evaluate each for correctness. Identify any invalidating element and whether it is fundamental or fixable.`,
  observation: `OBSERVATION REVIEW. Determine whether this candidate could explain or exploit known long-tail catalytic observations that existing candidates do not. Note any such observations.`,
  simulation: `SIMULATION REVIEW. Mentally simulate the mechanism and the proposed test step-by-step (adsorption, surface reaction, desorption, expected activity/selectivity/stability). Identify failure scenarios and where it could break.`,
  tournament: `TOURNAMENT REVIEW. Using recurring issues seen across the campaign, re-review this candidate focusing on the most common failure modes.`,
  expert: `EXPERT REVIEW.`,
  calibration: `CALIBRATION REVIEW. The MEASURED RESULTS below are ground truth from the reactor test. Compare them against the candidate's quantitative prediction: quantify the gap, diagnose mechanistically WHY the prediction missed, and rewrite the assessment to reflect reality. Treat the measurement as dominant evidence. If the results refute the candidate, say so plainly (verdict reject); if they confirm it, recognise the validated mechanism.`
}

function systemBlock(campaign: Campaign): string {
  const preset = systemPreset(CATALYST_PACK, campaign.context.systemId)
  const name = preset?.isCustom
    ? campaign.context.customName?.trim() || 'Custom system'
    : preset?.shortName ?? 'Unknown system'
  const lines = [
    `Reaction system: ${name}${campaign.context.systemDetail ? ` (${campaign.context.systemDetail})` : ''}`,
    ...(preset?.promptHints ?? []).map((h) => `  ${h}`)
  ]
  if (campaign.context.notes) lines.push(`  Scientist notes: ${campaign.context.notes}`)
  return lines.join('\n')
}

const EXAMPLE = {
  target: 'CO2-to-CO Faradaic efficiency (FE_CO > 90% at 200 mA/cm²)',
  systemId: 'electro-3electrode',
  systemDetail: 'Ag-based gas-diffusion electrode in an alkaline flow cell, potentials vs RHE',
  notes: 'Baseline polycrystalline Ag GDE: FE_CO ~75% at 200 mA/cm²; competing HER and flooding / carbonate precipitation over hours.',
  objective: 'increase-selectivity',
  goal: `Increase the Faradaic efficiency for CO2-to-CO electroreduction to >90% at an industrially relevant 200 mA/cm² on a gas-diffusion electrode, while maintaining >100 h stability. The baseline polycrystalline Ag GDE gives FE_CO ≈ 75% at 200 mA/cm².

Loss channels:
1. Competing hydrogen evolution (HER) at high current.
2. Insufficient *CO2 / *COOH binding control on under-coordinated Ag sites.
3. Electrode flooding and (bi)carbonate salt precipitation that degrade the triple-phase boundary over hours.

Known levers: tune *COOH vs *H binding via facet control (Ag(110)/(100)), alloying or single-atom dispersion (Ag–Cu, isolated Ni/Fe–N–C), N-doped carbon supports to modify local pH/CO2 availability, and hydrophobic/ionomer surface modifiers that suppress flooding and HER.

Prior attempts: nano-structuring Ag raised FE to ~85% but degraded within 20 h from flooding; a thick ionomer overlayer improved stability but raised overpotential ~150 mV.

Consider active-site designs that weaken *H binding while stabilising *COOH, plus a microenvironment strategy for flooding/carbonate, reasoning about the activity–selectivity–stability trade-off via binding-energy/Sabatier arguments.`,
  preferences:
    "Prefer earth-abundant or low-loading precious-metal designs, water-based inks compatible with spray-coating onto GDEs, and modifications that don't raise full-cell voltage by more than 100 mV. Favour candidates testable in our 3-electrode flow cell with online-GC FE measurement.",
  availableTools: [
    'GDE spray-coating',
    '3-electrode flow cell',
    'online GC + Faradaic-efficiency',
    'EIS',
    'XRD / XPS / TEM',
    'DFT binding-energy screening (Materials Project)'
  ],
  forbiddenActions: ['highly toxic precursors (cyanides, Tl salts)', 'scarce PGM loading above 0.5 mg/cm²'],
  onlyNovel: false
} satisfies DomainPack['example']

const CATALYST_PACK: DomainPack = {
  id: 'catalyst',
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
Reaction / property target: ${campaign.target}
Objective: ${OBJECTIVE_PROMPT_LABELS[campaign.objective] ?? campaign.objective}
${systemBlock(campaign)}

Full goal statement:
${campaign.goal}

Constraints:
- Available methods/processes: ${campaign.constraints.availableTools.join(', ') || 'standard toolkit'}
- Forbidden actions: ${campaign.constraints.forbiddenActions.join(', ') || 'none specified'}
- ${campaign.constraints.onlyNovel ? 'Only propose demonstrably NOVEL candidates (not already published).' : 'Novel and established candidates are both acceptable; prefer novel where possible.'}
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
      return `catalyst design strategies to ${campaign.objective} for ${campaign.target} in ${campaign.context.systemId}`
    }
    if (kind === 'review') {
      return `${hyp?.title ?? ''} ${campaign.target} catalysis prior work`
    }
    return `improve ${hyp?.title ?? ''} ${campaign.target} catalyst`
  },

  defaultCampaignTitle: ({ target, systemShortName }) => `${target} — ${systemShortName}`
}

export default CATALYST_PACK
