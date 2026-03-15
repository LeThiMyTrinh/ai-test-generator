import { useEffect, useState } from 'react'
import api, { apiUrl } from '../api/client'
import { FileDown, ChevronDown, ChevronRight, Trash2, RefreshCw, Bug } from 'lucide-react'
import toast from 'react-hot-toast'

export default function History({ navigate, ctx }) {
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState('')
    const [suites, setSuites] = useState([])
    const [selectedSuite, setSelectedSuite] = useState('')
    const [runs, setRuns] = useState([])
    const [expanded, setExpanded] = useState({})
    const [details, setDetails] = useState({})
    const [lightbox, setLightbox] = useState(null)
    const [selectedRuns, setSelectedRuns] = useState(new Set())
    const [deleting, setDeleting] = useState(false)
    const [rerunning, setRerunning] = useState({})        // { runId: true } when re-running
    const [rerunProgress, setRerunProgress] = useState({}) // { runId: { done, total } }
    const [comparisons, setComparisons] = useState({})     // { runId: comparison[] }
    const [priorities, setPriorities] = useState({})       // { 'runId::tcId': 'HIGH' }

    const PRIORITY_OPTIONS = [
        { value: '', label: '-- Chưa gán --', color: '#94a3b8', bg: '#f1f5f9' },
        { value: 'CRITICAL', label: '🔴 Critical', color: '#991b1b', bg: '#fee2e2' },
        { value: 'HIGH', label: '🟠 High', color: '#c2410c', bg: '#fff7ed' },
        { value: 'MEDIUM', label: '🟡 Medium', color: '#a16207', bg: '#fefce8' },
        { value: 'LOW', label: '🟢 Low', color: '#15803d', bg: '#f0fdf4' },
    ]

    // Load projects
    useEffect(() => { api.get('/api/projects').then(r => setProjects(r.data)) }, [])

    // Load suites filtered by project
    useEffect(() => {
        const url = selectedProject ? `/api/test-suites?project_id=${selectedProject}` : '/api/test-suites'
        api.get(url).then(r => setSuites(r.data))
    }, [selectedProject])

    // Load runs — single function handles all filter cases
    const loadRuns = async () => {
        try {
            let filteredRuns
            if (selectedSuite) {
                // Suite selected → filter by suite_id
                const r = await api.get(`/api/runs?suite_id=${selectedSuite}`)
                filteredRuns = r.data
            } else if (selectedProject) {
                // Project selected, no suite → get all suites for project, filter runs by those suiteIds
                const suitesRes = await api.get(`/api/test-suites?project_id=${selectedProject}`)
                const suiteIds = suitesRes.data.map(s => s.id)
                const runsRes = await api.get('/api/runs')
                filteredRuns = runsRes.data.filter(run => suiteIds.includes(run.suite_id))
            } else {
                // Nothing selected → all runs
                const r = await api.get('/api/runs')
                filteredRuns = r.data
            }
            setRuns(filteredRuns)
        } catch (err) {
            setRuns([])
        }
        setSelectedRuns(new Set())
    }

    useEffect(() => { loadRuns() }, [selectedSuite, selectedProject])

    // Reset suite when project changes
    const handleProjectChange = (projectId) => {
        setSelectedProject(projectId)
        setSelectedSuite('')
    }

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

    const toggleSelect = (runId, e) => {
        e.stopPropagation()
        setSelectedRuns(prev => {
            const next = new Set(prev)
            if (next.has(runId)) next.delete(runId)
            else next.add(runId)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedRuns.size === runs.length) {
            setSelectedRuns(new Set())
        } else {
            setSelectedRuns(new Set(runs.map(r => r.id)))
        }
    }

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

    // ========= Re-run FAILED =========
    const rerunFailed = async (runId, e) => {
        e.stopPropagation()
        if (!confirm('Bạn có muốn chạy lại tất cả test case FAILED?\nHệ thống sẽ tạo một lần chạy mới chỉ với các case bị fail.')) return

        setRerunning(p => ({ ...p, [runId]: true }))
        try {
            const r = await api.post(`/api/runs/rerun-failed/${runId}`)
            const newRunId = r.data.run_id
            const total = r.data.total
            toast.success(`Đang chạy lại ${total} test case FAILED...`)
            setRerunProgress(p => ({ ...p, [runId]: { done: 0, total, newRunId } }))

            // Poll for completion
            const pollInterval = setInterval(async () => {
                try {
                    const res = await api.get(`/api/runs/${newRunId}`)
                    const run = res.data
                    if (run.status === 'DONE') {
                        clearInterval(pollInterval)
                        const s = run.summary_json ? (typeof run.summary_json === 'string' ? JSON.parse(run.summary_json) : run.summary_json) : {}
                        setRerunProgress(p => ({ ...p, [runId]: { ...p[runId], done: s.total || total, total: s.total || total } }))

                        // Fetch comparison
                        try {
                            const cmpRes = await api.get(`/api/runs/${newRunId}/comparison`)
                            setComparisons(p => ({ ...p, [runId]: cmpRes.data }))
                        } catch { /* no-op */ }

                        setRerunning(p => ({ ...p, [runId]: false }))
                        toast.success('Chạy lại hoàn tất!')

                        // Reload runs list
                        loadRuns()
                    } else if (run.status === 'ERROR') {
                        clearInterval(pollInterval)
                        setRerunning(p => ({ ...p, [runId]: false }))
                        toast.error('Chạy lại gặp lỗi')
                    } else if (run.results) {
                        setRerunProgress(p => ({
                            ...p,
                            [runId]: { ...p[runId], done: run.results.length }
                        }))
                    }
                } catch { /* ignore */ }
            }, 3000)
        } catch (err) {
            toast.error(err.response?.data?.error || 'Lỗi khi chạy lại')
            setRerunning(p => ({ ...p, [runId]: false }))
        }
    }

    const getFailedCount = (run) => {
        const s = run.summary_json ? JSON.parse(run.summary_json) : {}
        return s.failed || 0
    }

    // ========= Priority =========
    const updatePriority = async (runId, testCaseId, priority) => {
        const key = `${runId}::${testCaseId}`
        setPriorities(p => ({ ...p, [key]: priority }))
        try {
            await api.patch(`/api/runs/${runId}/results/${testCaseId}/priority`, { priority })
            toast.success(`Đã cập nhật ưu tiên: ${priority}`)
        } catch (err) {
            toast.error('Lỗi cập nhật ưu tiên')
        }
    }

    const getPriorityForResult = (runId, r) => {
        const key = `${runId}::${r.test_case_id}`
        return priorities[key] || r.priority || ''
    }

    const getPriorityStyle = (val) => {
        const opt = PRIORITY_OPTIONS.find(o => o.value === val)
        return opt ? { color: opt.color, background: opt.bg } : {}
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
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 200 }}>
                            <label className="form-label">Lọc theo Dự án</label>
                            <select className="form-control" value={selectedProject} onChange={e => handleProjectChange(e.target.value)}>
                                <option value="">-- Tất cả Dự án --</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div style={{ minWidth: 200 }}>
                            <label className="form-label">Lọc theo Suite</label>
                            <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)}>
                                <option value="">-- Tất cả Suite --</option>
                                {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
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
                const failedCount = s.failed || 0
                const isRerunning = rerunning[run.id]
                const progress = rerunProgress[run.id]
                const comparison = comparisons[run.id]

                return (
                    <div key={run.id} className="card" style={{ marginBottom: 12, overflow: 'hidden', border: selectedRuns.has(run.id) ? '2px solid var(--primary)' : undefined }}>
                        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => toggleExpand(run.id)}>
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
                                    {run.parent_run_id && (
                                        <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                                            🔄 Re-run của {run.parent_run_id}
                                        </span>
                                    )}
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
                                <div className="flex gap-2" onClick={e => e.stopPropagation()} style={{ flexWrap: 'wrap' }}>
                                    <a className="btn btn-outline btn-sm" href={apiUrl(`/api/reports/${run.id}/html`)} target="_blank"><FileDown size={13} /> HTML</a>
                                    <a className="btn btn-ghost btn-sm" href={apiUrl(`/api/reports/${run.id}/pdf`)} target="_blank">PDF</a>
                                    {failedCount > 0 && (
                                        <a className="btn btn-sm" href={apiUrl(`/api/reports/${run.id}/failed/html`)} target="_blank"
                                            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Bug size={13} /> Export Failed ({failedCount})
                                        </a>
                                    )}
                                    {failedCount > 0 && (
                                        <button
                                            className="btn btn-sm"
                                            onClick={(e) => rerunFailed(run.id, e)}
                                            disabled={isRerunning}
                                            style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <RefreshCw size={13} className={isRerunning ? 'spin' : ''} />
                                            {isRerunning ? 'Đang chạy...' : `Rerun Failed`}
                                        </button>
                                    )}
                                </div>
                            )}
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

                        {/* Re-run progress bar */}
                        {isRerunning && progress && (
                            <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', background: '#fffbeb' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#92400e', marginBottom: 4 }}>
                                    <span>🔄 Đang chạy lại {progress.total} case FAILED...</span>
                                    <span>{progress.done}/{progress.total}</span>
                                </div>
                                <div className="progress-bar" style={{ height: 6 }}>
                                    <div className="progress-fill" style={{ width: `${progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 0}%`, background: '#f59e0b' }} />
                                </div>
                            </div>
                        )}

                        {/* Comparison table — Before/After */}
                        {comparison && (
                            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: '#f0fdf4' }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    📊 So sánh Before / After
                                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                                        (Run mới: {comparison.run_id})
                                    </span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #bbf7d0' }}>
                                            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#166534', fontSize: 12 }}>Test Case</th>
                                            <th style={{ textAlign: 'center', padding: '6px 10px', color: '#166534', fontSize: 12 }}>Trước</th>
                                            <th style={{ textAlign: 'center', padding: '6px 10px', color: '#166534', fontSize: 12 }}>Sau</th>
                                            <th style={{ textAlign: 'center', padding: '6px 10px', color: '#166534', fontSize: 12 }}>Kết quả</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparison.comparison.map((c, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #dcfce7' }}>
                                                <td style={{ padding: '8px 10px', fontWeight: 500 }}>{c.title}</td>
                                                <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                                    <span className={`badge ${c.old_status === 'PASSED' ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: 11 }}>{c.old_status}</span>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                                    <span className={`badge ${c.new_status === 'PASSED' ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: 11 }}>{c.new_status}</span>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                                    {c.verdict === 'FIXED' ? (
                                                        <span style={{ background: '#dcfce7', color: '#16a34a', fontWeight: 700, padding: '3px 12px', borderRadius: 12, fontSize: 12 }}>✅ Fixed</span>
                                                    ) : (
                                                        <span style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700, padding: '3px 12px', borderRadius: 12, fontSize: 12 }}>❌ Still Failed</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {isOpen && detail && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                                {(detail.results || []).map((r, i) => {
                                    const steps = r.steps_result_json ? JSON.parse(r.steps_result_json) : []
                                    const currentPriority = getPriorityForResult(run.id, r)
                                    return (
                                        <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                            <div className="flex items-center gap-2" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                                                <span className={`badge ${r.status === 'PASSED' ? 'badge-pass' : 'badge-fail'}`}>{r.status}</span>
                                                <strong>{r.test_case_title}</strong>
                                                <span className="text-muted text-sm">{Math.round((r.duration_ms || 0) / 1000)}s</span>
                                                {r.status === 'FAILED' && (
                                                    <select
                                                        value={currentPriority}
                                                        onChange={(e) => updatePriority(run.id, r.test_case_id, e.target.value)}
                                                        style={{
                                                            marginLeft: 'auto',
                                                            padding: '4px 10px',
                                                            borderRadius: 8,
                                                            border: '1.5px solid #e2e8f0',
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            ...getPriorityStyle(currentPriority)
                                                        }}
                                                    >
                                                        {PRIORITY_OPTIONS.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                )}
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
