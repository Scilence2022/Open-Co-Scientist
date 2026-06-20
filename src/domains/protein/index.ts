/**
 * Protein Co-Scientist — a DomainPack for the rational engineering of proteins
 * and enzymes. Closely related to the strain pack (it shares the biological
 * framing and a dual-use safety veto) but reasons at the level of sequence,
 * structure, and biophysics rather than pathways and flux. It changes ZERO
 * engine / tournament / learn-loop code — it only fills the {@link DomainPack}
 * contract.
 */
import type { Campaign, EvolutionStrategy, Hypothesis, ReviewType } from '@shared/domain'
import type {
  CriterionDescriptor,
  DomainPack,
  McpConnectionLike,
  MetricOption,
  PackLabels,
  SafetyGate,
  SystemPreset,
  VocabOption
} from '@shared/domainpack'
import { systemPreset } from '@shared/domainpack'

const LABELS: PackLabels = {
  appName: 'Protein Co-Scientist',
  tagline: 'Rational protein & enzyme engineering',
  hypothesis: 'Variant',
  hypothesisPlural: 'Variants',
  system: 'Scaffold',
  systemPlural: 'Scaffolds',
  method: 'Mutation',
  methodPlural: 'Mutations',
  target: 'Property target',
  targetPlaceholder: 'thermostability, kcat/KM, enantioselectivity…',
  validationVenue: 'biochemical assay',
  measuredResults: 'Assay results',
  planSectionTitle: 'Model–express–assay plan',
  mechanism: 'Structural rationale',
  predictedEffect: 'Predicted effect'
}

const OBJECTIVES: VocabOption[] = [
  { id: 'increase-thermostability', label: 'Increase thermostability' },
  { id: 'increase-activity', label: 'Increase activity' },
  { id: 'improve-specificity', label: 'Improve substrate specificity' },
  { id: 'alter-selectivity', label: 'Alter selectivity (regio/stereo)' },
  { id: 'improve-expression', label: 'Improve expression / solubility' },
  { id: 'broaden-substrate', label: 'Broaden substrate scope' },
  { id: 'improve-tolerance', label: 'Improve pH / solvent tolerance' },
  { id: 'other', label: 'Other' }
]

const OBJECTIVE_PROMPT_LABELS: Record<string, string> = {
  'increase-thermostability': 'increase thermostability (melting temperature / half-life)',
  'increase-activity': 'increase catalytic activity (kcat or kcat/KM)',
  'improve-specificity': 'improve substrate specificity',
  'alter-selectivity': 'alter regio- or stereo-selectivity',
  'improve-expression': 'improve soluble expression yield',
  'broaden-substrate': 'broaden substrate scope',
  'improve-tolerance': 'improve pH / organic-solvent tolerance',
  other: 'achieve the stated objective'
}

const METHOD_TYPES: VocabOption[] = [
  { id: 'point-mutation', label: 'Point mutation', gloss: 'single substitution at a rationally chosen position' },
  { id: 'multi-site-mutagenesis', label: 'Multi-site mutagenesis', gloss: 'combine several substitutions, watching epistasis' },
  { id: 'active-site-redesign', label: 'Active-site redesign', gloss: 'reshape first/second-shell residues to tune catalysis or binding' },
  { id: 'loop-grafting', label: 'Loop grafting', gloss: 'transplant a loop to change specificity or dynamics' },
  { id: 'disulfide-engineering', label: 'Disulfide engineering', gloss: 'introduce a crosslink to rigidify and stabilise' },
  { id: 'consensus-design', label: 'Consensus / ancestral design', gloss: 'use family consensus or ASR to raise stability' },
  { id: 'computational-redesign', label: 'Computational redesign', gloss: 'physics- or ML-guided sequence redesign (Rosetta, ESM, etc.)' },
  { id: 'directed-evolution-library', label: 'Directed-evolution library', gloss: 'define a focused or random library plus a screen/selection' },
  { id: 'other', label: 'Other' }
]

const METRICS: MetricOption[] = [
  { id: 'thermostability', label: 'Thermostability (Tm)', defaultUnit: '°C' },
  { id: 'activity', label: 'Activity (kcat/KM)', defaultUnit: 'M⁻¹s⁻¹' },
  { id: 'expression-yield', label: 'Expression yield', defaultUnit: 'mg/L' },
  { id: 'selectivity', label: 'Selectivity', defaultUnit: '% ee' },
  { id: 'half-life', label: 'Half-life', defaultUnit: 'min' },
  { id: 'other', label: 'Other' }
]

