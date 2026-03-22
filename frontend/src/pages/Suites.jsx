import { useEffect, useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Plus, Trash2, Play, Edit2, FileSpreadsheet, Search, ChevronRight } from 'lucide-react'

export default function Suites({ navigate, ctx = {} }) {
    const { project_id: ctxProjectId, project_name: ctxProjectName } = ctx
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState(ctxProjectId || '')
    const [suites, setSuites] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', description: '', project_id: ctxProjectId || '' })
    const [editId, setEditId] = useState(null)
    const [search, setSearch] = useState('')

    // Load projects
    useEffect(() => { api.get('/api/projects').then(r => setProjects(r.data)) }, [])

    // Load suites filtered by project
    const load = () => {
        const url = selectedProject ? `/api/test-suites?project_id=${selectedProject}` : '/api/test-suites';
        api.get(url).then(r => setSuites(r.data))
    }
    useEffect(() => { load() }, [selectedProject])

    const save = async () => {
        if (!form.name.trim()) return toast.error('Vui lòng nhập tên Suite')
        if (!form.project_id) return toast.error('Vui lòng chọn Dự án')
        if (editId) {
            await api.put(`/api/test-suites/${editId}`, { name: form.name, description: form.description })
            toast.success('Đã cập nhật suite')
        } else {
            await api.post('/api/test-suites', { name: form.name, description: form.description, project_id: form.project_id })
            toast.success('Đã tạo suite mới')
        }
        setShowModal(false); setForm({ name: '', description: '', project_id: selectedProject || '' }); setEditId(null); load()
    }

    const del = async (id, name) => {
        if (!confirm(`Xóa suite "${name}"? Tất cả test case trong suite sẽ bị xóa.`)) return
        await api.delete(`/api/test-suites/${id}`)
        toast.success('Đã xóa'); load()
    }

    const openEdit = (s) => { setEditId(s.id); setForm({ name: s.name, description: s.description, project_id: s.project_id }); setShowModal(true) }

    const filtered = suites.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

    // Find project name for breadcrumb
    const currentProjectName = ctxProjectName || projects.find(p => p.id === selectedProject)?.name

    return (
        <div>
            {/* Breadcrumb */}
            <div className="breadcrumb mb-4">
                <button className="breadcrumb-item" onClick={() => navigate('projects')}>📁 Dự án</button>
                <ChevronRight size={14} className="breadcrumb-sep" />
                {currentProjectName ? (
                    <span className="breadcrumb-item active">📂 {currentProjectName}</span>
                ) : (
                    <span className="breadcrumb-item active">Tất cả Test Suites</span>
                )}
            </div>

            {/* Filter bar */}
            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 220 }}>
                        <label className="form-label">Lọc theo Dự án</label>
                        <select className="form-control" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                            <option value="">-- Tất cả Dự án --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div style={{ position: 'relative', maxWidth: 280, flex: 1, marginTop: 22 }}>
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="form-control"
                            placeholder="Tìm kiếm suite..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 34 }}
                        />
                    </div>
                    <div style={{ marginTop: 22 }}>
                        <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ name: '', description: '', project_id: selectedProject || '' }); setShowModal(true) }}>
                            <Plus size={16} /> Tạo Test Suite mới
                        </button>
                    </div>
                </div>
            </div>

            <div className="card table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Tên Suite</th>
                            {!selectedProject && <th>Dự án</th>}
                            <th>Số Test Case</th>
                            <th>Mô tả</th>
                            <th>Ngày tạo</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && <tr><td colSpan={selectedProject ? 5 : 6}><div className="empty-state"><p>{search ? 'Không tìm thấy suite nào.' : 'Chưa có suite nào. Hãy tạo mới!'}</p></div></td></tr>}
                        {filtered.map(s => (
                            <tr key={s.id}>
                                <td><strong>{s.name}</strong><br /><span className="text-muted text-sm">{s.id}</span></td>
                                {!selectedProject && <td className="text-sm">{s.project_name || '—'}</td>}
                                <td>{s.tc_count || 0} test case</td>
                                <td className="text-muted">{s.description || '—'}</td>
                                <td className="text-muted text-sm">{new Date(s.created_at).toLocaleDateString('vi-VN')}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-outline btn-sm" onClick={() => navigate('editor', { suite_id: s.id, suite_name: s.name, project_id: selectedProject || s.project_id, project_name: currentProjectName || s.project_name })}><FileSpreadsheet size={13} /> Test Cases</button>
                                        <button className="btn btn-success btn-sm" onClick={() => navigate('monitor', { suite_id: s.id, suite_name: s.name })}><Play size={13} /> Run</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}><Edit2 size={13} /></button>
                                        <button className="btn btn-danger btn-sm" onClick={() => del(s.id, s.name)}><Trash2 size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editId ? 'Chỉnh sửa Suite' : 'Tạo Test Suite mới'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Dự án *</label>
                                <select
                                    className="form-control"
                                    value={form.project_id}
                                    onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}
                                    disabled={!!editId}
                                >
                                    <option value="">-- Chọn Dự án --</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                {editId && <div className="form-hint">Không thể thay đổi dự án sau khi tạo</div>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tên Suite *</label>
                                <input className="form-control" placeholder="VD: Kiểm thử chức năng Login" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mô tả</label>
                                <textarea className="form-control" rows={3} placeholder="Mô tả bộ test này kiểm tra gì..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Hủy</button>
                            <button className="btn btn-primary" onClick={save}>{editId ? 'Cập nhật' : 'Tạo Suite'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
