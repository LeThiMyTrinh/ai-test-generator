import { useEffect, useState, useRef } from 'react'
import api, { apiUrl } from '../api/client'
import toast from 'react-hot-toast'
import { Plus, Trash2, Upload, Download, Save, ArrowUp, ArrowDown, X, Sparkles, Settings, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Search, Copy, Database, Globe, Send } from 'lucide-react'

const ACTION_GROUPS = {
    'UI cơ bản': ['navigate', 'click', 'fill', 'select', 'hover', 'wait', 'screenshot'],
    'UI nâng cao': ['double_click', 'right_click', 'keyboard', 'scroll_to', 'drag_drop', 'upload_file'],
    'Kiểm tra UI': ['assert_text', 'assert_visible', 'assert_url'],
    'API Testing': ['api_request', 'assert_status', 'assert_body', 'assert_header', 'assert_response_time', 'store_variable'],
}

const ACTIONS = Object.values(ACTION_GROUPS).flat()

const ACTION_LABELS = {
    navigate: '🌐 Mở trang', click: '👆 Click', fill: '✏️ Nhập', select: '📋 Chọn',
    hover: '🖱️ Di chuột', assert_text: '🔍 Kiểm tra text', assert_visible: '👁️ Kiểm tra hiển thị',
    assert_url: '🔗 Kiểm tra URL', wait: '⏱️ Chờ', screenshot: '📸 Chụp ảnh',
    // Extended UI
    double_click: '👆👆 Nhấn đúp', right_click: '🖱️ Chuột phải', keyboard: '⌨️ Phím tắt',
    scroll_to: '📜 Cuộn đến', drag_drop: '🔀 Kéo thả', upload_file: '📁 Upload file',
    // API
    api_request: '🌐 API Request', assert_status: '✅ Kiểm tra status', assert_body: '📋 Kiểm tra body',
    assert_header: '📨 Kiểm tra header', assert_response_time: '⏱️ Kiểm tra thời gian', store_variable: '💾 Lưu biến',
}

const API_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

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
    { value: 'galaxy-s24', label: '📱 Galaxy S24 (360×780)' },
    { value: 'galaxy-s9', label: '📱 Galaxy S9+ (320×658)' },
    { value: 'ipad-pro', label: '📟 iPad Pro 11 (834×1194)' },
    { value: 'ipad-mini', label: '📟 iPad Mini (768×1024)' },
    { value: 'galaxy-tab', label: '📟 Galaxy Tab S4 (712×1138)' },
]

const emptyTC = () => ({ title: '', description: '', url: '', browser: 'chromium', device: '', steps: [emptyStep(1)], nlText: '' })

const NL_PLACEHOLDER = `Viết các bước kiểm thử bằng ngôn ngữ tự nhiên, mỗi dòng = 1 bước.

Ví dụ UI Testing:
Mở trang https://example.com/login
Nhập "admin@test.com" vào ô Email
Nhấn nút "Đăng nhập"
Kiểm tra URL chứa /dashboard

Ví dụ API Testing:
Gọi API POST https://api.example.com/login với body {"email":"admin@test.com"}
Kiểm tra status 200
Kiểm tra body $.data.token không rỗng
Lưu $.data.token vào biến token`

