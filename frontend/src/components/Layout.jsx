import { LayoutDashboard, FlaskConical, ClipboardList, Activity, History, Sparkles } from 'lucide-react'

const NAV = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'suites', label: 'Quản lý Test Suite', Icon: FlaskConical },
    { id: 'editor', label: 'Tạo Test Case', Icon: ClipboardList },
    { id: 'ai-generator', label: 'Tạo TC bằng AI', Icon: Sparkles },
    { id: 'monitor', label: 'Live Monitor', Icon: Activity },
    { id: 'history', label: 'Lịch sử chạy', Icon: History },
]

export default function Layout({ children, page, navigate, title }) {
    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <h2>🤖 AutoTest Tool</h2>
                    <span>Web Automation Platform</span>
                </div>
                <nav className="sidebar-nav">
                    {NAV.map(({ id, label, Icon }) => (
                        <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
                            <Icon size={17} />
                            {label}
                        </button>
                    ))}
                </nav>
            </aside>
            <div className="main">
                <div className="topbar">
                    <h1>{title}</h1>
                </div>
                <div className="content">{children}</div>
            </div>
        </div>
    )
}
