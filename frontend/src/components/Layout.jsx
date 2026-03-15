import { LayoutDashboard, FlaskConical, ClipboardList, Activity, History, Sparkles, FolderOpen, LogOut, Shield, ScanSearch } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'projects', label: 'Quản lý Dự án', Icon: FolderOpen },
    { id: 'suites', label: 'Test Suites', Icon: FlaskConical },
    { id: 'editor', label: 'Tạo Test Case', Icon: ClipboardList },
    { id: 'ai-generator', label: 'Tạo TC bằng AI', Icon: Sparkles },
    { id: 'ui-checker', label: 'Kiểm tra UI', Icon: ScanSearch },
    { id: 'monitor', label: 'Live Monitor', Icon: Activity },
    { id: 'history', label: 'Lịch sử chạy', Icon: History },
]

export default function Layout({ children, page, navigate, title }) {
    const { user, logout } = useAuth()

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
                {/* User info footer */}
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-email">{user?.email}</div>
                            {user?.role === 'ADMIN' && (
                                <span className="sidebar-admin-badge"><Shield size={11} /> Admin</span>
                            )}
                        </div>
                        <button className="sidebar-logout" onClick={logout} title="Đăng xuất">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
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
