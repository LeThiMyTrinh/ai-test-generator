import { useState, useEffect } from 'react'
import api, { apiUrl } from '../api/client'
import {
    Zap, Loader2, Play, History, Download, Trash2, ChevronDown, ChevronRight,
    Users, Clock, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
    ExternalLink, Activity, Gauge, TrendingUp, ShieldAlert, Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import io from 'socket.io-client'

// ========== HELPERS ==========

function formatMs(ms) {
    if (ms == null || isNaN(ms)) return 'N/A'
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

function formatSec(s) {
    return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`
}

const VERDICT_CONFIG = {
    PASS: { color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2, label: 'Đạt' },
    WARN: { color: '#ca8a04', bg: '#fefce8', icon: AlertTriangle, label: 'Cảnh báo' },
    FAIL: { color: '#dc2626', bg: '#fef2f2', icon: XCircle, label: 'Không đạt' },
}

const SEV_CONFIG = {
    CRITICAL: { color: '#991b1b', bg: '#fee2e2' },
    HIGH: { color: '#c2410c', bg: '#fff7ed' },
    MEDIUM: { color: '#a16207', bg: '#fefce8' },
    LOW: { color: '#15803d', bg: '#f0fdf4' },
}

// ========== MAIN ==========

export default function LoadTesting() {
    const [activeTab, setActiveTab] = useState('run')
    const [url, setUrl] = useState('')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [showLogin, setShowLogin] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(null)
    const [result, setResult] = useState(null)

    // Config from backend
    const [testCasesConfig, setTestCasesConfig] = useState([])
    const [sloPresets, setSloPresets] = useState({})
    const [selectedTCs, setSelectedTCs] = useState(['smoke', 'load-light', 'load-medium', 'stress', 'spike'])
    const [sloPreset, setSloPreset] = useState('strict')
    const [customSLO, setCustomSLO] = useState({ p95Ms: 1000, p99Ms: 2000, errorRatePct: 1 })

    // History
    const [historyList, setHistoryList] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Load config on mount
    useEffect(() => {
        api.get('/api/ai/load-test/config').then(({ data }) => {
            setTestCasesConfig(data.testCases || [])
            setSloPresets(data.sloPresets || {})
        }).catch(() => toast.error('Không tải được config load test'))
    }, [])

    // Socket for progress
    useEffect(() => {
        const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api$/, '').replace(/\/$/, '') || window.location.origin
        const socket = io(baseUrl)
        socket.on('load-test-progress', (data) => setProgress(data))
        return () => socket.disconnect()
    }, [])

    const runTest = async () => {
        if (!url) return toast.error('Vui lòng nhập URL')
        if (!confirmed) return toast.error('Vui lòng xác nhận quyền test trên target')

        setLoading(true)
        setProgress({ phase: 'init', step: 0, total: 1, message: 'Đang bắt đầu...' })
        setResult(null)

        try {
            const { data } = await api.post('/api/ai/load-test', {
                url,
                selectedTestCases: selectedTCs,
                sloPreset,
                customSLO: sloPreset === 'custom' ? customSLO : undefined,
                loginEmail: showLogin ? loginEmail : undefined,
                loginPassword: showLogin ? loginPassword : undefined,
                confirmedNotProd: true,
            }, { timeout: 600000 }) // 10 phút max

            setResult(data)
            setActiveTab('report')
            toast.success(`Hoàn tất! Verdict: ${data.verdict}`)
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
            setProgress(null)
        }
    }

    const toggleTC = (id) => {
        const tc = testCasesConfig.find(t => t.id === id)
        if (tc?.required) return  // Smoke always required
        setSelectedTCs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const loadHistory = async () => {
        setHistoryLoading(true)
        try {
            const { data } = await api.get('/api/ai/load-test-history', { params: { limit: 30 } })
            setHistoryList(data.records || [])
        } catch (err) {
            toast.error('Lỗi tải lịch sử')
        } finally {
            setHistoryLoading(false)
        }
    }

    const loadHistoryDetail = async (id) => {
        setLoading(true)
        try {
            const { data } = await api.get(`/api/ai/load-test-history/${id}`)
            setResult(data.result || data)
            setUrl(data.url)
            setActiveTab('report')
        } catch (err) {
            toast.error('Lỗi tải chi tiết')
        } finally {
            setLoading(false)
        }
    }

    const deleteHistory = async (id) => {
        try {
            await api.delete(`/api/ai/load-test-history/${id}`)
            setHistoryList(prev => prev.filter(r => r._id !== id))
            toast.success('Đã xóa')
        } catch (err) {
            toast.error('Lỗi xóa')
        }
    }

    useEffect(() => {
        if (activeTab === 'history') loadHistory()
    }, [activeTab])

    const TABS = [
        { id: 'run', label: 'Chạy test', Icon: Play },
        { id: 'report', label: 'Báo cáo', Icon: Gauge, disabled: !result },
        { id: 'history', label: 'Lịch sử', Icon: History },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
                {TABS.map(({ id, label, Icon, disabled }) => (
                    <button
                        key={id}
                        onClick={() => !disabled && setActiveTab(id)}
                        disabled={disabled}
                        className={`btn ${activeTab === id ? 'btn-primary' : ''}`}
                        style={{ borderRadius: '8px 8px 0 0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', opacity: disabled ? 0.4 : 1 }}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {activeTab === 'run' && (
                <RunTab
                    url={url} setUrl={setUrl}
                    showLogin={showLogin} setShowLogin={setShowLogin}
                    loginEmail={loginEmail} setLoginEmail={setLoginEmail}
                    loginPassword={loginPassword} setLoginPassword={setLoginPassword}
                    testCasesConfig={testCasesConfig}
                    selectedTCs={selectedTCs} toggleTC={toggleTC}
                    sloPresets={sloPresets}
                    sloPreset={sloPreset} setSloPreset={setSloPreset}
                    customSLO={customSLO} setCustomSLO={setCustomSLO}
                    confirmed={confirmed} setConfirmed={setConfirmed}
                    loading={loading} progress={progress}
                    onRun={runTest}
                />
            )}

            {activeTab === 'report' && <ReportTab result={result} />}

            {activeTab === 'history' && (
                <HistoryTab
                    list={historyList}
                    loading={historyLoading}
                    onLoad={loadHistoryDetail}
                    onDelete={deleteHistory}
                    onRefresh={loadHistory}
                />
            )}
        </div>
    )
}

// ========== RUN TAB ==========

function RunTab({
    url, setUrl, showLogin, setShowLogin, loginEmail, setLoginEmail, loginPassword, setLoginPassword,
    testCasesConfig, selectedTCs, toggleTC,
    sloPresets, sloPreset, setSloPreset, customSLO, setCustomSLO,
    confirmed, setConfirmed, loading, progress, onRun
}) {
    const totalDuration = testCasesConfig
        .filter(t => selectedTCs.includes(t.id))
        .reduce((s, tc) => {
            const d = tc.config.duration || (tc.config.phases || []).reduce((ss, p) => ss + p.duration, 0)
            return s + d + 5
        }, 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* URL */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>1. URL mục tiêu</h3>
                <input
                    className="input"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://your-staging-server.com"
                    disabled={loading}
                />
                <button
                    className="btn"
                    style={{ fontSize: 12, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setShowLogin(!showLogin)}
                    disabled={loading}
                >
                    {showLogin ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Auto-login (nếu cần session)
                </button>
                {showLogin && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <input className="input" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email" style={{ flex: 1 }} />
                        <input className="input" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Mật khẩu" style={{ flex: 1 }} />
                    </div>
                )}
            </div>

            {/* Test cases */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>2. Chọn test case</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {testCasesConfig.map(tc => {
                        const selected = selectedTCs.includes(tc.id)
                        const vu = tc.config.connections || tc.config.maxConnections
                        const dur = tc.config.duration || (tc.config.phases || []).reduce((s, p) => s + p.duration, 0)
                        return (
                            <label key={tc.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                                borderRadius: 8, cursor: tc.required ? 'default' : 'pointer',
                                background: selected ? 'var(--primary-bg, rgba(59,130,246,0.05))' : 'transparent',
                                opacity: tc.required ? 0.9 : 1,
                            }}>
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={tc.required || loading}
                                    onChange={() => toggleTC(tc.id)}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {tc.name}
                                        {tc.required && <span style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 3 }}>BẮT BUỘC</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{tc.description}</div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>
                                    <div><Users size={11} style={{ verticalAlign: '-2px' }} /> {vu} VU{tc.config.mode && ` (${tc.config.mode})`}</div>
                                    <div><Clock size={11} style={{ verticalAlign: '-2px' }} /> {dur}s</div>
                                </div>
                            </label>
                        )
                    })}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <Info size={12} style={{ verticalAlign: '-2px' }} /> Tổng thời gian ước tính: <strong>{formatSec(totalDuration)}</strong>
                </div>
            </div>

            {/* SLO */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>3. Tiêu chí đạt (SLO)</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                    {Object.values(sloPresets).map(preset => (
                        <button
                            key={preset.key}
                            className={`btn ${sloPreset === preset.key ? 'btn-primary' : ''}`}
                            onClick={() => setSloPreset(preset.key)}
                            disabled={loading}
                            style={{ fontSize: 12, flex: 1 }}
                        >
                            <div style={{ fontWeight: 700 }}>{preset.label}</div>
                            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>
                                p95 &lt; {preset.p95Ms}ms | err &lt; {preset.errorRatePct}%
                            </div>
                        </button>
                    ))}
                    <button
                        className={`btn ${sloPreset === 'custom' ? 'btn-primary' : ''}`}
                        onClick={() => setSloPreset('custom')}
                        disabled={loading}
                        style={{ fontSize: 12, flex: 1 }}
                    >
                        <div style={{ fontWeight: 700 }}>Custom</div>
                        <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>Tự nhập</div>
                    </button>
                </div>
                {sloPreset === 'custom' && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>p95 (ms)</label>
                            <input className="input" type="number" value={customSLO.p95Ms} onChange={e => setCustomSLO({ ...customSLO, p95Ms: +e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>p99 (ms)</label>
                            <input className="input" type="number" value={customSLO.p99Ms} onChange={e => setCustomSLO({ ...customSLO, p99Ms: +e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Error rate (%)</label>
                            <input className="input" type="number" step="0.1" value={customSLO.errorRatePct} onChange={e => setCustomSLO({ ...customSLO, errorRatePct: +e.target.value })} />
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm + Run */}
            <div className="card" style={{ padding: 20, background: 'rgba(254, 243, 199, 0.3)', borderColor: '#fde68a' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <ShieldAlert size={20} style={{ color: '#ca8a04', flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Cảnh báo an toàn</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Load test tạo ra lưu lượng cao, về mặt kỹ thuật tương tự tấn công DoS. Chỉ chạy trên môi trường bạn sở hữu hoặc được phép.
                        </div>
                        <label style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={loading} />
                            Tôi xác nhận tôi sở hữu hoặc được phép load test URL trên
                        </label>
                    </div>
                </div>
            </div>

            <button
                className="btn btn-primary"
                onClick={onRun}
                disabled={loading || !url || !confirmed}
                style={{ padding: '12px 20px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
            >
                {loading ? <Loader2 size={18} className="spin" /> : <Play size={18} />}
                {loading ? 'Đang chạy test...' : 'Bắt đầu kiểm thử hiệu năng'}
            </button>

            {progress && loading && (
                <div className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Activity size={14} className="spin" style={{ animationDuration: '2s' }} />
                            {progress.message}
                        </span>
                        {progress.total > 0 && <span>{progress.step || 0}/{progress.total}</span>}
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${((progress.step || 0) / Math.max(progress.total || 1, 1)) * 100}%`,
                            background: 'var(--primary)', borderRadius: 3, transition: 'width 0.3s'
                        }} />
                    </div>
                    {progress.subPhase && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                            Pha {progress.subPhase.phaseIndex + 1}/{progress.subPhase.totalPhases}: {progress.subPhase.connections} VU × {progress.subPhase.duration}s
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ========== REPORT TAB ==========

function ReportTab({ result }) {
    if (!result) return <EmptyState message="Chưa có kết quả. Vui lòng chạy test ở tab 'Chạy test'." />

    const verdict = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.FAIL
    const VerdictIcon = verdict.icon

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Verdict overview */}
            <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: verdict.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <VerdictIcon size={48} />
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: verdict.color }}>{verdict.label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                            {result.url}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                            {result.capacity > 0 && (
                                <div>🎯 Sức chịu tải ước tính: <strong style={{ color: 'var(--text-primary)' }}>{result.capacity} concurrent users</strong></div>
                            )}
                            {result.breakpoint && (
                                <div>💥 Điểm gãy: <strong style={{ color: '#dc2626' }}>~{result.breakpoint} VU</strong></div>
                            )}
                            {result.slo && (
                                <div>📏 SLO: p95 &lt; {formatMs(result.slo.p95Ms)} | err &lt; {result.slo.errorRatePct}%</div>
                            )}
                            <div>⏱ Tổng thời gian: {formatMs(result.durationMs)}</div>
                        </div>
                    </div>
                    {result._historyId && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <a className="btn" href={apiUrl(`/api/ai/load-test-history/${result._historyId}/html`)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Download size={13} /> HTML
                            </a>
                            <a className="btn" href={apiUrl(`/api/ai/load-test-history/${result._historyId}/pdf`)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Download size={13} /> PDF
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <StatCard label="Test case" value={result.summary?.totalTestCases || 0} icon={<Activity size={16} />} />
                <StatCard label="Pass" value={result.summary?.passedCount || 0} color="#16a34a" icon={<CheckCircle2 size={16} />} />
                <StatCard label="Fail" value={result.summary?.failedCount || 0} color={result.summary?.failedCount > 0 ? '#dc2626' : '#16a34a'} icon={<XCircle size={16} />} />
                <StatCard label="Peak RPS" value={Math.round(result.summary?.peakRps || 0)} icon={<TrendingUp size={16} />} />
                <StatCard label="Worst p95" value={formatMs(result.summary?.worstP95)} icon={<Clock size={16} />} />
                <StatCard label="Bottleneck" value={result.bottlenecks?.length || 0} color={(result.bottlenecks?.length || 0) > 0 ? '#dc2626' : '#16a34a'} icon={<AlertTriangle size={16} />} />
            </div>

            {/* Test case table */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Kết quả từng test case</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 700 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '8px' }}>Test case</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>VU</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>Duration</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>RPS</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>p50</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>p95</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>p99</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>Error%</th>
                                <th style={{ textAlign: 'center', padding: '8px' }}>Verdict</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(result.testCases || []).map((tc, i) => (
                                <TestCaseRow key={i} tc={tc} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* p95 bar chart */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>So sánh latency p95</h3>
                <P95BarChart testCases={result.testCases || []} slo={result.slo} />
            </div>

            {/* Bottlenecks */}
            {(result.bottlenecks?.length > 0) && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={16} /> Bottleneck phát hiện ({result.bottlenecks.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.bottlenecks.map((bn, i) => <BottleneckCard key={i} bn={bn} />)}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            {(result.recommendations?.length > 0) && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={16} /> Khuyến nghị chung
                    </h3>
                    {result.recommendations.map((rec, i) => (
                        <div key={i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{rec.title}</div>
                            {rec.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{rec.description}</div>}
                            {rec.suggestions?.length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                                    {rec.suggestions.map((s, j) => <li key={j} style={{ marginBottom: 3 }}>{s}</li>)}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function TestCaseRow({ tc }) {
    const [expanded, setExpanded] = useState(false)
    const hasMetrics = !!tc.metrics
    const pass = tc.sloCheck?.pass
    const err = tc.metrics?.errorRate || 0

    return (
        <>
            <tr style={{ borderBottom: '1px solid var(--border)', cursor: hasMetrics ? 'pointer' : 'default' }} onClick={() => hasMetrics && setExpanded(!expanded)}>
                <td style={{ padding: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{tc.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{tc.description}</div>
                </td>
                <td style={{ textAlign: 'right', padding: '8px' }}>
                    {tc.config?.connections || '—'}
                    {tc.config?.mode && tc.config.mode !== 'steady' && <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{tc.config.mode}</div>}
                </td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{tc.config?.duration || '—'}s</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{hasMetrics ? Math.round(tc.metrics.rps) : '—'}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{hasMetrics ? formatMs(tc.metrics.latency.p50) : '—'}</td>
                <td style={{ textAlign: 'right', padding: '8px', fontWeight: 600 }}>{hasMetrics ? formatMs(tc.metrics.latency.p95) : '—'}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{hasMetrics ? formatMs(tc.metrics.latency.p99) : '—'}</td>
                <td style={{ textAlign: 'right', padding: '8px', color: err > 1 ? '#dc2626' : 'var(--text-primary)' }}>{hasMetrics ? err.toFixed(2) + '%' : '—'}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>
                    <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontSize: 10, fontWeight: 700,
                        background: pass ? '#dcfce7' : '#fee2e2',
                        color: pass ? '#15803d' : '#991b1b',
                    }}>
                        {pass ? 'PASS' : 'FAIL'}
                    </span>
                </td>
            </tr>
            {expanded && hasMetrics && (
                <tr>
                    <td colSpan={9} style={{ padding: 12, background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 11 }}>
                            <div><strong>Total requests:</strong> {tc.metrics.totalRequests}</div>
                            <div><strong>Success 2xx:</strong> {tc.metrics.success2xx}</div>
                            <div><strong>Non-2xx:</strong> {tc.metrics.non2xx}</div>
                            <div><strong>Timeouts:</strong> <span style={{ color: tc.metrics.errors.timeouts > 0 ? '#dc2626' : 'inherit' }}>{tc.metrics.errors.timeouts}</span></div>
                            <div><strong>Connection resets:</strong> <span style={{ color: tc.metrics.errors.resets > 0 ? '#dc2626' : 'inherit' }}>{tc.metrics.errors.resets}</span></div>
                            <div><strong>5xx:</strong> <span style={{ color: tc.metrics.errors.server5xx > 0 ? '#dc2626' : 'inherit' }}>{tc.metrics.errors.server5xx}</span></div>
                            <div><strong>4xx:</strong> <span style={{ color: tc.metrics.errors.client4xx > 0 ? '#ca8a04' : 'inherit' }}>{tc.metrics.errors.client4xx}</span></div>
                            <div><strong>Mean latency:</strong> {formatMs(tc.metrics.latency.mean)}</div>
                            <div><strong>Max latency:</strong> {formatMs(tc.metrics.latency.max)}</div>
                        </div>
                        {!pass && tc.sloCheck?.reasons && (
                            <div style={{ marginTop: 10, padding: 10, background: '#fef2f2', borderRadius: 6, fontSize: 11, color: '#991b1b' }}>
                                <strong>Lý do FAIL:</strong> {tc.sloCheck.reasons.join(' • ')}
                            </div>
                        )}
                        {tc.phases?.length > 1 && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Chi tiết các pha:</div>
                                <table style={{ width: '100%', fontSize: 10 }}>
                                    <thead>
                                        <tr><th style={{ textAlign: 'left' }}>Pha</th><th style={{ textAlign: 'right' }}>VU</th><th style={{ textAlign: 'right' }}>Duration</th><th style={{ textAlign: 'right' }}>RPS</th><th style={{ textAlign: 'right' }}>p95</th><th style={{ textAlign: 'right' }}>Errors</th></tr>
                                    </thead>
                                    <tbody>
                                        {tc.phases.map((p, i) => (
                                            <tr key={i}><td>{i + 1}</td><td style={{ textAlign: 'right' }}>{p.connections}</td><td style={{ textAlign: 'right' }}>{p.duration}s</td><td style={{ textAlign: 'right' }}>{Math.round(p.rps)}</td><td style={{ textAlign: 'right' }}>{formatMs(p.p95)}</td><td style={{ textAlign: 'right', color: p.errors > 0 ? '#dc2626' : 'inherit' }}>{p.errors}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    )
}

function P95BarChart({ testCases, slo }) {
    const valid = testCases.filter(t => t.metrics)
    if (valid.length === 0) return <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Không có dữ liệu</div>
    const max = Math.max(1, ...valid.map(t => t.metrics.latency.p95))
    const sloLine = slo?.p95Ms
    const sloPct = sloLine ? (sloLine / max) * 100 : null

    return (
        <div style={{ position: 'relative' }}>
            {sloPct && sloPct < 100 && (
                <div style={{ position: 'absolute', left: `calc(${140}px + ${sloPct}%)`, top: 0, bottom: 30, width: 1, borderLeft: '2px dashed #dc2626', zIndex: 1, marginLeft: 8 }}>
                    <div style={{ position: 'absolute', top: -16, left: -30, fontSize: 10, color: '#dc2626', whiteSpace: 'nowrap' }}>SLO p95 &lt; {formatMs(sloLine)}</div>
                </div>
            )}
            {valid.map((tc, i) => {
                const pct = (tc.metrics.latency.p95 / max) * 100
                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0', fontSize: 12 }}>
                        <div style={{ minWidth: 140 }}>{tc.name}</div>
                        <div style={{ flex: 1, height: 22, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: tc.sloCheck?.pass ? '#16a34a' : '#dc2626', borderRadius: 4, transition: 'width 0.6s' }} />
                        </div>
                        <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 600, color: tc.sloCheck?.pass ? '#16a34a' : '#dc2626' }}>
                            {formatMs(tc.metrics.latency.p95)}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function BottleneckCard({ bn }) {
    const [open, setOpen] = useState(false)
    const cfg = SEV_CONFIG[bn.severity] || SEV_CONFIG.MEDIUM

    return (
        <div style={{
            padding: '12px 14px', borderRadius: 8,
            borderLeft: `4px solid ${cfg.color}`,
            background: cfg.bg, border: '1px solid var(--border)',
            cursor: 'pointer',
        }} onClick={() => setOpen(!open)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: cfg.color, color: '#fff',
                    }}>{bn.severity}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{bn.title}</span>
                </div>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                <strong>Bằng chứng:</strong> {bn.evidence}
            </div>
            {open && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                    <div style={{ marginBottom: 6 }}><strong>Nguyên nhân:</strong> {bn.cause}</div>
                    {bn.recommendations?.length > 0 && (
                        <div>
                            <strong>Khuyến nghị:</strong>
                            <ul style={{ margin: '4px 0 0 20px' }}>
                                {bn.recommendations.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ========== HISTORY TAB ==========

function HistoryTab({ list, loading, onLoad, onDelete, onRefresh }) {
    return (
        <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Lịch sử Load Testing</h3>
                <button className="btn" onClick={onRefresh} disabled={loading} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
                </button>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}><Loader2 size={20} className="spin" /> Đang tải...</div>}
            {!loading && list.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có lịch sử</div>
            )}

            {list.map(r => {
                const v = VERDICT_CONFIG[r.verdict] || VERDICT_CONFIG.FAIL
                const VIcon = v.icon
                return (
                    <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: '50%', background: v.color,
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <VIcon size={22} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{r.url}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <span>{new Date(r.created_at).toLocaleString('vi-VN')}</span>
                                {r.capacity > 0 && <span>🎯 {r.capacity} VU</span>}
                                {r.breakpoint && <span style={{ color: '#dc2626' }}>💥 ~{r.breakpoint} VU</span>}
                                <span style={{ color: v.color, fontWeight: 600 }}>{v.label}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn" onClick={() => onLoad(r._id)} title="Xem chi tiết" style={{ fontSize: 11, padding: '4px 8px' }}>
                                <ExternalLink size={13} />
                            </button>
                            <a className="btn" href={apiUrl(`/api/ai/load-test-history/${r._id}/html`)} target="_blank" rel="noopener noreferrer" title="Xuất HTML" style={{ fontSize: 11, padding: '4px 8px' }}>
                                <Download size={13} />
                            </a>
                            <button className="btn" onClick={() => onDelete(r._id)} title="Xóa" style={{ fontSize: 11, padding: '4px 8px', color: '#dc2626' }}>
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ========== SHARED ==========

function StatCard({ icon, label, value, color }) {
    return (
        <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--text-secondary)' }}>
                {icon}
                <span style={{ fontSize: 11 }}>{label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
        </div>
    )
}

function EmptyState({ message }) {
    return (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Gauge size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
        </div>
    )
}
