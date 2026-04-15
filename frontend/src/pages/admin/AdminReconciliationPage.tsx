import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin.api'
import { formatBalance, formatDateTime } from '@/utils/format'
import { CheckCircle2, AlertTriangle, ShieldCheck, Scale, Wallet, Landmark, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface ReconData {
  timestamp: string
  report: {
    totalFiatInBank_GATEWAY_POOL: number
    totalLiabilities_USER_WALLETS: number
    totalEquity_SYSTEM_REVENUE: number
    accountingEquation: string
    discrepancy: number
    isSystemSolvent: boolean
    isDoubleEntryMatched: boolean
  }
}

export default function AdminReconciliationPage() {
  const [data, setData] = useState<ReconData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReconciliation()
  }, [])

  const fetchReconciliation = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getReconciliation()
      setData(res)
    } catch (error) {
      toast.error('Không thể tải báo cáo đối soát')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-24 text-muted-foreground animate-pulse">Đang tải báo cáo đối soát tài chính...</div>
  }

  if (!data) {
    return <div className="text-center py-24 text-muted-foreground">Không có dữ liệu đối soát</div>
  }

  const { report, timestamp } = data

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
            <Scale className="w-8 h-8 text-primary" /> Đối soát Tài chính
          </h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground font-semibold">Cập nhật lần cuối</p>
          <p className="text-sm font-mono mt-1 bg-muted px-3 py-1.5 rounded-lg border border-border">
            {formatDateTime(timestamp)}
          </p>
        </div>
      </div>

      {/* Trang thái đối soát */}
      <div className={`p-6 rounded-2xl mb-8 border ${report.isDoubleEntryMatched ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'} flex items-start gap-4 shadow-sm`}>
        {report.isDoubleEntryMatched ? (
          <ShieldCheck className="w-10 h-10 text-success shrink-0" />
        ) : (
          <AlertTriangle className="w-10 h-10 text-danger shrink-0" />
        )}
        <div>
          <h2 className={`text-xl font-bold font-heading ${report.isDoubleEntryMatched ? 'text-success' : 'text-danger'}`}>
            {report.isDoubleEntryMatched ? 'Khớp sổ tuyệt đối' : 'Báo động: Lệch sổ tài chính'}
          </h2>
          <p className="text-foreground/80 mt-1.5 leading-relaxed">
            Hệ thống ngân hàng của nền tảng đang <strong>{report.isSystemSolvent ? 'có khả năng thanh khoản 100%' : 'MẤT KHẢ NĂNG THANH KHOẢN'}</strong>.
            {/* Phương trình kế toán: <code className="bg-background px-2 py-0.5 rounded border border-border text-sm font-bold text-primary mx-1">{report.accountingEquation}</code> */}
          </p>

          {!report.isDoubleEntryMatched && (
            <div className="mt-4 p-4 bg-danger text-white rounded-xl font-mono text-sm shadow-inner shadow-black/20">
              <p>Mức chênh lệch (Discrepancy): Lệch sổ <strong>{formatBalance(Math.abs(report.discrepancy))}</strong>.</p>
              <p className="mt-1 opacity-80">Yêu cầu vô hiệu hoá các ví liên quan và kiểm tra Audit Logs ngay lập tức!</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">

        {/* Tài sản (Assets) */}
        <div className="bg-card border-2 border-primary/20 rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-3 bg-primary/10 rounded-xl text-primary"><Landmark className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Quỹ Ngân Hàng</h3>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Tài sản (Assets)</p>
            </div>
          </div>
          <p className="text-4xl font-black font-heading text-primary relative z-10">
            {formatBalance(report.totalFiatInBank_GATEWAY_POOL)}
          </p>
          <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 relative z-10">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tổng số tiền thực tế (Fiat) đang lưu trữ tại tài khoản ngân hàng của Nền tảng.
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-center font-black text-4xl text-muted-foreground/30 font-heading">
          {`=`}
        </div>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Nợ phải trả (Liabilities) */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600"><Wallet className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Ví Người Dùng</h3>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Nợ phải trả (Liabilities)</p>
              </div>
            </div>
            <p className="text-4xl font-black font-heading text-orange-600 relative z-10">
              {formatBalance(report.totalLiabilities_USER_WALLETS)}
            </p>
            <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 relative z-10">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tổng số tiền mà Hệ thống đang "mang nợ" người dùng có trong tất cả các ví hợp lệ.
              </p>
            </div>
          </div>

          {/* Vốn nền tảng (Equity/Revenue) */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600"><Scale className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Doanh Thu Hệ Thống</h3>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Vốn (Equity/Revenue)</p>
              </div>
            </div>
            <p className="text-4xl font-black font-heading text-emerald-600 relative z-10">
              {formatBalance(report.totalEquity_SYSTEM_REVENUE)}
            </p>
            <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 relative z-10">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tiền hoa hồng, phí dịch vụ đọng lại trên nền tảng đang giữ.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
