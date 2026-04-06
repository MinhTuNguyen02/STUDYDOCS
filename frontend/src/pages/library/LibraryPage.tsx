import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { libraryApi } from '@/api/library.api'
import { formatDate } from '@/utils/format'
import { Library, Search, Download, FileText, CheckCircle2, Package } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LibraryPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetchMyDocuments()
  }, [])

  const fetchMyDocuments = async () => {
    try {
      const res = await libraryApi.getMyDocuments()
      setDocuments(res.data || res || [])
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải thư viện tài liệu')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (documentId: number) => {
    try {
      const res = await libraryApi.getDownloadLink(documentId)
      if (res.downloadUrl || res.data?.downloadUrl) {
        window.open(res.downloadUrl || res.data.downloadUrl, '_blank')
      } else {
        toast.error('Không tìm thấy link tải xuống')
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Lỗi khi tải file')
    }
  }

  const filteredDocs = documents.filter((doc) =>
    (doc.title || '').toLowerCase().includes(keyword.toLowerCase())
  )

  const fileColorMap: Record<string, string> = {
    pdf: 'bg-linear-to-br from-red-400 to-red-600',
    docx: 'bg-linear-to-br from-blue-400 to-blue-600',
    doc: 'bg-linear-to-br from-blue-400 to-blue-600',
    pptx: 'bg-linear-to-br from-orange-400 to-orange-600',
    ppt: 'bg-linear-to-br from-orange-400 to-orange-600',
    xlsx: 'bg-linear-to-br from-green-400 to-green-600',
    xls: 'bg-linear-to-br from-green-400 to-green-600'
  }

  if (loading) return <div className="py-24 text-center text-muted-foreground">Đang tải thư viện của bạn...</div>

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Library className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold font-heading text-foreground">Thư viện của tôi</h1>
          </div>
          <p className="text-muted-foreground mt-2">Nơi lưu trữ tất cả tài liệu bạn đã mua hoặc tải miễn phí.</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm trong thư viện..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          />
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border shadow-sm">
          <Library className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Thư viện trống</h3>
          <p className="text-muted-foreground mb-6">Bạn chưa có tài liệu nào trong thư viện.</p>
          <Link to="/documents" className="btn btn-primary inline-flex">Khám phá ngay</Link>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Không tìm thấy tài liệu nào khớp với từ khóa "{keyword}"
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocs.map((doc, index) => {
            const ext = (doc.file_extension || doc.fileExtension || 'PDF').toLowerCase()
            const imageColor = fileColorMap[ext] || 'bg-linear-to-br from-purple-400 to-purple-600'
            const downloadType = doc.download_type || doc.downloadType || 'PURCHASED'

            return (
              <div key={doc.id || doc.document_id || index} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col h-full group">
                <div className={`h-40 ${imageColor} flex items-center justify-center relative shrink-0`}>
                  <FileText className="w-16 h-16 text-white/90 group-hover:scale-110 transition-transform duration-300" />
                  <div className="absolute bottom-0 w-full bg-black/30 backdrop-blur-sm text-white text-center text-xs py-1.5 font-bold tracking-widest uppercase">
                    {ext}
                  </div>
                  
                  {/* Badge */}
                  <div className="absolute top-3 left-3">
                    {downloadType === 'FREE' ? (
                      <span className="bg-success text-white px-2.5 py-1 text-xs font-semibold rounded-md shadow-sm">
                        Miễn phí
                      </span>
                    ) : downloadType === 'PACKAGE' ? (
                      <span className="bg-warning text-white px-2.5 py-1 text-xs font-semibold rounded-md shadow-sm flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" /> Gói lượt tải
                      </span>
                    ) : (
                      <span className="bg-primary text-white px-2.5 py-1 text-xs font-semibold rounded-md shadow-sm flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã mua
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <Link to={`/documents/${doc.document_id || doc.id}`} className="font-bold text-foreground hover:text-primary transition-colors text-base line-clamp-2 mb-2">
                      {doc.title}
                    </Link>
                    <p className="text-xs text-muted-foreground flex flex-col gap-1">
                      <span>Mua ngày: {formatDate(doc.purchased_at || doc.createdAt || doc.created_at)}</span>
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => handleDownload(doc.document_id || doc.id)}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Tải xuống
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
