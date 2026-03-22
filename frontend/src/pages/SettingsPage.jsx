import { useEffect, useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Save, Sun, Moon, Zap, Shield, Globe, Server, RefreshCw } from 'lucide-react'

const THEME_KEY = 'autotest-theme'

export default function SettingsPage({ navigate }) {
    const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'light')
    const [aiStatus, setAiStatus] = useState(null)
    const [queueStatus, setQueueStatus] = useState(null)
    const [loading, setLoading] = useState(false)

    // Run options defaults
    const [defaults, setDefaults] = useState({
        continueOnFailure: false,
        retryCount: 0,
        concurrency: 1,
        selfHealing: true,
        smartPriority: false,
    })

    useEffect(() => {
        // Load saved defaults
        try {
            const saved = localStorage.getItem('autotest-run-defaults')
            if (saved) setDefaults(JSON.parse(saved))
        } catch {}
        loadAIStatus()
    }, [])

    const loadAIStatus = async () => {
        setLoading(true)
        try {
            const [ai, queue] = await Promise.all([
                api.get('/api/ai/status').catch(() => ({ data: null })),
                api.get('/api/ai/queue-status').catch(() => ({ data: null })),
            ])
            setAiStatus(ai.data)
            setQueueStatus(queue.data)
        } catch {} finally { setLoading(false) }
    }

    const toggleTheme = (newTheme) => {
        setTheme(newTheme)
        localStorage.setItem(THEME_KEY, newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
    }

    const saveDefaults = () => {
        localStorage.setItem('autotest-run-defaults', JSON.stringify(defaults))
        toast.success('Đã lưu cấu hình mặc định')
    }

    return (
        <div style={{ maxWidth: 800 }}>
            {/* Theme Section */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} Giao diện
                </h4>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => toggleTheme('light')}
                        style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                    >
                        <Sun size={24} />
                        <span>Light Mode</span>
                    </button>
                    <button
                        className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => toggleTheme('dark')}
                        style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                    >
                        <Moon size={24} />
                        <span>Dark Mode</span>
                    </button>
                </div>
            </div>

            {/* Default Run Options */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={18} /> Cấu hình chạy mặc định
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <input type="checkbox" checked={defaults.continueOnFailure}
                            onChange={e => setDefaults(p => ({ ...p, continueOnFailure: e.target.checked }))}
                            style={{ width: 16, height: 16 }} />
                        Tiếp tục khi thất bại
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <input type="checkbox" checked={defaults.selfHealing}
                            onChange={e => setDefaults(p => ({ ...p, selfHealing: e.target.checked }))}
                            style={{ width: 16, height: 16 }} />
                        <Shield size={14} /> Self-Healing Locators
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <input type="checkbox" checked={defaults.smartPriority}
                            onChange={e => setDefaults(p => ({ ...p, smartPriority: e.target.checked }))}
                            style={{ width: 16, height: 16 }} />
                        Smart Test Priority
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        Retry:
                        <select className="form-control" value={defaults.retryCount}
                            onChange={e => setDefaults(p => ({ ...p, retryCount: parseInt(e.target.value) }))}
                            style={{ width: 70, padding: '4px 8px' }}>
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        Chạy song song:
                        <select className="form-control" value={defaults.concurrency}
                            onChange={e => setDefaults(p => ({ ...p, concurrency: parseInt(e.target.value) }))}
                            style={{ width: 70, padding: '4px 8px' }}>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={5}>5</option>
                        </select>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={saveDefaults} style={{ marginTop: 16 }}>
                    <Save size={14} /> Lưu cấu hình
                </button>
            </div>

            {/* AI Provider Status */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <Globe size={18} /> AI Provider Status
                    </h4>
                    <button className="btn btn-ghost btn-sm" onClick={loadAIStatus} disabled={loading}>
                        <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>

                {aiStatus ? (
                    <div>
                        <div style={{ marginBottom: 12, padding: 10, background: aiStatus.configured ? '#f0fdf4' : '#fef2f2', borderRadius: 8, fontSize: 13 }}>
                            {aiStatus.configured
                                ? <span style={{ color: '#16a34a' }}>AI đã được cấu hình ({aiStatus.model || 'Gemini'})</span>
                                : <span style={{ color: '#dc2626' }}>AI chưa được cấu hình. Thiết lập GEMINI_API_KEY trong .env</span>
                            }
                        </div>

                        {aiStatus.providers && (
                            <div style={{ display: 'grid', gap: 8 }}>
                                {aiStatus.providers.map((p, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                        background: p.available ? '#f0fdf4' : '#f8fafc', borderRadius: 6,
                                        border: `1px solid ${p.available ? '#bbf7d0' : 'var(--border)'}`,
                                        fontSize: 13
                                    }}>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: p.available ? (p.onCooldown ? '#f59e0b' : '#16a34a') : '#94a3b8'
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <strong>{p.name}</strong>
                                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>{p.model}</span>
                                        </div>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.rpm} RPM</span>
                                        <span style={{
                                            fontSize: 11, padding: '2px 8px', borderRadius: 10,
                                            background: p.available ? (p.onCooldown ? '#fef3c7' : '#dcfce7') : '#f1f5f9',
                                            color: p.available ? (p.onCooldown ? '#92400e' : '#166534') : '#64748b'
                                        }}>
                                            {p.available ? (p.onCooldown ? 'Cooldown' : 'Active') : 'Disabled'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Đang tải...</div>
                )}
            </div>

            {/* Queue & Cache Status */}
            {queueStatus && (
                <div className="card" style={{ padding: 20 }}>
                    <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Server size={18} /> Queue & Cache
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                        {queueStatus.queue && (
                            <>
                                <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{queueStatus.queue.queueLength}</div>
                                    <div style={{ fontSize: 11, color: '#1e40af' }}>Queue Length</div>
                                </div>
                                <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{queueStatus.queue.currentRPM}/{queueStatus.queue.maxRPM}</div>
                                    <div style={{ fontSize: 11, color: '#1e40af' }}>Current RPM</div>
                                </div>
                            </>
                        )}
                        {queueStatus.cache && (
                            <>
                                <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{queueStatus.cache.size}</div>
                                    <div style={{ fontSize: 11, color: '#166534' }}>Cache Entries</div>
                                </div>
                                <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{queueStatus.cache.hitRate || '0%'}</div>
                                    <div style={{ fontSize: 11, color: '#166534' }}>Cache Hit Rate</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
