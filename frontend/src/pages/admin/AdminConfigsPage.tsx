import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin.api'
import { Settings, Save, Edit2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Config {
  config_key: string
  config_value: string
  description: string | null
  updated_at: string
}

export default function AdminConfigsPage() {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)

  // Edit Mode state
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // Create / Update Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ key: '', value: '', description: '' })

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getConfigs()
      setConfigs(res.data || [])
    } catch (error) {
      toast.error('Lỗi khi tải cấu hình hệ thống')
    } finally {
      setLoading(false)
    }
  }

  const handleEditInline = (config: Config) => {
    setEditingKey(config.config_key)
    setEditValue(config.config_value)
  }

  const handleSaveInline = async (key: string) => {
    if (!editValue.trim()) {
      toast.error('Giá trị không được để trống')
      return
    }

    try {
      await adminApi.updateConfig(key, { value: editValue })
      toast.success('Cập nhật thành công')
      setEditingKey(null)
      fetchConfigs()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.key || !formData.value) {
      toast.error('Vui lòng nhập Key và Value')
      return
    }

    // Since we only have updateConfig which works as upsert in backend:
    try {
      await adminApi.updateConfig(formData.key, {
        value: formData.value,
        description: formData.description
      })
      toast.success('Thêm tham số thành công')
      setFormData({ key: '', value: '', description: '' })
      setIsModalOpen(false)
      fetchConfigs()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Cấu hình Hệ thống
          </h1>
        </div>
        <button
          onClick={() => {
            setFormData({ key: '', value: '', description: '' })
            setIsModalOpen(true)
          }}
          className="btn bg-primary text-white hover:bg-primary-hover px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-semibold shadow-sm"
        >
          <Settings className="w-5 h-5" /> Thêm cấu hình
        </button>
      </div>

      <div className="bg-orange-500/10 border border-orange-500/20 text-orange-700 p-4 rounded-2xl mb-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold mb-1">Thận trọng khi thay đổi</p>
          <p>Các tham số ảnh hưởng trực tiếp đến luồng logic xử lý tài chính và nghiệp vụ. Thay đổi sai có thể dẫn đến lỗi hệ thống không thể nạp/rút tiền.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Đang tải cấu hình...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl w-1/4">Tham số (Key)</th>
                  <th className="px-6 py-4 w-1/4">Giá trị (Value)</th>
                  <th className="px-6 py-4 w-1/3">Mô tả</th>
                  <th className="px-6 py-4 text-right rounded-tr-2xl">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {configs.map((config) => (
                  <tr key={config.config_key} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground font-mono text-xs bg-muted/50 w-fit px-2 py-1 rounded inline-block">
                        {config.config_key}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(config.updated_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingKey === config.config_key ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-3 py-1.5 border border-primary/50 bg-background rounded-lg focus:outline-none focus:ring-2 ring-primary/20"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-primary">{config.config_value}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <span className="text-xs">{config.description || '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-right align-middle">
                      {editingKey === config.config_key ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSaveInline(config.config_key)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-success text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition"
                          >
                            <Save className="w-3.5 h-3.5" /> Lưu
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditInline(config)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors tooltip-trigger" title="Sửa tham số"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold font-heading flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Thêm Cấu hình Mới
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                Đóng
              </button>
            </div>

            <form onSubmit={handleCreateNew} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Khoá (Key) <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={e => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm"
                  placeholder="Ví dụ: COMMISSION_RATE"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Giá trị (Value) <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Ví dụ: 0.5"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold transition-colors">
                  Hủy
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors shadow-sm shadow-primary/30">
                  Thêm mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
