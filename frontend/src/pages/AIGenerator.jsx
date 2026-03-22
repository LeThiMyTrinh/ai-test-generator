import { useState, useEffect, useRef } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Sparkles, Upload, Globe, FileText, Trash2, Plus, RefreshCw, Save, ChevronRight, Loader2, AlertTriangle, ArrowLeft, Key, Check, X, Zap, Eye, EyeOff } from 'lucide-react'

const ACTIONS = ['navigate', 'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot',
    'double_click', 'right_click', 'keyboard', 'scroll_to', 'drag_drop', 'upload_file',
    'api_request', 'assert_status', 'assert_body', 'assert_header', 'assert_response_time', 'store_variable']

export default function AIGenerator({ navigate, ctx }) {
    const [step, setStep] = useState(1)
    const [mode, setMode] = useState('nl') // 'nl' | 'ai'
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

    // API Key config
    const [showKeyConfig, setShowKeyConfig] = useState(false)
    const [keyInputs, setKeyInputs] = useState({ gemini: '', groq: '', ollama: '' })
    const [savingKey, setSavingKey] = useState({})
    const [showKeys, setShowKeys] = useState({ gemini: false, groq: false, ollama: false })

    // NL autocomplete
    const [nlSuggestions, setNlSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedSuggIdx, setSelectedSuggIdx] = useState(0)
    const nlRef = useRef(null)
    const suggestTimer = useRef(null)

    // Step 3: results
    const [result, setResult] = useState(null)
    const [editSteps, setEditSteps] = useState([])
    const [editTitle, setEditTitle] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [warnings, setWarnings] = useState([])
    const [feedback, setFeedback] = useState('')
    const [resultSource, setResultSource] = useState('')

    const fileRef = useRef(null)

    const loadStatus = () => {
        api.get('/api/ai/status').then(r => {
            setAiStatus(r.data)
            // Auto-select AI mode if configured
            if (r.data.configured) setMode('ai')
        }).catch(() => setAiStatus({ configured: false, nlParserAvailable: true, providers: [] }))
    }

    useEffect(() => {
        loadStatus()
        api.get('/api/test-suites').then(r => setSuites(r.data))
    }, [])

    // NL autocomplete
    const fetchSuggestions = (text) => {
        if (suggestTimer.current) clearTimeout(suggestTimer.current)
        const lines = text.split('\n')
        const currentLine = lines[lines.length - 1]?.trim() || ''
        if (currentLine.length < 2) { setNlSuggestions([]); setShowSuggestions(false); return }
        suggestTimer.current = setTimeout(async () => {
            try {
                const r = await api.get(`/api/nl-parser/suggest?q=${encodeURIComponent(currentLine)}`)
                if (r.data.suggestions?.length) {
                    setNlSuggestions(r.data.suggestions)
                    setSelectedSuggIdx(0)
                    setShowSuggestions(true)
                } else { setShowSuggestions(false) }
            } catch { setShowSuggestions(false) }
        }, 200)
    }
    const applySuggestion = (s) => {
        const lines = description.split('\n')
        lines[lines.length - 1] = s
        setDescription(lines.join('\n'))
        setShowSuggestions(false)
        nlRef.current?.focus()
    }
    const handleNlKeyDown = (e) => {
        if (!showSuggestions || !nlSuggestions.length) return
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggIdx(i => (i + 1) % nlSuggestions.length) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggIdx(i => (i - 1 + nlSuggestions.length) % nlSuggestions.length) }
        else if (e.key === 'Tab') { e.preventDefault(); applySuggestion(nlSuggestions[selectedSuggIdx]) }
        else if (e.key === 'Enter') { setShowSuggestions(false) }
        else if (e.key === 'Escape') { setShowSuggestions(false) }
    }

    // Handle file drop
    const handleFiles = (files) => {
        const newImages = [], newPreviews = []
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

    // Save API key
    const handleSaveKey = async (provider) => {
        const key = keyInputs[provider]?.trim()
        if (!key) { toast.error('Nhập key trước khi lưu'); return }
        setSavingKey(p => ({ ...p, [provider]: true }))
        try {
            const { data } = await api.post('/api/ai/save-key', { provider, key })
            toast.success(`Đã lưu ${provider} key thành công!`)
            setKeyInputs(p => ({ ...p, [provider]: '' }))
            loadStatus()
        } catch (err) {
            toast.error(err.response?.data?.error || 'Lỗi khi lưu key')
        }
        setSavingKey(p => ({ ...p, [provider]: false }))
    }
    const handleRemoveKey = async (provider) => {
        if (!window.confirm(`Xóa ${provider} API key?`)) return
        try {
            await api.post('/api/ai/remove-key', { provider })
            toast.success(`Đã xóa ${provider} key`)
            loadStatus()
        } catch (err) { toast.error(err.response?.data?.error || 'Lỗi') }
    }

    // Generate
    const handleGenerate = async () => {
        if (mode === 'nl') {
            if (!description.trim()) { toast.error('Nhập mô tả các bước test'); return }
        } else {
            if (!images.length && !url && !description) {
                toast.error('Cần ít nhất: ảnh UI, URL trang web, hoặc mô tả chức năng')
                return
            }
        }

        setLoading(true)
        setStep(2)
        setLoadingMsg(mode === 'nl' ? 'Đang phân tích ngôn ngữ tự nhiên...' : 'Đang phân tích...')

        try {
            if (mode === 'nl') {
                // Direct NL Parser call
                const { data } = await api.post('/api/ai/generate', { description }, { timeout: 30000 })
                setResult(data)
                setEditSteps(data.steps || [])
                setEditTitle(data.title || '')
                setEditDescription(data.description || '')
                setWarnings(data.warnings || [])
                setResultSource(data.source || 'nl-parser')
                setStep(3)
                toast.success(`Đã tạo ${data.steps?.length || 0} bước test!`)
            } else {
                if (url) setLoadingMsg('Đang truy cập URL và phân tích DOM...')
                const formData = new FormData()
                images.forEach(f => formData.append('images', f))
                if (url) formData.append('url', url)
                if (description) formData.append('description', description)
                setLoadingMsg('Đang gửi dữ liệu cho AI...')
                const { data } = await api.post('/api/ai/generate', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 120000
                })
                setResult(data)
                setEditSteps(data.steps || [])
                setEditTitle(data.title || '')
                setEditDescription(data.description || '')
                setWarnings(data.warnings || [])
                setResultSource(data.source || 'ai')
                setStep(3)
                toast.success(`AI đã tạo ${data.steps?.length || 0} bước test!`)
            }
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
            setStep(1)
        } finally {
            setLoading(false)
        }
    }

    // Refine
    const handleRefine = async () => {
        if (!feedback.trim()) { toast.error('Nhập yêu cầu chỉnh sửa'); return }
        setLoading(true)
        setLoadingMsg('AI đang chỉnh sửa...')
        try {
            const { data } = await api.post('/api/ai/refine', { steps: editSteps, feedback, url }, { timeout: 60000 })
            setEditSteps(data.steps || [])
            setEditTitle(data.title || editTitle)
            setWarnings(data.warnings || [])
            setFeedback('')
            toast.success('Đã chỉnh sửa!')
        } catch (err) { toast.error(err.response?.data?.error || err.message) }
        finally { setLoading(false) }
    }

    // Save
    const handleSave = async () => {
        if (!suiteId) { toast.error('Chọn Test Suite trước khi lưu'); return }
        if (!editSteps.length) { toast.error('Không có bước test nào'); return }
        try {
            await api.post('/api/test-cases', {
                suite_id: suiteId,
                title: editTitle || 'Test Case AI',
                url: url || editSteps.find(s => s.action === 'navigate')?.value || '',
                browser: 'chromium',
                steps: editSteps.map((s, i) => ({ ...s, step_id: i + 1 }))
            })
            toast.success('Đã lưu Test Case!')
            navigate('editor')
        } catch (err) { toast.error(err.response?.data?.error || err.message) }
    }

    // Step helpers
    const updateStep = (idx, field, value) => setEditSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    const removeStep = (idx) => setEditSteps(prev => prev.filter((_, i) => i !== idx))
    const addStep = () => setEditSteps(prev => [...prev, { step_id: prev.length + 1, action: 'click', selector: '', value: '', expected: '', description: '' }])
    const moveStep = (idx, dir) => {
        const newIdx = idx + dir
        if (newIdx < 0 || newIdx >= editSteps.length) return
        const copy = [...editSteps]; [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
        setEditSteps(copy)
    }

    const aiConfigured = aiStatus?.configured
    const providers = aiStatus?.providers || []

    const PROVIDER_INFO = {
        gemini: { label: 'Gemini Flash', hint: 'Lấy key miễn phí tại aistudio.google.com', placeholder: 'AIza...' },
        groq: { label: 'Groq (LLaMA 3.3)', hint: 'Lấy key miễn phí tại console.groq.com', placeholder: 'gsk_...' },
        ollama: { label: 'Ollama (Local)', hint: 'Nhập tên model local (vd: llama3.1)', placeholder: 'llama3.1' }
    }

    return (
        <div>
            {/* ─── MODE TOGGLE ─── */}
            {step === 1 && (
                <div className="ai-mode-toggle">
                    <button className={`ai-mode-btn ${mode === 'nl' ? 'active' : ''}`} onClick={() => setMode('nl')}>
                        <Zap size={16} />
                        <strong>NL Parser</strong>
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>— Miễn phí, tức thì</span>
                    </button>
                    <button className={`ai-mode-btn ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}>
                        <Sparkles size={16} />
                        <strong>AI Nâng cao</strong>
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>— {aiConfigured ? 'Sẵn sàng' : 'Cần API key'}</span>
                        {aiConfigured && <Check size={14} style={{ color: '#16a34a' }} />}
                    </button>
                </div>
            )}

            {/* Wizard Progress */}
            <div className="wizard-progress">
                <div className={`wiz-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
                    <span className="wiz-num">1</span><span>Nhập liệu</span>
                </div>
                <ChevronRight size={16} className="wiz-arrow" />
                <div className={`wiz-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
                    <span className="wiz-num">2</span><span>{mode === 'nl' ? 'Phân tích' : 'AI Phân tích'}</span>
                </div>
                <ChevronRight size={16} className="wiz-arrow" />
                <div className={`wiz-step ${step >= 3 ? 'active' : ''}`}>
                    <span className="wiz-num">3</span><span>Review & Lưu</span>
                </div>
            </div>

            {/* ─── STEP 1: INPUT ─── */}
            {step === 1 && (
                <>
                    {/* AI Mode: Key Config Panel */}
                    {mode === 'ai' && (
                        <div className="card ai-key-panel" style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showKeyConfig ? 16 : 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Key size={16} />
                                    <strong style={{ fontSize: 14 }}>Cấu hình AI Provider</strong>
                                    {aiConfigured && (
                                        <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '2px 10px', borderRadius: 10, fontWeight: 600 }}>
                                            <Check size={11} /> Đã kết nối
                                        </span>
                                    )}
                                    {!aiConfigured && (
                                        <span style={{ fontSize: 12, background: '#fef3c7', color: '#b45309', padding: '2px 10px', borderRadius: 10, fontWeight: 600 }}>
                                            Chưa có key
                                        </span>
                                    )}
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowKeyConfig(p => !p)}>
                                    {showKeyConfig ? 'Ẩn' : 'Cấu hình'}
                                </button>
                            </div>

                            {showKeyConfig && (
                                <div className="ai-key-list">
                                    {['gemini', 'groq', 'ollama'].map(prov => {
                                        const info = PROVIDER_INFO[prov]
                                        const providerData = providers.find(p =>
                                            prov === 'gemini' ? p.name === 'gemini-flash' :
                                            prov === 'groq' ? p.name === 'groq-llama3.3' :
                                            p.name === 'ollama-local'
                                        )
                                        const hasKey = providerData?.hasKey
                                        const masked = providerData?.maskedKey

                                        return (
                                            <div key={prov} className="ai-key-row">
                                                <div className="ai-key-label">
                                                    <strong>{info.label}</strong>
                                                    {hasKey && <span className="ai-key-status connected"><Check size={11} /> Đã kết nối</span>}
                                                </div>
                                                {hasKey ? (
                                                    <div className="ai-key-input-row">
                                                        <code className="ai-key-masked">{masked}</code>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveKey(prov)}
                                                            style={{ color: '#dc2626', fontSize: 12 }}>
                                                            <X size={12} /> Xóa
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="ai-key-input-row">
                                                        <div style={{ position: 'relative', flex: 1 }}>
                                                            <input
                                                                className="form-control form-sm"
                                                                type={showKeys[prov] ? 'text' : 'password'}
                                                                placeholder={info.placeholder}
                                                                value={keyInputs[prov]}
                                                                onChange={e => setKeyInputs(p => ({ ...p, [prov]: e.target.value }))}
                                                                onKeyDown={e => e.key === 'Enter' && handleSaveKey(prov)}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowKeys(p => ({ ...p, [prov]: !p[prov] }))}
                                                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
                                                            >
                                                                {showKeys[prov] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                            </button>
                                                        </div>
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveKey(prov)}
                                                            disabled={savingKey[prov] || !keyInputs[prov]?.trim()}>
                                                            {savingKey[prov] ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                                                            Lưu
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="ai-key-hint">{info.hint}</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* NL MODE */}
                    {mode === 'nl' && (
                        <div className="ai-input-grid" style={{ gridTemplateColumns: '1fr' }}>
                            <div className="card ai-card">
                                <div className="ai-status-banner success" style={{ marginBottom: 16 }}>
                                    <Zap size={16} />
                                    <span>NL Parser — Nhập mô tả bằng tiếng Việt, kết quả tức thì. Hỗ trợ 22 action (UI + API).</span>
                                </div>

                                <h3><FileText size={18} /> Mô tả các bước kiểm thử</h3>
                                <div style={{ position: 'relative' }}>
                                    <textarea
                                        ref={nlRef}
                                        className="form-control ai-textarea"
                                        rows={12}
                                        placeholder={"Viết từng bước kiểm thử, mỗi dòng = 1 bước. Ví dụ:\n\nMở trang https://example.com/login\nNhập \"admin@test.com\" vào ô Email\nNhập \"123456\" vào ô Mật khẩu\nNhấn nút \"Đăng nhập\"\nKiểm tra URL chứa /dashboard\nKiểm tra text \"Xin chào\" hiển thị\n\n--- API Testing ---\nGọi API POST https://api.example.com/login với body {\"email\":\"test@test.com\"}\nKiểm tra status code 200\nLưu biến token = $.data.token"}
                                        value={description}
                                        onChange={e => { setDescription(e.target.value); fetchSuggestions(e.target.value) }}
                                        onKeyDown={handleNlKeyDown}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                    />
                                    {showSuggestions && nlSuggestions.length > 0 && (
                                        <div className="nl-suggestions">
                                            {nlSuggestions.map((s, i) => (
                                                <div key={i} className={`nl-suggestion-item ${i === selectedSuggIdx ? 'active' : ''}`}
                                                    onMouseDown={() => applySuggestion(s)} onMouseEnter={() => setSelectedSuggIdx(i)}>
                                                    <Sparkles size={12} /> {s}
                                                </div>
                                            ))}
                                            <div className="nl-suggestion-hint">Tab/Enter để chọn, Esc để đóng</div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
                                    <span className="text-muted text-sm">
                                        {description.trim() ? `${description.trim().split('\n').filter(l => l.trim()).length} bước` : ''}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <select className="form-control" value={suiteId} onChange={e => setSuiteId(e.target.value)}>
                                            <option value="">-- Chọn Suite để lưu --</option>
                                            {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <button className="btn btn-primary ai-generate-btn" onClick={handleGenerate}
                                        disabled={loading || !description.trim()} style={{ minWidth: 180 }}>
                                        <Zap size={16} /> Tạo Test Case
                                    </button>
                                </div>

                                {!aiConfigured && (
                                    <div style={{ marginTop: 16, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Sparkles size={14} />
                                        Muốn AI phân tích ảnh chụp & URL? <button className="link-btn" onClick={() => { setMode('ai'); setShowKeyConfig(true) }} style={{ fontWeight: 600 }}>Chuyển sang AI Mode</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* AI MODE */}
                    {mode === 'ai' && (
                        <div className="ai-input-grid">
                            <div className="card ai-card">
                                <h3><Upload size={18} /> Ảnh chụp UI</h3>
                                <div className="drop-zone"
                                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                                    onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                                    onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleFiles(e.dataTransfer.files) }}
                                    onClick={() => fileRef.current?.click()}>
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
                                                <button className="preview-remove" onClick={() => removeImage(i)}><Trash2 size={12} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <h3 style={{ marginTop: 20 }}><Globe size={18} /> URL trang web</h3>
                                <input className="form-control" placeholder="https://example.com/login — AI sẽ tự truy cập và phân tích"
                                    value={url} onChange={e => setUrl(e.target.value)} />
                                <p className="form-hint">AI sẽ dùng Playwright mở trang, phân tích DOM và chụp ảnh tự động</p>
                            </div>

                            <div className="card ai-card">
                                <h3><FileText size={18} /> Mô tả chức năng cần test</h3>
                                <textarea className="form-control ai-textarea" rows={8}
                                    placeholder={"VD:\n- Đăng nhập với email và mật khẩu\n- Kiểm tra hiển thị trang dashboard\n- Kiểm tra thông báo lỗi khi nhập sai"}
                                    value={description} onChange={e => setDescription(e.target.value)} />

                                <h3 style={{ marginTop: 20 }}>Test Suite</h3>
                                <select className="form-control" value={suiteId} onChange={e => setSuiteId(e.target.value)}>
                                    <option value="">-- Chọn Suite --</option>
                                    {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>

                                <button className="btn btn-primary ai-generate-btn" onClick={handleGenerate}
                                    disabled={loading || !aiConfigured}
                                    style={{ marginTop: 24, width: '100%' }}>
                                    <Sparkles size={16} />
                                    {!aiConfigured ? 'Nhập API key phía trên để bắt đầu' : 'Tạo Test Case bằng AI'}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── STEP 2: PROCESSING ─── */}
            {step === 2 && (
                <div className="card ai-processing">
                    <div className="ai-loader">
                        <Loader2 size={48} className="spin" />
                        <h3>{loadingMsg}</h3>
                        <p>{mode === 'nl' ? 'Đang phân tích ngôn ngữ tự nhiên...' : 'AI đang phân tích giao diện và tạo test case...'}<br />
                            {mode === 'ai' && 'Quá trình có thể mất 15-60 giây'}</p>
                    </div>
                </div>
            )}

            {/* ─── STEP 3: REVIEW ─── */}
            {step === 3 && (
                <div>
                    <div className="card" style={{ padding: '16px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                            <ArrowLeft size={14} /> Quay lại
                        </button>
                        <div style={{ flex: 1 }}>
                            <input className="form-control" style={{ fontWeight: 700, fontSize: 16, border: 'none', background: 'transparent', padding: 0 }}
                                value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Tiêu đề test case" />
                        </div>
                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600,
                            background: resultSource === 'nl-parser' ? '#dbeafe' : '#dcfce7',
                            color: resultSource === 'nl-parser' ? '#1d4ed8' : '#15803d' }}>
                            {resultSource === 'nl-parser' ? '⚡ NL Parser' : '🤖 AI'}
                        </span>
                        <span className="badge badge-pass">{editSteps.length} bước</span>
                        <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Lưu Test Case</button>
                    </div>

                    {warnings.length > 0 && (
                        <div className="ai-status-banner warning" style={{ marginBottom: 12 }}>
                            <AlertTriangle size={16} />
                            <div>
                                <strong>Cảnh báo:</strong>
                                {warnings.map((w, i) => <div key={i} style={{ fontSize: 13 }}>{typeof w === 'string' ? w : w.message || w.text || JSON.stringify(w)}</div>)}
                            </div>
                        </div>
                    )}

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="ai-steps-table">
                            <thead><tr>
                                <th style={{ width: 40 }}>#</th>
                                <th style={{ width: 130 }}>Action</th>
                                <th>Selector</th><th>Value</th><th>Expected</th><th>Mô tả</th>
                                <th style={{ width: 80 }}></th>
                            </tr></thead>
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
                            <button className="btn btn-outline btn-sm" onClick={addStep}><Plus size={13} /> Thêm bước</button>
                        </div>
                    </div>

                    {/* AI Refine — only show if AI mode or AI configured */}
                    {(resultSource !== 'nl-parser' || aiConfigured) && (
                        <div className="card" style={{ padding: '16px 20px', marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label className="form-label">🤖 Yêu cầu AI chỉnh sửa</label>
                                <input className="form-control"
                                    placeholder="VD: Thêm bước chờ 2 giây, sửa selector nút submit"
                                    value={feedback} onChange={e => setFeedback(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRefine()} />
                            </div>
                            <button className="btn btn-outline" onClick={handleRefine} disabled={loading}>
                                {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} AI Chỉnh sửa
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
