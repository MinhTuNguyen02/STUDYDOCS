import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="min-h-screen grid place-items-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-danger">Đã xảy ra lỗi</p>
          <h1 className="text-3xl font-bold">Không thể hiển thị trang này</h1>
          <p className="text-muted-foreground">Vui lòng tải lại trang. Nếu lỗi tiếp diễn, hãy thử lại sau.</p>
          <button className="btn bg-primary text-white px-5 py-3 rounded-xl" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      </main>
    )
  }
}
