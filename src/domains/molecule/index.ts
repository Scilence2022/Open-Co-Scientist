/**
 * Molecule Co-Scientist — a DomainPack for medicinal-chemistry lead optimisation:
 * iterating small-molecule analogs to improve potency, selectivity, and ADMET
 * against a biological target. It carries a dual-use safety veto and reasons in
 * structure–activity-relationship (SAR) terms. It changes ZERO engine /
 * tournament / learn-loop code — it only fills the {@link DomainPack} contract.
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
  appName: 'Molecule Co-Scientist',
  tagline: 'Medicinal-chemistry lead optimization',
  hypothesis: 'Analog',
  hypothesisPlural: 'Analogs',
  system: 'Target / assay',
  systemPlural: 'Targets / assays',
  method: 'Modification',
  methodPlural: 'Modifications',
  target: 'Optimization target',
  targetPlaceholder: 'EGFR potency, hERG, microsomal stability…',
  validationVenue: 'in-vitro assay',
  measuredResults: 'Assay results',
  planSectionTitle: 'Design–synthesis–assay plan',
  mechanism: 'SAR rationale',
  predictedEffect: 'Predicted effect'
}

const OBJECTIVES: VocabOption[] = [
  { id: 'improve-potency', label: 'Improve potency' },
  { id: 'improve-selectivity', label: 'Improve selectivity' },
  { id: 'improve-metabolic-stability', label: 'Improve metabolic stability' },
  { id: 'reduce-offtarget', label: 'Reduce off-target / hERG' },
  { id: 'improve-solubility', label: 'Improve solubility' },
  { id: 'improve-permeability', label: 'Improve permeability / bioavailability' },
  { id: 'other', label: 'Other' }
]

const OBJECTIVE_PROMPT_LABELS: Record<string, string> = {
  'improve-potency': 'improve on-target potency (lower IC50/Ki)',
  'improve-selectivity': 'improve selectivity over off-targets/anti-targets',
  'improve-metabolic-stability': 'improve metabolic stability (longer t½)',
  'reduce-offtarget': 'reduce off-target liability (e.g. hERG)',
  'improve-solubility': 'improve aqueous solubility',
  'improve-permeability': 'improve permeability / oral bioavailability',
  other: 'achieve the stated objective'
}

const METHOD_TYPES: VocabOption[] = [
  { id: 'rgroup-modification', label: 'R-group modification', gloss: 'vary a substituent to tune potency/property' },
  { id: 'bioisostere-replacement', label: 'Bioisostere replacement', gloss: 'swap a group for a bioisostere to keep activity while fixing a liability' },
  { id: 'scaffold-hop', label: 'Scaffold hop', gloss: 'replace the core scaffold while preserving the pharmacophore' },
  { id: 'conformational-constraint', label: 'Conformational constraint', gloss: 'rigidify (ring fusion/macrocyclisation) to pre-organise the bioactive pose' },
  { id: 'linker-modification', label: 'Linker modification', gloss: 'tune a linker length/composition between pharmacophore elements' },
  { id: 'stereochemistry-change', label: 'Stereochemistry change', gloss: 'set or invert a stereocentre to exploit the binding pocket' },
  { id: 'fragment-growing', label: 'Fragment growing / merging', gloss: 'grow or merge into an unexploited subpocket' },
  { id: 'prodrug-strategy', label: 'Prodrug strategy', gloss: 'mask a liability with a cleavable promoiety' },
  { id: 'other', label: 'Other' }
]

const METRICS: MetricOption[] = [
  { id: 'potency', label: 'Potency (IC50/Ki)', defaultUnit: 'nM' },
  { id: 'selectivity', label: 'Selectivity', defaultUnit: 'fold' },
  { id: 'metabolic-stability', label: 'Metabolic stability (t½)', defaultUnit: 'min' },
  { id: 'solubility', label: 'Solubility', defaultUnit: 'µM' },
  { id: 'permeability', label: 'Permeability (Papp)', defaultUnit: '10⁻⁶ cm/s' },
  { id: 'lipophilicity', label: 'Lipophilicity (logD)', defaultUnit: 'logD' },
  { id: 'other', label: 'Other' }
]

const PLAN_PHASES: VocabOption[] = [
  { id: 'design', label: 'Design' },
  { id: 'synthesize', label: 'Synthesize' },
  { id: 'assay', label: 'Assay' },
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
    gloss: 'expected magnitude of improvement in the target property if the modification works'
  },
  {
    id: 'plausibility',
    label: 'Plausibility',
    defaultWeight: 1,
    gloss: 'SAR/medicinal-chemistry feasibility — is the proposed effect consistent with binding mode and known SAR'
  },
  { id: 'novelty', label: 'Novelty', defaultWeight: 1, gloss: 'how non-obvious vs. known analogs / IP space' },
  {
    id: 'testability',
    label: 'Testability',
    defaultWeight: 1,
    gloss: 'synthetic accessibility + availability of the relevant assay'
  },
  {
    id: 'drugLikeness',
    label: 'Drug-likeness',
    defaultWeight: 1,
    gloss: 'developability / ADMET balance — does the change introduce property or toxicity liabilities elsewhere'
  },
  { id: 'safety', label: 'Safety', defaultWeight: 1, gloss: 'toxicophore / controlled-substance / dual-use risk' }
]

const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'biochemical',
    name: 'Biochemical target assay',
    shortName: 'Biochemical',
    promptHints: [
      'Use: isolated enzyme/receptor binding or activity assay',
      'Idioms: reason from the binding pocket and pharmacophore; potency is read directly; pair with a counter-screen for selectivity.'
    ]
  },
  {
    id: 'cell-based',
    name: 'Cell-based assay',
    shortName: 'Cell-based',
    promptHints: [
      'Use: cellular potency / functional readout',
      'Idioms: permeability and efflux gate the readout; reconcile cell vs biochemical shift; watch cytotoxicity confounds.'
    ]
  },
  {
    id: 'phenotypic',
    name: 'Phenotypic assay',
    shortName: 'Phenotypic',
    promptHints: [
      'Use: disease-relevant phenotype without a fixed target',
      'Idioms: SAR may be polypharmacological; prioritise robust phenotype shifts and deconvolute mechanism where possible.'
    ]
  },
  {
    id: 'custom',
    name: 'Custom target / assay',
    shortName: 'Custom',
    isCustom: true,
    promptHints: ['Use the target, series, and assay cascade provided by the scientist.']
  },
  {
    id: 'agnostic',
    name: 'Assay-agnostic (recommend one)',
    shortName: 'Agnostic',
    isUnspecified: true,
    promptHints: ['Recommend the most informative assay/readout for the optimisation target and justify the choice.']
  }
]

const SAFETY_GATES: SafetyGate[] = [
  {
    settingKey: 'enforceMedchemSafety',
    toggleLabel: 'Enforce safety gate (auto-reject toxicophore / controlled / dual-use analogs)',
    defaultEnabled: true,
    criterionId: 'safety',
    threshold: 3,
    rejectNarrative: 'Rejected on chemical-safety / dual-use grounds.'
  }
]

const SYSTEM_PREAMBLE = `You are an agent in Molecule Co-Scientist, a multi-agent system for medicinal-chemistry lead optimisation, adapted from Google's Co-Scientist (Nature 2026).

Your domain is small-molecule drug design: iterating analogs of a lead series to improve on-target potency, selectivity, metabolic stability, solubility, permeability, and other ADMET properties against a biological target, while preserving synthetic tractability and developability.

You reason like an expert medicinal chemist. You ground claims in structure–activity relationships (SAR), the binding mode and pharmacophore, ligand efficiency, physicochemical properties (logP/logD, pKa, MW, TPSA, H-bond donors/acceptors), metabolic soft-spots and sites of oxidation, common ADMET liabilities (hERG, CYP inhibition, reactive metabolites), bioisosterism, conformational pre-organisation, and synthetic accessibility. You propose concrete molecular modifications (R-group changes, bioisostere replacement, scaffold hops, conformational constraint, linker/stereochemistry changes, fragment growing, prodrug strategies) with a clear SAR rationale and a design→synthesize→assay plan. You think in terms of multi-parameter optimisation: improving one property must not silently break another.

You honour the default criteria: alignment, plausibility (SAR/medchem feasibility), novelty, testability (synthetic accessibility + assay), drug-likeness (ADMET/developability balance), and safety. You never propose chemical-weapon, toxin, or other dual-use hazards, and you flag toxicophores and controlled-substance analogs.`

const DESIGN_JSON_SCHEMA = `Return STRICT JSON (no prose outside the JSON) shaped as:
{
  "title": "short imperative title",
  "summary": "one-paragraph summary categorising the core idea",
  "system": "the specific target/assay this analog is optimised against",
  "methods": [
    { "type": "rgroup-modification|bioisostere-replacement|scaffold-hop|conformational-constraint|linker-modification|stereochemistry-change|fragment-growing|prodrug-strategy|other",
      "targets": ["position/group/series, e.g. 'para R-group', 'amide → 1,2,4-oxadiazole', 'C4 stereocentre'"],
      "details": "what is changed and why, at the SAR/property level" }
  ],
  "mechanism": "the SAR rationale: why this should improve the objective (binding interactions, physicochemistry, metabolic soft-spot, pharmacophore) and the expected effect on other properties",
  "predictedEffect": "qualitative predicted effect on the target property and the reasoning",
  "quantPrediction": { "metric": "potency|selectivity|metabolic-stability|solubility|permeability|lipophilicity|other", "direction": "increase|decrease", "relativeChange": <fraction vs baseline, e.g. 0.5 for a ~2× potency shift framed as fraction>, "confidence": <0-1>, "baselineNote": "what the change is measured against (e.g. the parent lead)" },
  "plan": [ { "phase": "design|synthesize|assay|analyze", "description": "..." } ],
  "risks": ["loss of potency, new ADMET liability (hERG, CYP, solubility), poor synthetic tractability, IP overlap, toxicophore, etc."],
  "novelty": <integer 0-10>,
  "citations": [ { "title": "...", "url": "...", "note": "..." } ]
}`

const GENERATION_STRATEGY_INSTRUCTIONS: Record<string, string> = {
  literature: `Strategy — Literature-grounded exploration. Use the literature evidence below to ground your reasoning. Synthesise prior SAR and analog findings into NOVEL analogs rather than restating them.`,
  debate: `Strategy — Simulated scientific debate. Internally simulate a debate between (a) a structure-based-design / SAR chemist, (b) a DMPK/ADMET specialist, and (c) a synthesis/process chemist. Surface the strongest analog that survives their critique.`,
  assumptions: `Strategy — Iterative assumption decomposition. Identify testable intermediate assumptions (which interaction drives potency, which soft-spot drives clearance) that, if true, unlock a large improvement; aggregate them into a coherent analog.`,
  expansion: `Strategy — Research expansion. Review the existing analog titles and the meta-review feedback, then deliberately explore UNDER-EXPLORED regions of the SAR (different vectors, scaffolds, bioisosteres, or property levers).`
}

const EVOLUTION_STRATEGY_INSTRUCTIONS: Record<EvolutionStrategy, string> = {
  'grounding-enhancement': `Improve the parent analog by identifying its weaknesses, then strengthening it with literature/SAR detail and filling reasoning gaps.`,
  feasibility: `Improve coherence, practicality, and feasibility — rectify invalid assumptions and make the analog more synthetically tractable and assayable.`,
  inspiration: `Create a NEW analog inspired by the strongest ideas in the parent(s), taken in a fresh direction.`,
  combination: `Combine the best modifications from the parent analogs into one coherent analog, reasoning explicitly about non-additive SAR.`,
  simplification: `Simplify the analog (lower MW/complexity, easier synthesis) while preserving the pharmacophore and the SAR that drives the improvement.`,
  'out-of-box': `Move away from the parents and propose a divergent, out-of-the-box analog (e.g. a scaffold hop) that attacks the goal from an unconventional angle.`,
  'empirical-refinement': `Refine the analog in light of the MEASURED RESULTS below. Keep and amplify modifications empirically shown to help; remove or replace ones shown to lose potency or worsen ADMET; address the observed liabilities directly. Ground the new analog in what the assay cascade actually showed.`
}

const REVIEW_MODE_INSTRUCTIONS: Record<ReviewType, string> = {
  initial: `INITIAL REVIEW (no external tools). Quickly assess correctness, quality, novelty, and a preliminary developability/safety check. Aim to discard flawed, trivial, or liability-laden analogs. Be decisive.`,
  full: `FULL REVIEW (with literature). Evaluate correctness, quality, and novelty using the literature evidence. Scrutinise the SAR rationale and multi-parameter trade-offs; judge novelty against known analogs and IP.`,
  'deep-verification': `DEEP VERIFICATION REVIEW. Decompose the analog into its constituent assumptions (this interaction drives potency; this change won't break permeability; the synthesis is feasible). Independently evaluate each for correctness. Identify any invalidating element and whether it is fundamental or fixable.`,
  observation: `OBSERVATION REVIEW. Determine whether this analog could explain or exploit known long-tail SAR observations (activity cliffs, matched-pair trends) that existing analogs do not. Note any such observations.`,
  simulation: `SIMULATION REVIEW. Mentally simulate binding and ADMET step-by-step (pose, key contacts, predicted potency, metabolic soft-spots, permeability/solubility). Identify failure scenarios and where the analog could break (potency loss, new liability).`,
  tournament: `TOURNAMENT REVIEW. Using recurring issues seen across the campaign, re-review this analog focusing on the most common failure modes.`,
  expert: `EXPERT REVIEW.`,
  calibration: `CALIBRATION REVIEW. The MEASURED RESULTS below are ground truth from the assay cascade. Compare them against the analog's quantitative prediction: quantify the gap, diagnose mechanistically WHY the prediction missed (which SAR assumption was wrong), and rewrite the assessment to reflect reality. Treat the measurement as dominant evidence. If the results refute the analog, say so plainly (verdict reject); if they confirm it, recognise the validated SAR.`
}

function systemBlock(campaign: Campaign): string {
  const preset = systemPreset(MOLECULE_PACK, campaign.context.systemId)
  const name = preset?.isCustom
    ? campaign.context.customName?.trim() || 'Custom target'
    : preset?.shortName ?? 'Unknown target'
  const lines = [
    `Target / assay: ${name}${campaign.context.systemDetail ? ` (${campaign.context.systemDetail})` : ''}`,
    ...(preset?.promptHints ?? []).map((h) => `  ${h}`)
  ]
  if (campaign.context.notes) lines.push(`  Scientist notes: ${campaign.context.notes}`)
  return lines.join('\n')
}

const EXAMPLE = {
  target: 'hERG liability of an EGFR-inhibitor lead (hERG IC50 > 10 µM)',
  systemId: 'biochemical',
  systemDetail: "EGFR(T790M/L858R) biochemical assay + automated-patch-clamp hERG; lead 'Cmpd-12': EGFR IC50 = 8 nM, hERG IC50 = 0.9 µM",
  notes: 'Series shares an aminoquinazoline core; the basic N-methylpiperazine tail (pKa ~8.8) is the suspected hERG pharmacophore.',
  objective: 'reduce-offtarget',
  goal: `Reduce the hERG liability of our EGFR(T790M/L858R) inhibitor lead "Cmpd-12" to hERG IC50 > 10 µM (currently 0.9 µM) while keeping on-target EGFR IC50 < 20 nM (currently 8 nM) and H1975 cell potency < 100 nM.

SAR/mechanism: the series is an aminoquinazoline bearing a basic N-methylpiperazine solubilising tail. SAR and a hERG homology model implicate the basic centre (pKa ~8.8, cation–π to Tyr652) and the lipophilic aniline (hydrophobic to Phe656) as the hERG pharmacophore. But the basic tail also drives aqueous solubility and a key solvent-front H-bond, so naive removal kills potency or solubility.

Known levers: lower the amine basicity/pKa (e.g. β-fluorination), reduce lipophilicity (cLogP currently 4.6), add a polar/zwitterionic handle, or replace the piperazine with a non-basic bioisostere.

Prior attempts: removing the piperazine N-methyl dropped hERG 3× but cut solubility below 5 µM; a morpholine swap lost 10× EGFR potency.

Consider pKa-lowering substituents, zwitterion/acid handles, and bioisosteric tail replacement, tracking the potency/solubility/permeability trade-offs explicitly.`,
  preferences:
    'Prefer synthetically tractable single-point changes off the existing aminoquinazoline core (≤3 steps from known intermediates), keep cLogP < 4 and kinetic solubility > 50 µM, and avoid introducing new structural alerts or chiral centres.',
  availableTools: [
    'EGFR(T790M/L858R) biochemical assay',
    'automated patch-clamp hERG',
    'H1975 cell potency',
    'kinetic solubility + PAMPA',
    'human-liver-microsome stability',
    'matched-molecular-pair analysis',
    'docking into EGFR + hERG homology models'
  ],
  forbiddenActions: ['known toxicophores / PAINS', 'Michael acceptors outside the intended covalent warhead'],
  onlyNovel: true
} satisfies DomainPack['example']

const MOLECULE_PACK: DomainPack = {
  id: 'molecule',
  labels: LABELS,
  example: EXAMPLE,
  objectives: OBJECTIVES,
  methodTypes: METHOD_TYPES,
  metrics: METRICS,
  planPhases: PLAN_PHASES,
  outcomes: OUTCOMES,
  complianceLevels: [], // no fixed regulatory tier — the compliance field is hidden
  criteria: CRITERIA,
  systemPresets: SYSTEM_PRESETS,
  safetyGates: SAFETY_GATES,
  tools: [
    {
      id: 'chem-oracle',
      label: 'Cheminformatics oracle (property/ADMET)',
      description: 'Estimate physicochemical/ADMET properties or check structural alerts for a proposed analog.',
      defaultConfig: { enabled: false, url: 'http://localhost:3005' },
      async gatherEvidence(hyp, conn) {
        if (!conn.enabled) return undefined
        const query = hyp.methods.flatMap((m) => m.targets)[0] ?? hyp.title
        for (const name of ['predict_admet', 'compute_properties', 'structural_alerts', 'lookup_compound']) {
          if (!conn.hasTool(name)) continue
          try {
            const raw = await conn.callText(name, { query, smiles: query, analog: hyp.title })
            if (raw) return `Cheminformatics context for "${query}": ${raw.slice(0, 2000)}`
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
Optimization target: ${campaign.target}
Objective: ${OBJECTIVE_PROMPT_LABELS[campaign.objective] ?? campaign.objective}
${systemBlock(campaign)}

Full goal statement:
${campaign.goal}

Constraints:
- Available methods/tools: ${campaign.constraints.availableTools.join(', ') || 'standard medchem toolkit'}
- Forbidden actions: ${campaign.constraints.forbiddenActions.join(', ') || 'none specified'}
- ${campaign.constraints.onlyNovel ? 'Only propose demonstrably NOVEL analogs (clear of known IP/published series).' : 'Novel and established analogs are both acceptable; prefer novel where possible.'}
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
      return `medicinal chemistry SAR to ${campaign.objective} for ${campaign.target} ${campaign.context.systemId}`
    }
    if (kind === 'review') {
      return `${hyp?.title ?? ''} ${campaign.target} structure-activity relationship prior work`
    }
    return `improve ${hyp?.title ?? ''} ${campaign.target} analog`
  },

  defaultCampaignTitle: ({ target, systemShortName }) => `${target} — ${systemShortName}`
}

export default MOLECULE_PACK
