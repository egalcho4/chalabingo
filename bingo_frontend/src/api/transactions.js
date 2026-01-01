// transactionsAPI.js - Updated with all transaction endpoints
import api from './index';
const API_URL = import.meta.env.VITE_API_END_POINT

export const transactionsAPI = {
  // Payment Accounts
  getPaymentAccounts: () => api.get('/payment-accounts/'),
  
  // Get payment accounts with operation filter
  getPaymentAccountsForDeposit: () => 
    api.get('/payment-accounts/active_accounts/?operation=deposit'),
  
  getPaymentAccountsForWithdraw: () => 
    api.get('/payment-accounts/active_accounts/?operation=withdraw'),
  
  getMobilePaymentAccounts: (operation = 'deposit') => 
    api.get(`/payment-accounts/active_accounts/?operation=${operation}&account_type=mobile`),
  
  getBankPaymentAccounts: (operation = 'deposit') => 
    api.get(`/payment-accounts/active_accounts/?operation=${operation}&account_type=bank`),
  
  createPaymentAccount: (data) => {
    if (data instanceof FormData) {
      return api.post('/payment-accounts/', data);
    }
    return api.post('/payment-accounts/', data);
  },
  
  updatePaymentAccount: (id, data) => {
    if (data instanceof FormData) {
      return api.patch(`/payment-accounts/${id}/`, data);
    }
    return api.patch(`/payment-accounts/${id}/`, data);
  },
  
  deletePaymentAccount: (id) => api.delete(`/payment-accounts/${id}/`),
  
  togglePaymentAccountActive: (id) => 
    api.post(`/payment-accounts/${id}/toggle_active/`),
  
  getPublicPaymentAccounts: () => 
    api.get('/payment-accounts/public/'),
  
  getMyPaymentAccounts: () => 
    api.get('/payment-accounts/my_accounts/'),
  
  getAvailablePaymentMethods: () => 
    api.get('/payment-accounts/payment_methods/'),
  
  // Wallet
  getWallet: () => api.get('/wallet/my_wallet/'),
  
  getWalletTransactions: (params = {}) => 
    api.get('/wallet/my_transactions/', { params }),
  
  // Deposits
  getDeposits: (params = {}) => api.get('/deposits/', { params }),
  
  getMyDeposits: () => api.get('/deposits/my_deposits/'),
  
  createDeposit: async (formData) => {
    const token = localStorage.getItem('access_token');
    
    try {
      const response = await fetch(`${API_URL}/deposits/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw { response: { data, status: response.status } };
      }
      
      return { data };
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  },
  
  getDeposit: (id) => api.get(`/deposits/${id}/`),
  
  // Admin deposit actions
  approveDeposit: (id, notes = '') => {
    return api.post(`/deposits/${id}/approve/`, { notes })
      .catch(error => {
        // Fallback to FormData if JSON fails
        const formData = new FormData();
        formData.append('notes', notes);
        return api.post(`/deposits/${id}/approve/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      });
  },
  
  rejectDeposit: (id, notes = '') => {
    return api.post(`/deposits/${id}/reject/`, { notes })
      .catch(error => {
        const formData = new FormData();
        formData.append('notes', notes);
        return api.post(`/deposits/${id}/reject/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      });
  },
  
  // Withdraw Requests
  getWithdrawRequests: (params = {}) => api.get('/withdraw-requests/', { params }),
  
  getMyWithdrawRequests: () => api.get('/withdraw-requests/my_requests/'),
  
  createWithdrawRequest: (data) => api.post('/withdraw-requests/', data),
  
  getWithdrawRequest: (id) => api.get(`/withdraw-requests/${id}/`),
  
  cancelWithdrawRequest: (id) => api.post(`/withdraw-requests/${id}/cancel/`),
  
  // Withdrawal admin actions
  approveWithdraw: (id, notes = '') => {
    return api.post(`/withdraw-requests/${id}/approve/`, { notes });
  },
  
  rejectWithdraw: (id, notes = '') => {
    return api.post(`/withdraw-requests/${id}/reject/`, { notes });
  },
  
  // Transactions
  getTransactions: (params = {}) => api.get('/transactions/', { params }),
  
  getMyTransactions: (params = {}) => api.get('/transactions/my_transactions/', { params }),
  
  getTransaction: (id) => api.get(`/transactions/${id}/`),
  
  // Agents
  getAgents: (params = {}) => api.get('/agents/', { params }),
  
  getActiveAgents: () => api.get('/agents/active/'),
  
  createAgent: (data) => api.post('/agents/', data),
  
  updateAgent: (id, data) => api.patch(`/agents/${id}/`, data),
  
  deleteAgent: (id) => api.delete(`/agents/${id}/`),
  
  getAgentStats: (id) => api.get(`/agents/${id}/stats/`),
  
  // Users (for agent assignment)
  getUsers: (params = {}) => api.get('/users/', { params }),
  
  getPlayers: () => api.get('/users/?user_type=player'),
  
  assignAgentToPlayer: (playerId, agentId) => 
    api.post(`/users/${playerId}/assign_agent/`, { agent_id: agentId }),
  
  // Admin stats endpoints
  getAdminStats: (params = {}) => api.get('/admin/stats/', { params }),
  
  getQuickStats: () => api.get('/admin/quick-stats/'),
  
  getTransactionAnalytics: (days = 30) => 
    api.get(`/admin/transaction-analytics/?days=${days}`),
  
  getUserAnalytics: (days = 30) => 
    api.get(`/admin/user-analytics/?days=${days}`),
  
  getDepositAnalytics: (params = {}) => 
    api.get('/admin/deposit-analytics/', { params }),
  
  getWithdrawAnalytics: (params = {}) => 
    api.get('/admin/withdraw-analytics/', { params }),
  
  // Search functionality
  searchTransactions: (query, type = 'all') => 
    api.get(`/transactions/search/?q=${query}&type=${type}`),
  
  searchDeposits: (query) => 
    api.get(`/deposits/search/?q=${query}`),
  
  searchWithdrawRequests: (query) => 
    api.get(`/withdraw-requests/search/?q=${query}`),
  
  // Export endpoints
  exportTransactions: (params = {}) => 
    api.get('/transactions/export/', { params, responseType: 'blob' }),
  
  exportDeposits: (params = {}) => 
    api.get('/deposits/export/', { params, responseType: 'blob' }),
  
  exportWithdrawRequests: (params = {}) => 
    api.get('/withdraw-requests/export/', { params, responseType: 'blob' }),
  
  // Payment verification
  verifyPayment: (transactionId) => 
    api.post(`/payments/verify/${transactionId}/`),
  
  // Currency conversion rates (if applicable)
  getExchangeRates: () => api.get('/payments/exchange_rates/'),
};

// Alternative: Simple API wrapper with better error handling
export const walletAPI = {
  // Balance and wallet
  getBalance: async () => {
    try {
      const response = await api.get('/wallet/my_wallet/');
      return response.data?.balance || 0;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return 0;
    }
  },
  
  // Quick deposit - simplified
  quickDeposit: async (amount, paymentAccountId, proofImage) => {
    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('payment_account', paymentAccountId);
    if (proofImage) {
      formData.append('proof_image', proofImage);
    }
    
    return await transactionsAPI.createDeposit(formData);
  },
  
  // Quick withdraw - simplified
  quickWithdraw: async (amount, paymentAccountId, accountDetails = {}) => {
    const data = {
      amount,
      payment_account: paymentAccountId,
      ...accountDetails
    };
    
    return await transactionsAPI.createWithdrawRequest(data);
  },
  
  // Get filtered payment accounts based on operation and type
  getFilteredAccounts: async (operation = 'deposit', accountType = null) => {
    let url = `/payment-accounts/active_accounts/?operation=${operation}`;
    
    if (accountType === 'mobile') {
      url += '&account_type=mobile';
    } else if (accountType === 'bank') {
      url += '&account_type=bank';
    }
    
    try {
      const response = await api.get(url);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  },
  
  // Get transaction history with filters
  getTransactionHistory: async (filters = {}) => {
    const params = {
      page: filters.page || 1,
      page_size: filters.pageSize || 20,
      ordering: filters.ordering || '-created_at',
      ...filters
    };
    
    try {
      const response = await api.get('/transactions/my_transactions/', { params });
      return {
        data: response.data?.results || response.data || [],
        count: response.data?.count || 0,
        next: response.data?.next,
        previous: response.data?.previous
      };
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return { data: [], count: 0 };
    }
  },
  
  // Get deposit history
  getDepositHistory: async (filters = {}) => {
    const params = {
      page: filters.page || 1,
      page_size: filters.pageSize || 20,
      ordering: filters.ordering || '-created_at',
      ...filters
    };
    
    try {
      const response = await api.get('/deposits/my_deposits/', { params });
      return {
        data: response.data?.results || response.data || [],
        count: response.data?.count || 0
      };
    } catch (error) {
      console.error('Error fetching deposit history:', error);
      return { data: [], count: 0 };
    }
  },
  
  // Get withdrawal history
  getWithdrawalHistory: async (filters = {}) => {
    const params = {
      page: filters.page || 1,
      page_size: filters.pageSize || 20,
      ordering: filters.ordering || '-created_at',
      ...filters
    };
    
    try {
      const response = await api.get('/withdraw-requests/my_requests/', { params });
      return {
        data: response.data?.results || response.data || [],
        count: response.data?.count || 0
      };
    } catch (error) {
      console.error('Error fetching withdrawal history:', error);
      return { data: [], count: 0 };
    }
  },
  
  // Get stats summary
  getWalletStats: async (period = 'month') => {
    try {
      const response = await api.get(`/wallet/stats/?period=${period}`);
      return response.data || {};
    } catch (error) {
      console.error('Error fetching wallet stats:', error);
      return {};
    }
  },
  
  // Cancel pending withdrawal
  cancelWithdrawal: async (withdrawalId) => {
    try {
      const response = await api.post(`/withdraw-requests/${withdrawalId}/cancel/`);
      return response.data;
    } catch (error) {
      console.error('Error cancelling withdrawal:', error);
      throw error;
    }
  },
  
  // Upload proof for deposit
  uploadDepositProof: async (depositId, proofImage) => {
    const formData = new FormData();
    formData.append('proof_image', proofImage);
    
    try {
      const response = await api.patch(`/deposits/${depositId}/`, formData);
      return response.data;
    } catch (error) {
      console.error('Error uploading proof:', error);
      throw error;
    }
  },
};

// For React Query hooks
export const transactionQueries = {
  wallet: ['wallet'],
  walletStats: (period) => ['wallet-stats', period],
  paymentAccounts: ['payment-accounts'],
  depositAccounts: ['payment-accounts', 'deposit'],
  withdrawAccounts: ['payment-accounts', 'withdraw'],
  deposits: ['deposits'],
  myDeposits: ['my-deposits'],
  withdrawRequests: ['withdraw-requests'],
  myWithdrawRequests: ['my-withdraw-requests'],
  transactions: ['transactions'],
  myTransactions: ['my-transactions'],
  agents: ['agents'],
  users: ['users'],
  adminStats: ['admin-stats'],
  
  // With filters
  transactionsWithFilters: (filters) => ['transactions', filters],
  depositsWithFilters: (filters) => ['deposits', filters],
  withdrawsWithFilters: (filters) => ['withdraw-requests', filters],
};

// Helper functions for the frontend
export const transactionHelpers = {
  formatAmount: (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },
  
  formatDate: (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  getStatusColor: (status) => {
    switch(status) {
      case 'pending':
        return 'yellow';
      case 'approved':
      case 'completed':
        return 'green';
      case 'rejected':
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  },
  
  getStatusIcon: (status) => {
    switch(status) {
      case 'pending':
        return '⏳';
      case 'approved':
      case 'completed':
        return '✅';
      case 'rejected':
      case 'failed':
        return '❌';
      default:
        return 'ℹ️';
    }
  },
  
  getPaymentMethodIcon: (method) => {
    const icons = {
      'telebirr': '📱',
      'cbe_birr': '🏦',
      'bank': '💳',
      'awash': '🏛️',
      'dashen': '🏛️',
      'boa': '🏛️',
      'abyssinia': '🏛️',
      'hibret': '🏛️'
    };
    return icons[method] || '💰';
  },
  
  validateDepositAmount: (amount, minAmount, maxAmount) => {
    const numAmount = parseFloat(amount);
    const numMin = parseFloat(minAmount);
    const numMax = parseFloat(maxAmount);
    
    if (isNaN(numAmount)) return 'Invalid amount';
    if (numAmount < numMin) return `Minimum deposit is ${numMin}`;
    if (numAmount > numMax) return `Maximum deposit is ${numMax}`;
    return null;
  },
  
  validateWithdrawAmount: (amount, minAmount, maxAmount, balance) => {
    const numAmount = parseFloat(amount);
    const numMin = parseFloat(minAmount);
    const numMax = parseFloat(maxAmount);
    const numBalance = parseFloat(balance);
    
    if (isNaN(numAmount)) return 'Invalid amount';
    if (numAmount < numMin) return `Minimum withdrawal is ${numMin}`;
    if (numAmount > numMax) return `Maximum withdrawal is ${numMax}`;
    if (numAmount > numBalance) return 'Insufficient balance';
    return null;
  },
};

export default transactionsAPI;