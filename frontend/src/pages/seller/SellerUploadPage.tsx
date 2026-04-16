import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { sellerApi } from '@/api/seller.api'
import api from '@/api/client'
import { getPageCount } from '@/utils/fileParser'
import { Upload, FileText, Image as ImageIcon, X, Loader2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

// ── Cascading Category Selector ──────────────────────────────────────────────

interface Category {
  id: number
  name: string
  parent_id: number | null
}

interface CascadeSelectorProps {
  allCategories: Category[]
  value: string       // final selected leaf category id (string for form compat)
  onChange: (id: string) => void
}

function CascadeCategorySelector({ allCategories, value, onChange }: CascadeSelectorProps) {
  const [path, setPath] = useState<number[]>([])

  useEffect(() => {
    // Removed: do not blindly wipe path when value is empty, because selecting an intermediate
    // category intentionally sets value = '' preventing the next dropdown from showing.
  }, [value])

  const childrenOf = (parentId: number | null) =>
    allCategories.filter(c => c.parent_id === parentId)

  // Build the list of selects to render
  const levels: { parentId: number | null; selectedId: number | null }[] = []
  levels.push({ parentId: null, selectedId: path[0] ?? null })
  for (let i = 0; i < path.length; i++) {
    const selected = path[i]
    const children = childrenOf(selected)
    if (children.length > 0) {
      levels.push({ parentId: selected, selectedId: path[i + 1] ?? null })
    } else {
      break
    }
  }

  const handleSelect = (depth: number, selectedId: number) => {
    const newPath = path.slice(0, depth)
    newPath[depth] = selectedId

    const children = childrenOf(selectedId)
    if (children.length === 0) {
      // Leaf category
      setPath(newPath)
      onChange(String(selectedId))
    } else {
      // Has children, not a leaf yet
      setPath(newPath)
      onChange('')
    }
  }

  return (
    <div className="space-y-3">
      {levels.map((level, depth) => {
        const options = childrenOf(level.parentId)
        if (options.length === 0) return null
        const isLeafSelected = level.selectedId !== null && childrenOf(level.selectedId).length === 0
        return (
          <div key={depth} className="flex items-center gap-2">
            {depth > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <select
              value={level.selectedId ?? ''}
              onChange={e => handleSelect(depth, Number(e.target.value))}
              className={`flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary focus:outline-none bg-background transition-colors ${isLeafSelected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
            >
              <option value="">
                {depth === 0 ? 'Chọn danh mục' : '-- Chọn danh mục con --'}
              </option>
              {options.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Upload Page ──────────────────────────────────────────────────────────

export default function SellerUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({ title: '', description: '', price: '', categoryId: '', pageCount: '' })
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [uploading, setUploading] = useState(false)
  const [parsingFile, setParsingFile] = useState(false)
  const { updateUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/categories')
      .then(r => {
        const raw = r.data?.data || r.data || []
        const normalized: Category[] = raw.map((c: any) => ({
          id: c.category_id ?? c.id,
          name: c.name,
          parent_id: c.parent_id ?? null
        }))
        setCategories(normalized)
      })
      .catch(() => { })
    api.get('/tags')
      .then(r => setAllTags(r.data?.data || r.data || []))
      .catch(() => { })
  }, [])

  const handleFileSelection = async (selectedFile: File | undefined) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setParsingFile(true)
    try {
      const pages = await getPageCount(selectedFile)
      setForm(prev => ({ ...prev, pageCount: String(pages) }))
      toast.success(`Đã tự động đếm được ${pages} trang/slide`)
    } catch (e) {
      setForm(prev => ({ ...prev, pageCount: '1' }))
    } finally {
      setParsingFile(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return toast.error('Vui lòng chọn file tài liệu')
    if (parsingFile) return toast.error('Đang xử lý đọc file, vui lòng chờ...')
    if (!form.title) return toast.error('Vui lòng nhập tên tài liệu')
    if (form.description.length < 200) return toast.error('Mô tả tài liệu phải dài ít nhất 200 ký tự')
    if (!form.pageCount || isNaN(Number(form.pageCount)) || Number(form.pageCount) < 1) return toast.error('Không thể xác nhận số trang của tài liệu')
    if (!form.categoryId) return toast.error('Vui lòng chọn đến danh mục con cùng cấp')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', form.title)
    formData.append('description', form.description)
    formData.append('price', form.price ? form.price : '0')
    formData.append('categoryId', form.categoryId)
    if (selectedTags.length > 0) formData.append('tagIds', selectedTags.join(','))
    formData.append('pageCount', form.pageCount)
    formData.append('fileExtension', file.name.split('.').pop()?.toLowerCase() || '')
    const sizeMb = Math.max(1, Math.ceil(file.size / (1024 * 1024)))
    formData.append('fileSizeMb', String(sizeMb))

    const slug = form.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')
    formData.append('slug', slug)

    setUploading(true)
    try {
      await sellerApi.uploadDocument(formData)
      toast.success('Tải lên thành công! Tài liệu đang chờ duyệt.')
      updateUser({ hasUploadedDocument: true })
      navigate('/seller/documents')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Tải lên thất bại')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold font-heading mb-8 flex items-center gap-3">
        <Upload className="w-8 h-8 text-primary" /> Tải lên tài liệu mới
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Upload Zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-3xl p-12 text-center transition-colors ${file ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
        >
          {file ? (
            <div className="flex flex-col items-center">
              <FileText className="w-16 h-16 text-primary mb-4" />
              <p className="font-bold text-lg">{file.name}</p>
              <div className="flex items-center gap-4 text-muted-foreground text-sm mb-4">
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                {parsingFile ? (
                  <span className="flex items-center gap-1 text-warning"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang đếm...</span>
                ) : (
                  <span className="font-medium text-foreground">{form.pageCount} trang</span>
                )}
              </div>
              <button type="button" onClick={() => { setFile(null); setForm(p => ({ ...p, pageCount: '' })) }} className="text-danger hover:underline text-sm font-semibold flex items-center gap-1">
                <X className="w-4 h-4" /> Gỡ bỏ file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="font-bold text-lg mb-2">Kéo thả file vào đây</p>
              <p className="text-muted-foreground text-sm mb-6">Hỗ trợ: PDF, DOCX, PPTX, XLSX (Tối đa 100MB)</p>
              <label className="btn btn-primary cursor-pointer px-8">
                Chọn file từ máy tính
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={e => handleFileSelection(e.target.files?.[0])} />
              </label>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
          <h3 className="font-bold text-xl mb-6">Thông tin tài liệu</h3>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Tên tài liệu <span className="text-danger">*</span></label>
              <input
                type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="VD: Đề thi THPT Quốc Gia môn Toán 2026..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Danh mục <span className="text-danger">*</span>
                  <span className="ml-2 text-xs text-muted-foreground font-normal">(chọn đến danh mục con cùng cấp)</span>
                </label>
                <CascadeCategorySelector
                  allCategories={categories}
                  value={form.categoryId}
                  onChange={id => setForm(f => ({ ...f, categoryId: id }))}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Giá bán (VNĐ)</label>
                <input
                  type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Bỏ trống để Miễn phí"
                />
              </div>
            </div>

            {/* Tags Selection */}
            <div>
              <label className="block text-sm font-semibold mb-2">Thẻ nổi bật (Tags)</label>
              <div className="flex flex-wrap gap-2 p-4 border border-border rounded-xl bg-background max-h-48 overflow-y-auto">
                {allTags.length > 0 ? allTags.map((t: any) => (
                  <label key={t.id || t.tag_id} className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedTags.includes(t.id || t.tag_id) ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedTags.includes(t.id || t.tag_id)}
                      onChange={(e) => {
                        const id = t.id || t.tag_id;
                        if (e.target.checked) setSelectedTags([...selectedTags, id]);
                        else setSelectedTags(selectedTags.filter(item => item !== id));
                      }}
                    />
                    {t.name || t.tag_name}
                  </label>
                )) : (
                  <span className="text-muted-foreground text-sm">Chưa có thẻ nào trên hệ thống</span>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-semibold">Mô tả chi tiết <span className="text-danger">*</span></label>
                <span className={`text-xs ${form.description.length < 200 ? 'text-danger' : 'text-success'}`}>
                  {form.description.length}/200 ký tự
                </span>
              </div>
              <textarea
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:outline-none min-h-[120px]"
                placeholder="Giới thiệu súc tích về nội dung tài liệu, những ai nên mua, có điểm gì nổi bật..."
                required
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={uploading || !file || !form.categoryId} className="w-full btn btn-primary py-4 text-lg rounded-2xl shadow-lg disabled:opacity-50">
          {uploading ? 'Đang tải lên...' : 'Tải lên & Chờ Duyệt'}
        </button>

      </form>
    </div>
  )
}
