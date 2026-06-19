/**
 * Domain model for Open Co-Scientist.
 *
 * Implements the Co-Scientist architecture (Gottweis et al., Nature 2026) as a
 * domain-pluggable research platform: a "research goal" is a Campaign and a
 * "hypothesis" is a {@link Hypothesis} (a concrete, testable research proposal).
 * The shapes here are deliberately domain-NEUTRAL — every field that carries
 * field-specific vocabulary (objectives, method types, metrics, judging criteria,
 * experimental systems) is an OPEN string id resolved against the active
 * {@link DomainPack}. Strain engineering ships as the flagship pack; other
 * domains plug in by supplying their own pack.
 *
 * These types are shared verbatim between the Electron main process (engine +
 * persistence) and the renderer (UI), so they are intentionally free of any
 * runtime dependency.
 */

// ---------------------------------------------------------------------------
// Campaign context (= the experimental system a campaign targets)
// ---------------------------------------------------------------------------

/**
 * The experimental-system context attached to a campaign. `systemId` resolves
 * against the active pack's {@link DomainPack.systemPresets} (was the strain
 * "host/chassis"). The reserved ids `custom` and `agnostic` are the escape
 * hatches for a user-named system and "let the system recommend one".
 */
export interface CampaignContext {
  /** Open system-preset id from the active pack. */
  systemId: string
  /** Free-text system name when `systemId` is the pack's custom preset. */
  customName?: string
  /** Extra system detail, e.g. a strain background or a cell-format spec. */
  systemDetail?: string
  /** Any additional system context the scientist wants the agents to honour. */
  notes?: string
}

// ---------------------------------------------------------------------------
// Campaign (= research goal + research-plan configuration)
// ---------------------------------------------------------------------------

/**
 * Per-campaign judge weights: an open map of criterion id → weight. Generalizes
 * the former fixed CriteriaWeights interface. Seeded from the active pack's
 * {@link DomainPack.criteria} at campaign creation; 0 means "ignore this axis".
 */
export type CriteriaWeights = Record<string, number>

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'stopped' | 'error'

/** How aggressively to spend test-time compute (number of cycles + breadth). */
export interface ComputeBudget {
  /** Target number of distinct hypotheses to generate before convergence. */
  targetDesigns: number
  /** Maximum supervisor cycles before forced termination. */
  maxCycles: number
  /** Hypotheses to seed in the first generation pass. */
  initialGeneration: number
}

export const DEFAULT_COMPUTE_BUDGET: ComputeBudget = {
  targetDesigns: 24,
  maxCycles: 30,
  initialGeneration: 6
}

/**
 * Per-campaign tournament configuration. The Ranking agent scores BOTH
 * hypotheses in a match across the weighted criteria; the winner is the higher
 * weighted total, so raising a criterion's weight makes the tournament — and
 * therefore the final ranking the scientist sees — prioritise that dimension.
 *
 * Weights are editable mid-campaign: re-weighting replays the Elo ladder from
 * the per-match sub-scores stored on each {@link Match}, with no LLM matches
 * re-run.
 */
export interface TournamentConfig {
  /** Per-criterion judge weights (0 = ignore this dimension entirely). */
  weights: CriteriaWeights
  /** Top-vs-top multi-turn debate matches scheduled per cycle. */
  topDebates: number
  /** Single-turn matches for the newest hypotheses per cycle. */
  singleTurnMatches: number
  /** Hard cap on matches scheduled in a single cycle. */
  maxPairsPerCycle: number
  /** Present hypotheses to the judge in randomised A/B order to cancel position bias. */
  randomizeOrder: boolean
  /** How to resolve an exact weighted-total tie. */
  tieHandling: 'higher-elo' | 'draw'
  /** Elo K-factor (rating volatility per match). */
  kFactor: number
}

/**
 * Neutral default tournament knobs. `weights` is intentionally empty — campaign
 * creation seeds it from the active pack's criteria (see `defaultWeights`). This
 * value is only a structural fallback for the `campaign.tournamentConfig ?? …`
 * guards; a real campaign always carries pack-seeded weights.
 */
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  weights: {},
  topDebates: 2,
  singleTurnMatches: 3,
  maxPairsPerCycle: 6,
  randomizeOrder: true,
  tieHandling: 'higher-elo',
  kFactor: 32
}

export interface Campaign {
  id: string
  createdAt: number
  updatedAt: number
  status: CampaignStatus

