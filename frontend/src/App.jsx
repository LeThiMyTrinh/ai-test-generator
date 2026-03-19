import { useState } from 'react'
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
import './index.css'

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [ctx, setCtx] = useState({})

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
      case 'ui-checker': return <UICheckerV2 navigate={navigate} ctx={ctx} />
      default: return <Dashboard navigate={navigate} />
    }
  }

  const titles = {
    dashboard: 'Dashboard', projects: 'Quản lý Dự án', suites: 'Quản lý Test Suite',
    editor: 'Tạo / Chỉnh sửa Test Case', monitor: 'Theo dõi Thực thi',
    history: 'Lịch sử các lần chạy', 'ai-generator': '🤖 Tạo Test Case bằng AI',
    'ui-checker': '🔍 Kiểm tra UI'
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
