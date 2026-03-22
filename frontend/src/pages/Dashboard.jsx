import { useEffect, useState } from 'react'
import api, { apiUrl } from '../api/client'
import { Doughnut, Line } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement, Filler } from 'chart.js'
import { PlayCircle, Plus, Zap, Shield, Clock, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react'

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement, Filler)

export default function Dashboard({ navigate }) {
    const [projects, setProjects] = useState([])
    const [suites, setSuites] = useState([])
    const [runs, setRuns] = useState([])
    const [recentActivity, setRecentActivity] = useState([])

    useEffect(() => {
        api.get('/api/projects').then(r => setProjects(r.data))
        api.get('/api/test-suites').then(r => setSuites(r.data))
        api.get('/api/runs').then(r => {
            const data = r.data.slice(0, 30)
            setRuns(data)
            // Build recent activity from last 5 runs
            setRecentActivity(data.slice(0, 5).map(run => {
                const s = run.summary_json ? JSON.parse(run.summary_json) : {}
                return { ...run, summary: s }
            }))
        })
    }, [])

    const totalTC = suites.reduce((a, s) => a + (s.tc_count || 0), 0)
    const doneRuns = runs.filter(r => r.status === 'DONE')
    const totalPassed = doneRuns.reduce((a, r) => { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; return a + (s.passed || 0) }, 0)
    const totalFailed = doneRuns.reduce((a, r) => { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; return a + (s.failed || 0) }, 0)
    const totalRan = totalPassed + totalFailed
    const passRate = totalRan > 0 ? Math.round(totalPassed / totalRan * 100) : 0
    const totalHealed = doneRuns.reduce((a, r) => { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; return a + (s.healedSelectors || 0) }, 0)

    // Avg duration of last 10 runs
    const avgDuration = doneRuns.slice(0, 10).reduce((a, r) => {
        if (r.finished_at && r.started_at) {
            return a + (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime())
        }
        return a
    }, 0) / Math.max(1, doneRuns.slice(0, 10).filter(r => r.finished_at).length)

    const last10 = [...doneRuns].slice(0, 10).reverse()
    const lineData = {
        labels: last10.map(r => new Date(r.started_at).toLocaleDateString('vi-VN')),
        datasets: [{
            label: 'Pass', data: last10.map(r => { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; return s.passed || 0 }),
            borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)', fill: true, tension: 0.4, pointRadius: 4
        }, {
            label: 'Fail', data: last10.map(r => { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; return s.failed || 0 }),
            borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.08)', fill: true, tension: 0.4, pointRadius: 4
        }]
    }

    const pieData = {
        labels: ['Passed', 'Failed'],
        datasets: [{ data: [totalPassed || 1, totalFailed], backgroundColor: ['#16a34a', '#dc2626'], borderWidth: 0, hoverOffset: 6 }]
    }

    // Pass rate trend (last 10 runs)
    const passRateTrend = last10.map(r => {
        const s = r.summary_json ? JSON.parse(r.summary_json) : {}
        const total = (s.passed || 0) + (s.failed || 0)
        return total > 0 ? Math.round((s.passed || 0) / total * 100) : 0
    })
    const trendDirection = passRateTrend.length >= 2
        ? passRateTrend[passRateTrend.length - 1] - passRateTrend[0]
        : 0

    const statusBadge = (s) => {
        const map = { DONE: 'badge-pass', RUNNING: 'badge-running', ERROR: 'badge-error', CANCELLED: 'badge-error' }
        return <span className={`badge ${map[s] || 'badge-error'}`}>{s}</span>
    }

    return (
        <div>
            {/* KPI Cards - enhanced */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="kpi-card total" onClick={() => navigate('projects')} style={{ cursor: 'pointer' }}>
                    <div className="num">{projects.length}</div>
                    <div className="lbl">Dự án</div>
                </div>
                <div className="kpi-card pass" onClick={() => navigate('suites')} style={{ cursor: 'pointer' }}>
                    <div className="num">{suites.length}</div>
                    <div className="lbl">Test Suites</div>
                </div>
                <div className="kpi-card fail" onClick={() => navigate('editor')} style={{ cursor: 'pointer' }}>
                    <div className="num">{totalTC}</div>
                    <div className="lbl">Test Cases</div>
                </div>
                <div className="kpi-card rate">
                    <div className="num" style={{ color: passRate >= 80 ? '#16a34a' : passRate >= 50 ? '#d97706' : '#dc2626' }}>
                        {passRate}%
                        {trendDirection !== 0 && (
                            <span style={{ fontSize: 12, marginLeft: 4, color: trendDirection > 0 ? '#16a34a' : '#dc2626' }}>
                                {trendDirection > 0 ? '+' : ''}{trendDirection}%
                            </span>
                        )}
                    </div>
                    <div className="lbl">Tỉ lệ Pass</div>
                </div>
                <div className="kpi-card" style={{ background: '#f5f3ff', borderColor: '#c4b5fd' }}>
                    <div className="num" style={{ color: '#7c3aed' }}>{totalHealed}</div>
                    <div className="lbl"><Zap size={12} /> Self-Healed</div>
                </div>
                <div className="kpi-card" style={{ background: '#eff6ff', borderColor: '#93c5fd' }}>
                    <div className="num" style={{ color: '#2563eb' }}>{avgDuration ? `${Math.round(avgDuration / 1000)}s` : '-'}</div>
                    <div className="lbl"><Clock size={12} /> Avg Duration</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => navigate('editor')}><Plus size={14} /> Tạo Test Case</button>
                <button className="btn btn-outline" onClick={() => navigate('ai-generator')}><Zap size={14} /> Tạo bằng AI</button>
                <button className="btn btn-outline" onClick={() => navigate('recorder')}>Record & Replay</button>
                <button className="btn btn-outline" onClick={() => navigate('analytics')}><BarChart3 size={14} /> Analytics</button>
            </div>

            <div className="grid-2 mb-6">
                <div className="card" style={{ padding: 20 }}>
                    <div className="font-bold mb-4" style={{ fontSize: 15 }}>Tổng quan Pass/Fail</div>
                    <div style={{ maxHeight: 200 }}><Doughnut data={pieData} options={{ plugins: { legend: { position: 'bottom' } }, cutout: '60%', maintainAspectRatio: false }} /></div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <div className="font-bold mb-4" style={{ fontSize: 15 }}>Lịch sử 10 lần chạy gần nhất</div>
                    <div style={{ maxHeight: 200 }}><Line data={lineData} options={{ plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } }, maintainAspectRatio: false }} /></div>
                </div>
            </div>

            {/* Recent Activity Feed */}
            {recentActivity.length > 0 && (
                <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                    <div className="font-bold mb-4" style={{ fontSize: 15 }}>Hoạt động gần đây</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentActivity.map(r => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: r.status === 'DONE' ? (r.summary.failed > 0 ? '#dc2626' : '#16a34a') : r.status === 'RUNNING' ? '#2563eb' : '#94a3b8',
                                    flexShrink: 0
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                                        {r.suite_id}
                                        {r.summary.healedSelectors > 0 && (
                                            <span style={{ marginLeft: 6, fontSize: 11, color: '#7c3aed' }}><Zap size={10} /> {r.summary.healedSelectors} healed</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {new Date(r.started_at).toLocaleString('vi-VN')} - {r.created_by}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 13 }}>
                                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{r.summary.passed || 0}P</span>
                                        {' / '}
                                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.summary.failed || 0}F</span>
                                    </div>
                                    {statusBadge(r.status)}
                                </div>
                                {r.status === 'DONE' && (
                                    <div style={{ flexShrink: 0 }}>
                                        <a className="btn btn-ghost btn-sm" href={apiUrl(`/api/reports/${r.id}/html`)} target="_blank" style={{ fontSize: 11 }}>Report</a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-4">
                <div className="font-bold" style={{ fontSize: 15 }}>Danh sách Test Suite</div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('projects')}><Plus size={14} /> Quản lý Dự án</button>
            </div>
            <div className="card table-wrap">
                <table>
                    <thead><tr><th>Tên Suite</th><th>Dự án</th><th>Số Test Case</th><th>Mô tả</th><th>Ngày tạo</th><th></th></tr></thead>
                    <tbody>
                        {suites.length === 0 && <tr><td colSpan={6}><div className="empty-state"><p>Chưa có Test Suite nào. Bắt đầu tạo mới!</p></div></td></tr>}
                        {suites.map(s => (
                            <tr key={s.id}>
                                <td><strong>{s.name}</strong></td>
                                <td className="text-sm">{s.project_name || '-'}</td>
                                <td>{s.tc_count || 0}</td>
                                <td className="text-muted">{s.description || '-'}</td>
                                <td className="text-muted text-sm">{new Date(s.created_at).toLocaleDateString('vi-VN')}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-success btn-sm" onClick={() => navigate('monitor', { suite_id: s.id, suite_name: s.name })}><PlayCircle size={13} /> Run</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('analytics', { suite_id: s.id })}><BarChart3 size={12} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
