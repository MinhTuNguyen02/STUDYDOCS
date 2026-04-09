import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin.api'
import { formatPrice } from '@/utils/format'
import { Cuboid, Plus, Edit2, Trash2, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Package {
  package_id: number
  name: string
  description: string | null
  price: number
  download_turns: number
  duration_days: number
  status: string
  created_at: string
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    download_turns: 0,
    duration_days: 0,
    is_active: true
  })

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getPackages()
      setPackages(res.data || res)
    } catch (error) {
      toast.error('Lỗi khi tải danh sách gói')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg)
      setFormData({
        name: pkg.name,
        description: pkg.description || '',
        price: Number(pkg.price),
        download_turns: pkg.download_turns,
        duration_days: pkg.duration_days,
        is_active: pkg.status === 'ACTIVE'
      })
    } else {
      setEditingPackage(null)
      setFormData({
        name: '',
        description: '',
        price: 0,
        download_turns: 10,
        duration_days: 30,
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.price < 0 || formData.download_turns < 1 || formData.duration_days < 1) {
      toast.error('Vui lòng nhập số liệu không âm và lớn hơn 0 cho lượt tải/thời hạn')
      return;
    }

    try {
      if (editingPackage) {
        await adminApi.updatePackage(editingPackage.package_id, formData)
        toast.success('Cập nhật gói thành công')
      } else {
        await adminApi.createPackage(formData)
        toast.success('Thêm gói mới thành công')
      }
      setIsModalOpen(false)
      fetchPackages()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deletePackage(id) // Note: This should ideally be a soft delete from the backend
      toast.success('Đã ẩn gói (Soft Delete)')
      setDeleteConfirm(null)
      fetchPackages()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Lỗi khi xóa/ẩn gói')
      setDeleteConfirm(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Cuboid className="w-6 h-6 text-primary" /> Quản lý Gói Bán
          </h1>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn bg-primary text-white hover:bg-primary-hover px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-semibold shadow-sm shrink-0"
        >
          <Plus className="w-5 h-5" /> Thêm Gói mới
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Đang tải danh sách packages...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl">Mã</th>
                  <th className="px-6 py-4">Tên gói</th>
                  <th className="px-6 py-4">Mức giá</th>
                  <th className="px-6 py-4">Quyền lợi</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-right rounded-tr-2xl">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {packages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">Chưa có gói bán nào.</td>
                  </tr>
                ) : (
                  packages.map((pkg) => (
                    <tr key={pkg.package_id} className={`hover:bg-muted/50 transition-colors ${pkg.status !== 'ACTIVE' ? 'opacity-50 grayscale' : ''}`}>
                      <td className="px-6 py-4 font-medium text-muted-foreground">#{pkg.package_id}</td>
                      <td className="px-6 py-4 font-bold text-lg text-primary">{pkg.name}</td>
                      <td className="px-6 py-4 font-mono font-bold text-orange-600">{formatPrice(pkg.price)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-xs font-semibold">
                          <span className="bg-muted px-2 py-1 rounded w-fit">+ {pkg.download_turns} lượt tải</span>
                          <span className="bg-muted px-2 py-1 rounded w-fit">HSD: {pkg.duration_days} ngày</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {pkg.status === 'ACTIVE' ? (
                          <div className="flex justify-center items-center gap-1 text-success font-bold text-xs bg-success/10 py-1 px-2 rounded-full border border-success/20 w-fit mx-auto">
                            <ShieldCheck className="w-3.5 h-3.5" /> HOẠT ĐỘNG
                          </div>
                        ) : (
                          <div className="flex justify-center items-center gap-1 text-danger font-bold text-xs bg-danger/10 py-1 px-2 rounded-full border border-danger/20 w-fit mx-auto">
                            <ShieldAlert className="w-3.5 h-3.5" /> BỊ ẨN
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        {deleteConfirm === pkg.package_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-danger font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Ẩn gói này?
                            </span>
                            <button onClick={() => handleDelete(pkg.package_id)} className="px-3 py-1 bg-danger text-white rounded-md text-xs font-bold hover:bg-red-600 transition">Có</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-muted text-foreground rounded-md text-xs font-bold hover:bg-gray-200 transition">Không</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(pkg)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors tooltip-trigger" title="Sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(pkg.package_id)}
                              className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors tooltip-trigger" title="Ngừng bán"
                              disabled={pkg.status !== 'ACTIVE'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold font-heading flex items-center gap-2">
                <Cuboid className="w-5 h-5 text-primary" />
                {editingPackage ? 'Cập nhật Gói Bán' : 'Tạo Gói Bán Mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                Đóng
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Tên Gói <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold"
                  placeholder="Ví dụ: Gói Sinh Viên VIP"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Giá bán (VNĐ) <span className="text-danger">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-foreground">Số lượt tải (Turns) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={formData.download_turns}
                    onChange={e => setFormData({ ...formData, download_turns: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-foreground">Số ngày duy trì (Days) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={formData.duration_days}
                    onChange={e => setFormData({ ...formData, duration_days: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Mô tả ngắn</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none h-20"
                  placeholder="Khuyến mãi tốt nhất dành cho..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2 pb-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-foreground cursor-pointer">Cho phép mở bán gói này trên Public Store</label>
              </div>

              <div className="pt-4 flex gap-3 border-t border-border mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold transition-colors">
                  Hủy
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors shadow-sm shadow-primary/30">
                  {editingPackage ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