  /** Which domain pack this campaign runs under (resolves vocabulary/prompts/UI). */
  packId: string

  /** The product / phenotype / property the scientist wants to engineer toward. */
  target: string
  /** One-line title shown in lists. */
  title: string
  context: CampaignContext
  /** Open objective id resolved against the pack's {@link DomainPack.objectives}. */
  objective: string
  /** Full natural-language goal (may be long; mirrors the paper's free-form goal). */
  goal: string

  /** Constraints the agents must honour. */
  constraints: {
    availableTools: string[] // domain methods/tools available, e.g. ["CRISPR-Cas9"]
    forbiddenActions: string[]
    /** Open compliance-level id from the pack (was biosafety); absent if none. */
    complianceLevel?: string
    regulatoryNotes?: string
    onlyNovel: boolean // mirrors "exclusively propose novel hypotheses"
  }

  preferences: string // free-text desirable attributes
  tournamentConfig: TournamentConfig
  computeBudget: ComputeBudget

  /** Derived by the Supervisor at parse time (research-plan configuration). */
  researchPlan?: ResearchPlanConfig
}

/**
 * The Supervisor parses the goal into this structured plan, mirroring the
 * paper's "research plan configuration".
 */
export interface ResearchPlanConfig {
  restatedGoal: string
  focusAreas: string[]
  derivedConstraints: string[]
  evaluationRubric: string
  recommendedSystem?: string // populated for system-agnostic campaigns
  parsedAt: number
}

// ---------------------------------------------------------------------------
// Hypothesis (= research proposal / strategy)
// ---------------------------------------------------------------------------

/**
 * One proposed action within a hypothesis. `type` is an open id resolved against
 * the pack's {@link DomainPack.methodTypes} (was the strain InterventionType).
 * The shape is general enough for any domain: a typed action on some targets,
 * with a molecular/physical rationale.
 */
export interface Method {
  /** Open method-type id from the active pack. */
  type: string
  /** Targets the action operates on; free-text, e.g. genes, sites, components. */
  targets: string[]
  /** What is done and why, at the mechanistic level. */
  details: string
}

/** A single step of the experimental plan (was the strain DBTL step). */
export interface PlanStep {
  /** Open plan-phase id from the pack (e.g. design/build/test/learn). */
  phase: string
  description: string
}

/**
 * A structured, comparable prediction the hypothesis commits to, so a measured
 * outcome can be scored against it (prediction calibration). The neutral
 * learn-loop reads this directly, so it stays on the core envelope.
 */
export interface QuantPrediction {
  /** Open metric id resolved against the pack's {@link DomainPack.metrics}. */
  metric: string
  /** Direction of the expected change vs the unmodified baseline. */
  direction: 'increase' | 'decrease'
  /** Predicted relative change vs baseline as a fraction, e.g. 0.3 = ±30%. */
  relativeChange?: number
  /** 0-1 self-assessed confidence in the prediction (used for Brier calibration). */
  confidence?: number
  /** What the change is measured against, e.g. "wild-type baseline". */
  baselineNote?: string
}

/** A concrete construct/recipe/protocol artifact attached to a hypothesis. */
export interface Artifact {
  label: string // e.g. "Forward primer for ldhA deletion cassette"
  detail: string
  /** Sequence / recipe / spec content when a tool produced one. */
  content?: string
  /** Provenance: an open tool id (e.g. "codexomics") or "model". */
  source: string
}

export interface Citation {
  title: string
  url?: string
  note?: string
}

export type HypothesisOrigin = 'generated' | 'evolved' | 'expert'

export type HypothesisStatus =
  | 'draft' // freshly generated, not yet reviewed
  | 'reviewing'
  | 'active' // in the tournament
  | 'rejected' // failed initial review
  | 'flagged' // marked by the scientist for experimental testing

/**
 * Outcome of building + testing a hypothesis (the "Test"/"Learn" step). The ids
 * `confirmed`/`partial`/`refuted` are reserved canonical outcomes the engine
 * keys evidence grading on; non-decisive outcomes a pack adds (e.g.
 * `build-failed`, `inconclusive`) never downgrade a hypothesis below
 * `predicted-only`. Open string resolved against the pack's outcomes.
 */
export type ResultOutcome = string

/**
 * The authoritative empirical standing of a hypothesis, derived purely from its
 * {@link ExperimentalResult}s. This is the top-level ordering key — a
 * measured-confirmed hypothesis always sorts above a predicted-only one
 * regardless of Elo, and a refuted one sinks below everything. See
 * {@link compareDesigns}.
 */
