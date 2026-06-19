import type { Artifact, Campaign, Hypothesis, HypothesisOrigin, Method, PlanStep, QuantPrediction } from '@shared/domain'
import type { DomainPack } from '@shared/domainpack'
import { systemDisplayName } from '@shared/domainpack'
import { resolvePack } from '@shared/packRegistry'
import { INITIAL_ELO } from '../tournament/Elo'

/** Coerce loosely-parsed actions into typed methods, validating type ids against the pack. */
function coerceMethods(raw: any, pack: DomainPack): Method[] {
  if (!Array.isArray(raw)) return []
  const valid = new Set(pack.methodTypes.map((m) => m.id))
  return raw.map((r) => ({
    type: valid.has(r?.type) ? r.type : 'other',
    targets: Array.isArray(r?.targets) ? r.targets.map(String) : r?.targets ? [String(r.targets)] : [],
    details: String(r?.details ?? '')
  }))
}

/** Coerce a loosely-parsed plan, validating phase ids against the pack. */
function coercePlan(raw: any, pack: DomainPack): PlanStep[] {
  if (!Array.isArray(raw)) return []
  const phases = pack.planPhases.map((p) => p.id)
  const fallback = phases[0] ?? 'design'
  return raw.map((r) => ({
    phase: phases.includes(r?.phase) ? r.phase : fallback,
    description: String(r?.description ?? '')
  }))
}

/** Coerce a loosely-parsed structured prediction; returns undefined if unusable. */
function coerceQuantPrediction(raw: any, pack: DomainPack): QuantPrediction | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const metrics = new Set(pack.metrics.map((m) => m.id))
  const metric = metrics.has(raw.metric) ? raw.metric : 'other'
  const direction = raw.direction === 'decrease' ? 'decrease' : 'increase'
  const rc = Number(raw.relativeChange)
  const conf = Number(raw.confidence)
  const pred: QuantPrediction = { metric, direction }
  if (Number.isFinite(rc)) pred.relativeChange = Math.abs(rc)
  if (Number.isFinite(conf)) pred.confidence = Math.max(0, Math.min(1, conf))
  if (raw.baselineNote) pred.baselineNote = String(raw.baselineNote)
  // Only keep a prediction that carries at least a magnitude — a bare
  // metric/direction adds nothing the free-text predictedEffect doesn't.
  return typeof pred.relativeChange === 'number' ? pred : undefined
}

/** Coerce loosely-parsed artifacts (construct/recipe suggestions). */
function coerceArtifacts(raw: any): Artifact[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a: any) => a && (a.label || a.detail))
    .map((a: any) => ({
      label: String(a.label ?? ''),
      detail: String(a.detail ?? ''),
      content: a.content ?? a.sequence ? String(a.content ?? a.sequence) : undefined,
      source: String(a.source ?? 'model')
    }))
}

/**
 * Normalise a loosely-parsed generation payload into an array of hypothesis
 * objects. Accepts a bare array, a single object, or a common wrapper the model
 * sometimes emits despite being asked for a bare array
 * (`{ hypotheses|designs|strategies|results|items|data: [...] }`). Without this,
 * a wrapped array parsed to a single object with no `title` and silently yielded
 * zero hypotheses.
 */
export function toDesignObjects(parsed: any): any[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    for (const key of ['hypotheses', 'designs', 'strategies', 'results', 'items', 'data']) {
      if (Array.isArray(parsed[key])) return parsed[key]
    }
    return [parsed] // treat as a single hypothesis (coerceDesign rejects it if untitled)
  }
  return []
}

/** Build a {@link Hypothesis} from a loosely-parsed LLM object. */
export function coerceDesign(
  obj: any,
  campaign: Campaign,
  origin: HypothesisOrigin,
  newId: () => string
): Hypothesis | null {
  if (!obj || typeof obj !== 'object') return null
  const title = String(obj.title ?? '').trim()
  if (!title) return null
  const pack = resolvePack(campaign.packId)
  const now = Date.now()
  const system = systemDisplayName(pack, campaign.context)
  return {
    id: newId(),
    campaignId: campaign.id,
    createdAt: now,
    updatedAt: now,
    title,
    summary: String(obj.summary ?? ''),
    system: String(obj.system ?? obj.chassis ?? system),
    methods: coerceMethods(obj.methods ?? obj.interventions, pack),
    mechanism: String(obj.mechanism ?? ''),
    predictedEffect: String(obj.predictedEffect ?? ''),
    quantPrediction: coerceQuantPrediction(obj.quantPrediction, pack),
    plan: coercePlan(obj.plan ?? obj.experimentalPlan, pack),
    artifacts: coerceArtifacts(obj.artifacts),
    risks: Array.isArray(obj.risks) ? obj.risks.map(String) : [],
    citations: Array.isArray(obj.citations)
      ? obj.citations
          .filter((c: any) => c && (c.title || c.url))
          .map((c: any) => ({ title: String(c.title ?? c.url), url: c.url, note: c.note }))
      : [],
    novelty: clampScore(obj.novelty, 5),
    origin,
    status: 'draft',
    lineage: { parentIds: [] },
    elo: INITIAL_ELO,
    eloHistory: [],
    wins: 0,
    losses: 0,
    reviewCount: 0
  }
}

export function clampScore(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(10, Math.round(n)))
}
