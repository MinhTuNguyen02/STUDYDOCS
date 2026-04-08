import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  accountId: number
  customerId?: number
  staffId?: number
  email: string
  fullName: string
  roleNames: string[]
  status: string
  isPhoneVerified?: boolean
  hasUploadedDocument?: boolean
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  loginTimestamp: number | null

  login(data: { accessToken: string; refreshToken: string; user: AuthUser }): void
  logout(): void
  setTokens(accessToken: string, refreshToken: string): void
  updateUser(partial: Partial<AuthUser>): void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      loginTimestamp: null,

      login: ({ accessToken, refreshToken, user }) =>
        set({
          accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
          loginTimestamp: Date.now(),
        }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          loginTimestamp: null,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    {
      name: 'studydocs-auth',
    }
  )
)
