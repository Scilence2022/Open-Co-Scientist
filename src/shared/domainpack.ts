/**
 * DomainPack — the contract a research domain supplies to Open Co-Scientist.
 *
 * The Co-Scientist engine (Supervisor, task queue, the seven agents, the Elo
 * tournament, the six review modes, the evolution strategies, the
 * predict→measure→recalibrate "learn" loop, persistent memory, and the whole UI
 * shell) is domain-neutral. Everything that makes the system reason about a
 * *specific* field — its vocabulary, its agent persona, its prompt phrasing, its
 * judging criteria, its catalogue of experimental systems, its optional tool
 * integrations, and the nouns the UI shows — lives behind this one interface.
 *
 * A pack is pure data + pure prompt-building functions. It carries NO runtime
 * dependency on Electron, the engine, or the renderer, so the same pack module
 * is importable from both the main process (prompts) and the renderer (labels,
 * forms). Concrete packs live under `src/domains/<id>/`.
 *
 * Design choice: the core {@link Hypothesis} stays *structurally* generic and
 * strongly typed (a proposal with typed `methods`, a `mechanism`, a
 * `quantPrediction`, a `plan`, `artifacts`) rather than collapsing domain content
 * into an opaque blob. A pack therefore only opens the *vocabulary* of those
 * fields (e.g. which method `type` ids are valid and what they're called), never
 * their shape — which keeps the engine and UI pack-agnostic without casts.
 */
import type {
  Campaign,
  CampaignContext,
  EvolutionStrategy,
  ExperimentalResult,
  Hypothesis,
  McpServerConfig,
  ReviewType
} from './domain'

/** An open-id option with a human label and an optional prompt-steering gloss. */
export interface VocabOption {
  /** Stable id persisted on records and emitted by the model. */
  id: string
  /** Human-readable label shown in the UI. */
  label: string
  /** One-line gloss injected into prompts / JSON schema to steer the model. */
  gloss?: string
}

/** A measurable quantity the domain optimises (generalizes titer/rate/yield). */
export interface MetricOption extends VocabOption {
  /** Default unit hint shown in result-entry forms, e.g. "g/L", "Wh/kg". */
  defaultUnit?: string
}

/**
 * A judging axis. Generalizes the fixed CriteriaWeights/CriterionKey set: the
 * weighted-tournament mechanism is unchanged, but the *axes* are pack-defined.
 */
export interface CriterionDescriptor {
  /** Open id, e.g. "effectiveness" | "manufacturability". */
  id: string
  label: string
  /** Judge-steering text (was CRITERION_GUIDANCE). */
  gloss: string
  /** Seeds this pack's default tournament weight for the axis. */
  defaultWeight: number
}

/**
 * The generalization of HOST_PRESETS: a catalogue of "experimental systems"
 * (chassis / cell format / model architecture …). Fields are deliberately
 * free-form so non-biological packs aren't forced into lineage/strengths
 * semantics — `promptHints` is rendered verbatim into the goal context.
 */
export interface SystemPreset {
  id: string
  /** Full display name, e.g. "Escherichia coli". */
  name: string
  /** Short name shown in lists, e.g. "E. coli". */
  shortName: string
  /** Descriptor lines rendered verbatim into the goal context for the model. */
  promptHints: string[]
  /** The "custom" escape hatch — the scientist names their own system. */
  isCustom?: boolean
  /** The "let the system recommend one" escape hatch (was 'agnostic'). */
  isUnspecified?: boolean
}

/** Minimal generic MCP surface the engine exposes to a pack's tool binding. */
export interface McpConnectionLike {
  readonly enabled: boolean
  callText(tool: string, args: Record<string, unknown>): Promise<string>
  hasTool(name: string): boolean
}

/**
 * An optional MCP/tool binding a pack registers (generalizes CodexomicsClient).
 * The engine resolves a {@link McpConnectionLike} for `id` from settings and
 * hands it to these hooks; both are optional so a pack can declare a tool it
 * only uses for one stage. Every hook degrades gracefully (returns undefined).
 */
