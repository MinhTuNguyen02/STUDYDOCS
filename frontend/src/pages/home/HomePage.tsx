import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { documentsApi } from '@/api/documents.api'
import DocumentCard from '@/components/common/DocumentCard'
import { ArrowRight, BookOpen, GraduationCap, Calculator, Globe, Microscope, Palette, Code, Languages, Search, Shield, Truck, Headphones, Award } from 'lucide-react'

const getCategoryIconAndColor = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('toán')) return { icon: Calculator, color: 'bg-blue-100 text-blue-700' }
  if (n.includes('văn')) return { icon: BookOpen, color: 'bg-green-100 text-green-700' }
  if (n.includes('anh')) return { icon: Languages, color: 'bg-purple-100 text-purple-700' }
  if (n.includes('khoa học') || n.includes('lý') || n.includes('hóa')) return { icon: Microscope, color: 'bg-pink-100 text-pink-700' }
  if (n.includes('sử') || n.includes('địa')) return { icon: Globe, color: 'bg-orange-100 text-orange-700' }
  if (n.includes('nghệ thuật') || n.includes('nhạc')) return { icon: Palette, color: 'bg-yellow-100 text-yellow-700' }
  if (n.includes('tin học') || n.includes('công nghệ thông tin') || n.includes('lập trình')) return { icon: Code, color: 'bg-indigo-100 text-indigo-700' }
  return { icon: GraduationCap, color: 'bg-red-100 text-red-700' }
}

const features = [
  { icon: Shield, title: 'Bảo mật thanh toán', description: 'Thanh toán an toàn với các phương thức được mã hóa' },
  { icon: Truck, title: 'Tải xuống tức thì', description: 'Nhận tài liệu ngay sau khi thanh toán thành công' },
  { icon: Headphones, title: 'Hỗ trợ 24/7', description: 'Đội ngũ hỗ trợ luôn sẵn sàng giải đáp thắc mắc' },
  { icon: Award, title: 'Chất lượng đảm bảo', description: 'Tài liệu được kiểm duyệt chất lượng kỹ càng' },
]

export default function HomePage() {
  const [popularDocs, setPopularDocs] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsRes, catsRes] = await Promise.all([
          documentsApi.getDocuments({ limit: 8, sortBy: 'popular' }),
          documentsApi.getCategories()
        ])
        setPopularDocs(docsRes.data || [])
        setCategories((catsRes || []).slice(0, 8)) // Top 8
      } catch (err) {
        console.error('Failed to fetch homepage data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/documents?keyword=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <>
      {/* ── Hero Section ── */}
      <section className="bg-linear-to-r from-primary to-primary-light text-white rounded-2xl mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl mb-6 text-white leading-tight font-bold">
              Nền Tảng Tài Liệu Học Tập Hàng Đầu
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90">
              Khám phá hàng ngàn đề thi, giáo trình và tài liệu chất lượng cao. Học tập hiệu quả hơn với StudyDocs.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/documents" className="bg-white font-bold text-primary px-8 py-3 rounded-lg hover:bg-gray-100 hover:shadow-md transition-all flex items-center justify-center gap-2 shadow-sm">
                Khám phá ngay <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/packages" className="border-2 border-white font-bold text-white px-8 py-3 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center text-center">
                Xem Gói VIP
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories Section ── */}
      <section className="py-8 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold">Danh mục phổ biến</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {categories.map((category) => {
              const { icon: Icon, color } = getCategoryIconAndColor(category.name)
              return (
                <Link
                  key={category.id || category.category_id}
                  to={`/documents?categoryId=${category.id || category.category_id}`}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary hover:shadow-lg transition-all hover:-translate-y-1"
                >
                  <div className={`w-14 h-14 rounded-full ${color} flex items-center justify-center`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="text-sm text-center font-medium">{category.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Popular Documents Grid ── */}
      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Tài liệu bán chạy</h2>
            <Link to="/documents?sortBy=popular" className="text-primary hover:underline font-medium">Xem tất cả →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              [...Array(8)].map((_, i) => <div key={i} className="h-80 bg-muted animate-pulse rounded-xl" />)
            ) : (
              popularDocs.map(doc => <DocumentCard key={doc.id} document={doc} />)
            )}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-16 bg-muted/30 rounded-2xl mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="mb-2 font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
