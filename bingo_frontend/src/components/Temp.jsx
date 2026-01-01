import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsAPI } from '../api/transactions'
import { adminAPI } from '../api/admin'
import { useAuth } from '../context/AuthContext'
import './global.css'
import toast from 'react-hot-toast'
import { 
  Home,
  CreditCard,
  Send,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  Check,
  X,
  Eye,
  Search,
  Calendar,
  RefreshCw,
  User,
  LogOut,
  Bell,
  Filter,
  Gamepad,
  PiggyBank,
  Wallet,
  History,
  UserCheck,
  Settings,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  LineChart,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Shield,
  UserCog,
  Activity,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from 'lucide-react'


import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns'

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="text-center max-w-xs">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-base font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-xs text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 active:scale-95"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Admin = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState([startOfDay(new Date()), endOfDay(new Date())])
  const [startDate, endDate] = dateRange
  const [showSearch, setShowSearch] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  
  const searchContainerRef = useRef(null)
  const searchToggleRef = useRef(null)
  const tabsRef = useRef(null)
  const queryClient = useQueryClient()
  const { user, logout } = useAuth()
  
  // Check user type
  const isSuperUser = user?.is_superuser || user?.user_type === 'superuser'
  const isAgent = user?.user_type === 'agent'
  const userType = isSuperUser ? 'superuser' : (isAgent ? 'agent' : 'admin')

  // Add to your state variables
  const [showNewAgentForm, setShowNewAgentForm] = useState(false)
  const initialPassword = 'agent@123'
  
  const [newAgentData, setNewAgentData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: initialPassword,
    password2: initialPassword,
    phone_number: '',
    commission_rate: '10',
    address: '',
    user_type: "agent"
  })


// Add these state variables
const [paymentAccounts, setPaymentAccounts] = useState([]);
const [loadingPaymentAccounts, setLoadingPaymentAccounts] = useState(false);
const [showPaymentForm, setShowPaymentForm] = useState(false);
const [editingAccount, setEditingAccount] = useState(null);
const [submittingPaymentAccount, setSubmittingPaymentAccount] = useState(false);
const [qrCodePreview, setQrCodePreview] = useState(null);

const initialPaymentFormData = {
  payment_method: '',
  account_name: '',
  account_number: '',
  phone_number: '',
  bank_name: '',
  qr_code: null,
  min_amount: 10,
  max_amount: 5000,
  instructions: '',
  is_active: true
};

const [paymentFormData, setPaymentFormData] = useState(initialPaymentFormData);

// Add these functions
useEffect(() => {
  if (isAgent && activeTab === 'profile') {
    fetchPaymentAccounts();
  }
}, [isAgent, activeTab]);

const fetchPaymentAccounts = async () => {
  try {
    setLoadingPaymentAccounts(true);
    const response = await adminAPI.getPaymentAccounts({ agent: user?.id });
    const formattedData = formatPaymentAccountData(response.data);
    setPaymentAccounts(formattedData);
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    showToast('Failed to load payment accounts', 'error');
  } finally {
    setLoadingPaymentAccounts(false);
  }
};

const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    setPaymentFormData({...paymentFormData, qr_code: file});
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setQrCodePreview(reader.result);
    };
    reader.readAsDataURL(file);
  }
};

const handleEditAccount = (account) => {
  setEditingAccount(account);
  setPaymentFormData({
    payment_method: account.payment_method,
    account_name: account.account_name,
    account_number: account.account_number,
    phone_number: account.phone_number || '',
    bank_name: account.bank_name || '',
    qr_code: account.qr_code,
    min_amount: account.min_amount,
    max_amount: account.max_amount,
    instructions: account.instructions || '',
    is_active: account.is_active
  });
  setShowPaymentForm(true);
};

const handleSubmitPaymentAccount = async (e) => {
  e.preventDefault();
  
  try {
    setSubmittingPaymentAccount(true);
    
    // Validate min/max amounts
    if (paymentFormData.min_amount > paymentFormData.max_amount) {
      showToast('Minimum amount cannot be greater than maximum amount', 'error');
      return;
    }
    
    if (editingAccount) {
      // Update existing account
      await adminAPI.updatePaymentAccount(editingAccount.id, paymentFormData);
      showToast('Payment account updated successfully', 'success');
    } else {
      // Create new account
      await adminAPI.createPaymentAccount(paymentFormData);
      showToast('Payment account created successfully', 'success');
    }
    
    // Refresh list
    await fetchPaymentAccounts();
    
    // Reset form
    setShowPaymentForm(false);
    setEditingAccount(null);
    setPaymentFormData(initialPaymentFormData);
    setQrCodePreview(null);
    
  } catch (error) {
    console.error('Error saving payment account:', error);
    showToast(
      error.response?.data?.detail || 
      error.response?.data?.message || 
      'Failed to save payment account', 
      'error'
    );
  } finally {
    setSubmittingPaymentAccount(false);
  }
};

