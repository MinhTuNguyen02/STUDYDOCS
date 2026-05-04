import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usersApi } from '@/api/users.api'
import { authApi } from '@/api/auth.api'
import { walletsApi } from '@/api/wallets.api'
import { packagesApi } from '@/api/packages.api'
import { User, ShieldCheck, Mail, Phone, Lock, KeyRound, Save, AlertTriangle, CheckCircle2, Wallet, CreditCard, History, Clock, ArrowUpRight, ArrowDownRight, Download, Calendar, Edit3, UserIcon, X, PackageOpen, Zap, Hourglass, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import QRCode from 'react-qr-code'
import { formatBalance, formatDate } from '@/utils/format'
import { Link, useSearchParams } from 'react-router-dom'
import PhoneVerificationModal from '@/components/auth/PhoneVerificationModal'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<any>(null)

  const [isEditingName, setIsEditingName] = useState(false)

  // Wallets
  const [wallets, setWallets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])

  // My Packages queue
  const [myPackages, setMyPackages] = useState<any[]>([])

  // URL params
  const [searchParams, setSearchParams] = useSearchParams()
  const tabQuery = searchParams.get('tab')?.toUpperCase()

  const [loading, setLoading] = useState(true)

  // Tabs
  const [activeTab, setActiveTab] = useState<'INFO' | 'PASSWORD' | 'WALLET' | '2FA'>((tabQuery as any) || 'INFO')

  useEffect(() => {
    if (tabQuery && ['INFO', 'PASSWORD', 'WALLET', '2FA'].includes(tabQuery)) {
      setActiveTab(tabQuery as any)
    }
  }, [tabQuery])

  const handleTabChange = (tab: 'INFO' | 'PASSWORD' | 'WALLET' | '2FA') => {
    setActiveTab(tab)
    setSearchParams({ tab: tab.toLowerCase() })
  }

  // Forms
  const [fullName, setFullName] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  // Withdraw
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showWithdrawHistory, setShowWithdrawHistory] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', bank: '', account: '', accountName: '' })

  // 2FA
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string, qrCode: string } | null>(null)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)

  // Wallet Filters
  const [txWalletType, setTxWalletType] = useState<string>('ALL') // 'ALL' | 'PAYMENT' | 'REVENUE'
  const [txSign, setTxSign] = useState<string>('ALL') // 'ALL' | 'CREDIT' | 'DEBIT'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [uRes, wRes, tRes, wdRes, pkgRes] = await Promise.all([
        usersApi.getMe().catch(() => null),
        walletsApi.getMyWallets().catch(() => ({ data: [] })),
        walletsApi.getTransactions().catch(() => []),
        walletsApi.getWithdrawals().catch(() => ({ data: [] })),
        packagesApi.getMyPackages().catch(() => ({ data: [] }))
      ])

      const data = uRes?.data || uRes
      setProfile(data || user)
      setFullName(data?.full_name || data?.fullName || user?.fullName || '')

      setWallets(wRes?.data || [])
      setTransactions(tRes?.data || tRes || [])
      setWithdrawals(wdRes?.data || wdRes || [])
      setMyPackages(pkgRes?.data || [])
    } catch (err) {
      toast.error('Lỗi tải thông tin cá nhân')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEditingName) return

    setIsSubmitting(true)
    try {
      await usersApi.updateProfile({ fullName })
      toast.success('Cập nhật thông tin thành công')
      setIsEditingName(false)
      fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('Mật khẩu xác nhận không khớp')
    }
    setIsSubmitting(true)
    try {
      await usersApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      toast.success('Đổi mật khẩu thành công')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi đổi mật khẩu')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetup2FA = async () => {
    try {
      const res = await authApi.setup2FA()
      setTwoFaSetup(res.data || res)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tạo mã 2FA')
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!twoFaCode || twoFaCode.length !== 6) return toast.error('Mã gồm 6 chữ số')
    setIsSubmitting(true)
    try {
      await authApi.verify2FA(twoFaCode)
      toast.success('Kích hoạt 2FA thành công!')
      setTwoFaSetup(null)
      fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Mã xác nhận sai')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = Number(withdrawForm.amount)
    if (amountNum < 200000) return toast.error('Rút tối thiểu 200,000đ')
    if (!withdrawForm.bank || !withdrawForm.account || !withdrawForm.accountName) return toast.error('Vui lòng điền đủ thông tin ngân hàng')

    setIsSubmitting(true)
    try {
      await walletsApi.requestWithdrawal({
        amount: amountNum,
        bankInfo: {
          bank: withdrawForm.bank,
          account: withdrawForm.account,
          accountName: withdrawForm.accountName
        }
      })
      toast.success('Gửi yêu cầu rút tiền thành công')
      setShowWithdraw(false)
      fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi rút tiền')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return <div className="py-24 text-center">Đang tải...</div>

  const isGoogleLogin = profile?.accounts?.auth_provider === 'GOOGLE'
  const paymentWallet = wallets.find(w => w.wallet_type === 'PAYMENT' || w.walletType === 'PAYMENT')
  const revenueWallet = wallets.find(w => w.wallet_type === 'REVENUE' || w.walletType === 'REVENUE')

  const role = profile?.accounts?.roles?.[0]?.name || user?.roleNames?.[0] || '';
  const isStaff = ['admin', 'mod', 'accountant'].includes(role.toLowerCase());

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-4 gap-8">

      {/* ── Left Sidebar ── */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-full bg-linear-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center font-bold text-3xl shadow-inner border-4 border-background">
              {profile?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            {profile?.is_verified && (
              <div className="absolute bottom-0 right-0 bg-success text-white rounded-full p-1 border-2 border-background" title="Đã xác minh">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1 font-heading">{profile?.full_name}</h2>
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase mb-2 tracking-wide">
            {profile?.accounts?.roles?.[0]?.name || user?.roleNames?.[0] || 'Member'}
          </span>
        </div>

        <nav className="bg-card border border-border rounded-2xl p-2 shadow-sm flex flex-col gap-1">
          <button
            onClick={() => handleTabChange('INFO')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'INFO' ? 'bg-primary text-white shadow-md' : 'text-foreground hover:bg-muted'
              }`}
          >
            <User className="w-5 h-5" /> Thông tin cá nhân
          </button>

          {!isStaff && (
            <button
              onClick={() => handleTabChange('WALLET')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'WALLET' ? 'bg-primary text-white shadow-md' : 'text-foreground hover:bg-muted'
                }`}
            >
              <Wallet className="w-5 h-5" /> Quản lý ví tín dụng
            </button>
          )}

          {!isGoogleLogin && (
            <button
              onClick={() => handleTabChange('PASSWORD')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'PASSWORD' ? 'bg-primary text-white shadow-md' : 'text-foreground hover:bg-muted'
                }`}
            >
              <Lock className="w-5 h-5" /> Đổi mật khẩu
            </button>
          )}

          {/* <button
            onClick={() => setActiveTab('2FA')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === '2FA' ? 'bg-primary text-white shadow-md' : 'text-foreground hover:bg-muted'
              }`}
          >
            <KeyRound className="w-5 h-5" /> Bảo mật 2 lớp (2FA)
          </button> */}
        </nav>
      </div>

      {/* ── Right Content ── */}
      <div className="lg:col-span-3">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm min-h-[500px]">

          {/* INFO TAB */}
          {activeTab === 'INFO' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-bold font-heading border-b border-border pb-4">Thông tin cá nhân</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2"><Calendar className="w-4 h-4" /> Ngày tham gia</label>
                    <div className="px-4 py-3 bg-muted rounded-xl text-muted-foreground cursor-not-allowed">
                      {formatDate(profile?.accounts?.created_at)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> Email</label>
                    <div className="px-4 py-3 bg-muted rounded-xl text-muted-foreground cursor-not-allowed">
                      {profile?.accounts?.email}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Số điện thoại
                    </label>
                    <div className="flex gap-2 relative">
                      <input
                        type="text"
                        value={profile?.phone_number || ''}
                        disabled
                        className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none cursor-not-allowed"
                      />
                      {!profile?.is_phone_verified && (
                        <button onClick={(e) => { e.preventDefault(); setShowPhoneModal(true); }} className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-warning text-xs font-bold bg-warning/10 hover:bg-warning/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                          <AlertTriangle className="w-3.5 h-3.5" /> Xác minh ngay
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <UserIcon className="w-4 h-4" /> Họ và Tên
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingName) setFullName(profile?.full_name || ''); // Reset nếu hủy
                          setIsEditingName(!isEditingName);
                        }}
                        className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                      >
                        {isEditingName ? (
                          <><X className="w-3 h-3" /> Hủy</>
                        ) : (
                          <><Edit3 className="w-3 h-3" /> Chỉnh sửa</>
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={!isEditingName}
                        required
                        className={`w-full px-4 py-3 border rounded-xl transition-all outline-none ${isEditingName
                          ? 'bg-background border-primary ring-2 ring-primary/10 shadow-sm'
                          : 'bg-muted border-border text-muted-foreground cursor-not-allowed'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Nút lưu chỉ hiện hoặc có hiệu lực khi đang ở chế độ chỉnh sửa */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !isEditingName}
                    className={`w-full btn rounded-xl py-3 flex justify-center items-center gap-2 mt-4 text-base shadow-lg transition-all ${isEditingName
                      ? 'bg-primary text-white hover:bg-primary-hover cursor-pointer'
                      : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                      }`}
                  >
                    <Save className="w-5 h-5" />
                    {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                  </button>
                </form>

                {/* Right side: Packages & Downloads */}
                {!isStaff && (
                  <div className="space-y-6">
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Download className="w-6 h-6 text-primary" />
                        <h3 className="font-bold text-lg">Lượt tải miễn phí</h3>
                      </div>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-4xl font-bold font-heading text-primary">{profile?.free_downloads_remaining ?? 0}/4</span>
                        <span className="text-muted-foreground">lượt</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Làm mới vào ngày {profile?.free_downloads_reset_at ? formatDate(profile.free_downloads_reset_at) : 'mỗi tháng'}.
                      </p>
                    </div>
                    <div className="bg-muted/50 border border-border rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <PackageOpen className="w-5 h-5 text-primary" />
                        <h3 className="font-bold">Quản lý Gói đăng ký</h3>
                      </div>

                      {myPackages.length === 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground mb-4">Bạn chưa đăng ký gói lượt tải nào.</p>
                          <Link to="/packages">
                            <button className="btn w-full border border-border bg-background hover:bg-muted text-sm py-2 rounded-xl text-foreground font-semibold">Xem tất cả gói tải</button>
                          </Link>
                        </>
                      ) : (
                        <div className="space-y-3">
                          {myPackages.map((up: any, idx: number) => {
                            const isActive = up.status === 'ACTIVE'
                            const daysLeft = up.expiresAt
                              ? Math.max(0, Math.ceil((new Date(up.expiresAt).getTime() - Date.now()) / 86400000))
                              : null
                            const progress = Math.round((up.turnsRemaining / up.totalTurns) * 100)

                            return (
                              <div
                                key={up.userPackageId}
                                className={`rounded-xl p-4 border ${isActive
                                    ? 'bg-background border-primary/30 shadow-sm'
                                    : 'bg-muted/40 border-border'
                                  }`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    {isActive
                                      ? <Zap className="w-4 h-4 text-success" />
                                      : <Hourglass className="w-4 h-4 text-muted-foreground" />
                                    }
                                    <span className="font-semibold text-sm text-foreground">{up.name}</span>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {isActive ? 'Đang dùng' : `#${idx + 1} Chờ kích hoạt`}
                                  </span>
                                </div>

                                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                  <span><strong className="text-foreground">{up.turnsRemaining}</strong>/{up.totalTurns} lượt còn lại</span>
                                  {isActive && daysLeft !== null && (
                                    <span className="text-warning font-medium">Còn {daysLeft} ngày</span>
                                  )}
                                  {!isActive && (
                                    <span className="flex items-center gap-1 italic">
                                      <RefreshCw className="w-3 h-3" /> Tự kích hoạt
                                    </span>
                                  )}
                                </div>

                                {isActive && (
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          <Link to="/packages">
                            <button className="btn w-full border border-border bg-background hover:bg-muted text-sm py-2 rounded-xl text-foreground font-semibold mt-1">Mua thêm gói</button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASSWORD TAB */}
          {activeTab === 'PASSWORD' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-lg mx-auto">
              <h2 className="text-2xl font-bold font-heading border-b border-border pb-4 text-center">Đổi Mật Khẩu</h2>
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Mật khẩu mới</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required minLength={6}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required minLength={6}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full btn bg-foreground text-background hover:bg-foreground/90 rounded-xl py-3 mt-4 text-base cursor-pointer">
                  {isSubmitting ? 'Đang xử lý...' : 'Cập nhật Mật khẩu'}
                </button>
              </form>
            </div>
          )}

          {/* WALLET TAB */}
          {activeTab === 'WALLET' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-2xl font-bold font-heading mb-6 flex items-center gap-2">
                <Wallet className="w-6 h-6 text-primary" /> Quản lý ví tín dụng
              </h1>

              {/* Wallet Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-linear-to-br from-indigo-500 to-primary p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <CreditCard className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-white/80 font-medium mb-1 flex items-center gap-2">Ví Thanh Toán</h3>
                    <p className="text-3xl font-bold font-heading mb-6 tracking-tight">{formatBalance(paymentWallet?.balance || 0)}</p>
                    <button className="btn bg-white/20 text-white cursor-not-allowed w-full rounded-xl shadow-sm text-sm" disabled>
                      (Nạp tiền qua thanh Header)
                    </button>
                  </div>
                </div>

                <div className="bg-background border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-muted-foreground font-medium mb-1">Ví Doanh Thu</h3>
                    <div className="flex items-end gap-3 mb-6">
                      <p className="text-3xl font-bold font-heading text-foreground tracking-tight">{formatBalance(revenueWallet?.balance || 0)}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <button onClick={() => setShowWithdraw(true)} className="btn bg-foreground text-background hover:bg-foreground/90 w-full rounded-xl cursor-pointer">
                      Rút tiền về NH
                    </button>
                    <button onClick={() => setShowWithdrawHistory(true)} className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      Xem lịch sử rút tiền
                    </button>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="border border-border rounded-1xl shadow-sm mt-8 overflow-hidden rounded-2xl">
                <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center flex-wrap gap-4">
                  <h3 className="font-bold flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Lịch sử giao dịch</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={txWalletType}
                      onChange={(e) => setTxWalletType(e.target.value)}
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-medium"
                    >
                      <option value="ALL">Tất cả ví</option>
                      <option value="PAYMENT">Ví thanh toán</option>
                      <option value="REVENUE">Ví doanh thu</option>
                    </select>

                    <select
                      value={txSign}
                      onChange={(e) => setTxSign(e.target.value)}
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-medium"
                    >
                      <option value="ALL">Tất cả loại giao dịch</option>
                      <option value="CREDIT">Tiền vào (+)</option>
                      <option value="DEBIT">Tiền ra (-)</option>
                    </select>

                    {(txWalletType !== 'ALL' || txSign !== 'ALL') && (
                      <button
                        onClick={() => { setTxWalletType('ALL'); setTxSign('ALL'); }}
                        className="text-danger flex items-center gap-1 text-sm font-semibold hover:bg-danger/10 px-2 py-1.5 rounded-lg transition-colors"
                        title="Xóa lọc"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {(() => {
                    const filteredTransactions = transactions.filter(tx => {
                      let wMatch = true
                      let sMatch = true
                      if (txWalletType !== 'ALL') wMatch = (tx.walletType || tx.wallet_type) === txWalletType
                      if (txSign !== 'ALL') {
                        const isCredit = !!tx.credit && tx.credit > 0
                        if (txSign === 'CREDIT') sMatch = isCredit
                        if (txSign === 'DEBIT') sMatch = !isCredit
                      }
                      return wMatch && sMatch
                    })

                    if (filteredTransactions.length === 0) {
                      return <div className="text-center py-12 text-muted-foreground text-sm">Không tìm thấy giao dịch nào phù hợp.</div>
                    }

                    return (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-muted/50 text-muted-foreground text-xs border-b border-border uppercase tracking-wide">
                            <th className="p-3 font-semibold">Thời gian</th>
                            <th className="p-3 font-semibold">Giao dịch</th>
                            <th className="p-3 font-semibold">Ví</th>
                            <th className="p-3 font-semibold text-right">Biến động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredTransactions.map((tx: any, idx) => {
                            const isCredit = !!tx.credit && tx.credit > 0
                            const amount = isCredit ? tx.credit : tx.debit
                            return (
                              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                <td className="p-3 text-sm text-muted-foreground">{formatDate(tx.createdAt || tx.created_at)}</td>
                                <td className="p-3 text-sm font-medium">{tx.transaction?.description || tx.description || 'Giao dịch'}</td>
                                <td className="p-3 text-sm font-semibold">
                                  <span className={`px-2 py-0.5 rounded-md text-xs ${tx.walletType === 'PAYMENT' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>{tx.walletType || tx.wallet_type}</span>
                                </td>
                                <td className="p-3 text-right font-bold w-32 shrink-0">
                                  {isCredit ? (
                                    <span className="text-success flex justify-end items-center gap-1"><ArrowUpRight className="w-4 h-4" /> +{formatBalance(amount)}</span>
                                  ) : (
                                    <span className="text-danger flex justify-end items-center gap-1"><ArrowDownRight className="w-4 h-4" /> -{formatBalance(amount)}</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* 2FA TAB */}
          {activeTab === '2FA' && (
            <div className="max-w-lg mx-auto text-center space-y-6 pt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold font-heading">Bảo vệ 2 lớp (2FA)</h2>

              {profile?.accounts?.is_2fa_enabled ? (
                <div className="p-6 bg-success/10 border border-success/30 rounded-2xl flex flex-col items-center">
                  <CheckCircle2 className="w-12 h-12 text-success mb-2" />
                  <h3 className="font-bold text-success text-lg">2FA đã được kích hoạt</h3>
                  <p className="text-sm text-muted-foreground mt-2">Tài khoản của bạn đang được bảo vệ an toàn bằng xác thực 2 lớp.</p>
                </div>
              ) : (
                <>
                  {!twoFaSetup ? (
                    <>
                      <p className="text-muted-foreground leading-relaxed text-sm">
                        Chặn truy cập trái phép bằng cách yêu cầu mã xác nhận mỗi khi đăng nhập. Sử dụng ứng dụng Google Authenticator hoặc Authy, Microsoft Authenticator.
                      </p>
                      <button onClick={handleSetup2FA} className="btn bg-primary text-white hover:bg-primary-hover px-8 py-3 rounded-xl shadow-lg mt-4 cursor-pointer">
                        Thiết lập 2FA ngay
                      </button>
                    </>
                  ) : (
                    <form onSubmit={handleVerify2FA} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <p className="text-sm font-semibold bg-warning/10 text-warning p-4 rounded-xl border border-warning/20">
                        Hãy mở ứng dụng Authenticator và quét mã QR Code dưới đây để kích hoạt.
                      </p>
                      <div className="p-4 bg-white rounded-2xl inline-block shadow-md border border-border border-dashed mx-auto">
                        <QRCode value={twoFaSetup.qrCode || twoFaSetup.secret} size={200} />
                      </div>
                      <div className="text-xs font-mono bg-muted p-2 rounded-lg text-muted-foreground select-all cursor-pointer">
                        Secret Key: {twoFaSetup.secret}
                      </div>

                      <div className="space-y-2 text-left mt-6">
                        <label className="text-sm font-semibold text-foreground">Mã xác nhận (6 số)</label>
                        <input
                          type="text"
                          value={twoFaCode}
                          onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                          placeholder="000000"
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-center font-mono text-2xl tracking-[0.5em]"
                          required
                        />
                      </div>
                      <button type="submit" disabled={isSubmitting} className="w-full btn bg-success text-white hover:bg-green-600 rounded-xl py-3 text-base shadow-lg cursor-pointer">
                        {isSubmitting ? 'Đang xác nhận...' : 'Xác nhận & Kích hoạt'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals for Wallet */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-w-[320px]">
          <div className="bg-card rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-bold text-lg">Rút tiền về Ngân hàng</h3>
              <button onClick={() => setShowWithdraw(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleWithdraw} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Số tiền rút (VNĐ)</label>
                <input
                  type="number" value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  placeholder="Tối thiểu 200,000" required
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Ngân hàng</label>
                <input
                  type="text" value={withdrawForm.bank} onChange={(e) => setWithdrawForm({ ...withdrawForm, bank: e.target.value })}
                  placeholder="VD: Vietcombank, MB Bank..." required
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Số tài khoản</label>
                  <input
                    type="text" value={withdrawForm.account} onChange={(e) => setWithdrawForm({ ...withdrawForm, account: e.target.value })}
                    placeholder="VD: 0123456789" required
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Chủ tài khoản</label>
                  <input
                    type="text" value={withdrawForm.accountName} onChange={(e) => setWithdrawForm({ ...withdrawForm, accountName: e.target.value.toUpperCase() })}
                    placeholder="VD: NGUYEN VAN A" required
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none uppercase"
                  />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full btn bg-foreground text-background hover:bg-foreground/90 mt-4 rounded-xl py-3 text-base cursor-pointer">
                {isSubmitting ? 'Đang xử lý...' : 'Tạo yêu cầu rút tiền'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showWithdrawHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
              <h3 className="font-bold text-lg">Lịch sử rút tiền</h3>
              <button onClick={() => setShowWithdrawHistory(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              {withdrawals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Bạn chưa có lệnh rút tiền nào.</div>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map((w, i) => (
                    <div key={i} className="flex flex-col sm:flex-row justify-between p-4 border border-border rounded-xl bg-muted/20">
                      <div>
                        <div className="font-bold text-foreground mb-1">{formatBalance(w.amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {w.bank_info.bank} - {w.bank_info.account} ({w.bank_info.accountName})
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">{formatDate(w.createdAt || w.created_at)}</div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex flex-col items-start sm:items-end justify-center">
                        {w.status === 'PENDING' && <span className="bg-warning/10 text-warning px-3 py-1 rounded-md text-xs font-bold uppercase">Chờ xử lý</span>}
                        {w.status === 'PAID' && <span className="bg-success/10 text-success px-3 py-1 rounded-md text-xs font-bold uppercase">Đã thanh toán</span>}
                        {w.status === 'REJECTED' && <span className="bg-danger/10 text-danger px-3 py-1 rounded-md text-xs font-bold uppercase">Từ chối</span>}
                        {w.status === 'REJECTED' && w.note && <div className="text-xs text-danger mt-1">Lý do: {w.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPhoneModal && (
        <PhoneVerificationModal onClose={() => { setShowPhoneModal(false); fetchData(); }} />
      )}

    </div>
  )
}
