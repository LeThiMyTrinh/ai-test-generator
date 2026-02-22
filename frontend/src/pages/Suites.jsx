import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Trash2, Play, Edit2, FileSpreadsheet } from 'lucide-react'

export default function Suites({ navigate }) {
    const [suites, setSuites] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', description: '' })
    const [editId, setEditId] = useState(null)

    const load = () => axios.get('/api/test-suites').then(r => setSuites(r.data))
    useEffect(() => { load() }, [])

    const save = async () => {
        if (!form.name.trim()) return toast.error('Vui lòng nhập tên Suite')
        if (editId) {
            await axios.put(`/api/test-suites/${editId}`, form)
            toast.success('Đã cập nhật suite')
        } else {
            await axios.post('/api/test-suites', form)
            toast.success('Đã tạo suite mới')
        }
        setShowModal(false); setForm({ name: '', description: '' }); setEditId(null); load()
    }

    const del = async (id, name) => {
        if (!confirm(`Xóa suite "${name}"? Tất cả test case trong suite sẽ bị xóa.`)) return
        await axios.delete(`/api/test-suites/${id}`)
        toast.success('Đã xóa'); load()
    }

    const openEdit = (s) => { setEditId(s.id); setForm({ name: s.name, description: s.description }); setShowModal(true) }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div />
                <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ name: '', description: '' }); setShowModal(true) }}>
                    <Plus size={16} /> Tạo Test Suite mới
                </button>
            </div>

            <div className="card table-wrap">
                <table>
                    <thead><tr><th>Tên Suite</th><th>Số TC</th><th>Mô tả</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
                    <tbody>
                        {suites.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>Chưa có suite nào. Hãy tạo mới!</p></div></td></tr>}
                        {suites.map(s => (
                            <tr key={s.id}>
                                <td><strong>{s.name}</strong><br /><span className="text-muted text-sm">{s.id}</span></td>
                                <td>{s.tc_count || 0} test case</td>
                                <td className="text-muted">{s.description || '—'}</td>
                                <td className="text-muted text-sm">{new Date(s.created_at).toLocaleDateString('vi-VN')}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-outline btn-sm" onClick={() => navigate('editor', { suite_id: s.id, suite_name: s.name })}><FileSpreadsheet size={13} /> Test Cases</button>
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
