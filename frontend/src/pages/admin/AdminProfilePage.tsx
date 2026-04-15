import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usersApi } from '@/api/users.api'
import { User, Lock, Save, Edit3, X, UserIcon, Mail, Calendar, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/utils/format'

export default function AdminProfilePage() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<any>(null)

  const [isEditingName, setIsEditingName] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'INFO' | 'PASSWORD'>('INFO')

  const [fullName, setFullName] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const uRes = await usersApi.getMe().catch(() => null)
      const data = uRes?.data || uRes
      setProfile(data || user)
      setFullName(data?.full_name || data?.fullName || user?.fullName || '')
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
      // Updates standard auth context if it exists
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

  if (loading) return <div className="py-24 text-center">Đang tải...</div>

  const roleName = profile?.accounts?.roles?.[0]?.name || user?.roleNames?.[0] || 'Staff'

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold font-heading">Trang Cá Nhân</h1>
        <p className="text-muted-foreground text-sm mt-1">Quản lý thông tin và bảo mật tài khoản quản trị.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Left Sidebar ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full bg-linear-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center font-bold text-3xl shadow-inner border-4 border-background">
                {profile?.full_name?.charAt(0)?.toUpperCase() || user?.fullName?.charAt(0)?.toUpperCase()}
              </div>
              <div className="absolute bottom-0 right-0 bg-success text-white rounded-full p-1 border-2 border-background" title="Tài khoản Admin/Staff">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1 font-heading text-center">
              {profile?.full_name || user?.fullName}
            </h2>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase mb-2 tracking-wide">
              {roleName}
            </span>
          </div>

          <nav className="bg-card border border-border rounded-2xl p-2 shadow-sm flex flex-col">
            <button
              onClick={() => setActiveTab('INFO')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'INFO' ? 'bg-primary text-white shadow-md' : 'text-foreground hover:bg-muted'}`}
            >
              <User className="w-5 h-5" /> Thông tin cá nhân
            </button>

            <button
              onClick={() => setActiveTab('PASSWORD')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'PASSWORD' ? 'bg-primary text-white shadow-md' : 'text-foreground hover:bg-muted'}`}
            >
              <Lock className="w-5 h-5" /> Đổi mật khẩu
            </button>
          </nav>
        </div>

        {/* ── Right Content ── */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm min-h-[400px]">

            {/* INFO TAB */}
            {activeTab === 'INFO' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-xl font-bold font-heading border-b border-border pb-4">Hồ sơ cá nhân</h2>
                
                <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-lg">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Ngày tham gia
                    </label>
                    <div className="px-4 py-3 bg-muted rounded-xl text-muted-foreground cursor-not-allowed">
                      {formatDate(profile?.accounts?.created_at)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email
                    </label>
                    <div className="px-4 py-3 bg-muted rounded-xl text-muted-foreground cursor-not-allowed">
                      {profile?.accounts?.email || user?.email}
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
                          if (isEditingName) setFullName(profile?.full_name || user?.fullName || '');
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
              </div>
            )}

            {/* PASSWORD TAB */}
            {activeTab === 'PASSWORD' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-lg">
                <h2 className="text-xl font-bold font-heading border-b border-border pb-4">Đổi Mật Khẩu</h2>
                <form onSubmit={handleChangePassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Mật khẩu mới</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      required minLength={6}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      required minLength={6}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <button type="submit" disabled={isSubmitting} className="w-full btn bg-foreground text-background hover:bg-foreground/90 rounded-xl py-3 mt-4 text-base cursor-pointer">
                    {isSubmitting ? 'Đang xử lý...' : 'Cập nhật Mật khẩu'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
