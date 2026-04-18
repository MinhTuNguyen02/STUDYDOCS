import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from './authStore'
import api from '@/api/client'
import toast from 'react-hot-toast'

export interface Notification {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  referenceId?: number
  referenceType?: string
  createdAt: string
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  socket: Socket | null
  isConnected: boolean
  isLoading: boolean
  hasMore: boolean
  page: number

  connect: () => void
  disconnect: () => void
  fetchInitial: () => Promise<void>
  fetchMore: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  addNotification: (notification: Notification) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  socket: null,
  isConnected: false,
  isLoading: false,
  hasMore: true,
  page: 1,

  connect: () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    // Avoid multiple connections
    if (get().socket?.connected) return;

    const socket = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[NotificationStore] Socket connected');
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('[NotificationStore] Socket disconnected');
      set({ isConnected: false });
    });

    socket.on('notification', (payload: any) => {
      console.log('[NotificationStore] Received notification:', payload);
      const newNotif: Notification = {
        id: payload.id || Date.now(), // Fallback if backend doesn't send ID initially
        type: payload.type,
        title: payload.title,
        message: payload.message,
        isRead: false,
        referenceId: payload.referenceId,
        referenceType: payload.referenceType,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      
      // Hiển thị toast popup ở góc phải dưới hoặc trên
      toast(
        (t) => (
          <div className="flex flex-col gap-1">
            <span className="font-bold text-sm text-primary">{newNotif.title}</span>
            <span className="text-xs text-foreground/80">{newNotif.message}</span>
          </div>
        ),
        { 
          icon: '🔔',
          duration: 5000,
          position: 'bottom-right',
        }
      );

      get().addNotification(newNotif);
    });

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  fetchInitial: async () => {
    try {
      set({ isLoading: true, page: 1, hasMore: true });
      const [notifsRes, countRes] = await Promise.all([
        api.get('/api/notifications?page=1&limit=20'),
        api.get('/api/notifications/unread-count')
      ]);
      
      set({ 
        notifications: notifsRes.data?.data?.data || [], 
        unreadCount: countRes.data?.data?.unreadCount || 0,
        hasMore: (notifsRes.data?.data?.data || []).length === 20,
        isLoading: false
      });
    } catch (error) {
      console.error('[NotificationStore] Fetch initial error:', error);
      set({ isLoading: false });
    }
  },

  fetchMore: async () => {
    if (!get().hasMore || get().isLoading) return;

    try {
      set({ isLoading: true });
      const nextPage = get().page + 1;
      const res = await api.get(`/api/notifications?page=${nextPage}&limit=20`);
      
      const newItems = res.data?.data?.data || [];
      set(state => ({
        notifications: [...state.notifications, ...newItems],
        page: nextPage,
        hasMore: newItems.length === 20,
        isLoading: false
      }));
    } catch (error) {
      console.error('[NotificationStore] Fetch more error:', error);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: number) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      set(state => ({
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('[NotificationStore] Mark read error:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/api/notifications/read-all');
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('[NotificationStore] Mark all read error:', error);
    }
  },

  addNotification: (notification: Notification) => {
    set(state => {
      // Check for duplicates just in case
      if (state.notifications.some(n => n.id === notification.id)) return state;
      
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1
      };
    });
  }
}));
