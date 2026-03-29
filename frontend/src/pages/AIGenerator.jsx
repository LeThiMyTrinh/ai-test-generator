import { useState, useEffect, useRef } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Sparkles, Globe, FileText, Trash2, Plus, RefreshCw, Save, ChevronRight, ChevronDown,
    Loader2, AlertTriangle, ArrowLeft, Key, Check, X, Zap, Eye, EyeOff, Cpu, Info } from 'lucide-react'

const ACTIONS = ['navigate', 'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot',
    'double_click', 'right_click', 'keyboard', 'scroll_to', 'drag_drop', 'upload_file',
    'api_request', 'assert_status', 'assert_body', 'assert_header', 'assert_response_time', 'store_variable']

const PROVIDER_INFO = {
    openai: { label: 'OpenAI GPT-4o-mini', hint: 'Lấy key tại platform.openai.com/api-keys', placeholder: 'sk-...' },
    gemini: { label: 'Google Gemini Flash', hint: 'Lấy key miễn phí tại aistudio.google.com', placeholder: 'AIza...' },
    claude: { label: 'Anthropic Claude', hint: 'Lấy key tại console.anthropic.com', placeholder: 'sk-ant-...' }
}

const SCENARIO_LABELS = {
    happy_path: { label: 'Happy Path', color: '#16a34a', bg: '#dcfce7' },
    negative: { label: 'Negative Test', color: '#dc2626', bg: '#fef2f2' },
    boundary: { label: 'Boundary Test', color: '#d97706', bg: '#fef3c7' }
}

