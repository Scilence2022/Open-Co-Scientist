import { useState } from 'react'
import { useStore, activePack } from '../store/useStore'
import { CampaignStatusPill, Empty, timeAgo } from '../components/ui'
import { IconPlus, IconClose, IconTrash, IconCampaigns, IconPlay } from '../components/Icons'
import {
  DEFAULT_COMPUTE_BUDGET,
  DEFAULT_TOURNAMENT_CONFIG,
  type TournamentConfig
} from '@shared/domain'
import { defaultWeights, labelFor, systemDisplayName } from '@shared/domainpack'
import { packRegistry, resolvePack } from '@shared/packRegistry'
import type { CreateCampaignInput } from '@shared/ipc'
import { TournamentConfigEditor } from '../components/TournamentConfigEditor'

export function Campaigns(): JSX.Element {
  const { campaigns, refreshCampaigns, selectCampaign, setView } = useStore()
  const [creating, setCreating] = useState(false)

  const onDelete = async (id: string, title: string) => {
    if (!confirm(`Delete campaign "${title}"? This removes all its hypotheses and history.`)) return
    await window.api.deleteCampaign(id)
    await refreshCampaigns()
    await selectCampaign(useStore.getState().campaigns[0]?.id ?? null)
  }

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 'var(--fs-xl)' }}>Campaigns</h2>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <IconPlus size={15} /> New campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <Empty
          icon={<IconCampaigns size={36} />}
          title="No campaigns yet"
          hint="A campaign is a research goal: a target, an experimental system, and constraints. The multi-agent engine then generates, reviews, and ranks hypotheses toward it."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>System</th>
                <th>Objective</th>
                <th className="num">Hypotheses</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const pack = resolvePack(c.packId)
                return (
                  <tr
                    key={c.id}
                    className="clickable"
                    onClick={async () => {
                      await selectCampaign(c.id)
                      setView('dashboard')
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{c.target}</div>
                    </td>
                    <td className="muted">{systemDisplayName(pack, c.context)}</td>
                    <td className="muted">{labelFor(pack.objectives, c.objective)}</td>
                    <td className="num">—</td>
                    <td>
                      <CampaignStatusPill status={c.status} />
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{timeAgo(c.updatedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row gap-sm">
                        {c.status !== 'running' && (
                          <button
                            className="btn btn-icon btn-ghost"
                            title="Run"
                            onClick={() => window.api.startCampaign(c.id)}
                          >
                            <IconPlay size={14} />
                          </button>
                        )}
                        <button
                          className="btn btn-icon btn-ghost"
                          title="Delete"
                          onClick={() => onDelete(c.id, c.title)}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CampaignForm onClose={() => setCreating(false)} />}
    </div>
  )
}

function CampaignForm({ onClose }: { onClose: () => void }): JSX.Element {
  const { refreshCampaigns, selectCampaign, setView } = useStore()
  const packs = packRegistry.list()
  const [packId, setPackId] = useState(activePack().id)
  const pack = resolvePack(packId)

  const [systemId, setSystemId] = useState(pack.systemPresets[0]?.id ?? 'custom')
  const [customName, setCustomName] = useState('')
  const [systemDetail, setSystemDetail] = useState('')
  const [systemNotes, setSystemNotes] = useState('')
  const [target, setTarget] = useState('')
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState(pack.objectives[0]?.id ?? 'other')
  const [goal, setGoal] = useState('')
  const [tools, setTools] = useState('')
  const [forbidden, setForbidden] = useState('')
  const [complianceLevel, setComplianceLevel] = useState(
    pack.complianceLevels[pack.complianceLevels.length - 1]?.id ?? ''
  )
  const [onlyNovel, setOnlyNovel] = useState(false)
  const [preferences, setPreferences] = useState('')
  const [initialGeneration, setInitialGeneration] = useState(DEFAULT_COMPUTE_BUDGET.initialGeneration)
  const [targetDesigns, setTargetDesigns] = useState(DEFAULT_COMPUTE_BUDGET.targetDesigns)
  const [maxCycles, setMaxCycles] = useState(DEFAULT_COMPUTE_BUDGET.maxCycles)
  const [tournamentConfig, setTournamentConfig] = useState<TournamentConfig>({
    ...DEFAULT_TOURNAMENT_CONFIG,
    weights: defaultWeights(pack)
  })
  const [submitting, setSubmitting] = useState(false)

  // Re-seed pack-dependent fields when the domain pack changes.
  const onPackChange = (id: string): void => {
    const next = resolvePack(id)
    setPackId(id)
    setSystemId(next.systemPresets[0]?.id ?? 'custom')
    setObjective(next.objectives[0]?.id ?? 'other')
    setComplianceLevel(next.complianceLevels[next.complianceLevels.length - 1]?.id ?? '')
    setTournamentConfig({ ...DEFAULT_TOURNAMENT_CONFIG, weights: defaultWeights(next) })
  }

  const selectedSystem = pack.systemPresets.find((s) => s.id === systemId)
  const valid = target.trim() && goal.trim()

  const submit = async () => {
    if (!valid) return
    setSubmitting(true)
    const input: CreateCampaignInput = {
      packId,
      title: title.trim(),
      target: target.trim(),
      context: {
        systemId,
        customName: selectedSystem?.isCustom ? customName.trim() : undefined,
        systemDetail: systemDetail.trim() || undefined,
        notes: systemNotes.trim() || undefined
      },
      objective,
      goal: goal.trim(),
      constraints: {
        availableTools: splitList(tools),
        forbiddenActions: splitList(forbidden),
        complianceLevel: complianceLevel || undefined,
        onlyNovel
      },
      preferences: preferences.trim(),
      tournamentConfig,
      computeBudget: { initialGeneration, targetDesigns, maxCycles }
    }
    const campaign = await window.api.createCampaign(input)
    await refreshCampaigns()
    await selectCampaign(campaign.id)
    setView('dashboard')
    onClose()
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 'var(--fs-lg)' }}>New campaign</h3>
            <div className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
              Define the research goal, {pack.labels.system.toLowerCase()}, and constraints.
            </div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        <div className="drawer-body">
          {packs.length > 1 && (
            <div className="field">
              <label>Research domain</label>
              <select value={packId} onChange={(e) => onPackChange(e.target.value)}>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.labels.appName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label>{pack.labels.target} *</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={pack.labels.targetPlaceholder}
            />
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label>{pack.labels.system}</label>
              <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                {pack.systemPresets.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.shortName} — {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Objective</label>
              <select value={objective} onChange={(e) => setObjective(e.target.value)}>
                {pack.objectives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSystem?.isCustom && (
            <div className="field">
              <label>Custom {pack.labels.system.toLowerCase()} name</label>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Yarrowia lipolytica" />
            </div>
          )}

          <div className="grid grid-2">
            <div className="field">
              <label>System detail</label>
              <input value={systemDetail} onChange={(e) => setSystemDetail(e.target.value)} placeholder="e.g. BL21(DE3), CEN.PK" />
            </div>
            <div className="field">
              <label>System notes (optional)</label>
              <input value={systemNotes} onChange={(e) => setSystemNotes(e.target.value)} placeholder="extra context for the agents" />
            </div>
          </div>

          <div className="field">
            <label>Research goal *</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              placeholder="Describe the goal in natural language: what to improve, by how much, known bottlenecks, prior attempts, and any data the agents should consider."
            />
          </div>

          <div className="field">
            <label>Desirable attributes / preferences</label>
            <textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              rows={2}
              placeholder="e.g. prefer simple, low-cost, scalable solutions"
            />
          </div>

          <div className="divider" />
          <div className="section-title">Constraints</div>
          <div className="field">
            <label>Available tools / methods</label>
            <input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="comma-separated" />
            <span className="hint">Comma-separated.</span>
          </div>
          <div className="field">
            <label>Forbidden actions</label>
            <input value={forbidden} onChange={(e) => setForbidden(e.target.value)} placeholder="e.g. antibiotic-resistance markers" />
            <span className="hint">Comma-separated; leave blank for none.</span>
          </div>
          <div className="grid grid-2">
            {pack.complianceLevels.length > 0 && (
              <div className="field">
                <label>Compliance level</label>
                <select value={complianceLevel} onChange={(e) => setComplianceLevel(e.target.value)}>
                  {pack.complianceLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label className="checkbox-row">
                <input type="checkbox" checked={onlyNovel} onChange={(e) => setOnlyNovel(e.target.checked)} />
                Only propose novel {pack.labels.hypothesisPlural.toLowerCase()}
              </label>
            </div>
          </div>

          <div className="divider" />
          <div className="section-title">Compute budget (test-time scaling)</div>
          <div className="grid grid-3">
            <div className="field">
              <label>Initial generation</label>
              <input type="number" min={2} max={20} value={initialGeneration} onChange={(e) => setInitialGeneration(+e.target.value)} />
            </div>
            <div className="field">
              <label>Target {pack.labels.hypothesisPlural.toLowerCase()}</label>
              <input type="number" min={6} max={120} value={targetDesigns} onChange={(e) => setTargetDesigns(+e.target.value)} />
            </div>
            <div className="field">
              <label>Max cycles</label>
              <input type="number" min={4} max={120} value={maxCycles} onChange={(e) => setMaxCycles(+e.target.value)} />
            </div>
          </div>

          <div className="divider" />
          <div className="section-title">Tournament scoring</div>
          <TournamentConfigEditor value={tournamentConfig} onChange={setTournamentConfig} pack={pack} />

          <div className="field">
            <label>Campaign title (optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="auto-generated if blank" />
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={!valid || submitting} onClick={submit}>
              Create campaign
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function splitList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}