export default function TestCaseEditor({ navigate, ctx }) {
    const { suite_id, suite_name, project_id, project_name } = ctx || {}
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState(project_id || '')
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
    const [search, setSearch] = useState('')
    const [showDataSets, setShowDataSets] = useState(false)
    const [dataSetsTC, setDataSetsTC] = useState('')
    const [dataSets, setDataSets] = useState([])
    const [dsLoading, setDsLoading] = useState(false)
    const [showDSUpload, setShowDSUpload] = useState(false)
    const [dsName, setDsName] = useState('')
    const [dsData, setDsData] = useState([])
    const [dsCsvFile, setDsCsvFile] = useState(null)
    const [expandedDS, setExpandedDS] = useState(null)
    const [nlSuggestions, setNlSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedSuggIdx, setSelectedSuggIdx] = useState(0)
    const fileRef = useRef()
    const csvRef = useRef()
    const postmanRef = useRef()
    const nlRef = useRef()
    const suggestTimer = useRef(null)

    // Load projects
    useEffect(() => { api.get('/api/projects').then(r => setProjects(r.data)) }, [])

    // Load suites filtered by project
    useEffect(() => {
        const url = selectedProject ? `/api/test-suites?project_id=${selectedProject}` : '/api/test-suites'
        api.get(url).then(r => setSuites(r.data))
    }, [selectedProject])

    // Reset suite when project changes (only if current suite doesn't belong to new project)
    useEffect(() => {
        if (selectedProject && selectedSuite) {
            const suiteInProject = suites.find(s => s.id === selectedSuite)
            if (!suiteInProject) setSelectedSuite('')
        }
    }, [suites])

    useEffect(() => { if (selectedSuite) loadTCs() }, [selectedSuite])

    const loadTCs = () => api.get(`/api/test-cases?suite_id=${selectedSuite}`).then(r => setTestCases(r.data))

    // NL autocomplete suggest
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
                } else {
                    setShowSuggestions(false)
                }
            } catch { setShowSuggestions(false) }
        }, 200)
    }

    const applySuggestion = (suggestion) => {
        const lines = form.nlText.split('\n')
        lines[lines.length - 1] = suggestion
        setForm(p => ({ ...p, nlText: lines.join('\n') }))
        setShowSuggestions(false)
        nlRef.current?.focus()
    }

    const handleNlKeyDown = (e) => {
        if (!showSuggestions || nlSuggestions.length === 0) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedSuggIdx(i => (i + 1) % nlSuggestions.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedSuggIdx(i => (i - 1 + nlSuggestions.length) % nlSuggestions.length)
        } else if (e.key === 'Tab') {
            e.preventDefault()
            applySuggestion(nlSuggestions[selectedSuggIdx])
        } else if (e.key === 'Enter') {
            // Enter = đóng gợi ý, để textarea xuống dòng bình thường
            setShowSuggestions(false)
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

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

    const cloneTC = async (id) => {
        try {
            await api.post(`/api/test-cases/${id}/clone`)
            toast.success('Đã tạo bản sao test case')
            loadTCs()
        } catch (e) {
            toast.error(e.response?.data?.error || 'Lỗi khi clone')
        }
    }

    // Data-Driven Testing functions
    const loadDataSets = async (tcId) => {
        setDsLoading(true)
        try {
            const r = await api.get(`/api/data-sets?test_case_id=${tcId}`)
            setDataSets(r.data)
        } catch (e) {
            toast.error('Lỗi tải data sets')
        } finally { setDsLoading(false) }
    }

    const openDataSets = (tcId) => {
        setDataSetsTC(tcId)
        setShowDataSets(true)
        setExpandedDS(null)
        loadDataSets(tcId)
    }

    const handleCSVParse = (file) => {
        setDsCsvFile(file)
        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target.result
            const lines = text.split('\n').map(l => l.trim()).filter(l => l)
            if (lines.length < 2) { toast.error('File CSV cần ít nhất 1 header và 1 dòng dữ liệu'); return }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
            const rows = lines.slice(1).map(line => {
                const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
                const obj = {}
                headers.forEach((h, i) => { obj[h] = vals[i] || '' })
                return obj
            })
            setDsData(rows)
        }
        reader.readAsText(file)
    }

    const uploadDataSet = async () => {
        if (!dsName.trim()) return toast.error('Vui lòng nhập tên data set')
        try {
            if (dsCsvFile) {
                const fd = new FormData()
                fd.append('file', dsCsvFile)
                fd.append('test_case_id', dataSetsTC)
                fd.append('name', dsName)
                await api.post('/api/data-sets', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
            } else {
                if (dsData.length === 0) return toast.error('Chưa có dữ liệu')
                await api.post('/api/data-sets', { test_case_id: dataSetsTC, name: dsName, data: dsData })
            }
            toast.success('Đã tạo data set')
            setShowDSUpload(false)
            setDsName('')
            setDsData([])
            setDsCsvFile(null)
            loadDataSets(dataSetsTC)
        } catch (e) {
            toast.error(e.response?.data?.error || 'Lỗi tạo data set')
        }
    }

    const deleteDataSet = async (dsId) => {
        if (!confirm('Xóa data set này?')) return
        try {
            await api.delete(`/api/data-sets/${dsId}`)
            toast.success('Đã xóa data set')
            loadDataSets(dataSetsTC)
        } catch (e) {
            toast.error('Lỗi xóa data set')
        }
    }

    const runWithDataSet = async (dsId) => {
        try {
            const r = await api.post(`/api/data-sets/${dsId}/run`, { continueOnFailure: true, retryCount: 0, concurrency: 1 })
            toast.success(`Đã bắt đầu chạy! Run ID: ${r.data.run_id}`)
        } catch (e) {
            toast.error(e.response?.data?.error || 'Lỗi chạy data set')
        }
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
            const r = await api.post('/api/test-cases/import/excel', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.success(`Đã import ${r.data.imported} test case`)
            if (r.data.warnings && r.data.warnings.length > 0) {
                r.data.warnings.forEach(w => {
                    toast(`⚠️ ${w.tc_id}: ${w.warnings.length} bước không nhận diện`, { icon: '⚠️', duration: 5000 })
                })
            }
            loadTCs()
        } catch (e) { toast.error(e.response?.data?.error || 'Lỗi import') } finally { setUploading(false) }
    }

    const handlePostmanImport = async (file) => {
        if (!selectedSuite) return toast.error('Vui lòng chọn Suite trước khi import')
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (ext !== 'json') return toast.error('Chỉ chấp nhận file .json (Postman Collection)')
        const fd = new FormData(); fd.append('file', file); fd.append('suite_id', selectedSuite)
        setUploading(true)
        try {
            const r = await api.post('/api/test-cases/import/postman', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.success(`Đã import ${r.data.imported} API test case từ Postman`)
            if (r.data.warnings && r.data.warnings.length > 0) {
                r.data.warnings.forEach(w => toast(w, { icon: '⚠️', duration: 5000 }))
            }
            loadTCs()
        } catch (e) { toast.error(e.response?.data?.error || 'Lỗi import Postman') } finally { setUploading(false) }
    }

    const needsSelector = ['click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible',
        'double_click', 'right_click', 'scroll_to', 'drag_drop', 'upload_file', 'assert_body', 'assert_header', 'store_variable']
    const needsValue = ['fill', 'select', 'navigate', 'wait', 'keyboard', 'drag_drop', 'upload_file',
        'store_variable', 'assert_status', 'assert_response_time']
    const needsExpected = ['assert_text', 'assert_url', 'assert_body', 'assert_header']
    const isApiAction = (a) => ['api_request', 'assert_status', 'assert_body', 'assert_header', 'assert_response_time', 'store_variable'].includes(a)

    const filteredTCs = testCases.filter(tc => tc.title.toLowerCase().includes(search.toLowerCase()))

    return (
        <div>
            {/* Breadcrumb */}
            <div className="breadcrumb mb-4">
                <button className="breadcrumb-item" onClick={() => navigate('projects')}>📁 Dự án</button>
                <ChevronRight size={14} className="breadcrumb-sep" />
                {project_name ? (
                    <button className="breadcrumb-item" onClick={() => navigate('suites', { project_id, project_name })}>{project_name}</button>
                ) : (
                    <button className="breadcrumb-item" onClick={() => navigate('suites')}>Test Suites</button>
                )}
                <ChevronRight size={14} className="breadcrumb-sep" />
                <span className="breadcrumb-item active">{suite_name || 'Test Cases'}</span>
            </div>

            {/* Filter bar: Project → Suite */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 200 }}>
                        <label className="form-label">Chọn Dự án</label>
                        <select className="form-control" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setSelectedSuite(''); setTestCases([]) }}>
                            <option value="">-- Tất cả Dự án --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div style={{ minWidth: 200, flex: 1 }}>
                        <label className="form-label">Chọn Test Suite</label>
                        <select className="form-control" value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)}>
                            <option value="">-- Chọn Suite --</option>
                            {suites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.tc_count} test case)</option>)}
                        </select>
                    </div>
                    {selectedSuite && (
                        <div className="flex gap-2" style={{ marginTop: 22 }}>
                            <button className="btn btn-primary" onClick={() => { setEditId(null); setForm(emptyTC()); setTabMode('nl'); setShowPreview(false); setWarnings([]); setShowForm(true) }}><Plus size={15} /> Thêm Test Case</button>
                            <a className="btn btn-outline" href={apiUrl(`/api/test-cases/export/excel?suite_id=${selectedSuite}`)} download title="Tải test cases về dạng Excel"><Download size={15} /> Xuất Excel</a>
                            <a className="btn btn-ghost" href={apiUrl('/api/test-cases/template/download')} download title="Tải file mẫu Excel"><Download size={15} /> File mẫu</a>
                            <button className="btn btn-outline" onClick={() => postmanRef.current?.click()} title="Import từ Postman Collection JSON" style={{ borderColor: '#f97316', color: '#f97316' }}>
                                <Send size={15} /> Import Postman
                            </button>
                            <input ref={postmanRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => { handlePostmanImport(e.target.files[0]); e.target.value = '' }} />
                        </div>
                    )}
                </div>
            </div>

            {selectedSuite && (
                <>
                    {/* Search bar */}
                    <div className="flex gap-3 items-center mb-4">
                        <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
                            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="form-control"
                                placeholder="Tìm kiếm test case..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 34 }}
                            />
                        </div>
                    </div>

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
                            <thead><tr><th>Tiêu đề</th><th>URL</th><th>Trình duyệt / Thiết bị</th><th>Số bước</th><th>Data</th><th>Thao tác</th></tr></thead>
                            <tbody>
                                {filteredTCs.length === 0 && <tr><td colSpan={6}><div className="empty-state"><p>{search ? 'Không tìm thấy test case nào.' : 'Chưa có test case. Tạo mới hoặc upload Excel.'}</p></div></td></tr>}
                                {filteredTCs.map(tc => (
                                    <tr key={tc.id}>
                                        <td><strong>{tc.title}</strong><br /><span className="text-muted text-sm">{tc.id}</span></td>
                                        <td className="text-sm text-muted" style={{ maxWidth: 200, wordBreak: 'break-all' }}>{tc.url}</td>
                                        <td>
                                            <span className="badge badge-running">{tc.browser || 'chromium'}</span>
                                            {tc.device && <span className="badge" style={{ marginLeft: 4, background: 'var(--primary-light, #eff6ff)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>📱 {DEVICE_OPTIONS.find(d => d.value === tc.device)?.label.replace(/^📱|^📟/, '').trim() || tc.device.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>}
                                        </td>
                                        <td>{(tc.steps || []).length} bước</td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openDataSets(tc.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Database size={13} /> Data
                                            </button>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tc)}>✏️ Sửa</button>
                                                <button className="btn btn-outline btn-sm" onClick={() => cloneTC(tc.id)} title="Tạo bản sao"><Copy size={13} /> Clone</button>
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
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            ref={nlRef}
                                            className="nl-textarea"
                                            rows={10}
                                            placeholder={NL_PLACEHOLDER}
                                            value={form.nlText}
                                            onChange={e => { setForm(p => ({ ...p, nlText: e.target.value })); fetchSuggestions(e.target.value) }}
                                            onKeyDown={handleNlKeyDown}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                        />
                                        {showSuggestions && nlSuggestions.length > 0 && (
                                            <div className="nl-suggestions">
                                                {nlSuggestions.map((s, i) => (
                                                    <div key={i}
                                                        className={`nl-suggestion-item ${i === selectedSuggIdx ? 'active' : ''}`}
                                                        onMouseDown={() => applySuggestion(s)}
                                                        onMouseEnter={() => setSelectedSuggIdx(i)}
                                                    >
                                                        <Sparkles size={12} /> {s}
                                                    </div>
                                                ))}
                                                <div className="nl-suggestion-hint">Tab hoặc Enter để chọn, Esc để đóng</div>
                                            </div>
                                        )}
                                    </div>
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
                                            <div key={i} style={{ background: isApiAction(step.action) ? '#eff6ff' : '#f8fafc', padding: '12px', borderRadius: 8, border: `1px solid ${isApiAction(step.action) ? '#93c5fd' : 'var(--border)'}` }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '36px 170px 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                    <div className="step-num">{i + 1}</div>
                                                    <select className="form-control" value={step.action} onChange={e => updateStep(i, 'action', e.target.value)}
                                                        style={isApiAction(step.action) ? { borderColor: '#3b82f6', background: '#dbeafe' } : {}}>
                                                        {Object.entries(ACTION_GROUPS).map(([group, actions]) => (
                                                            <optgroup key={group} label={group}>
                                                                {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    <input className="form-control" placeholder="Mô tả bước" value={step.description} onChange={e => updateStep(i, 'description', e.target.value)} />
                                                    <div className="flex gap-2">
                                                        {i > 0 && <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, -1)}><ArrowUp size={12} /></button>}
                                                        {i < form.steps.length - 1 && <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, 1)}><ArrowDown size={12} /></button>}
                                                        <button className="btn btn-danger btn-sm" onClick={() => removeStep(i)}><Trash2 size={12} /></button>
                                                    </div>
                                                </div>

                                                {/* API Request Builder */}
                                                {step.action === 'api_request' && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 8 }}>
                                                        <select className="form-control" value={step.selector || 'GET'} onChange={e => updateStep(i, 'selector', e.target.value)}
                                                            style={{ fontWeight: 600, color: step.selector === 'POST' ? '#16a34a' : step.selector === 'DELETE' ? '#dc2626' : step.selector === 'PUT' ? '#d97706' : '#2563eb' }}>
                                                            {API_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                        <input className="form-control" placeholder="URL (VD: https://api.example.com/users)" value={step.value || ''} onChange={e => updateStep(i, 'value', e.target.value)} />
                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                            <input className="form-control" placeholder='Headers JSON (VD: {"Authorization": "Bearer {{token}}"})'
                                                                value={step.headers || ''} onChange={e => updateStep(i, 'headers', e.target.value)} style={{ fontSize: 12 }} />
                                                        </div>
                                                        {['POST', 'PUT', 'PATCH'].includes(step.selector) && (
                                                            <div style={{ gridColumn: '1 / -1' }}>
                                                                <textarea className="form-control" rows={2} placeholder='Request Body JSON (VD: {"email": "{{email}}", "password": "{{password}}"})'
                                                                    value={step.expected || ''} onChange={e => updateStep(i, 'expected', e.target.value)} style={{ fontSize: 12, fontFamily: 'monospace' }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Standard fields for non-api_request actions */}
                                                {step.action !== 'api_request' && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: [needsSelector.includes(step.action), needsValue.includes(step.action), needsExpected.includes(step.action)].filter(Boolean).length > 0 ? [needsSelector.includes(step.action) && '1fr', needsValue.includes(step.action) && '1fr', needsExpected.includes(step.action) && '1fr'].filter(Boolean).join(' ') : '1fr', gap: 8 }}>
                                                        {needsSelector.includes(step.action) && <input className="form-control"
                                                            placeholder={step.action === 'assert_body' ? 'JSONPath (VD: $.data.id)' : step.action === 'assert_header' ? 'Tên header (VD: content-type)' : step.action === 'store_variable' ? 'Nguồn (VD: $.data.token, response.status)' : 'Selector (CSS/XPath)'}
                                                            value={step.selector} onChange={e => updateStep(i, 'selector', e.target.value)} />}
                                                        {needsValue.includes(step.action) && <input className="form-control"
                                                            placeholder={
                                                                step.action === 'navigate' ? 'URL' : step.action === 'wait' ? 'Milliseconds' :
                                                                step.action === 'keyboard' ? 'Phím (VD: Enter, Control+a, Tab)' :
                                                                step.action === 'drag_drop' ? 'Selector đích (target)' :
                                                                step.action === 'upload_file' ? 'Đường dẫn file' :
                                                                step.action === 'store_variable' ? 'Tên biến (VD: token, userId)' :
                                                                step.action === 'assert_status' ? 'Status code (VD: 200, 201, 404)' :
                                                                step.action === 'assert_response_time' ? 'Max ms (VD: 5000)' :
                                                                'Giá trị'
                                                            }
                                                            value={step.value} onChange={e => updateStep(i, 'value', e.target.value)} />}
                                                        {needsExpected.includes(step.action) && <input className="form-control"
                                                            placeholder={
                                                                step.action === 'assert_url' ? 'URL kỳ vọng' :
                                                                step.action === 'assert_body' ? 'Giá trị kỳ vọng (VD: not_empty, > 0, "abc")' :
                                                                step.action === 'assert_header' ? 'Giá trị kỳ vọng (VD: application/json)' :
                                                                'Text kỳ vọng'
                                                            }
                                                            value={step.expected} onChange={e => updateStep(i, 'expected', e.target.value)} />}
                                                    </div>
                                                )}

                                                {/* store_variable: special layout with source selector */}
                                                {step.action === 'store_variable' && (
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                                        Selector = nguồn (JSONPath: $.data.token | response.status | response.body), Value = tên biến. Dùng {'{{tên_biến}}'} ở các bước sau.
                                                    </div>
                                                )}
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

            {/* Data Sets Panel Modal */}
            {showDataSets && dataSetsTC && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDataSets(false)}>
                    <div className="modal" style={{ maxWidth: 800 }}>
                        <div className="modal-header">
                            <h3>📊 Data-Driven Testing — {testCases.find(tc => tc.id === dataSetsTC)?.title || dataSetsTC}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowDataSets(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1d4ed8', marginBottom: 16 }}>
                                💡 Sử dụng <code style={{ background: '#dbeafe', padding: '2px 6px', borderRadius: 4 }}>{'{{tên_cột}}'}</code> trong các bước test case để thay thế bằng giá trị từ data set.
                                Ví dụ: <code style={{ background: '#dbeafe', padding: '2px 6px', borderRadius: 4 }}>{'{{email}}'}</code>, <code style={{ background: '#dbeafe', padding: '2px 6px', borderRadius: 4 }}>{'{{password}}'}</code>
                            </div>

                            <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>Danh sách Data Sets ({dataSets.length})</span>
                                <button className="btn btn-primary btn-sm" onClick={() => { setShowDSUpload(true); setDsName(''); setDsData([]); setDsCsvFile(null) }}>
                                    <Plus size={13} /> Thêm Data Set
                                </button>
                            </div>

                            {dsLoading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Đang tải...</div>}

                            {!dsLoading && dataSets.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                                    Chưa có data set nào. Tạo mới bằng cách upload file CSV hoặc nhập dữ liệu.
                                </div>
                            )}

                            {dataSets.map(ds => (
                                <div key={ds.id} style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', cursor: 'pointer' }}
                                        onClick={() => setExpandedDS(expandedDS === ds.id ? null : ds.id)}>
                                        {expandedDS === ds.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ fontSize: 13 }}>{ds.name}</strong>
                                            <span className="text-muted text-sm" style={{ marginLeft: 8 }}>{ds.data?.length || 0} dòng</span>
                                        </div>
                                        <span className="text-muted text-sm">{new Date(ds.created_at).toLocaleDateString('vi-VN')}</span>
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            <button className="btn btn-sm" onClick={() => runWithDataSet(ds.id)}
                                                style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                ▶ Chạy
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => deleteDataSet(ds.id)} style={{ fontSize: 11 }}>
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </div>
                                    {expandedDS === ds.id && ds.data && ds.data.length > 0 && (
                                        <div style={{ padding: '8px 14px', maxHeight: 200, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>#</th>
                                                        {Object.keys(ds.data[0]).map(k => (
                                                            <th key={k} style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>{k}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ds.data.slice(0, 10).map((row, ri) => (
                                                        <tr key={ri}>
                                                            <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{ri + 1}</td>
                                                            {Object.values(row).map((v, vi) => (
                                                                <td key={vi} style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>{v}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                    {ds.data.length > 10 && (
                                                        <tr><td colSpan={Object.keys(ds.data[0]).length + 1} style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'center', fontSize: 11 }}>...và {ds.data.length - 10} dòng nữa</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Upload Modal */}
            {showDSUpload && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDSUpload(false)}>
                    <div className="modal" style={{ maxWidth: 650 }}>
                        <div className="modal-header">
                            <h3>Thêm Data Set mới</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowDSUpload(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Tên Data Set *</label>
                                <input className="form-control" placeholder="VD: Login data, Signup scenarios..." value={dsName} onChange={e => setDsName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Upload file CSV</label>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button className="btn btn-outline btn-sm" onClick={() => csvRef.current?.click()}>
                                        <Upload size={13} /> Chọn file CSV
                                    </button>
                                    <span className="text-muted text-sm">{dsCsvFile ? dsCsvFile.name : 'Chưa chọn file'}</span>
                                    <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }}
                                        onChange={e => { if (e.target.files[0]) handleCSVParse(e.target.files[0]) }} />
                                </div>
                            </div>

                            {/* CSV Preview */}
                            {dsData.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <label className="form-label">Xem trước ({dsData.length} dòng)</label>
                                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11 }}>#</th>
                                                    {Object.keys(dsData[0]).map(k => (
                                                        <th key={k} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11 }}>{k}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dsData.slice(0, 5).map((row, ri) => (
                                                    <tr key={ri}>
                                                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{ri + 1}</td>
                                                        {Object.values(row).map((v, vi) => (
                                                            <td key={vi} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{v}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                                {dsData.length > 5 && (
                                                    <tr><td colSpan={Object.keys(dsData[0]).length + 1} style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'center', fontSize: 11 }}>...và {dsData.length - 5} dòng nữa</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowDSUpload(false)}>Hủy</button>
                            <button className="btn btn-primary" onClick={uploadDataSet} disabled={!dsName.trim() || dsData.length === 0}>
                                <Save size={15} /> Lưu Data Set
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