const PLAN_PHASES: VocabOption[] = [
  { id: 'model', label: 'Model' },
  { id: 'express', label: 'Express' },
  { id: 'assay', label: 'Assay' },
  { id: 'analyze', label: 'Analyze' }
]

const OUTCOMES: VocabOption[] = [
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'partial', label: 'Partial' },
  { id: 'refuted', label: 'Refuted' },
  { id: 'inconclusive', label: 'Inconclusive' },
  { id: 'expression-failed', label: 'Expression failed' }
]

const COMPLIANCE_LEVELS: VocabOption[] = [
  { id: 'BSL-1', label: 'BSL-1' },
  { id: 'BSL-2', label: 'BSL-2' },
  { id: 'unspecified', label: 'Unspecified' }
]

const CRITERIA: CriterionDescriptor[] = [
  { id: 'alignment', label: 'Alignment', defaultWeight: 1, gloss: 'fit to the stated goal and constraints' },
  {
    id: 'effectiveness',
    label: 'Effectiveness',
    defaultWeight: 3,
    gloss: 'expected magnitude of improvement in the target property if the variant works'
  },
  {
    id: 'plausibility',
    label: 'Plausibility',
    defaultWeight: 1,
    gloss: 'biophysical/structural feasibility — does the mechanism respect folding, packing, and dynamics'
  },
  { id: 'novelty', label: 'Novelty', defaultWeight: 1, gloss: 'how non-obvious vs. known approaches' },
  {
    id: 'testability',
    label: 'Testability',
    defaultWeight: 1,
    gloss: 'expressibility + availability of an assay/screen for the property'
  },
  {
    id: 'foldability',
    label: 'Foldability',
    defaultWeight: 1,
    gloss: 'risk that the change destabilises folding, aggregates, or kills expression'
  },
  { id: 'safety', label: 'Safety', defaultWeight: 1, gloss: 'dual-use / toxin / pathogen-enhancement risk' }
]

const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'soluble-enzyme',
    name: 'Soluble globular enzyme',
    shortName: 'Soluble enzyme',
    promptHints: [
      'Class: cytosolic globular protein',
      'Strengths: well-behaved expression, crystallisable, amenable to rational point mutation',
      'Idioms to prefer: stabilise the core/active-site scaffold, use B-factor/consensus heuristics, watch epistasis when stacking mutations.'
    ]
  },
  {
    id: 'antibody',
    name: 'Antibody / scFv / nanobody',
    shortName: 'Antibody',
    promptHints: [
      'Class: immunoglobulin binding scaffold',
      'Strengths: modular CDR loops, mature display/maturation workflows',
      'Idioms to prefer: CDR-focused mutagenesis, affinity maturation, framework stabilisation, developability (aggregation, pI) checks.'
    ]
  },
  {
    id: 'membrane-protein',
    name: 'Membrane protein',
    shortName: 'Membrane protein',
    promptHints: [
      'Class: integral membrane protein',
      'Strengths: high-value targets/transporters; Constraints: hard to express and assay',
      'Idioms to prefer: thermostabilising mutations for purification, fusion partners, detergent/nanodisc context, conservative TM-helix edits.'
    ]
  },
  {
    id: 'de-novo',
    name: 'De novo designed scaffold',
    shortName: 'De novo',
    promptHints: [
      'Class: computationally designed protein',
      'Strengths: idealised, hyperstable backbones with clean energy landscapes',
      'Idioms to prefer: physics/ML co-design (Rosetta, RFdiffusion, ProteinMPNN, ESM), explicit foldability filters before functional edits.'
    ]
  },
  {
    id: 'custom',
    name: 'Custom scaffold',
    shortName: 'Custom',
    isCustom: true,
    promptHints: ['Use the scaffold, sequence, and notes provided by the scientist; ground edits against structure where available.']
  },
  {
    id: 'agnostic',
    name: 'Scaffold-agnostic (recommend one)',
    shortName: 'Agnostic',
    isUnspecified: true,
    promptHints: ['Recommend the best scaffold/homolog for the target property and justify the choice.']
  }
]

const SAFETY_GATES: SafetyGate[] = [
  {
    settingKey: 'enforceProteinBiosafety',
    toggleLabel: 'Enforce dual-use gate (auto-reject toxin / pathogen-enhancing variants)',
    defaultEnabled: true,
    criterionId: 'safety',
    threshold: 3,
    rejectNarrative: 'Rejected on dual-use / biosafety grounds.'
  }
]

