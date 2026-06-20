/**
 * Strain Co-Scientist — the flagship DomainPack.
 *
 * Rational engineering of industrial microbial strains. This pack carries the
 * agent persona, prompt phrasing, vocabulary, judging criteria, chassis
 * registry, the biosafety veto, and the CodeXomics genomic-grounding tool —
 * everything that was previously hard-coded into the engine. The Co-Scientist
 * machinery itself is domain-neutral and lives in the engine.
 */
import type { Campaign, EvolutionStrategy, Hypothesis, ReviewType } from '@shared/domain'
import type { DomainPack, McpConnectionLike, PackLabels, SafetyGate } from '@shared/domainpack'
import { systemPreset } from '@shared/domainpack'
import {
  COMPLIANCE_LEVELS,
  CRITERIA,
  METHOD_TYPES,
  METRICS,
  OBJECTIVES,
  OUTCOMES,
  PLAN_PHASES,
  SYSTEM_PRESETS
} from './vocab'

const LABELS: PackLabels = {
  appName: 'Strain Co-Scientist',
  tagline: 'Rational strain engineering',
  hypothesis: 'Design',
  hypothesisPlural: 'Designs',
  system: 'Host / chassis',
  systemPlural: 'Hosts',
  method: 'Intervention',
  methodPlural: 'Interventions',
  target: 'Product target',
  targetPlaceholder: 'mevalonate, L-lysine, secreted amylase…',
  validationVenue: 'wet-lab',
  measuredResults: 'Wet-lab results',
  planSectionTitle: 'DBTL experimental plan',
  mechanism: 'Mechanism',
  predictedEffect: 'Predicted effect'
}

const SYSTEM_PREAMBLE = `You are an agent in Strain Co-Scientist, a multi-agent system for the rational engineering of industrial microbial strains, adapted from Google's Co-Scientist (Nature 2026).

Your domain is metabolic and strain engineering: improving titer, rate, and yield (TRY) of target products, broadening substrate range, improving tolerance/robustness, and reducing byproducts in industrial host organisms.

You reason like an expert metabolic engineer. You ground claims in pathway biochemistry, enzyme kinetics, cofactor/redox balance, thermodynamics (e.g. ΔG, MDF), regulation (transcriptional/allosteric/feedback), genetic tractability of the host, and metabolic burden. You propose concrete genetic interventions (knockouts, overexpression, knockdowns, promoter/RBS tuning, heterologous pathways, transporter and cofactor engineering, dynamic regulation, enzyme engineering) with a clear mechanism and a Design-Build-Test-Learn (DBTL) plan.

You honour the default criteria: alignment with the goal, plausibility (metabolic/thermodynamic feasibility), novelty, testability (genetic tractability + assay availability), host compatibility (burden/toxicity/stability), and safety/biosafety. You never propose unsafe, dual-use, or biosafety-violating work.`

const OBJECTIVE_PROMPT_LABELS: Record<string, string> = {
  'increase-titer': 'increase product titer',
  'increase-rate': 'increase production rate',
  'increase-yield': 'increase product yield',
  'broaden-substrate': 'broaden substrate range',
  'improve-tolerance': 'improve tolerance/robustness',
  'reduce-byproduct': 'reduce byproduct formation',
  'improve-stability': 'improve genetic/phenotypic stability',
  other: 'achieve the stated objective'
}

const DESIGN_JSON_SCHEMA = `Return STRICT JSON (no prose outside the JSON) shaped as:
{
  "title": "short imperative title",
  "summary": "one-paragraph summary categorising the core idea",
  "system": "the specific chassis this design targets",
  "methods": [
    { "type": "knockout|overexpression|knockdown|promoter-swap|rbs-tuning|heterologous-pathway|transporter-engineering|cofactor-balancing|dynamic-regulation|enzyme-engineering|other",
      "targets": ["gene/operon names"],
      "details": "what is done and why, at the molecular level" }
  ],
  "mechanism": "the mechanistic rationale: why this should improve the objective (flux, redox, thermodynamics, regulation)",
  "predictedEffect": "qualitative predicted effect on titer/rate/yield and the reasoning",
  "quantPrediction": { "metric": "titer|rate|yield|tolerance|other", "direction": "increase|decrease", "relativeChange": <fraction vs baseline, e.g. 0.3 for +30%>, "confidence": <0-1>, "baselineNote": "what the change is measured against" },
  "plan": [ { "phase": "design|build|test|learn", "description": "..." } ],
  "risks": ["metabolic burden, toxicity, genetic instability, biosafety, etc."],
  "novelty": <integer 0-10>,
  "citations": [ { "title": "...", "url": "...", "note": "..." } ]
}`

