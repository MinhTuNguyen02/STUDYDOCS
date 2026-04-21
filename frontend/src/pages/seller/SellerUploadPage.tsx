import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { sellerApi } from '@/api/seller.api'
import api from '@/api/client'
import { getPageCount } from '@/utils/fileParser'
import { Upload, FileText, Image as ImageIcon, X, Loader2, ChevronRight, Plus, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'
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
  value: string
  onChange: (id: string) => void
}

function CascadeCategorySelector({ allCategories, value, onChange }: CascadeSelectorProps) {
  const [path, setPath] = useState<number[]>([])

  const childrenOf = (parentId: number | null) =>
    allCategories.filter(c => c.parent_id === parentId)

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
      setPath(newPath)
      onChange(String(selectedId))
    } else {
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
              className={`flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary focus:outline-none bg-background transition-colors ${isLeafSelected ? 'border-primary bg-primary/5' : 'border-border'}`}
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

// ── Document Item Types ───────────────────────────────────────────────────────

interface DocItem {
  id: string
  file: File | null
  form: { title: string; description: string; price: string; categoryId: string; pageCount: string }
  selectedTags: number[]
  parsingFile: boolean
  status: 'idle' | 'uploading' | 'success' | 'error'
  errorMsg?: string
}

function makeEmptyItem(): DocItem {
  return {
    id: crypto.randomUUID(),
    file: null,
    form: { title: '', description: '', price: '', categoryId: '', pageCount: '' },
    selectedTags: [],
    parsingFile: false,
    status: 'idle',
  }
}

// ── Single Document Item Card ─────────────────────────────────────────────────

interface DocItemCardProps {
  item: DocItem
  index: number
  total: number
  categories: Category[]
  allTags: any[]
  onUpdate: (id: string, patch: Partial<DocItem>) => void
  onRemove: (id: string) => void
  disabled: boolean
}

function DocItemCard({ item, index, total, categories, allTags, onUpdate, onRemove, disabled }: DocItemCardProps) {
  const handleFileSelection = useCallback(async (selectedFile: File | undefined) => {
    if (!selectedFile) return
    onUpdate(item.id, { file: selectedFile, parsingFile: true })
    try {
      const pages = await getPageCount(selectedFile)
      onUpdate(item.id, {
        form: { ...item.form, pageCount: String(pages) },
        parsingFile: false,
      })
      toast.success(`Tài liệu ${index + 1}: Đã đếm được ${pages} trang/slide`)
    } catch {
      onUpdate(item.id, {
        form: { ...item.form, pageCount: '1' },
        parsingFile: false,
      })
    }
  }, [item.id, item.form, index, onUpdate])

  const setFormField = (key: string, value: string) =>
    onUpdate(item.id, { form: { ...item.form, [key]: value } })

  const toggleTag = (tagId: number) => {
    const next = item.selectedTags.includes(tagId)
      ? item.selectedTags.filter(t => t !== tagId)
      : [...item.selectedTags, tagId]
    onUpdate(item.id, { selectedTags: next })
  }

  const borderColor = item.status === 'success' ? 'border-success' : item.status === 'error' ? 'border-danger' : 'border-border'

  return (
    <div className={`bg-card border-2 ${borderColor} rounded-3xl p-6 shadow-sm relative transition-colors`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <h3 className="font-bold text-lg font-heading">
            {item.form.title || `Tài liệu ${index + 1}`}
          </h3>
          {item.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {item.status === 'success' && <CheckCircle className="w-4 h-4 text-success" />}
          {item.status === 'error' && <AlertCircle className="w-4 h-4 text-danger" />}
        </div>
        {total > 1 && !disabled && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="p-2 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
            title="Xóa tài liệu này"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status message */}
      {item.status === 'success' && (
        <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-xl text-success text-sm font-semibold">
          ✅ Đã tải lên thành công — đang chờ duyệt
        </div>
      )}
      {item.status === 'error' && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm font-semibold">
          ❌ {item.errorMsg || 'Tải lên thất bại'}
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0]) }}
        className={`border-2 border-dashed rounded-2xl p-8 text-center mb-5 transition-colors ${item.file ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
      >
        {item.file ? (
          <div className="flex flex-col items-center">
            <FileText className="w-10 h-10 text-primary mb-2" />
            <p className="font-semibold text-sm">{item.file.name}</p>
            <div className="flex items-center gap-3 text-muted-foreground text-xs mt-1 mb-3">
              <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
              <span>•</span>
              {item.parsingFile
                ? <span className="flex items-center gap-1 text-warning"><Loader2 className="w-3 h-3 animate-spin" />Đang đếm...</span>
                : <span>{item.form.pageCount} trang</span>
              }
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => onUpdate(item.id, { file: null, form: { ...item.form, pageCount: '' } })}
                className="text-danger hover:underline text-xs font-semibold flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Gỡ bỏ file
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <ImageIcon className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="font-semibold mb-1 text-sm">Kéo thả hoặc chọn file</p>
            <p className="text-muted-foreground text-xs mb-4">PDF, DOCX, PPTX, XLSX (Tối đa 100MB)</p>
            <label className="btn btn-primary cursor-pointer px-6 py-2 text-sm">
              Chọn file
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                onChange={e => handleFileSelection(e.target.files?.[0])} disabled={disabled} />
            </label>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1.5">Tên tài liệu <span className="text-danger">*</span></label>
          <input
            type="text" value={item.form.title}
            onChange={e => setFormField('title', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            placeholder="VD: Đề thi THPT Quốc Gia môn Toán 2026..."
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Danh mục <span className="text-danger">*</span>
              <span className="ml-1 text-xs text-muted-foreground font-normal">(đến danh mục con)</span>
            </label>
            <CascadeCategorySelector
              allCategories={categories}
              value={item.form.categoryId}
              onChange={id => setFormField('categoryId', id)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Giá bán (VNĐ)
              <span className="ml-2 text-xs text-muted-foreground font-normal">Tối đa 500.000₫</span>
            </label>
            <input
              type="number" value={item.form.price}
              onChange={e => {
                const val = Number(e.target.value)
                if (val > 500000) {
                  setFormField('price', '500000')
                } else {
                  setFormField('price', e.target.value)
                }
              }}
              min={0}
              max={500000}
              className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:outline-none text-sm"
              placeholder="Bỏ trống để Miễn phí (0₫)"
              disabled={disabled}
            />
            {Number(item.form.price) > 500000 && (
              <p className="text-danger text-xs mt-1 font-semibold">Giá tối đa là 500.000₫</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Thẻ nổi bật (Tags)</label>
          <div className="flex flex-wrap gap-2 p-3 border border-border rounded-xl bg-background max-h-36 overflow-y-auto">
            {allTags.length > 0 ? allTags.map((t: any) => {
              const tagId = t.id || t.tag_id
              return (
                <label key={tagId} className={`cursor-pointer px-3 py-1 rounded-full text-xs font-medium border transition-colors ${item.selectedTags.includes(tagId) ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'}`}>
                  <input type="checkbox" className="hidden"
                    checked={item.selectedTags.includes(tagId)}
                    onChange={() => toggleTag(tagId)}
                    disabled={disabled}
                  />
                  {t.name || t.tag_name}
                </label>
              )
            }) : <span className="text-muted-foreground text-xs">Chưa có thẻ nào</span>}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-1.5">
            <label className="block text-sm font-semibold">Mô tả chi tiết <span className="text-danger">*</span></label>
            <span className={`text-xs ${item.form.description.length < 200 ? 'text-danger' : 'text-success'}`}>
              {item.form.description.length}/200 ký tự
            </span>
          </div>
          <textarea
            value={item.form.description}
            onChange={e => setFormField('description', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:outline-none min-h-[100px] text-sm"
            placeholder="Giới thiệu súc tích về nội dung tài liệu, những ai nên mua, có điểm gì nổi bật..."
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main Upload Page ──────────────────────────────────────────────────────────

export default function SellerUploadPage() {
  const [items, setItems] = useState<DocItem[]>([makeEmptyItem()])
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
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

  const updateItem = useCallback((id: string, patch: Partial<DocItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const addItem = () => {
    setItems(prev => [...prev, makeEmptyItem()])
  }

  const buildFormData = (item: DocItem): FormData => {
    const formData = new FormData()
    formData.append('file', item.file!)
    formData.append('title', item.form.title)
    formData.append('description', item.form.description)
    formData.append('price', item.form.price || '0')
    formData.append('categoryId', item.form.categoryId)
    if (item.selectedTags.length > 0) formData.append('tagIds', item.selectedTags.join(','))
    formData.append('pageCount', item.form.pageCount)
    formData.append('fileExtension', item.file!.name.split('.').pop()?.toLowerCase() || '')
    const sizeMb = Math.max(1, Math.ceil(item.file!.size / (1024 * 1024)))
    formData.append('fileSizeMb', String(sizeMb))
    const slug = item.form.title
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-').replace(/^-+|-+$/g, '')
    formData.append('slug', slug)
    return formData
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const n = i + 1
      if (!item.file) { toast.error(`Tài liệu ${n}: Vui lòng chọn file`); return }
      if (item.parsingFile) { toast.error(`Tài liệu ${n}: Đang xử lý file, vui lòng chờ`); return }
      if (!item.form.title) { toast.error(`Tài liệu ${n}: Vui lòng nhập tên tài liệu`); return }
      if (item.form.description.length < 200) { toast.error(`Tài liệu ${n}: Mô tả phải dài ít nhất 200 ký tự`); return }
      if (!item.form.pageCount || Number(item.form.pageCount) < 1) { toast.error(`Tài liệu ${n}: Không thể xác nhận số trang`); return }
      if (!item.form.categoryId) { toast.error(`Tài liệu ${n}: Vui lòng chọn danh mục`); return }
    }

    setUploading(true)
    setItems(prev => prev.map(item => ({ ...item, status: 'uploading' as const })))

    const results = await Promise.allSettled(
      items.map(item => sellerApi.uploadDocument(buildFormData(item)))
    )

    let successCount = 0
    setItems(prev => prev.map((item, i) => {
      const result = results[i]
      if (result.status === 'fulfilled') {
        successCount++
        return { ...item, status: 'success' as const }
      } else {
        const msg = (result.reason as any)?.response?.data?.message || 'Tải lên thất bại'
        return { ...item, status: 'error' as const, errorMsg: msg }
      }
    }))

    setUploading(false)

    if (successCount === items.length) {
      toast.success(`Đã tải lên ${successCount} tài liệu thành công! Đang chờ duyệt.`)
      updateUser({ hasUploadedDocument: true })
      setTimeout(() => navigate('/seller/documents'), 1500)
    } else {
      const failCount = items.length - successCount
      toast.error(`${failCount} tài liệu tải lên thất bại. Vui lòng kiểm tra lại.`)
      if (successCount > 0) {
        updateUser({ hasUploadedDocument: true })
        toast.success(`${successCount} tài liệu đã tải lên thành công.`)
      }
    }
  }

  const anyUploading = uploading
  const successItems = items.filter(i => i.status === 'success')
  const pendingItems = items.filter(i => i.status !== 'success')

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
          <Upload className="w-8 h-8 text-primary" />
          Tải lên tài liệu
        </h1>
        {items.length > 1 && (
          <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {items.length} tài liệu
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {items.map((item, index) => (
          <DocItemCard
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            categories={categories}
            allTags={allTags}
            onUpdate={updateItem}
            onRemove={removeItem}
            disabled={anyUploading || item.status === 'success'}
          />
        ))}

        {/* Add Document Button */}
        {!anyUploading && pendingItems.length > 0 && (
          <button
            type="button"
            onClick={addItem}
            className="w-full py-4 border-2 border-dashed border-primary/40 hover:border-primary text-primary font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all hover:bg-primary/5 text-sm"
          >
            <Plus className="w-5 h-5" />
            Thêm tài liệu khác
          </button>
        )}

        {/* Summary when some already succeeded */}
        {successItems.length > 0 && successItems.length < items.length && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-2xl text-success text-sm font-semibold text-center">
            ✅ {successItems.length}/{items.length} tài liệu đã được tải lên. Đang tiếp tục...
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={anyUploading || pendingItems.every(i => i.status === 'success')}
          className="w-full btn btn-primary py-4 text-lg rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Đang tải lên {items.length} tài liệu...</>
          ) : (
            <><Upload className="w-5 h-5" /> Tải lên {items.length > 1 ? `${items.length} tài liệu` : 'tài liệu'} &amp; Chờ Duyệt</>
          )}
        </button>
      </form>
    </div>
  )
}
