import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { documentsApi } from '@/api/documents.api'
import DocumentCard from '@/components/common/DocumentCard'
import { Search, Filter, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'

export default function DocumentsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [documents, setDocuments] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState({ page: 1, limit: 12, total: 0 })

  const keyword = searchParams.get('keyword') || ''
  const categoryId = searchParams.get('categoryId') || ''
  const sortBy = searchParams.get('sortBy') || 'popular'

  useEffect(() => {
    documentsApi.getCategories().then(res => setCategories(res || []))
  }, [])

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true)
      try {
        const page = parseInt(searchParams.get('page') || '1', 10)
        const params = {
          keyword,
          categoryId: categoryId === 'ALL' ? '' : categoryId,
          sortBy,
          page,
          limit: 12
        }
        const res = await documentsApi.getDocuments(params)
        setDocuments(res.data || [])
        setMeta(res.meta || { page, limit: 12, total: 0 })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDocs()
  }, [searchParams])

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    newParams.set('page', '1')
    setSearchParams(newParams)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* ── Sidebar Filters ── */}
      <aside className="w-full lg:w-72 shrink-0">
        <div className="bg-card border border-border rounded-xl p-6 sticky top-24 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">Bộ lọc tài liệu</h3>
          </div>
          
          <div className="mb-6">
            <label className="block font-medium text-sm text-foreground mb-2">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                value={keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                placeholder="Nhập tên tài liệu..."
                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="font-medium text-sm text-foreground mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Danh mục
            </label>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="radio" 
                  name="category" 
                  checked={!categoryId} 
                  onChange={() => handleFilterChange('categoryId', '')} 
                  className="w-4 h-4 text-primary bg-background border-border focus:ring-primary/20 accent-primary"
                />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">Tất cả danh mục</span>
              </label>
              {categories.filter(c => !c.parent_id).map(parent => {
                const pId = String(parent.id || parent.category_id);
                const children = categories.filter(c => String(c.parent_id) === pId);
                
                return (
                  <div key={pId} className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="category" 
                        checked={categoryId === pId} 
                        onChange={() => handleFilterChange('categoryId', pId)} 
                        className="w-4 h-4 text-primary bg-background border-border focus:ring-primary/20 accent-primary"
                      />
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">{parent.name}</span>
                    </label>
                    {children.length > 0 && (
                      <div className="flex flex-col gap-2 ml-6 border-l-2 border-border pl-3">
                        {children.map(child => {
                          const cId = String(child.id || child.category_id);
                          return (
                            <label key={cId} className="flex items-center gap-3 cursor-pointer group">
                              <input 
                                type="radio" 
                                name="category" 
                                checked={categoryId === cId} 
                                onChange={() => handleFilterChange('categoryId', cId)} 
                                className="w-4 h-4 text-primary bg-background border-border focus:ring-primary/20 accent-primary"
                              />
                              <span className="text-sm font-normal group-hover:text-primary transition-colors text-muted-foreground">{child.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mb-2">
            <label className="block font-medium text-sm text-foreground mb-2">Sắp xếp theo</label>
            <select 
              value={sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="popular">Phổ biến nhất</option>
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá: Thấp đến Cao</option>
              <option value="price_desc">Giá: Cao đến Thấp</option>
            </select>
          </div>
        </div>
      </aside>

      {/* ── Main Content: Grid ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-end justify-between mb-6 pb-4 border-b border-border/50">
          <h2 className="text-2xl font-bold text-foreground">
            {keyword ? `Kết quả cho "${keyword}"` : 'Tất cả tài liệu'}
            <span className="text-sm text-muted-foreground ml-3 font-normal">
              ({meta.total} tài liệu)
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : documents.length > 0 ? (
          <div className="flex flex-col gap-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map(doc => <DocumentCard key={doc.id} document={doc} />)}
            </div>

            {/* Pagination Controls */}
            {meta.total > meta.limit && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <button 
                  disabled={meta.page <= 1}
                  onClick={() => handleFilterChange('page', String(meta.page - 1))}
                  className="p-2 border border-border rounded-lg bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-2 border border-border rounded-lg bg-card font-medium text-sm">
                  Trang {meta.page} / {Math.ceil(meta.total / meta.limit)}
                </div>
                <button 
                  disabled={meta.page * meta.limit >= meta.total}
                  onClick={() => handleFilterChange('page', String(meta.page + 1))}
                  className="p-2 border border-border rounded-lg bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 bg-card border border-border rounded-xl mt-4">
            <Filter className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">Không tìm thấy tài liệu phù hợp</h3>
            <p className="text-muted-foreground mb-6">Thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
            <button 
              className="bg-primary text-white font-medium px-6 py-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-sm"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