const SYSTEM_PREAMBLE = `You are an agent in Protein Co-Scientist, a multi-agent system for the rational engineering of proteins and enzymes, adapted from Google's Co-Scientist (Nature 2026).

Your domain is protein engineering and enzymology: improving thermostability, catalytic activity (kcat, KM, kcat/KM), substrate specificity, regio-/stereo-selectivity, expression and solubility, and tolerance, by changing sequence and structure.

You reason like an expert protein engineer. You ground claims in three-dimensional structure (fold, packing, active-site geometry, second-shell interactions), biophysics (folding stability ΔΔG, electrostatics, hydrogen bonding, hydrophobic packing, conformational dynamics), enzyme mechanism and transition-state stabilisation, sequence–structure relationships (conservation, coevolution, consensus/ancestral inference), epistasis between mutations, and expressibility/aggregation risk. You propose concrete sequence-level edits (point and multi-site mutations, active-site redesign, loop grafting, disulfide engineering, consensus/ancestral design, computational or ML-guided redesign, or a defined directed-evolution library) with a clear structural rationale and a model→express→assay plan.

You honour the default criteria: alignment, plausibility (biophysical/structural feasibility), novelty, testability (expressibility + assay), foldability (don't destabilise or aggregate the protein), and safety (dual-use). You never propose enhancing toxins, virulence, or other dual-use hazards.`

const DESIGN_JSON_SCHEMA = `Return STRICT JSON (no prose outside the JSON) shaped as:
{
  "title": "short imperative title",
  "summary": "one-paragraph summary categorising the core idea",
  "system": "the specific scaffold/protein this variant targets",
  "methods": [
    { "type": "point-mutation|multi-site-mutagenesis|active-site-redesign|loop-grafting|disulfide-engineering|consensus-design|computational-redesign|directed-evolution-library|other",
      "targets": ["residue positions or regions, e.g. 'F87A', 'loop 210-218', 'active site'"],
      "details": "what is changed and why, at the structural level" }
  ],
  "mechanism": "the structural/biophysical rationale: why this should improve the objective (stability, packing, electrostatics, transition-state stabilisation, dynamics)",
  "predictedEffect": "qualitative predicted effect on the target property and the reasoning",
  "quantPrediction": { "metric": "thermostability|activity|expression-yield|selectivity|half-life|other", "direction": "increase|decrease", "relativeChange": <fraction vs baseline, e.g. 0.2 for +20% or +ΔTm framed as fraction of baseline>, "confidence": <0-1>, "baselineNote": "what the change is measured against (e.g. wild-type)" },
  "plan": [ { "phase": "model|express|assay|analyze", "description": "..." } ],
  "risks": ["destabilisation/aggregation, loss of expression, epistasis, assay limitations, dual-use, etc."],
  "novelty": <integer 0-10>,
  "citations": [ { "title": "...", "url": "...", "note": "..." } ]
}`

const GENERATION_STRATEGY_INSTRUCTIONS: Record<string, string> = {
  literature: `Strategy — Literature-grounded exploration. Use the literature evidence below to ground your reasoning. Synthesise prior mutational and structural findings into NOVEL variants rather than restating them.`,
  debate: `Strategy — Simulated scientific debate. Internally simulate a debate between (a) a structural/biophysics expert, (b) an enzyme-mechanism specialist, and (c) a protein-expression/developability expert. Surface the strongest variant that survives their critique.`,
  assumptions: `Strategy — Iterative assumption decomposition. Identify testable intermediate assumptions (which residue controls the property, whether a mutation is stabilising) that, if true, unlock a large improvement; aggregate them into a coherent variant.`,
  expansion: `Strategy — Research expansion. Review the existing variant titles and the meta-review feedback, then deliberately explore UNDER-EXPLORED regions of the design space (different positions, different mutation classes, different mechanistic levers).`
}

const EVOLUTION_STRATEGY_INSTRUCTIONS: Record<EvolutionStrategy, string> = {
  'grounding-enhancement': `Improve the parent variant by identifying its weaknesses, then strengthening it with literature/structural detail and filling reasoning gaps.`,
  feasibility: `Improve coherence, practicality, and feasibility — rectify invalid assumptions and make the variant more expressible and assayable.`,
  inspiration: `Create a NEW variant inspired by the strongest ideas in the parent(s), taken in a fresh direction.`,
  combination: `Combine the best mutations from the parent variants into a single coherent variant, explicitly reasoning about epistasis.`,
  simplification: `Simplify the variant (fewer mutations, lower construction effort) while preserving the structural mechanism that drives the improvement.`,
  'out-of-box': `Move away from the parents and propose a divergent, out-of-the-box variant that attacks the goal from an unconventional structural angle.`,
  'empirical-refinement': `Refine the variant in light of the MEASURED RESULTS below. Keep and amplify mutations empirically shown to help; remove or replace ones shown to destabilise or kill expression; address the observed failure modes directly. Ground the new variant in what the assay actually showed.`
}

