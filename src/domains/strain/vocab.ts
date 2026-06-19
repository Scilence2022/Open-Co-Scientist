/**
 * Strain-engineering vocabulary + experimental-system registry. These are the
 * open-id option lists the engine and UI resolve labels against; moved verbatim
 * from the former shared/domain.ts enums and shared/hosts.ts presets.
 */
import type { CriterionDescriptor, MetricOption, SystemPreset, VocabOption } from '@shared/domainpack'

/** Engineering objectives (was EngineeringObjective + OBJECTIVE_LABELS). */
export const OBJECTIVES: VocabOption[] = [
  { id: 'increase-titer', label: 'Increase titer' },
  { id: 'increase-rate', label: 'Increase rate' },
  { id: 'increase-yield', label: 'Increase yield' },
  { id: 'broaden-substrate', label: 'Broaden substrate scope' },
  { id: 'improve-tolerance', label: 'Improve tolerance' },
  { id: 'reduce-byproduct', label: 'Reduce byproduct' },
  { id: 'improve-stability', label: 'Improve genetic stability' },
  { id: 'other', label: 'Other' }
]

/** Genetic intervention types (was InterventionType + INTERVENTION_LABELS). */
export const METHOD_TYPES: VocabOption[] = [
  { id: 'knockout', label: 'Knockout' },
  { id: 'overexpression', label: 'Overexpression' },
  { id: 'knockdown', label: 'Knockdown' },
  { id: 'promoter-swap', label: 'Promoter swap' },
  { id: 'rbs-tuning', label: 'RBS tuning' },
  { id: 'heterologous-pathway', label: 'Heterologous pathway' },
  { id: 'transporter-engineering', label: 'Transporter engineering' },
  { id: 'cofactor-balancing', label: 'Cofactor balancing' },
  { id: 'dynamic-regulation', label: 'Dynamic regulation' },
  { id: 'enzyme-engineering', label: 'Enzyme engineering' },
  { id: 'other', label: 'Other' }
]

/** Measurable phenotypes (was QuantPrediction.metric union). */
export const METRICS: MetricOption[] = [
  { id: 'titer', label: 'Titer', defaultUnit: 'g/L' },
  { id: 'rate', label: 'Rate', defaultUnit: 'g/L/h' },
  { id: 'yield', label: 'Yield', defaultUnit: 'g/g' },
  { id: 'tolerance', label: 'Tolerance' },
  { id: 'other', label: 'Other' }
]

/** DBTL plan phases (was DBTLStep.phase union). */
export const PLAN_PHASES: VocabOption[] = [
  { id: 'design', label: 'Design' },
  { id: 'build', label: 'Build' },
  { id: 'test', label: 'Test' },
  { id: 'learn', label: 'Learn' }
]

/** Result outcomes (was ResultOutcome + RESULT_OUTCOME_LABELS). */
export const OUTCOMES: VocabOption[] = [
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'partial', label: 'Partial' },
  { id: 'refuted', label: 'Refuted' },
  { id: 'inconclusive', label: 'Inconclusive' },
  { id: 'build-failed', label: 'Build failed' }
]

/** Biosafety levels (was BiosafetyLevel). */
export const COMPLIANCE_LEVELS: VocabOption[] = [
  { id: 'BSL-1', label: 'BSL-1' },
  { id: 'BSL-2', label: 'BSL-2' },
  { id: 'unspecified', label: 'Unspecified' }
]

/**
 * Tournament judging criteria (was CriteriaWeights/CRITERION_LABELS +
 * CRITERION_GUIDANCE + DEFAULT_CRITERIA_WEIGHTS). `effectiveness` dominates (3×)
 * because for a production strain the impact of the modification target usually
 * matters more than novelty.
 */
export const CRITERIA: CriterionDescriptor[] = [
  { id: 'alignment', label: 'Alignment', defaultWeight: 1, gloss: 'fit to the stated goal and constraints' },
  {
    id: 'effectiveness',
    label: 'Effectiveness',
    defaultWeight: 3,
    gloss: 'expected magnitude of improvement in the target phenotype (titer/rate/yield) if the modification works — how impactful is the chosen target'
  },
  {
    id: 'plausibility',
    label: 'Plausibility',
    defaultWeight: 1,
    gloss: 'metabolic/thermodynamic feasibility — is the mechanism likely to work at all'
  },
  { id: 'novelty', label: 'Novelty', defaultWeight: 1, gloss: 'how non-obvious vs. known approaches' },
  {
    id: 'testability',
    label: 'Testability',
    defaultWeight: 1,
    gloss: 'genetic tractability + assay availability in this host'
  },
  {
    id: 'hostCompatibility',
    label: 'Host compatibility',
    defaultWeight: 1,
    gloss: 'metabolic burden, toxicity, genetic stability'
  },
  { id: 'safety', label: 'Safety', defaultWeight: 1, gloss: 'biosafety / dual-use risk' }
]

