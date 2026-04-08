import { useEffect, useState } from 'react'
import { documentsApi } from '@/api/documents.api'
import { adminApi } from '@/api/admin.api'
import { Plus, Edit2, Trash2, FolderTree, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Category {
  category_id: number
  name: string
  slug: string
  parent_id: number | null
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '', parent_id: '' })
  
  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await documentsApi.getCategories()
      setCategories(res.data || res)
    } catch (error) {
      toast.error('Lỗi khi tải danh mục')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id ? String(category.parent_id) : ''
      })
    } else {
      setEditingCategory(null)
      setFormData({ name: '', slug: '', parent_id: '' })
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
    const name = e.target.value;
    setFormData({
      ...formData,
      name,
      slug: editingCategory ? formData.slug : generateSlug(name) // Auto-gen slug for new only
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.slug) {
      toast.error('Vui lòng nhập tên và slug')
      return
    }

    try {
      const parentId = formData.parent_id ? Number(formData.parent_id) : undefined;
      const data = { name: formData.name, slug: formData.slug, parent_id: parentId }

      if (editingCategory) {
        await adminApi.updateCategory(editingCategory.category_id, data)
        toast.success('Cập nhật danh mục thành công')
      } else {
        await adminApi.createCategory(data)
        toast.success('Tạo danh mục mới thành công')
      }
      setIsModalOpen(false)
      fetchCategories()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteCategory(id)
      toast.success('Đã xóa danh mục')
      setDeleteConfirm(null)
      fetchCategories()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể xóa danh mục đang có tài liệu')
      setDeleteConfirm(null)
    }
  }

  const getParentName = (parentId: number | null) => {
    if (!parentId) return '—'
    const parent = categories.find(c => c.category_id === parentId)
    return parent ? parent.name : 'Unknown'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Quản lý Danh mục</h1>
          <p className="text-muted-foreground text-sm mt-1">Phân loại tài liệu học tập vào các nhóm phù hợp.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="btn bg-primary text-white hover:bg-primary-hover px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-semibold shadow-sm"
        >
          <Plus className="w-5 h-5" /> Thêm danh mục
        </button>
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
                  <th className="px-6 py-4">Tên danh mục</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Danh mục cha</th>
                  <th className="px-6 py-4 text-right rounded-tr-2xl">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">Chưa có danh mục nào.</td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.category_id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium">#{cat.category_id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-semibold">
                          <FolderTree className="w-4 h-4 text-muted-foreground" />
                          {cat.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground bg-muted/30 font-mono text-xs w-fit">
                        {cat.slug}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {getParentName(cat.parent_id)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {deleteConfirm === cat.category_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-danger font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Xác nhận xóa?
                            </span>
                            <button onClick={() => handleDelete(cat.category_id)} className="px-3 py-1 bg-danger text-white rounded-md text-xs font-bold hover:bg-red-600 transition">Xóa</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-muted text-foreground rounded-md text-xs font-bold hover:bg-gray-200 transition">Hủy</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenModal(cat)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors tooltip-trigger" title="Sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm(cat.category_id)}
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
              <h3 className="text-xl font-bold font-heading">
                {editingCategory ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục Mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                Đóng
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Tên danh mục <span className="text-danger">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={handleNameChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Ví dụ: Công nghệ thông tin"
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
                  placeholder="ví-dụ-cong-nghe-thong-tin"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1.5">Tự động tạo từ tên, viết thường không dấu và phân cách bằng gạch nối.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Danh mục cha (Tùy chọn)</label>
                <select 
                  value={formData.parent_id}
                  onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  <option value="">-- Không có danh mục cha --</option>
                  {categories.map(c => (
                    // Tránh chọn chính nó làm cha
                    c.category_id !== editingCategory?.category_id && (
                      <option key={c.category_id} value={c.category_id}>{c.name}</option>
                    )
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold transition-colors">
                  Hủy
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors shadow-sm shadow-primary/30">
                  {editingCategory ? 'Lưu thay đổi' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
