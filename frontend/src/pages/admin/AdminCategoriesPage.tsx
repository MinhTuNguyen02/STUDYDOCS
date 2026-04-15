import { useEffect, useState, useMemo } from 'react'
import { documentsApi } from '@/api/documents.api'
import { adminApi } from '@/api/admin.api'
import { Plus, Edit2, Trash2, ChevronRight, Folder, FolderOpen, AlertCircle, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface Category {
  category_id: number
  name: string
  slug: string
  parent_id: number | null
}

interface CategoryNode extends Category {
  children: CategoryNode[]
}

// Build tree from flat list
function buildTree(flat: Category[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>()
  flat.forEach(c => map.set(c.category_id, { ...c, children: [] }))

  const roots: CategoryNode[] = []
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

interface CategoryRowProps {
  node: CategoryNode
  depth: number
  isLast: boolean
  parentLines: boolean[]
  onEdit: (cat: Category) => void
  onDelete: (id: number) => void
  deleteConfirm: number | null
  setDeleteConfirm: (id: number | null) => void
  handleDelete: (id: number) => void
}

function CategoryRow({
  node, depth, isLast, parentLines,
  onEdit, onDelete, deleteConfirm, setDeleteConfirm, handleDelete
}: CategoryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children.length > 0

  return (
    <>
      <tr className="hover:bg-muted/40 transition-colors group"
        onClick={() => setExpanded(v => !v)}>
        {/* Tree cell */}
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${depth * 22}px` }}>
            {/* Connector lines */}
            {depth > 0 && (
              <div className="flex items-center shrink-0 mr-1" style={{ width: '22px' }}>
                <svg width="22" height="22" className="text-border" viewBox="0 0 22 22">
                  <line x1="0" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="1.5" />
                  {!isLast && <line x1="0" y1="0" x2="0" y2="22" stroke="currentColor" strokeWidth="1.5" />}
                </svg>
              </div>
            )}

            {/* Expand/collapse toggle */}
            {hasChildren ? (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mr-1.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
              </button>
            ) : (
              depth > 0 && <span className="mr-1.5 w-3.5 shrink-0" />
            )}

            {/* Folder icon + name */}
            <div className="flex items-center gap-2">
              {depth === 0
                ? <FolderOpen className={`w-4 h-4 shrink-0 ${hasChildren ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                : <Folder className="w-3.5 h-3.5 shrink-0 text-primary/60" />
              }
              <span className={`font-semibold text-sm ${depth === 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                {node.name}
              </span>
              {hasChildren && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                  {node.children.length}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Slug */}
        <td className="px-4 py-3">
          <code className="text-xs font-mono bg-muted/50 text-muted-foreground px-2 py-1 rounded-md">
            {node.slug}
          </code>
        </td>

        {/* Level badge */}
        <td className="px-4 py-3">
          {depth === 0 ? (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full border border-yellow-200">
              Danh mục gốc
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100">
              Cấp {depth}
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          {deleteConfirm === node.category_id ? (
            <div className="flex items-center justify-end gap-2 animate-in fade-in duration-150">
              <span className="text-xs text-danger font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Xác nhận xóa?
              </span>
              <button onClick={() => handleDelete(node.category_id)} className="px-3 py-1 bg-danger text-white rounded-md text-xs font-bold hover:bg-red-600 transition">Xóa</button>
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-muted text-foreground rounded-md text-xs font-bold hover:bg-gray-200 transition">Hủy</button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => onEdit(node)}
                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                title="Sửa"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeleteConfirm(node.category_id)}
                className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                title="Xóa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Render children recursively */}
      {hasChildren && expanded && node.children.map((child, idx) => (
        <CategoryRow
          key={child.category_id}
          node={child}
          depth={depth + 1}
          isLast={idx === node.children.length - 1}
          parentLines={[...parentLines, !isLast]}
          onEdit={onEdit}
          onDelete={onDelete}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          handleDelete={handleDelete}
        />
      ))}
    </>
  )
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

  // Search
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { fetchCategories() }, [])

  const tree = useMemo(() => {
    let list = categories;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      const matchedIds = new Set<number>();
      categories.forEach(c => {
        if (c.name.toLowerCase().includes(lower) || c.slug.toLowerCase().includes(lower)) {
          let current: Category | undefined = c;
          while (current) {
            matchedIds.add(current.category_id);
            current = categories.find(p => p.category_id === current?.parent_id);
          }
        }
      })
      list = categories.filter(c => matchedIds.has(c.category_id));
    }
    return buildTree(list)
  }, [categories, searchTerm])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await documentsApi.getCategories()
      setCategories(res.data || res)
    } catch {
      toast.error('Lỗi khi tải danh mục')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({ name: category.name, slug: category.slug, parent_id: category.parent_id ? String(category.parent_id) : '' })
    } else {
      setEditingCategory(null)
      setFormData({ name: '', slug: '', parent_id: '' })
    }
    setIsModalOpen(true)
  }

  const generateSlug = (text: string) =>
    text.toString().toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a').replace(/[èéẹẻẽêềếệểễ]/g, 'e')
      .replace(/[ìíịỉĩ]/g, 'i').replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
      .replace(/[ùúụủũưừứựửữ]/g, 'u').replace(/[ỳýỵỷỹ]/g, 'y').replace(/đ/g, 'd')
      .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-')
      .replace(/^-+/, '').replace(/-+$/, '')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setFormData(prev => ({ ...prev, name, slug: editingCategory ? prev.slug : generateSlug(name) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.slug) { toast.error('Vui lòng nhập tên và slug'); return }
    try {
      const parentId = formData.parent_id ? Number(formData.parent_id) : undefined
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

  // Only allow selecting root categories as parent (avoid deep nesting issues)
  const rootCategories = categories.filter(c => !c.parent_id)
  const parentOptions = editingCategory
    ? categories.filter(c => c.category_id !== editingCategory.category_id && !c.parent_id)
    : rootCategories

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading">Quản lý Danh mục</h1>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="font-semibold text-foreground">{categories.length}</span> danh mục
            &nbsp;·&nbsp;
            <span className="font-semibold text-foreground">{tree.length}</span> gốc
            &nbsp;·&nbsp;
            <span className="font-semibold text-foreground">{categories.filter(c => c.parent_id).length}</span> con
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm danh mục..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn bg-primary text-white hover:bg-primary-hover px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-semibold shadow-sm"
          >
            <Plus className="w-5 h-5 hidden sm:block" /> Thêm mới
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Đang tải danh sách...</div>
        ) : tree.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Chưa có danh mục nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase text-xs border-b border-border">
                <tr>
                  <th className="px-4 py-3">Tên danh mục</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Phân cấp</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {tree.map((root, idx) => (
                  <CategoryRow
                    key={root.category_id}
                    node={root}
                    depth={0}
                    isLast={idx === tree.length - 1}
                    parentLines={[]}
                    onEdit={handleOpenModal}
                    onDelete={handleDelete}
                    deleteConfirm={deleteConfirm}
                    setDeleteConfirm={setDeleteConfirm}
                    handleDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold font-heading">
                {editingCategory ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục Mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                <X className="w-5 h-5" />
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
                  <option value="">— Danh mục gốc (Không có cha) —</option>
                  {parentOptions.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">Chỉ chọn được danh mục gốc làm cha (tối đa 2 cấp).</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold transition-colors">
                  Hủy
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors shadow-sm">
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