/** Built-in chassis presets (was HOST_PRESETS). */
export const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'ecoli',
    name: 'Escherichia coli',
    shortName: 'E. coli',
    promptHints: [
      'Lineage: Gram-negative bacterium',
      'Strengths: Fast growth, rich genetic toolkit, recombinant proteins, platform chemicals',
      'Engineering idioms to prefer: Prefer lambda-Red / CRISPR-Cas9 edits, plasmid or genome-integrated overexpression with characterised promoters (T7, anderson, pTac), RBS-calculator tuning, MAGE for multiplexed edits.'
    ]
  },
  {
    id: 'scerevisiae',
    name: 'Saccharomyces cerevisiae',
    shortName: 'S. cerevisiae',
    promptHints: [
      'Lineage: Eukaryotic yeast',
      'Strengths: Robust industrial fermentation, terpenoids, secreted proteins, tolerant of harsh conditions',
      'Engineering idioms to prefer: Prefer CRISPR-Cas9 with gRNA/HR donor, promoter swaps (TEF1, PGK1, GAL inducible), Ty/delta integration, codon optimisation, compartment targeting (mitochondria/peroxisome) for pathway flux.'
    ]
  },
  {
    id: 'cglutamicum',
    name: 'Corynebacterium glutamicum',
    shortName: 'C. glutamicum',
    promptHints: [
      'Lineage: Gram-positive actinobacterium',
      'Strengths: Amino-acid and organic-acid production at industrial scale; high tolerance',
      'Engineering idioms to prefer: Prefer suicide-vector (pK19mobsacB) markerless edits, CRISPRi knockdowns, native strong promoters (Psod, Ptuf, Pgro), feedback-resistant enzyme variants for amino-acid pathways.'
    ]
  },
  {
    id: 'bsubtilis',
    name: 'Bacillus subtilis',
    shortName: 'B. subtilis',
    promptHints: [
      'Lineage: Gram-positive bacterium',
      'Strengths: Secreted enzymes, GRAS status, high secretion capacity',
      'Engineering idioms to prefer: Prefer genome integration at amyE/lacA, signal-peptide engineering for secretion, xylose/IPTG inducible systems, removal of proteases (e.g. nprE, aprE) to stabilise products.'
    ]
  },
  {
    id: 'pputida',
    name: 'Pseudomonas putida',
    shortName: 'P. putida',
    promptHints: [
      'Lineage: Gram-negative bacterium',
      'Strengths: Solvent tolerance, redox-rich metabolism, aromatic and non-natural chemistries',
      'Engineering idioms to prefer: Prefer SEVA vectors, CRISPR/recombineering, exploit strong NADPH supply and stress tolerance for redox-intensive pathways.'
    ]
  },
  {
    id: 'ppastoris',
    name: 'Komagataella phaffii (Pichia pastoris)',
    shortName: 'P. pastoris',
    promptHints: [
      'Lineage: Methylotrophic yeast',
      'Strengths: High-density fermentation, strong inducible expression, secreted recombinant proteins',
      'Engineering idioms to prefer: Prefer AOX1/GAP promoters, α-factor secretion signal, multi-copy genome integration, methanol-inducible or constitutive expression depending on product.'
    ]
  },
  {
    id: 'custom',
    name: 'Custom host',
    shortName: 'Custom',
    isCustom: true,
    promptHints: [
      'Lineage: User-specified',
      'Strengths: Defined by the scientist',
      'Engineering idioms to prefer: Use the host context and notes provided by the scientist; ground genetic feasibility against genomic data where available.'
    ]
  },
  {
    id: 'agnostic',
    name: 'Host-agnostic (recommend chassis)',
    shortName: 'Host-agnostic',
    isUnspecified: true,
    promptHints: [
      'Lineage: To be determined',
      'Strengths: Optimise around the target molecule and let the system recommend a chassis',
      'Engineering idioms to prefer: Evaluate candidate chassis (E. coli, yeast, C. glutamicum, etc.) against the product and constraints, recommend the best fit, and justify the choice.'
    ]
  }
]
