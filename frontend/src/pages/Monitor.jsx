import { useEffect, useState, useRef, useCallback } from 'react'
import api, { apiUrl, baseURL } from '../api/client'
import toast from 'react-hot-toast'
import { io } from 'socket.io-client'
import { PlayCircle, CheckCircle, XCircle, Clock, Image, Bug, StopCircle, PauseCircle, PlayIcon } from 'lucide-react'

export default function Monitor({ navigate, ctx }) {
    const { suite_id, suite_name } = ctx || {}
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState('')
    const [suites, setSuites] = useState([])
    const [selectedSuite, setSelectedSuite] = useState(suite_id || '')
    const [suiteTestCases, setSuiteTestCases] = useState([])
    const [selectedTcIds, setSelectedTcIds] = useState([])
    const [runId, setRunId] = useState(null)
    const [status, setStatus] = useState('idle') // idle | running | paused | done | error | cancelled
    const [tcResults, setTcResults] = useState({})
    const [summary, setSummary] = useState(null)
    const [progress, setProgress] = useState({ done: 0, total: 0 })
    const [lightbox, setLightbox] = useState(null)

    // Run options
    const [continueOnFailure, setContinueOnFailure] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const [concurrency, setConcurrency] = useState(1)

    // Refs for Socket.IO and batched updates
    const socketRef = useRef(null)
    const pendingStepsRef = useRef({})
    const flushTimerRef = useRef(null)

    // Flush batched step updates every 300ms to avoid excessive re-renders
    const flushStepUpdates = useCallback(() => {
        const pending = pendingStepsRef.current
        if (Object.keys(pending).length === 0) return
        setTcResults(prev => {
            const next = { ...prev }
            for (const [tcId, steps] of Object.entries(pending)) {
                next[tcId] = { ...next[tcId], steps: [...(next[tcId]?.steps || []), ...steps] }
            }
            return next
        })
        pendingStepsRef.current = {}
    }, [])

    // Load projects
    useEffect(() => { api.get('/api/projects').then(r => setProjects(r.data)) }, [])

    // Load suites (filtered by project)
    useEffect(() => {
        const url = selectedProject ? `/api/test-suites?project_id=${selectedProject}` : '/api/test-suites'
        api.get(url).then(r => setSuites(r.data))
    }, [selectedProject])

    // Socket.IO — proper lifecycle with cleanup
    useEffect(() => {
        const sock = io(baseURL || window.location.origin, { transports: ['websocket', 'polling'] })
        socketRef.current = sock

        sock.on('tc_start', ({ tcId, title }) => {
            flushStepUpdates() // flush any pending before new TC
            setTcResults(p => ({ ...p, [tcId]: { title, status: 'RUNNING', steps: [] } }))
        })
        sock.on('step_done', ({ tcId, step }) => {
            // Batch step updates instead of re-rendering per step
            if (!pendingStepsRef.current[tcId]) pendingStepsRef.current[tcId] = []
            pendingStepsRef.current[tcId].push(step)
            clearTimeout(flushTimerRef.current)
            flushTimerRef.current = setTimeout(flushStepUpdates, 300)
        })
        sock.on('tc_done', ({ tcId, result }) => {
            flushStepUpdates() // flush remaining steps for this TC
            setTcResults(p => ({ ...p, [tcId]: { ...p[tcId], status: result.status, error: result.error_message, videoPath: result.video_path } }))
            setProgress(p => ({ ...p, done: p.done + 1 }))
        })
        sock.on('run_done', ({ summary }) => { flushStepUpdates(); setSummary(summary); setStatus('done') })
        sock.on('run_error', ({ error }) => { toast.error(error); setStatus('error') })
        sock.on('run_cancelled', () => { flushStepUpdates(); setStatus('cancelled'); toast('Run đã bị hủy') })

        return () => {
            clearTimeout(flushTimerRef.current)
            sock.disconnect()
            socketRef.current = null
        }
    }, [flushStepUpdates])

    // Load test cases khi đổi Suite
    useEffect(() => {
        if (!selectedSuite) {
            setSuiteTestCases([])
            setSelectedTcIds([])
            return
        }
        api.get(`/api/test-cases?suite_id=${selectedSuite}`)
            .then(r => {
                setSuiteTestCases(r.data)
                setSelectedTcIds(r.data.map(tc => tc.id))
            })
            .catch(() => {
                setSuiteTestCases([])
                setSelectedTcIds([])
            })
    }, [selectedSuite])

    // Reset selected suite when project changes
    useEffect(() => {
        if (selectedProject && selectedSuite) {
            const suiteInProject = suites.find(s => s.id === selectedSuite)
            if (!suiteInProject) setSelectedSuite('')
        }
    }, [suites])

    const allChecked = suiteTestCases.length > 0 && selectedTcIds.length === suiteTestCases.length
    const someChecked = selectedTcIds.length > 0 && selectedTcIds.length < suiteTestCases.length

    const toggleAll = () => {
        if (allChecked) {
            setSelectedTcIds([])
        } else {
            setSelectedTcIds(suiteTestCases.map(tc => tc.id))
        }
    }

    const toggleTc = (id) => {
        setSelectedTcIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const startRun = async () => {
        if (!selectedSuite) return toast.error('Chọn Suite trước')
        if (selectedTcIds.length === 0) return toast.error('Chọn ít nhất một Test Case để chạy')
        setTcResults({}); setSummary(null); setStatus('running'); setProgress({ done: 0, total: selectedTcIds.length })
        try {
            const r = await api.post('/api/runs', {
                suite_id: selectedSuite,
                test_case_ids: selectedTcIds,
                continueOnFailure,
                retryCount,
                concurrency,
            })
            setRunId(r.data.run_id)
            toast.success('Đã bắt đầu chạy test!')
        } catch (e) { toast.error(e.response?.data?.error || 'Lỗi'); setStatus('idle') }
    }

    const cancelRun = async () => {
        if (!runId) return
        try {
            await api.post(`/api/runs/${runId}/cancel`)
            setStatus('cancelled')
            toast('Đã gửi yêu cầu hủy')
        } catch (e) { toast.error('Lỗi hủy: ' + (e.response?.data?.error || e.message)) }
    }

    const pauseRun = async () => {
        if (!runId) return
        try {
            await api.post(`/api/runs/${runId}/pause`)
            setStatus('paused')
            toast('Đã tạm dừng')
        } catch (e) { toast.error(e.response?.data?.error || e.message) }
    }

    const resumeRun = async () => {
        if (!runId) return
        try {
            await api.post(`/api/runs/${runId}/resume`)
            setStatus('running')
            toast('Đã tiếp tục chạy')
        } catch (e) { toast.error(e.response?.data?.error || e.message) }
    }

    // Polling fallback: nếu Socket.IO không kết nối được, poll API mỗi 5s
    useEffect(() => {
        if (status !== 'running' || !runId) return
        const interval = setInterval(async () => {
            try {
                const r = await api.get(`/api/runs/${runId}`)
                const run = r.data
                if (run.status === 'DONE' || run.status === 'ERROR') {
                    clearInterval(interval)
                    if (run.status === 'DONE' && run.summary_json) {
                        const s = typeof run.summary_json === 'string' ? JSON.parse(run.summary_json) : run.summary_json
                        setSummary(s)
                        setProgress({ done: s.total, total: s.total })
                    }
                    if (run.results && run.results.length > 0) {
                        const mapped = {}
                        for (const r of run.results) {
                            mapped[r.test_case_id] = {
                                title: r.test_case_title,
                                status: r.status,
                                error: r.error_message,
                                videoPath: r.video_path,
                                steps: r.steps_result_json ? (typeof r.steps_result_json === 'string' ? JSON.parse(r.steps_result_json) : r.steps_result_json) : []
                            }
                        }
                        setTcResults(prev => ({ ...prev, ...mapped }))
                    }
                    setStatus(run.status === 'DONE' ? 'done' : 'error')
                    if (run.status === 'ERROR') toast.error('Test run gặp lỗi trên server')
                }
            } catch { /* ignore polling errors */ }
        }, 5000)
        return () => clearInterval(interval)
    }, [status, runId])

    const pct = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 0
    const tcList = Object.entries(tcResults)

    const stepIcon = (s) => {
        if (s === 'PASSED') return <CheckCircle size={14} color="var(--success)" />
        if (s === 'FAILED') return <XCircle size={14} color="var(--danger)" />
        return <Clock size={14} color="var(--primary)" />
    }

    return (
        <div>
            {lightbox && (
                <div className="lightbox" onClick={() => setLightbox(null)}>
                    <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
                    <img src={lightbox} alt="screenshot" onClick={e => e.stopPropagation()} />
                </div>
            )}

            {/* Controls */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 200 }}>
                        <label className="form-label">Lọc theo Dự án</label>
                        <select className="form-control" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setSelectedSuite('') }} disabled={status === 'running'}>
                            <option value="">-- Tất cả Dự án --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="form-label">Chọn Test Suite để chạy</label>
                        <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)} disabled={status === 'running'}>
                            <option value="">-- Chọn Suite --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.tc_count} TC)</option>)}
                        </select>
                    </div>
                    <div style={{ marginTop: 22, display: 'flex', gap: 6 }}>
                        {(status === 'idle' || status === 'done' || status === 'error' || status === 'cancelled') && (
                            <button className="btn btn-success" onClick={startRun} disabled={!selectedSuite || selectedTcIds.length === 0}>
                                <PlayCircle size={17} /> Bắt đầu chạy ({selectedTcIds.length})
                            </button>
                        )}
                        {status === 'running' && (
                            <>
                                <button className="btn" style={{ background: '#f59e0b', color: '#fff', border: 'none' }} onClick={pauseRun}>
                                    <PauseCircle size={17} /> Tạm dừng
                                </button>
                                <button className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={cancelRun}>
                                    <StopCircle size={17} /> Hủy
                                </button>
                            </>
                        )}
                        {status === 'paused' && (
                            <>
                                <button className="btn btn-success" onClick={resumeRun}>
                                    <PlayIcon size={17} /> Tiếp tục
                                </button>
                                <button className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={cancelRun}>
                                    <StopCircle size={17} /> Hủy
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Run Options */}
                {selectedSuite && (status === 'idle' || status === 'done' || status === 'error' || status === 'cancelled') && (
                    <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={continueOnFailure} onChange={e => setContinueOnFailure(e.target.checked)} style={{ width: 15, height: 15 }} />
                            Chạy tiếp khi fail
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Retry:
                            <select value={retryCount} onChange={e => setRetryCount(parseInt(e.target.value))} className="form-control" style={{ width: 60, padding: '3px 6px', fontSize: 13 }}>
                                <option value={0}>0</option>
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                            </select>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Song song:
                            <select value={concurrency} onChange={e => setConcurrency(parseInt(e.target.value))} className="form-control" style={{ width: 60, padding: '3px 6px', fontSize: 13 }}>
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                            </select>
                        </label>
                    </div>
                )}

                {/* Danh sách Test Cases có checkbox - chỉ hiện khi chưa chạy */}
                {selectedSuite && suiteTestCases.length > 0 && (status === 'idle' || status === 'done' || status === 'error' || status === 'cancelled') && (
                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                            <input
                                type="checkbox"
                                id="select-all-tc"
                                checked={allChecked}
                                ref={el => { if (el) el.indeterminate = someChecked }}
                                onChange={toggleAll}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                            <label htmlFor="select-all-tc" style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>
                                {allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} ({selectedTcIds.length}/{suiteTestCases.length})
                            </label>
                        </div>
                        <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {suiteTestCases.map((tc, idx) => (
                                <label
                                    key={tc.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                                        background: selectedTcIds.includes(tc.id) ? 'var(--primary-light, #eff6ff)' : 'transparent',
                                        border: '1px solid',
                                        borderColor: selectedTcIds.includes(tc.id) ? 'var(--primary)' : 'var(--border)',
                                        transition: 'all 0.15s',
                                        fontSize: 13,
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTcIds.includes(tc.id)}
                                        onChange={() => toggleTc(tc.id)}
                                        style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                                    />
                                    <span style={{ color: 'var(--text-muted)', minWidth: 28, fontWeight: 500 }}>#{idx + 1}</span>
                                    <span style={{ flex: 1, fontWeight: 500 }}>{tc.title}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {(status === 'running' || status === 'paused') && (
                    <div style={{ marginTop: 16 }}>
                        <div className="flex justify-between text-sm text-muted mb-4" style={{ marginBottom: 6 }}>
                            <span>Tiến độ: {progress.done}/{progress.total} test case {status === 'paused' ? '(Đang tạm dừng)' : ''}</span><span>{pct}%</span>
                        </div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: status === 'paused' ? '#f59e0b' : undefined }} /></div>
                    </div>
                )}
            </div>

            {/* Summary */}
            {summary && (
                <div className="kpi-grid" style={{ marginBottom: 20 }}>
                    <div className="kpi-card total"><div className="num">{summary.total}</div><div className="lbl">Tổng</div></div>
                    <div className="kpi-card pass"><div className="num">{summary.passed}</div><div className="lbl">Passed</div></div>
                    <div className="kpi-card fail"><div className="num">{summary.failed}</div><div className="lbl">Failed</div></div>
                    <div className="kpi-card rate"><div className="num">{summary.total > 0 ? Math.round(summary.passed / summary.total * 100) : 0}%</div><div className="lbl">Tỉ lệ Pass</div></div>
                </div>
            )}

            {(status === 'done' || status === 'cancelled') && runId && (
                <div className="flex gap-2 mb-4">
                    <a className="btn btn-outline" href={apiUrl(`/api/reports/${runId}/html`)} target="_blank">📄 Xuất báo cáo HTML</a>
                    <a className="btn btn-ghost" href={apiUrl(`/api/reports/${runId}/pdf`)} target="_blank">📋 Xuất PDF</a>
                    {summary && summary.failed > 0 && (
                        <a className="btn btn-sm" href={apiUrl(`/api/reports/${runId}/failed/html`)} target="_blank"
                            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Bug size={13} /> Export Failed ({summary.failed})
                        </a>
                    )}
                </div>
            )}

            {/* Live test results */}
            <div>
                {tcList.length === 0 && status === 'idle' && (
                    <div className="empty-state"><PlayCircle size={48} /><p>Chọn Dự án, Suite, tick các Test Case cần chạy và nhấn "Bắt đầu chạy" để xem kết quả real-time tại đây</p></div>
                )}
                {tcList.map(([tcId, tc]) => (
                    <div key={tcId} className={`monitor-tc ${tc.status}`}>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {tc.status === 'PASSED' && <CheckCircle size={16} color="var(--success)" />}
                                {tc.status === 'FAILED' && <XCircle size={16} color="var(--danger)" />}
                                {tc.status === 'RUNNING' && <span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>⟳</span>}
                                <strong>{tc.title}</strong>
                            </div>
                            <span className={`badge ${tc.status === 'PASSED' ? 'badge-pass' : tc.status === 'FAILED' ? 'badge-fail' : 'badge-running'}`}>{tc.status}</span>
                        </div>
                        {tc.error && <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, fontSize: 13, color: 'var(--danger)' }}>⚠️ {tc.error}</div>}
                        {tc.steps && tc.steps.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                                {tc.steps.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                        {stepIcon(s.status)}
                                        <span style={{ minWidth: 28, color: 'var(--text-muted)' }}>#{s.step_id}</span>
                                        <code style={{ background: '#f1f5f9', padding: '1px 7px', borderRadius: 4, fontSize: 12 }}>{s.action}</code>
                                        <span style={{ flex: 1 }}>{s.description}</span>
                                        <span className="text-sm text-muted">{s.duration_ms}ms</span>
                                        {s.screenshot && <button className="btn btn-ghost btn-sm" onClick={() => setLightbox(`/${s.screenshot}`)}><Image size={12} /></button>}
                                    </div>
                                ))}
                                {tc.videoPath && <div style={{ marginTop: 8 }}><a href={`/${tc.videoPath}`} target="_blank" className="btn btn-ghost btn-sm">🎬 Xem video</a></div>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
