import { useEffect, useState, useRef } from 'react'
import { Bell, Check } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, hasMore, fetchMore } = useNotificationStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop === e.currentTarget.clientHeight
    if (bottom && hasMore) {
      fetchMore()
    }
  }

  const handleItemClick = (id: number) => {
    markAsRead(id)
    // Depending on the referenceType, we could optionally route the user.
    // E.g., if it's 'ORDER', navigate to /orders/{referenceId}.
    // This can be added later as an enhancement.
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        className="p-2 text-muted-foreground hover:bg-secondary rounded-full relative transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-pulse shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-border rounded-xl shadow-xl z-[100] overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-3 border-b border-border bg-secondary flex justify-between items-center shrink-0">
            <h3 className="font-bold text-foreground">Thông báo</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>

          <div 
            className="overflow-y-auto flex-1 p-2 space-y-1 bg-white"
            onScroll={handleScroll}
          >
            {notifications.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm flex flex-col items-center">
                <Bell className="w-8 h-8 opacity-20 mb-2" />
                <p>Bạn chưa có thông báo nào.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleItemClick(notif.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border-l-4 ${
                    notif.isRead 
                      ? 'bg-white border-transparent hover:bg-secondary/50' 
                      : 'bg-primary/5 border-primary hover:bg-primary/10 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className={`text-sm ${notif.isRead ? 'font-medium text-foreground' : 'font-bold text-primary'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: vi })}
                    </span>
                  </div>
                  <p className={`text-xs ${notif.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {notif.message}
                  </p>
                </div>
              ))
            )}
            
            {hasMore && (
              <div className="text-center p-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
