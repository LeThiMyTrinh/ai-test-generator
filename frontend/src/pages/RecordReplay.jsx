import { useState, useEffect, useRef } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
    Circle, Square, Play, Trash2, ArrowUp, ArrowDown, Save, Eye, Clock,
    Globe, MousePointer, Type, List, Image, Search, CheckCircle, Link,
    Monitor, Smartphone, StopCircle, RefreshCw, X, ChevronDown
} from 'lucide-react'

const ACTIONS = ['navigate', 'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot']

const ACTION_LABELS = {
    navigate: '🌐 Mở trang', click: '👆 Click', fill: '✏️ Nhập', select: '📋 Chọn',
    hover: '🖱️ Di chuột', assert_text: '🔍 Kiểm tra text', assert_visible: '👁️ Kiểm tra hiển thị',
    assert_url: '🔗 Kiểm tra URL', wait: '⏱️ Chờ', screenshot: '📸 Chụp ảnh'
}

const ACTION_ICONS = {
    navigate: Globe, click: MousePointer, fill: Type, select: List,
    hover: MousePointer, assert_text: Search, assert_visible: Eye,
    assert_url: Link, wait: Clock, screenshot: Image
}

const DEVICE_OPTIONS = [
    { value: '', label: '🖥️ Desktop (mặc định)' },
    { value: 'iphone-15', label: '📱 iPhone 15 (390×844)' },
    { value: 'iphone-15-pro', label: '📱 iPhone 15 Pro (393×852)' },
    { value: 'iphone-14', label: '📱 iPhone 14 (390×844)' },
    { value: 'iphone-13', label: '📱 iPhone 13 (390×844)' },
    { value: 'iphone-12', label: '📱 iPhone 12 (390×844)' },
    { value: 'iphone-se', label: '📱 iPhone SE (375×667)' },
    { value: 'pixel-7', label: '📱 Pixel 7 (412×915)' },
    { value: 'pixel-5', label: '📱 Pixel 5 (393×851)' },
    { value: 'galaxy-s24', label: '📱 Galaxy S24 (360×780)' },
    { value: 'galaxy-s9', label: '📱 Galaxy S9+ (320×658)' },
    { value: 'ipad-pro', label: '📟 iPad Pro 11 (834×1194)' },
    { value: 'ipad-mini', label: '📟 iPad Mini (768×1024)' },
    { value: 'galaxy-tab', label: '📟 Galaxy Tab S4 (712×1138)' },
]