const REVIEW_MODE_INSTRUCTIONS: Record<ReviewType, string> = {
  initial: `INITIAL REVIEW (no external tools). Quickly assess correctness, quality, novelty, and a preliminary foldability/safety check. Aim to discard flawed, trivial, or destabilising variants. Be decisive.`,
  full: `FULL REVIEW (with literature). Evaluate correctness, quality, and novelty using the literature evidence. Scrutinise the structural rationale and assumptions; judge novelty against known mutational studies.`,
  'deep-verification': `DEEP VERIFICATION REVIEW. Decompose the variant into its constituent assumptions (this residue controls X; this mutation is stabilising; the fold tolerates it). Independently evaluate each for correctness. Identify any invalidating element and whether it is fundamental or fixable.`,
  observation: `OBSERVATION REVIEW. Determine whether this variant could explain or exploit known long-tail structure–function observations that existing variants do not. Note any such observations.`,
  simulation: `SIMULATION REVIEW. Mentally simulate folding and function step-by-step (packing change, ΔΔG, active-site geometry, expected activity/stability). Identify failure scenarios (misfolding, aggregation, dead enzyme) and where the variant could break.`,
  tournament: `TOURNAMENT REVIEW. Using recurring issues seen across the campaign, re-review this variant focusing on the most common failure modes.`,
  expert: `EXPERT REVIEW.`,
  calibration: `CALIBRATION REVIEW. The MEASURED RESULTS below are ground truth from the assay. Compare them against the variant's quantitative prediction: quantify the gap, diagnose mechanistically WHY the prediction missed (which structural assumption was wrong), and rewrite the assessment to reflect reality. Treat the measurement as dominant evidence. If the results refute the variant, say so plainly (verdict reject); if they confirm it, recognise the validated mechanism.`
}

function scaffoldBlock(campaign: Campaign): string {
  const preset = systemPreset(PROTEIN_PACK, campaign.context.systemId)
  const name = preset?.isCustom
    ? campaign.context.customName?.trim() || 'Custom scaffold'
    : preset?.shortName ?? 'Unknown scaffold'
  const lines = [
    `Scaffold: ${name}${campaign.context.systemDetail ? ` (${campaign.context.systemDetail})` : ''}`,
    ...(preset?.promptHints ?? []).map((h) => `  ${h}`)
  ]
  if (campaign.context.notes) lines.push(`  Scientist notes: ${campaign.context.notes}`)
  return lines.join('\n')
}

async function callBestMatch(
  conn: McpConnectionLike,
  candidates: string[],
  args: Record<string, unknown>
): Promise<string | null> {
  if (!conn.enabled) return null
  for (const name of candidates) {
    if (conn.hasTool(name)) {
      try {
        return await conn.callText(name, args)
      } catch {
        return null
      }
    }
  }
  return null
}

const EXAMPLE = {
  target: 'GH11 xylanase thermostability (ΔTm ≥ +12 °C)',
  systemId: 'soluble-enzyme',
  systemDetail: 'Bacillus subtilis GH11 endo-1,4-β-xylanase, expressed in E. coli',
  notes:
    '1.8 Å homolog structure + MSA (~400 GH11 seqs) available. Assay: DSF thermal shift + DNS reducing-sugar activity on beechwood xylan at pH 6.',
  objective: 'increase-thermostability',
  goal: `Raise the apparent melting temperature (Tm) of a GH11 endo-1,4-β-xylanase by ≥12 °C while retaining ≥80% of wild-type specific activity at 50 °C, so it survives the 65–70 °C step in our pulp-bleaching process. Current Tm ≈ 58 °C; the enzyme loses >90% activity after 30 min at 60 °C.

Structure/mechanism: GH11 xylanases have a compact β-jelly-roll fold with a flexible "thumb" loop over the active-site cleft. Thermal unfolding is thought to initiate at the N-terminal region and the exposed thumb/cord loops.

Known levers: an N-terminal disulfide bridge, more surface arginines and aromatic stacking, second-shell core repacking, and consensus/ancestral stabilisation.

Prior attempts: a single S100C/N150C disulfide added ~5 °C but cut activity ~30%; random mutagenesis gave thermostable but nearly inactive hits.

Consider combining a rigidifying disulfide with consensus surface mutations and core repacking, and reason explicitly about epistasis and the activity–stability trade-off.`,
  preferences:
    'Prefer a small set of mutations (≤6) achievable by site-directed mutagenesis, keep soluble expression in E. coli high, and avoid mutating or directly contacting the two catalytic glutamates. Favour designs scorable with our DSF + DNS assays.',
  availableTools: [
    'site-directed mutagenesis',
    'Rosetta ddG / FoldX',
    'ProteinMPNN + ESM',
    'homolog crystal structure (1.8 Å)',
    'GH11 MSA (~400 sequences)',
    'DSF thermal shift',
    'DNS reducing-sugar activity assay'
  ],
  forbiddenActions: ['mutating the catalytic glutamates', 'expression hosts above BSL-1'],
  complianceLevel: 'BSL-1',
  onlyNovel: false
} satisfies DomainPack['example']

