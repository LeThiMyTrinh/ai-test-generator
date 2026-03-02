import { useEffect, useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, FolderOpen, Search } from 'lucide-react'

export default function Projects({ navigate }) {
    const [projects, setProjects] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', description: '' })
    const [editId, setEditId] = useState(null)
    const [search, setSearch] = useState('')

    const load = () => api.get('/api/projects').then(r => setProjects(r.data))
    useEffect(() => { load() }, [])

    const save = async () => {
        if (!form.name.trim()) return toast.error('Vui lòng nhập tên Dự án')
        if (editId) {
            await api.put(`/api/projects/${editId}`, form)
            toast.success('Đã cập nhật dự án')
        } else {
            await api.post('/api/projects', form)
            toast.success('Đã tạo dự án mới')
        }
        setShowModal(false); setForm({ name: '', description: '' }); setEditId(null); load()
    }

    const del = async (id, name) => {
        if (!confirm(`Xóa dự án "${name}"? TẤT CẢ bộ test và kịch bản test bên trong trang này sẽ bị XÓA VĨNH VIỄN.`)) return
        await api.delete(`/api/projects/${id}`)
        toast.success('Đã xóa dự án'); load()
    }

    const openEdit = (p) => { setEditId(p.id); setForm({ name: p.name, description: p.description }); setShowModal(true) }

    const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-3 items-center" style={{ flex: 1 }}>
                    <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="form-control"
                            placeholder="Tìm kiếm dự án..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 34 }}
                        />
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ name: '', description: '' }); setShowModal(true) }}>
                    <Plus size={16} /> Tạo Dự án mới
                </button>
            </div>

            <div className="card table-wrap">
                <table>
                    <thead><tr><th>Tên Dự án</th><th>Số Suite</th><th>Tổng TC</th><th>Mô tả</th><th>Lần chạy cuối</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
                    <tbody>
                        {filtered.length === 0 && <tr><td colSpan={7}><div className="empty-state"><p>{search ? 'Không tìm thấy dự án nào.' : 'Chưa có dự án nào. Hãy tạo mới!'}</p></div></td></tr>}
                        {filtered.map(p => (
                            <tr key={p.id}>
                                <td><strong>{p.name}</strong><br /><span className="text-muted text-sm">{p.id}</span></td>
                                <td><span className="badge badge-running">{p.suite_count || 0} suites</span></td>
                                <td>{p.tc_count || 0} TC</td>
                                <td className="text-muted">{p.description || '—'}</td>
                                <td className="text-sm">
                                    {p.last_run ? (
                                        <div>
                                            <span className={`badge ${p.last_run.status === 'DONE' ? 'badge-pass' : p.last_run.status === 'RUNNING' ? 'badge-running' : 'badge-error'}`}>{p.last_run.status}</span>
                                            <br /><span className="text-muted">{new Date(p.last_run.started_at).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                    ) : <span className="text-muted">—</span>}
                                </td>
                                <td className="text-muted text-sm">{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-outline btn-sm" onClick={() => navigate('suites', { project_id: p.id, project_name: p.name })}>
                                            <FolderOpen size={13} /> Test Suites
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Edit2 size={13} /></button>
                                        <button className="btn btn-danger btn-sm" onClick={() => del(p.id, p.name)}><Trash2 size={13} /></button>
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
                            <h3>{editId ? 'Chỉnh sửa Dự án' : 'Tạo Dự án mới'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Tên Dự án *</label>
                                <input className="form-control" placeholder="VD: Dự án E-commerce" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mô tả</label>
                                <textarea className="form-control" rows={3} placeholder="Mô tả dự án này..." value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Hủy</button>
                            <button className="btn btn-primary" onClick={save}>{editId ? 'Cập nhật' : 'Tạo Dự án'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
