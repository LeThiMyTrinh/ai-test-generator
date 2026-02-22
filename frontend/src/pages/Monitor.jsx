import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { io } from 'socket.io-client'
import { PlayCircle, CheckCircle, XCircle, Clock, Image } from 'lucide-react'

let socket = null

export default function Monitor({ navigate, ctx }) {
    const { suite_id, suite_name } = ctx || {}
    const [suites, setSuites] = useState([])
    const [selectedSuite, setSelectedSuite] = useState(suite_id || '')
    const [runId, setRunId] = useState(null)
    const [status, setStatus] = useState('idle') // idle | running | done | error
    const [tcResults, setTcResults] = useState({}) // tcId -> { title, status, steps: [] }
    const [summary, setSummary] = useState(null)
    const [progress, setProgress] = useState({ done: 0, total: 0 })
    const [lightbox, setLightbox] = useState(null)
    const logRef = useRef()

    useEffect(() => {
        axios.get('/api/test-suites').then(r => setSuites(r.data))
        socket = io(window.location.origin)
        socket.on('tc_start', ({ tcId, title }) => {
            setTcResults(p => ({ ...p, [tcId]: { title, status: 'RUNNING', steps: [] } }))
        })
        socket.on('step_done', ({ tcId, step }) => {
            setTcResults(p => ({ ...p, [tcId]: { ...p[tcId], steps: [...(p[tcId]?.steps || []), step] } }))
        })
        socket.on('tc_done', ({ tcId, result }) => {
            setTcResults(p => ({ ...p, [tcId]: { ...p[tcId], status: result.status, error: result.error_message, videoPath: result.video_path } }))
            setProgress(p => ({ ...p, done: p.done + 1 }))
        })
        socket.on('run_done', ({ summary }) => { setSummary(summary); setStatus('done') })
        socket.on('run_error', ({ error }) => { toast.error(error); setStatus('error') })
        return () => socket?.disconnect()
    }, [])

    const startRun = async () => {
        if (!selectedSuite) return toast.error('Chọn Suite trước')
        const suite = suites.find(s => s.id === selectedSuite)
        if (suite && suite.tc_count === 0) return toast.error('Suite chưa có test case')
        setTcResults({}); setSummary(null); setStatus('running'); setProgress({ done: 0, total: suite?.tc_count || 0 })
        try {
            const r = await axios.post('/api/runs', { suite_id: selectedSuite })
            setRunId(r.data.run_id)
            toast.success('Đã bắt đầu chạy test!')
        } catch (e) { toast.error(e.response?.data?.error || 'Lỗi'); setStatus('idle') }
    }

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
                <div className="flex gap-3 items-center">
                    <div style={{ flex: 1 }}>
                        <label className="form-label">Chọn Test Suite để chạy</label>
                        <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)} disabled={status === 'running'}>
                            <option value="">-- Chọn Suite --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.tc_count} TC)</option>)}
                        </select>
                    </div>
                    <div style={{ marginTop: 22 }}>
                        <button className="btn btn-success" onClick={startRun} disabled={status === 'running' || !selectedSuite}>
                            <PlayCircle size={17} /> {status === 'running' ? 'Đang chạy...' : 'Bắt đầu chạy'}
                        </button>
                    </div>
                </div>

                {status === 'running' && (
                    <div style={{ marginTop: 16 }}>
                        <div className="flex justify-between text-sm text-muted mb-4" style={{ marginBottom: 6 }}>
                            <span>Tiến độ: {progress.done}/{progress.total} test case</span><span>{pct}%</span>
                        </div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
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

            {status === 'done' && runId && (
                <div className="flex gap-2 mb-4">
                    <a className="btn btn-outline" href={`/api/reports/${runId}/html`} target="_blank">📄 Xuất báo cáo HTML</a>
                    <a className="btn btn-ghost" href={`/api/reports/${runId}/pdf`} target="_blank">📋 Xuất PDF</a>
                </div>
            )}

            {/* Live test results */}
            <div>
                {tcList.length === 0 && status === 'idle' && (
                    <div className="empty-state"><PlayCircle size={48} /><p>Chọn suite và nhấn "Bắt đầu chạy" để xem kết quả real-time tại đây</p></div>
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
