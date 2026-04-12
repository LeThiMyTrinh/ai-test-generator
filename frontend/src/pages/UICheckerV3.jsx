import { useState, useEffect } from 'react'
import api, { apiUrl } from '../api/client'
import {
    ScanSearch, Loader2, Monitor, Tablet, Smartphone, ChevronDown, ChevronRight, ChevronUp,
    Code2, Users, Copy, Upload, Play, Zap, Image, CheckCircle2, XCircle,
    AlertTriangle, Eye, Palette, Type, Layout, Search, FileText, Globe,
    Shield, Gauge, MousePointer, RotateCcw, History, Download, Trash2, ExternalLink, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'

// ========== CONFIGS ==========

const SEVERITY_CONFIG = {
    CRITICAL: { color: '#991b1b', bg: '#fee2e2', icon: '🔴', label: 'Nghiêm trọng' },
    HIGH: { color: '#c2410c', bg: '#fff7ed', icon: '🟠', label: 'Cao' },
    MEDIUM: { color: '#a16207', bg: '#fefce8', icon: '🟡', label: 'Trung bình' },
    LOW: { color: '#15803d', bg: '#f0fdf4', icon: '🟢', label: 'Thấp' },
}

const CATEGORY_ICONS = {
    layoutUI:         { icon: '📐', label: 'Layout & UI hiển thị' },
    uiComponents:     { icon: '🔘', label: 'UI Components' },
    textContent:      { icon: '📝', label: 'Text & Content' },
    imageIcon:        { icon: '🖼️', label: 'Image & Icon' },
    scrollPosition:   { icon: '📜', label: 'Scroll & Position' },
    loadingAnimation: { icon: '⏳', label: 'Loading & Animation' },
    accessibility:    { icon: '♿', label: 'Accessibility' },
    linkNavigation:   { icon: '🔗', label: 'Link & Navigation' },
}

const TEST_STATUS_CONFIG = {
    passed: { color: '#16a34a', bg: '#f0fdf4', icon: '✅', label: 'Passed' },
    failed: { color: '#dc2626', bg: '#fef2f2', icon: '❌', label: 'Failed' },
    warning: { color: '#ca8a04', bg: '#fefce8', icon: '⚠️', label: 'Warning' },
    error: { color: '#7c3aed', bg: '#f5f3ff', icon: '💥', label: 'Error' },
    skipped: { color: '#64748b', bg: '#f8fafc', icon: '⏭️', label: 'Skipped' },
}

const GROUP_META = {
    navigation:       { icon: '🔗', name: 'Header / Navigation' },
    button:           { icon: '🔘', name: 'Button' },
    inputField:       { icon: '✏️', name: 'Input Field' },
    formValidation:   { icon: '📝', name: 'Form Validation' },
    imageMedia:       { icon: '🖼️', name: 'Image / Media' },
    contentText:      { icon: '📄', name: 'Content / Text' },
    checkbox:         { icon: '☑️', name: 'Checkbox' },
    radioButton:      { icon: '🔘', name: 'Radio Button' },
    dropdown:         { icon: '📂', name: 'Dropdown / Combobox' },
    listBox:          { icon: '📋', name: 'List Box' },
    calendar:         { icon: '📅', name: 'Calendar / Date Picker' },
    link:             { icon: '🔗', name: 'Link' },
    tab:              { icon: '📑', name: 'Tab' },
    hoverTooltip:     { icon: '💬', name: 'Hover & Tooltip' },
}

const GROUP_ORDER = [
    'navigation', 'button', 'inputField', 'formValidation', 'imageMedia', 'contentText',
    'checkbox', 'radioButton', 'dropdown', 'listBox',
    'calendar', 'link', 'tab', 'hoverTooltip',
]

// ========== MAIN COMPONENT ==========

export default function UICheckerV3() {
    const [activeTab, setActiveTab] = useState('enhanced') // 'enhanced' | 'design' | 'interaction' | 'history'
    const [url, setUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [presets, setPresets] = useState(null)

    // History state
    const [historyList, setHistoryList] = useState([])
    const [historyTotal, setHistoryTotal] = useState(0)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyFilter, setHistoryFilter] = useState('all')
    const [historyDetail, setHistoryDetail] = useState(null)

    // Enhanced checker state
    const [enhancedResult, setEnhancedResult] = useState(null)
    const [desktop, setDesktop] = useState('1920x1080')
    const [tablet, setTablet] = useState('ipad-pro')
    const [mobile, setMobile] = useState('iphone-15')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [showLogin, setShowLogin] = useState(false)

    // Design compare state
    const [designFile, setDesignFile] = useState(null)
    const [designPreview, setDesignPreview] = useState(null)
    const [designResult, setDesignResult] = useState(null)
    const [designThreshold, setDesignThreshold] = useState(0.15)
    const [designDevice, setDesignDevice] = useState('desktop-1920x1080')

    // Interaction test state
    const [interactionResult, setInteractionResult] = useState(null)
    const [testLevel, setTestLevel] = useState('smart')
    const [maxActions, setMaxActions] = useState(500)
    const [interactionDevice, setInteractionDevice] = useState('desktop-1920x1080')

    // Filter
    const [severityFilter, setSeverityFilter] = useState('all')
    const [categoryFilter, setCategoryFilter] = useState('all')

    useEffect(() => {
        api.get('/api/ai/ui-presets').then(r => setPresets(r.data)).catch(() => { })
    }, [])

    // ========== HANDLERS ==========

    const runEnhancedCheck = async () => {
        if (!url) return toast.error('Vui lòng nhập URL')
        setLoading(true)
        setEnhancedResult(null)
        try {
            const { data } = await api.post('/api/ai/ui-check-v3', {
                url, desktop, tablet, mobile,
                loginEmail: showLogin ? loginEmail : undefined,
                loginPassword: showLogin ? loginPassword : undefined,
            })
            setEnhancedResult(data)
            toast.success(`Phát hiện ${data.summary.total} vấn đề | Quality: ${data.summary.qualityScore}/100`)
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const runDesignCompare = async () => {
        if (!url) return toast.error('Vui lòng nhập URL')
        if (!designFile) return toast.error('Vui lòng upload ảnh design')
        setLoading(true)
        setDesignResult(null)
        try {
            const formData = new FormData()
            formData.append('designImage', designFile)
            formData.append('url', url)
            formData.append('threshold', designThreshold)
            formData.append('device', designDevice)

            const { data } = await api.post('/api/ai/design-compare', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
            })
            setDesignResult(data)
            toast.success(`Khớp ${data.matchPercent}% | Grade: ${data.summary.grade}`)
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const runInteractionTest = async () => {
        if (!url) return toast.error('Vui lòng nhập URL')
        setLoading(true)
        setInteractionResult(null)
        try {
            const { data } = await api.post('/api/ai/interaction-test', {
                url, level: testLevel,
                loginEmail: showLogin ? loginEmail : undefined,
                loginPassword: showLogin ? loginPassword : undefined,
                maxActions,
                device: interactionDevice,
            }, { timeout: 300000 })
            setInteractionResult(data)
            const s = data.summary
            toast.success(`${s.passed}/${s.totalTests} tests passed | Verdict: ${s.verdict}`)
        } catch (err) {
            toast.error(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDesignFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setDesignFile(file)
            const reader = new FileReader()
            reader.onload = (ev) => setDesignPreview(ev.target.result)
            reader.readAsDataURL(file)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !loading) {
            if (activeTab === 'enhanced') runEnhancedCheck()
            else if (activeTab === 'design') runDesignCompare()
            else if (activeTab === 'interaction') runInteractionTest()
        }
    }

    // ========== HISTORY HANDLERS ==========

    const loadHistory = async (type) => {
        setHistoryLoading(true)
        try {
            const params = type && type !== 'all' ? { type } : {}
            const { data } = await api.get('/api/ai/ui-history', { params })
            setHistoryList(data.records || [])
            setHistoryTotal(data.total || 0)
        } catch (err) {
            toast.error('Lỗi tải lịch sử: ' + (err.response?.data?.error || err.message))
        } finally {
            setHistoryLoading(false)
        }
    }

    const loadHistoryDetail = async (id) => {
        setHistoryLoading(true)
        try {
            const { data } = await api.get(`/api/ai/ui-history/${id}`)
            setHistoryDetail(data)
        } catch (err) {
            toast.error('Lỗi tải chi tiết: ' + (err.response?.data?.error || err.message))
        } finally {
            setHistoryLoading(false)
        }
    }

    const deleteHistory = async (id) => {
        if (!confirm('Xóa bản ghi này?')) return
        try {
            await api.delete(`/api/ai/ui-history/${id}`)
            toast.success('Đã xóa')
            setHistoryDetail(null)
            loadHistory(historyFilter)
        } catch (err) {
            toast.error('Lỗi xóa: ' + (err.response?.data?.error || err.message))
        }
    }

    const exportReport = (id, format) => {
        const url = apiUrl(`/api/ai/ui-history/${id}/${format}`)
        window.open(url, '_blank')
    }

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory(historyFilter)
            setHistoryDetail(null)
        }
    }, [activeTab, historyFilter])

    // ========== RENDER ==========

    const tabStyle = (tab) => ({
        padding: '10px 20px', cursor: 'pointer', borderRadius: '8px 8px 0 0',
        background: activeTab === tab ? '#1e293b' : '#f1f5f9',
        color: activeTab === tab ? '#fff' : '#475569',
        fontWeight: activeTab === tab ? 600 : 400,
        border: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.2s'
    })

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '2px solid #1e293b' }}>
                <button style={tabStyle('enhanced')} onClick={() => setActiveTab('enhanced')}>
                    <ScanSearch size={16} /> Kiểm thử giao diện nâng cao
                </button>
                <button style={tabStyle('design')} onClick={() => setActiveTab('design')}>
                    <Image size={16} /> So sánh Design
                </button>
                <button style={tabStyle('interaction')} onClick={() => setActiveTab('interaction')}>
                    <MousePointer size={16} /> Test tương tác
                </button>
                <button style={tabStyle('history')} onClick={() => setActiveTab('history')}>
                    <History size={16} /> Lịch sử
                </button>
            </div>

            {/* URL Input (shared) — hidden on history tab */}
            <div style={{ background: '#1e293b', padding: '20px 24px', borderRadius: '0 8px 0 0', display: activeTab === 'history' ? 'none' : 'block' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKeyPress}
                        placeholder="Nhập URL cần test (vd: https://example.com)"
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
                    />
                    <button onClick={() => setShowLogin(!showLogin)}
                        style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: showLogin ? '#1d4ed8' : '#0f172a', color: '#e2e8f0', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
                        🔐 Login
                    </button>
                </div>
                {showLogin && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email"
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13 }} />
                        <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" type="password"
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13 }} />
                    </div>
                )}
            </div>

            {/* Tab Content */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 24, minHeight: 400 }}>
                {activeTab === 'enhanced' && <EnhancedTab
                    presets={presets} desktop={desktop} setDesktop={setDesktop}
                    tablet={tablet} setTablet={setTablet} mobile={mobile} setMobile={setMobile}
                    loading={loading} onRun={runEnhancedCheck} result={enhancedResult}
                    severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
                    categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
                />}
                {activeTab === 'design' && <DesignTab
                    designFile={designFile} designPreview={designPreview}
                    onFileChange={handleDesignFileChange} loading={loading}
                    onRun={runDesignCompare} result={designResult}
                    threshold={designThreshold} setThreshold={setDesignThreshold}
                    presets={presets} device={designDevice} setDevice={setDesignDevice}
                />}
                {activeTab === 'interaction' && <InteractionTab
                    loading={loading} onRun={runInteractionTest} result={interactionResult}
                    testLevel={testLevel} setTestLevel={setTestLevel}
                    maxActions={maxActions} setMaxActions={setMaxActions}
                    presets={presets} device={interactionDevice} setDevice={setInteractionDevice}
                />}
                {activeTab === 'history' && <HistoryTab
                    records={historyList} total={historyTotal} loading={historyLoading}
                    filter={historyFilter} setFilter={setHistoryFilter}
                    detail={historyDetail} onLoadDetail={loadHistoryDetail}
                    onDelete={deleteHistory} onExport={exportReport}
                    onBack={() => setHistoryDetail(null)}
                />}
            </div>
        </div>
    )
}

