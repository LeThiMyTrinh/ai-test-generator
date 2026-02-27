import { useEffect, useState, useRef } from 'react'
import api, { apiUrl } from '../api/client'
import toast from 'react-hot-toast'
import { Plus, Trash2, Upload, Download, Save, ArrowUp, ArrowDown, X, Sparkles, Settings, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'

const ACTIONS = ['navigate', 'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot']

const ACTION_LABELS = {
    navigate: '🌐 Mở trang', click: '👆 Click', fill: '✏️ Nhập', select: '📋 Chọn',
    hover: '🖱️ Di chuột', assert_text: '🔍 Kiểm tra text', assert_visible: '👁️ Kiểm tra hiển thị',
    assert_url: '🔗 Kiểm tra URL', wait: '⏱️ Chờ', screenshot: '📸 Chụp ảnh'
}

const emptyStep = (i) => ({ step_id: i, action: 'click', selector: '', value: '', expected: '', description: '' })

const DEVICE_OPTIONS = [
    { value: '', label: '🖥️ Desktop (mặc định)' },
    { value: 'iphone-15', label: '📱 iPhone 15 (390×844)' },
    { value: 'iphone-15-pro', label: '📱 iPhone 15 Pro (393×852)' },
    { value: 'iphone-14', label: '📱 iPhone 14 (390×844)' },
    { value: 'iphone-13', label: '📱 iPhone 13 (390×844)' },
    { value: 'iphone-12', label: '📱 iPhone 12 (390×844)' },
    { value: 'iphone-se', label: '📱 iPhone SE (375×667)' },
    { value: 'pixel-7', label: '📱 Pixel 7 (412×915)' },
    { value: 'pixel-5', label: '📱 Pixel 5 (393×851)' },
    { value: 'galaxy-s23', label: '📱 Galaxy S23 (360×780)' },
    { value: 'galaxy-s9', label: '📱 Galaxy S9+ (320×658)' },
    { value: 'ipad-pro', label: '📟 iPad Pro 11 (834×1194)' },
    { value: 'ipad-mini', label: '📟 iPad Mini (768×1024)' },
    { value: 'galaxy-tab', label: '📟 Galaxy Tab S4 (712×1138)' },
]

const emptyTC = () => ({ title: '', description: '', url: '', browser: 'chromium', device: '', steps: [emptyStep(1)], nlText: '' })

const NL_PLACEHOLDER = `Viết các bước kiểm thử bằng ngôn ngữ tự nhiên, mỗi dòng = 1 bước.

Ví dụ:
Mở trang https://example.com/login
Nhập "admin@test.com" vào ô Email
Nhập "123456" vào ô Mật khẩu
Nhấn nút "Đăng nhập"
Kiểm tra URL chứa /dashboard
Kiểm tra text "Xin chào" hiển thị
Chờ 2 giây
Chụp ảnh màn hình`

export default function TestCaseEditor({ navigate, ctx }) {
    const { suite_id, suite_name } = ctx || {}
    const [suites, setSuites] = useState([])
    const [selectedSuite, setSelectedSuite] = useState(suite_id || '')
    const [testCases, setTestCases] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState(emptyTC())
    const [editId, setEditId] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [tabMode, setTabMode] = useState('nl') // 'nl' | 'tech'
    const [converting, setConverting] = useState(false)
    const [warnings, setWarnings] = useState([])
    const [showPreview, setShowPreview] = useState(false)
    const fileRef = useRef()

    useEffect(() => { api.get('/api/test-suites').then(r => setSuites(r.data)) }, [])
    useEffect(() => { if (selectedSuite) loadTCs() }, [selectedSuite])

    const loadTCs = () => api.get(`/api/test-cases?suite_id=${selectedSuite}`).then(r => setTestCases(r.data))

    // NL conversion
    const convertNL = async () => {
        if (!form.nlText.trim()) return toast.error('Vui lòng nhập các bước')
        setConverting(true)
        setWarnings([])
        try {
            const r = await api.post('/api/nl-parser/convert', { text: form.nlText })
            const { steps, warnings: warns } = r.data
            if (steps.length === 0) {
                toast.error('Không nhận diện được bước nào. Hãy thử diễn đạt lại.')
                setWarnings(warns)
                return
            }
            setForm(p => ({ ...p, steps }))
            setWarnings(warns)
            setShowPreview(true)
            toast.success(`Đã chuyển đổi ${steps.length} bước thành công!`)
            if (warns.length > 0) {
                toast(`⚠️ ${warns.length} dòng không nhận diện được`, { icon: '⚠️' })
            }
        } catch (e) {
            toast.error(e.response?.data?.error || 'Lỗi chuyển đổi')
        } finally { setConverting(false) }
    }

    // Steps management (for tech tab)
    const addStep = () => setForm(p => ({ ...p, steps: [...p.steps, emptyStep(p.steps.length + 1)] }))
    const removeStep = (i) => setForm(p => ({ ...p, steps: p.steps.filter((_, j) => j !== i).map((s, j) => ({ ...s, step_id: j + 1 })) }))
    const moveStep = (i, dir) => {
        setForm(p => {
            const s = [...p.steps];[s[i], s[i + dir]] = [s[i + dir], s[i]]
            return { ...p, steps: s.map((st, j) => ({ ...st, step_id: j + 1 })) }
        })
    }
    const updateStep = (i, field, val) => setForm(p => ({ ...p, steps: p.steps.map((s, j) => j === i ? { ...s, [field]: val } : s) }))

    const save = async () => {
        if (!selectedSuite) return toast.error('Vui lòng chọn Suite')
        if (!form.title || !form.url) return toast.error('Tiêu đề và URL là bắt buộc')
        if (form.steps.length === 0) return toast.error('Cần có ít nhất 1 bước thực hiện')
        const payload = { ...form, suite_id: selectedSuite }
        delete payload.nlText // Don't send NL text to API
        if (editId) { await api.put(`/api/test-cases/${editId}`, payload); toast.success('Đã cập nhật') }
        else { await api.post('/api/test-cases', payload); toast.success('Đã tạo test case') }
        setShowForm(false); setForm(emptyTC()); setEditId(null); setShowPreview(false); setWarnings([]); loadTCs()
    }

    const del = async (id, title) => {
        if (!confirm(`Xóa test case "${title}"?`)) return
        await api.delete(`/api/test-cases/${id}`); toast.success('Đã xóa'); loadTCs()
    }

    const openEdit = (tc) => {
        setEditId(tc.id)
        const nlLines = (tc.steps || []).map(s => s.description || `${s.action}: ${s.selector || s.value || ''}`).join('\n')
        setForm({ title: tc.title, description: tc.description, url: tc.url, browser: tc.browser, device: tc.device || '', steps: tc.steps || [emptyStep(1)], nlText: nlLines })
        setTabMode('nl')
        setShowPreview(true)
        setShowForm(true)
    }

    const handleFileUpload = async (file) => {
        if (!selectedSuite) return toast.error('Vui lòng chọn Suite trước khi upload')
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (ext !== 'xlsx') return toast.error('Chỉ chấp nhận file .xlsx')
        const fd = new FormData(); fd.append('file', file); fd.append('suite_id', selectedSuite)
        setUploading(true)
        try {
            const r = await api.post('/api/test-cases/import/excel', fd)
            toast.success(`Đã import ${r.data.imported} test case`)
            if (r.data.warnings && r.data.warnings.length > 0) {
                r.data.warnings.forEach(w => {
                    toast(`⚠️ ${w.tc_id}: ${w.warnings.length} bước không nhận diện`, { icon: '⚠️', duration: 5000 })
                })
            }
            loadTCs()
        } catch (e) { toast.error(e.response?.data?.error || 'Lỗi import') } finally { setUploading(false) }
    }

    const needsSelector = ['click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible']
    const needsValue = ['fill', 'select', 'navigate', 'wait']
    const needsExpected = ['assert_text', 'assert_url']

    return (
        <div>
            {/* Suite selector */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <div className="flex gap-3 items-center">
                    <div style={{ flex: 1 }}>
                        <label className="form-label">Chọn Test Suite</label>
                        <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)}>
                            <option value="">-- Chọn Suite --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    {selectedSuite && (
                        <div className="flex gap-2" style={{ marginTop: 22 }}>
                            <button className="btn btn-primary" onClick={() => { setEditId(null); setForm(emptyTC()); setTabMode('nl'); setShowPreview(false); setWarnings([]); setShowForm(true) }}><Plus size={15} /> Thêm TC</button>
                            <a className="btn btn-ghost" href={apiUrl('/api/test-cases/template/download')} download title="Tải file mẫu Excel"><Download size={15} /> File mẫu</a>
                        </div>
                    )}
                </div>
            </div>

            {selectedSuite && (
                <>
                    {/* Upload zone */}
                    <div
                        className={`upload-zone mb-6 ${dragOver ? 'dragover' : ''}`}
                        onClick={() => fileRef.current.click()}
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]) }}
                    >
                        <Upload size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
                        <strong>{uploading ? 'Đang upload...' : 'Click hoặc kéo thả file Excel để import hàng loạt'}</strong>
                        <div className="text-sm" style={{ marginTop: 4 }}>Chỉ chấp nhận .xlsx theo mẫu. <a href={apiUrl('/api/test-cases/template/download')} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)' }}>Tải file mẫu tại đây</a></div>
                        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
                    </div>

                    {/* Test cases list */}
                    <div className="card table-wrap">
                        <table>
                            <thead><tr><th>Tiêu đề</th><th>URL</th><th>Trình duyệt / Thiết bị</th><th>Số bước</th><th>Thao tác</th></tr></thead>
                            <tbody>
                                {testCases.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>Chưa có test case. Tạo mới hoặc upload Excel.</p></div></td></tr>}
                                {testCases.map(tc => (
                                    <tr key={tc.id}>
                                        <td><strong>{tc.title}</strong><br /><span className="text-muted text-sm">{tc.id}</span></td>
                                        <td className="text-sm text-muted" style={{ maxWidth: 200, wordBreak: 'break-all' }}>{tc.url}</td>
                                        <td>
                                            <span className="badge badge-running">{tc.browser || 'chromium'}</span>
                                            {tc.device && <span className="badge" style={{ marginLeft: 4, background: 'var(--primary-light, #eff6ff)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>📱 {DEVICE_OPTIONS.find(d => d.value === tc.device)?.label.replace(/^📱|^📟/, '').trim() || tc.device}</span>}
                                        </td>
                                        <td>{(tc.steps || []).length} bước</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tc)}>✏️ Sửa</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => del(tc.id, tc.title)}><Trash2 size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Test Case form modal */}
            {showForm && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 900 }}>
                        <div className="modal-header">
                            <h3>{editId ? 'Chỉnh sửa Test Case' : 'Tạo Test Case mới'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            {/* Basic info */}
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Tiêu đề *</label>
                                    <input className="form-control" placeholder="VD: Đăng nhập thành công" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Trình duyệt</label>
                                    <select className="form-control" value={form.browser} onChange={e => setForm(p => ({ ...p, browser: e.target.value }))}>
                                        <option value="chromium">Chromium</option>
                                        <option value="firefox">Firefox</option>
                                        <option value="webkit">WebKit (Safari)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">📱 Thiết bị / Màn hình</label>
                                <select className="form-control" value={form.device} onChange={e => setForm(p => ({ ...p, device: e.target.value }))}>
                                    {DEVICE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                </select>
                                {form.device && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        ✅ Test case sẽ chạy với viewport và userAgent của <strong>{DEVICE_OPTIONS.find(d => d.value === form.device)?.label}</strong>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">URL mục tiêu *</label>
                                <input className="form-control" placeholder="https://example.com" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mô tả</label>
                                <input className="form-control" placeholder="Mô tả test case này kiểm tra gì..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                            </div>

                            {/* Tab switcher */}
                            <div className="nl-tabs">
                                <button className={`nl-tab ${tabMode === 'nl' ? 'active' : ''}`} onClick={() => setTabMode('nl')}>
                                    <Sparkles size={15} /> Nhập ngôn ngữ tự nhiên
                                </button>
                                <button className={`nl-tab ${tabMode === 'tech' ? 'active' : ''}`} onClick={() => setTabMode('tech')}>
                                    <Settings size={15} /> Chỉnh sửa kỹ thuật
                                </button>
                            </div>

                            {/* NL Tab */}
                            {tabMode === 'nl' && (
                                <div className="nl-panel">
                                    <div className="nl-hint">
                                        <Sparkles size={14} />
                                        <span>Viết từng bước kiểm thử bằng tiếng Việt, mỗi dòng = 1 bước. Hệ thống sẽ tự chuyển đổi.</span>
                                    </div>
                                    <textarea
                                        className="nl-textarea"
                                        rows={10}
                                        placeholder={NL_PLACEHOLDER}
                                        value={form.nlText}
                                        onChange={e => setForm(p => ({ ...p, nlText: e.target.value }))}
                                    />
                                    <div className="flex gap-2 items-center" style={{ marginTop: 12 }}>
                                        <button className="btn btn-primary" onClick={convertNL} disabled={converting || !form.nlText.trim()}>
                                            <Sparkles size={15} /> {converting ? 'Đang chuyển đổi...' : 'Chuyển đổi ✨'}
                                        </button>
                                        <span className="text-muted text-sm">
                                            {form.nlText.trim() ? `${form.nlText.trim().split('\n').filter(l => l.trim()).length} dòng` : ''}
                                        </span>
                                    </div>

                                    {/* Warnings */}
                                    {warnings.length > 0 && (
                                        <div className="nl-warnings">
                                            {warnings.map((w, i) => (
                                                <div key={i} className="nl-warning-item">
                                                    <AlertTriangle size={14} />
                                                    <span>Dòng {w.line}: <strong>"{w.text}"</strong> — {w.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Preview converted steps */}
                                    {showPreview && form.steps.length > 0 && (
                                        <div className="nl-preview">
                                            <div className="nl-preview-header" onClick={() => setShowPreview(p => !p)}>
                                                <CheckCircle size={15} color="var(--success)" />
                                                <strong>Kết quả chuyển đổi ({form.steps.length} bước)</strong>
                                                <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>Click để chỉnh sửa kỹ thuật</span>
                                            </div>
                                            <div className="nl-steps-preview">
                                                {form.steps.map((step, i) => (
                                                    <div key={i} className="nl-step-card">
                                                        <div className="nl-step-num">{i + 1}</div>
                                                        <div className="nl-step-info">
                                                            <span className="nl-step-action">{ACTION_LABELS[step.action] || step.action}</span>
                                                            <span className="nl-step-desc">{step.description}</span>
                                                            {(step.selector || step.value || step.expected) && (
                                                                <div className="nl-step-details">
                                                                    {step.selector && <code>selector: {step.selector}</code>}
                                                                    {step.value && <code>value: {step.value}</code>}
                                                                    {step.expected && <code>expected: {step.expected}</code>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tech Tab (original form) */}
                            {tabMode === 'tech' && (
                                <div style={{ marginTop: 16 }}>
                                    <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
                                        <label className="form-label" style={{ margin: 0 }}>Các bước thực hiện ({form.steps.length})</label>
                                        <button className="btn btn-outline btn-sm" onClick={addStep}><Plus size={13} /> Thêm bước</button>
                                    </div>

                                    <div className="steps-list">
                                        {form.steps.map((step, i) => (
                                            <div key={i} style={{ background: '#f8fafc', padding: '12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '36px 150px 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                    <div className="step-num">{i + 1}</div>
                                                    <select className="form-control" value={step.action} onChange={e => updateStep(i, 'action', e.target.value)}>
                                                        {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                                    </select>
                                                    <input className="form-control" placeholder="Mô tả bước" value={step.description} onChange={e => updateStep(i, 'description', e.target.value)} />
                                                    <div className="flex gap-2">
                                                        {i > 0 && <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, -1)}><ArrowUp size={12} /></button>}
                                                        {i < form.steps.length - 1 && <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, 1)}><ArrowDown size={12} /></button>}
                                                        <button className="btn btn-danger btn-sm" onClick={() => removeStep(i)}><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: `${needsSelector.includes(step.action) ? '1fr' : '0'} ${needsValue.includes(step.action) ? '1fr' : '0'} ${needsExpected.includes(step.action) ? '1fr' : '0'}`, gap: 8 }}>
                                                    {needsSelector.includes(step.action) && <input className="form-control" placeholder="Selector (CSS/XPath)" value={step.selector} onChange={e => updateStep(i, 'selector', e.target.value)} />}
                                                    {needsValue.includes(step.action) && <input className="form-control" placeholder={step.action === 'navigate' ? 'URL' : step.action === 'wait' ? 'Milliseconds' : 'Giá trị'} value={step.value} onChange={e => updateStep(i, 'value', e.target.value)} />}
                                                    {needsExpected.includes(step.action) && <input className="form-control" placeholder={step.action === 'assert_url' ? 'URL kỳ vọng' : 'Text kỳ vọng'} value={step.expected} onChange={e => updateStep(i, 'expected', e.target.value)} />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Hủy</button>
                            {tabMode === 'nl' && !showPreview && form.nlText.trim() && (
                                <button className="btn btn-outline" onClick={convertNL} disabled={converting}>
                                    <Sparkles size={14} /> Chuyển đổi trước khi lưu
                                </button>
                            )}
                            <button className="btn btn-primary" onClick={save} disabled={form.steps.length === 0}>
                                <Save size={15} /> {editId ? 'Cập nhật' : 'Lưu Test Case'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
