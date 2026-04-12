import { useEffect, useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { BarChart3, AlertTriangle, Zap, TrendingUp, ChevronDown, ChevronRight, RefreshCw, Shield, Clock, Target } from 'lucide-react'

export default function Analytics({ navigate, ctx }) {
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState('')
    const [suites, setSuites] = useState([])
    const [selectedSuite, setSelectedSuite] = useState('')
    const [health, setHealth] = useState(null)
    const [trends, setTrends] = useState(null)
    const [errors, setErrors] = useState(null)
    const [loading, setLoading] = useState(false)
    const [expandedTC, setExpandedTC] = useState(null)
    const [tab, setTab] = useState('overview') // overview | flaky | errors | trends

    useEffect(() => { api.get('/api/projects').then(r => setProjects(r.data)) }, [])
    useEffect(() => {
        const url = selectedProject ? `/api/test-suites?project_id=${selectedProject}` : '/api/test-suites'
        api.get(url).then(r => setSuites(r.data))
    }, [selectedProject])

    useEffect(() => {
        if (selectedSuite) loadData()
    }, [selectedSuite])

    const loadData = async () => {
        if (!selectedSuite) return
        setLoading(true)
        try {
            const [h, t, e] = await Promise.all([
                api.get(`/api/analytics/health/${selectedSuite}`),
                api.get(`/api/analytics/trends/${selectedSuite}?limit=20`),
                api.get(`/api/analytics/errors/${selectedSuite}`),
            ])
            setHealth(h.data)
            setTrends(t.data)
            setErrors(e.data)
        } catch (err) {
            toast.error('Lỗi tải dữ liệu analytics')
        } finally { setLoading(false) }
    }

    const healthColor = (score) => {
        if (score >= 80) return '#16a34a'
        if (score >= 60) return '#d97706'
        if (score >= 40) return '#ea580c'
        return '#dc2626'
    }

    const priorityColor = (p) => {
        if (p === 'CRITICAL') return '#dc2626'
        if (p === 'HIGH') return '#ea580c'
        if (p === 'MEDIUM') return '#d97706'
        return '#16a34a'
    }

    return (
        <div>
            {/* Suite selector */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 200 }}>
                        <label className="form-label">Dự án</label>
                        <select className="form-control" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setSelectedSuite('') }}>
                            <option value="">-- Tất cả Dự án --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div style={{ minWidth: 200, flex: 1 }}>
                        <label className="form-label">Bộ kiểm thử</label>
                        <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)}>
                            <option value="">-- Chọn bộ kiểm thử --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.tc_count} test case)</option>)}
                        </select>
                    </div>
                    {selectedSuite && (
                        <button className="btn btn-outline" onClick={loadData} style={{ marginTop: 22 }} disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
                        </button>
                    )}
                </div>
            </div>

            {!selectedSuite && (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <BarChart3 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p>Chọn bộ kiểm thử để xem phân tích</p>
                </div>
            )}

            {selectedSuite && health && (
                <>
                    {/* Health Score Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 36, fontWeight: 700, color: healthColor(health.healthScore) }}>
                                {health.healthScore}%
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                <Shield size={14} /> Suite Health
                            </div>
                        </div>
                        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 36, fontWeight: 700, color: '#2563eb' }}>{health.totalTests}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                <Target size={14} /> Tổng Test Case
                            </div>
                        </div>
                        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 36, fontWeight: 700, color: '#dc2626' }}>{health.critical}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                <AlertTriangle size={14} /> Critical
                            </div>
                        </div>
                        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 36, fontWeight: 700, color: '#d97706' }}>{health.flaky}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                <Zap size={14} /> Flaky Tests
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="nl-tabs" style={{ marginBottom: 16 }}>
                        <button className={`nl-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
                            <BarChart3 size={14} /> Tổng quan
                        </button>
                        <button className={`nl-tab ${tab === 'flaky' ? 'active' : ''}`} onClick={() => setTab('flaky')}>
                            <Zap size={14} /> Flaky Tests ({health.flaky})
                        </button>
                        <button className={`nl-tab ${tab === 'errors' ? 'active' : ''}`} onClick={() => setTab('errors')}>
                            <AlertTriangle size={14} /> Error Patterns
                        </button>
                        <button className={`nl-tab ${tab === 'trends' ? 'active' : ''}`} onClick={() => setTab('trends')}>
                            <TrendingUp size={14} /> Xu hướng
                        </button>
                    </div>

                    {/* Overview Tab */}
                    {tab === 'overview' && (
                        <div className="card" style={{ padding: 20 }}>
                            <h4 style={{ marginBottom: 16 }}>Độ ưu tiên Test Case</h4>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                Sắp xếp theo mức độ ưu tiên: test dễ fail sẽ được chạy trước
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12 }}>Test Case</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>Priority</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>Score</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>Failure Rate</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>Flaky</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(health.tests || []).map(t => (
                                        <tr key={t.testCaseId} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                            onClick={() => setExpandedTC(expandedTC === t.testCaseId ? null : t.testCaseId)}>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div className="flex items-center gap-2">
                                                    {expandedTC === t.testCaseId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    <div>
                                                        <strong style={{ fontSize: 13 }}>{t.title}</strong>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.testCaseId}</div>
                                                    </div>
                                                </div>
                                                {expandedTC === t.testCaseId && t.factors && (
                                                    <div style={{ marginTop: 8, marginLeft: 22, padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Recent Fail:</span> {Math.round(t.factors.recentFailure * 100)}%</div>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Flaky:</span> {Math.round(t.factors.flakyScore * 100)}%</div>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Duration:</span> {Math.round(t.factors.duration * 100)}%</div>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Staleness:</span> {Math.round(t.factors.staleness * 100)}%</div>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Change:</span> {Math.round(t.factors.change * 100)}%</div>
                                                        </div>
                                                        {t.metrics?.recentTrend && (
                                                            <div style={{ marginTop: 6 }}>
                                                                <span style={{ color: 'var(--text-muted)' }}>Recent: </span>
                                                                {t.metrics.recentTrend.map((s, i) => (
                                                                    <span key={i} style={{
                                                                        display: 'inline-block', width: 16, height: 16, borderRadius: 3, marginRight: 2,
                                                                        background: s === 'PASSED' ? '#dcfce7' : s === 'FAILED' ? '#fecaca' : '#f1f5f9',
                                                                        color: s === 'PASSED' ? '#16a34a' : s === 'FAILED' ? '#dc2626' : '#94a3b8',
                                                                        textAlign: 'center', lineHeight: '16px', fontSize: 10
                                                                    }}>{s === 'PASSED' ? 'P' : s === 'FAILED' ? 'F' : '-'}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: priorityColor(t.priority) + '18', color: priorityColor(t.priority), border: `1px solid ${priorityColor(t.priority)}40` }}>
                                                    {t.priority}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{t.score}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                {t.factors ? `${Math.round(t.factors.recentFailure * 100)}%` : '-'}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                {t.factors?.flakyScore >= 0.4 ? <Zap size={14} color="#d97706" /> : <span style={{ color: '#16a34a' }}>-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Flaky Tests Tab */}
                    {tab === 'flaky' && (
                        <div className="card" style={{ padding: 20 }}>
                            <h4 style={{ marginBottom: 16 }}><Zap size={16} /> Flaky Tests</h4>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                Tests không ổn định — kết quả thay đổi giữa PASSED và FAILED không có lý do rõ ràng
                            </div>
                            {(health.tests || []).filter(t => t.factors?.flakyScore >= 0.4).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                                    Không phát hiện test flaky nào. Suite này ổn định!
                                </div>
                            ) : (
                                (health.tests || []).filter(t => t.factors?.flakyScore >= 0.4).map(t => (
                                    <div key={t.testCaseId} style={{ marginBottom: 12, padding: 14, border: '1px solid #fbbf2440', borderRadius: 8, background: '#fffbeb' }}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <strong>{t.title}</strong>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.testCaseId}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{Math.round(t.factors.flakyScore * 100)}%</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Flaky Score</div>
                                            </div>
                                        </div>
                                        {t.metrics && (
                                            <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12 }}>
                                                <span>Flip rate: <strong>{Math.round((t.metrics.flipRate || 0) * 100)}%</strong></span>
                                                <span>Failure rate: <strong>{Math.round((t.metrics.failureRate || 0) * 100)}%</strong></span>
                                                <span>Retry healed: <strong>{t.metrics.retryHealed || 0}</strong></span>
                                                <span>Runs analyzed: <strong>{t.metrics.runs || 0}</strong></span>
                                            </div>
                                        )}
                                        {t.metrics?.errorGroups?.length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 11, color: '#92400e' }}>
                                                Top error: <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 3 }}>{t.metrics.errorGroups[0].pattern}</code> ({t.metrics.errorGroups[0].count}x)
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Error Patterns Tab */}
                    {tab === 'errors' && errors && (
                        <div className="card" style={{ padding: 20 }}>
                            <h4 style={{ marginBottom: 16 }}><AlertTriangle size={16} /> Error Patterns ({errors.totalFailures} failures)</h4>
                            {errors.patterns.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                                    Không có lỗi nào được ghi nhận.
                                </div>
                            ) : (
                                errors.patterns.map((e, i) => (
                                    <div key={i} style={{ marginBottom: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: '#fff5f5' }}>
                                        <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                                            <code style={{ fontSize: 12, background: '#fecaca40', padding: '3px 8px', borderRadius: 4, color: '#991b1b', wordBreak: 'break-all' }}>{e.pattern}</code>
                                            <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 18 }}>{e.count}x</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            Ảnh hưởng {e.affectedCount} test case: {e.testCases.slice(0, 3).join(', ')}{e.testCases.length > 3 ? ` +${e.testCases.length - 3}` : ''}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Trends Tab */}
                    {tab === 'trends' && trends && (
                        <div className="card" style={{ padding: 20 }}>
                            <h4 style={{ marginBottom: 16 }}><TrendingUp size={16} /> Xu hướng ({trends.runs.length} lần chạy)</h4>
                            {trends.stats && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                                    <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{trends.stats.avgPassRate}%</div>
                                        <div style={{ fontSize: 11, color: '#166534' }}>Avg Pass Rate</div>
                                    </div>
                                    <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{trends.stats.totalRuns}</div>
                                        <div style={{ fontSize: 11, color: '#1e40af' }}>Total Runs</div>
                                    </div>
                                    <div style={{ padding: 12, background: '#fefce8', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: '#ca8a04' }}>
                                            {trends.stats.avgDuration ? `${Math.round(trends.stats.avgDuration / 1000)}s` : '-'}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#854d0e' }}>Avg Duration</div>
                                    </div>
                                </div>
                            )}

                            {/* Pass rate bar chart (simple CSS-based) */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pass Rate theo thời gian</div>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
                                    {trends.runs.map((r, i) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={`${r.date?.split('T')[0]} - ${r.passRate}%`}>
                                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{r.passRate}%</div>
                                            <div style={{
                                                width: '100%', maxWidth: 40,
                                                height: Math.max(4, (r.passRate / 100) * 100),
                                                background: r.passRate >= 80 ? '#22c55e' : r.passRate >= 50 ? '#f59e0b' : '#ef4444',
                                                borderRadius: '4px 4px 0 0',
                                                transition: 'height 0.3s',
                                            }} />
                                            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                                                {r.date ? new Date(r.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Run history table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Run</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Date</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Passed</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Failed</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Pass Rate</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Duration</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Healed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trends.runs.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '6px 10px' }}><code style={{ fontSize: 10 }}>{r.runId}</code></td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.date ? new Date(r.date).toLocaleString('vi-VN') : '-'}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', color: '#16a34a' }}>{r.passed}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', color: '#dc2626' }}>{r.failed}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: r.passRate >= 80 ? '#dcfce7' : r.passRate >= 50 ? '#fef3c7' : '#fecaca', color: r.passRate >= 80 ? '#16a34a' : r.passRate >= 50 ? '#ca8a04' : '#dc2626' }}>
                                                    {r.passRate}%
                                                </span>
                                            </td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {r.duration ? `${Math.round(r.duration / 1000)}s` : '-'}
                                            </td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                                {r.healedSelectors > 0 ? <span style={{ color: '#7c3aed' }}>{r.healedSelectors}</span> : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