function hostBlock(campaign: Campaign): string {
  const preset = systemPreset(STRAIN_PACK, campaign.context.systemId)
  const name = preset?.isCustom
    ? campaign.context.customName?.trim() || 'Custom host'
    : preset?.shortName ?? 'Unknown host'
  const lines = [
    `Host / chassis: ${name}${campaign.context.systemDetail ? ` (${campaign.context.systemDetail})` : ''}`,
    ...(preset?.promptHints ?? []).map((h) => `  ${h}`)
  ]
  if (campaign.context.notes) lines.push(`  Scientist host notes: ${campaign.context.notes}`)
  return lines.join('\n')
}

const GENERATION_STRATEGY_INSTRUCTIONS: Record<string, string> = {
  literature: `Strategy — Literature-grounded exploration. Use the literature evidence below to ground your reasoning. Synthesise prior findings into NOVEL design strategies rather than restating them.`,
  debate: `Strategy — Simulated scientific debate. Internally simulate a debate between (a) a flux/pathway engineer, (b) a regulation/dynamics specialist, and (c) a fermentation/host-physiology expert. Surface the strongest design that survives their critique.`,
  assumptions: `Strategy — Iterative assumption decomposition. Identify testable intermediate assumptions that, if true, unlock a large improvement; aggregate them into a coherent design.`,
  expansion: `Strategy — Research expansion. Review the existing design titles and the meta-review feedback, then deliberately explore UNDER-EXPLORED regions of the design space (different intervention classes, different pathway nodes, different regulation logic).`
}

const EVOLUTION_STRATEGY_INSTRUCTIONS: Record<EvolutionStrategy, string> = {
  'grounding-enhancement': `Improve the parent design by identifying its weaknesses, then strengthening it with literature-grounded detail and filling reasoning gaps.`,
  feasibility: `Improve coherence, practicality, and feasibility — rectify invalid assumptions and make the design more buildable and testable in the host.`,
  inspiration: `Create a NEW design inspired by the strongest ideas in the parent design(s), taken in a fresh direction.`,
  combination: `Combine the best aspects of the parent designs into a single, coherent new design.`,
  simplification: `Simplify the design for easier construction and testing while preserving the mechanism that drives the improvement.`,
  'out-of-box': `Move away from the parents and propose a divergent, out-of-the-box design that attacks the goal from an unconventional angle.`,
  'empirical-refinement': `Refine the design in light of the MEASURED RESULTS below. Keep and amplify the interventions empirically shown to help; remove or replace the ones shown to fail or be lethal; address the observed failure modes directly. Ground the new design in what the lab actually observed, not in the original prediction.`
}

const REVIEW_MODE_INSTRUCTIONS: Record<ReviewType, string> = {
  initial: `INITIAL REVIEW (no external tools). Quickly assess correctness, quality, novelty, and a preliminary safety check. Aim to discard flawed, trivial, or unsafe designs. Be decisive.`,
  full: `FULL REVIEW (with literature). Evaluate correctness, quality, and novelty using the literature evidence. Scrutinise assumptions and reasoning; judge novelty against what is already known.`,
  'deep-verification': `DEEP VERIFICATION REVIEW. Decompose the design into its constituent assumptions and sub-assumptions. Independently evaluate each for correctness. Identify any invalidating element and whether it is fundamental to the design or fixable during refinement.`,
  observation: `OBSERVATION REVIEW. Determine whether this design could explain or exploit known long-tail observations/phenomena in the host's metabolism that existing designs do not. Note any such observations.`,
  simulation: `SIMULATION REVIEW. Mentally simulate the mechanism and the proposed experiment step-by-step (flux rerouting, cofactor balance, expected phenotype). Identify failure scenarios and where the design could break.`,
  tournament: `TOURNAMENT REVIEW. Using recurring issues seen across the campaign, re-review this design focusing on the most common failure modes.`,
  expert: `EXPERT REVIEW.`,
  calibration: `CALIBRATION REVIEW. The MEASURED RESULTS below are ground truth from the wet lab. Compare them against the design's quantitative prediction and predicted effect: quantify the prediction gap, diagnose mechanistically WHY the prediction missed (which assumption was wrong), and rewrite the assessment to reflect reality. Treat the measurement as the dominant evidence — score effectiveness/plausibility from what was observed, not what was hoped. If the results refute the design, say so plainly (verdict reject); if they confirm it, recognise the validated mechanism.`
}

const SAFETY_GATES: SafetyGate[] = [
  {
    settingKey: 'enforceBiosafety',
    toggleLabel: 'Enforce biosafety gate (auto-reject low-safety designs)',
    defaultEnabled: true,
    criterionId: 'safety',
    threshold: 3,
    rejectNarrative: 'Rejected on safety grounds.'
  }
]

// --- CodeXomics tool binding (genomic grounding + construct design) ----------
// Ported to use only the generic McpConnectionLike surface so the pack carries
// no main-process dependency and stays importable from the renderer.

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
  try {
    return await conn.callText(candidates[0], args)
  } catch {
    return null
  }
}

