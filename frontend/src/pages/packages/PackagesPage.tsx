import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { packagesApi } from '@/api/packages.api'
import { useAuthStore } from '@/store/authStore'
import { formatBalance } from '@/utils/format'
import { PackageOpen, Check, Zap, Download, Clock, Hourglass, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface UserPackage {
  userPackageId: number
  packageId: number
  name: string
  turnsRemaining: number
  totalTurns: number
  durationDays: number
  status: 'ACTIVE' | 'PENDING'
  purchasedAt: string
  expiresAt: string | null
  queuePosition: number
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<any[]>([])
  const [myPackages, setMyPackages] = useState<UserPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      const [pkgsRes, myRes] = await Promise.all([
        packagesApi.getPackages(),
        user ? packagesApi.getMyPackages().catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ])
      setPackages(pkgsRes.data || pkgsRes || [])
      setMyPackages(myRes.data || [])
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

    const role = user.roleNames?.[0]?.toLowerCase() || '';
    if (['admin', 'mod', 'accountant'].includes(role)) {
      return toast.error('Nhân viên quản trị không thực hiện mua gói tải.');
    }

    if (window.confirm(`Bạn có chắc chắn muốn mua gói "${pkg.name}" với giá ${formatBalance(pkg.price)}? Tiền sẽ được trừ vào Ví Thanh toán.`)) {
      setBuying(pkg.package_id || pkg.id)
      try {
        const res = await packagesApi.buyPackage(pkg.package_id || pkg.id)
        toast.success(res.message || `Mua gói "${pkg.name}" thành công!`)
        // Refresh lại danh sách gói của user
        await fetchPackages()
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Mua gói thất bại. Hãy kiểm tra lại số dư Ví thanh toán.')
      } finally {
        setBuying(null)
      }
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  if (loading) return <div className="py-24 text-center">Đang tải danh sách gói...</div>

  const activePackage = myPackages.find(p => p.status === 'ACTIVE')
  const pendingPackages = myPackages.filter(p => p.status === 'PENDING')

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
          <PackageOpen className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-heading text-foreground mb-4">Các gói tải tài liệu</h1>
        <p className="text-lg text-muted-foreground">
          Nâng cấp trải nghiệm học tập của bạn với các gói lượt tải tiết kiệm. Mua 1 lần, tải bất kỳ tài liệu nào trên hệ thống.
        </p>
      </div>

      {/* ── My Packages Panel (hiển thị nếu user đăng nhập và có gói) ── */}
      {user && myPackages.length > 0 && (
        <div className="mb-12 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border bg-primary/5 flex items-center gap-3">
            <PackageOpen className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground text-lg">Gói của bạn</h2>
          </div>

          <div className="divide-y divide-border">
            {myPackages.map((up, idx) => (
              <div
                key={up.userPackageId}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${up.status === 'ACTIVE' ? 'bg-white' : 'bg-secondary/30'
                  }`}
              >
                <div className="flex items-start gap-4">
                  {/* Queue badge */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${up.status === 'ACTIVE'
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                    {up.status === 'ACTIVE' ? <Zap className="w-5 h-5" /> : `#${idx + 1}`}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{up.name}</span>
                      {up.status === 'ACTIVE' ? (
                        <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">
                          Đang hoạt động
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium flex items-center gap-1">
                          <Hourglass className="w-3 h-3" /> Đang chờ kích hoạt
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {/* Lượt tải còn lại */}
                      <span className="flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />
                        <strong className="text-foreground">{up.turnsRemaining}</strong>/{up.totalTurns} lượt
                      </span>

                      {/* Hạn dùng */}
                      {up.status === 'ACTIVE' && up.expiresAt ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Hết hạn: <strong className="text-foreground">{formatDate(up.expiresAt)}</strong>
                          <span className="text-warning">({getDaysLeft(up.expiresAt)} ngày nữa)</span>
                        </span>
                      ) : up.status === 'PENDING' ? (
                        <span className="flex items-center gap-1 text-muted-foreground italic">
                          <RefreshCw className="w-3.5 h-3.5" />
                          Tự kích hoạt khi gói trước hết hạn / hết lượt
                        </span>
                      ) : null}
                    </div>

                    {/* Progress bar cho lượt tải */}
                    {up.status === 'ACTIVE' && (
                      <div className="mt-2 w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(up.turnsRemaining / up.totalTurns) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Mua lúc {formatDate(up.purchasedAt)}
                </span>
              </div>
            ))}
          </div>

          {pendingPackages.length > 0 && (
            <div className="px-5 py-3 bg-primary/5 border-t border-primary/10 text-xs text-primary flex items-center gap-2">
              <Hourglass className="w-3.5 h-3.5 shrink-0" />
              Bạn có <strong>{pendingPackages.length}</strong> gói đang chờ kích hoạt trong hàng chờ. Các gói sẽ tự động bắt đầu đếm ngày hạn khi gói trước kết thúc.
            </div>
          )}
        </div>
      )}

      {/* ── Package List ── */}
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
                        <span className="text-xs block text-muted-foreground/70">(tính từ lúc kích hoạt)</span>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className={`p-1 rounded-full mt-0.5 ${isPopular ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'}`}>
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="text-muted-foreground leading-snug">
                        Áp dụng cho mọi tài liệu miễn phí trên hệ thống
                      </span>
                    </li>
                  </ul>
                </div>

                {user ? (
                  <button
                    onClick={() => handleBuy(pkg)}
                    disabled={buying === (pkg.package_id || pkg.id)}
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all ${isPopular
                      ? 'bg-primary text-white hover:bg-primary-hover shadow-lg disabled:bg-primary/50'
                      : 'bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:bg-muted disabled:text-muted-foreground'
                      }`}
                  >
                    {buying === (pkg.package_id || pkg.id)
                      ? 'Đang xử lý...'
                      : activePackage ? 'Thêm vào hàng chờ' : 'Mua gói ngay'}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className={`w-full py-4 rounded-xl font-bold text-base text-center transition-all block ${isPopular
                      ? 'bg-primary text-white hover:bg-primary-hover shadow-lg'
                      : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                      }`}
                  >
                    Đăng nhập để mua
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
