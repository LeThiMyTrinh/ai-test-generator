import { LayoutDashboard, FlaskConical, ClipboardList, Activity, History, Sparkles, FolderOpen, LogOut, Shield, ScanSearch, Video, BarChart3, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
    { id: 'dashboard', label: 'Tổng quan', Icon: LayoutDashboard },
    { id: 'projects', label: 'Quản lý dự án', Icon: FolderOpen },
    { id: 'suites', label: 'Bộ kiểm thử', Icon: FlaskConical },
    { id: 'editor', label: 'Tạo test case', Icon: ClipboardList },
    { id: 'ai-generator', label: 'Tạo test case tự động', Icon: Sparkles },
    { id: 'ui-checker', label: 'Kiểm thử giao diện', Icon: ScanSearch },
    { id: 'monitor', label: 'Giám sát thời gian thực', Icon: Activity },
    { id: 'history', label: 'Lịch sử thực thi', Icon: History },
    { id: 'recorder', label: 'Ghi & phát lại', Icon: Video },
    { id: 'analytics', label: 'Phân tích thông minh', Icon: BarChart3 },
    { id: 'settings', label: 'Cài đặt hệ thống', Icon: Settings },
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
