import { useState, useEffect, useRef } from 'react'
import api, { apiUrl } from '../api/client'
import {
    Gauge, Loader2, Play, History, Download, Trash2, ChevronDown, ChevronRight,
    Globe, Wifi, Cpu, HardDrive, Clock, AlertTriangle, CheckCircle2, XCircle,
    Monitor, Smartphone, RefreshCw, FileText, Zap, BarChart3, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import io from 'socket.io-client'

// ========== CONFIGS ==========

const RATING_CONFIG = {
    good: { color: '#16a34a', bg: '#f0fdf4', label: 'Tot' },
    'needs-improvement': { color: '#ca8a04', bg: '#fefce8', label: 'Can cai thien' },
    poor: { color: '#dc2626', bg: '#fef2f2', label: 'Kem' },
}

const SEVERITY_CONFIG = {
    CRITICAL: { color: '#991b1b', bg: '#fee2e2', label: 'Nghiem trong' },
    HIGH: { color: '#c2410c', bg: '#fff7ed', label: 'Cao' },
    MEDIUM: { color: '#a16207', bg: '#fefce8', label: 'Trung binh' },
    LOW: { color: '#15803d', bg: '#f0fdf4', label: 'Thap' },
}

const METRIC_LABELS = {
    LCP: { name: 'Largest Contentful Paint', desc: 'Thoi gian render phan tu lon nhat', icon: '🖼️' },
    FCP: { name: 'First Contentful Paint', desc: 'Thoi gian render noi dung dau tien', icon: '🎨' },
    CLS: { name: 'Cumulative Layout Shift', desc: 'Do dich chuyen layout', icon: '📐' },
    TBT: { name: 'Total Blocking Time', desc: 'Thoi gian JS block main thread', icon: '⏱️' },
    TTFB: { name: 'Time to First Byte', desc: 'Thoi gian phan hoi tu server', icon: '🌐' },
}

const RESOURCE_TYPE_LABELS = {
    script: { label: 'JavaScript', color: '#f59e0b' },
    css: { label: 'CSS', color: '#3b82f6' },
    link: { label: 'CSS (link)', color: '#3b82f6' },
    img: { label: 'Images', color: '#10b981' },
    font: { label: 'Fonts', color: '#8b5cf6' },
    fetch: { label: 'Fetch/XHR', color: '#ec4899' },
    xmlhttprequest: { label: 'XHR', color: '#ec4899' },
    other: { label: 'Other', color: '#6b7280' },
}

// ========== HELPERS ==========

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatMs(ms) {
    if (ms == null || isNaN(ms)) return 'N/A'
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

function getScoreColor(score) {
    if (score >= 90) return '#16a34a'
    if (score >= 50) return '#ca8a04'
    return '#dc2626'
}

function getRatingColor(rating) {
    return RATING_CONFIG[rating]?.color || '#6b7280'
}

// ========== MAIN COMPONENT ==========

export default function PerformanceTesting() {
    const [activeTab, setActiveTab] = useState('overview')
    const [url, setUrl] = useState('')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [showLogin, setShowLogin] = useState(false)
    const [viewports, setViewports] = useState(['desktop', 'mobile'])
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(null)
    const [result, setResult] = useState(null)
    const [selectedViewport, setSelectedViewport] = useState('desktop')

    // History
    const [historyList, setHistoryList] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Socket.IO for progress
    useEffect(() => {
        const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api$/, '').replace(/\/$/, '') || window.location.origin
        const socket = io(baseUrl)
        socket.on('performance-progress', (data) => {
            setProgress(data)
        })
        return () => socket.disconnect()
    }, [])

    const runTest = async () => {
        if (!url) return toast.error('Vui long nhap URL')
        setLoading(true)
        setProgress({ step: 0, total: 7, message: 'Dang bat dau...' })
        setResult(null)

        try {
            const { data } = await api.post('/api/ai/performance-test', {
                url,
                loginEmail: showLogin ? loginEmail : undefined,
                loginPassword: showLogin ? loginPassword : undefined,
                viewports,
            }, { timeout: 120000 })

            setResult(data)
            setSelectedViewport(viewports[0] || 'desktop')
            toast.success(`Hoan tat! Diem: ${data.score}/100`)
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
            setProgress(null)
        }
    }

    const loadHistory = async () => {
        setHistoryLoading(true)
        try {
            const { data } = await api.get('/api/ai/performance-history', { params: { limit: 30 } })
            setHistoryList(data.records || [])
        } catch (err) {
            toast.error('Loi tai lich su')
        } finally {
            setHistoryLoading(false)
        }
    }

    const loadHistoryDetail = async (id) => {
        setLoading(true)
        try {
            const { data } = await api.get(`/api/ai/performance-history/${id}`)
            if (data.result) {
                setResult(data.result)
                const vps = Object.keys(data.result.viewports || {})
                setSelectedViewport(vps[0] || 'desktop')
                setUrl(data.url || '')
                setActiveTab('overview')
            }
        } catch (err) {
            toast.error('Loi tai chi tiet')
        } finally {
            setLoading(false)
        }
    }

    const deleteHistory = async (id) => {
        try {
            await api.delete(`/api/ai/performance-history/${id}`)
            setHistoryList(prev => prev.filter(r => r._id !== id))
            toast.success('Da xoa')
        } catch (err) {
            toast.error('Loi xoa ban ghi')
        }
    }

    useEffect(() => {
        if (activeTab === 'history') loadHistory()
    }, [activeTab])

    const vpData = result?.viewports?.[selectedViewport] || {}

    // ========== TABS ==========
    const TABS = [
        { id: 'overview', label: 'Tong quan', Icon: Gauge },
        { id: 'web-vitals', label: 'Web Vitals', Icon: Zap },
        { id: 'resources', label: 'Tai nguyen', Icon: HardDrive },
        { id: 'network', label: 'Mang', Icon: Wifi },
        { id: 'runtime', label: 'Runtime', Icon: Cpu },
        { id: 'history', label: 'Lich su', Icon: History },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Input Section */}
            <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 300 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block', color: 'var(--text-secondary)' }}>URL trang web</label>
                        <input
                            className="input"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            onKeyDown={e => e.key === 'Enter' && !loading && runTest()}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="checkbox" checked={viewports.includes('desktop')} onChange={() => {
                                setViewports(v => v.includes('desktop') ? v.filter(x => x !== 'desktop') : [...v, 'desktop'])
                            }} />
                            <Monitor size={14} /> Desktop
                        </label>
                        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="checkbox" checked={viewports.includes('mobile')} onChange={() => {
                                setViewports(v => v.includes('mobile') ? v.filter(x => x !== 'mobile') : [...v, 'mobile'])
                            }} />
                            <Smartphone size={14} /> Mobile
                        </label>
                    </div>

                    <button
                        className="btn"
                        style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowLogin(!showLogin)}
                    >
                        {showLogin ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Auto-login
                    </button>

                    <button
                        className="btn btn-primary"
                        onClick={runTest}
                        disabled={loading || viewports.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        {loading ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                        {loading ? 'Dang kiem tra...' : 'Bat dau kiem tra'}
                    </button>
                </div>

                {showLogin && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <input className="input" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email dang nhap" style={{ flex: 1 }} />
                        <input className="input" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Mat khau" style={{ flex: 1 }} />
                    </div>
                )}

                {progress && loading && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            <span>{progress.message}</span>
                            <span>{progress.step}/{progress.total}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(progress.step / progress.total) * 100}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`btn ${activeTab === id ? 'btn-primary' : ''}`}
                        style={{ borderRadius: '8px 8px 0 0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {/* Viewport selector (when result exists) */}
            {result && activeTab !== 'history' && Object.keys(result.viewports || {}).length > 1 && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {Object.keys(result.viewports).map(vp => (
                        <button
                            key={vp}
                            className={`btn ${selectedViewport === vp ? 'btn-primary' : ''}`}
                            onClick={() => setSelectedViewport(vp)}
                            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            {vp === 'desktop' ? <Monitor size={14} /> : <Smartphone size={14} />}
                            {vp === 'desktop' ? 'Desktop' : 'Mobile'}
                            {result.viewports[vp]?.score != null && (
                                <span style={{ color: getScoreColor(result.viewports[vp].score), fontWeight: 700 }}>
                                    {result.viewports[vp].score}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'overview' && <OverviewTab result={result} vpData={vpData} />}
            {activeTab === 'web-vitals' && <WebVitalsTab result={result} vpData={vpData} />}
            {activeTab === 'resources' && <ResourcesTab vpData={vpData} />}
            {activeTab === 'network' && <NetworkTab vpData={vpData} />}
            {activeTab === 'runtime' && <RuntimeTab vpData={vpData} />}
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

// ========== SCORE GAUGE ==========

function ScoreGauge({ score, size = 140 }) {
    const radius = (size - 16) / 2
    const circumference = 2 * Math.PI * radius
    const progress = ((score || 0) / 100) * circumference
    const color = getScoreColor(score || 0)

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                    cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: size * 0.3, fontWeight: 800, color }}>{score ?? '--'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ 100</span>
            </div>
        </div>
    )
}

// ========== OVERVIEW TAB ==========

function OverviewTab({ result, vpData }) {
    if (!result) return <EmptyState message="Nhap URL va nhan 'Bat dau kiem tra' de do hieu nang" />

    const metrics = vpData.metricScores || {}

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Score + Summary */}
            <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ScoreGauge score={vpData.score ?? result.score} size={160} />

                    <div style={{ flex: 1, minWidth: 300 }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>Performance Score</h3>
                        <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                            {result.url} &bull; {formatMs(result.duration_ms)}
                        </p>

                        {/* Web Vitals mini cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                            {Object.entries(metrics).map(([key, m]) => (
                                <div key={key} style={{
                                    padding: '10px 12px', borderRadius: 8,
                                    border: `1px solid ${getRatingColor(m.rating)}22`,
                                    background: `${getRatingColor(m.rating)}08`,
                                }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                                        {METRIC_LABELS[key]?.icon} {key}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: getRatingColor(m.rating) }}>
                                        {m.formatted}
                                    </div>
                                    <div style={{ fontSize: 10, color: getRatingColor(m.rating), fontWeight: 600, textTransform: 'uppercase' }}>
                                        {m.rating === 'good' ? 'Tot' : m.rating === 'needs-improvement' ? 'Can cai thien' : 'Kem'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <StatCard icon={<Globe size={18} />} label="Tong requests" value={vpData.network?.totalRequests || 0} />
                <StatCard icon={<HardDrive size={18} />} label="Tong tai nguyen" value={`${vpData.resources?.totalCount || 0} files`} sub={formatBytes(vpData.resources?.totalSize)} />
                <StatCard icon={<AlertTriangle size={18} />} label="Render-blocking" value={vpData.resources?.renderBlocking?.length || 0} color={vpData.resources?.renderBlocking?.length > 0 ? '#dc2626' : '#16a34a'} />
                <StatCard icon={<XCircle size={18} />} label="Failed requests" value={vpData.network?.failed?.length || 0} color={vpData.network?.failed?.length > 0 ? '#dc2626' : '#16a34a'} />
            </div>

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={16} /> Khuyen nghi toi uu ({result.recommendations.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.recommendations.slice(0, 8).map((rec, i) => (
                            <RecommendationCard key={i} rec={rec} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ========== WEB VITALS TAB ==========

function WebVitalsTab({ result, vpData }) {
    if (!result) return <EmptyState message="Chua co du lieu" />
    const metrics = vpData.metricScores || {}
    const thresholds = result.thresholds || {}

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(metrics).map(([key, m]) => {
                const t = thresholds[key]
                const info = METRIC_LABELS[key]
                return (
                    <div className="card" key={key} style={{ padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {info?.icon} {info?.name || key}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{info?.desc}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: getRatingColor(m.rating) }}>
                                    {m.formatted}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: getRatingColor(m.rating) }}>
                                    Score: {m.score}/100
                                </div>
                            </div>
                        </div>

                        {/* Threshold bar */}
                        {t && (
                            <div style={{ marginTop: 16 }}>
                                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ flex: t.good, background: '#16a34a' }} title={`Tot: < ${t.unit === 'ms' ? formatMs(t.good) : t.good}`} />
                                    <div style={{ flex: t.ni - t.good, background: '#ca8a04' }} title={`Can cai thien: ${t.unit === 'ms' ? formatMs(t.good) : t.good} - ${t.unit === 'ms' ? formatMs(t.ni) : t.ni}`} />
                                    <div style={{ flex: t.ni * 0.5, background: '#dc2626' }} title={`Kem: > ${t.unit === 'ms' ? formatMs(t.ni) : t.ni}`} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                                    <span>0</span>
                                    <span style={{ color: '#16a34a' }}>{t.unit === 'ms' ? formatMs(t.good) : t.good}</span>
                                    <span style={{ color: '#ca8a04' }}>{t.unit === 'ms' ? formatMs(t.ni) : t.ni}</span>
                                    <span style={{ color: '#dc2626' }}>Kem</span>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Long Tasks */}
            {vpData.coreWebVitals?.longTasks?.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Long Tasks ({vpData.coreWebVitals.longTasks.length})</h3>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px' }}>#</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Start Time</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Duration</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Blocking Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vpData.coreWebVitals.longTasks.map((t, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '6px 8px' }}>{i + 1}</td>
                                    <td style={{ padding: '6px 8px' }}>{formatMs(t.startTime)}</td>
                                    <td style={{ padding: '6px 8px' }}>{formatMs(t.duration)}</td>
                                    <td style={{ padding: '6px 8px', color: '#dc2626', fontWeight: 600 }}>{formatMs(t.blockingTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ========== RESOURCES TAB ==========

function ResourcesTab({ vpData }) {
    if (!vpData.resources) return <EmptyState message="Chua co du lieu tai nguyen" />
    const res = vpData.resources

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StatCard icon={<FileText size={18} />} label="Tong resources" value={res.totalCount} />
                <StatCard icon={<HardDrive size={18} />} label="Tong dung luong" value={formatBytes(res.totalSize)} />
                <StatCard icon={<AlertTriangle size={18} />} label="Render-blocking" value={res.renderBlocking?.length || 0} color={res.renderBlocking?.length > 0 ? '#dc2626' : '#16a34a'} />
                <StatCard icon={<Globe size={18} />} label="Third-party" value={res.thirdParty?.count || 0} sub={formatBytes(res.thirdParty?.size)} />
            </div>

            {/* By Type Breakdown */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Phan loai tai nguyen</h3>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Loai</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>So luong</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Dung luong</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '40%' }}>Ty le</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(res.byType || {}).sort((a, b) => b[1].size - a[1].size).map(([type, data]) => {
                            const pct = res.totalSize > 0 ? (data.size / res.totalSize) * 100 : 0
                            const cfg = RESOURCE_TYPE_LABELS[type] || RESOURCE_TYPE_LABELS.other
                            return (
                                <tr key={type} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px' }}>
                                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cfg.color, marginRight: 6 }} />
                                        {cfg.label}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '8px' }}>{data.count}</td>
                                    <td style={{ textAlign: 'right', padding: '8px' }}>{formatBytes(data.size)}</td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 3 }} />
                                            </div>
                                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 36 }}>{pct.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Render-blocking */}
            {res.renderBlocking?.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={16} /> Render-blocking Resources ({res.renderBlocking.length})
                    </h3>
                    {res.renderBlocking.map((r, i) => (
                        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{r.url}</div>
                            <div style={{ marginTop: 4, display: 'flex', gap: 12 }}>
                                <span style={{ color: '#6b7280' }}>Loai: <strong>{r.type}</strong></span>
                                <span style={{ color: '#16a34a' }}>Fix: {r.fix}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Large Resources */}
            {res.large?.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ca8a04' }}>
                        Resources lon (&gt; 500KB) ({res.large.length})
                    </h3>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px' }}>URL</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Loai</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Dung luong</th>
                            </tr>
                        </thead>
                        <tbody>
                            {res.large.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: 400 }}>{r.url}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{r.type}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: '#dc2626' }}>{formatBytes(r.size)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Third-party */}
            {res.thirdParty?.domains?.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Third-party Domains ({res.thirdParty.domains.length})</h3>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Domain</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Requests</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Dung luong</th>
                            </tr>
                        </thead>
                        <tbody>
                            {res.thirdParty.domains.map((d, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{d.domain}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{d.count}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{formatBytes(d.size)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ========== NETWORK TAB ==========

function NetworkTab({ vpData }) {
    if (!vpData.network) return <EmptyState message="Chua co du lieu mang" />
    const net = vpData.network

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StatCard icon={<Globe size={18} />} label="Tong requests" value={net.totalRequests} />
                <StatCard icon={<HardDrive size={18} />} label="Transfer size" value={formatBytes(net.totalTransferSize)} />
                <StatCard icon={<CheckCircle2 size={18} />} label="Cache hit rate" value={`${(net.cacheHitRate || 0).toFixed(0)}%`} color={net.cacheHitRate > 50 ? '#16a34a' : '#ca8a04'} />
                <StatCard icon={<XCircle size={18} />} label="Failed" value={net.failed?.length || 0} color={net.failed?.length > 0 ? '#dc2626' : '#16a34a'} />
            </div>

            {/* Waterfall */}
            {net.waterfall?.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Request Waterfall</h3>
                    <div style={{ maxHeight: 500, overflowY: 'auto', fontSize: 11 }}>
                        {net.waterfall.map((r, i) => {
                            const typeColor = RESOURCE_TYPE_LABELS[r.type]?.color || '#6b7280'
                            const urlShort = r.url.length > 60 ? '...' + r.url.slice(-57) : r.url
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ minWidth: 24, color: 'var(--text-secondary)' }}>{i + 1}</span>
                                    <span style={{ minWidth: 50, fontSize: 10, color: typeColor, fontWeight: 600 }}>{r.type}</span>
                                    <span style={{ minWidth: 30, textAlign: 'right', color: r.status >= 400 ? '#dc2626' : 'var(--text-secondary)' }}>{r.status}</span>
                                    <div style={{ flex: 1, position: 'relative', height: 14, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${r.startPercent}%`,
                                                width: `${Math.max(r.widthPercent, 0.5)}%`,
                                                height: '100%',
                                                background: typeColor,
                                                borderRadius: 2,
                                                opacity: 0.7,
                                            }}
                                            title={`${urlShort}\n${formatMs(r.duration)} | ${formatBytes(r.size)}`}
                                        />
                                    </div>
                                    <span style={{ minWidth: 50, textAlign: 'right', fontFamily: 'monospace' }}>{formatMs(r.duration)}</span>
                                    <span style={{ minWidth: 50, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatBytes(r.size)}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Slowest Requests */}
            {net.slowest?.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ca8a04' }}>Requests cham nhat</h3>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px' }}>URL</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Loai</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Duration</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Size</th>
                            </tr>
                        </thead>
                        <tbody>
                            {net.slowest.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: 400 }}>{r.url}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{r.type}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: '#dc2626' }}>{formatMs(r.duration)}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{formatBytes(r.size)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Failed Requests */}
            {net.failed?.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <XCircle size={16} /> Failed Requests ({net.failed.length})
                    </h3>
                    {net.failed.map((r, i) => (
                        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', color: '#dc2626' }}>{r.url}</div>
                            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{r.method} | {r.type} | {r.error}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ========== RUNTIME TAB ==========

function RuntimeTab({ vpData }) {
    if (!vpData.runtime) return <EmptyState message="Chua co du lieu runtime" />
    const rt = vpData.runtime

    const heapUsed = rt.jsHeapUsed || 0
    const heapTotal = rt.jsHeapTotal || 1
    const heapPct = rt.heapUsagePercent || 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* JS Heap */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>JavaScript Heap</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ height: 20, background: 'var(--bg-secondary)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${heapPct}%`,
                                background: heapPct > 90 ? '#dc2626' : heapPct > 70 ? '#ca8a04' : '#16a34a',
                                borderRadius: 6,
                                transition: 'width 0.5s',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>
                            <span>Used: {formatBytes(heapUsed)}</span>
                            <span>Total: {formatBytes(heapTotal)}</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: heapPct > 90 ? '#dc2626' : heapPct > 70 ? '#ca8a04' : '#16a34a' }}>
                            {heapPct.toFixed(0)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* DOM & Layout Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <StatCard icon={<FileText size={18} />} label="DOM Nodes" value={rt.domNodeCount || rt.totalElements || 0} color={rt.domNodeCount > 1500 ? '#ca8a04' : '#16a34a'} />
                <StatCard icon={<Cpu size={18} />} label="Layout Count" value={rt.layoutCount || 0} />
                <StatCard icon={<Clock size={18} />} label="Layout Duration" value={formatMs(rt.layoutDuration)} />
                <StatCard icon={<Cpu size={18} />} label="Script Duration" value={formatMs(rt.scriptDuration)} />
                <StatCard icon={<RefreshCw size={18} />} label="RecalcStyle Count" value={rt.recalcStyleCount || 0} />
                <StatCard icon={<Clock size={18} />} label="RecalcStyle Duration" value={formatMs(rt.recalcStyleDuration)} />
                <StatCard icon={<FileText size={18} />} label="Scripts" value={rt.scriptCount || 0} />
                <StatCard icon={<FileText size={18} />} label="Stylesheets" value={rt.styleCount || 0} />
                <StatCard icon={<FileText size={18} />} label="Images" value={rt.imageCount || 0} />
                <StatCard icon={<FileText size={18} />} label="Iframes" value={rt.iframeCount || 0} />
                <StatCard icon={<BarChart3 size={18} />} label="Max DOM Depth" value={rt.maxDomDepth || 0} />
                <StatCard icon={<Clock size={18} />} label="Task Duration" value={formatMs(rt.taskDuration)} />
            </div>
        </div>
    )
}

// ========== HISTORY TAB ==========

function HistoryTab({ list, loading, onLoad, onDelete, onRefresh }) {
    return (
        <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Lich su kiem tra hieu nang</h3>
                <button className="btn" onClick={onRefresh} disabled={loading} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Lam moi
                </button>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}><Loader2 size={20} className="spin" /> Dang tai...</div>}

            {!loading && list.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chua co lich su kiem tra</div>
            )}

            {list.map(r => (
                <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <ScoreGauge score={r.score} size={48} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.url}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {new Date(r.created_at).toLocaleString('vi-VN')} &bull; {formatMs(r.summary?.duration_ms)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn" onClick={() => onLoad(r._id)} style={{ fontSize: 11, padding: '4px 8px' }} title="Xem chi tiet">
                            <ExternalLink size={13} />
                        </button>
                        <a
                            href={apiUrl(`/api/ai/performance-history/${r._id}/html`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            title="Xuat HTML"
                        >
                            <Download size={13} />
                        </a>
                        <button className="btn" onClick={() => onDelete(r._id)} style={{ fontSize: 11, padding: '4px 8px', color: '#dc2626' }} title="Xoa">
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ========== SHARED COMPONENTS ==========

function StatCard({ icon, label, value, sub, color }) {
    return (
        <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--text-secondary)' }}>
                {icon}
                <span style={{ fontSize: 12 }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
        </div>
    )
}

function RecommendationCard({ rec }) {
    const [expanded, setExpanded] = useState(false)
    const sev = SEVERITY_CONFIG[rec.severity] || SEVERITY_CONFIG.MEDIUM

    return (
        <div style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${sev.color}22`, background: sev.bg, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sev.color, background: `${sev.color}18`, padding: '2px 6px', borderRadius: 4 }}>
                        {rec.severity}
                    </span>
                    {rec.metric && <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{rec.metric}</span>}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{rec.title}</span>
                </div>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {expanded && (
                <div style={{ marginTop: 8 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{rec.description}</p>
                    {rec.suggestions && (
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                            {rec.suggestions.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                        </ul>
                    )}
                </div>
            )}
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
