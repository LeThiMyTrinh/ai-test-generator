import { useEffect, useState } from 'react'
import api, { apiUrl } from '../api/client'
import { Doughnut, Line } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement, Filler } from 'chart.js'
import { PlayCircle, Plus } from 'lucide-react'

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement, Filler)

export default function Dashboard({ navigate }) {
    const [suites, setSuites] = useState([])
    const [runs, setRuns] = useState([])

    useEffect(() => {
        api.get('/api/test-suites').then(r => setSuites(r.data))
        api.get('/api/runs').then(r => setRuns(r.data.slice(0, 20)))
    }, [])

    const totalTC = suites.reduce((a, s) => a + (s.tc_count || 0), 0)
    const doneRuns = runs.filter(r => r.status === 'DONE')
    const totalPassed = doneRuns.reduce((a, r) => { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; return a + (s.passed || 0) }, 0)
    const totalFailed = doneRuns.reduce((a, r) => { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; return a + (s.failed || 0) }, 0)
    const totalRan = totalPassed + totalFailed
    const passRate = totalRan > 0 ? Math.round(totalPassed / totalRan * 100) : 0

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

    const statusBadge = (s) => {
        const map = { DONE: 'badge-pass', RUNNING: 'badge-running', ERROR: 'badge-error', RUNNING: 'badge-running' }
        return <span className={`badge ${map[s] || 'badge-error'}`}>{s}</span>
    }

    return (
        <div>
            <div className="kpi-grid">
                <div className="kpi-card total"><div className="num">{suites.length}</div><div className="lbl">Test Suites</div></div>
                <div className="kpi-card pass"><div className="num">{totalTC}</div><div className="lbl">Test Cases</div></div>
                <div className="kpi-card fail"><div className="num">{runs.length}</div><div className="lbl">Lần chạy</div></div>
                <div className="kpi-card rate"><div className="num">{passRate}%</div><div className="lbl">Tỉ lệ Pass</div></div>
            </div>

            <div className="grid-2 mb-6">
                <div className="card" style={{ padding: 20 }}>
                    <div className="font-bold mb-4" style={{ fontSize: 15 }}>📊 Tổng quan Pass/Fail</div>
                    <div style={{ maxHeight: 200 }}><Doughnut data={pieData} options={{ plugins: { legend: { position: 'bottom' } }, cutout: '60%', maintainAspectRatio: false }} /></div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <div className="font-bold mb-4" style={{ fontSize: 15 }}>📈 Lịch sử 10 lần chạy gần nhất</div>
                    <div style={{ maxHeight: 200 }}><Line data={lineData} options={{ plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } }, maintainAspectRatio: false }} /></div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4">
                <div className="font-bold" style={{ fontSize: 15 }}>🗂️ Danh sách Test Suite</div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('suites')}><Plus size={14} /> Tạo Suite mới</button>
            </div>
            <div className="card table-wrap">
                <table>
                    <thead><tr><th>Tên Suite</th><th>Số Test Case</th><th>Mô tả</th><th>Ngày tạo</th><th></th></tr></thead>
                    <tbody>
                        {suites.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>Chưa có Test Suite nào. Bắt đầu tạo mới!</p></div></td></tr>}
                        {suites.map(s => (
                            <tr key={s.id}>
                                <td><strong>{s.name}</strong></td>
                                <td>{s.tc_count || 0}</td>
                                <td className="text-muted">{s.description || '—'}</td>
                                <td className="text-muted text-sm">{new Date(s.created_at).toLocaleDateString('vi-VN')}</td>
                                <td><button className="btn btn-success btn-sm" onClick={() => navigate('monitor', { suite_id: s.id, suite_name: s.name })}><PlayCircle size={13} /> Run</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {runs.length > 0 && (
                <>
                    <div className="font-bold mt-4 mb-4" style={{ fontSize: 15 }}>🕒 Lần chạy gần nhất</div>
                    <div className="card table-wrap">
                        <table>
                            <thead><tr><th>Run ID</th><th>Suite</th><th>Trạng thái</th><th>Bắt đầu</th><th>Kết quả</th><th></th></tr></thead>
                            <tbody>
                                {runs.slice(0, 8).map(r => {
                                    const s = r.summary_json ? JSON.parse(r.summary_json) : {}
                                    return (
                                        <tr key={r.id}>
                                            <td className="text-sm text-muted">{r.id}</td>
                                            <td>{r.suite_id}</td>
                                            <td>{statusBadge(r.status)}</td>
                                            <td className="text-sm text-muted">{new Date(r.started_at).toLocaleString('vi-VN')}</td>
                                            <td className="text-sm"><span className="status-PASSED">{s.passed || 0} pass</span> / <span className="status-FAILED">{s.failed || 0} fail</span></td>
                                            <td>
                                                {r.status === 'DONE' && (
                                                    <div className="flex gap-2">
                                                        <a className="btn btn-ghost btn-sm" href={apiUrl(`/api/reports/${r.id}/html`)} target="_blank">HTML</a>
                                                        <a className="btn btn-ghost btn-sm" href={apiUrl(`/api/reports/${r.id}/pdf`)} target="_blank">PDF</a>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    )
}