export interface PackToolBinding {
  /** Open tool id; also the settings key for its MCP server config. */
  id: string
  label: string
  description?: string
  /** Default MCP server config seeded into settings for this tool. */
  defaultConfig: McpServerConfig
  /**
   * Grounding hook called by the Reflection agent: returns a neutral evidence
   * string injected into the review prompt (replaces codexomics.checkGene).
   */
  gatherEvidence?(hyp: Hypothesis, conn: McpConnectionLike): Promise<string | undefined>
  /**
   * Augmentation hook called by the Supervisor: returns a partial Hypothesis to
   * merge (e.g. artifacts/constructs). Omit if the pack has nothing to augment.
   */
  augment?(hyp: Hypothesis, conn: McpConnectionLike): Promise<Partial<Hypothesis> | undefined>
}

/**
 * A pack-defined hard-veto gate (generalizes the biosafety enforce-reject). When
 * enabled in settings, a review scoring at/below `threshold` on `criterionId` is
 * forced to a reject verdict.
 */
export interface SafetyGate {
  /** Settings flag key, e.g. "enforceBiosafety". */
  settingKey: string
  /** Settings UI checkbox label. */
  toggleLabel: string
  defaultEnabled: boolean
  /** Which criterion id the veto reads. */
  criterionId: string
  /** Reject when the score is <= this. */
  threshold: number
  /** Narrative prefix on the forced rejection. */
  rejectNarrative: string
}

/**
 * The platform's product name, shown in the app's main brand/chrome regardless of
 * which DomainPack is active. Individual packs still carry their own
 * {@link PackLabels.appName} for pack-specific contexts (e.g. the pack picker).
 */
export const PLATFORM_NAME = 'Open Co-Scientist'

/**
 * UI noun overrides so views never hardcode "Design"/"Host"/"wet-lab". Each is a
 * short label the renderer substitutes into chrome, headers, and form fields.
 */
export interface PackLabels {
  /** Product name, e.g. "Strain Co-Scientist". */
  appName: string
  /** One-line subtitle under the app name. */
  tagline: string
  /** The proposal unit, singular — e.g. "Design", "Formulation". */
  hypothesis: string
  hypothesisPlural: string
  /** The experimental system noun — e.g. "Host", "Cell format". */
  system: string
  systemPlural: string
  /** The proposed-action noun — e.g. "Intervention", "Modification". */
  method: string
  methodPlural: string
  /** The optimisation target noun — e.g. "Product target". */
  target: string
  /** Placeholder for the target field. */
  targetPlaceholder: string
  /** Where measured validation happens — e.g. "wet-lab", "coin-cell test". */
  validationVenue: string
  /** Heading for recorded measurements — e.g. "Wet-lab results". */
  measuredResults: string
  /** Heading for the experimental plan — e.g. "DBTL experimental plan". */
  planSectionTitle: string
  /** The mechanism/rationale field heading — e.g. "Mechanism". */
  mechanism: string
  /** The predicted-effect field heading — e.g. "Predicted effect". */
  predictedEffect: string
}

/**
 * A fully-specified, ready-to-run example campaign a pack ships to demonstrate
 * the domain. The New-campaign form's "Load example" action fills its inputs
 * from this, so every field mirrors a form input and references this pack's own
 * ids. Optional — a pack without one simply hides the button.
 */
export interface CampaignExample {
  /** The optimisation target (fills the {@link PackLabels.target} field). */
  target: string
  /** A {@link SystemPreset} id from this pack. */
  systemId: string
  /** Name shown when `systemId` is the pack's custom preset. */
  customName?: string
  /** Extra system-detail line (e.g. a strain background or cell spec). */
  systemDetail?: string
  /** Additional system notes for the agents. */
  notes?: string
  /** An objective id from this pack's {@link DomainPack.objectives}. */
  objective: string
  /** The full natural-language research goal (the heart of the example). */
  goal: string
  /** Desirable attributes / preferences free-text. */
  preferences?: string
  /** Available tools/methods (comma-joined into the form). */
  availableTools?: string[]
  /** Forbidden actions (comma-joined into the form). */
  forbiddenActions?: string[]
  /** A complianceLevel id from this pack, if it declares any. */
  complianceLevel?: string
  /** Seeds the "only propose novel" checkbox. */
  onlyNovel?: boolean
  /** Optional campaign title (auto-generated from target/system if omitted). */
  title?: string
}

/**
 * The complete domain contract. Everything domain-specific lives here; the
 * engine, tournament, learn-loop, and UI shell consume it through this one
 * object resolved from the {@link DomainPackRegistry}.
 */