export type EvidenceGrade =
  | 'measured-confirmed'
  | 'measured-partial'
  | 'predicted-only' // the default for every hypothesis with no measured data
  | 'measured-refuted'

export const EVIDENCE_GRADE_LABELS: Record<EvidenceGrade, string> = {
  'measured-confirmed': 'Confirmed',
  'measured-partial': 'Partially supported',
  'predicted-only': 'Predicted only',
  'measured-refuted': 'Refuted'
}

/** Sort rank for evidence grades; higher = more authoritative. */
export const EVIDENCE_RANK: Record<EvidenceGrade, number> = {
  'measured-confirmed': 3,
  'measured-partial': 2,
  'predicted-only': 1,
  'measured-refuted': 0
}

export interface EloSnapshot {
  cycle: number
  at: number
  elo: number
}

export interface HypothesisLineage {
  parentIds: string[]
  /** Which Evolution strategy produced this hypothesis, if evolved. */
  strategy?: EvolutionStrategy
}

/**
 * A concrete, testable research proposal (was Hypothesis). Structurally
 * domain-neutral: `system`/`methods`/`plan` carry open vocabulary ids resolved
 * against the active pack, but their shapes are fixed so the engine and UI never
 * need to know the domain.
 */
export interface Hypothesis {
  id: string
  campaignId: string
  createdAt: number
  updatedAt: number

  title: string
  /** One-paragraph summary categorising the core idea. */
  summary: string
  /** The specific experimental system this targets (was chassis). */
  system: string

  /** The proposed actions (was interventions). */
  methods: Method[]
  mechanism: string
  /** Qualitative predicted effect + rationale. */
  predictedEffect: string
  /** Structured, calibratable prediction (optional; complements predictedEffect). */
  quantPrediction?: QuantPrediction
  plan: PlanStep[]
  /** Construct/recipe/protocol artifacts (was constructSuggestions). */
  artifacts: Artifact[]
  risks: string[]
  citations: Citation[]

  /** 0-10 self/assessed novelty, refined by Reflection with literature search. */
  novelty: number

  origin: HypothesisOrigin
  status: HypothesisStatus
  /**
   * Cached evidence grade derived from this hypothesis's {@link ExperimentalResult}s.
   * Kept in sync by the engine whenever a result is recorded/disputed and
   * recomputed on store load, so comparators can read it without re-aggregating.
   * Absent (treated as `predicted-only`) on hypotheses with no measured data.
   */
  evidence?: EvidenceGrade
  lineage: HypothesisLineage

  // Tournament state
  elo: number
  eloHistory: EloSnapshot[]
  wins: number
  losses: number
  reviewCount: number

  /** Proximity clustering assignment (set by Proximity agent). */
  clusterId?: number
}

// ---------------------------------------------------------------------------
// Experimental results ("Test"/"Learn" — closes the feedback loop)
// ---------------------------------------------------------------------------

/**
 * A measured result returned for a hypothesis. This is the ground-truth signal
 * that closes the predict→measure→learn loop: results are authoritative over the
 * model's predicted merit. A hypothesis may accrue several results (replicate
 * batches, re-tests); the evidence grade is derived from the aggregate of its
 * `recorded` results.
 *
 * NOTE: the `designId` field name is retained as the internal foreign key to a
 * {@link Hypothesis.id} (historical; avoids a churny rename across persistence).
 */
export interface ExperimentalResult {
  id: string
  campaignId: string
  designId: string
  createdAt: number
  outcome: ResultOutcome
  /** Which metric was measured (open id, for calibration against the prediction). */
  metric?: string
  /** Measured value and its baseline (same unit) — enables a calibration delta. */
  measuredValue?: number
  baselineValue?: number
  unit?: string
  /** Replicate count, so a single noisy point isn't over-trusted. */
  replicates?: number
  /** Observations — especially failure modes, the high-value negative signal. */
  observations: string
  /** Who reported it + provenance (lab, dataset, paper). */
  author: string
  /**
   * An expert can dispute a result; `disputed`/`superseded` results drop out of
   * the authoritative evidence grade and calibration until resolved.
   */
  status: 'recorded' | 'disputed' | 'superseded'
}