const EXAMPLE = {
  target: 'Mevalonate',
  systemId: 'ecoli',
  systemDetail: 'BL21(DE3)',
  notes: 'M9 glucose minimal medium, aerobic fed-batch; T7 expression background.',
  objective: 'increase-titer',
  goal: `Increase mevalonate titer in E. coli BL21(DE3) from the current ~5 g/L to >15 g/L over 48 h aerobic fed-batch on glucose. The upper mevalonate pathway (atoB–HMGS–HMGR) is expressed from a medium-copy plasmid under pTrc.

Known bottlenecks:
1. Acetyl-CoA supply is limiting — flux is drained by the TCA cycle and acetate overflow.
2. HMG-CoA reductase (HMGR) is NADPH-dependent and we suspect cofactor imbalance under high glucose.
3. Acetate accumulates to >3 g/L, acidifying the culture and repressing growth.

Prior attempts: expressing the full pathway from a high-copy plasmid raised titer ~20% but tanked growth (metabolic burden) and increased plasmid loss; knocking out pta alone cut acetate but also starved the pathway of acetyl-CoA. 13C-MFA shows ~40% of carbon lost to CO2 and acetate.

Consider acetyl-CoA boosting, NADPH regeneration, dynamic growth/production decoupling, and burden reduction via genome integration or balanced expression.`,
  preferences:
    'Prefer interventions that integrate into the genome (plasmid-free, marker-free final strain), keep the strain on minimal glucose medium, and avoid inducer cost at scale. Favour designs testable with our existing GC-MS mevalonate assay and 13C-MFA.',
  availableTools: [
    'CRISPR-Cas9 / λ-Red recombineering',
    'RBS Calculator',
    'characterised promoter library (pTrc, T7, Anderson)',
    'plasmid + genome integration',
    '13C-MFA',
    'GC-MS mevalonate assay'
  ],
  forbiddenActions: ['antibiotic-resistance markers in the final strain', 'BSL-2 organisms'],
  complianceLevel: 'BSL-1',
  onlyNovel: false
} satisfies DomainPack['example']

const STRAIN_PACK: DomainPack = {
  id: 'strain',
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
      id: 'codexomics',
      label: 'CodeXomics (genomics)',
      description: 'Gene existence/sequence checks, pathway context, and primer/construct design.',
      defaultConfig: { enabled: false, url: 'http://localhost:3002' },
      async gatherEvidence(hyp, conn) {
        const target = hyp.methods.flatMap((m) => m.targets)[0]
        if (!target) return undefined
        const raw = await callBestMatch(
          conn,
          ['search_annotations', 'search_features', 'find_gene', 'get_feature_info'],
          { query: target, name: target }
        )
        if (raw == null) return undefined
        const found = raw.trim().length > 0 && !/no\s+(results|matches|features)/i.test(raw)
        return `Target "${target}" found=${found}. ${raw.slice(0, 2000)}`
      },
      async augment(hyp, conn) {
        const target = hyp.methods.flatMap((m) => m.targets)[0] ?? hyp.title
        const raw = await callBestMatch(conn, ['design_primers', 'primer_design', 'design_primer'], {
          target,
          gene: target,
          region: target
        })
        if (raw == null) return undefined
        try {
          const parsed = JSON.parse(raw)
          const list = Array.isArray(parsed) ? parsed : parsed.primers ?? []
          if (!list.length) return undefined
          return {
            artifacts: list.map((p: any, i: number) => ({
              label: p.name ?? p.label ?? `Primer ${i + 1} for ${target}`,
              detail: p.notes ?? (p.tm ? `Tm ${p.tm}` : 'CodeXomics primer'),
              content: p.sequence ?? p.seq,
              source: 'codexomics'
            }))
          }
        } catch {
          return { artifacts: [{ label: `Primer design for ${target}`, detail: raw.slice(0, 800), source: 'codexomics' }] }
        }
      }
    }
  ],

  systemPreamble: () => SYSTEM_PREAMBLE,

  renderGoalContext(campaign) {
    return `RESEARCH GOAL
Product target: ${campaign.target}
Objective: ${OBJECTIVE_PROMPT_LABELS[campaign.objective] ?? campaign.objective}
${hostBlock(campaign)}

Full goal statement:
${campaign.goal}

Constraints:
- Available genetic tools: ${campaign.constraints.availableTools.join(', ') || 'standard toolkit'}
- Forbidden interventions: ${campaign.constraints.forbiddenActions.join(', ') || 'none specified'}
- Biosafety level: ${campaign.constraints.complianceLevel ?? 'unspecified'}
- ${campaign.constraints.onlyNovel ? 'Only propose demonstrably NOVEL designs (not already published).' : 'Novel and established designs are both acceptable; prefer novel where possible.'}
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
      return `metabolic engineering strategies to ${campaign.objective} ${campaign.target} in ${campaign.context.systemId}`
    }
    if (kind === 'review') {
      return `${hyp?.title ?? ''} ${campaign.target} prior work`
    }
    return `improve ${hyp?.title ?? ''} ${campaign.target}`
  },

  defaultCampaignTitle: ({ target, systemShortName }) => `${target} — ${systemShortName}`
}

export default STRAIN_PACK
