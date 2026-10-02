import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="min-h-[60vh] grid place-items-center p-6 text-center">
      <div className="space-y-4">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">404</p>
        <h1 className="text-3xl font-bold">Không tìm thấy trang</h1>
        <p className="text-muted-foreground">Đường dẫn có thể đã thay đổi hoặc không còn tồn tại.</p>
        <Link className="inline-flex btn bg-primary text-white px-5 py-3 rounded-xl" to="/">Về trang chủ</Link>
      </div>
    </main>
  )
}