export default function RecordReplay({ navigate, ctx }) {
    // Recording state
    const [url, setUrl] = useState('')
    const [recording, setRecording] = useState(false)
    const [sessionId, setSessionId] = useState(null)
    const [liveSteps, setLiveSteps] = useState([])
    const [starting, setStarting] = useState(false)
    const [stopping, setStopping] = useState(false)

    // Review state
    const [reviewMode, setReviewMode] = useState(false)
    const [editSteps, setEditSteps] = useState([])

    // Save as test case state
    const [title, setTitle] = useState('')
    const [browser, setBrowser] = useState('chromium')
    const [device, setDevice] = useState('')
    const [suites, setSuites] = useState([])
    const [suiteId, setSuiteId] = useState('')
    const [saving, setSaving] = useState(false)

    // Active sessions
    const [sessions, setSessions] = useState([])
    const [loadingSessions, setLoadingSessions] = useState(false)

    const liveRef = useRef(null)
    const pollRef = useRef(null)

    // Load suites on mount
    useEffect(() => {
        api.get('/api/test-suites').then(r => setSuites(r.data)).catch(() => {})
        loadSessions()
    }, [])

    // Auto-poll steps while recording; detect browser-side stop
    useEffect(() => {
        if (recording && sessionId) {
            pollRef.current = setInterval(() => {
                api.get(`/api/recorder/steps/${sessionId}`)
                    .then(r => setLiveSteps(r.data.steps || []))
                    .catch(err => {
                        // 404 means session was stopped from the browser control bar
                        if (err.response?.status === 404) {
                            clearInterval(pollRef.current)
                            setRecording(false)
                            // Convert live steps to editable format
                            const steps = liveSteps.map((s, i) => ({
                                step_id: i + 1,
                                action: s.action || 'click',
                                selector: s.selector || '',
                                value: s.value || '',
                                description: s.description || '',
                            }))
                            if (steps.length > 0) {
                                setEditSteps(steps)
                                setReviewMode(true)
                                toast.success(`Ghi dừng từ trình duyệt — ${steps.length} bước`)
                            } else {
                                toast('Phiên ghi đã kết thúc')
                            }
                            loadSessions()
                        }
                    })
            }, 2000)
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [recording, sessionId, liveSteps])

    // Auto-scroll live steps
    useEffect(() => {
        if (liveRef.current) {
            liveRef.current.scrollTop = liveRef.current.scrollHeight
        }
    }, [liveSteps])

    const loadSessions = () => {
        setLoadingSessions(true)
        api.get('/api/recorder/sessions')
            .then(r => setSessions(r.data.sessions || []))
            .catch(() => {})
            .finally(() => setLoadingSessions(false))
    }

    const startRecording = async () => {
        if (!url.trim()) return toast.error('Vui lòng nhập URL cần ghi')
        setStarting(true)
        try {
            const { data } = await api.post('/api/recorder/start', { url: url.trim() })
            setSessionId(data.sessionId)
            setRecording(true)
            setLiveSteps([])
            setReviewMode(false)
            setEditSteps([])
            toast.success('Đã bắt đầu ghi hành động!')
            loadSessions()
        } catch (e) {
            toast.error(e.response?.data?.error || 'Không thể bắt đầu ghi')
        } finally {
            setStarting(false)
        }
    }

    const stopRecording = async (sid) => {
        const targetId = sid || sessionId
        if (!targetId) return
        setStopping(true)
        try {
            const { data } = await api.post('/api/recorder/stop', { sessionId: targetId })
            const steps = (data.steps || []).map((s, i) => ({
                step_id: i + 1,
                action: s.action || 'click',
                selector: s.selector || '',
                value: s.value || '',
                description: s.description || '',
            }))
            if (targetId === sessionId) {
                setRecording(false)
                setEditSteps(steps)
                setReviewMode(true)
                if (pollRef.current) clearInterval(pollRef.current)
                toast.success(`Đã dừng ghi — ${steps.length} bước được ghi nhận`)
            } else {
                toast.success('Đã dừng phiên ghi')
            }
            loadSessions()
        } catch (e) {
            toast.error(e.response?.data?.error || 'Không thể dừng ghi')
        } finally {
            setStopping(false)
        }
    }

    // Edit steps helpers
    const updateStep = (i, field, val) => {
        setEditSteps(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s))
    }
    const removeStep = (i) => {
        setEditSteps(prev => prev.filter((_, j) => j !== i).map((s, j) => ({ ...s, step_id: j + 1 })))
    }
    const moveStep = (i, dir) => {
        setEditSteps(prev => {
            const s = [...prev];
            [s[i], s[i + dir]] = [s[i + dir], s[i]]
            return s.map((st, j) => ({ ...st, step_id: j + 1 }))
        })
    }

    // Save as test case
    const saveAsTestCase = async () => {
        if (!suiteId) return toast.error('Vui lòng chọn bộ kiểm thử')
        if (!title.trim()) return toast.error('Vui lòng nhập tiêu đề')
        if (editSteps.length === 0) return toast.error('Không có bước nào để lưu')
        setSaving(true)
        try {
            await api.post('/api/test-cases', {
                suite_id: suiteId,
                title: title.trim(),
                url: url.trim(),
                browser,
                device,
                steps: editSteps,
            })
            toast.success('Đã lưu thành Test Case!')
            // Reset
            setTitle('')
            setReviewMode(false)
            setEditSteps([])
            setSessionId(null)
            setLiveSteps([])
            setUrl('')
            setBrowser('chromium')
            setDevice('')
            setSuiteId('')
        } catch (e) {
            toast.error(e.response?.data?.error || 'Lỗi khi lưu test case')
        } finally {
            setSaving(false)
        }
    }

    const getActionIcon = (action) => {
        const Icon = ACTION_ICONS[action] || MousePointer
        return <Icon size={14} />
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Circle size={20} style={{ color: recording ? '#ef4444' : 'var(--text-muted)' }} />
                    Ghi & phát lại
                </h2>
                <p className="text-muted" style={{ margin: '4px 0 0' }}>Ghi lại thao tác trên trình duyệt và chuyển thành test case tự động</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
                {/* Main content */}
                <div>
                    {/* Start Recording Panel */}
                    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {recording ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{
                                        width: 10, height: 10, borderRadius: '50%', background: '#ef4444',
                                        animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block'
                                    }} />
                                    Đang ghi...
                                </span>
                            ) : (
                                <>🎬 Bắt đầu ghi hành động</>
                            )}
                        </h3>

                        <div className="flex gap-3 items-end" style={{ flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 280 }}>
                                <label className="form-label">URL trang web</label>
                                <input
                                    className="form-control"
                                    placeholder="https://example.com"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    disabled={recording}
                                    style={{ fontSize: 14 }}
                                />
                            </div>
                            {!recording ? (
                                <button
                                    className="btn"
                                    onClick={startRecording}
                                    disabled={starting}
                                    style={{
                                        background: '#ef4444', color: '#fff', border: 'none',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '10px 20px', fontWeight: 600, marginBottom: 0
                                    }}
                                >
                                    {starting ? <RefreshCw size={15} className="spin" /> : <Circle size={15} fill="#fff" />}
                                    {starting ? 'Đang khởi tạo...' : 'Bắt đầu ghi'}
                                </button>
                            ) : (
                                <button
                                    className="btn"
                                    onClick={() => stopRecording()}
                                    disabled={stopping}
                                    style={{
                                        background: '#1e293b', color: '#fff', border: 'none',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '10px 20px', fontWeight: 600, marginBottom: 0
                                    }}
                                >
                                    {stopping ? <RefreshCw size={15} className="spin" /> : <Square size={15} />}
                                    {stopping ? 'Đang dừng...' : 'Dừng ghi'}
                                </button>
                            )}
                        </div>

                        {recording && sessionId && (
                            <div style={{
                                marginTop: 14, padding: '10px 14px', borderRadius: 8,
                                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                                display: 'flex', alignItems: 'center', gap: 12, fontSize: 13
                            }}>
                                <span className="text-muted">Session:</span>
                                <code style={{ fontSize: 12, background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{sessionId}</code>
                                <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#ef4444' }}>
                                    {liveSteps.length} bước đã ghi
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Live Steps Viewer */}
                    {recording && (
                        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Eye size={16} /> Các bước đang ghi
                                <span className="badge badge-running" style={{ marginLeft: 'auto', fontSize: 11 }}>LIVE</span>
                            </h3>
                            <div
                                ref={liveRef}
                                style={{
                                    maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)',
                                    borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)'
                                }}
                            >
                                {liveSteps.length === 0 ? (
                                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <MousePointer size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                                        Đang chờ hành động từ trình duyệt...
                                    </div>
                                ) : (
                                    liveSteps.map((step, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                                                fontSize: 13
                                            }}
                                        >
                                            <span style={{
                                                width: 26, height: 26, borderRadius: '50%',
                                                background: 'var(--primary)', color: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 11, fontWeight: 700, flexShrink: 0
                                            }}>{i + 1}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', flexShrink: 0 }}>
                                                {getActionIcon(step.action)}
                                                <span style={{ fontWeight: 600, fontSize: 12 }}>{ACTION_LABELS[step.action] || step.action}</span>
                                            </span>
                                            <span style={{ flex: 1, color: 'var(--text-secondary, #475569)' }}>
                                                {step.description || '—'}
                                            </span>
                                            {step.selector && (
                                                <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {step.selector}
                                                </code>
                                            )}
                                            {step.value && (
                                                <span className="badge" style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                                                    {step.value.length > 20 ? step.value.slice(0, 20) + '…' : step.value}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Review & Edit */}
                    {reviewMode && editSteps.length > 0 && (
                        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle size={16} style={{ color: '#22c55e' }} />
                                Xem lại & Chỉnh sửa ({editSteps.length} bước)
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {editSteps.map((step, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '10px 12px', borderRadius: 8,
                                            border: '1px solid var(--border)', background: 'var(--bg-secondary, #f8fafc)',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <span style={{
                                            width: 24, height: 24, borderRadius: '50%',
                                            background: 'var(--primary)', color: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, fontWeight: 700, flexShrink: 0
                                        }}>{i + 1}</span>

                                        <select
                                            className="form-control"
                                            value={step.action}
                                            onChange={e => updateStep(i, 'action', e.target.value)}
                                            style={{ width: 150, fontSize: 13 }}
                                        >
                                            {ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
                                        </select>

                                        <input
                                            className="form-control"
                                            placeholder="Selector"
                                            value={step.selector}
                                            onChange={e => updateStep(i, 'selector', e.target.value)}
                                            style={{ flex: 1, minWidth: 140, fontSize: 13 }}
                                        />

                                        <input
                                            className="form-control"
                                            placeholder="Giá trị"
                                            value={step.value}
                                            onChange={e => updateStep(i, 'value', e.target.value)}
                                            style={{ width: 140, fontSize: 13 }}
                                        />

                                        <input
                                            className="form-control"
                                            placeholder="Mô tả"
                                            value={step.description}
                                            onChange={e => updateStep(i, 'description', e.target.value)}
                                            style={{ flex: 1, minWidth: 140, fontSize: 13 }}
                                        />

                                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => moveStep(i, -1)}
                                                disabled={i === 0}
                                                style={{ padding: 4 }}
                                                title="Di chuyển lên"
                                            ><ArrowUp size={14} /></button>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => moveStep(i, 1)}
                                                disabled={i === editSteps.length - 1}
                                                style={{ padding: 4 }}
                                                title="Di chuyển xuống"
                                            ><ArrowDown size={14} /></button>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => removeStep(i)}
                                                style={{ padding: 4, color: '#ef4444' }}
                                                title="Xóa bước"
                                            ><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Save as Test Case */}
                    {reviewMode && editSteps.length > 0 && (
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Save size={16} /> Lưu thành Test Case
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <div>
                                    <label className="form-label">Tiêu đề test case</label>
                                    <input
                                        className="form-control"
                                        placeholder="VD: Kiểm tra đăng nhập thành công"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">URL</label>
                                    <input
                                        className="form-control"
                                        value={url}
                                        onChange={e => setUrl(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Trình duyệt</label>
                                    <select className="form-control" value={browser} onChange={e => setBrowser(e.target.value)}>
                                        <option value="chromium">Chromium</option>
                                        <option value="firefox">Firefox</option>
                                        <option value="webkit">WebKit (Safari)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Thiết bị</label>
                                    <select className="form-control" value={device} onChange={e => setDevice(e.target.value)}>
                                        {DEVICE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Bộ kiểm thử</label>
                                    <select className="form-control" value={suiteId} onChange={e => setSuiteId(e.target.value)}>
                                        <option value="">-- Chọn bộ kiểm thử --</option>
                                        {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => { setReviewMode(false); setEditSteps([]); setTitle('') }}
                                >
                                    <X size={15} /> Hủy
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={saveAsTestCase}
                                    disabled={saving}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    {saving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                                    {saving ? 'Đang lưu...' : 'Lưu thành Test Case'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar: Active Sessions */}
                <div>
                    <div className="card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h3 style={{ margin: 0, fontSize: 14 }}>Phiên ghi đang hoạt động</h3>
                            <button
                                className="btn btn-ghost"
                                onClick={loadSessions}
                                disabled={loadingSessions}
                                style={{ padding: 4 }}
                                title="Làm mới"
                            >
                                <RefreshCw size={14} className={loadingSessions ? 'spin' : ''} />
                            </button>
                        </div>

                        {sessions.length === 0 ? (
                            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                <Monitor size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                                Không có phiên nào đang ghi
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {sessions.map(s => (
                                    <div
                                        key={s.id}
                                        style={{
                                            padding: '10px 12px', borderRadius: 8,
                                            border: '1px solid var(--border)',
                                            background: s.id === sessionId ? 'rgba(239,68,68,0.04)' : 'transparent',
                                            fontSize: 13
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                            <span style={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                background: '#22c55e', display: 'inline-block', flexShrink: 0
                                            }} />
                                            <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                {s.url}
                                            </span>
                                        </div>
                                        <div className="text-muted" style={{ fontSize: 11, marginBottom: 6 }}>
                                            ID: {s.id.slice(0, 12)}...
                                            {s.startedAt && <> · {new Date(s.startedAt).toLocaleTimeString('vi-VN')}</>}
                                            {s.steps && <> · {s.steps.length} bước</>}
                                        </div>
                                        <button
                                            className="btn"
                                            onClick={() => stopRecording(s.id)}
                                            disabled={stopping}
                                            style={{
                                                background: '#1e293b', color: '#fff', border: 'none',
                                                fontSize: 11, padding: '4px 10px', width: '100%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                                            }}
                                        >
                                            <Square size={11} /> Dừng phiên này
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pulse animation for recording indicator */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
