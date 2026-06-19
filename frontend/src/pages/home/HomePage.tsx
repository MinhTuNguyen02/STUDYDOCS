import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { documentsApi } from '@/api/documents.api'
import DocumentCard from '@/components/common/DocumentCard'
import { ArrowRight, BookOpen, GraduationCap, Calculator, Globe, Microscope, Palette, Code, Languages, Search, Shield, Truck, Headphones, Award, TrendingUp, Scale, HeartPulse, FileText, BarChart3, PenLine } from 'lucide-react'

const getCategoryIconAndColor = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('công nghệ thông tin') || n.includes('lập trình') || n.includes('cơ sở dữ liệu')) return { icon: Code, color: 'bg-indigo-100 text-indigo-700' }
  if (n.includes('kinh tế') || n.includes('quản trị') || n.includes('marketing') || n.includes('kế toán')) return { icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700' }
  if (n.includes('ngoại ngữ') || n.includes('tiếng')) return { icon: Languages, color: 'bg-purple-100 text-purple-700' }
  if (n.includes('khoa học') || n.includes('kỹ thuật') || n.includes('vật lý') || n.includes('hóa')) return { icon: Microscope, color: 'bg-cyan-100 text-cyan-700' }
  if (n.includes('luật') || n.includes('chính trị') || n.includes('nhà nước') || n.includes('quốc tế')) return { icon: Scale, color: 'bg-amber-100 text-amber-700' }
  if (n.includes('y dược') || n.includes('sức khỏe') || n.includes('y khoa') || n.includes('răng hàm mặt')) return { icon: HeartPulse, color: 'bg-rose-100 text-rose-700' }
  if (n.includes('phổ thông')) return { icon: BookOpen, color: 'bg-blue-100 text-blue-700' }
  
  // Fallbacks
  if (n.includes('toán')) return { icon: Calculator, color: 'bg-blue-100 text-blue-700' }
  if (n.includes('sử') || n.includes('địa')) return { icon: Globe, color: 'bg-orange-100 text-orange-700' }
  if (n.includes('nghệ thuật') || n.includes('nhạc')) return { icon: Palette, color: 'bg-yellow-100 text-yellow-700' }
  
  return { icon: GraduationCap, color: 'bg-slate-100 text-slate-700' }
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
      <section className="hero-section text-white rounded-2xl mb-12">
        {/* ── Decorative floating spheres ── */}
        <div className="hero-sphere absolute w-24 h-24 top-8 right-[28%] opacity-60"
             style={{ animation: 'hero-float 7s ease-in-out infinite' }} />
        <div className="hero-sphere-solid absolute w-14 h-14 bottom-16 right-[35%] opacity-70"
             style={{ animation: 'hero-float-reverse 5s ease-in-out infinite' }} />
        <div className="hero-sphere absolute w-10 h-10 top-[40%] right-[12%] opacity-50"
             style={{ animation: 'hero-float-slow 8s ease-in-out infinite' }} />
        <div className="hero-sphere-solid absolute w-8 h-8 bottom-24 left-[15%] opacity-40"
             style={{ animation: 'hero-float 6s ease-in-out infinite 1s' }} />
        <div className="hero-sphere absolute w-20 h-20 top-12 left-[40%] opacity-30"
             style={{ animation: 'hero-float-slow 9s ease-in-out infinite 0.5s' }} />
        <div className="hero-sphere-solid absolute w-36 h-36 -bottom-10 -right-6 opacity-25"
             style={{ animation: 'hero-float-reverse 10s ease-in-out infinite' }} />

        {/* ── Content ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left — Text */}
            <div>
              <h1 className="text-4xl md:text-5xl xl:text-6xl mb-6 text-white leading-[1.1] font-bold italic">
                Nền Tảng Tài Liệu<br className="hidden sm:block" /> Học Tập Hàng Đầu
              </h1>
              <p className="text-lg md:text-xl mb-8 text-white/80 max-w-lg leading-relaxed">
                Khám phá kho tàng tài liệu, bài giảng và đề thi phong phú giúp bạn học tập thông minh hơn cùng StudyDocs.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/documents" className="bg-white font-bold text-primary px-8 py-3.5 rounded-lg hover:bg-gray-100 hover:shadow-lg transition-all flex items-center justify-center gap-2 shadow-md text-base uppercase tracking-wide">
                  Khám phá ngay <ArrowRight className="w-5 h-5" />
                </Link>
                <Link to="/packages" className="border-2 border-white/70 font-bold text-white px-8 py-3.5 rounded-lg hover:bg-white/15 hover:border-white transition-all flex items-center justify-center text-center text-base">
                  Xem Gói VIP
                </Link>
              </div>
            </div>

            {/* Right — Glassmorphism card composition */}
            <div className="hidden lg:flex items-center justify-center relative"
                 style={{ animation: 'hero-cards-entrance 0.8s ease-out both', perspective: '800px' }}>

              {/* Main tilted glass panel */}
              <div className="hero-glass-card p-6 w-[340px]"
                   style={{ transform: 'rotateY(-5deg) rotateX(3deg)' }}>

                {/* Top row — small icon squares */}
                <div className="flex gap-3 mb-5">
                  <div className="hero-glass-icon w-11 h-11 flex items-center justify-center">
                    <PenLine className="w-5 h-5 text-white/90" />
                  </div>
                  <div className="hero-glass-icon w-11 h-11 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white/90" />
                  </div>
                  <div className="hero-glass-icon w-11 h-11 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white/90" />
                  </div>
                </div>

                {/* Document preview card */}
                <div className="hero-glass-card p-4 mb-4 flex items-start gap-3">
                  <div className="hero-glass-icon w-10 h-10 flex-shrink-0 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white/90" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Tài Liệu: Đại Số</p>
                    <p className="text-white/50 text-xs mt-0.5">Toán cao cấp — 48 trang</p>
                  </div>
                </div>

                {/* Exam preview card */}
                <div className="hero-glass-card p-4 flex items-start gap-3">
                  <div className="hero-glass-icon w-10 h-10 flex-shrink-0 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white/90" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Đề Thi & Bài Tập</p>
                    <p className="text-white/50 text-xs mt-0.5">12 đề thi thử — Có đáp án</p>
                  </div>
                </div>
              </div>

              {/* Floating accent card — offset */}
              <div className="hero-glass-card absolute -bottom-4 -left-6 p-3 flex items-center gap-2"
                   style={{ animation: 'hero-float 6s ease-in-out infinite 0.3s' }}>
                <div className="hero-glass-icon w-9 h-9 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white/90" />
                </div>
                <span className="text-white/90 text-xs font-medium">1,200+ Tài liệu</span>
              </div>
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