/**
 * Per-cycle prediction-calibration snapshot: how well the campaign's structured
 * predictions matched what was measured. The whole point of the feedback loop is
 * that these numbers improve over time — the system learns to predict better.
 * Computed purely from hypotheses + their results.
 */
export interface CalibrationProfile {
  campaignId: string
  cycle: number
  at: number
  /** Number of (prediction, measurement) pairs the profile is computed from. */
  nPairs: number
  /** Mean signed error (predicted − measured relative change). >0 = over-optimism. */
  signedBias: number
  /** Mean absolute error of the predicted relative change. */
  meanAbsError: number
  /** Spearman rank correlation between predicted and measured effect (−1..1). */
  spearman: number
  /** Brier score on the predicted-direction hit, when confidences are present (0..1, lower better). */
  brier?: number
  /** Mean signed error broken down by method type, to expose class-specific bias. */
  biasByMethodType: Record<string, number>
}

// ---------------------------------------------------------------------------
// Reviews (Reflection agent) — the review modes from the paper
// ---------------------------------------------------------------------------

export type ReviewType =
  | 'initial'
  | 'full'
  | 'deep-verification'
  | 'observation'
  | 'simulation'
  | 'tournament'
  | 'expert'
  | 'calibration'

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  initial: 'Initial review',
  full: 'Full review',
  'deep-verification': 'Deep verification',
  observation: 'Observation review',
  simulation: 'Simulation review',
  tournament: 'Tournament review',
  expert: 'Expert review',
  calibration: 'Calibration review'
}

export interface Review {
  id: string
  designId: string
  campaignId: string
  type: ReviewType
  createdAt: number
  /** Per-criterion 0-10 scores (open criterion ids; subset present per review type). */
  scores: Partial<Record<string, number>>
  /** Overall recommendation. */
  verdict: 'pass' | 'revise' | 'reject'
  narrative: string
  /** Evidence gathered from tools (literature / domain), for grounding. */
  evidence: string[]
  /** Who produced it: an agent or a named expert. */
  author: string
}

// ---------------------------------------------------------------------------
// Tournament (Ranking agent)
// ---------------------------------------------------------------------------

export interface Match {
  id: string
  campaignId: string
  cycle: number
  createdAt: number
  designAId: string
  designBId: string
  winnerId: string
  /** Multi-turn debate for top hypotheses, single-turn for lower-ranked. */
  mode: 'debate' | 'single-turn'
  transcript: string
  rationale: string
  eloDelta: number
  /**
   * Per-criterion 0-10 judge scores for each hypothesis. Persisted so the Elo
   * ladder can be deterministically replayed under new weights without
   * re-running the match. Absent on legacy matches — replay falls back to the
   * stored winnerId for those.
   */
  scoresA?: Partial<Record<string, number>>
  scoresB?: Partial<Record<string, number>>
  /** Weighted totals that decided the winner, for audit in the UI. */
  weightedTotalA?: number
  weightedTotalB?: number
}

// ---------------------------------------------------------------------------
// Evolution agent
// ---------------------------------------------------------------------------

export type EvolutionStrategy =
  | 'grounding-enhancement'
  | 'feasibility'
  | 'inspiration'
  | 'combination'
  | 'simplification'
  | 'out-of-box'
  | 'empirical-refinement'

export const EVOLUTION_STRATEGY_LABELS: Record<EvolutionStrategy, string> = {
  'grounding-enhancement': 'Enhancement through grounding',
  feasibility: 'Coherence & feasibility',
  inspiration: 'Inspiration from top hypotheses',
  combination: 'Combination',
  simplification: 'Simplification',
  'out-of-box': 'Out-of-box thinking',
  'empirical-refinement': 'Empirical refinement (from results)'
}

// ---------------------------------------------------------------------------
// Meta-review agent
// ---------------------------------------------------------------------------

export interface ResearchOverviewArea {
  title: string
  justification: string
  exampleExperiments: string[]
  relatedDesignIds: string[]
}

export interface SuggestedExpert {
  name: string
  expertise: string
  rationale: string
}

export interface MetaReview {
  id: string
  campaignId: string
  cycle: number
  createdAt: number
  /** Recurring critique patterns synthesised from all reviews + debates. */
  critiquePatterns: string[]
  /** Feedback strings appended to each agent's prompt next cycle (no backprop). */
  agentFeedback: Partial<Record<AgentRole, string>>
  /** The synthesised research roadmap. */
  overview: {
    summary: string
    areas: ResearchOverviewArea[]
  }
  suggestedExperts: SuggestedExpert[]
}

