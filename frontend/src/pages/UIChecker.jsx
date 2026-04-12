import { useState, useEffect } from 'react'
import api from '../api/client'
import { ScanSearch, Loader2, AlertTriangle, CheckCircle2, XCircle, Info, Monitor, Tablet, Smartphone, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const SEVERITY_CONFIG = {
    CRITICAL: { color: '#991b1b', bg: '#fee2e2', icon: '🔴', label: 'Nghiêm trọng' },
    HIGH: { color: '#c2410c', bg: '#fff7ed', icon: '🟠', label: 'Cao' },
    MEDIUM: { color: '#a16207', bg: '#fefce8', icon: '🟡', label: 'Trung bình' },
    LOW: { color: '#15803d', bg: '#f0fdf4', icon: '🟢', label: 'Thấp' },
}

const TYPE_INFO = {
    HORIZONTAL_SCROLLBAR: { icon: '📏', name: 'Trang bị thanh cuộn ngang', fix: 'Kiểm tra các element có chiều rộng vượt quá màn hình. Thường do ảnh, bảng, hoặc khối nội dung quá rộng.' },
    OVERFLOW_X: { icon: '📏', name: 'Nội dung bị tràn ra ngoài', fix: 'Nội dung vượt ra khỏi vùng chứa. Cần điều chỉnh CSS overflow hoặc giảm kích thước nội dung.' },
    OUTSIDE_VIEWPORT: { icon: '🔲', name: 'Phần tử nằm ngoài vùng nhìn', fix: 'Phần tử bị đẩy ra ngoài màn hình. Có thể do CSS position/margin sai.' },
    BROKEN_IMAGE: { icon: '🖼️', name: 'Hình ảnh không tải được', fix: 'Đường dẫn ảnh bị sai hoặc ảnh không tồn tại. Cần kiểm tra lại URL ảnh.' },
    MISSING_ALT: { icon: '🏷️', name: 'Hình ảnh thiếu mô tả (alt)', fix: 'Ảnh cần có thuộc tính alt để mô tả nội dung, giúp người dùng khiếm thị và SEO.' },
    DISTORTED_IMAGE: { icon: '🖼️', name: 'Hình ảnh bị méo/biến dạng', fix: 'Tỉ lệ ảnh hiển thị sai so với kích thước gốc. Kiểm tra CSS width/height.' },
    JS_ERROR: { icon: '💥', name: 'Lỗi JavaScript', fix: 'Trang có lỗi JavaScript. Cần mở Console trình duyệt để xem chi tiết và sửa code.' },
    CONSOLE_ERROR: { icon: '⚠️', name: 'Cảnh báo/lỗi Console', fix: 'Có cảnh báo hoặc lỗi trong Console. Cần kiểm tra và xử lý.' },
    BROKEN_LINK: { icon: '🔗', name: 'Link bị hỏng (404)', fix: 'Đường dẫn không tồn tại. Cần cập nhật hoặc xóa link.' },
    RESPONSIVE_HIDDEN: { icon: '📱', name: 'Phần tử biến mất trên điện thoại', fix: 'Phần tử hiển thị ở Desktop nhưng ẩn ở Mobile. Kiểm tra xem đây có phải là chủ đích không.' },
    TEXT_TRUNCATED: { icon: '✂️', name: 'Chữ bị cắt/ẩn một phần', fix: 'Nội dung văn bản bị cắt do khung chứa quá nhỏ. Cần tăng kích thước hoặc cho phép xuống dòng.' },
    SMALL_TOUCH_TARGET: { icon: '👆', name: 'Nút/link quá nhỏ trên điện thoại', fix: 'Nút bấm nhỏ hơn 44×44px gây khó thao tác trên điện thoại. Cần tăng kích thước.' },
    ACCESSIBILITY: { icon: '♿', name: 'Lỗi trợ năng (Accessibility)', fix: 'Trang chưa đáp ứng tiêu chuẩn trợ năng WCAG, ảnh hưởng người dùng khuyết tật.' },
    NAVIGATION_ERROR: { icon: '🚫', name: 'Không thể mở trang', fix: 'Không truy cập được URL. Kiểm tra lại đường dẫn và kết nối mạng.' },
}

// Translate technical descriptions to user-friendly Vietnamese
function humanize(description) {
    // Accessibility rules
    if (description.includes('color contrast ratio')) return 'Độ tương phản chữ-nền quá thấp → Khó đọc nội dung'
    if (description.includes('alt text') || description.includes('alt attribute')) return 'Ảnh thiếu mô tả → Ảnh hưởng SEO và trợ năng'
    if (description.includes('aria-label') || description.includes('ARIA')) return 'Thiếu nhãn ARIA → Người dùng khiếm thị không biết chức năng'
    if (description.includes('heading') || description.includes('Heading')) return 'Cấu trúc tiêu đề sai thứ tự → Ảnh hưởng SEO'
    if (description.includes('label')) return 'Trường nhập liệu thiếu nhãn (label) → Người dùng không biết điền gì'
    if (description.includes('lang')) return 'Trang thiếu khai báo ngôn ngữ → Ảnh hưởng trợ năng'
    if (description.includes('tabindex')) return 'Thứ tự tab sai → Khó dùng bàn phím điều hướng'
    if (description.includes('focus')) return 'Phần tử không có hiệu ứng focus → Khó thấy khi dùng bàn phím'
    if (description.includes('landmark')) return 'Thiếu vùng landmark → Trình đọc màn hình khó điều hướng'
    if (description.includes('form') && description.includes('name')) return 'Form thiếu tên → Khó phân biệt các biểu mẫu'
    // Return original if no match (it's already Vietnamese from backend)
    return description.replace(/\[A11y\]\s*/g, '')
}

function viewportLabel(vp) {
    if (vp === 'desktop') return '🖥️ Desktop'
    if (vp === 'tablet') return '📱 Tablet'
    if (vp === 'mobile') return '📱 Mobile'
    if (vp === 'all') return '🌐 Tất cả'
    if (vp === 'cross') return '🔄 So sánh'
    return vp
}

export default function UIChecker() {
    const [url, setUrl] = useState('')
    const [presets, setPresets] = useState(null)
    const [desktop, setDesktop] = useState('1920x1080')
    const [tablet, setTablet] = useState('ipad-pro')
    const [mobile, setMobile] = useState('iphone-15')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [showLoginForm, setShowLoginForm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [filterSeverity, setFilterSeverity] = useState('ALL')
    const [expandedScreenshot, setExpandedScreenshot] = useState(null)
    const [expandedDetail, setExpandedDetail] = useState({})

    useEffect(() => {
        api.get('/api/ai/ui-presets').then(r => setPresets(r.data)).catch(() => { })
    }, [])

    const runCheck = async () => {
        if (!url.trim()) return toast.error('Vui lòng nhập URL')
        if (!url.startsWith('http')) return toast.error('URL phải bắt đầu bằng http:// hoặc https://')

        // If showLoginForm is true but credentials are missing, show error
        if (showLoginForm && (!loginEmail.trim() || !loginPassword.trim())) {
            return toast.error('Vui lòng nhập email và mật khẩu để đăng nhập')
        }

        setLoading(true)
        setResult(null)
        try {
            const payload = {
                url: url.trim(),
                desktop,
                tablet,
                mobile
            }

            // Add credentials if login form is shown
            if (showLoginForm) {
                payload.loginEmail = loginEmail.trim()
                payload.loginPassword = loginPassword
            }

            const r = await api.post('/api/ai/ui-check', payload, { timeout: 120000 })
            setResult(r.data)
            toast.success(`Kiểm tra hoàn tất: ${r.data.summary.total} vấn đề`)
        } catch (err) {
            toast.error(err.response?.data?.error || 'Lỗi kiểm tra UI')
        }
        setLoading(false)
    }

    const filteredIssues = result ? (filterSeverity === 'ALL' ? result.issues : result.issues.filter(i => i.severity === filterSeverity)) : []

    // Group issues by type
    const groupedIssues = {}
    filteredIssues.forEach(i => {
        if (!groupedIssues[i.type]) groupedIssues[i.type] = []
        groupedIssues[i.type].push(i)
    })

    const toggleDetail = (key) => setExpandedDetail(p => ({ ...p, [key]: !p[key] }))

    return (
        <div>
            {/* URL Input Form */}
            <div className="card" style={{ marginBottom: 24, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <ScanSearch size={22} style={{ color: 'var(--primary)' }} />
                    <h2 style={{ margin: 0, fontSize: 18 }}>Kiểm thử giao diện tự động</h2>
                </div>
                <p className="text-muted" style={{ marginBottom: 16 }}>
                    Nhập URL → Hệ thống tự động scan giao diện ở 3 thiết bị → Phát hiện bug UI
                </p>
                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>URL trang web</label>
                    <input type="url" className="input" placeholder="https://example.com" value={url}
                        onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && runCheck()}
                        style={{ width: '100%' }} disabled={loading} />
                </div>
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff4e6', borderRadius: 8, border: '1px solid #ffd666' }}>
                        <input type="checkbox" id="showLoginForm" checked={showLoginForm} onChange={e => setShowLoginForm(e.target.checked)} disabled={loading}
                            style={{ width: 16, height: 16, cursor: 'pointer' }} />
                        <label htmlFor="showLoginForm" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', flex: 1, margin: 0 }}>
                            🌐 Đăng nhập tự động (cho trang yêu cầu đăng nhập)
                        </label>
                    </div>
                    {showLoginForm && (
                        <div style={{ marginTop: 10, padding: '12px 14px', background: '#fafafa', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                            <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: '#374151' }}>Email đăng nhập</label>
                                <input type="email" className="input" placeholder="user@example.com" value={loginEmail}
                                    onChange={e => setLoginEmail(e.target.value)} disabled={loading}
                                    style={{ width: '100%', fontSize: 13 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: '#374151' }}>Mật khẩu</label>
                                <input type="password" className="input" placeholder="••••••••" value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)} disabled={loading}
                                    style={{ width: '100%', fontSize: 13 }} />
                            </div>
                            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8, marginBottom: 0 }}>
                                ⚠️ AI sẽ tự động tìm form đăng nhập, điền thông tin và login. Thông tin chỉ dùng 1 lần và không lưu trữ.
                            </p>
                        </div>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Monitor size={14} /> Desktop</label>
                        <select className="input" value={desktop} onChange={e => setDesktop(e.target.value)} disabled={loading} style={{ width: '100%' }}>
                            {presets ? presets.desktop.map(p => <option key={p.value} value={p.value}>{p.label}</option>) : <option value="1920x1080">Desktop 1920×1080</option>}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Tablet size={14} /> Tablet</label>
                        <select className="input" value={tablet} onChange={e => setTablet(e.target.value)} disabled={loading} style={{ width: '100%' }}>
                            {presets ? presets.tablet.map(p => <option key={p.value} value={p.value}>{p.label}</option>) : <option value="ipad-pro">iPad Pro 11</option>}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Smartphone size={14} /> Mobile</label>
                        <select className="input" value={mobile} onChange={e => setMobile(e.target.value)} disabled={loading} style={{ width: '100%' }}>
                            {presets ? presets.mobile.map(p => <option key={p.value} value={p.value}>{p.label}</option>) : <option value="iphone-15">iPhone 15</option>}
                        </select>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={runCheck} disabled={loading} style={{ width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 700 }}>
                    {loading ? (<><Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> Đang kiểm tra... (có thể mất 30-60 giây)</>)
                        : (<><ScanSearch size={16} style={{ marginRight: 6 }} /> Kiểm thử giao diện</>)}
                </button>
            </div>

            {loading && (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                    <Loader2 size={40} className="spin" style={{ color: 'var(--primary)', marginBottom: 12 }} />
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Đang scan giao diện...</div>
                    <p className="text-muted">Chụp ảnh 3 thiết bị → Phân tích DOM → Kiểm tra Accessibility</p>
                </div>
            )}

            {result && !loading && (
                <>
                    {/* Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                        {[
                            { key: 'ALL', n: result.summary.total, label: 'Tổng lỗi', color: 'var(--primary)' },
                            { key: 'CRITICAL', n: result.summary.critical, label: '🔴 Nghiêm trọng', color: '#991b1b' },
                            { key: 'HIGH', n: result.summary.high, label: '🟠 Cao', color: '#c2410c' },
                            { key: 'MEDIUM', n: result.summary.medium, label: '🟡 Trung bình', color: '#a16207' },
                            { key: 'LOW', n: result.summary.low, label: '🟢 Thấp', color: '#15803d' },
                        ].map(c => (
                            <div key={c.key} className="card" style={{ padding: '16px 12px', textAlign: 'center', cursor: 'pointer', border: filterSeverity === c.key ? `2px solid ${c.color}` : '', opacity: filterSeverity !== 'ALL' && filterSeverity !== c.key && c.key !== 'ALL' ? 0.5 : 1 }}
                                onClick={() => setFilterSeverity(f => f === c.key ? 'ALL' : c.key)}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.n}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{c.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Screenshots */}
                    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>📸 Ảnh chụp giao diện</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                            {['desktop', 'tablet', 'mobile'].map(vp => (
                                <div key={vp} style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                                        {vp === 'desktop' ? '🖥️' : '📱'} {result.devices[vp]}
                                    </div>
                                    {result.screenshots[vp] ? (
                                        <img src={result.screenshots[vp]} alt={vp}
                                            style={{ width: '100%', borderRadius: 8, border: '2px solid #e2e8f0', cursor: 'pointer', maxHeight: 400, objectFit: 'cover', objectPosition: 'top' }}
                                            onClick={() => setExpandedScreenshot(expandedScreenshot === vp ? null : vp)} />
                                    ) : (
                                        <div style={{ padding: 40, background: '#f8fafc', borderRadius: 8, color: '#94a3b8' }}>Không có ảnh</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {expandedScreenshot && result.screenshots[expandedScreenshot] && (
                        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <h3 style={{ margin: 0, fontSize: 15 }}>🔍 {result.devices[expandedScreenshot]} — Ảnh toàn trang</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => setExpandedScreenshot(null)}>✕ Đóng</button>
                            </div>
                            <img src={result.screenshots[expandedScreenshot]} alt="full" style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                        </div>
                    )}

                    {/* Issues — User-friendly card layout */}
                    <div className="card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>🐛 Kết quả kiểm tra ({filteredIssues.length} lỗi)</h3>
                            {filterSeverity !== 'ALL' && <button className="btn btn-ghost btn-sm" onClick={() => setFilterSeverity('ALL')}>Xem tất cả</button>}
                        </div>

                        {filteredIssues.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#16a34a' }}>
                                <CheckCircle2 size={44} style={{ marginBottom: 10 }} />
                                <div style={{ fontWeight: 700, fontSize: 18 }}>Tuyệt vời! Không phát hiện lỗi</div>
                                <p className="text-muted" style={{ marginTop: 6 }}>Giao diện đã đạt tiêu chuẩn kiểm tra</p>
                            </div>
                        ) : (
                            Object.entries(groupedIssues).map(([type, issues]) => {
                                const info = TYPE_INFO[type] || { icon: '❓', name: type, fix: '' }
                                return (
                                    <div key={type} style={{ marginBottom: 20 }}>
                                        {/* Group header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>
                                            <span style={{ fontSize: 20 }}>{info.icon}</span>
                                            <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{info.name}</span>
                                            <span style={{ background: '#e2e8f0', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{issues.length}</span>
                                        </div>

                                        {/* Fix suggestion for the group */}
                                        {info.fix && (
                                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#166534', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                                                <span><strong>Đề xuất sửa:</strong> {info.fix}</span>
                                            </div>
                                        )}

                                        {/* Issue cards */}
                                        {issues.map((issue, idx) => {
                                            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.MEDIUM
                                            const detailKey = `${type}-${idx}`
                                            const isExpanded = expandedDetail[detailKey]
                                            return (
                                                <div key={idx} style={{ marginBottom: 8, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', background: 'white' }}>
                                                    {/* Main row */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
                                                        {/* Severity badge */}
                                                        <span style={{ background: sev.bg, color: sev.color, padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 80, textAlign: 'center' }}>
                                                            {sev.icon} {sev.label}
                                                        </span>
                                                        {/* Description — Vietnamese, user-friendly */}
                                                        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#334155' }}>
                                                            {humanize(issue.description)}
                                                        </div>
                                                        {/* Viewport chip */}
                                                        {issue.viewport && (
                                                            <span style={{ background: '#f1f5f9', padding: '3px 10px', borderRadius: 8, fontSize: 11, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                {viewportLabel(issue.viewport)}
                                                            </span>
                                                        )}
                                                        {/* Expand toggle */}
                                                        {(issue.selector || issue.details) && (
                                                            <button onClick={() => toggleDetail(detailKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8' }}
                                                                title="Chi tiết kỹ thuật">
                                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Technical details — hidden by default */}
                                                    {isExpanded && (
                                                        <div style={{ padding: '0 16px 12px', borderTop: '1px solid #f1f5f9' }}>
                                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                {issue.selector && (
                                                                    <div><strong>Phần tử:</strong> <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{issue.selector}</code></div>
                                                                )}
                                                                {issue.details && (
                                                                    <div style={{ wordBreak: 'break-all' }}><strong>Chi tiết:</strong> {issue.details.substring(0, 200)}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: '#94a3b8' }}>
                        Thời gian kiểm tra: {(result.summary.duration_ms / 1000).toFixed(1)}s &nbsp;|&nbsp; URL: {result.url}
                    </div>
                </>
            )}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