// ========== TAB 1: ENHANCED UI CHECK ==========

function EnhancedTab({ presets, desktop, setDesktop, tablet, setTablet, mobile, setMobile, loading, onRun, result, severityFilter, setSeverityFilter, categoryFilter, setCategoryFilter }) {
    const [enhancedViewMode, setEnhancedViewMode] = useState('checklist') // 'checklist' | 'issues'
    const [expandedIssue, setExpandedIssue] = useState(null)

    const selStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }

    return (
        <div>
            {/* Device selectors + Run button */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                {presets && <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Monitor size={14} />
                        <select value={desktop} onChange={e => setDesktop(e.target.value)} style={selStyle}>
                            {presets.desktop.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tablet size={14} />
                        <select value={tablet} onChange={e => setTablet(e.target.value)} style={selStyle}>
                            {presets.tablet.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Smartphone size={14} />
                        <select value={mobile} onChange={e => setMobile(e.target.value)} style={selStyle}>
                            {presets.mobile.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                </>}
                <button onClick={onRun} disabled={loading}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                    {loading ? <><Loader2 size={16} className="spin" /> Đang kiểm tra...</> : <><ScanSearch size={16} /> Kiểm thử giao diện</>}
                </button>
            </div>

            {/* Results */}
            {result && (
                <div>
                    {/* Score Cards Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: result.checklistSummary ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>
                        <QualityScoreCard summary={result.summary} />
                        {result.checklistSummary && <ChecklistSummaryCard summary={result.checklistSummary} />}
                    </div>

                    {/* View Mode Toggle */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                        <button onClick={() => setEnhancedViewMode('checklist')}
                            style={{
                                padding: '8px 18px', borderRadius: 8, border: `2px solid ${enhancedViewMode === 'checklist' ? '#2563eb' : '#e2e8f0'}`,
                                background: enhancedViewMode === 'checklist' ? '#eff6ff' : '#fff',
                                color: enhancedViewMode === 'checklist' ? '#1d4ed8' : '#475569',
                                cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                            <CheckCircle2 size={14} /> Checklist ({result.checklistSummary?.total || 0} tests)
                        </button>
                        <button onClick={() => setEnhancedViewMode('issues')}
                            style={{
                                padding: '8px 18px', borderRadius: 8, border: `2px solid ${enhancedViewMode === 'issues' ? '#2563eb' : '#e2e8f0'}`,
                                background: enhancedViewMode === 'issues' ? '#eff6ff' : '#fff',
                                color: enhancedViewMode === 'issues' ? '#1d4ed8' : '#475569',
                                cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                            <AlertTriangle size={14} /> Issues ({result.issues?.length || 0} issues)
                        </button>
                    </div>

                    {/* Screenshots */}
                    {result.screenshots && (
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, margin: '0 0 16px 0' }}>
                            {['desktop', 'tablet', 'mobile'].map(vp => result.screenshots[vp] && (
                                <div key={vp} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                    <div style={{ padding: '6px 10px', background: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>
                                        {vp === 'desktop' ? '🖥️' : vp === 'tablet' ? '📱' : '📲'} {result.devices[vp]}
                                    </div>
                                    <img src={result.screenshots[vp]} alt={vp} style={{ width: '100%', display: 'block' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Checklist View */}
                    {enhancedViewMode === 'checklist' && result.checklist && (
                        <ChecklistView checklist={result.checklist} />
                    )}
                    {enhancedViewMode === 'checklist' && !result.checklist && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                            Checklist chưa có dữ liệu. Hãy chạy kiểm tra lại.
                        </div>
                    )}

                    {/* Issues View */}
                    {enhancedViewMode === 'issues' && (
                        <>
                            {/* Category overview */}
                            {result.summary.checkCategories && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, margin: '0 0 16px 0' }}>
                                    {Object.entries(result.summary.checkCategories).map(([key, cat]) => (
                                        <div key={key} onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
                                            style={{ padding: '10px 12px', borderRadius: 8, background: categoryFilter === key ? '#dbeafe' : '#fff', border: `1px solid ${cat.passed ? '#d1fae5' : '#fecaca'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{CATEGORY_ICONS[key]?.icon || '📋'} {cat.label}</div>
                                            <div style={{ fontSize: 12, color: cat.total === 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>
                                                {cat.total === 0 ? '✅ Passed' : `${cat.total} vấn đề`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Filters */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>Filter:</span>
                                {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
                                    <button key={s} onClick={() => setSeverityFilter(s)}
                                        style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #cbd5e1', background: severityFilter === s ? '#1e293b' : '#fff', color: severityFilter === s ? '#fff' : '#475569', fontSize: 12, cursor: 'pointer' }}>
                                        {s === 'all' ? 'Tất cả' : SEVERITY_CONFIG[s]?.label || s}
                                    </button>
                                ))}
                            </div>

                            {/* Issue list */}
                            <IssueList issues={result.issues} severityFilter={severityFilter} categoryFilter={categoryFilter}
                                expandedIssue={expandedIssue} setExpandedIssue={setExpandedIssue} />
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// ========== CHECKLIST COMPONENTS ==========

const CHECKLIST_GROUP_ORDER = [
    'layoutUI', 'uiComponents', 'textContent', 'imageIcon',
    'scrollPosition', 'loadingAnimation', 'accessibility', 'linkNavigation',
]

const CHECKLIST_GROUP_META = {
    layoutUI:         { icon: '📐', name: 'Layout & UI hiển thị' },
    uiComponents:     { icon: '🔘', name: 'UI Components' },
    textContent:      { icon: '📝', name: 'Text & Content' },
    imageIcon:        { icon: '🖼️', name: 'Image & Icon' },
    scrollPosition:   { icon: '📜', name: 'Scroll & Position' },
    loadingAnimation: { icon: '⏳', name: 'Loading & Animation' },
    accessibility:    { icon: '♿', name: 'Accessibility' },
    linkNavigation:   { icon: '🔗', name: 'Link & Navigation' },
}

function ChecklistSummaryCard({ summary }) {
    const rate = summary.passRate ?? 0
    const getColor = (r) => r >= 90 ? '#16a34a' : r >= 70 ? '#ca8a04' : r >= 50 ? '#ea580c' : '#dc2626'
    const getLabel = (r) => r >= 90 ? 'Tốt' : r >= 70 ? 'Khá' : r >= 50 ? 'Trung bình' : 'Cần cải thiện'

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    border: `4px solid ${getColor(rate)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 700, color: getColor(rate),
                }}>
                    {rate}%
                </div>
                <div style={{ fontSize: 12, color: getColor(rate), fontWeight: 600, marginTop: 4 }}>{getLabel(rate)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Checklist</div>
            </div>
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Kết quả Checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>✅ Passed</span>
                        <span style={{ fontWeight: 600, color: '#16a34a' }}>{summary.passed}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>❌ Failed</span>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{summary.failed}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>⚠️ Warning</span>
                        <span style={{ fontWeight: 600, color: '#ca8a04' }}>{summary.warning}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>⏭️ Skipped</span>
                        <span style={{ fontWeight: 600, color: '#64748b' }}>{summary.skipped}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>📊 Tổng</span>
                        <span style={{ fontWeight: 600 }}>{summary.total}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ChecklistView({ checklist }) {
    const [expandedGroups, setExpandedGroups] = useState(new Set(CHECKLIST_GROUP_ORDER))
    const [expandedTest, setExpandedTest] = useState(null)
    const [lightboxImg, setLightboxImg] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') setLightboxImg(null) }
        if (lightboxImg) window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [lightboxImg])

    const toggleGroup = (key) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const expandAll = () => setExpandedGroups(new Set(CHECKLIST_GROUP_ORDER))
    const collapseAll = () => setExpandedGroups(new Set())

    const getGroupStats = (tests) => {
        const passed = tests.filter(t => t.status === 'passed').length
        const failed = tests.filter(t => t.status === 'failed').length
        const warnings = tests.filter(t => t.status === 'warning').length
        return { passed, failed, warnings, total: tests.length }
    }

    const filterTests = (tests) => {
        if (statusFilter === 'all') return tests
        if (statusFilter === 'failed') return tests.filter(t => t.status === 'failed' || t.status === 'error')
        if (statusFilter === 'warning') return tests.filter(t => t.status === 'warning')
        return tests
    }

    // Count totals for filter badges
    const allTests = CHECKLIST_GROUP_ORDER.flatMap(k => checklist[k] || [])
    const totalFailed = allTests.filter(t => t.status === 'failed' || t.status === 'error').length
    const totalWarnings = allTests.filter(t => t.status === 'warning').length

    return (
        <div>
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>📋 Checklist kiểm tra giao diện ({allTests.length} tests)</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Filter size={13} color="#64748b" />
                    <button onClick={() => setStatusFilter('all')}
                        style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #cbd5e1', background: statusFilter === 'all' ? '#1e293b' : '#fff', color: statusFilter === 'all' ? '#fff' : '#475569', fontSize: 12, cursor: 'pointer' }}>
                        Tất cả
                    </button>
                    {totalFailed > 0 && (
                        <button onClick={() => setStatusFilter('failed')}
                            style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #fecaca', background: statusFilter === 'failed' ? '#dc2626' : '#fff', color: statusFilter === 'failed' ? '#fff' : '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                            ❌ Failed ({totalFailed})
                        </button>
                    )}
                    {totalWarnings > 0 && (
                        <button onClick={() => setStatusFilter('warning')}
                            style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #fde68a', background: statusFilter === 'warning' ? '#ca8a04' : '#fff', color: statusFilter === 'warning' ? '#fff' : '#ca8a04', fontSize: 12, cursor: 'pointer' }}>
                            ⚠️ Warning ({totalWarnings})
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={expandAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Mở tất cả</button>
                    <button onClick={collapseAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Thu gọn</button>
                </div>
            </div>

            {/* Group list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CHECKLIST_GROUP_ORDER.map(groupKey => {
                    const tests = checklist[groupKey]
                    if (!tests || tests.length === 0) return null

                    const filtered = filterTests(tests)
                    if (statusFilter !== 'all' && filtered.length === 0) return null

                    const meta = CHECKLIST_GROUP_META[groupKey] || { icon: '📋', name: groupKey }
                    const stats = getGroupStats(tests)
                    const isExpanded = expandedGroups.has(groupKey)

                    const groupBorderColor = stats.failed > 0 ? '#fecaca' : stats.warnings > 0 ? '#fde68a' : '#d1fae5'

                    return (
                        <div key={groupKey} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${groupBorderColor}`, overflow: 'hidden' }}>
                            {/* Group Header */}
                            <div onClick={() => toggleGroup(groupKey)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                                    cursor: 'pointer', background: isExpanded ? '#f0f9ff' : '#fafafa',
                                    userSelect: 'none', transition: 'background 0.15s',
                                }}>
                                {isExpanded ? <ChevronDown size={14} color="#2563eb" /> : <ChevronRight size={14} color="#475569" />}
                                <span style={{ fontSize: 16 }}>{meta.icon}</span>
                                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                                    {meta.name}
                                    <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 6 }}>({stats.total} tests)</span>
                                </span>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    {stats.passed > 0 && (
                                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>
                                            ✅ {stats.passed}
                                        </span>
                                    )}
                                    {stats.failed > 0 && (
                                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>
                                            ❌ {stats.failed}
                                        </span>
                                    )}
                                    {stats.warnings > 0 && (
                                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#fef9c3', color: '#a16207', fontWeight: 600 }}>
                                            ⚠️ {stats.warnings}
                                        </span>
                                    )}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: stats.failed > 0 ? '#dc2626' : '#16a34a' }}>
                                    {stats.passed}/{stats.total}
                                </span>
                            </div>

                            {/* Group Body */}
                            {isExpanded && (
                                <div style={{ borderTop: '1px solid #e2e8f0', padding: '6px 8px', background: '#f8fafc' }}>
                                    {filtered.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 13 }}>
                                            Không có test nào khớp với bộ lọc
                                        </div>
                                    ) : (
                                        filtered.map((test, idx) => {
                                            const testKey = `${groupKey}-${idx}`
                                            const status = TEST_STATUS_CONFIG[test.status] || TEST_STATUS_CONFIG.error
                                            const isTestExpanded = expandedTest === testKey
                                            return (
                                                <div key={testKey} style={{ marginBottom: 3, background: '#fff', borderRadius: 8, border: `1px solid ${status.color}22`, overflow: 'hidden' }}>
                                                    <div onClick={() => setExpandedTest(isTestExpanded ? null : testKey)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: status.bg }}>
                                                        {isTestExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                        <span style={{ fontSize: 13 }}>{status.icon}</span>
                                                        <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 32 }}>{test.caseId || ''}</span>
                                                        <span style={{ fontSize: 13, flex: 1 }}>{test.name}</span>
                                                        {test.duration_ms != null && <span style={{ fontSize: 11, color: '#94a3b8' }}>{test.duration_ms}ms</span>}
                                                    </div>
                                                    {isTestExpanded && (
                                                        <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
                                                            <div style={{ color: '#475569', marginBottom: 8 }}>{test.details}</div>
                                                            {test.selector && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Selector: <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>{test.selector}</code></div>}
                                                            {test.screenshot && (
                                                                <div onClick={() => setLightboxImg(test.screenshot)}
                                                                    style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0', maxWidth: 600, cursor: 'zoom-in' }}>
                                                                    <img src={test.screenshot} alt={test.name} style={{ width: '100%', display: 'block' }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Lightbox */}
            {lightboxImg && (
                <div className="lightbox" onClick={() => setLightboxImg(null)}>
                    <button className="lightbox-close" onClick={() => setLightboxImg(null)}>✕</button>
                    <img src={lightboxImg} alt="Screenshot" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    )
}

// ========== TAB 2: DESIGN COMPARE ==========

function DeviceSelector({ presets, device, setDevice }) {
    const allDevices = [
        ...(presets?.desktop || []).map(d => ({ value: `desktop-${d.value}`, label: `🖥️ ${d.label}`, group: 'Desktop' })),
        ...(presets?.tablet || []).map(d => ({ value: `tablet-${d.value}`, label: `📱 ${d.label}`, group: 'Tablet' })),
        ...(presets?.mobile || []).map(d => ({ value: `mobile-${d.value}`, label: `📲 ${d.label}`, group: 'Mobile' })),
    ]
    return (
        <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Thiết bị</label>
            <select value={device} onChange={e => setDevice(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}>
                {allDevices.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                ))}
            </select>
        </div>
    )
}

function DesignTab({ designFile, designPreview, onFileChange, loading, onRun, result, threshold, setThreshold, presets, device, setDevice }) {
    return (
        <div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
                {/* Upload area */}
                <div style={{ flex: 1 }}>
                    <label style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: 30, borderRadius: 12, border: '2px dashed #94a3b8', cursor: 'pointer',
                        background: designPreview ? '#f0f9ff' : '#fff', transition: 'all 0.2s', minHeight: 150
                    }}>
                        <input type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
                        {designPreview ? (
                            <img src={designPreview} alt="Design preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                        ) : (
                            <>
                                <Upload size={32} color="#94a3b8" />
                                <div style={{ marginTop: 8, fontSize: 14, color: '#64748b', textAlign: 'center' }}>
                                    <strong>Upload ảnh Design</strong><br />
                                    <span style={{ fontSize: 12 }}>PNG, JPG - Screenshot từ Figma/Adobe XD/Sketch</span>
                                </div>
                            </>
                        )}
                    </label>
                </div>

                {/* Settings */}
                <div style={{ width: 220 }}>
                    <div style={{ marginBottom: 12 }}>
                        <DeviceSelector presets={presets} device={device} setDevice={setDevice} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Tolerance (0-1)</label>
                        <input type="range" min="0.05" max="0.5" step="0.05" value={threshold}
                            onChange={e => setThreshold(parseFloat(e.target.value))}
                            style={{ width: '100%' }} />
                        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>{threshold} ({threshold < 0.1 ? 'Strict' : threshold < 0.2 ? 'Normal' : 'Loose'})</div>
                    </div>
                    <button onClick={onRun} disabled={loading || !designFile}
                        style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none', background: loading ? '#94a3b8' : '#7c3aed', color: '#fff', cursor: loading || !designFile ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {loading ? <><Loader2 size={16} className="spin" /> Đang so sánh...</> : <><Palette size={16} /> So sánh</>}
                    </button>
                </div>
            </div>

            {/* Design compare results */}
            {result && <DesignCompareResult result={result} />}
        </div>
    )
}

// ========== TAB 3: INTERACTION TEST ==========

function InteractionTab({ loading, onRun, result, testLevel, setTestLevel, maxActions, setMaxActions, presets, device, setDevice }) {
    const levelInfo = {
        smart: { label: 'Smart Test', desc: 'Tự phát hiện forms, buttons, links → test từng cái', icon: '🧠' },
        chaos: { label: 'Chaos Test', desc: 'Random click/type/scroll 500 lần → tìm crash', icon: '🐒' },
        full: { label: 'Full Test', desc: 'Smart + Chaos (đầy đủ nhất, lâu nhất)', icon: '🚀' },
    }

    return (
        <div>
            {/* Level selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                {Object.entries(levelInfo).map(([key, info]) => (
                    <button key={key} onClick={() => setTestLevel(key)}
                        style={{
                            padding: '12px 16px', borderRadius: 10,
                            border: `2px solid ${testLevel === key ? '#2563eb' : '#e2e8f0'}`,
                            background: testLevel === key ? '#eff6ff' : '#fff',
                            cursor: 'pointer', textAlign: 'left',
                        }}>
                        <div style={{ fontSize: 16 }}>{info.icon} <strong>{info.label}</strong></div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{info.desc}</div>
                    </button>
                ))}
            </div>

            {/* Device + Chaos settings */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 220 }}>
                    <DeviceSelector presets={presets} device={device} setDevice={setDevice} />
                </div>
                {(testLevel === 'chaos' || testLevel === 'full') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 13, color: '#64748b' }}>Số hành động ngẫu nhiên:</label>
                        <input type="number" value={maxActions} onChange={e => setMaxActions(parseInt(e.target.value) || 500)}
                            min={100} max={2000} step={100}
                            style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
                    </div>
                )}
            </div>

            <button onClick={onRun} disabled={loading}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: loading ? '#94a3b8' : '#059669', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                {loading ? <><Loader2 size={16} className="spin" /> Đang test tương tác...</> : <><Play size={16} /> Bắt đầu test</>}
            </button>

            {/* Results */}
            {result && <InteractionResult result={result} />}
        </div>
    )
}

// ========== SUB-COMPONENTS ==========

function QualityScoreCard({ summary }) {
    const score = summary.qualityScore ?? 0
    const getScoreColor = (s) => s >= 90 ? '#16a34a' : s >= 70 ? '#ca8a04' : s >= 50 ? '#ea580c' : '#dc2626'
    const getScoreLabel = (s) => s >= 90 ? 'Tốt' : s >= 70 ? 'Khá' : s >= 50 ? 'Trung bình' : 'Cần cải thiện'

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 16, padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            {/* Score circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    border: `4px solid ${getScoreColor(score)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 700, color: getScoreColor(score),
                }}>
                    {score}
                </div>
                <div style={{ fontSize: 12, color: getScoreColor(score), fontWeight: 600, marginTop: 4 }}>{getScoreLabel(score)}</div>
            </div>

            {/* Issue counts */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Phân loại theo mức độ</div>
                {Object.entries(summary.byPriority || {}).map(([p, count]) => {
                    const cfg = SEVERITY_CONFIG[p] || {};
                    return (
                        <div key={p} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13 }}>
                            <span>{cfg.icon || '📝'} {cfg.label || p}</span>
                            <span style={{ fontWeight: 600, color: cfg.color }}>{count}</span>
                        </div>
                    );
                })}
            </div>

            {/* Stats */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Thống kê</div>
                <div style={{ fontSize: 13, padding: '2px 0' }}>📊 Tổng issues: <strong>{summary.total}</strong></div>
                <div style={{ fontSize: 13, padding: '2px 0' }}>🔄 Hệ thống: <strong>{summary.systematicProblems || 0}</strong></div>
                <div style={{ fontSize: 13, padding: '2px 0' }}>🚫 False positive: <strong>{summary.likelyFalsePositives || 0}</strong></div>
                <div style={{ fontSize: 13, padding: '2px 0' }}>⏱️ Thời gian: <strong>{((summary.duration_ms || 0) / 1000).toFixed(1)}s</strong></div>
            </div>
        </div>
    )
}

function IssueList({ issues, severityFilter, categoryFilter, expandedIssue, setExpandedIssue }) {
    const filtered = issues.filter(i => {
        if (severityFilter !== 'all' && i.severity !== severityFilter) return false
        if (categoryFilter !== 'all' && i.metadata?.category !== categoryFilter) return false
        return true
    })

    if (filtered.length === 0) {
        return <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            {issues.length === 0 ? '✅ Không tìm thấy vấn đề nào!' : '🔍 Không có issues matching filter'}
        </div>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Hiển thị {filtered.length}/{issues.length} issues</div>
            {filtered.map((issue, idx) => {
                const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.MEDIUM
                const isExpanded = expandedIssue === idx
                return (
                    <div key={idx} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${sev.color}22`, overflow: 'hidden' }}>
                        {/* Header */}
                        <div onClick={() => setExpandedIssue(isExpanded ? null : idx)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', background: sev.bg }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 4, background: sev.color, color: '#fff', fontWeight: 600 }}>{issue.severity}</span>
                            <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 4, background: '#e2e8f0', color: '#475569' }}>{issue.type}</span>
                            <span style={{ fontSize: 13, flex: 1 }}>{issue.description?.substring(0, 100)}</span>
                            {issue.score && <span style={{ fontSize: 11, color: '#94a3b8' }}>Score: {issue.score}</span>}
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{issue.viewport}</span>
                        </div>

                        {/* Details */}
                        {isExpanded && (
                            <div style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
                                {issue.details && <div style={{ marginBottom: 8, color: '#475569' }}><strong>Chi tiết:</strong> {issue.details}</div>}
                                {issue.selector && (
                                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <strong>Selector:</strong>
                                        <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{issue.selector}</code>
                                        <button onClick={() => { navigator.clipboard.writeText(issue.selector); toast.success('Copied!') }}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}><Copy size={12} /></button>
                                    </div>
                                )}
                                {issue.metadata && (
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                        {issue.metadata.priority && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#dbeafe', color: '#1d4ed8' }}>Priority: {issue.metadata.priority}</span>}
                                        {issue.metadata.fixEffort && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#92400e' }}>Effort: {issue.metadata.fixEffort}</span>}
                                        {issue.metadata.category && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f3e8ff', color: '#7c3aed' }}>Category: {issue.metadata.category}</span>}
                                    </div>
                                )}
                                {issue.autoFix && (
                                    <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, marginTop: 8 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 6 }}>💡 {issue.autoFix.title}</div>
                                        {issue.autoFix.description && <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{issue.autoFix.description}</div>}
                                        {issue.autoFix.code && (
                                            <div style={{ position: 'relative' }}>
                                                <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 200 }}>{issue.autoFix.code}</pre>
                                                <button onClick={() => { navigator.clipboard.writeText(issue.autoFix.code); toast.success('Code copied!') }}
                                                    style={{ position: 'absolute', top: 6, right: 6, background: '#334155', border: 'none', borderRadius: 4, padding: '3px 8px', color: '#e2e8f0', cursor: 'pointer', fontSize: 11 }}>
                                                    <Copy size={10} /> Copy
                                                </button>
                                            </div>
                                        )}
                                        {issue.autoFix.steps && (
                                            <ol style={{ margin: '8px 0 0 16px', fontSize: 12, color: '#475569' }}>
                                                {issue.autoFix.steps.map((s, i) => <li key={i} style={{ marginBottom: 2 }}>{s}</li>)}
                                            </ol>
                                        )}
                                        {issue.autoFix.estimatedTime && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>⏱️ Ước tính: {issue.autoFix.estimatedTime}</div>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function DesignCompareResult({ result }) {
    const [viewMode, setViewMode] = useState('side')
    const s = result.summary

    const gradeColors = { 'A+': '#16a34a', 'A': '#22c55e', 'B': '#84cc16', 'C': '#eab308', 'D': '#f97316', 'F': '#ef4444' }

    return (
        <div>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: gradeColors[s.grade] || '#64748b' }}>{s.grade}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Grade</div>
                </div>
                <div style={{ padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: result.matchPercent >= 90 ? '#16a34a' : result.matchPercent >= 70 ? '#ca8a04' : '#dc2626' }}>{result.matchPercent}%</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Khớp</div>
                </div>
                <div style={{ padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#475569' }}>{s.totalRegions}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Vùng khác biệt</div>
                </div>
                <div style={{ padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: s.colorPaletteMatch ? '#16a34a' : '#ca8a04' }}>{s.colorPaletteMatch ? '✅' : '⚠️'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Color palette</div>
                </div>
            </div>

            <div style={{ padding: '10px 16px', background: '#f8fafc', borderRadius: 8, marginBottom: 16, fontSize: 14, color: '#475569' }}>
                {s.verdict}
            </div>

            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {['side', 'diff', 'overlay'].map(m => (
                    <button key={m} onClick={() => setViewMode(m)}
                        style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: viewMode === m ? '#1e293b' : '#fff', color: viewMode === m ? '#fff' : '#475569', fontSize: 12, cursor: 'pointer' }}>
                        {m === 'side' ? '↔️ So sánh' : m === 'diff' ? '🔴 Diff' : '🔀 Overlay'}
                    </button>
                ))}
            </div>

            {/* Images */}
            {viewMode === 'side' && result.screenshots && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <div style={{ padding: '6px 10px', background: '#dbeafe', fontSize: 12, fontWeight: 600 }}>🎨 Design</div>
                        <img src={result.screenshots.design} alt="Design" style={{ width: '100%', display: 'block' }} />
                    </div>
                    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <div style={{ padding: '6px 10px', background: '#dcfce7', fontSize: 12, fontWeight: 600 }}>🌐 Trang thực tế</div>
                        <img src={result.screenshots.page} alt="Page" style={{ width: '100%', display: 'block' }} />
                    </div>
                </div>
            )}
            {viewMode === 'diff' && result.screenshots && (
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <div style={{ padding: '6px 10px', background: '#fef2f2', fontSize: 12, fontWeight: 600 }}>🔴 Diff (vùng đỏ = khác biệt)</div>
                    <img src={result.screenshots.diff} alt="Diff" style={{ width: '100%', display: 'block' }} />
                </div>
            )}
            {viewMode === 'overlay' && result.screenshots && (
                <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <div style={{ padding: '6px 10px', background: '#f5f3ff', fontSize: 12, fontWeight: 600 }}>🔀 Overlay (Design + Diff)</div>
                    <div style={{ position: 'relative' }}>
                        <img src={result.screenshots.design} alt="Design" style={{ width: '100%', display: 'block' }} />
                        <img src={result.screenshots.diff} alt="Diff" style={{ position: 'absolute', top: 0, left: 0, width: '100%', opacity: 0.5, mixBlendMode: 'multiply' }} />
                    </div>
                </div>
            )}

            {/* Color palette comparison */}
            {result.colorAnalysis && result.colorAnalysis.mismatches.length > 0 && (
                <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>🎨 Khác biệt màu sắc</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {result.colorAnalysis.mismatches.map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                                <div style={{ width: 24, height: 24, borderRadius: 4, background: m.designColor, border: '1px solid #e2e8f0' }} />
                                <span>→</span>
                                <div style={{ width: 24, height: 24, borderRadius: 4, background: m.pageColor, border: '1px solid #e2e8f0' }} />
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>Δ{m.distance}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Diff regions */}
            {result.issues && result.issues.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>📍 Vùng khác biệt chi tiết</div>
                    {result.issues.map((issue, i) => (
                        <div key={i} style={{ padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #fecaca', marginBottom: 6, fontSize: 13 }}>
                            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: SEVERITY_CONFIG[issue.severity]?.bg, color: SEVERITY_CONFIG[issue.severity]?.color, fontWeight: 600, marginRight: 8 }}>{issue.severity}</span>
                            {issue.description}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function InteractionResult({ result }) {
    const [expandedTest, setExpandedTest] = useState(null)
    const [expandedGroups, setExpandedGroups] = useState(new Set())
    const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'failed' | 'warning'
    const [lightboxImg, setLightboxImg] = useState(null)
    const s = result.summary
    const groups = result.testGroups || {}

    // Close lightbox on ESC
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') setLightboxImg(null) }
        if (lightboxImg) window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [lightboxImg])

    const toggleGroup = (key) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const expandAll = () => {
        const allKeys = GROUP_ORDER.filter(k => groups[k] && !groups[k].skipped && (groups[k].tests?.length > 0))
        setExpandedGroups(new Set(allKeys))
    }
    const collapseAll = () => setExpandedGroups(new Set())

    // Compute group stats
    const getGroupStats = (groupData) => {
        const tests = groupData?.tests || []
        const passed = tests.filter(t => t.status === 'passed').length
        const failed = tests.filter(t => t.status === 'failed').length
        const warnings = tests.filter(t => t.status === 'warning').length
        const errors = tests.filter(t => t.status === 'error').length
        const totalDuration = tests.reduce((sum, t) => sum + (t.duration_ms || 0), 0)
        return { passed, failed, warnings, errors, total: tests.length, totalDuration }
    }

    // Filter tests inside a group
    const filterTests = (tests) => {
        if (statusFilter === 'all') return tests
        if (statusFilter === 'failed') return tests.filter(t => t.status === 'failed' || t.status === 'error')
        if (statusFilter === 'warning') return tests.filter(t => t.status === 'warning')
        return tests
    }

    // Check if group should be visible based on filter
    const isGroupVisible = (groupData) => {
        if (!groupData) return false
        if (groupData.skipped) return statusFilter === 'all'
        if (statusFilter === 'all') return true
        return filterTests(groupData.tests || []).length > 0
    }

    const hasGroups = GROUP_ORDER.some(k => groups[k])

    // Count filters
    const totalFailed = (result.tests || []).filter(t => t.status === 'failed' || t.status === 'error').length
    const totalWarnings = (result.tests || []).filter(t => t.status === 'warning').length

    return (
        <div style={{ marginTop: 20 }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                <SummaryCard label="Passed" value={s.passed} color="#16a34a" />
                <SummaryCard label="Failed" value={s.failed} color="#dc2626" />
                <SummaryCard label="Warning" value={s.warnings} color="#ca8a04" />
                <SummaryCard label="Error" value={s.errors} color="#7c3aed" />
                <SummaryCard label="Skipped" value={s.skipped} color="#64748b" />
            </div>

            {/* Pass rate */}
            <div style={{ padding: '12px 16px', background: s.verdict === 'PASS' ? '#f0fdf4' : s.verdict === 'WARNING' ? '#fefce8' : '#fef2f2', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.verdict === 'PASS' ? '✅' : s.verdict === 'WARNING' ? '⚠️' : '❌'} {s.verdictText}</span>
                <span style={{ fontSize: 13, color: '#64748b' }}>Pass rate: {s.passRate}% | {(s.duration_ms / 1000).toFixed(1)}s</span>
            </div>

            {/* Discovery info */}
            {s.discovery && (
                <div style={{ padding: '10px 16px', background: '#eff6ff', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>🔍 Phát hiện: <strong>{s.discovery.totalInteractive}</strong> elements tương tác</span>
                    <span>📝 {s.discovery.forms} forms</span>
                    <span>🔗 {s.discovery.navLinks} nav links</span>
                    <span>🔘 {s.discovery.buttons} buttons</span>
                    <span>📂 {s.discovery.dropdowns} dropdowns</span>
                    <span>☑️ {s.discovery.checkboxes} checkboxes</span>
                    <span>🖼️ {s.discovery.images} images</span>
                    <span>📅 {s.discovery.dateInputs} date inputs</span>
                </div>
            )}

            {/* Chaos test result */}
            {s.chaosTest && (
                <div style={{ padding: '12px 16px', background: s.chaosTest.pageStillResponsive ? '#f0fdf4' : '#fef2f2', borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>🐒 Chaos Test Result</div>
                    <div style={{ fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span>Actions: <strong>{s.chaosTest.actions}</strong></span>
                        <span>JS Errors: <strong style={{ color: s.chaosTest.jsErrors > 0 ? '#dc2626' : '#16a34a' }}>{s.chaosTest.jsErrors}</strong></span>
                        <span>Console Errors: <strong>{s.chaosTest.consoleErrors}</strong></span>
                        <span>Trang responsive: <strong style={{ color: s.chaosTest.pageStillResponsive ? '#16a34a' : '#dc2626' }}>{s.chaosTest.pageStillResponsive ? 'Có' : 'KHÔNG'}</strong></span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: s.chaosTest.verdict.startsWith('PASS') ? '#16a34a' : s.chaosTest.verdict.startsWith('FAIL') ? '#dc2626' : '#ca8a04' }}>
                        {s.chaosTest.verdict}
                    </div>
                </div>
            )}

            {/* Grouped Test Accordion */}
            {hasGroups ? (
                <div>
                    {/* Header + Filter bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>📋 Chi tiết test ({(result.tests || []).length})</div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Filter size={13} color="#64748b" />
                            <button onClick={() => setStatusFilter('all')}
                                style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #cbd5e1', background: statusFilter === 'all' ? '#1e293b' : '#fff', color: statusFilter === 'all' ? '#fff' : '#475569', fontSize: 12, cursor: 'pointer' }}>
                                Tất cả
                            </button>
                            {totalFailed > 0 && (
                                <button onClick={() => setStatusFilter('failed')}
                                    style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #fecaca', background: statusFilter === 'failed' ? '#dc2626' : '#fff', color: statusFilter === 'failed' ? '#fff' : '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                                    ❌ Failed ({totalFailed})
                                </button>
                            )}
                            {totalWarnings > 0 && (
                                <button onClick={() => setStatusFilter('warning')}
                                    style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #fde68a', background: statusFilter === 'warning' ? '#ca8a04' : '#fff', color: statusFilter === 'warning' ? '#fff' : '#ca8a04', fontSize: 12, cursor: 'pointer' }}>
                                    ⚠️ Warning ({totalWarnings})
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={expandAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Mở tất cả</button>
                            <button onClick={collapseAll} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Thu gọn</button>
                        </div>
                    </div>

                    {/* Group list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {GROUP_ORDER.map((groupKey, gIdx) => {
                            const groupData = groups[groupKey]
                            if (!groupData) return null
                            if (!isGroupVisible(groupData)) return null

                            const meta = GROUP_META[groupKey] || { icon: '📋', name: groupKey }
                            const isSkipped = groupData.skipped
                            const stats = getGroupStats(groupData)
                            const isExpanded = expandedGroups.has(groupKey)
                            const filteredTests = isSkipped ? [] : filterTests(groupData.tests || [])

                            // Determine group border color
                            const groupBorderColor = isSkipped ? '#e2e8f0'
                                : stats.failed > 0 ? '#fecaca'
                                : stats.warnings > 0 ? '#fde68a'
                                : '#d1fae5'

                            return (
                                <div key={groupKey}
                                    style={{
                                        background: '#fff', borderRadius: 10,
                                        border: `1px solid ${groupBorderColor}`,
                                        overflow: 'hidden',
                                        opacity: isSkipped ? 0.5 : 1,
                                        transition: 'opacity 0.2s',
                                    }}>
                                    {/* Group Header */}
                                    <div
                                        onClick={() => !isSkipped && toggleGroup(groupKey)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '10px 14px',
                                            cursor: isSkipped ? 'default' : 'pointer',
                                            background: isSkipped ? '#f8fafc' : isExpanded ? '#f0f9ff' : '#fafafa',
                                            userSelect: 'none',
                                            transition: 'background 0.15s',
                                        }}>
                                        {/* Expand icon */}
                                        {isSkipped
                                            ? <ChevronRight size={14} color="#94a3b8" />
                                            : isExpanded
                                                ? <ChevronDown size={14} color="#2563eb" />
                                                : <ChevronRight size={14} color="#475569" />
                                        }
                                        {/* Group icon + name */}
                                        <span style={{ fontSize: 16 }}>{meta.icon}</span>
                                        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                                            {meta.name}
                                            <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 6 }}>({stats.total} tests)</span>
                                        </span>

                                        {/* Skipped badge or mini summary */}
                                        {isSkipped ? (
                                            <span style={{
                                                fontSize: 11, padding: '2px 10px', borderRadius: 12,
                                                background: '#f1f5f9', color: '#94a3b8', fontWeight: 600,
                                            }}>SKIPPED</span>
                                        ) : (
                                            <>
                                                {/* Mini status pills */}
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    {stats.passed > 0 && (
                                                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>
                                                            ✅ {stats.passed}
                                                        </span>
                                                    )}
                                                    {stats.failed > 0 && (
                                                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>
                                                            ❌ {stats.failed}
                                                        </span>
                                                    )}
                                                    {stats.warnings > 0 && (
                                                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#fef9c3', color: '#a16207', fontWeight: 600 }}>
                                                            ⚠️ {stats.warnings}
                                                        </span>
                                                    )}
                                                    {stats.errors > 0 && (
                                                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#f3e8ff', color: '#7c3aed', fontWeight: 600 }}>
                                                            💥 {stats.errors}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Duration */}
                                                <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 50, textAlign: 'right' }}>
                                                    {stats.totalDuration >= 1000
                                                        ? `${(stats.totalDuration / 1000).toFixed(1)}s`
                                                        : `${stats.totalDuration}ms`}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* Group Body — expanded tests */}
                                    {isExpanded && !isSkipped && (
                                        <div style={{
                                            borderTop: '1px solid #e2e8f0',
                                            padding: '6px 8px',
                                            background: '#f8fafc',
                                            animation: 'accordionSlideDown 0.2s ease-out',
                                        }}>
                                            {filteredTests.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 13 }}>
                                                    Không có test nào khớp với bộ lọc
                                                </div>
                                            ) : (
                                                filteredTests.map((test, idx) => {
                                                    const testKey = `${groupKey}-${idx}`
                                                    const status = TEST_STATUS_CONFIG[test.status] || TEST_STATUS_CONFIG.error
                                                    const isTestExpanded = expandedTest === testKey
                                                    return (
                                                        <div key={testKey} style={{
                                                            marginBottom: 3, background: '#fff', borderRadius: 8,
                                                            border: `1px solid ${status.color}22`, overflow: 'hidden',
                                                        }}>
                                                            <div onClick={() => setExpandedTest(isTestExpanded ? null : testKey)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                                    padding: '7px 12px', cursor: 'pointer', background: status.bg,
                                                                }}>
                                                                {isTestExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                <span style={{ fontSize: 13 }}>{status.icon}</span>
                                                                <span style={{ fontSize: 13, flex: 1 }}>{test.name}</span>
                                                                <span style={{ fontSize: 11, color: '#94a3b8' }}>{test.duration_ms}ms</span>
                                                            </div>
                                                            {isTestExpanded && (
                                                                <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
                                                                    <div style={{ color: '#475569', marginBottom: 8 }}>{test.details}</div>
                                                                    {test.selector && <div style={{ fontSize: 12, color: '#94a3b8' }}>Selector: <code>{test.selector}</code></div>}
                                                                    {test.screenshot && (
                                                                        <div onClick={() => setLightboxImg(test.screenshot)}
                                                                            style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0', maxWidth: 600, cursor: 'zoom-in' }}>
                                                                            <img src={test.screenshot} alt={test.name} style={{ width: '100%', display: 'block' }} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                /* Fallback: flat list if no testGroups available (backward compatibility) */
                result.tests && result.tests.length > 0 && (
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>📋 Chi tiết test ({result.tests.length})</div>
                        {result.tests.map((test, idx) => {
                            const status = TEST_STATUS_CONFIG[test.status] || TEST_STATUS_CONFIG.error
                            const isExpanded = expandedTest === idx
                            return (
                                <div key={idx} style={{ marginBottom: 4, background: '#fff', borderRadius: 8, border: `1px solid ${status.color}22`, overflow: 'hidden' }}>
                                    <div onClick={() => setExpandedTest(isExpanded ? null : idx)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: status.bg }}>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <span style={{ fontSize: 14 }}>{status.icon}</span>
                                        <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 4, background: '#e2e8f0', color: '#475569' }}>{test.type}</span>
                                        <span style={{ fontSize: 13, flex: 1 }}>{test.name}</span>
                                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{test.duration_ms}ms</span>
                                    </div>
                                    {isExpanded && (
                                        <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
                                            <div style={{ color: '#475569', marginBottom: 8 }}>{test.details}</div>
                                            {test.selector && <div style={{ fontSize: 12, color: '#94a3b8' }}>Selector: <code>{test.selector}</code></div>}
                                            {test.screenshot && (
                                                <div onClick={() => setLightboxImg(test.screenshot)}
                                                    style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0', maxWidth: 600, cursor: 'zoom-in' }}>
                                                    <img src={test.screenshot} alt={test.name} style={{ width: '100%', display: 'block' }} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {/* Lightbox */}
            {lightboxImg && (
                <div className="lightbox" onClick={() => setLightboxImg(null)}>
                    <button className="lightbox-close" onClick={() => setLightboxImg(null)}>✕</button>
                    <img src={lightboxImg} alt="Screenshot" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    )
}

function SummaryCard({ label, value, color }) {
    return (
        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
        </div>
    )
}

// ========== TAB 4: HISTORY ==========

const TYPE_LABELS = {
    enhanced: { label: 'Kiểm thử giao diện', icon: '🔍', color: '#2563eb' },
    'design-compare': { label: 'So sánh Design', icon: '🎨', color: '#7c3aed' },
    interaction: { label: 'Test tương tác', icon: '🖱️', color: '#059669' },
}

function HistoryTab({ records, total, loading, filter, setFilter, detail, onLoadDetail, onDelete, onExport, onBack }) {
    // Detail view
    if (detail) {
        return <HistoryDetailView record={detail} onBack={onBack} onDelete={onDelete} onExport={onExport} />
    }

    // List view
    return (
        <div>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Lọc:</span>
                {['all', 'enhanced', 'design-compare', 'interaction'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{
                            padding: '5px 14px', borderRadius: 16, border: '1px solid #cbd5e1',
                            background: filter === f ? '#1e293b' : '#fff',
                            color: filter === f ? '#fff' : '#475569',
                            fontSize: 12, cursor: 'pointer',
                        }}>
                        {f === 'all' ? 'Tất cả' : TYPE_LABELS[f]?.label || f}
                    </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>Tổng: {total}</span>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    <Loader2 size={20} className="spin" style={{ display: 'inline-block', marginRight: 8 }} /> Đang tải...
                </div>
            )}

            {!loading && records.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                    Chưa có lịch sử kiểm tra nào.
                </div>
            )}

            {!loading && records.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {records.map(r => {
                        const t = TYPE_LABELS[r.type] || { label: r.type, icon: '📋', color: '#64748b' }
                        const summary = r.summary || {}
                        return (
                            <div key={r._id} onClick={() => onLoadDetail(r._id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                    background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}>
                                <span style={{ fontSize: 20 }}>{t.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                                        <span style={{ padding: '1px 8px', borderRadius: 4, background: t.color + '15', color: t.color, fontSize: 11, marginRight: 8 }}>{t.label}</span>
                                        {r.url}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                        {new Date(r.created_at).toLocaleString('vi-VN')}
                                        {r.type === 'enhanced' && summary.qualityScore != null && <span> | Quality: <strong>{summary.qualityScore}/100</strong></span>}
                                        {r.type === 'enhanced' && summary.total != null && <span> | {summary.total} issues</span>}
                                        {r.type === 'design-compare' && r.matchPercent != null && <span> | Khớp: <strong>{r.matchPercent}%</strong></span>}
                                        {r.type === 'interaction' && summary.passed != null && <span> | {summary.passed}/{summary.totalTests} passed</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={(e) => { e.stopPropagation(); onExport(r._id, 'html') }}
                                        title="Xuất HTML"
                                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Download size={12} /> HTML
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onExport(r._id, 'pdf') }}
                                        title="Xuất PDF"
                                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Download size={12} /> PDF
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(r._id) }}
                                        title="Xóa"
                                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', color: '#dc2626' }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function HistoryDetailView({ record, onBack, onDelete, onExport }) {
    const [severityFilter, setSeverityFilter] = useState('all')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [expandedIssue, setExpandedIssue] = useState(null)

    const t = TYPE_LABELS[record.type] || { label: record.type, icon: '📋', color: '#64748b' }

    return (
        <div>
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={onBack}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ← Quay lại
                </button>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{record.url}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.label} | {new Date(record.created_at).toLocaleString('vi-VN')}</div>
                </div>
                <button onClick={() => onExport(record._id, 'html')}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={14} /> HTML
                </button>
                <button onClick={() => onExport(record._id, 'pdf')}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={14} /> PDF
                </button>
                <button onClick={() => onDelete(record._id)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', color: '#dc2626' }}>
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Render result based on type */}
            {record.type === 'enhanced' && record.result && (
                <div>
                    <QualityScoreCard summary={record.result.summary} />

                    {record.result.summary?.checkCategories && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, margin: '16px 0' }}>
                            {Object.entries(record.result.summary.checkCategories).map(([key, cat]) => (
                                <div key={key} onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
                                    style={{ padding: '10px 12px', borderRadius: 8, background: categoryFilter === key ? '#dbeafe' : '#fff', border: `1px solid ${cat.passed ? '#d1fae5' : '#fecaca'}`, cursor: 'pointer' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{CATEGORY_ICONS[key]?.icon || '📋'} {cat.label}</div>
                                    <div style={{ fontSize: 12, color: cat.total === 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>
                                        {cat.total === 0 ? '✅ Passed' : `${cat.total} vấn đề`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {record.result.screenshots && (
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, margin: '16px 0' }}>
                            {['desktop', 'tablet', 'mobile'].map(vp => record.result.screenshots[vp] && (
                                <div key={vp} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                    <div style={{ padding: '6px 10px', background: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>
                                        {vp === 'desktop' ? '🖥️' : vp === 'tablet' ? '📱' : '📲'} {vp}
                                    </div>
                                    <img src={record.result.screenshots[vp]} alt={vp} style={{ width: '100%', display: 'block' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>Filter:</span>
                        {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
                            <button key={s} onClick={() => setSeverityFilter(s)}
                                style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #cbd5e1', background: severityFilter === s ? '#1e293b' : '#fff', color: severityFilter === s ? '#fff' : '#475569', fontSize: 12, cursor: 'pointer' }}>
                                {s === 'all' ? 'Tất cả' : SEVERITY_CONFIG[s]?.label || s}
                            </button>
                        ))}
                    </div>

                    {record.result.issues && (
                        <IssueList issues={record.result.issues} severityFilter={severityFilter} categoryFilter={categoryFilter}
                            expandedIssue={expandedIssue} setExpandedIssue={setExpandedIssue} />
                    )}
                </div>
            )}

            {record.type === 'design-compare' && record.result && (
                <DesignCompareResult result={record.result} />
            )}

            {record.type === 'interaction' && record.result && (
                <InteractionResult result={record.result} />
            )}
        </div>
    )
}
