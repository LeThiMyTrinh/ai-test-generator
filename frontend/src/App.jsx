import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Suites from './pages/Suites'
import TestCaseEditor from './pages/TestCaseEditor'
import Monitor from './pages/Monitor'
import History from './pages/History'
import AIGenerator from './pages/AIGenerator'
import UICheckerV2 from './pages/UICheckerV2'
import UICheckerV3 from './pages/UICheckerV3'
import RecordReplay from './pages/RecordReplay'
import Analytics from './pages/Analytics'
import SettingsPage from './pages/SettingsPage'
import './index.css'

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [ctx, setCtx] = useState({})

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('autotest-theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#64748b' }}>Đang tải...</div>
  }

  if (!user) {
    return <Login />
  }

  const navigate = (p, data = {}) => { setPage(p); setCtx(data) }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard navigate={navigate} />
      case 'projects': return <Projects navigate={navigate} />
      case 'suites': return <Suites navigate={navigate} ctx={ctx} />
      case 'editor': return <TestCaseEditor navigate={navigate} ctx={ctx} />
      case 'monitor': return <Monitor navigate={navigate} ctx={ctx} />
      case 'history': return <History navigate={navigate} ctx={ctx} />
      case 'ai-generator': return <AIGenerator navigate={navigate} ctx={ctx} />
      case 'ui-checker': return <UICheckerV3 navigate={navigate} ctx={ctx} />
      case 'ui-checker-v2': return <UICheckerV2 navigate={navigate} ctx={ctx} />
      case 'recorder': return <RecordReplay navigate={navigate} ctx={ctx} />
      case 'analytics': return <Analytics navigate={navigate} ctx={ctx} />
      case 'settings': return <SettingsPage navigate={navigate} />
      default: return <Dashboard navigate={navigate} />
    }
  }

  const titles = {
    dashboard: 'Tổng quan', projects: 'Quản lý dự án', suites: 'Bộ kiểm thử',
    editor: 'Tạo test case', monitor: 'Giám sát thời gian thực',
    history: 'Lịch sử thực thi', 'ai-generator': 'Tạo test case tự động',
    'ui-checker': 'Kiểm thử giao diện',
    'ui-checker-v2': 'Kiểm thử giao diện V2',
    recorder: 'Ghi & phát lại',
    analytics: 'Phân tích thông minh',
    settings: 'Cài đặt hệ thống'
  }

  return (
    <Layout page={page} navigate={navigate} title={titles[page] || ''}>
      {renderPage()}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <AppContent />
    </AuthProvider>
  )
}
