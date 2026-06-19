import { useMemo, useState } from 'react'
import { useStore, usePack } from '../store/useStore'
import { Sparkline } from '../components/Charts'
import { DesignStatusBadge, Empty, EvidenceBadge, OriginBadge, VerdictBadge } from '../components/ui'
import { RecordResultForm, ResultsList } from '../components/Results'
import { IconBeaker, IconClose, IconFlag } from '../components/Icons'
import {
  compareDesigns,
  EVOLUTION_STRATEGY_LABELS,
  REVIEW_TYPE_LABELS,
  type Hypothesis
} from '@shared/domain'
import { labelFor } from '@shared/domainpack'

type Filter = 'all' | 'active' | 'flagged' | 'rejected'

export function DesignsExplorer(): JSX.Element {
  const { snapshot, selectedDesignId, openDesign } = useStore()
  const pack = usePack()
  const [filter, setFilter] = useState<Filter>('active')

  const designs = useMemo(() => {
    let list = snapshot?.designs ?? []
    if (filter === 'active') list = list.filter((d) => d.status === 'active' || d.status === 'flagged')
    else if (filter === 'flagged') list = list.filter((d) => d.status === 'flagged')
    else if (filter === 'rejected') list = list.filter((d) => d.status === 'rejected')
    return [...list].sort(compareDesigns)
  }, [snapshot?.designs, filter])

  if (!snapshot) {
    return (
      <div className="page">
        <Empty icon={<IconBeaker size={36} />} title="No campaign selected" />
      </div>
    )
  }

  const selected = snapshot.designs.find((d) => d.id === selectedDesignId) ?? null

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 'var(--fs-xl)' }}>{pack.labels.hypothesisPlural}</h2>
        <span className="spacer" />
        <div className="row gap-sm">
          {(['active', 'all', 'flagged', 'rejected'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="faint" style={{ fontSize: 'var(--fs-xs)', marginBottom: 12, maxWidth: 760 }}>
        {filter === 'rejected' ? (
          <>
            <b>Rejected</b> = failed the initial safety/feasibility review and never entered the
            tournament. This is <b>not</b> an Elo cut-off — these designs keep the default Elo 1200
            (W/L 0/0) because they play no matches. A design with a <i>lower</i> Elo can still be
            “In tournament”: it passed the gate but has been losing matches. Elo ranks the surviving
            designs; it never eliminates them.
          </>
        ) : (
          <>
            Sorted by evidence grade, then Elo. <b>Rejected</b> ≠ low Elo: rejection is a
            safety/feasibility gate, while Elo only ranks the designs that passed it.
          </>
        )}
      </div>

      {designs.length === 0 ? (
        <Empty
          title={`No ${pack.labels.hypothesisPlural.toLowerCase()} in this view`}
          hint={`Run the campaign to generate and rank ${pack.labels.hypothesisPlural.toLowerCase()}.`}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>{pack.labels.hypothesis}</th>
                <th>{pack.labels.methodPlural}</th>
                <th>Origin</th>
                <th className="num">Elo</th>
                <th style={{ width: 100 }}>Trend</th>
                <th className="num">W/L</th>
                <th className="num">Nov.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((d, i) => (
                <tr
                  key={d.id}
                  className={`clickable ${d.id === selectedDesignId ? 'selected' : ''}`}
                  onClick={() => openDesign(d.id)}
                >
                  <td className="faint num">{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.title}</div>
                    <div className="faint" style={{ fontSize: 'var(--fs-xs)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.summary}
                    </div>
                  </td>
                  <td>
                    <div className="row wrap gap-sm">
                      {d.methods.slice(0, 2).map((m, k) => (
                        <span key={k} className="intervention-tag">{labelFor(pack.methodTypes, m.type)}</span>
                      ))}
                      {d.methods.length > 2 && <span className="faint">+{d.methods.length - 2}</span>}
                    </div>
                  </td>
                  <td>
                    <OriginBadge origin={d.origin} />
                  </td>
                  <td className="num elo-cell">{d.elo}</td>
                  <td>
                    <Sparkline history={d.eloHistory} />
                  </td>
                  <td className="num faint">
                    {d.wins}/{d.losses}
                  </td>
                  <td className="num">{d.novelty}</td>
                  <td>
                    <div className="row wrap gap-sm">
                      <DesignStatusBadge status={d.status} />
                      <EvidenceBadge grade={d.evidence} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <DesignDrawer design={selected} onClose={() => openDesign(null)} />}
    </div>
  )
}

export function DesignDrawer({ design, onClose }: { design: Hypothesis; onClose: () => void }): JSX.Element {
  const { snapshot, refreshSnapshot } = useStore()
  const pack = usePack()
  const reviews = snapshot?.reviews.filter((r) => r.designId === design.id) ?? []
  const results = snapshot?.results?.filter((r) => r.designId === design.id) ?? []
  const parents = (design.lineage.parentIds ?? [])
    .map((id) => snapshot?.designs.find((d) => d.id === id))
    .filter(Boolean) as Hypothesis[]

  const toggleFlag = () => window.api.flagDesign(design.id, design.status !== 'flagged')

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div style={{ flex: 1 }}>
            <div className="row wrap gap-sm" style={{ marginBottom: 4 }}>
              <OriginBadge origin={design.origin} />
              <DesignStatusBadge status={design.status} />
              <EvidenceBadge grade={design.evidence} />
              <span className="badge accent">Elo {design.elo}</span>
            </div>
            <h3 style={{ fontSize: 'var(--fs-lg)' }}>{design.title}</h3>
          </div>
          <button className="btn btn-sm" onClick={toggleFlag} title={`Flag for ${pack.labels.validationVenue}`}>
            <IconFlag size={14} /> {design.status === 'flagged' ? 'Unflag' : 'Flag'}
          </button>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="detail-block">
            <h4>Summary</h4>
            <p>{design.summary}</p>
          </div>

          <div className="detail-block">
            <h4>{pack.labels.methodPlural}</h4>
            <div className="col gap-sm">
              {design.methods.map((m, i) => (
                <div key={i} className="lineage-node">
                  <div className="row gap-sm" style={{ marginBottom: 4 }}>
                    <span className="badge accent">{labelFor(pack.methodTypes, m.type)}</span>
                    <span className="mono">{m.targets.join(', ')}</span>
                  </div>
                  <div className="muted">{m.details}</div>
                </div>
              ))}
              {design.methods.length === 0 && <span className="faint">None specified.</span>}
            </div>
          </div>

          <div className="detail-block">
            <h4>{pack.labels.mechanism}</h4>
            <p>{design.mechanism || '—'}</p>
          </div>

          <div className="detail-block">
            <h4>{pack.labels.predictedEffect}</h4>
            <p>{design.predictedEffect || '—'}</p>
            {design.quantPrediction && typeof design.quantPrediction.relativeChange === 'number' && (
              <div className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
                Quantified: {design.quantPrediction.direction} {labelFor(pack.metrics, design.quantPrediction.metric)} by ~
                {Math.round(Math.abs(design.quantPrediction.relativeChange) * 100)}%
                {typeof design.quantPrediction.confidence === 'number'
                  ? ` (confidence ${design.quantPrediction.confidence})`
                  : ''}
              </div>
            )}
          </div>

          {design.plan.length > 0 && (
            <div className="detail-block">
              <h4>{pack.labels.planSectionTitle}</h4>
              <div className="col gap-sm">
                {design.plan.map((s, i) => (
                  <div key={i} className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                    <span className="badge blue" style={{ textTransform: 'capitalize', minWidth: 56, justifyContent: 'center' }}>
                      {labelFor(pack.planPhases, s.phase)}
                    </span>
                    <span style={{ flex: 1 }}>{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {design.artifacts.length > 0 && (
            <div className="detail-block">
              <h4>Artifacts</h4>
              <div className="col gap-sm">
                {design.artifacts.map((c, i) => (
                  <div key={i} className="lineage-node">
                    <div className="row">
                      <b>{c.label}</b>
                      <span className="spacer" />
                      <span className="badge">{c.source}</span>
                    </div>
                    {c.content && <div className="mono" style={{ marginTop: 4, wordBreak: 'break-all' }}>{c.content}</div>}
                    <div className="muted" style={{ marginTop: 3 }}>{c.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {design.risks.length > 0 && (
            <div className="detail-block">
              <h4>Risks</h4>
              <ul className="list-tight muted" style={{ margin: 0, paddingLeft: 18 }}>
                {design.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {parents.length > 0 && (
            <div className="detail-block">
              <h4>Lineage</h4>
              {design.lineage.strategy && (
                <div className="faint" style={{ fontSize: 'var(--fs-sm)', marginBottom: 6 }}>
                  Evolved via: {EVOLUTION_STRATEGY_LABELS[design.lineage.strategy]}
                </div>
              )}
              <div className="col gap-sm">
                {parents.map((p) => (
                  <div key={p.id} className="lineage-node row">
                    <span>↳ {p.title}</span>
                    <span className="spacer" />
                    <span className="badge accent">Elo {p.elo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-block">
            <h4>Reviews ({reviews.length})</h4>
            {reviews.length === 0 ? (
              <span className="faint">No reviews yet.</span>
            ) : (
              <div className="col gap-md">
                {reviews.map((r) => (
                  <div key={r.id} className="lineage-node">
                    <div className="row gap-sm" style={{ marginBottom: 6 }}>
                      <span className="badge">{REVIEW_TYPE_LABELS[r.type]}</span>
                      <VerdictBadge verdict={r.verdict} />
                      <span className="spacer" />
                      <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{r.author}</span>
                    </div>
                    {Object.keys(r.scores).length > 0 && (
                      <div className="row wrap gap-sm" style={{ marginBottom: 6 }}>
                        {(Object.entries(r.scores) as [string, number][]).map(([k, v]) => (
                          <span key={k} className="badge" title={labelFor(pack.criteria, k)}>
                            {labelFor(pack.criteria, k).slice(0, 4)} {v}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="muted">{r.narrative}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="detail-block">
            <h4>{pack.labels.measuredResults} ({results.length})</h4>
            <ResultsList results={results} onChanged={refreshSnapshot} />
            <div style={{ marginTop: 12 }}>
              <div className="section-title">Record a result</div>
              <RecordResultForm campaignId={design.campaignId} designId={design.id} onDone={refreshSnapshot} />
            </div>
          </div>

          {design.citations.length > 0 && (
            <div className="detail-block">
              <h4>Citations</h4>
              <ul className="list-tight" style={{ margin: 0, paddingLeft: 18 }}>
                {design.citations.map((c, i) => (
                  <li key={i}>{c.url ? <a href={c.url}>{c.title}</a> : c.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