const handleToggleActive = async (id, currentStatus) => {
  if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this account?`)) {
    return;
  }
  
  try {
    await adminAPI.togglePaymentAccountActive(id);
    showToast(`Account ${currentStatus ? 'deactivated' : 'activated'} successfully`, 'success');
    await fetchPaymentAccounts();
  } catch (error) {
    console.error('Error toggling account status:', error);
    showToast('Failed to update account status', 'error');
  }
};

const handleDeleteAccount = async (id) => {
  if (!confirm('Are you sure you want to delete this payment account? This action cannot be undone.')) {
    return;
  }
  
  try {
    await adminAPI.deletePaymentAccount(id);
    showToast('Payment account deleted successfully', 'success');
    await fetchPaymentAccounts();
  } catch (error) {
    console.error('Error deleting payment account:', error);
    showToast('Failed to delete payment account', 'error');
  }
};

// Helper function for toast notifications
const showToast = (message, type = 'info') => {
  // You can use your toast library or console.log
  console.log(`${type.toUpperCase()}: ${message}`);
  // Example with react-toastify:
  // toast[type](message);
};
  // Define tabs based on user type
  const getTabs = () => {
    if (isSuperUser) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'agents', label: 'Agents', icon: UserCheck },
        { id: 'deposits', label: 'Deposit', icon: CreditCard },
        { id: 'withdrawals', label: 'Withdraw', icon: Send },
        { id: 'players', label: 'Players', icon: Users },
        { id: 'transactions', label: 'History', icon: History },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    } else if (isAgent) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'deposits', label: 'My Deposits', icon: CreditCard },
        { id: 'withdrawals', label: 'My Withdraws', icon: Send },
        { id: 'transactions', label: 'My History', icon: History },
        { id: 'profile', label: 'Profile', icon: User },
      ]
    }
    // Default admin tabs
    return [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'agents', label: 'Agents', icon: UserCheck },
      { id: 'deposits', label: 'Deposit', icon: CreditCard },
      { id: 'withdrawals', label: 'Withdraw', icon: Send },
      { id: 'players', label: 'Players', icon: Users },
      { id: 'transactions', label: 'History', icon: History },
    ]
  }

  const tabs = getTabs()

  // ==================== SAFE DATA GETTERS ====================
  
  const getSafeAdminStats = () => {
    try {
      if (isAgent) {
        return {}
      }
      
      const data = getSafeData(adminStats)
      return data || {}
    } catch (error) {
      console.error('Error getting admin stats:', error)
      return {}
    }
  }
  
  const getSafeStat = (path, defaultValue = 0) => {
    try {
      if (isAgent) return defaultValue
      
      const stats = getSafeAdminStats()
      if (!path) return stats
      
      const keys = path.split('.')
      let result = stats
      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = result[key]
        } else {
          return defaultValue
        }
      }
      return result === null || result === undefined ? defaultValue : result
    } catch (error) {
      return defaultValue
    }
  }

  // ==================== API QUERIES ====================

  // Admin Statistics Query - Only for superusers
  const { 
    data: adminStats, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats 
  } = useQuery({
    queryKey: ['admin-stats', startDate, endDate],
    queryFn: () => adminAPI.getStats({
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd')
    }),
    enabled: isSuperUser, // Only fetch if superuser
    refetchInterval: 60000,
    retry: 2,
    onError: (error) => {
      if (!isAgent) {
        toast.error(`Failed to load stats: ${error.message}`)
      }
    }
  })

  // Agent Dashboard Query - Only for agents
  const { 
    data: agentDashboardData, 
    isLoading: agentDashboardLoading,
    error: agentDashboardError,
    refetch: refetchAgentDashboard 
  } = useQuery({
    queryKey: ['agent-dashboard'],
    queryFn: () => adminAPI.getAgentDashboard(),
    enabled: isAgent, // Only fetch if agent
    onError: (error) => {
      toast.error(`Failed to load agent dashboard: ${error.message}`)
    }
  })

  // Users Query - Only for superusers/admin
  const { 
    data: usersData = {}, 
    isLoading: usersLoading, 
    error: usersError,
    refetch: refetchUsers 
  } = useQuery({
    queryKey: ['users', startDate, endDate],
    queryFn: () => adminAPI.getUsers({
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd')
    }),
    enabled: isSuperUser || !isAgent, // Only fetch if superuser/admin
    onError: (error) => {
      if (!isAgent) {
        toast.error(`Failed to load users: ${error.message}`)
      }
    }
  })

  // Deposits Query - Different based on user type
  const { 
    data: depositsData = {}, 
    isLoading: depositsLoading, 
    error: depositsError,
    refetch: refetchDeposits 
  } = useQuery({
    queryKey: ['deposits', startDate, endDate, userType],
    queryFn: () => {
      if (isAgent) {
        // Agent sees only their deposits
        return transactionsAPI.getMyDeposits()
      } else {
        // Superuser/admin sees all deposits
        return transactionsAPI.getDeposits({
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd')
        })
      }
    },
    onError: (error) => {
      toast.error(`Failed to load deposits: ${error.message}`)
    }
  })

  // Withdrawals Query - Different based on user type
  const { 
    data: withdrawRequestsData = {}, 
    isLoading: withdrawsLoading, 
    error: withdrawsError,
    refetch: refetchWithdraws 
  } = useQuery({
    queryKey: ['withdraw-requests', startDate, endDate, userType],
    queryFn: () => {
      if (isAgent) {
        // Agent sees only their withdrawals
        return transactionsAPI.getMyWithdrawRequests()
      } else {
        // Superuser/admin sees all withdrawals
        return transactionsAPI.getWithdrawRequests({
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd')
        })
      }
    },
    onError: (error) => {
      toast.error(`Failed to load withdrawals: ${error.message}`)
    }
  })

  // Recent Activity Query - Works for both roles
  const { 
    data: recentActivityData = {}, 
    isLoading: activityLoading, 
    error: activityError,
    refetch: refetchActivity 
  } = useQuery({
    queryKey: ['recent-activity', startDate, endDate, userType],
    queryFn: () => adminAPI.getRecentActivity({
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd')
    }),
    onError: (error) => {
      // Don't show error for 403 (forbidden) - it's expected for agents
      if (error.response?.status !== 403) {
        toast.error(`Failed to load recent activity: ${error.message}`)
      }
    }
  })

  // ==================== HELPER FUNCTIONS ====================

  // Safe data extraction helper function
  const getSafeData = (data, path) => {
    try {
      if (!data) return null
      
      if (data.data && typeof data.data === 'object') {
        data = data.data
      }
      
      if (path) {
        const keys = path.split('.')
        let result = data
        for (const key of keys) {
          if (result && typeof result === 'object' && key in result) {
            result = result[key]
          } else {
            return null
          }
        }
        return result
      }
      
      return data
    } catch (error) {
      console.error('Error extracting data:', error)
      return null
    }
  }

  // Get agent-specific stats cards
  const getAgentStatsCards = () => {
    try {
      const data = getSafeData(agentDashboardData)
      
      if (!data) return []
      
      const todayStats = data.today_stats || {}
      const weeklyStats = data.weekly_stats || {}
      const agentInfo = data.agent || {}
      
      return [
        {
          title: 'Today\'s Earnings',
          value: todayStats.total || 0,
          change: todayStats.total > 0 ? '+100%' : '+0%',
          trend: todayStats.total > 0 ? 'up' : 'down',
          icon: DollarSign,
          color: 'bg-gradient-to-br from-green-500 to-emerald-600',
          currency: true,
        },
        {
          title: 'Today\'s Deposits',
          value: todayStats.deposits || 0,
          change: '+0%',
          trend: 'up',
          icon: PiggyBank,
          color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
          currency: true,
        },
        {
          title: 'Total Earnings',
          value: agentInfo.total_earnings || 0,
          change: '+0%',
          trend: 'up',
          icon: Wallet,
          color: 'bg-gradient-to-br from-purple-500 to-violet-600',
          currency: true,
        },
        {
          title: 'Commission Rate',
          value: agentInfo.commission_rate || 0,
          change: '+0%',
          trend: 'stable',
          icon: Percent,
          color: 'bg-gradient-to-br from-amber-500 to-orange-600',
          currency: false,
          suffix: '%',
        },
      ]
    } catch (error) {
      console.error('Error getting agent stats cards:', error)
      return []
    }
  }

  // Get superuser stats cards
  const getSuperUserStatsCards = () => {
    try {
      const statsCardsData = getSafeStat('stats_cards') || {}

      return [
        {
          title: 'Total Rounds',
          value: statsCardsData.total_rounds || 0,
          change: statsCardsData.rounds_change ? `${statsCardsData.rounds_change > 0 ? '+' : ''}${Math.round(statsCardsData.rounds_change)}%` : '+0%',
          trend: statsCardsData.rounds_change > 0 ? 'up' : 'down',
          icon: Gamepad,
          color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
          currency: false,
        },
        {
          title: 'Total Players',
          value: statsCardsData.total_players || 0,
          change: statsCardsData.players_change ? `${statsCardsData.players_change > 0 ? '+' : ''}${Math.round(statsCardsData.players_change)}%` : '+0%',
          trend: statsCardsData.players_change > 0 ? 'up' : 'down',
          icon: Users,
          color: 'bg-gradient-to-br from-cyan-500 to-blue-600',
          currency: false,
        },
        {
          title: 'Total Withdrawal',
          value: statsCardsData.total_withdrawal || 0,
          change: statsCardsData.withdrawal_change ? `${statsCardsData.withdrawal_change > 0 ? '+' : ''}${Math.round(statsCardsData.withdrawal_change)}%` : '+0%',
          trend: statsCardsData.withdrawal_change > 0 ? 'up' : 'down',
          icon: Send,
          color: 'bg-gradient-to-br from-amber-500 to-orange-600',
          currency: true,
        },
        {
          title: 'Total Deposit',
          value: statsCardsData.total_deposit || 0,
          change: statsCardsData.deposit_change ? `${statsCardsData.deposit_change > 0 ? '+' : ''}${Math.round(statsCardsData.deposit_change)}%` : '+0%',
          trend: statsCardsData.deposit_change > 0 ? 'up' : 'down',
          icon: PiggyBank,
          color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
          currency: true,
        },
        {
          title: 'Total Earning',
          value: statsCardsData.total_earning || 0,
          change: statsCardsData.earning_change ? `${statsCardsData.earning_change > 0 ? '+' : ''}${Math.round(statsCardsData.earning_change)}%` : '+0%',
          trend: statsCardsData.earning_change > 0 ? 'up' : 'down',
          icon: DollarSign,
          color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
          currency: true,
        },
        {
          title: 'Total Profit',
          value: statsCardsData.total_profit || 0,
          change: statsCardsData.profit_change ? `${statsCardsData.profit_change > 0 ? '+' : ''}${Math.round(statsCardsData.profit_change)}%` : '+0%',
          trend: statsCardsData.profit_change > 0 ? 'up' : 'down',
          icon: TrendingUp,
          color: 'bg-gradient-to-br from-green-500 to-emerald-600',
          currency: true,
        },
      ]
    } catch (error) {
      console.error('Error getting superuser stats cards:', error)
      return []
    }
  }

  // Get stats cards based on user type
  const getStatsCards = () => {
    try {
      if (isAgent) {
        return getAgentStatsCards()
      } else if (isSuperUser || !isAgent) {
        return getSuperUserStatsCards()
      }
      return []
    } catch (error) {
      console.error('Error getting stats cards:', error)
      return []
    }
  }

  // Safe data list getters
  const getRecentActivityList = () => {
    try {
      const data = getSafeData(recentActivityData)
      if (Array.isArray(data)) return data.slice(0, 10)
      if (data?.activities && Array.isArray(data.activities)) return data.activities.slice(0, 10)
      if (data?.recent_activity && Array.isArray(data.recent_activity)) return data.recent_activity.slice(0, 10)
      return []
    } catch (error) {
      console.error('Error getting recent activity list:', error)
      return []
    }
  }

  /*const getAgentsList = () => {
    try {
      if (isAgent) return []
      
      const stats = getSafeAdminStats()
      if (Array.isArray(stats.agents)) return stats.agents
      return []
    } catch (error) {
      console.error('Error getting agents list:', error)
      return []
    }

  }*/
    const getStatsData = () => {
    return getSafeData(adminStats) || {};
  };

  const getAgentsList = () => {
    const stats = getStatsData();
    if (Array.isArray(stats.agents)) return stats.agents;
    return [];
  };


  const getUsersList = () => {
    try {
      if (isAgent) return []
      
      const data = getSafeData(usersData)
      if (Array.isArray(data)) return data
      if (data?.users && Array.isArray(data.users)) return data.users
      return []
    } catch (error) {
      console.error('Error getting users list:', error)
      return []
    }
  }

  const getDepositsList = () => {
    try {
      const data = getSafeData(depositsData)
      if (Array.isArray(data)) return data
      if (data?.deposits && Array.isArray(data.deposits)) return data.deposits
      return []
    } catch (error) {
      console.error('Error getting deposits list:', error)
      return []
    }
  }

  const getWithdrawalsList = () => {
    try {
      const data = getSafeData(withdrawRequestsData)
      if (Array.isArray(data)) return data
      if (data?.withdrawals && Array.isArray(data.withdrawals)) return data.withdrawals
      return []
    } catch (error) {
      console.error('Error getting withdrawals list:', error)
      return []
    }
  }

  // Filter data based on search term
  const filteredDeposits = getDepositsList().filter(deposit => {
    try {
      if (!deposit) return false
      
      const user = deposit.user || {}
      const username = typeof user === 'string' ? user : user.username || ''
      const phone = deposit.phone_number || ''
      const method = deposit.payment_method_display || ''
      const amount = deposit.amount || ''
      
      return searchTerm === '' || 
        username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        method.toLowerCase().includes(searchTerm.toLowerCase()) ||
        amount.toString().includes(searchTerm)
    } catch (error) {
      console.error('Error filtering deposits:', error)
      return false
    }
  })

  const filteredWithdrawals = getWithdrawalsList().filter(request => {
    try {
      if (!request) return false
      
      const user = request.user || {}
      const username = typeof user === 'string' ? user : user.username || ''
      const phone = request.phone_number || ''
      const accountName = request.account_name || ''
      const accountNumber = request.account_number || ''
      const amount = request.amount || ''
      
      return searchTerm === '' || 
        username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        amount.toString().includes(searchTerm)
    } catch (error) {
      console.error('Error filtering withdrawals:', error)
      return false
    }
  })

  const filteredUsers = getUsersList().filter(userItem => {
    try {
      if (!userItem) return false
      
      const username = userItem.username || ''
      const email = userItem.email || ''
      const phone = userItem.phone_number || ''
      
      return searchTerm === '' || 
        username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.toLowerCase().includes(searchTerm.toLowerCase())
    } catch (error) {
      console.error('Error filtering users:', error)
      return false
    }
  })

  // ==================== MUTATIONS ====================

  const approveDepositMutation = useMutation({
    mutationFn: ({ depositId, notes }) => adminAPI.approveDeposit(depositId, notes),
    onSuccess: () => {
      toast.success('✅ Deposit approved!')
      queryClient.invalidateQueries(['deposits'])
      queryClient.invalidateQueries(['admin-stats'])
      queryClient.invalidateQueries(['recent-activity'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || '❌ Approval failed')
    },
  })

  const rejectDepositMutation = useMutation({
    mutationFn: ({ depositId, notes }) => adminAPI.rejectDeposit(depositId, notes),
    onSuccess: () => {
      toast.success('❌ Deposit rejected!')
      queryClient.invalidateQueries(['deposits'])
      queryClient.invalidateQueries(['admin-stats'])
      queryClient.invalidateQueries(['recent-activity'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || '❌ Rejection failed')
    },
  })

  const approveWithdrawMutation = useMutation({
    mutationFn: ({ withdrawId, notes }) => adminAPI.approveWithdrawal(withdrawId, notes),
    onSuccess: () => {
      toast.success('✅ Withdrawal approved!')
      queryClient.invalidateQueries(['withdraw-requests'])
      queryClient.invalidateQueries(['admin-stats'])
      queryClient.invalidateQueries(['recent-activity'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || '❌ Approval failed')
    },
  })

  const rejectWithdrawMutation = useMutation({
    mutationFn: ({ withdrawId, notes }) => adminAPI.rejectWithdrawal(withdrawId, notes),
    onSuccess: () => {
      toast.success('❌ Withdrawal rejected!')
      queryClient.invalidateQueries(['withdraw-requests'])
      queryClient.invalidateQueries(['admin-stats'])
      queryClient.invalidateQueries(['recent-activity'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || '❌ Rejection failed')
    },
  })

  // Add agent creation mutation
  const createAgentMutation = useMutation({
    mutationFn: (agentData) => adminAPI.createAgent(agentData),
    onSuccess: () => {
      toast.success('✅ Agent created successfully!')
      setShowNewAgentForm(false)
      setNewAgentData({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        phone_number: '',
        commission_rate: '10',
        address: '',
        user_type: "agent"
      })
      queryClient.invalidateQueries(['admin-stats'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || '❌ Failed to create agent')
    },
  })

  // ==================== EVENT HANDLERS ====================

  // Refresh all data
  const handleRefresh = async () => {
    setIsLoadingData(true)
    try {
      if (isSuperUser) {
        await Promise.all([
          refetchStats(),
          refetchDeposits(),
          refetchWithdraws(),
          refetchUsers(),
          refetchActivity()
        ])
      } else if (isAgent) {
        await Promise.all([
          refetchAgentDashboard(),
          refetchDeposits(),
          refetchWithdraws(),
          refetchActivity()
        ])
      } else {
        // Regular admin
        await Promise.all([
          refetchDeposits(),
          refetchWithdraws(),
          refetchUsers(),
          refetchActivity()
        ])
      }
      toast.success('Data refreshed!')
    } catch (error) {
      toast.error('Failed to refresh data')
    } finally {
      setIsLoadingData(false)
    }
  }

  // Quick date filters
  const quickDateFilters = [
    { label: 'Today', action: () => setDateRange([startOfDay(new Date()), endOfDay(new Date())]) },
    { label: 'Yesterday', action: () => setDateRange([startOfDay(subDays(new Date(), 1)), endOfDay(subDays(new Date(), 1))]) },
    { label: 'Week', action: () => setDateRange([startOfWeek(new Date()), endOfDay(new Date())]) },
    { label: 'Month', action: () => setDateRange([startOfMonth(new Date()), endOfDay(new Date())]) },
  ]

  // Handle tab scroll on mobile
  const scrollTabs = (direction) => {
    if (tabsRef.current) {
      const scrollAmount = 120
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  // Format amount
  const formatAmount = (amount) => {
    try {
      const num = parseFloat(amount || 0)
      return isNaN(num) ? '0' : num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    } catch (error) {
      console.error('Error formatting amount:', error)
      return '0'
    }
  }

  // Handle search
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const query = searchTerm.trim()
      if (query) {
        toast.success(`Searching for: ${query}`)
        setShowSearch(false)
      }
    }
  }

  // Handle deposit approval (only for superuser/admin)
  const handleApproveDeposit = async (depositId) => {
    if (!isSuperUser && !user?.is_staff) {
      toast.error('You do not have permission to approve deposits')
      return
    }
    const notes = window.prompt('Enter approval notes (optional):') || ''
    approveDepositMutation.mutate({ depositId, notes })
  }

  // Handle deposit rejection (only for superuser/admin)
  const handleRejectDeposit = async (depositId) => {
    if (!isSuperUser && !user?.is_staff) {
      toast.error('You do not have permission to reject deposits')
      return
    }
    const notes = window.prompt('Enter rejection reason:') || ''
    if (!notes) {
      toast.error('Please provide a reason for rejection')
      return
    }
    rejectDepositMutation.mutate({ depositId, notes })
  }

  // Handle withdrawal approval (only for superuser/admin)
  const handleApproveWithdrawal = async (withdrawId) => {
    if (!isSuperUser && !user?.is_staff) {
      toast.error('You do not have permission to approve withdrawals')
      return
    }
    const notes = window.prompt('Enter approval notes (optional):') || ''
    approveWithdrawMutation.mutate({ withdrawId, notes })
  }

  // Handle withdrawal rejection (only for superuser/admin)
  const handleRejectWithdrawal = async (withdrawId) => {
    if (!isSuperUser && !user?.is_staff) {
      toast.error('You do not have permission to reject withdrawals')
      return
    }
    const notes = window.prompt('Enter rejection reason:') || ''
    if (!notes) {
      toast.error('Please provide a reason for rejection')
      return
    }
    rejectWithdrawMutation.mutate({ withdrawId, notes })
  }

  // Add form submit handler for creating agents
  const handleSubmitAgentForm = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!newAgentData.first_name || !newAgentData.last_name || 
        !newAgentData.username || !newAgentData.email || 
        !newAgentData.password || !newAgentData.phone_number) {
      toast.error('Please fill all required fields')
      return
    }

    // Submit the form
    createAgentMutation.mutate(newAgentData)
  }

  // Add agent action handlers
  const handleViewAgentDetails = (agent) => {
    console.log('View agent:', agent)
    toast.info(`Viewing details for ${agent.name || agent.user?.username}`)
  }

  const handleEditAgent = (agent) => {
    console.log('Edit agent:', agent)
    toast.info(`Editing ${agent.name || agent.user?.username}`)
  }

  // ==================== RENDER FUNCTIONS ====================

  // Loading state
  const isLoading = (isSuperUser && statsLoading) || (isAgent && agentDashboardLoading)
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading {isAgent ? 'agent' : 'admin'} dashboard...</p>
        </div>
      </div>
    )
  }

  // Render different header based on user type
  const renderHeader = () => (
    <div className="fixed top-0 left-0  d-none right-0 bg-white border-b z-50 max-w-[360px] mx-auto">
      

      {/* Search Bar - Only for superuser */}
      {isSuperUser && showSearch && (
        <div ref={searchContainerRef} className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search users, transactions..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // Render agent-specific dashboard
  const renderAgentDashboard = () => {
    try {
      const data = getSafeData(agentDashboardData)
      const agentInfo = data?.agent || {}
      const todayStats = data?.today_stats || {}
      const weeklyStats = data?.weekly_stats || {}
      const recentDeposits = data?.recent_deposits || []
      const recentWithdrawals = data?.recent_withdrawals || []

      return (
        <div className="space-y-4">
          {/* Agent Stats Summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-3 text-white">
              <DollarSign className="h-4 w-4 opacity-90 mb-1" />
              <div className="text-lg font-bold mb-0.5">
                ETB {formatAmount(agentInfo.total_earnings || 0)}
              </div>
              <div className="text-xs opacity-90">Total Earnings</div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-3 text-white">
              <PiggyBank className="h-4 w-4 opacity-90 mb-1" />
              <div className="text-lg font-bold mb-0.5">
                ETB {formatAmount(todayStats.deposits || 0)}
              </div>
              <div className="text-xs opacity-90">Today's Deposits</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg p-3 text-white">
              <Activity className="h-4 w-4 opacity-90 mb-1" />
              <div className="text-lg font-bold mb-0.5">
                {agentInfo.commission_rate || 0}%
              </div>
              <div className="text-xs opacity-90">Commission Rate</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg p-3 text-white">
              <Wallet className="h-4 w-4 opacity-90 mb-1" />
              <div className="text-lg font-bold mb-0.5">
                ETB {formatAmount(weeklyStats.total || 0)}
              </div>
              <div className="text-xs opacity-90">Weekly Total</div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
              <History className="h-4 w-4 text-blue-500" />
              Recent Activity
            </h2>
            
            {/* Recent Deposits */}
            {recentDeposits.length > 0 ? (
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Deposits</h3>
                <div className="space-y-2">
                  {recentDeposits.slice(0, 5).map((deposit, index) => (
                    <div key={deposit.id || index} className="bg-white rounded-lg shadow-sm border p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            ETB {formatAmount(deposit.amount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {deposit.created_at ? format(new Date(deposit.created_at), 'MMM d, HH:mm') : 'N/A'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                          deposit.status === 'approved' ? 'bg-green-100 text-green-800' :
                          deposit.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {deposit.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-3 text-center py-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No recent deposits</p>
              </div>
            )}

            {/* Recent Withdrawals */}
            {recentWithdrawals.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Withdrawals</h3>
                <div className="space-y-2">
                  {recentWithdrawals.slice(0, 5).map((withdrawal, index) => (
                    <div key={withdrawal.id || index} className="bg-white rounded-lg shadow-sm border p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            ETB {formatAmount(withdrawal.amount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {withdrawal.created_at ? format(new Date(withdrawal.created_at), 'MMM d, HH:mm') : 'N/A'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                          withdrawal.status === 'approved' ? 'bg-green-100 text-green-800' :
                          withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {withdrawal.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No recent withdrawals</p>
              </div>
            )}
          </div>
        </div>
      )
    } catch (error) {
      console.error('Error rendering agent dashboard:', error)
      return (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">Failed to load dashboard</h3>
          <p className="text-xs text-gray-500">Please try refreshing the page</p>
        </div>
      )
    }
  }

  // ==================== MAIN RENDER ====================

  try {
    return (
      <div className="ml-0 min-h-screen bg-gray-50 max-w-[350px] mx-auto overflow-x-hidden relative">
        {/* Safe area padding for mobile */}
        <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          {renderHeader()}

          {/* Image Preview Modal */}
          {selectedImage && (
            <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-2 z-50">
              <div className="relative w-full max-w-[340px]">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors p-2"
                >
                  <X className="h-6 w-6" />
                </button>
                <div className="bg-white rounded-lg overflow-hidden">
                  <img
                    src={selectedImage}
                    alt="Proof"
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                  <div className="p-3 bg-gray-900 flex justify-between items-center">
                    <a
                      href={selectedImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-sm flex items-center space-x-2"
                    >
                      <span>Open full size</span>
                    </a>
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="text-white text-sm px-3 py-1 bg-gray-700 rounded-md"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content - Mobile Optimized */}
          <main className="pt-20 px-0 ml-0 pb-20">
            {/* Date Range Selector - Only show for superuser/admin */}
            {(isSuperUser || !isAgent) && (
              <div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-900">Date Range</div>
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="text-xs text-blue-600 flex items-center gap-1"
                    >
                      <Calendar className="h-3 w-3" />
                      {showDatePicker ? 'Hide' : 'Custom'}
                    </button>
                  </div>
                  <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
                    {quickDateFilters.map((filter, index) => (
                      <button
                        key={index}
                        onClick={filter.action}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                          index === 0 
                            ? 'bg-blue-500 text-white shadow-sm' 
                            : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-12">From:</span>
                    <input
                      type="date"
                      value={format(startDate, 'yyyy-MM-dd')}
                      onChange={(e) => setDateRange([new Date(e.target.value), endDate])}
                      className="flex-1 px-2 py-1.5 border rounded text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-12">To:</span>
                    <input
                      type="date"
                      value={format(endDate, 'yyyy-MM-dd')}
                      onChange={(e) => setDateRange([startDate, new Date(e.target.value)])}
                      className="flex-1 px-2 py-1.5 border rounded text-xs"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleRefresh}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Apply Filter
                    </button>
                    <button
                      onClick={handleRefresh}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {showDatePicker && (
                  <div className="mt-3 p-3 border-t">
                    <DatePicker
                      selectsRange
                      startDate={startDate}
                      endDate={endDate}
                      onChange={(update) => {
                        setDateRange(update)
                        setShowDatePicker(false)
                      }}
                      inline
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Tabs - Mobile Scrollable with Arrows */}
            <div className="sticky top-20 bg-white z-40 mb-3 border-b">
              <div className="relative">
                <button
                  onClick={() => scrollTabs('left')}
                  className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white shadow-sm p-1 rounded-r-md z-10"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => scrollTabs('right')}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white shadow-sm p-1 rounded-l-md z-10"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <div 
                  ref={tabsRef}
                  className="flex overflow-x-auto gap-1 scrollbar-hide px-6 py-1.5"
                >
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    const pendingCount = tab.id === 'deposits' 
                      ? (getSafeStat('pending_deposits') || 0)
                      : tab.id === 'withdrawals'
                      ? (getSafeStat('pending_withdrawals') || 0)
                      : 0
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 whitespace-nowrap border-b-2 transition-colors flex-shrink-0 min-w-[80px] justify-center ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-600 hover:text-gray-900 active:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{tab.label}</span>
                        {pendingCount > 0 && (isSuperUser || !isAgent) && (
                          <span className="bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                            {pendingCount > 9 ? '9+' : pendingCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Dashboard Tab - Different content based on user type */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4">
                {isAgent ? (
                  renderAgentDashboard()
                ) : (
                  <>
                    {/* Superuser/Admin Dashboard */}
                    <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-blue-500" />
                      {isSuperUser ? 'System Overview' : 'Dashboard'}
                    </h2>
                    
                    {/* Stats Cards Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {getStatsCards().map((card, index) => {
                        const Icon = card.icon
                        return (
                          <div
                            key={index}
                            className="bg-white rounded-lg shadow-sm border p-3 active:scale-98 transition-transform"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider truncate">
                                {card.title}
                              </div>
                              <div className={`p-1.5 rounded-lg ${card.color} flex-shrink-0`}>
                                <Icon className="h-3 w-3 text-white" />
                              </div>
                            </div>
                            <div className="text-lg font-bold text-gray-900 mb-1 truncate">
                              {card.currency ? `ETB ${formatAmount(card.value)}` : `${formatAmount(card.value)}${card.suffix || ''}`}
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                                card.trend === 'up'
                                  ? 'bg-green-100 text-green-800'
                                  : card.trend === 'down'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {card.trend === 'up' && <ArrowUpRight className="h-2.5 w-2.5" />}
                                {card.trend === 'down' && <ArrowDownRight className="h-2.5 w-2.5" />}
                                {card.change}
                              </span>
                              <span className="text-[10px] text-gray-500">vs yesterday</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Recent Activity Table */}
                    <div>
                      <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <History className="h-4 w-4 text-blue-500" />
                        Recent Activity
                      </h2>
                      
                      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        <div className="overflow-x-auto">
                          <div className="min-w-full">
                            <div className="bg-gray-50 px-3 py-2">
                              <div className="grid grid-cols-12 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                                <div className="col-span-3">Time</div>
                                <div className="col-span-3">Player</div>
                                <div className="col-span-2">Amount</div>
                                <div className="col-span-4">Status</div>
                              </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {getRecentActivityList().map((activity, index) => (
                                <div key={index} className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100">
                                  <div className="grid grid-cols-12 items-center">
                                    <div className="col-span-3">
                                      <div className="text-xs text-gray-900">
                                        {activity.timestamp ? format(new Date(activity.timestamp), 'HH:mm') : 'N/A'}
                                      </div>
                                    </div>
                                    <div className="col-span-3">
                                      <div className="text-xs font-medium text-gray-900 truncate">
                                        {typeof activity.user === 'string' ? activity.user : activity.user?.username || 'N/A'}
                                      </div>
                                    </div>
                                    <div className="col-span-2">
                                      <div className="text-xs font-medium text-gray-900">
                                        ETB {formatAmount(activity.amount)}
                                      </div>
                                    </div>
                                    <div className="col-span-4">
                                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                                        activity.status === 'approved'
                                          ? 'bg-green-100 text-green-800'
                                          : activity.status === 'rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {activity.status || 'pending'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats Summary */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-bold">Quick Summary</h3>
                          <p className="text-xs opacity-90">Today's performance</p>
                        </div>
                        <BarChart3 className="h-5 w-5 opacity-90" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs opacity-90">Revenue</div>
                          <div className="text-base font-bold">
                            ETB {formatAmount(getSafeStat('total_revenue', 0))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs opacity-90">Profit</div>
                          <div className="text-base font-bold">
                            ETB {formatAmount(getSafeStat('net_profit', 0))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs opacity-90">Active</div>
                          <div className="text-base font-bold">
                            {getSafeStat('active_users_today', 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Agents Tab - Only show for superuser/admin */}
            {activeTab === 'agents' && (isSuperUser || !isAgent) && (
                 
  <div className="space-y-4">
    <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
      <UserCheck className="h-4 w-4 text-blue-500" />
      Agent Performance
    </h2>

    {/* Add New Agent Button */}
    <div className="flex justify-between items-center mb-3">
      <div className="text-sm text-gray-600">
        {getAgentsList().length} agents registered
      </div>
      <button
        onClick={() => setShowNewAgentForm(!showNewAgentForm)}
        className="px-3 py-2 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-1.5"
      >
        {showNewAgentForm ? (
          <>
            <X className="h-3.5 w-3.5" />
            Cancel
          </>
        ) : (
          <>
            <User className="h-3.5 w-3.5" />
            Add New Agent
          </>
        )}
      </button>
    </div>

    {/* New Agent Registration Form */}
    {showNewAgentForm && (
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-green-500" />
          Register New Agent
        </h3>
        
        <form className="space-y-3" onSubmit={handleSubmitAgentForm}>
          {/* First Name & Last Name Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={newAgentData.first_name}
                onChange={(e) => setNewAgentData({...newAgentData, first_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={newAgentData.last_name}
                onChange={(e) => setNewAgentData({...newAgentData, last_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Doe"
                required
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={newAgentData.username}
              onChange={(e) => setNewAgentData({...newAgentData, username: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="agent_john"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={newAgentData.email}
              onChange={(e) => setNewAgentData({...newAgentData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="john@example.com"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={newAgentData.password}
              onChange={(e) => setNewAgentData({...newAgentData, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {/* Phone Number & Commission Rate */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={newAgentData.phone_number}
                onChange={(e) => setNewAgentData({...newAgentData, phone_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0912345678"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Commission Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={newAgentData.commission_rate}
                  onChange={(e) => setNewAgentData({...newAgentData, commission_rate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="5"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={newAgentData.address}
              onChange={(e) => setNewAgentData({...newAgentData, address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter agent's address"
              rows={2}
              required
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewAgentForm(false)}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createAgentMutation.isPending}
              className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              {createAgentMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Register Agent
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    )}

    {/* Agent Performance Summary Cards */}
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white">
        <BarChart3 className="h-4 w-4 opacity-90 mb-1" />
        <div className="text-lg font-bold mb-0.5">
          ETB {formatAmount(getAgentsList().reduce((sum, agent) => sum + (agent.total_deposits || 0), 0))}
        </div>
        <div className="text-xs opacity-90">Total Collected</div>
      </div>
      
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 text-white">
        <DollarSign className="h-4 w-4 opacity-90 mb-1" />
        <div className="text-lg font-bold mb-0.5">
          ETB {formatAmount(getAgentsList().reduce((sum, agent) => sum + (agent.agent_gain || 0), 0))}
        </div>
        <div className="text-xs opacity-90">Agent Commissions</div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 mb-4">
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white">
        <Wallet className="h-4 w-4 opacity-90 mb-1" />
        <div className="text-lg font-bold mb-0.5">
          ETB {formatAmount(getAgentsList().reduce((sum, agent) => sum + (agent.admin_gain || 0), 0))}
        </div>
        <div className="text-xs opacity-90">Admin Revenue</div>
      </div>
      
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 text-white">
        <Users className="h-4 w-4 opacity-90 mb-1" />
        <div className="text-lg font-bold mb-0.5">
          {getAgentsList().length}
        </div>
        <div className="text-xs opacity-90">Total Agents</div>
      </div>
    </div>

    {/* Agents List */}
    {getAgentsList().length === 0 ? (
      <div className="text-center py-8 bg-white rounded-lg shadow-sm border">
        <UserCheck className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <h3 className="text-sm font-medium text-gray-900 mb-1">No agents found</h3>
        <p className="text-xs text-gray-500 mb-4">No agent data available</p>
        <button
          onClick={() => setShowNewAgentForm(true)}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 active:scale-95"
        >
          Add Your First Agent
        </button>
      </div>
    ) : (
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 px-3 py-2 border-b">
          <div className="grid grid-cols-12 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">Agent</div>
            <div className="col-span-2">Deposit</div>
            <div className="col-span-2">Withdraw</div>
            <div className="col-span-2">Commission</div>
            <div className="col-span-2">Admin Fee</div>
          </div>
        </div>
        
        {/* Agents List */}
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {getAgentsList().map((agent, index) => (
            <div key={agent.id || index} className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100">
              <div className="grid grid-cols-12 items-center">
                {/* Agent Name */}
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {agent.name || agent.user?.username || `Agent ${index + 1}`}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {agent.phone_number || 'No phone'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Total Deposit */}
                <div className="col-span-2">
                  <div className="text-xs text-gray-900">
                    ETB {formatAmount(agent.total_deposits || 0)}
                  </div>
                </div>
                
                {/* Total Withdraw */}
                <div className="col-span-2">
                  <div className="text-xs text-gray-900">
                    ETB {formatAmount(agent.total_withdrawals || agent.total_withdraws || 0)}
                  </div>
                </div>
                
                {/* Agent Commission */}
                <div className="col-span-2">
                  <div className="text-xs font-medium text-green-600">
                    ETB {formatAmount(agent.agent_gain || 0)}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {agent.commission_rate || 5}%
                  </div>
                </div>
                
                {/* Admin Fee */}
                <div className="col-span-2">
                  <div className="text-xs font-medium text-purple-600">
                    ETB {formatAmount(agent.admin_gain || 0)}
                  </div>
                </div>
              </div>
              
              {/* Additional Info Row */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">
                    Total Transactions: {(agent.total_rounds || 0).toLocaleString()}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleViewAgentDetails(agent)}
                      className="text-blue-600 text-[10px] font-medium px-2 py-1 hover:bg-blue-50 rounded"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditAgent(agent)}
                      className="text-green-600 text-[10px] font-medium px-2 py-1 hover:bg-green-50 rounded"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Agent Statistics Summary */}
    {getAgentsList().length > 0 && (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-xs font-bold text-gray-900 mb-2">Agent Statistics Summary</h4>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Total Collections:</span>
            <span className="text-xs font-bold">
              ETB {formatAmount(getAgentsList().reduce((sum, agent) => sum + (agent.total_deposits || 0) + (agent.total_withdrawals || agent.total_withdraws || 0), 0))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Total Agent Commission:</span>
            <span className="text-xs font-bold text-green-600">
              ETB {formatAmount(getAgentsList().reduce((sum, agent) => sum + (agent.agent_gain || 0), 0))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Total Admin Revenue:</span>
            <span className="text-xs font-bold text-purple-600">
              ETB {formatAmount(getAgentsList().reduce((sum, agent) => sum + (agent.admin_gain || 0), 0))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Average Commission Rate:</span>
            <span className="text-xs font-bold">
              {getAgentsList().length > 0 
                ? (getAgentsList().reduce((sum, agent) => sum + (parseFloat(agent.commission_rate) || 5), 0) / getAgentsList().length).toFixed(1)
                : 0}%
            </span>
          </div>
        </div>
      </div>
    )}
  </div>
)}

          

            {/* Deposits Tab */}
            {activeTab === 'deposits' && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  {isAgent ? 'My Deposits' : 'Deposit Management'}
                </h2>
                
                {depositsLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : filteredDeposits.length === 0 ? (
                  <div className="text-center py-8 bg-white rounded-lg shadow-sm border">
                    <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No deposits found</h3>
                    <p className="text-xs text-gray-500">No deposit requests available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDeposits.map((deposit) => (
                      <div key={deposit.id} className="bg-white rounded-lg shadow-sm border p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`p-1 rounded ${
                                deposit.status === 'approved' ? 'bg-green-100 text-green-600' :
                                deposit.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                'bg-yellow-100 text-yellow-600'
                              }`}>
                                <CreditCard className="h-3 w-3" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {typeof deposit.user === 'string' ? deposit.user : deposit.user?.username || 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">{deposit.phone_number || ''}</div>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="text-base font-bold text-gray-900">
                                ETB {formatAmount(deposit.amount)}
                              </div>
                              <div className="text-xs text-gray-600">{deposit.payment_method_display}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                              deposit.status === 'approved' ? 'bg-green-100 text-green-800' :
                              deposit.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {deposit.status}
                            </span>
                            <div className="text-[10px] text-gray-500">
                              {deposit.created_at ? format(new Date(deposit.created_at), 'MMM d') : 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            {deposit.proof_image && (
                              <button
                                onClick={() => setSelectedImage(deposit.proof_image)}
                                className="text-blue-600 text-xs font-medium flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                View Proof
                              </button>
                            )}
                          </div>
                          {deposit.status === 'pending' && (isSuperUser || !isAgent) && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleApproveDeposit(deposit.id)}
                                disabled={approveDepositMutation.isPending}
                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50 active:scale-95"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectDeposit(deposit.id)}
                                disabled={rejectDepositMutation.isPending}
                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 active:scale-95"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Withdrawals Tab */}
            {activeTab === 'withdrawals' && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" />
                  {isAgent ? 'My Withdrawals' : 'Withdrawal Management'}
                </h2>
                
                {withdrawsLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : filteredWithdrawals.length === 0 ? (
                  <div className="text-center py-8 bg-white rounded-lg shadow-sm border">
                    <Send className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No withdrawals found</h3>
                    <p className="text-xs text-gray-500">No withdrawal requests available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredWithdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="bg-white rounded-lg shadow-sm border p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`p-1 rounded ${
                                withdrawal.status === 'approved' ? 'bg-green-100 text-green-600' :
                                withdrawal.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                'bg-yellow-100 text-yellow-600'
                              }`}>
                                <Send className="h-3 w-3" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {typeof withdrawal.user === 'string' ? withdrawal.user : withdrawal.user?.username || 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">{withdrawal.phone_number || ''}</div>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="text-base font-bold text-gray-900">
                                ETB {formatAmount(withdrawal.amount)}
                              </div>
                              <div className="text-xs text-gray-900 truncate">{withdrawal.account_name}</div>
                              <div className="text-xs text-gray-600">{withdrawal.account_number}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                              withdrawal.status === 'approved' ? 'bg-green-100 text-green-800' :
                              withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {withdrawal.status}
                            </span>
                            <div className="text-[10px] text-gray-500">
                              {withdrawal.created_at ? format(new Date(withdrawal.created_at), 'MMM d') : 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="text-xs text-gray-500">
                            {withdrawal.created_at ? new Date(withdrawal.created_at).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            }) : 'N/A'}
                          </div>
                          {withdrawal.status === 'pending' && (isSuperUser || !isAgent) && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleApproveWithdrawal(withdrawal.id)}
                                disabled={approveWithdrawMutation.isPending}
                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50 active:scale-95"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectWithdrawal(withdrawal.id)}
                                disabled={rejectWithdrawMutation.isPending}
                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 active:scale-95"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Players Tab - Only show for superuser/admin */}
            {activeTab === 'players' && (isSuperUser || !isAgent) && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Players Management
                </h2>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white">
                    <Users className="h-4 w-4 opacity-90 mb-1" />
                    <div className="text-lg font-bold mb-0.5">{getSafeStat('total_users', 0)}</div>
                    <div className="text-xs opacity-90">Total Players</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 text-white">
                    <BarChart3 className="h-4 w-4 opacity-90 mb-1" />
                    <div className="text-lg font-bold mb-0.5">{getSafeStat('active_users_today', 0)}</div>
                    <div className="text-xs opacity-90">Active Today</div>
                  </div>
                </div>
                
                {usersLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 bg-white rounded-lg shadow-sm border">
                    <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No players found</h3>
                    <p className="text-xs text-gray-500">No player data available</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      {filteredUsers.map((player) => (
                        <div key={player.id} className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <User className="h-3 w-3 text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {player.username}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{player.email}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold">ETB {formatAmount(player.balance)}</div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                player.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {player.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

           {/* Profile Tab - Only for agents */}
{activeTab === 'profile' && isAgent && (
  <div className="space-y-4">
    <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
      <User className="h-4 w-4 text-blue-500" />
      My Profile
    </h2>
    
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">{user?.username}</h3>
          <p className="text-sm text-gray-600">{user?.email}</p>
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
            Agent
          </span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
          <div className="text-sm text-gray-900">{getSafeData(agentDashboardData, 'agent.phone_number') || 'N/A'}</div>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Commission Rate</label>
          <div className="text-sm text-gray-900">{getSafeData(agentDashboardData, 'agent.commission_rate') || 0}%</div>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Total Earnings</label>
          <div className="text-lg font-bold text-green-600">
            ETB {formatAmount(getSafeData(agentDashboardData, 'agent.total_earnings') || 0)}
          </div>
        </div>
      </div>
    </div>

    {/* Payment Accounts Section */}
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" />
          My Payment Accounts
        </h3>
        <button
          onClick={() => setShowPaymentForm(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {loadingPaymentAccounts ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading payment accounts...</p>
        </div>
      ) : paymentAccounts.length > 0 ? (
        <div className="space-y-3">
          {paymentAccounts.map((account) => (
            <div key={account.id} className="border rounded-lg p-3 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{account.account_name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      account.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-1">
                    {account.payment_method_display} • {account.account_number}
                  </div>
                  <div className="text-xs text-gray-500">
                    Limits: ETB {formatAmount(account.min_amount)} - {formatAmount(account.max_amount)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(account.id, account.is_active)}
                    className={`px-2 py-1 text-xs rounded ${
                      account.is_active 
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {account.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEditAccount(account)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {account.qr_code && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-700 mb-2">QR Code:</p>
                  <img 
                    src={account.qr_code} 
                    alt="QR Code" 
                    className="h-24 w-24 object-contain border rounded"
                  />
                </div>
              )}
              
              {account.instructions && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-gray-700 mb-1">Instructions:</p>
                  <p className="text-xs text-gray-600">{account.instructions}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No payment accounts found</p>
          <p className="text-sm text-gray-400">Add your first payment account to start receiving payments</p>
        </div>
      )}
    </div>
  </div>
)}