export default function AIGenerator() {
    const [step, setStep] = useState(1)
    const [mode, setMode] = useState('smart') // 'smart' | 'nl' | 'ai'
    const [aiStatus, setAiStatus] = useState(null)
    const [loading, setLoading] = useState(false)
    const [loadingMsg, setLoadingMsg] = useState('')

    // Step 1: inputs
    const [url, setUrl] = useState('')
    const [testType, setTestType] = useState('auto')
    const [description, setDescription] = useState('')
    const [selectedProvider, setSelectedProvider] = useState('')
    const [suites, setSuites] = useState([])
    const [suiteId, setSuiteId] = useState('')

    // API Key config
    const [showKeyConfig, setShowKeyConfig] = useState(false)
    const [keyInputs, setKeyInputs] = useState({ openai: '', gemini: '', claude: '' })
    const [savingKey, setSavingKey] = useState({})
    const [showKeys, setShowKeys] = useState({ openai: false, gemini: false, claude: false })

    // NL mode
    const nlRef = useRef(null)

    // Step 2: crawl info
    const [crawlInfo, setCrawlInfo] = useState(null)

    // Step 3: results — multiple scenarios
    const [expandedScenario, setExpandedScenario] = useState(0)
    const [editingScenarios, setEditingScenarios] = useState([])
    const [resultSource, setResultSource] = useState('')
    const [detectedPatterns, setDetectedPatterns] = useState(null)
    const [aiError, setAiError] = useState(null)
    const [feedback, setFeedback] = useState('')
    const [refiningIdx, setRefiningIdx] = useState(-1)

    const loadStatus = () => {
        api.get('/api/ai/status').then(r => {
            setAiStatus(r.data)
        }).catch(() => setAiStatus({ configured: true, aiConfigured: false, smartTemplateAvailable: true, nlParserAvailable: true, providers: [], testTypes: [] }))
    }

    useEffect(() => {
        loadStatus()
        api.get('/api/test-suites').then(r => setSuites(r.data)).catch(() => {})
    }, [])

    // Save API key
    const handleSaveKey = async (provider) => {
        const key = keyInputs[provider]?.trim()
        if (!key) { toast.error('Nhập key trước khi lưu'); return }
        setSavingKey(p => ({ ...p, [provider]: true }))
        try {
            await api.post('/api/ai/save-key', { provider, key })
            toast.success(`Đã lưu ${PROVIDER_INFO[provider].label} key!`)
            setKeyInputs(p => ({ ...p, [provider]: '' }))
            loadStatus()
        } catch (err) {
            toast.error(err.response?.data?.error || 'Lỗi khi lưu key')
        }
        setSavingKey(p => ({ ...p, [provider]: false }))
    }

    const handleRemoveKey = async (provider) => {
        if (!window.confirm(`Xóa ${PROVIDER_INFO[provider].label} API key?`)) return
        try {
            await api.post('/api/ai/remove-key', { provider })
            toast.success(`Đã xóa ${PROVIDER_INFO[provider].label} key`)
            loadStatus()
        } catch (err) { toast.error(err.response?.data?.error || 'Lỗi') }
    }

    // Generate
    const handleGenerate = async () => {
        if (mode === 'nl') {
            if (!description.trim()) { toast.error('Nhập mô tả các bước test'); return }
        } else {
            if (!url.trim()) { toast.error('Nhập URL trang web cần test'); return }
        }

        setLoading(true)
        setStep(2)
        setCrawlInfo(null)
        setLoadingMsg(mode === 'nl' ? 'Đang phân tích ngôn ngữ tự nhiên...' : 'Đang truy cập URL...')

        try {
            let body;
            if (mode === 'nl') {
                body = { description }
            } else if (mode === 'smart') {
                body = { url: url.trim(), testType, description: description.trim() || undefined, provider: 'smart-template' }
            } else {
                body = { url: url.trim(), testType, description: description.trim() || undefined, provider: selectedProvider || undefined }
            }

            if (mode === 'smart') {
                setLoadingMsg('Đang crawl trang web và phân tích DOM...')
            } else if (mode === 'ai') {
                setLoadingMsg('Đang crawl trang web và gọi AI...')
            }

            const { data } = await api.post('/api/ai/generate', body, { timeout: 120000 })

            // Set crawl info if available
            if (data.crawlInfo) {
                setCrawlInfo(data.crawlInfo)
            }

            // Set scenarios
            const sc = data.scenarios || []
            setEditingScenarios(sc.map(s => ({
                ...s,
                steps: s.steps || [],
                selected: true
            })))
            setExpandedScenario(0)
            setResultSource(data.source || 'ai')
            setDetectedPatterns(data.detectedPatterns || null)
            setAiError(data.aiError || null)
            setStep(3)

            const totalSteps = sc.reduce((sum, s) => sum + (s.steps?.length || 0), 0)
            toast.success(`Đã tạo ${sc.length} kịch bản với ${totalSteps} bước test!`)

        } catch (err) {
            const errMsg = err.response?.data?.error || err.message
            toast.error(errMsg, { duration: 6000 })
            setStep(1)
        } finally {
            setLoading(false)
        }
    }

    // Refine a specific scenario
    const handleRefine = async (idx) => {
        if (!feedback.trim()) { toast.error('Nhập yêu cầu chỉnh sửa'); return }
        setRefiningIdx(idx)
        try {
            const { data } = await api.post('/api/ai/refine', {
                steps: editingScenarios[idx].steps,
                feedback,
                url,
                provider: selectedProvider || undefined
            }, { timeout: 60000 })
            setEditingScenarios(prev => prev.map((s, i) =>
                i === idx ? { ...s, steps: data.steps, title: data.title || s.title, warnings: data.warnings } : s
            ))
            setFeedback('')
            toast.success('Đã chỉnh sửa!')
        } catch (err) { toast.error(err.response?.data?.error || err.message) }
        finally { setRefiningIdx(-1) }
    }

    // Save scenarios
    const handleSave = async (idx) => {
        if (!suiteId) { toast.error('Chọn Test Suite trước khi lưu'); return }
        const sc = editingScenarios[idx]
        if (!sc.steps.length) { toast.error('Không có bước test nào'); return }
        try {
            await api.post('/api/test-cases', {
                suite_id: suiteId,
                title: sc.title || 'Test Case AI',
                url: url || sc.steps.find(s => s.action === 'navigate')?.value || '',
                browser: 'chromium',
                steps: sc.steps.map((s, i) => ({ ...s, step_id: i + 1 }))
            })
            toast.success(`Đã lưu "${sc.title}"!`)
            setEditingScenarios(prev => prev.map((s, i) => i === idx ? { ...s, saved: true } : s))
        } catch (err) { toast.error(err.response?.data?.error || err.message) }
    }

    const handleSaveAll = async () => {
        if (!suiteId) { toast.error('Chọn Test Suite trước khi lưu'); return }
        let count = 0
        for (let i = 0; i < editingScenarios.length; i++) {
            const sc = editingScenarios[i]
            if (sc.saved || !sc.selected || !sc.steps.length) continue
            try {
                await api.post('/api/test-cases', {
                    suite_id: suiteId,
                    title: sc.title || 'Test Case AI',
                    url: url || sc.steps.find(s => s.action === 'navigate')?.value || '',
                    browser: 'chromium',
                    steps: sc.steps.map((s, j) => ({ ...s, step_id: j + 1 }))
                })
                setEditingScenarios(prev => prev.map((s, j) => j === i ? { ...s, saved: true } : s))
                count++
            } catch { /* continue */ }
        }
        if (count > 0) toast.success(`Đã lưu ${count} test case!`)
        else toast.error('Không có test case nào để lưu')
    }

    // Step helpers for editing scenario steps
    const updateStep = (scIdx, stepIdx, field, value) =>
        setEditingScenarios(prev => prev.map((sc, i) =>
            i === scIdx ? { ...sc, steps: sc.steps.map((s, j) => j === stepIdx ? { ...s, [field]: value } : s) } : sc
        ))

    const removeStep = (scIdx, stepIdx) =>
        setEditingScenarios(prev => prev.map((sc, i) =>
            i === scIdx ? { ...sc, steps: sc.steps.filter((_, j) => j !== stepIdx) } : sc
        ))

    const addStep = (scIdx) =>
        setEditingScenarios(prev => prev.map((sc, i) =>
            i === scIdx ? { ...sc, steps: [...sc.steps, { step_id: sc.steps.length + 1, action: 'click', selector: '', value: '', expected: '', description: '' }] } : sc
        ))

    const aiConfigured = aiStatus?.aiConfigured
    const providers = aiStatus?.providers || []
    const testTypes = aiStatus?.testTypes || [
        { value: 'auto', label: 'Tự động nhận diện' },
        { value: 'form', label: 'Form & Validation' },
        { value: 'navigation', label: 'Navigation & Routing' },
        { value: 'crud', label: 'CRUD Operations' },
        { value: 'auth', label: 'Authentication Flow' }
    ]

    return (
        <div>
            {/* MODE TOGGLE */}
            {step === 1 && (
                <div className="ai-mode-toggle">
                    <button className={`ai-mode-btn ${mode === 'smart' ? 'active' : ''}`} onClick={() => setMode('smart')}>
                        <Cpu size={16} />
                        <strong>Smart Template</strong>
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>— Miễn phí, từ URL</span>
                        <Check size={14} style={{ color: '#16a34a' }} />
                    </button>
                </div>
            )}

            {/* Wizard Progress */}
            <div className="wizard-progress">
                {[
                    { num: 1, label: 'Nhập liệu' },
                    { num: 2, label: 'Crawl & Phân tích' },
                    { num: 3, label: 'Review & Lưu' }
                ].map((w, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                        {i > 0 && <ChevronRight size={16} className="wiz-arrow" />}
                        <div className={`wiz-step ${step >= w.num ? 'active' : ''} ${step > w.num ? 'done' : ''}`}>
                            <span className="wiz-num">{w.num}</span><span>{w.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── STEP 1: INPUT ─── */}
            {step === 1 && (
                <>
                    {/* Key Config Panel */}

                    {/* SMART TEMPLATE MODE */}
                    {mode === 'smart' && (
                        <div className="ai-input-grid">
                            <div className="card ai-card">
                                <div className="ai-status-banner success" style={{ marginBottom: 16 }}>
                                    <Cpu size={16} />
                                    <span>Smart Template — Crawl trang web, phân tích DOM và tự sinh test case. <strong>Miễn phí, không cần API key.</strong></span>
                                </div>
                                <h3><Globe size={18} /> URL trang web</h3>
                                <input className="form-control" placeholder="https://example.com/login"
                                    value={url} onChange={e => setUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
                                <p className="form-hint">Hệ thống sẽ truy cập trang, phân tích DOM elements và tự động sinh test case theo 16 nhóm kiểm thử</p>

                                <h3 style={{ marginTop: 20 }}><FileText size={18} /> Loại test</h3>
                                <select className="form-control" value={testType} onChange={e => setTestType(e.target.value)}>
                                    {testTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>

                                <h3 style={{ marginTop: 20 }}>Mô tả thêm <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>(tùy chọn)</span></h3>
                                <textarea className="form-control" rows={2}
                                    placeholder="VD: Tập trung kiểm tra form đăng nhập"
                                    value={description} onChange={e => setDescription(e.target.value)} />
                            </div>

                            <div className="card ai-card">
                                <h3><Info size={18} /> Về Smart Template</h3>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                    <p style={{ marginBottom: 8 }}>Tự động phát hiện và sinh test cho:</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', fontSize: 12 }}>
                                        {['Login Form', 'Registration Form', 'Search Form', 'Generic Form',
                                          'Navigation & Links', 'Buttons', 'Dropdown/Select', 'Checkbox & Radio',
                                          'File Upload', 'Textarea', 'Tab/Accordion', 'Page Load',
                                          'XSS / SQL Injection', 'Accessibility'].map(g =>
                                            <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Check size={11} style={{ color: '#16a34a', flexShrink: 0 }} /> {g}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <h3 style={{ marginTop: 20 }}>Test Suite</h3>
                                <select className="form-control" value={suiteId} onChange={e => setSuiteId(e.target.value)}>
                                    <option value="">-- Chọn Suite để lưu --</option>
                                    {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>

                                <button className="btn btn-primary ai-generate-btn" onClick={handleGenerate}
                                    disabled={loading || !url.trim()}
                                    style={{ marginTop: 24, width: '100%' }}>
                                    <Cpu size={16} /> Phân tích & Tạo Test Case
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
                        <p>Đang crawl trang web, phân tích DOM elements và sinh test case tự động...</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Quá trình crawl trang có thể mất 5-15 giây</p>
                    </div>
                </div>
            )}

            {/* ─── STEP 3: RESULTS ─── */}
            {step === 3 && (
                <div>
                    {/* Top bar */}
                    <div className="card" style={{ padding: '12px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                            <ArrowLeft size={14} /> Quay lại
                        </button>
                        <div style={{ flex: 1 }}>
                            <strong style={{ fontSize: 15 }}>
                                <Cpu size={14} /> Smart Template — {editingScenarios.length} kịch bản
                            </strong>
                            {detectedPatterns && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                                    Phát hiện: {detectedPatterns.filter(p => p !== 'page_load' && p !== 'accessibility').join(', ')}
                                </span>
                            )}
                        </div>
                        <select className="form-control" style={{ width: 200 }} value={suiteId} onChange={e => setSuiteId(e.target.value)}>
                            <option value="">-- Chọn Suite --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={handleSaveAll} disabled={!suiteId}>
                            <Save size={14} /> Lưu tất cả
                        </button>
                    </div>

                    {/* Crawl info */}
                    {crawlInfo && (
                        <div className="card" style={{ padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
                            {crawlInfo.screenshotBase64 && (
                                <img src={`data:image/png;base64,${crawlInfo.screenshotBase64}`}
                                    alt="Screenshot" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                            )}
                            <div>
                                <strong>{crawlInfo.title}</strong>
                                <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                                    {crawlInfo.forms > 0 && <span style={{ marginRight: 12 }}>Forms: {crawlInfo.forms}</span>}
                                    <span style={{ marginRight: 12 }}>Inputs: {crawlInfo.inputs}</span>
                                    <span style={{ marginRight: 12 }}>Buttons: {crawlInfo.buttons}</span>
                                    <span style={{ marginRight: 12 }}>Links: {crawlInfo.links}</span>
                                    <span>Elements: {crawlInfo.elementsCount}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scenarios */}
                    {editingScenarios.map((sc, scIdx) => {
                        const typeInfo = SCENARIO_LABELS[sc.type] || SCENARIO_LABELS.happy_path
                        const isExpanded = expandedScenario === scIdx

                        return (
                            <div key={scIdx} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
                                {/* Scenario header */}
                                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: sc.saved ? '#f0fdf4' : undefined }}
                                    onClick={() => setExpandedScenario(isExpanded ? -1 : scIdx)}>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                                        background: typeInfo.bg, color: typeInfo.color }}>
                                        {typeInfo.label}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <strong style={{ fontSize: 14 }}>{sc.title}</strong>
                                        {sc.description && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>— {sc.description}</span>}
                                    </div>
                                    <span className="badge badge-pass">{sc.steps.length} bước</span>
                                    {sc.saved ? (
                                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}><Check size={14} /> Đã lưu</span>
                                    ) : (
                                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); handleSave(scIdx) }} disabled={!suiteId}>
                                            <Save size={12} /> Lưu
                                        </button>
                                    )}
                                </div>

                                {/* Expanded: steps table */}
                                {isExpanded && (
                                    <>
                                        {sc.warnings?.length > 0 && (
                                            <div className="ai-status-banner warning" style={{ margin: '0 16px 8px', borderRadius: 8 }}>
                                                <AlertTriangle size={14} />
                                                <div style={{ fontSize: 12 }}>
                                                    {sc.warnings.map((w, i) => <div key={i}>{w}</div>)}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ overflowX: 'auto' }}>
                                            <table className="ai-steps-table">
                                                <thead><tr>
                                                    <th style={{ width: 36 }}>#</th>
                                                    <th style={{ width: 120 }}>Action</th>
                                                    <th>Selector</th><th>Value</th><th>Expected</th><th>Mô tả</th>
                                                    <th style={{ width: 50 }}></th>
                                                </tr></thead>
                                                <tbody>
                                                    {sc.steps.map((s, i) => (
                                                        <tr key={i}>
                                                            <td className="step-num">{i + 1}</td>
                                                            <td>
                                                                <select className="form-control form-sm" value={s.action} onChange={e => updateStep(scIdx, i, 'action', e.target.value)}>
                                                                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                                                </select>
                                                            </td>
                                                            <td><input className="form-control form-sm" value={s.selector} onChange={e => updateStep(scIdx, i, 'selector', e.target.value)} placeholder="selector" /></td>
                                                            <td><input className="form-control form-sm" value={s.value} onChange={e => updateStep(scIdx, i, 'value', e.target.value)} placeholder="value" /></td>
                                                            <td><input className="form-control form-sm" value={s.expected} onChange={e => updateStep(scIdx, i, 'expected', e.target.value)} placeholder="expected" /></td>
                                                            <td><input className="form-control form-sm" value={s.description} onChange={e => updateStep(scIdx, i, 'description', e.target.value)} placeholder="mô tả" /></td>
                                                            <td>
                                                                <button className="btn-icon danger" title="Xóa" onClick={() => removeStep(scIdx, i)}><Trash2 size={12} /></button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => addStep(scIdx)}><Plus size={13} /> Thêm bước</button>
                                        </div>


                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
