import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
    const { login } = useAuth()
    const [tab, setTab] = useState('login') // 'login' | 'register'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPw, setConfirmPw] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email.trim() || !password) return toast.error('Vui lòng nhập email và mật khẩu')

        if (tab === 'register') {
            if (password.length < 6) return toast.error('Mật khẩu tối thiểu 6 ký tự')
            if (password !== confirmPw) return toast.error('Mật khẩu xác nhận không khớp')
        }

        setLoading(true)
        try {
            const url = tab === 'login' ? '/api/auth/login' : '/api/auth/register'
            const r = await api.post(url, { email: email.trim(), password })
            login(r.data.token, r.data.user)
            toast.success(tab === 'login' ? 'Đăng nhập thành công!' : 'Đăng ký thành công!')
        } catch (err) {
            toast.error(err.response?.data?.error || 'Lỗi kết nối')
        } finally { setLoading(false) }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <h1>🤖 AutoTest Tool</h1>
                    <p>Web Automation Platform</p>
                </div>

                <div className="login-tabs">
                    <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
                        <LogIn size={15} /> Đăng nhập
                    </button>
                    <button className={`login-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
                        <UserPlus size={15} /> Đăng ký
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <div className="input-icon">
                            <Mail size={16} className="input-icon-left" />
                            <input
                                type="email"
                                className="form-control"
                                placeholder="you@company.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoFocus
                                style={{ paddingLeft: 38 }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Mật khẩu</label>
                        <div className="input-icon">
                            <Lock size={16} className="input-icon-left" />
                            <input
                                type={showPw ? 'text' : 'password'}
                                className="form-control"
                                placeholder="••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ paddingLeft: 38, paddingRight: 38 }}
                            />
                            <button type="button" className="input-icon-right" onClick={() => setShowPw(p => !p)}>
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {tab === 'register' && (
                        <div className="form-group">
                            <label className="form-label">Xác nhận mật khẩu</label>
                            <div className="input-icon">
                                <Lock size={16} className="input-icon-left" />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    className="form-control"
                                    placeholder="••••••"
                                    value={confirmPw}
                                    onChange={e => setConfirmPw(e.target.value)}
                                    style={{ paddingLeft: 38 }}
                                />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '11px 20px', fontSize: 15, justifyContent: 'center' }}>
                        {loading ? 'Đang xử lý...' : (tab === 'login' ? 'Đăng nhập' : 'Đăng ký')}
                    </button>
                </form>

                <div className="login-footer">
                    {tab === 'login'
                        ? <span>Chưa có tài khoản? <button className="link-btn" onClick={() => setTab('register')}>Đăng ký ngay</button></span>
                        : <span>Đã có tài khoản? <button className="link-btn" onClick={() => setTab('login')}>Đăng nhập</button></span>
                    }
                </div>
            </div>
        </div>
    )
}
