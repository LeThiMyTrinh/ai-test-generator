import { useState, useEffect } from 'react'
import api from '../api/client'
import { ScanSearch, Loader2, CheckCircle2, Monitor, Tablet, Smartphone, ChevronDown, ChevronRight, Code2, Users, Copy, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const SEVERITY_CONFIG = {
    CRITICAL: { color: '#991b1b', bg: '#fee2e2', icon: '🔴', label: 'Nghiêm trọng' },
    HIGH: { color: '#c2410c', bg: '#fff7ed', icon: '🟠', label: 'Cao' },
    MEDIUM: { color: '#a16207', bg: '#fefce8', icon: '🟡', label: 'Trung bình' },
    LOW: { color: '#15803d', bg: '#f0fdf4', icon: '🟢', label: 'Thấp' },
}

const PRIORITY_CONFIG = {
    CRITICAL: { color: '#dc2626', label: '🔥 Cần fix ngay', icon: '🔥' },
    MUST_FIX: { color: '#ea580c', label: '⚠️ Phải fix trước release', icon: '⚠️' },
    SHOULD_FIX: { color: '#ca8a04', label: '⚡ Nên fix', icon: '⚡' },
    NICE_TO_HAVE: { color: '#16a34a', label: '💡 Cải thiện', icon: '💡' },
    MINOR: { color: '#64748b', label: '📝 Nhỏ', icon: '📝' },
}

const TYPE_INFO = {
    HORIZONTAL_SCROLLBAR: { icon: '📏', name: 'Trang bị thanh cuộn ngang', businessImpact: 'Người dùng mobile không xem được toàn bộ nội dung', owner: 'Frontend Dev' },
    OVERFLOW_X: { icon: '📏', name: 'Nội dung bị tràn ra ngoài', businessImpact: 'Nội dung bị cắt, người dùng không đọc được hết', owner: 'Frontend Dev' },
    OUTSIDE_VIEWPORT: { icon: '🔲', name: 'Phần tử nằm ngoài vùng nhìn', businessImpact: 'Người dùng không thấy được nút/nội dung quan trọng', owner: 'Frontend Dev' },
    BROKEN_IMAGE: { icon: '🖼️', name: 'Hình ảnh không tải được', businessImpact: 'Trang trông thiếu chuyên nghiệp, mất thông tin hình ảnh', owner: 'Content Team' },
    MISSING_ALT: { icon: '🏷️', name: 'Hình ảnh thiếu mô tả', businessImpact: 'Ảnh hưởng SEO và người khiếm thị', owner: 'Content Team' },
    DISTORTED_IMAGE: { icon: '🖼️', name: 'Hình ảnh bị méo/biến dạng', businessImpact: 'Ảnh hưởng thẩm mỹ, giảm độ tin cậy', owner: 'Frontend Dev' },
    JS_ERROR: { icon: '💥', name: 'Lỗi JavaScript', businessImpact: 'Chức năng không hoạt động, có thể chặn người dùng', owner: 'Frontend Dev' },
    CONSOLE_ERROR: { icon: '⚠️', name: 'Cảnh báo Console', businessImpact: 'Có thể ảnh hưởng hiệu năng hoặc chức năng', owner: 'Frontend Dev' },
    BROKEN_LINK: { icon: '🔗', name: 'Link bị hỏng (404)', businessImpact: 'Người dùng không điều hướng được, trải nghiệm kém', owner: 'Content Team' },
    RESPONSIVE_HIDDEN: { icon: '📱', name: 'Phần tử biến mất trên điện thoại', businessImpact: 'Người dùng mobile thiếu thông tin/chức năng', owner: 'Frontend Dev' },
    TEXT_TRUNCATED: { icon: '✂️', name: 'Chữ bị cắt/ẩn một phần', businessImpact: 'Người dùng không đọc được hết nội dung', owner: 'Frontend Dev' },
    SMALL_TOUCH_TARGET: { icon: '👆', name: 'Nút/link quá nhỏ trên điện thoại', businessImpact: 'Khó bấm, gây khó chịu cho người dùng mobile', owner: 'Frontend Dev' },
    ACCESSIBILITY: { icon: '♿', name: 'Lỗi trợ năng', businessImpact: 'Người khuyết tật không sử dụng được, vi phạm tiêu chuẩn', owner: 'Frontend Dev' },
    NAVIGATION_ERROR: { icon: '🚫', name: 'Không thể mở trang', businessImpact: 'Chặn hoàn toàn người dùng truy cập', owner: 'DevOps' },
}

// Translate technical descriptions to user-friendly Vietnamese
function humanize(description) {
    // Color contrast
    if (description.includes('color contrast') || description.includes('contrast ratio')) {
        return '♿ Độ tương phản chữ-nền quá thấp (< 4.5:1) → Người khiếm thị không đọc được'
    }

    // Alt text
    if (description.includes('alt text') || description.includes('alt attribute') || description.includes('must have an alt')) {
        return '♿ Ảnh thiếu mô tả alt → Screen reader không biết ảnh là gì, ảnh hưởng SEO'
    }

    // ARIA labels
    if (description.includes('aria-label') || description.includes('aria-labelledby')) {
        return '♿ Element tương tác thiếu nhãn ARIA → Người khiếm thị không biết chức năng'
    }

    // Form labels
    if (description.includes('form') && (description.includes('label') || description.includes('associated'))) {
        return '♿ Input thiếu label → Screen reader không biết field này để nhập gì'
    }
    if (description.includes('label') && !description.includes('aria')) {
        return '♿ Trường nhập liệu thiếu nhãn → Người dùng không biết cần điền gì'
    }

    // Heading structure
    if (description.includes('heading') || description.includes('Heading')) {
        return '♿ Cấu trúc heading sai (h1→h3, nhảy cóc) → Screen reader điều hướng lỗi, ảnh hưởng SEO'
    }

    // Language
    if (description.includes('lang') || description.includes('language')) {
        return '♿ Trang thiếu khai báo lang="vi" → Screen reader đọc sai giọng'
    }

    // Tabindex
    if (description.includes('tabindex')) {
        return '♿ Thứ tự tab sai (dùng tabindex dương) → Người dùng bàn phím bị lạc'
    }

    // Focus
    if (description.includes('focus') || description.includes('keyboard')) {
        return '♿ Element không focus được bằng Tab → Người khuyết tật vận động không tương tác được'
    }

    // Landmark
    if (description.includes('landmark') || description.includes('region')) {
        return '♿ Thiếu vùng landmark (header/nav/main/footer) → Screen reader không nhảy nhanh được'
    }

    // Button/Link issues
    if (description.includes('button') && description.includes('name')) {
        return '♿ Button không có tên/text → Screen reader đọc "Button" mà không biết chức năng gì'
    }
    if (description.includes('link') && description.includes('name')) {
        return '♿ Link không có text → Screen reader không biết link dẫn đến đâu'
    }

    // Form name
    if (description.includes('form') && description.includes('name')) {
        return '♿ Form thiếu tên → Khó phân biệt các biểu mẫu trên trang'
    }

    // Image as button
    if (description.includes('image') && description.includes('button')) {
        return '♿ Dùng ảnh làm button nhưng thiếu alt → Screen reader không biết nút này làm gì'
    }

    // Role issues
    if (description.includes('role')) {
        return '♿ Element dùng sai ARIA role → Screen reader hiểu sai chức năng'
    }

    // Generic fallback
    return description.replace(/\[A11y\]\s*/g, '♿ ')
}

function viewportLabel(vp) {
    if (vp === 'desktop') return '🖥️ Desktop'
    if (vp === 'tablet') return '📱 Tablet'
    if (vp === 'mobile') return '📱 Mobile'
    if (vp === 'all') return '🌐 Tất cả'
    if (vp === 'cross') return '🔄 So sánh'
    return vp
}

// Executive Summary Component
function ExecutiveSummary({ result }) {
    const score = Math.max(0, Math.min(100, 100 - (result.summary.total * 2)))
    const mustFix = result.issues.filter(i => i.metadata?.priority === 'CRITICAL' || i.metadata?.priority === 'MUST_FIX').length
    const shouldFix = result.issues.filter(i => i.metadata?.priority === 'SHOULD_FIX').length
    const improvements = result.issues.filter(i => i.metadata?.priority === 'NICE_TO_HAVE' || i.metadata?.priority === 'MINOR').length

    const mobileIssues = result.issues.filter(i => i.viewport === 'mobile').length
    const desktopIssues = result.issues.filter(i => i.viewport === 'desktop').length

    return (
        <div className="card" style={{ padding: 24, marginBottom: 20, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800 }}>🎯 Tổng quan chất lượng UI</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 16, backdropFilter: 'blur(10px)' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 4 }}>{score}/100</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>Điểm chất lượng</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 16, backdropFilter: 'blur(10px)' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 4, color: '#fca5a5' }}>{mustFix}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>🔥 Cần fix ngay</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 16, backdropFilter: 'blur(10px)' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 4, color: '#fde68a' }}>{shouldFix}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>⚠️ Nên fix</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 16, backdropFilter: 'blur(10px)' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 4, color: '#a7f3d0' }}>{improvements}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>💡 Cải thiện</div>
                </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 16px', fontSize: 13, backdropFilter: 'blur(10px)' }}>
                    📱 Mobile: {mobileIssues > 10 ? '🔴 Nhiều vấn đề' : mobileIssues > 5 ? '🟡 Cần chú ý' : '🟢 Ổn định'}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 16px', fontSize: 13, backdropFilter: 'blur(10px)' }}>
                    🖥️ Desktop: {desktopIssues > 10 ? '🔴 Nhiều vấn đề' : desktopIssues > 5 ? '🟡 Cần chú ý' : '🟢 Ổn định'}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 16px', fontSize: 13, backdropFilter: 'blur(10px)' }}>
                    ⏱️ Thời gian fix ước tính: {Math.ceil(result.summary.total * 10 / 60)} giờ
                </div>
            </div>
        </div>
    )
}

