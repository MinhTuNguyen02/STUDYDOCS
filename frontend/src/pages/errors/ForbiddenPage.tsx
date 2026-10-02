import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <main className="min-h-[60vh] grid place-items-center p-6 text-center">
      <div className="space-y-4">
        <p className="text-sm font-bold uppercase tracking-widest text-warning">403</p>
        <h1 className="text-3xl font-bold">Bạn không có quyền truy cập</h1>
        <p className="text-muted-foreground">Tài khoản hiện tại không được phép mở trang này.</p>
        <Link className="inline-flex btn bg-primary text-white px-5 py-3 rounded-xl" to="/">Về trang chủ</Link>
      </div>
    </main>
  )
}