export interface DomainPack {
  // --- identity / vocabulary ------------------------------------------------
  /** Stable pack id persisted on every campaign (Campaign.packId). */
  id: string
  labels: PackLabels
  /** An optional ready-to-run example campaign demonstrating the domain. */
  example?: CampaignExample
  /** Generalizes EngineeringObjective + OBJECTIVE_LABELS. */
  objectives: VocabOption[]
  /** Generalizes InterventionType + INTERVENTION_LABELS. */
  methodTypes: VocabOption[]
  /** Generalizes QuantPrediction.metric options. */
  metrics: MetricOption[]
  /** Generalizes the plan-phase set (was DBTL design/build/test/learn). */
  planPhases: VocabOption[]
  /**
   * Generalizes ResultOutcome + RESULT_OUTCOME_LABELS. The ids 'confirmed',
   * 'partial', and 'refuted' are RESERVED canonical outcomes the engine keys
   * evidence grading on — every pack must include them; any others (e.g.
   * 'build-failed') are treated as non-decisive.
   */
  outcomes: VocabOption[]
  /** Generalizes BiosafetyLevel. Empty hides the compliance field entirely. */
  complianceLevels: VocabOption[]
  /** Generalizes CriteriaWeights/CriterionKey/CRITERION_LABELS/GUIDANCE. */
  criteria: CriterionDescriptor[]
  /** Generalizes HOST_PRESETS / HOST_PRESET_LIST. */
  systemPresets: SystemPreset[]
  /** Pack-declared hard-veto gates (may be empty). */
  safetyGates: SafetyGate[]
  /** Optional MCP tool bindings (deep-research stays a shared core tool). */
  tools: PackToolBinding[]

  // --- prompt / schema generation -------------------------------------------
  /** Agent persona (was SYSTEM_PREAMBLE). */
  systemPreamble(): string
  /**
   * Render the domain portion of the goal context (was hostBlock + the
   * objective/constraint lines). The engine wraps this with the neutral
   * "RESEARCH GOAL" frame, so return only the domain-specific body.
   */
  renderGoalContext(campaign: Campaign): string
  /** The JSON output contract for a hypothesis (was DESIGN_JSON_SCHEMA). */
  hypothesisJsonSchema(): string
  /** Per-strategy generation instruction strings (debate personas, etc.). */
  generationStrategyInstructions(): Record<string, string>
  /** Per-strategy evolution instruction strings. */
  evolutionStrategyInstructions(): Record<EvolutionStrategy, string>
  /** Per-mode review instruction strings (observation/simulation/calibration). */
  reviewModeInstructions(): Record<ReviewType, string>
  /** Literature query builder for Generation/Reflection/Evolution grounding. */
  literatureQuery(
    campaign: Campaign,
    kind: 'generation' | 'review' | 'evolution',
    hyp?: Hypothesis
  ): string
  /** Default campaign title when the scientist leaves it blank. */
  defaultCampaignTitle(input: { target: string; systemShortName: string }): string
}

/** A registry so the active pack is resolvable in both processes. */
export interface DomainPackRegistry {
  register(pack: DomainPack): void
  get(id: string): DomainPack
  has(id: string): boolean
  list(): DomainPack[]
  /** The default pack id used when a campaign predates per-campaign packs. */
  defaultId(): string
}

/** Outcome ids the engine reserves for evidence grading; every pack ships these. */
export const RESERVED_OUTCOME_IDS = ['confirmed', 'partial', 'refuted'] as const

/**
 * Resolve a label for an open vocabulary id, falling back to the id itself so a
 * value persisted under an older pack version still renders readably.
 */
export function labelFor(options: VocabOption[], id: string | undefined): string {
  if (!id) return ''
  return options.find((o) => o.id === id)?.label ?? id
}

/** Seed a campaign's tournament weights from a pack's criteria defaults. */
export function defaultWeights(pack: DomainPack): Record<string, number> {
  const w: Record<string, number> = {}
  for (const c of pack.criteria) w[c.id] = c.defaultWeight
  return w
}

/** Look up a system preset by id within a pack (undefined if unknown). */
export function systemPreset(pack: DomainPack, id: string): SystemPreset | undefined {
  return pack.systemPresets.find((s) => s.id === id)
}

/** Human-readable name for a campaign's experimental system (was hostDisplayName). */
export function systemDisplayName(pack: DomainPack, context: CampaignContext): string {
  const preset = systemPreset(pack, context.systemId)
  if (preset?.isCustom) return context.customName?.trim() || preset.shortName
  return preset?.shortName ?? (context.customName?.trim() || 'Unspecified')
}
