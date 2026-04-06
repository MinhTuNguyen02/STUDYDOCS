import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { packagesApi } from '@/api/packages.api'
import { useAuthStore } from '@/store/authStore'
import { formatBalance } from '@/utils/format'
import { PackageOpen, Check, Zap, Download } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PackagesPage() {
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      const res = await packagesApi.getPackages()
      setPackages(res.data || res || [])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải danh sách gói')
    } finally {
      setLoading(false)
    }
  }

  const handleBuy = async (pkg: any) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để mua gói')
      return navigate('/login')
    }

    // Check if phone verified (you can refine this condition if user state has it)

    if (window.confirm(`Bạn có chắc chắn muốn mua gói "${pkg.name}" với giá ${formatBalance(pkg.price)}? Tiền sẽ được trừ vào Ví Thanh toán.`)) {
      setBuying(pkg.package_id || pkg.id)
      try {
        await packagesApi.buyPackage(pkg.package_id || pkg.id)
        toast.success(`Mua gói "${pkg.name}" thành công! Lượt tải đã được cộng vào tài khoản.`)
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Mua gói thất bại. Hãy kiểm tra lại số dư Ví thanh toán.')
      } finally {
        setBuying(null)
      }
    }
  }

  if (loading) return <div className="py-24 text-center">Đang tải danh sách gói...</div>

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
          <PackageOpen className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-heading text-foreground mb-4">Các gói tải tài liệu</h1>
        <p className="text-lg text-muted-foreground">
          Nâng cấp trải nghiệm học tập của bạn với các gói lượt tải tiết kiệm. Mua 1 lần, tải bất kỳ tài liệu nào trên hệ thống.
        </p>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
          Hiện tại chưa có gói lượt tải nào khả dụng.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {packages.map((pkg: any, index: number) => {
            const isPopular = index === 1 || pkg.price > 50000 && pkg.price < 200000;
            return (
              <div
                key={pkg.package_id || pkg.id}
                className={`relative flex flex-col bg-card rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 ${isPopular
                  ? 'border-2 border-primary shadow-[0_0_40px_rgba(108,92,231,0.15)] scale-105 z-10 bg-background'
                  : 'border border-border shadow-sm'
                  }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-linear-to-r from-primary to-primary-light text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-1 shadow-md">
                    <Zap className="w-3.5 h-3.5" /> Phổ biến nhất
                  </div>
                )}

                <h3 className="text-xl font-bold mb-2 text-foreground">{pkg.name}</h3>
                <p className="text-muted-foreground text-sm min-h-[40px] mb-6">{pkg.description}</p>

                <div className="mb-6 pb-6 border-b border-border">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold font-heading text-primary tracking-tight">
                      {formatBalance(pkg.price)}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <div className={`p-1 rounded-full ${isPopular ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'}`}>
                        <Download className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-foreground">
                        <strong className="text-lg mr-1">{pkg.download_turns || pkg.downloadTurns}</strong> lượt tải
                      </span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className={`p-1 rounded-full ${isPopular ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'}`}>
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="text-muted-foreground">
                        Thời hạn: <strong className="text-foreground">{pkg.duration_days || pkg.durationDays} ngày</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className={`p-1 rounded-full mt-0.5 ${isPopular ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'}`}>
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="text-muted-foreground leading-snug">
                        Áp dụng cho mọi tài liệu trên hệ thống có giá trị dưới 50,000đ
                      </span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleBuy(pkg)}
                  disabled={buying === (pkg.package_id || pkg.id)}
                  className={`w-full py-4 rounded-xl font-bold text-base transition-all ${isPopular
                    ? 'bg-primary text-white hover:bg-primary-hover shadow-lg disabled:bg-primary/50'
                    : 'bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:bg-muted disabled:text-muted-foreground'
                    }`}
                >
                  {buying === (pkg.package_id || pkg.id) ? 'Đang xử lý...' : 'Mua gói ngay'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
