import { useEffect, useState } from 'react'
import api, { apiUrl } from '../api/client'
import { FileDown, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'

export default function History({ navigate, ctx }) {
    const [suites, setSuites] = useState([])
    const [selectedSuite, setSelectedSuite] = useState('')
    const [runs, setRuns] = useState([])
    const [expanded, setExpanded] = useState({})
    const [details, setDetails] = useState({})
    const [lightbox, setLightbox] = useState(null)
    const [selectedRuns, setSelectedRuns] = useState(new Set())
    const [deleting, setDeleting] = useState(false)

    useEffect(() => { api.get('/api/test-suites').then(r => setSuites(r.data)) }, [])
    useEffect(() => {
        const url = selectedSuite ? `/api/runs?suite_id=${selectedSuite}` : '/api/runs'
        api.get(url).then(r => setRuns(r.data))
    }, [selectedSuite])

    const toggleExpand = async (runId) => {
        setExpanded(p => ({ ...p, [runId]: !p[runId] }))
        if (!details[runId]) {
            const r = await api.get(`/api/runs/${runId}`)
            setDetails(p => ({ ...p, [runId]: r.data }))
        }
    }

    const statusBadge = (s) => {
        const cls = { DONE: 'badge-pass', RUNNING: 'badge-running', ERROR: 'badge-error' }
        return <span className={`badge ${cls[s] || 'badge-error'}`}>{s}</span>
    }

    // Toggle checkbox for a single run
    const toggleSelect = (runId, e) => {
        e.stopPropagation()
        setSelectedRuns(prev => {
            const next = new Set(prev)
            if (next.has(runId)) next.delete(runId)
            else next.add(runId)
            return next
        })
    }

    // Toggle select all
    const toggleSelectAll = () => {
        if (selectedRuns.size === runs.length) {
            setSelectedRuns(new Set())
        } else {
            setSelectedRuns(new Set(runs.map(r => r.id)))
        }
    }

    // Delete a single run
    const deleteSingleRun = async (runId, e) => {
        e.stopPropagation()
        if (!confirm(`Bạn có chắc muốn xóa run "${runId}"?\nDữ liệu kết quả và evidence sẽ bị xóa vĩnh viễn.`)) return
        setDeleting(true)
        try {
            await api.delete(`/api/runs/${runId}`)
            setRuns(prev => prev.filter(r => r.id !== runId))
            setSelectedRuns(prev => { const next = new Set(prev); next.delete(runId); return next })
            setDetails(prev => { const next = { ...prev }; delete next[runId]; return next })
            setExpanded(prev => { const next = { ...prev }; delete next[runId]; return next })
        } catch (err) {
            alert('Lỗi khi xóa: ' + (err.response?.data?.error || err.message))
        }
        setDeleting(false)
    }

    // Bulk delete selected runs
    const deleteSelectedRuns = async () => {
        const ids = Array.from(selectedRuns)
        if (ids.length === 0) return
        if (!confirm(`Bạn có chắc muốn xóa ${ids.length} run đã chọn?\nDữ liệu kết quả và evidence sẽ bị xóa vĩnh viễn.`)) return
        setDeleting(true)
        try {
            await api.post('/api/runs/bulk-delete', { ids })
            setRuns(prev => prev.filter(r => !selectedRuns.has(r.id)))
            setSelectedRuns(new Set())
        } catch (err) {
            alert('Lỗi khi xóa: ' + (err.response?.data?.error || err.message))
        }
        setDeleting(false)
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ maxWidth: 360 }}>
                        <label className="form-label">Lọc theo Suite</label>
                        <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)}>
                            <option value="">-- Tất cả Suite --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    {runs.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedRuns.size === runs.length && runs.length > 0}
                                    onChange={toggleSelectAll}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                />
                                Chọn tất cả ({runs.length})
                            </label>
                            {selectedRuns.size > 0 && (
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={deleteSelectedRuns}
                                    disabled={deleting}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Trash2 size={14} />
                                    Xóa đã chọn ({selectedRuns.size})
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {runs.length === 0 && <div className="empty-state"><p>Chưa có lần chạy nào. Hãy vào Live Monitor để chạy test.</p></div>}

            {runs.map(run => {
                const s = run.summary_json ? JSON.parse(run.summary_json) : {}
                const isOpen = expanded[run.id]
                const detail = details[run.id]
                return (
                    <div key={run.id} className="card" style={{ marginBottom: 12, overflow: 'hidden', border: selectedRuns.has(run.id) ? '2px solid var(--primary)' : undefined }}>
                        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => toggleExpand(run.id)}>
                            {/* Checkbox */}
                            <input
                                type="checkbox"
                                checked={selectedRuns.has(run.id)}
                                onChange={(e) => toggleSelect(run.id, e)}
                                style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                            />
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
                                    <a className="btn btn-outline btn-sm" href={apiUrl(`/api/reports/${run.id}/html`)} target="_blank"><FileDown size={13} /> HTML</a>
                                    <a className="btn btn-ghost btn-sm" href={apiUrl(`/api/reports/${run.id}/pdf`)} target="_blank">PDF</a>
                                </div>
                            )}
                            {/* Delete button */}
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => deleteSingleRun(run.id, e)}
                                disabled={deleting}
                                title="Xóa run này"
                                style={{ color: 'var(--danger)', padding: '4px 8px', flexShrink: 0 }}
                            >
                                <Trash2 size={15} />
                            </button>
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
