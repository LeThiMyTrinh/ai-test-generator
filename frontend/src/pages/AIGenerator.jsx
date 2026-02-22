import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Sparkles, Upload, Globe, FileText, Trash2, GripVertical, Plus, RefreshCw, Save, ChevronRight, Eye, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react'

const ACTIONS = ['navigate', 'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot']

export default function AIGenerator({ navigate, ctx }) {
    const [step, setStep] = useState(1) // wizard step 1-3
    const [aiStatus, setAiStatus] = useState(null)
    const [loading, setLoading] = useState(false)
    const [loadingMsg, setLoadingMsg] = useState('')

    // Step 1: inputs
    const [images, setImages] = useState([])
    const [imagePreview, setImagePreview] = useState([])
    const [url, setUrl] = useState('')
    const [description, setDescription] = useState('')
    const [suites, setSuites] = useState([])
    const [suiteId, setSuiteId] = useState('')

    // Step 3: results
    const [result, setResult] = useState(null)
    const [editSteps, setEditSteps] = useState([])
    const [editTitle, setEditTitle] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [warnings, setWarnings] = useState([])
    const [feedback, setFeedback] = useState('')

    const fileRef = useRef(null)

    useEffect(() => {
        axios.get('/api/ai/status').then(r => setAiStatus(r.data)).catch(() => setAiStatus({ configured: false }))
        axios.get('/api/test-suites').then(r => setSuites(r.data))
    }, [])

    // Handle file drop / select
    const handleFiles = (files) => {
        const newImages = []
        const newPreviews = []
        Array.from(files).forEach(f => {
            if (!f.type.startsWith('image/')) return
            newImages.push(f)
            newPreviews.push(URL.createObjectURL(f))
        })
        setImages(prev => [...prev, ...newImages])
        setImagePreview(prev => [...prev, ...newPreviews])
    }

    const removeImage = (idx) => {
        setImages(prev => prev.filter((_, i) => i !== idx))
        setImagePreview(prev => prev.filter((_, i) => i !== idx))
    }

    // Generate test case
    const handleGenerate = async () => {
        if (!images.length && !url && !description) {
            toast.error('Cần ít nhất: ảnh UI, URL trang web, hoặc mô tả chức năng')
            return
        }
        setLoading(true)
        setStep(2)
        setLoadingMsg('Đang phân tích...')

        try {
            if (url) setLoadingMsg('Đang truy cập URL và phân tích DOM...')

            const formData = new FormData()
            images.forEach(f => formData.append('images', f))
            if (url) formData.append('url', url)
            if (description) formData.append('description', description)

            setLoadingMsg('Đang gửi dữ liệu cho AI...')
            const { data } = await axios.post('/api/ai/generate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000 // 2 min
            })

            setResult(data)
            setEditSteps(data.steps || [])
            setEditTitle(data.title || '')
            setEditDescription(data.description || '')
            setWarnings(data.warnings || [])
            setStep(3)
            toast.success(`AI đã tạo ${data.steps?.length || 0} bước test!`)

        } catch (err) {
            const msg = err.response?.data?.error || err.message
            toast.error(msg)
            setStep(1)
        } finally {
            setLoading(false)
        }
    }

    // Refine steps
    const handleRefine = async () => {
        if (!feedback.trim()) { toast.error('Nhập yêu cầu chỉnh sửa'); return }
        setLoading(true)
        setLoadingMsg('AI đang chỉnh sửa...')

        try {
            const { data } = await axios.post('/api/ai/refine', {
                steps: editSteps,
                feedback,
                url
            }, { timeout: 60000 })

            setEditSteps(data.steps || [])
            setEditTitle(data.title || editTitle)
            setWarnings(data.warnings || [])
            setFeedback('')
            toast.success('Đã chỉnh sửa!')
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    // Save test case
    const handleSave = async () => {
        if (!suiteId) { toast.error('Chọn Test Suite trước khi lưu'); return }
        if (!editSteps.length) { toast.error('Không có bước test nào'); return }

        try {
            const payload = {
                suite_id: suiteId,
                title: editTitle || 'Test Case AI',
                url: url || editSteps.find(s => s.action === 'navigate')?.value || '',
                browser: 'chromium',
                steps: editSteps.map((s, i) => ({
                    ...s,
                    step_id: i + 1
                }))
            }

            await axios.post('/api/test-cases', payload)
            toast.success('Đã lưu Test Case!')
            navigate('editor')
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        }
    }

    // Edit step inline
    const updateStep = (idx, field, value) => {
        setEditSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    }
    const removeStep = (idx) => {
        setEditSteps(prev => prev.filter((_, i) => i !== idx))
    }
    const addStep = () => {
        setEditSteps(prev => [...prev, {
            step_id: prev.length + 1,
            action: 'click',
            selector: '',
            value: '',
            expected: '',
            description: ''
        }])
    }
    const moveStep = (idx, dir) => {
        const newIdx = idx + dir
        if (newIdx < 0 || newIdx >= editSteps.length) return
        const copy = [...editSteps]
            ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
        setEditSteps(copy)
    }

    // ─── RENDER ──────────────────────────────────────────

    return (
        <div>
            {/* Status Banner */}
            {aiStatus && !aiStatus.configured && (
                <div className="ai-status-banner warning">
                    <AlertTriangle size={18} />
                    <div>
                        <strong>Chưa cấu hình Gemini API Key</strong>
                        <p>Thêm biến môi trường <code>GEMINI_API_KEY</code> và restart server. Lấy key miễn phí tại <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">aistudio.google.com</a></p>
                    </div>
                </div>
            )}
            {aiStatus && aiStatus.configured && (
                <div className="ai-status-banner success">
                    <Sparkles size={18} />
                    <span>Gemini AI đã sẵn sàng — Model: {aiStatus.model}</span>
                </div>
            )}

            {/* Wizard Progress */}
            <div className="wizard-progress">
                <div className={`wiz-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
                    <span className="wiz-num">1</span>
                    <span>Nhập liệu</span>
                </div>
                <ChevronRight size={16} className="wiz-arrow" />
                <div className={`wiz-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
                    <span className="wiz-num">2</span>
                    <span>AI Phân tích</span>
                </div>
                <ChevronRight size={16} className="wiz-arrow" />
                <div className={`wiz-step ${step >= 3 ? 'active' : ''}`}>
                    <span className="wiz-num">3</span>
                    <span>Review & Lưu</span>
                </div>
            </div>

            {/* ─── STEP 1: INPUT ─── */}
            {step === 1 && (
                <div className="ai-input-grid">
                    {/* Left: upload & URL */}
                    <div className="card ai-card">
                        <h3><Upload size={18} /> Ảnh chụp UI</h3>
                        <div
                            className="drop-zone"
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleFiles(e.dataTransfer.files) }}
                            onClick={() => fileRef.current?.click()}
                        >
                            <Upload size={32} strokeWidth={1.5} />
                            <p>Kéo thả ảnh hoặc <strong>click để chọn</strong></p>
                            <span>PNG, JPG, WEBP — tối đa 10MB/ảnh</span>
                            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
                        </div>
                        {imagePreview.length > 0 && (
                            <div className="preview-grid">
                                {imagePreview.map((src, i) => (
                                    <div key={i} className="preview-item">
                                        <img src={src} alt={`Upload ${i + 1}`} />
                                        <button className="preview-remove" onClick={() => removeImage(i)}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <h3 style={{ marginTop: 20 }}><Globe size={18} /> URL trang web</h3>
                        <input
                            className="form-control"
                            placeholder="https://example.com/login — AI sẽ tự truy cập và phân tích"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                        />
                        <p className="form-hint">AI sẽ dùng Playwright mở trang, phân tích DOM và chụp ảnh tự động</p>
                    </div>

                    {/* Right: description & suite */}
                    <div className="card ai-card">
                        <h3><FileText size={18} /> Mô tả chức năng cần test</h3>
                        <textarea
                            className="form-control ai-textarea"
                            rows={8}
                            placeholder={"VD:\n- Đăng nhập với email và mật khẩu\n- Kiểm tra hiển thị trang dashboard sau đăng nhập\n- Kiểm tra thông báo lỗi khi nhập sai mật khẩu"}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />

                        <h3 style={{ marginTop: 20 }}>Test Suite</h3>
                        <select className="form-control" value={suiteId} onChange={e => setSuiteId(e.target.value)}>
                            <option value="">-- Chọn Suite --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>

                        <button
                            className="btn btn-primary ai-generate-btn"
                            onClick={handleGenerate}
                            disabled={loading || (!aiStatus?.configured)}
                            style={{ marginTop: 24, width: '100%' }}
                        >
                            <Sparkles size={16} />
                            Tạo Test Case bằng AI
                        </button>
                    </div>
                </div>
            )}

            {/* ─── STEP 2: PROCESSING ─── */}
            {step === 2 && (
                <div className="card ai-processing">
                    <div className="ai-loader">
                        <Loader2 size={48} className="spin" />
                        <h3>{loadingMsg}</h3>
                        <p>AI đang phân tích giao diện và tạo test case...<br />Quá trình có thể mất 15-60 giây</p>
                    </div>
                </div>
            )}

            {/* ─── STEP 3: REVIEW ─── */}
            {step === 3 && (
                <div>
                    {/* Header */}
                    <div className="card" style={{ padding: '16px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                            <ArrowLeft size={14} /> Quay lại
                        </button>
                        <div style={{ flex: 1 }}>
                            <input
                                className="form-control"
                                style={{ fontWeight: 700, fontSize: 16, border: 'none', background: 'transparent', padding: 0 }}
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                placeholder="Tiêu đề test case"
                            />
                        </div>
                        <span className="badge badge-pass">{editSteps.length} bước</span>
                        <button className="btn btn-primary" onClick={handleSave}>
                            <Save size={14} /> Lưu Test Case
                        </button>
                    </div>

                    {/* Warnings */}
                    {warnings.length > 0 && (
                        <div className="ai-status-banner warning" style={{ marginBottom: 12 }}>
                            <AlertTriangle size={16} />
                            <div>
                                <strong>Cảnh báo từ AI:</strong>
                                {warnings.map((w, i) => <div key={i} style={{ fontSize: 13 }}>{w}</div>)}
                            </div>
                        </div>
                    )}

                    {/* Editable Steps Table */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="ai-steps-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th style={{ width: 130 }}>Action</th>
                                    <th>Selector</th>
                                    <th>Value</th>
                                    <th>Expected</th>
                                    <th>Mô tả</th>
                                    <th style={{ width: 80 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editSteps.map((s, i) => (
                                    <tr key={i}>
                                        <td className="step-num">{i + 1}</td>
                                        <td>
                                            <select className="form-control form-sm" value={s.action} onChange={e => updateStep(i, 'action', e.target.value)}>
                                                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </td>
                                        <td><input className="form-control form-sm" value={s.selector} onChange={e => updateStep(i, 'selector', e.target.value)} placeholder="selector" /></td>
                                        <td><input className="form-control form-sm" value={s.value} onChange={e => updateStep(i, 'value', e.target.value)} placeholder="value" /></td>
                                        <td><input className="form-control form-sm" value={s.expected} onChange={e => updateStep(i, 'expected', e.target.value)} placeholder="expected" /></td>
                                        <td><input className="form-control form-sm" value={s.description} onChange={e => updateStep(i, 'description', e.target.value)} placeholder="mô tả" /></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 2 }}>
                                                <button className="btn-icon" title="Lên" onClick={() => moveStep(i, -1)}>↑</button>
                                                <button className="btn-icon" title="Xuống" onClick={() => moveStep(i, 1)}>↓</button>
                                                <button className="btn-icon danger" title="Xóa" onClick={() => removeStep(i)}><Trash2 size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                            <button className="btn btn-outline btn-sm" onClick={addStep}>
                                <Plus size={13} /> Thêm bước
                            </button>
                        </div>
                    </div>

                    {/* AI Refine */}
                    <div className="card" style={{ padding: '16px 20px', marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label className="form-label">🤖 Yêu cầu AI chỉnh sửa</label>
                            <input
                                className="form-control"
                                placeholder="VD: Thêm bước chờ 2 giây trước khi click nút đăng nhập, sửa selector nút submit"
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRefine()}
                            />
                        </div>
                        <button className="btn btn-outline" onClick={handleRefine} disabled={loading}>
                            {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                            AI Chỉnh sửa
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
