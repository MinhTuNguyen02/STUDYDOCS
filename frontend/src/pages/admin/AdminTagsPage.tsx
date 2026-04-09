import { useEffect, useState } from 'react'
import { documentsApi } from '@/api/documents.api'
import { adminApi } from '@/api/admin.api'
import { Plus, Edit2, Trash2, Tag, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface TagItem {
  tag_id: number
  tag_name: string
  slug: string
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagItem | null>(null)
  const [formData, setFormData] = useState({ tag_name: '', slug: '' })

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async (q?: string) => {
    setLoading(true)
    try {
      const res = await documentsApi.getTags(q)
      setTags(res.data || res)
    } catch (error) {
      toast.error('Lỗi khi tải tags')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchTags(search)
  }

  const handleOpenModal = (tag?: TagItem) => {
    if (tag) {
      setEditingTag(tag)
      setFormData({
        tag_name: tag.tag_name,
        slug: tag.slug
      })
    } else {
      setEditingTag(null)
      setFormData({ tag_name: '', slug: '' })
    }
    setIsModalOpen(true)
  }

  const generateSlug = (text: string) => {
    return text.toString().toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
      .replace(/[èéẹẻẽêềếệểễ]/g, "e")
      .replace(/[ìíịỉĩ]/g, "i")
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
      .replace(/[ùúụủũưừứựửữ]/g, "u")
      .replace(/[ỳýỵỷỹ]/g, "y")
      .replace(/đ/g, "d")
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tag_name = e.target.value;
    setFormData({
      ...formData,
      tag_name,
      slug: editingTag ? formData.slug : generateSlug(tag_name) // Auto-gen slug for new only
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.tag_name || !formData.slug) {
      toast.error('Vui lòng nhập tên tag và slug')
      return
    }

    try {
      const data = { tag_name: formData.tag_name, slug: formData.slug }

      if (editingTag) {
        await adminApi.updateTag(editingTag.tag_id, data)
        toast.success('Cập nhật tag thành công')
      } else {
        await adminApi.createTag(data)
        toast.success('Tạo tag mới thành công')
      }
      setIsModalOpen(false)
      fetchTags(search)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteTag(id)
      toast.success('Đã xóa tag')
      setDeleteConfirm(null)
      fetchTags(search) // Refresh
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể xóa tag này (đang được sử dụng)')
      setDeleteConfirm(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Quản lý Tags</h1>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearch} className="flex-1 md:w-64">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm tag..."
              className="w-full px-4 py-2 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            />
          </form>
          <button
            onClick={() => handleOpenModal()}
            className="btn bg-primary text-white hover:bg-primary-hover px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-semibold shadow-sm shrink-0"
          >
            <Plus className="w-5 h-5" /> Thêm Tag
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Đang tải danh sách...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl">ID</th>
                  <th className="px-6 py-4">Tên Tag</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4 text-right rounded-tr-2xl">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tags.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">Không tìm thấy tag nào phù hợp.</td>
                  </tr>
                ) : (
                  tags.map((tag) => (
                    <tr key={tag.tag_id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium">#{tag.tag_id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-semibold">
                          <Tag className="w-4 h-4 text-primary" />
                          {tag.tag_name}
                        </div>
                      </td>
                      <td className="py-4 text-muted-foreground bg-muted/30 font-mono text-xs w-fit rounded-md ml-3 my-2 px-3 inline-block">
                        {tag.slug}
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        {deleteConfirm === tag.tag_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-danger font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Xóa?
                            </span>
                            <button onClick={() => handleDelete(tag.tag_id)} className="px-3 py-1 bg-danger text-white rounded-md text-xs font-bold hover:bg-red-600 transition">Có</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-muted text-foreground rounded-md text-xs font-bold hover:bg-gray-200 transition">Không</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(tag)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors tooltip-trigger" title="Sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(tag.tag_id)}
                              className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors tooltip-trigger" title="Xóa"
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
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold font-heading flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                {editingTag ? 'Chỉnh sửa Tag' : 'Thêm Tag Mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                Đóng
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Tên Tag <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.tag_name}
                  onChange={handleNameChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Ví dụ: Lập trình, JavaScript..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Slug (đường dẫn) <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm"
                  placeholder="lap-trinh"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold transition-colors">
                  Hủy
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors shadow-sm shadow-primary/30">
                  {editingTag ? 'Lưu thay đổi' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
