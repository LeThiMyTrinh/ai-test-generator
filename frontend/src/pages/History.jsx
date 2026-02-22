import { useEffect, useState } from 'react'
import axios from 'axios'
import { FileDown, ChevronDown, ChevronRight } from 'lucide-react'

export default function History({ navigate, ctx }) {
    const [suites, setSuites] = useState([])
    const [selectedSuite, setSelectedSuite] = useState('')
    const [runs, setRuns] = useState([])
    const [expanded, setExpanded] = useState({})
    const [details, setDetails] = useState({})
    const [lightbox, setLightbox] = useState(null)

    useEffect(() => { axios.get('/api/test-suites').then(r => setSuites(r.data)) }, [])
    useEffect(() => {
        const url = selectedSuite ? `/api/runs?suite_id=${selectedSuite}` : '/api/runs'
        axios.get(url).then(r => setRuns(r.data))
    }, [selectedSuite])

    const toggleExpand = async (runId) => {
        setExpanded(p => ({ ...p, [runId]: !p[runId] }))
        if (!details[runId]) {
            const r = await axios.get(`/api/runs/${runId}`)
            setDetails(p => ({ ...p, [runId]: r.data }))
        }
    }

    const statusBadge = (s) => {
        const cls = { DONE: 'badge-pass', RUNNING: 'badge-running', ERROR: 'badge-error' }
        return <span className={`badge ${cls[s] || 'badge-error'}`}>{s}</span>
    }

    return (
        <div>
            {lightbox && (
                <div className="lightbox" onClick={() => setLightbox(null)}>
                    <button className="lightbox-close">✕</button>
                    <img src={lightbox} alt="evidence" onClick={e => e.stopPropagation()} />
                </div>
            )}

            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                <div style={{ maxWidth: 360 }}>
                    <label className="form-label">Lọc theo Suite</label>
                    <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)}>
                        <option value="">-- Tất cả Suite --</option>
                        {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {runs.length === 0 && <div className="empty-state"><p>Chưa có lần chạy nào. Hãy vào Live Monitor để chạy test.</p></div>}

            {runs.map(run => {
                const s = run.summary_json ? JSON.parse(run.summary_json) : {}
                const isOpen = expanded[run.id]
                const detail = details[run.id]
                return (
                    <div key={run.id} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => toggleExpand(run.id)}>
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <div style={{ flex: 1 }}>
                                <div className="flex items-center gap-2">
                                    <strong style={{ fontSize: 14 }}>{run.id}</strong>
                                    {statusBadge(run.status)}
                                </div>
                                <div className="text-sm text-muted">{run.suite_id} &nbsp;|&nbsp; {new Date(run.started_at).toLocaleString('vi-VN')}</div>
                            </div>
                            {run.status === 'DONE' && (
                                <div style={{ textAlign: 'right', fontSize: 13 }}>
                                    <span className="status-PASSED">{s.passed || 0} pass</span> / <span className="status-FAILED">{s.failed || 0} fail</span>
                                    &nbsp;—&nbsp; {s.total > 0 ? Math.round(s.passed / s.total * 100) : 0}%
                                </div>
                            )}
                            {run.status === 'DONE' && (
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <a className="btn btn-outline btn-sm" href={`/api/reports/${run.id}/html`} target="_blank"><FileDown size={13} /> HTML</a>
                                    <a className="btn btn-ghost btn-sm" href={`/api/reports/${run.id}/pdf`} target="_blank">PDF</a>
                                </div>
                            )}
                        </div>

                        {isOpen && detail && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                                {(detail.results || []).map((r, i) => {
                                    const steps = r.steps_result_json ? JSON.parse(r.steps_result_json) : []
                                    return (
                                        <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                                                <span className={`badge ${r.status === 'PASSED' ? 'badge-pass' : 'badge-fail'}`}>{r.status}</span>
                                                <strong>{r.test_case_title}</strong>
                                                <span className="text-muted text-sm">{Math.round((r.duration_ms || 0) / 1000)}s</span>
                                            </div>
                                            {r.error_message && <div style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, fontSize: 13, color: 'var(--danger)' }}>⚠️ {r.error_message}</div>}
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {steps.filter(s => s.screenshot).map((s, j) => (
                                                    <img key={j} src={`/${s.screenshot}`} style={{ width: 120, height: 75, objectFit: 'cover', borderRadius: 6, border: `2px solid ${s.status === 'PASSED' ? 'var(--success)' : 'var(--danger)'}`, cursor: 'pointer' }} onClick={() => setLightbox(`/${s.screenshot}`)} title={`Step ${s.step_id} - ${s.status}`} />
                                                ))}
                                                {r.video_path && <a href={`/${r.video_path}`} target="_blank" className="btn btn-ghost btn-sm">🎬 Video</a>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
