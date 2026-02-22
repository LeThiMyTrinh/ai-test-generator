import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Suites from './pages/Suites'
import TestCaseEditor from './pages/TestCaseEditor'
import Monitor from './pages/Monitor'
import History from './pages/History'
import AIGenerator from './pages/AIGenerator'
import './index.css'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [ctx, setCtx] = useState({}) // shared context (e.g. suiteId, runId)

  const navigate = (p, data = {}) => { setPage(p); setCtx(data) }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard navigate={navigate} />
      case 'suites': return <Suites navigate={navigate} />
      case 'editor': return <TestCaseEditor navigate={navigate} ctx={ctx} />
      case 'monitor': return <Monitor navigate={navigate} ctx={ctx} />
      case 'history': return <History navigate={navigate} ctx={ctx} />
      case 'ai-generator': return <AIGenerator navigate={navigate} ctx={ctx} />
      default: return <Dashboard navigate={navigate} />
    }
  }

  const titles = {
    dashboard: 'Dashboard', suites: 'Quản lý Test Suite',
    editor: 'Tạo / Chỉnh sửa Test Case', monitor: 'Theo dõi Thực thi',
    history: 'Lịch sử các lần chạy', 'ai-generator': '🤖 Tạo Test Case bằng AI'
  }

  return (
    <>
      <Toaster position="top-right" />
      <Layout page={page} navigate={navigate} title={titles[page] || ''}>
        {renderPage()}
      </Layout>
    </>
  )
}
