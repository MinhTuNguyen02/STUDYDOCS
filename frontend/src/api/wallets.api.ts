import api from './client'

export const walletsApi = {
  getMyWallets: async () => {
    const res = await api.get('/wallets/me')
    return res.data
  },
  getTransactions: async () => {
    const res = await api.get('/wallets/transactions/me')
    return res.data
  },
  requestWithdrawal: async (data: { amount: number, bankInfo: { bank: string, account: string, accountName: string } }) => {
    const res = await api.post('/wallets/withdrawals', data)
    return res.data
  },
  getWithdrawals: async () => {
    const res = await api.get('/wallets/withdrawals/me')
    return res.data
  }
}