// Manager View Component
function ManagerView({ result, onIssueHover, onIssueClick }) {
    const [showA11yInfo, setShowA11yInfo] = useState(false)

    const categorizeByImpact = (issues) => {
        const categories = {
            blocking: { label: '🚫 Chặn người dùng', issues: [], color: '#dc2626', description: 'Các lỗi này chặn hoàn toàn người dùng thực hiện hành động' },
            critical_ux: { label: '😣 Gây khó chịu', issues: [], color: '#ea580c', description: 'Lỗi ảnh hưởng nghiêm trọng đến trải nghiệm người dùng' },
            mobile_issues: { label: '📱 Khó dùng trên điện thoại', issues: [], color: '#ca8a04', description: 'Các vấn đề chỉ xuất hiện trên mobile/tablet' },
            accessibility: { label: '♿ Không thân thiện với người khuyết tật', issues: [], color: '#2563eb', description: 'Vi phạm tiêu chuẩn WCAG, ảnh hưởng người khiếm thị/khuyết tật vận động' },
            visual: { label: '🎨 Ảnh hưởng thẩm mỹ', issues: [], color: '#7c3aed', description: 'Lỗi về giao diện, không chặn chức năng nhưng giảm chất lượng' },
            other: { label: '📝 Khác', issues: [], color: '#64748b', description: 'Các vấn đề khác' }
        }

        issues.forEach(issue => {
            const type = issue.type
            if (['NAVIGATION_ERROR', 'JS_ERROR', 'BROKEN_LINK'].includes(type)) {
                categories.blocking.issues.push(issue)
            } else if (['HORIZONTAL_SCROLLBAR', 'BROKEN_IMAGE', 'OVERFLOW_X'].includes(type)) {
                categories.critical_ux.issues.push(issue)
            } else if (['SMALL_TOUCH_TARGET', 'TEXT_TRUNCATED', 'RESPONSIVE_HIDDEN'].includes(type) && issue.viewport === 'mobile') {
                categories.mobile_issues.issues.push(issue)
            } else if (['ACCESSIBILITY', 'MISSING_ALT', 'LOW_CONTRAST'].includes(type)) {
                categories.accessibility.issues.push(issue)
            } else if (['DISTORTED_IMAGE', 'OUTSIDE_VIEWPORT'].includes(type)) {
                categories.visual.issues.push(issue)
            } else {
                categories.other.issues.push(issue)
            }
        })

        return Object.entries(categories).filter(([_, cat]) => cat.issues.length > 0)
    }

    const categories = categorizeByImpact(result.issues)
    const hasA11yIssues = categories.some(([key, _]) => key === 'accessibility')

    return (
        <div>
            {/* Accessibility Info Banner (if has A11y issues) */}
            {hasA11yIssues && (
                <div className="card" style={{ padding: 16, marginBottom: 20, background: '#dbeafe', border: '2px solid #3b82f6' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 28, flexShrink: 0 }}>♿</span>
                        <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 8px', fontSize: 16, color: '#1e40af' }}>📌 Phát hiện lỗi Trợ năng (Accessibility)</h4>
                            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                                <strong>Accessibility</strong> là khả năng website phục vụ <strong>tất cả mọi người</strong>, đặc biệt là người khuyết tật:
                                <br />• 👁️ Người khiếm thị (dùng Screen reader - trình đọc màn hình)
                                <br />• ♿ Người khuyết tật vận động (chỉ dùng bàn phím, không dùng chuột)
                                <br />• 🧠 Người suy giảm nhận thức (cần nội dung rõ ràng)
                            </p>
                            <button
                                onClick={() => setShowA11yInfo(!showA11yInfo)}
                                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                            >
                                {showA11yInfo ? '▼ Ẩn chi tiết' : '▶ Xem khi nào lỗi A11y xuất hiện'}
                            </button>
                            {showA11yInfo && (
                                <div style={{ marginTop: 12, padding: 12, background: 'white', borderRadius: 8, fontSize: 12, color: '#1e293b' }}>
                                    <strong style={{ display: 'block', marginBottom: 8, color: '#1e40af' }}>Lỗi Accessibility xuất hiện khi:</strong>
                                    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                                        <li><strong>Độ tương phản thấp:</strong> Tỷ lệ màu chữ/nền {'<'} 4.5:1 → Khó đọc</li>
                                        <li><strong>Ảnh thiếu alt:</strong> {'<img>'} không có alt → Screen reader không mô tả được</li>
                                        <li><strong>Form thiếu label:</strong> Input không có label → Không biết điền gì</li>
                                        <li><strong>Heading sai thứ tự:</strong> h1→h3 (nhảy cóc) → Điều hướng lỗi</li>
                                        <li><strong>Không focus được:</strong> Element không Tab được → Người khuyết tật vận động bị chặn</li>
                                        <li><strong>Thiếu khai báo ngôn ngữ:</strong> Không có lang="vi" → Screen reader đọc sai giọng</li>
                                    </ul>
                                    <div style={{ marginTop: 10, padding: 10, background: '#fef3c7', borderRadius: 6, border: '1px solid #f59e0b' }}>
                                        <strong style={{ color: '#92400e' }}>⚖️ Lưu ý pháp lý:</strong>
                                        <span style={{ color: '#92400e', fontSize: 11 }}> Ở nhiều nước, website phải tuân thủ tiêu chuẩn WCAG. Vi phạm có thể bị kiện.</span>
                                    </div>
                                    <a href="/ACCESSIBILITY_GUIDE.md" target="_blank" style={{ display: 'inline-block', marginTop: 8, color: '#3b82f6', fontWeight: 600, textDecoration: 'underline' }}>
                                        📖 Đọc hướng dẫn chi tiết về Accessibility
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {categories.map(([key, category]) => (
                <div key={key} className="card" style={{ padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: category.color }}>{category.label}</h3>
                        <span style={{ background: category.color, color: 'white', padding: '2px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                            {category.issues.length}
                        </span>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', paddingBottom: 12, borderBottom: `3px solid ${category.color}` }}>
                        {category.description}
                    </p>

                    {category.issues.map((issue, idx) => {
                        const info = TYPE_INFO[issue.type] || {}
                        const priority = PRIORITY_CONFIG[issue.metadata?.priority] || PRIORITY_CONFIG.SHOULD_FIX
                        return (
                            <div
                                key={idx}
                                onMouseEnter={() => onIssueHover(issue)}
                                onMouseLeave={() => onIssueHover(null)}
                                onClick={() => onIssueClick(issue)}
                                style={{
                                    marginBottom: 12,
                                    borderRadius: 12,
                                    border: '2px solid #e5e7eb',
                                    padding: 16,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: 'white'
                                }}
                                onMouseOver={e => e.currentTarget.style.borderColor = category.color}
                                onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                            >
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: 28, flexShrink: 0 }}>{info.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{info.name}</span>
                                            <span style={{ background: priority.color, color: 'white', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                                {priority.icon} {priority.label.split(' ')[1]}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>
                                            <strong>Tác động:</strong> {info.businessImpact}
                                        </div>
                                        <div style={{ fontSize: 13, color: '#64748b' }}>
                                            {humanize(issue.description)}
                                        </div>
                                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                                            <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, color: '#475569', fontWeight: 600 }}>
                                                👤 {info.owner}
                                            </span>
                                            {issue.viewport && (
                                                <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, color: '#475569', fontWeight: 600 }}>
                                                    {viewportLabel(issue.viewport)}
                                                </span>
                                            )}
                                            {issue.autoFix?.estimatedTime && (
                                                <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, color: '#475569', fontWeight: 600 }}>
                                                    ⏱️ {issue.autoFix.estimatedTime}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

// Developer View Component
function DeveloperView({ result, onIssueHover, onIssueClick }) {
    const [expandedDetail, setExpandedDetail] = useState({})
    const toggleDetail = (key) => setExpandedDetail(p => ({ ...p, [key]: !p[key] }))

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        toast.success('Đã copy vào clipboard')
    }

    const groupedIssues = {}
    result.issues.forEach(i => {
        if (!groupedIssues[i.type]) groupedIssues[i.type] = []
        groupedIssues[i.type].push(i)
    })

    return (
        <div>
            {Object.entries(groupedIssues).map(([type, issues]) => {
                const info = TYPE_INFO[type] || { icon: '❓', name: type }
                return (
                    <div key={type} className="card" style={{ marginBottom: 20, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #e2e8f0' }}>
                            <span style={{ fontSize: 22 }}>{info.icon}</span>
                            <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{info.name}</span>
                            <span style={{ background: '#e2e8f0', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{issues.length}</span>
                        </div>

                        {issues.map((issue, idx) => {
                            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.MEDIUM
                            const detailKey = `${type}-${idx}`
                            const isExpanded = expandedDetail[detailKey]
                            return (
                                <div
                                    key={idx}
                                    onMouseEnter={() => onIssueHover(issue)}
                                    onMouseLeave={() => onIssueHover(null)}
                                    style={{ marginBottom: 12, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', background: 'white' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer' }}
                                        onClick={() => toggleDetail(detailKey)}>
                                        <span style={{ background: sev.bg, color: sev.color, padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 80, textAlign: 'center' }}>
                                            {sev.icon} {sev.label}
                                        </span>
                                        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#334155' }}>
                                            {humanize(issue.description)}
                                        </div>
                                        {issue.viewport && (
                                            <span style={{ background: '#f1f5f9', padding: '3px 10px', borderRadius: 8, fontSize: 11, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {viewportLabel(issue.viewport)}
                                            </span>
                                        )}
                                        {issue.score !== undefined && (
                                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                                Score: {issue.score}
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
                                    </div>

                                    {isExpanded && (
                                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9', marginTop: 0, background: '#fafafa' }}>
                                            <div style={{ marginTop: 12 }}>
                                                {issue.selector && (
                                                    <div style={{ marginBottom: 8, fontSize: 12 }}>
                                                        <strong style={{ color: '#475569' }}>Selector:</strong>
                                                        <code style={{ background: '#1e293b', color: '#f1f5f9', padding: '4px 8px', borderRadius: 6, fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>
                                                            {issue.selector}
                                                        </code>
                                                        <button onClick={() => copyToClipboard(issue.selector)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}>
                                                            <Copy size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                                {issue.details && (
                                                    <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
                                                        <strong>Chi tiết:</strong> {issue.details}
                                                    </div>
                                                )}
                                                {issue.metadata && (
                                                    <div style={{ marginBottom: 8, fontSize: 12 }}>
                                                        <strong style={{ color: '#475569' }}>Priority:</strong> {issue.metadata.priority} |
                                                        <strong style={{ color: '#475569', marginLeft: 8 }}>Fix Effort:</strong> {issue.metadata.fixEffort} |
                                                        <strong style={{ color: '#475569', marginLeft: 8 }}>User Impact:</strong> {issue.metadata.userImpact}
                                                    </div>
                                                )}
                                                {issue.autoFix && (
                                                    <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', marginBottom: 8 }}>
                                                            💡 {issue.autoFix.title}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#15803d', marginBottom: 8 }}>
                                                            {issue.autoFix.description}
                                                        </div>
                                                        {issue.autoFix.code && (
                                                            <div style={{ position: 'relative' }}>
                                                                <pre style={{ background: '#1e293b', color: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto', margin: '8px 0', fontFamily: 'monospace' }}>
                                                                    {issue.autoFix.code}
                                                                </pre>
                                                                <button
                                                                    onClick={() => copyToClipboard(issue.autoFix.code)}
                                                                    style={{ position: 'absolute', top: 16, right: 16, background: '#475569', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                                                                >
                                                                    <Copy size={12} /> Copy
                                                                </button>
                                                            </div>
                                                        )}
                                                        {issue.autoFix.steps && (
                                                            <div style={{ marginTop: 8 }}>
                                                                <strong style={{ fontSize: 12, color: '#166534' }}>Các bước fix:</strong>
                                                                <ol style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 12, color: '#15803d' }}>
                                                                    {issue.autoFix.steps.map((step, i) => <li key={i} style={{ marginBottom: 4 }}>{step}</li>)}
                                                                </ol>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )
}

// Image with Highlights Component
function ImageWithHighlights({ screenshot, issues, viewport, hoveredIssue, onIssueClick }) {
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

    const handleImageLoad = (e) => {
        setImageLoaded(true)
        setImageDimensions({ width: e.target.naturalWidth, height: e.target.naturalHeight })
    }

    const viewportIssues = issues.filter(i => i.viewport === viewport && i.position)

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <img
                src={screenshot}
                alt={viewport}
                style={{ width: '100%', borderRadius: 8, border: '2px solid #e2e8f0', display: 'block' }}
                onLoad={handleImageLoad}
            />
            {imageLoaded && (
                <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    {viewportIssues.map((issue, idx) => {
                        if (!issue.position) return null
                        const { x, y, width, height } = issue.position
                        const isHovered = hoveredIssue?.position?.x === x && hoveredIssue?.position?.y === y
                        const severity = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.MEDIUM

                        return (
                            <g key={idx}>
                                <rect
                                    x={x}
                                    y={y}
                                    width={width || 100}
                                    height={height || 100}
                                    fill={isHovered ? severity.color : 'rgba(239, 68, 68, 0.2)'}
                                    stroke={severity.color}
                                    strokeWidth={isHovered ? 4 : 2}
                                    strokeDasharray={isHovered ? '0' : '5,5'}
                                    rx={4}
                                    style={{ cursor: 'pointer', pointerEvents: 'all', transition: 'all 0.2s' }}
                                    onClick={() => onIssueClick(issue)}
                                />
                                {!isHovered && (
                                    <circle
                                        cx={x + 15}
                                        cy={y + 15}
                                        r={15}
                                        fill={severity.color}
                                        style={{ cursor: 'pointer', pointerEvents: 'all' }}
                                        onClick={() => onIssueClick(issue)}
                                    />
                                )}
                                {!isHovered && (
                                    <text
                                        x={x + 15}
                                        y={y + 20}
                                        fill="white"
                                        fontSize="14"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {idx + 1}
                                    </text>
                                )}
                            </g>
                        )
                    })}
                </svg>
            )}
        </div>
    )
}

export default function UICheckerV2() {
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
    const [viewMode, setViewMode] = useState('manager') // 'manager' or 'developer'
    const [hoveredIssue, setHoveredIssue] = useState(null)
    const [selectedIssue, setSelectedIssue] = useState(null)

    useEffect(() => {
        api.get('/api/ai/ui-presets').then(r => setPresets(r.data)).catch(() => { })
    }, [])

    const runCheck = async () => {
        if (!url.trim()) return toast.error('Vui lòng nhập URL')
        if (!url.startsWith('http')) return toast.error('URL phải bắt đầu bằng http:// hoặc https://')

        if (showLoginForm && (!loginEmail.trim() || !loginPassword.trim())) {
            return toast.error('Vui lòng nhập email và mật khẩu để đăng nhập')
        }

        setLoading(true)
        setResult(null)
        try {
            const payload = { url: url.trim(), desktop, tablet, mobile }
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

    return (
        <div>
            {/* URL Input Form */}
            <div className="card" style={{ marginBottom: 24, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <ScanSearch size={22} style={{ color: 'var(--primary)' }} />
                    <h2 style={{ margin: 0, fontSize: 18 }}>Kiểm tra UI tự động</h2>
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
                        : (<><ScanSearch size={16} style={{ marginRight: 6 }} /> Kiểm tra UI</>)}
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
                    <ExecutiveSummary result={result} />

                    {/* View Mode Toggle */}
                    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: '#64748b' }}>Chế độ xem:</span>
                            <button
                                onClick={() => setViewMode('manager')}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: 8,
                                    border: viewMode === 'manager' ? '2px solid #667eea' : '2px solid #e2e8f0',
                                    background: viewMode === 'manager' ? '#667eea' : 'white',
                                    color: viewMode === 'manager' ? 'white' : '#64748b',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <Users size={16} /> Quản lý / PM
                            </button>
                            <button
                                onClick={() => setViewMode('developer')}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: 8,
                                    border: viewMode === 'developer' ? '2px solid #667eea' : '2px solid #e2e8f0',
                                    background: viewMode === 'developer' ? '#667eea' : 'white',
                                    color: viewMode === 'developer' ? 'white' : '#64748b',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <Code2 size={16} /> Developer
                            </button>
                        </div>
                    </div>

                    {/* Screenshots with Highlights */}
                    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>📸 Ảnh chụp giao diện (Click vào lỗi để xem)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                            {['desktop', 'tablet', 'mobile'].map(vp => (
                                <div key={vp} style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                                        {vp === 'desktop' ? '🖥️' : '📱'} {result.devices[vp]}
                                    </div>
                                    {result.screenshots[vp] ? (
                                        <ImageWithHighlights
                                            screenshot={result.screenshots[vp]}
                                            issues={result.issues}
                                            viewport={vp}
                                            hoveredIssue={hoveredIssue}
                                            onIssueClick={setSelectedIssue}
                                        />
                                    ) : (
                                        <div style={{ padding: 40, background: '#f8fafc', borderRadius: 8, color: '#94a3b8' }}>Không có ảnh</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Selected Issue Detail */}
                    {selectedIssue && (
                        <div className="card" style={{ padding: 20, marginBottom: 20, border: '3px solid #667eea' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <h3 style={{ margin: 0, fontSize: 16, color: '#667eea' }}>🔍 Chi tiết lỗi đã chọn</h3>
                                <button onClick={() => setSelectedIssue(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>✕</button>
                            </div>
                            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{humanize(selectedIssue.description)}</div>
                                {selectedIssue.selector && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}><strong>Selector:</strong> <code>{selectedIssue.selector}</code></div>}
                                {selectedIssue.details && <div style={{ fontSize: 12, color: '#64748b' }}><strong>Chi tiết:</strong> {selectedIssue.details}</div>}
                            </div>
                        </div>
                    )}

                    {/* Issues List */}
                    {viewMode === 'manager' ? (
                        <ManagerView result={result} onIssueHover={setHoveredIssue} onIssueClick={setSelectedIssue} />
                    ) : (
                        <DeveloperView result={result} onIssueHover={setHoveredIssue} onIssueClick={setSelectedIssue} />
                    )}

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