// ---------------------------------------------------------------------------
// Agents / tasks / statistics (asynchronous task framework)
// ---------------------------------------------------------------------------

export type AgentRole =
  | 'supervisor'
  | 'generation'
  | 'reflection'
  | 'ranking'
  | 'proximity'
  | 'evolution'
  | 'meta-review'

export const AGENT_LABELS: Record<AgentRole, string> = {
  supervisor: 'Supervisor',
  generation: 'Generation',
  reflection: 'Reflection',
  ranking: 'Ranking',
  proximity: 'Proximity',
  evolution: 'Evolution',
  'meta-review': 'Meta-review'
}

export type TaskState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export interface TaskRecord {
  id: string
  campaignId: string
  agent: AgentRole
  /** Human-readable description of the unit of work. */
  label: string
  state: TaskState
  cycle: number
  createdAt: number
  startedAt?: number
  finishedAt?: number
  error?: string
  /** IDs of hypotheses this task produced or acted on. */
  resultDesignIds?: string[]
}

/** Periodic snapshot computed by the Supervisor and written to context memory. */
export interface SystemStatistics {
  campaignId: string
  cycle: number
  at: number
  designsTotal: number
  designsByStatus: Record<HypothesisStatus, number>
  reviewsTotal: number
  matchesTotal: number
  topEloAvg10: number // average Elo of top-10 hypotheses (paper's key metric)
  bestElo: number
  queueDepth: number
  /** Adaptive sampling weights the Supervisor assigns to each worker agent. */
  agentWeights: Partial<Record<AgentRole, number>>
  /** Effectiveness signal: generation vs evolution win contribution. */
  generationWinRate: number
  evolutionWinRate: number
  terminalProgress: number // 0..1 toward terminal state
}

// ---------------------------------------------------------------------------
// Activity events (live monitoring feed)
// ---------------------------------------------------------------------------

export type ActivitySeverity = 'info' | 'success' | 'warning' | 'error'

export interface ActivityEvent {
  id: string
  campaignId: string
  at: number
  agent: AgentRole | 'system' | 'expert'
  severity: ActivitySeverity
  message: string
  /** Optional structured payload (hypothesis id, match id, etc.). */
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * LLM provider identifier. Must stay in sync with the catalogue in
 * `shared/providers.ts` (PROVIDER_IDS) and the runtime `createLLMClient`
 * selector.
 */
export type LLMProvider =
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'openrouter'
  | 'siliconflow'
  | 'minimax-cn'
  | 'minimax-global'
  | 'google'
  | 'glm'
  | 'kimi'
  | 'local'
  | 'openai-compatible'

/**
 * A model selection that names both the provider that serves it and the model
 * id. Tier defaults and per-agent overrides are ModelRefs, so different agents
 * can be routed to models hosted by different providers.
 */
export interface ModelRef {
  /** Which configured provider serves this model. */
  provider: LLMProvider
  /** Model id, e.g. "claude-opus-4-8" or "deepseek-chat". */
  model: string
}

export interface ModelTierConfig {
  /** Model used for quality-critical agents (generation/reflection/meta-review). */
  highTier: ModelRef
  /** Model used for high-volume agents (ranking/proximity/evolution). */
  fastTier: ModelRef
}

/** Optional per-agent model override; absent agents fall back to tier defaults. */
export type AgentModelOverrides = Partial<Record<AgentRole, ModelRef>>

/**
 * Per-provider credentials and discovered models, configured on the Providers
 * tab. The Model Selection tab assigns {@link ModelRef}s that point at these
 * accounts.
 */
export interface ProviderAccountConfig {
  /** Whether this provider is available for model selection. */
  enabled: boolean
  /** API key / token. May be empty for keyless local servers. */
  apiKey: string
  /** Base URL override; falls back to the catalogue default when empty. */
  baseUrl?: string
  /** Full model-id list discovered via the Providers-tab "Refresh models" button. */
  fetchedModels?: string[]
  /**
   * Curated subset of {@link fetchedModels} the user enabled for selection on
   * the Providers tab. Only these models are offered on the Model Selection
   * tab. Empty/undefined falls back to the discovered list, then the catalogue
   * presets.
   */
  selectedModels?: string[]
}

export interface McpServerConfig {
  enabled: boolean
  url: string
  /** Optional bearer token (deep-research ACCESS_PASSWORD). */
  accessToken?: string
}

export interface AppSettings {
  llm: {
    /** Default/active provider — seeds new model selections in the UI. */
    provider: LLMProvider
    /** Per-provider credentials & discovered models (the Providers tab). */
    providers: Partial<Record<LLMProvider, ProviderAccountConfig>>
    tiers: ModelTierConfig
    overrides: AgentModelOverrides
    /** Temperature for generation/evolution (exploration). */
    temperature: number
    maxTokens: number
  }
  /**
   * MCP server configs keyed by server id. `deepResearch` is the shared core
   * literature tool; additional keys are pack-declared tool bindings (e.g.
   * `codexomics`). Seeded from the active pack's tools at boot.
   */
  mcp: Record<string, McpServerConfig>
  run: {
    /** Max concurrent worker tasks. */
    concurrency: number
  }
  /**
   * Hard-veto gate toggles keyed by {@link SafetyGate.settingKey}. Absent keys
   * fall back to the gate's `defaultEnabled`.
   */
  safety: Record<string, boolean>
  ui: {
    /** Colour theme for the interface. */
    theme: UiTheme
  }
  /** The active domain pack id new campaigns default to. */
  activePackId?: string
}

export type UiTheme = 'dark' | 'light'

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    provider: 'anthropic',
    providers: {
      anthropic: { enabled: true, apiKey: '' }
    },
    tiers: {
      highTier: { provider: 'anthropic', model: 'claude-opus-4-8' },
      fastTier: { provider: 'anthropic', model: 'claude-sonnet-4-6' }
    },
    overrides: {},
    temperature: 0.9,
    maxTokens: 0
  },
  mcp: {
    deepResearch: { enabled: false, url: 'http://127.0.0.1:3000/api/mcp' }
  },
  run: {
    concurrency: 3
  },
  safety: {},
  ui: {
    theme: 'dark'
  }
}

