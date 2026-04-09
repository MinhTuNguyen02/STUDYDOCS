import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin.api'
import { FileText, Plus, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import RichTextEditor from '@/components/ui/RichTextEditor'

interface Policy {
  policy_id: number
  title: string
  slug: string
  content: string
  is_active: boolean
  updated_at: string
}

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    is_active: true
  })

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    fetchPolicies()
  }, [])

  const fetchPolicies = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getPolicies()
      setPolicies(res.data)
    } catch (error) {
      toast.error('Lỗi khi tải danh sách chính sách')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (policy?: Policy) => {
    if (policy) {
      setEditingPolicy(policy)
      setFormData({
        title: policy.title,
        slug: policy.slug,
        content: policy.content,
        is_active: policy.is_active
      })
    } else {
      setEditingPolicy(null)
      setFormData({
        title: '',
        slug: '',
        content: '',
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.slug || !formData.content) {
      toast.error('Vui lòng điền đủ Tiêu đề, Slug và Nội dung')
      return;
    }

    try {
      if (editingPolicy) {
        await adminApi.updatePolicy(editingPolicy.policy_id, {
          title: formData.title,
          slug: formData.slug,
          content: formData.content,
          isActive: formData.is_active
        })
        toast.success('Cập nhật chính sách thành công')
      } else {
        await adminApi.createPolicy({
          title: formData.title,
          slug: formData.slug,
          content: formData.content,
          isActive: formData.is_active
        })
        toast.success('Thêm chính sách mới thành công')
      }
      setIsModalOpen(false)
      fetchPolicies()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deletePolicy(id)
      toast.success('Đã xoá chính sách')
      setDeleteConfirm(null)
      fetchPolicies()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Lỗi khi xóa')
      setDeleteConfirm(null)
    }
  }

  // Auto-generate slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setFormData(prev => ({
      ...prev,
      title: newTitle,
      slug: !editingPolicy ? newTitle.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        : prev.slug
    }))
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Quản lý Chính sách & Điều khoản
          </h1>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="btn bg-primary text-white hover:bg-primary-hover px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-semibold shadow-sm shrink-0"
        >
          <Plus className="w-5 h-5" /> Thêm Bài Mới
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Đang tải biểu mẫu...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl w-[40%]">Tiêu đề / Slug</th>
                  <th className="px-6 py-4 w-[20%]">Trạng thái</th>
                  <th className="px-6 py-4 text-right w-[20%]">Cập nhật</th>
                  <th className="px-6 py-4 text-right rounded-tr-2xl w-[20%]">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">Chưa có bài viết chính sách nào.</td>
                  </tr>
                ) : (
                  policies.map((pol) => (
                    <tr key={pol.policy_id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-base text-primary mb-1">{pol.title}</div>
                        <div className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded inline-block">/{pol.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        {pol.is_active ? (
                          <div className="flex items-center gap-1.5 text-success font-bold text-xs bg-success/10 py-1.5 px-3 rounded-full border border-success/20 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5" /> ONLINE
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-xs bg-muted py-1.5 px-3 rounded-full border border-border w-fit">
                            <XCircle className="w-3.5 h-3.5" /> DRAFT
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground text-xs font-mono">
                        {new Date(pol.updated_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        {deleteConfirm === pol.policy_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleDelete(pol.policy_id)} className="px-3 py-1 bg-danger text-white rounded-md text-xs font-bold hover:bg-red-600 transition">Xoá luôn</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-muted text-foreground rounded-md text-xs font-bold hover:bg-gray-200 transition">Hủy</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(pol)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors tooltip-trigger" title="Chỉnh sửa nội dung"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(pol.policy_id)}
                              className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors tooltip-trigger" title="Xoá bài viết"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
              <h3 className="text-xl font-bold font-heading flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {editingPolicy ? 'Chỉnh sửa Nội dung' : 'Biên soạn Chính sách Mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                Đóng
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-foreground">Tiêu đề bài viết <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={handleTitleChange}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold"
                    placeholder="VD: Điều khoản Dịch vụ"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-foreground">Đường dẫn (Slug) <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono text-primary"
                    required
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-[300px]">
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Nội dung bài viết <span className="text-danger">*</span></label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(val) => setFormData({ ...formData, content: val })}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActivePol"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                />
                <label htmlFor="isActivePol" className="text-sm font-semibold text-foreground cursor-pointer">Xuất bản bài viết này (Online)</label>
              </div>

              <div className="pt-4 flex gap-3 border-t border-border mt-2 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold transition-colors">
                  Hủy không lưu
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors shadow-sm shadow-primary/30">
                  {editingPolicy ? 'Lưu cập nhật' : 'Xuất bản bài viết'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