const PROTEIN_PACK: DomainPack = {
  id: 'protein',
  labels: LABELS,
  example: EXAMPLE,
  objectives: OBJECTIVES,
  methodTypes: METHOD_TYPES,
  metrics: METRICS,
  planPhases: PLAN_PHASES,
  outcomes: OUTCOMES,
  complianceLevels: COMPLIANCE_LEVELS,
  criteria: CRITERIA,
  systemPresets: SYSTEM_PRESETS,
  safetyGates: SAFETY_GATES,
  tools: [
    {
      id: 'structure-oracle',
      label: 'Structure oracle (fold/stability)',
      description: 'Look up or predict structure/stability context (ΔΔG, pLDDT, known domains) for the scaffold or a proposed variant.',
      defaultConfig: { enabled: false, url: 'http://localhost:3004' },
      async gatherEvidence(hyp, conn) {
        const target = hyp.methods.flatMap((m) => m.targets)[0] ?? hyp.system
        if (!target) return undefined
        const raw = await callBestMatch(
          conn,
          ['predict_stability', 'get_structure', 'fold_context', 'lookup_protein'],
          { query: target, mutation: target, scaffold: hyp.system }
        )
        if (raw == null) return undefined
        return `Structure context for "${target}": ${raw.slice(0, 2000)}`
      }
    }
  ],

  systemPreamble: () => SYSTEM_PREAMBLE,

  renderGoalContext(campaign) {
    return `RESEARCH GOAL
Property target: ${campaign.target}
Objective: ${OBJECTIVE_PROMPT_LABELS[campaign.objective] ?? campaign.objective}
${scaffoldBlock(campaign)}

Full goal statement:
${campaign.goal}

Constraints:
- Available methods/tools: ${campaign.constraints.availableTools.join(', ') || 'standard toolkit'}
- Forbidden actions: ${campaign.constraints.forbiddenActions.join(', ') || 'none specified'}
- Biosafety level: ${campaign.constraints.complianceLevel ?? 'unspecified'}
- ${campaign.constraints.onlyNovel ? 'Only propose demonstrably NOVEL variants (not already published).' : 'Novel and established variants are both acceptable; prefer novel where possible.'}
${campaign.constraints.regulatoryNotes ? `- Regulatory notes: ${campaign.constraints.regulatoryNotes}` : ''}

Desirable attributes / preferences:
${campaign.preferences || '(none specified)'}`
  },

  hypothesisJsonSchema: () => DESIGN_JSON_SCHEMA,
  generationStrategyInstructions: () => GENERATION_STRATEGY_INSTRUCTIONS,
  evolutionStrategyInstructions: () => EVOLUTION_STRATEGY_INSTRUCTIONS,
  reviewModeInstructions: () => REVIEW_MODE_INSTRUCTIONS,

  literatureQuery(campaign, kind, hyp?: Hypothesis) {
    if (kind === 'generation') {
      return `protein engineering mutations to ${campaign.objective} for ${campaign.target} in ${campaign.context.systemId}`
    }
    if (kind === 'review') {
      return `${hyp?.title ?? ''} ${campaign.target} protein engineering prior work`
    }
    return `improve ${hyp?.title ?? ''} ${campaign.target} protein variant`
  },

  defaultCampaignTitle: ({ target, systemShortName }) => `${target} — ${systemShortName}`
}

export default PROTEIN_PACK