{/* Payment Account Form Modal */}
{showPaymentForm && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div className="p-4 border-b">
        <h3 className="text-lg font-bold text-gray-900">
          {editingAccount ? 'Edit Payment Account' : 'Add Payment Account'}
        </h3>
      </div>
      
      <form onSubmit={handleSubmitPaymentAccount} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method *
          </label>
          <select
            value={paymentFormData.payment_method}
            onChange={(e) => setPaymentFormData({...paymentFormData, payment_method: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select Payment Method</option>
            <option value="telebirr">TeleBirr</option>
            <option value="cbe_birr">CBE Birr</option>
            <option value="bank">Bank Transfer</option>
            <option value="awash">Awash Bank</option>
            <option value="dashen">Dashen Bank</option>
            <option value="boa">Bank of Abyssinia</option>
            <option value="abyssinia">Abyssinia Bank</option>
            <option value="hibret">Hibret Bank</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account Name *
          </label>
          <input
            type="text"
            value={paymentFormData.account_name}
            onChange={(e) => setPaymentFormData({...paymentFormData, account_name: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter account name"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account Number *
          </label>
          <input
            type="text"
            value={paymentFormData.account_number}
            onChange={(e) => setPaymentFormData({...paymentFormData, account_number: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter account/phone number"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={paymentFormData.phone_number || ''}
            onChange={(e) => setPaymentFormData({...paymentFormData, phone_number: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Optional phone number"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bank Name
          </label>
          <input
            type="text"
            value={paymentFormData.bank_name || ''}
            onChange={(e) => setPaymentFormData({...paymentFormData, bank_name: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Bank name (if applicable)"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Amount (ETB) *
            </label>
            <input
              type="number"
              value={paymentFormData.min_amount}
              onChange={(e) => setPaymentFormData({...paymentFormData, min_amount: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              step="0.01"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Amount (ETB) *
            </label>
            <input
              type="number"
              value={paymentFormData.max_amount}
              onChange={(e) => setPaymentFormData({...paymentFormData, max_amount: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            QR Code
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {qrCodePreview && (
            <div className="mt-2">
              <img 
                src={qrCodePreview} 
                alt="QR Code Preview" 
                className="h-32 w-32 object-contain border rounded"
              />
            </div>
          )}
          {paymentFormData.qr_code && typeof paymentFormData.qr_code === 'string' && !qrCodePreview && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">Current QR Code:</p>
              <img 
                src={paymentFormData.qr_code} 
                alt="Current QR Code" 
                className="h-32 w-32 object-contain border rounded mt-1"
              />
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instructions
          </label>
          <textarea
            value={paymentFormData.instructions || ''}
            onChange={(e) => setPaymentFormData({...paymentFormData, instructions: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            placeholder="Payment instructions for users..."
          />
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={paymentFormData.is_active}
            onChange={(e) => setPaymentFormData({...paymentFormData, is_active: e.target.checked})}
            className="h-4 w-4 text-blue-600 rounded"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">
            Activate this account immediately
          </label>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => {
              setShowPaymentForm(false);
              setEditingAccount(null);
              setPaymentFormData(initialPaymentFormData);
              setQrCodePreview(null);
            }}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submittingPaymentAccount}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submittingPaymentAccount ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : editingAccount ? (
              'Update Account'
            ) : (
              'Add Account'
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-500" />
                  {isAgent ? 'My Transaction History' : 'Transaction History'}
                </h2>
                
                <div className="text-center py-8 bg-white rounded-lg shadow-sm border">
                  <History className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Transaction History</h3>
                  <p className="text-xs text-gray-500 px-4">
                    {isAgent 
                      ? 'Your transaction history will appear here'
                      : 'All transactions based on the selected date range'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Settings Tab - Only for superuser */}
            {activeTab === 'settings' && isSuperUser && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-blue-500" />
                  System Settings
                </h2>
                
                <div className="text-center py-8 bg-white rounded-lg shadow-sm border">
                  <Settings className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Settings Panel</h3>
                  <p className="text-xs text-gray-500 px-4">This section contains system configuration options</p>
                </div>
              </div>
            )}
          </main>

          {/* Android Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 max-w-[360px] mx-auto">
            <div className="flex justify-around items-center py-2 px-1">
              {tabs.slice(0, 5).map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                const pendingCount = tab.id === 'deposits' 
                  ? (getSafeStat('pending_deposits') || 0)
                  : tab.id === 'withdrawals'
                  ? (getSafeStat('pending_withdrawals') || 0)
                  : 0
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center p-1.5 relative flex-1 min-w-0 ${
                      isActive ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5" />
                      {pendingCount > 0 && (isSuperUser || !isAgent) && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] mt-1 ${isActive ? 'font-bold' : ''}`}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <div className="absolute top-0 w-8 h-1 bg-blue-600 rounded-full"></div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Rendering error in Admin component:', error)
    
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-gray-900 mb-2">Component Error</h2>
          <p className="text-xs text-gray-600 mb-4">
            {error.message || 'An error occurred while rendering the dashboard'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }
}

// Add Percent icon component
const Percent = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-6m-6 6h6m6 3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default Admin