// ---------------------------------------------------------------------------
// Aggregate snapshot delivered to the renderer
// ---------------------------------------------------------------------------

/** Everything the UI needs to render a campaign in detail. */
export interface CampaignSnapshot {
  campaign: Campaign
  designs: Hypothesis[]
  reviews: Review[]
  matches: Match[]
  metaReviews: MetaReview[]
  statistics: SystemStatistics[]
  tasks: TaskRecord[]
  events: ActivityEvent[]
  /** Measured results recorded against hypotheses (DBTL "Learn"). */
  results: ExperimentalResult[]
  /** Per-cycle prediction-calibration snapshots. */
  calibration: CalibrationProfile[]
}

// ---------------------------------------------------------------------------
// Evidence & ranking helpers (pure — shared by the engine and the renderer)
// ---------------------------------------------------------------------------

/**
 * Derive a hypothesis's authoritative evidence grade from its results. Only
 * `recorded` results count (disputed/superseded are ignored). The most decisive
 * recorded outcome wins, in priority order confirmed > partial > refuted;
 * non-decisive outcomes (e.g. `build-failed`/`inconclusive`) carry no decisive
 * signal and leave the hypothesis at `predicted-only`. Pure: same inputs always
 * yield the same grade.
 */
export function evidenceGradeFor(results: ExperimentalResult[]): EvidenceGrade {
  const decisive = results.filter((r) => r.status === 'recorded')
  if (decisive.some((r) => r.outcome === 'confirmed')) return 'measured-confirmed'
  if (decisive.some((r) => r.outcome === 'partial')) return 'measured-partial'
  if (decisive.some((r) => r.outcome === 'refuted')) return 'measured-refuted'
  return 'predicted-only'
}

/** The numeric evidence rank for a hypothesis (defaulting absent → predicted-only). */
export function evidenceRankOf(design: Pick<Hypothesis, 'evidence'>): number {
  return EVIDENCE_RANK[design.evidence ?? 'predicted-only']
}

/**
 * Authoritative "best first" comparator: evidence grade dominates, Elo breaks
 * ties within a grade. Measured ground truth therefore always outranks a purely
 * predicted hypothesis, while the speculative Elo ladder still orders the
 * frontier. Use everywhere hypotheses are sorted for selection or display.
 */
export function compareDesigns(a: Hypothesis, b: Hypothesis): number {
  const byEvidence = evidenceRankOf(b) - evidenceRankOf(a)
  return byEvidence !== 0 ? byEvidence : b.elo - a.elo
}
