import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsAPI } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { 
  Wallet as WalletIcon, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  History,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  Smartphone,
  CreditCard,
  QrCode,
  ChevronDown,
  AlertCircle,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe,
  Download,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react'

const Wallet = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // States for withdraw
  const [showWithdrawForm, setShowWithdrawForm] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState(1)
  const [selectedWithdrawMethod, setSelectedWithdrawMethod] = useState(null)
  const [withdrawData, setWithdrawData] = useState({
    payment_account: '',
    account_name: '',
    account_number: '',
    phone_number: '',
    amount: '',
  })

  // States for deposit
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [depositStep, setDepositStep] = useState(1)
  const [selectedDepositMethod, setSelectedDepositMethod] = useState(null)
  const [depositData, setDepositData] = useState({
    payment_account: '',
    account_name: '',
    account_number: '',
    phone_number: '',
    amount: '',
    proof_image: null,
  })

  // New states for enhanced features
  const [language, setLanguage] = useState('am') // 'am' or 'en'
  const [showBalance, setShowBalance] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [dateFilter, setDateFilter] = useState('today')
  const [customDate, setCustomDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [filteredData, setFilteredData] = useState({
    deposits: [],
    withdrawRequests: [],
    transactions: []
  })

  // Date calculations
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastMonth = new Date(today)
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  const formatDate = (date, format = 'short') => {
    if (language === 'en') {
      return date.toLocaleDateString('en-US', {
        weekday: format === 'long' ? 'long' : 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
    return date.toLocaleDateString('am-ET', {
      weekday: format === 'long' ? 'long' : 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Queries
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => transactionsAPI.getWallet(),
    staleTime: 30000,
  })

  const { data: paymentAccounts } = useQuery({
    queryKey: ['paymentAccounts'],
    queryFn: () => transactionsAPI.getPaymentAccounts(),
  })

  const { data: deposits } = useQuery({
    queryKey: ['deposits'],
    queryFn: () => transactionsAPI.getDeposits(),
  })

  const { data: withdrawRequests } = useQuery({
    queryKey: ['withdrawRequests'],
    queryFn: () => transactionsAPI.getWithdrawRequests(),
  })

  const { data: transactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionsAPI.getTransactions(),
  })

  // Filter data based on date filter
  useEffect(() => {
    if (!deposits?.data || !withdrawRequests?.data || !transactions?.data) return

    const filterDataByDate = (items) => {
      return items.filter(item => {
        const itemDate = new Date(item.created_at)
        let filterDate = today
        
        switch(dateFilter) {
          case 'today':
            return itemDate.toDateString() === today.toDateString()
          case 'yesterday':
            return itemDate.toDateString() === yesterday.toDateString()
          case 'lastWeek':
            return itemDate >= lastWeek && itemDate <= today
          case 'lastMonth':
            return itemDate >= lastMonth && itemDate <= today
          case 'custom':
            if (!customDate) return true
            const custom = new Date(customDate)
            return itemDate.toDateString() === custom.toDateString()
          default:
            return true
        }
      })
    }

    // Filter by search query
    const filterBySearch = (items) => {
      if (!searchQuery.trim()) return items
      return items.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    }

    setFilteredData({
      deposits: filterBySearch(filterDataByDate(deposits.data)),
      withdrawRequests: filterBySearch(filterDataByDate(withdrawRequests.data)),
      transactions: filterBySearch(filterDataByDate(transactions.data))
    })
  }, [deposits, withdrawRequests, transactions, dateFilter, customDate, searchQuery])

  // Mutations
  const createWithdrawMutation = useMutation({
    mutationFn: (data) => transactionsAPI.createWithdrawRequest(data),
    onSuccess: () => {
      toast.success(language === 'en' ? 'Withdrawal request submitted successfully!' : 'የገንዘብ ማውጣት ጥያቄዎ ቀርቧል!')
      resetWithdrawForm()
      queryClient.invalidateQueries(['wallet'])
      queryClient.invalidateQueries(['withdrawRequests'])
      queryClient.invalidateQueries(['transactions'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.response?.data?.detail || 
        (language === 'en' ? 'An error occurred' : 'ስህተት ተከስቷል'))
    },
  })

  const createDepositMutation = useMutation({
    mutationFn: (data) => transactionsAPI.createDeposit(data),
    onSuccess: () => {
      toast.success(language === 'en' ? 'Deposit submitted! Awaiting approval.' : 'የእርስዎ አስገባት ቀርቧል! ለመፍቀድ በጥበቃ ላይ ነው።')
      resetDepositForm()
      queryClient.invalidateQueries(['deposits'])
    },
    onError: (error) => {
      const errors = error.response?.data
      if (errors) {
        Object.keys(errors).forEach(key => {
          if (Array.isArray(errors[key])) {
            errors[key].forEach(err => {
              toast.error(`${key}: ${err}`)
            })
          } else {
            toast.error(`${key}: ${errors[key]}`)
          }
        })
      } else {
        toast.error(language === 'en' ? 'An error occurred' : 'ስህተት ተከስቷል')
      }
    },
  })

  // Filter active payment accounts by type
  const getPaymentAccountsByType = (type) => {
    if (!paymentAccounts?.data) return []
    
    return paymentAccounts.data.filter(account => {
      if (type === 'mobile') {
        return ['telebirr', 'cbe_birr'].includes(account.payment_method)
      } else if (type === 'bank') {
        return ['bank', 'awash', 'dashen', 'boa', 'abyssinia', 'hibret'].includes(account.payment_method)
      }
      return true
    })
  }

  const getPaymentMethodIcon = (method) => {
    switch(method) {
      case 'telebirr':
      case 'cbe_birr':
        return <Smartphone className="h-5 w-5" />
      case 'bank':
      case 'awash':
      case 'dashen':
      case 'boa':
      case 'abyssinia':
      case 'hibret':
        return <CreditCard className="h-5 w-5" />
      default:
        return <Banknote className="h-5 w-5" />
    }
  }

  const getPaymentMethodLabel = (method) => {
    const labelsAm = {
      'telebirr': 'ስልክ ብር (TeleBirr)',
      'cbe_birr': 'ኢ.ብ (CBE Birr)',
      'bank': 'ባንክ አቅርቦት',
      'awash': 'አዋሽ ባንክ',
      'dashen': 'ዳሸን ባንክ',
      'boa': 'ብ.ኦ.አ (Bank of Abyssinia)',
      'abyssinia': 'አቢሲንያ ባንክ',
      'hibret': 'ህብረት ባንክ',
    }
    const labelsEn = {
      'telebirr': 'TeleBirr',
      'cbe_birr': 'CBE Birr',
      'bank': 'Bank Transfer',
      'awash': 'Awash Bank',
      'dashen': 'Dashen Bank',
      'boa': 'Bank of Abyssinia',
      'abyssinia': 'Abyssinia Bank',
      'hibret': 'Hibret Bank',
    }
    return language === 'en' ? labelsEn[method] || method : labelsAm[method] || method
  }

  // Translation functions
  const t = {
    // Common
    wallet: language === 'en' ? 'Wallet' : 'ቦርሳ',
    currentBalance: language === 'en' ? 'Current Balance' : 'የአሁኑ ሒሳብ',
    withdraw: language === 'en' ? 'Withdraw' : 'ገንዘብ አውጣ',
    deposit: language === 'en' ? 'Deposit' : 'ገንዘብ አስገባ',
    history: language === 'en' ? 'History' : 'ታሪክ',
    transactions: language === 'en' ? 'Transactions' : 'ግብይቶች',
    pending: language === 'en' ? 'Pending' : 'በጥበቃ',
    approved: language === 'en' ? 'Approved' : 'ፍቀድ',
    rejected: language === 'en' ? 'Rejected' : 'ውድቅ',
    completed: language === 'en' ? 'Completed' : 'የተጠናቀቀ',
    amount: language === 'en' ? 'Amount' : 'መጠን',
    date: language === 'en' ? 'Date' : 'ቀን',
    status: language === 'en' ? 'Status' : 'ሁኔታ',
    details: language === 'en' ? 'Details' : 'ዝርዝሮች',
    search: language === 'en' ? 'Search...' : 'ፈልግ...',
    filter: language === 'en' ? 'Filter' : 'አጣራ',
    today: language === 'en' ? 'Today' : 'ዛሬ',
    yesterday: language === 'en' ? 'Yesterday' : 'ትላንት',
    lastWeek: language === 'en' ? 'Last Week' : 'ባለፈው ሳምንት',
    lastMonth: language === 'en' ? 'Last Month' : 'ባለፈው ወር',
    customDate: language === 'en' ? 'Custom Date' : 'በእጅ ቀን',
    all: language === 'en' ? 'All' : 'ሁሉም',
    refresh: language === 'en' ? 'Refresh' : 'አድስ',
    download: language === 'en' ? 'Download' : 'አውርድ',
    
    // Withdraw form
    selectPaymentMethod: language === 'en' ? 'Select Payment Method' : 'የክፍያ ዘዴ ይምረጡ',
    accountName: language === 'en' ? 'Account Name' : 'የአካውንት ስም',
    accountNumber: language === 'en' ? 'Account Number' : 'የአካውንት ቁጥር',
    phoneNumber: language === 'en' ? 'Phone Number' : 'ስልክ ቁጥር',
    enterAmount: language === 'en' ? 'Enter Amount' : 'መጠን ያስገቡ',
    minAmount: language === 'en' ? 'Minimum Amount' : 'ዝቅተኛ መጠን',
    maxAmount: language === 'en' ? 'Maximum Amount' : 'ከፍተኛ መጠን',
    submitRequest: language === 'en' ? 'Submit Request' : 'ጥያቄ አቅርብ',
    cancel: language === 'en' ? 'Cancel' : 'ሰርዝ',
    
    // Deposit form
    uploadProof: language === 'en' ? 'Upload Payment Proof' : 'የክፍያ ማስረጃ ይጭኑ',
    chooseFile: language === 'en' ? 'Choose File' : 'ፋይል ይምረጡ',
    dragHere: language === 'en' ?'or drag here' : 'ወይም እዚህ ይጎትቱ',
    fileTypes: language === 'en' ? 'PNG, JPG, GIF up to 5MB' : 'PNG, JPG, GIF እስከ 5MB',
    submitDeposit: language === 'en' ? 'Submit Deposit' : 'አስገባ',
    
    // Empty states
    noPaymentAccounts: language === 'en' ? 'No payment accounts registered yet' : 'እስካሁን ምንም የክፍያ አካውንት አልተመዘገበም',
    noDeposits: language === 'en' ? 'No deposits yet' : 'እስካሁን ምንም አስገባት የለም',
    noWithdrawals: language === 'en' ? 'No withdrawal requests yet' : 'እስካሁን ምንም የገንዘብ ማውጣት ጥያቄ የለም',
    noTransactions: language === 'en' ? 'No transactions yet' : 'እስካሁን ምንም ግብይት የለም',
  }

  // Withdraw Functions
  const handleSelectWithdrawMethod = (account) => {
    setSelectedWithdrawMethod(account)
    setWithdrawData(prev => ({
      ...prev,
      payment_account: account.id,
      amount: '',
    }))
    setWithdrawStep(2)
  }

  const handleWithdrawSubmit = (e) => {
    e.preventDefault()
    
    if (!withdrawData.amount || parseFloat(withdrawData.amount) <= 0) {
      toast.error(language === 'en' ? 'Please enter a valid amount' : 'ትክክለኛ መጠን ያስገቡ')
      return
    }

    createWithdrawMutation.mutate(withdrawData)
  }

  const resetWithdrawForm = () => {
    setShowWithdrawForm(false)
    setWithdrawStep(1)
    setSelectedWithdrawMethod(null)
    setWithdrawData({
      payment_account: '',
      account_name: '',
      account_number: '',
      phone_number: '',
      amount: '',
    })
  }

  // Deposit Functions
  const handleSelectDepositMethod = (account) => {
    setSelectedDepositMethod(account)
    setDepositData(prev => ({
      ...prev,
      payment_account: account.id,
      amount: '',
      account_name: account.account_name,
      account_number: account.account_number,
      phone_number: account.phone_number || '',
    }))
    setDepositStep(2)
  }

  const handleDepositSubmit = (e) => {
    e.preventDefault()
    
    if (!depositData.amount || parseFloat(depositData.amount) <= 0) {
      toast.error(language === 'en' ? 'Please enter a valid amount' : 'ትክክለኛ መጠን ያስገቡ')
      return
    }

    if (!depositData.proof_image) {
      toast.error(language === 'en' ? 'Please upload payment proof' : 'የክፍያ ማስረጃ ምስል ያስገቡ')
      return
    }

    const formData = new FormData()
    formData.append('payment_account', depositData.payment_account)
    formData.append('amount', depositData.amount.toString())
    
    if (depositData.account_name) formData.append('account_name', depositData.account_name)
    if (depositData.account_number) formData.append('account_number', depositData.account_number)
    if (depositData.phone_number) formData.append('phone_number', depositData.phone_number)
    if (depositData.proof_image) formData.append('proof_image', depositData.proof_image)

    createDepositMutation.mutate(formData)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(language === 'en' ? 'File too large (max 5MB)' : 'ምስሉ በጣም ትልቅ ነው (ከ 5MB አይበልጥም)')
        e.target.value = ''
        return
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error(language === 'en' ? 'Please select an image file' : 'ምስል ፋይል ብቻ ይምረጡ')
        e.target.value = ''
        return
      }
      
      setDepositData({ ...depositData, proof_image: file })
    }
  }

  const resetDepositForm = () => {
    setShowDepositForm(false)
    setDepositStep(1)
    setSelectedDepositMethod(null)
    setDepositData({
      payment_account: '',
      account_name: '',
      account_number: '',
      phone_number: '',
      amount: '',
      proof_image: null,
    })
  }

  const walletBalance = wallet?.data?.balance || 0

  return (
    <div className="space-y-6">
      {/* Header with Language and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.wallet}</h1>
          <p className="text-gray-600 dark:text-gray-300">
            {formatDate(today, 'long')}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Globe className="h-4 w-4" />
            <span className="font-medium">{language === 'en' ? 'አማርኛ' : 'English'}</span>
          </button>

          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search}
            className="pl-10 w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Date Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.filter}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              {showDatePicker ? (language === 'en' ? 'Hide' : 'ደብቅ') : (language === 'en' ? 'Custom Date' : 'በእጅ ቀን')}
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {['today', 'yesterday', 'lastWeek', 'lastMonth'].map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 rounded-lg transition-all ${
                dateFilter === filter
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t[filter]}
            </button>
          ))}
        </div>

        {/* Custom Date Picker */}
        {showDatePicker && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value)
                  setDateFilter('custom')
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
              {customDate && (
                <button
                  onClick={() => {
                    setCustomDate('')
                    setDateFilter('today')
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  {language === 'en' ? 'Clear' : 'አጽዳ'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wallet Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-purple-600 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 h-32 w-32 rounded-full bg-white opacity-10"></div>
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 h-32 w-32 rounded-full bg-white opacity-10"></div>
        
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">{t.currentBalance}</p>
              <div className="flex items-center space-x-3">
                <p className="text-5xl font-bold tracking-tight">
                  {showBalance ? walletBalance.toLocaleString() : '••••••'}
                </p>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  {showBalance ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-sm opacity-90 mt-4">{user?.username}</p>
            </div>
            <div className="relative">
              <WalletIcon className="h-20 w-20 opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent blur-xl"></div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>Total Income</span>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4" />
                <span>Total Withdrawals</span>
              </div>
            </div>
            {walletLoading && (
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>{language === 'en' ? 'Updating...' : 'በማዘመን ላይ...'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Withdraw Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <ArrowUpFromLine className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.withdraw}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'en' ? 'Request money withdrawal' : 'ገንዘብ ማውጣት ይጠይቁ'}
                  </p>
                </div>
              </div>
            </div>
            
            {!showWithdrawForm ? (
              <button
                onClick={() => setShowWithdrawForm(true)}
                className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg active:scale-[0.98]"
              >
                {language === 'en' ? 'New Withdrawal Request' : 'አዲስ የገንዘብ ማውጣት ጥያቄ'}
              </button>
            ) : (
              <div className="space-y-6">
                {/* Step Indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {[1, 2].map((step) => (
                      <div
                        key={step}
                        className={`h-2 w-16 rounded-full ${
                          withdrawStep >= step
                            ? 'bg-primary-600'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-500">
                    {language === 'en' ? 'Step' : 'ደረጃ'} {withdrawStep}/2
                  </span>
                </div>

                {/* Step 1: Select Payment Method */}
                {withdrawStep === 1 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{t.selectPaymentMethod}</h4>
                    
                    {/* Mobile Money Accounts */}
                    {getPaymentAccountsByType('mobile').length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                          <Smartphone className="h-4 w-4 mr-2" />
                          {language === 'en' ? 'Mobile Money' : 'ሞባይል ሞኒ'}
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {getPaymentAccountsByType('mobile').map(account => (
                            <button
                              key={account.id}
                              onClick={() => handleSelectWithdrawMethod(account)}
                              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-all hover:shadow-md text-left"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                  {getPaymentMethodIcon(account.payment_method)}
                                </div>
                                <div>
                                  <p className="font-semibold">{getPaymentMethodLabel(account.payment_method)}</p>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bank Accounts */}
                    {getPaymentAccountsByType('bank').length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                          <CreditCard className="h-4 w-4 mr-2" />
                          {language === 'en' ? 'Bank Accounts' : 'ባንክ አካውንቶች'}
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {getPaymentAccountsByType('bank').map(account => (
                            <button
                              key={account.id}
                              onClick={() => handleSelectWithdrawMethod(account)}
                              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-all hover:shadow-md text-left"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                  {getPaymentMethodIcon(account.payment_method)}
                                </div>
                                <div>
                                  <p className="font-semibold">{account.account_name}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{account.payment_method}</p>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentAccounts?.data?.length === 0 && (
                      <div className="text-center py-8">
                        <AlertCircle className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">{t.noPaymentAccounts}</p>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <button
                        onClick={resetWithdrawForm}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Enter Details */}
                {withdrawStep === 2 && selectedWithdrawMethod && (
                  <form onSubmit={handleWithdrawSubmit} className="space-y-6">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-5 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white dark:bg-gray-700 rounded-lg">
                            {getPaymentMethodIcon(selectedWithdrawMethod.payment_method)}
                          </div>
                          <div>
                            <p className="font-semibold">{getPaymentMethodLabel(selectedWithdrawMethod.payment_method)}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {selectedWithdrawMethod.account_number}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWithdrawStep(1)}
                          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          {language === 'en' ? 'Change' : 'ይቀይሩ'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t.accountName}
                        </label>
                        <input
                          type="text"
                          value={withdrawData.account_name}
                          onChange={(e) => setWithdrawData({ ...withdrawData, account_name: e.target.value })}
                          placeholder={language === 'en' ? 'Your account name' : 'የእርስዎ አካውንት ስም'}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t.accountNumber}
                        </label>
                        <input
                          type="text"
                          value={withdrawData.account_number}
                          onChange={(e) => setWithdrawData({ ...withdrawData, account_number: e.target.value })}
                          placeholder={language === 'en' ? 'Account number' : 'የአካውንት ቁጥር'}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          required
                        />
                      </div>

                      {selectedWithdrawMethod.payment_method && ['telebirr', 'cbe_birr'].includes(selectedWithdrawMethod.payment_method) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t.phoneNumber}
                          </label>
                          <input
                            type="tel"
                            value={withdrawData.phone_number}
                            onChange={(e) => setWithdrawData({ ...withdrawData, phone_number: e.target.value })}
                            placeholder="09XXXXXXXX"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t.amount} (ብር)
                        </label>
                        <input
                          type="number"
                          value={withdrawData.amount}
                          onChange={(e) => setWithdrawData({ ...withdrawData, amount: e.target.value })}
                          placeholder={`${t.minAmount}: ${selectedWithdrawMethod.min_amount} - ${t.maxAmount}: ${selectedWithdrawMethod.max_amount}`}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          min={selectedWithdrawMethod.min_amount}
                          max={Math.min(selectedWithdrawMethod.max_amount, walletBalance)}
                          step="0.01"
                          required
                        />
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-gray-500">{t.minAmount}: {selectedWithdrawMethod.min_amount} ብር</span>
                          <span className="text-gray-500">{t.maxAmount}: {selectedWithdrawMethod.max_amount} ብር</span>
                        </div>
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <button
                          type="submit"
                          disabled={createWithdrawMutation.isPending}
                          className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {createWithdrawMutation.isPending 
                            ? (language === 'en' ? 'Processing...' : 'በማስተናገድ ላይ...')
                            : t.submitRequest}
                        </button>
                        <button
                          type="button"
                          onClick={resetWithdrawForm}
                          className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Deposit Card - Similar structure as Withdraw Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <ArrowDownToLine className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.deposit}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'en' ? 'Add funds to your wallet' : 'ገንዘብ ወደ ቦርሳዎ ያስገቡ'}
                  </p>
                </div>
              </div>
            </div>
            
            {!showDepositForm ? (
              <button
                onClick={() => setShowDepositForm(true)}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg active:scale-[0.98]"
              >
                {language === 'en' ? 'New Deposit' : 'አዲስ አስገባት'}
              </button>
            ) : (
              <div className="space-y-6">
                {/* Step Indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {[1, 2].map((step) => (
                      <div
                        key={step}
                        className={`h-2 w-16 rounded-full ${
                          depositStep >= step
                            ? 'bg-primary-600'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-500">
                    {language === 'en' ? 'Step' : 'ደረጃ'} {depositStep}/2
                  </span>
                </div>

                {/* Step 1: Select Payment Method */}
                {depositStep === 1 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{t.selectPaymentMethod}</h4>
                    
                    {/* Mobile Money Accounts */}
                    {getPaymentAccountsByType('mobile').length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                          <Smartphone className="h-4 w-4 mr-2" />
                          {language === 'en' ? 'Mobile Money' : 'ሞባይል ሞኒ'}
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {getPaymentAccountsByType('mobile').map(account => (
                            <button
                              key={account.id}
                              onClick={() => handleSelectDepositMethod(account)}
                              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-all hover:shadow-md text-left"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                  {getPaymentMethodIcon(account.payment_method)}
                                </div>
                                <div>
                                  <p className="font-semibold">{getPaymentMethodLabel(account.payment_method)}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{account.account_number}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {account.qr_code && (
                                  <QrCode className="h-5 w-5 text-gray-400" />
                                )}
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bank Accounts */}
                    {getPaymentAccountsByType('bank').length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                          <CreditCard className="h-4 w-4 mr-2" />
                          {language === 'en' ? 'Bank Accounts' : 'ባንክ አካውንቶች'}
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {getPaymentAccountsByType('bank').map(account => (
                            <button
                              key={account.id}
                              onClick={() => handleSelectDepositMethod(account)}
                              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-all hover:shadow-md text-left"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                  {getPaymentMethodIcon(account.payment_method)}
                                </div>
                                <div>
                                  <p className="font-semibold">{account.account_name}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{account.bank_name}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">{account.account_number}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {account.qr_code && (
                                  <QrCode className="h-5 w-5 text-gray-400" />
                                )}
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentAccounts?.data?.length === 0 && (
                      <div className="text-center py-8">
                        <AlertCircle className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">{t.noPaymentAccounts}</p>
                      </div>
                    )}

                    <button
                      onClick={resetDepositForm}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {t.cancel}
                    </button>
                  </div>
                )}

                {/* Step 2: Upload Proof */}
                {depositStep === 2 && selectedDepositMethod && (
                  <form onSubmit={handleDepositSubmit} className="space-y-6">
                    {/* Payment Info Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-5 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white dark:bg-gray-700 rounded-lg">
                            {getPaymentMethodIcon(selectedDepositMethod.payment_method)}
                          </div>
                          <div>
                            <p className="font-semibold">{getPaymentMethodLabel(selectedDepositMethod.payment_method)}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {selectedDepositMethod.account_name}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDepositStep(1)}
                          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          {language === 'en' ? 'Change' : 'ይቀይሩ'}
                        </button>
                      </div>

                      {selectedDepositMethod.qr_code && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            {language === 'en' ? 'Scan to Pay' : 'ክፍያ ለመፈጸም ይቃኙ'}
                          </p>
                          <div className="flex justify-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                            <img 
                              src={selectedDepositMethod.qr_code} 
                              alt="Payment QR Code"
                              className="h-40 w-40 object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t.amount} (ብር)
                        </label>
                        <input
                          type="number"
                          value={depositData.amount}
                          onChange={(e) => setDepositData({ ...depositData, amount: e.target.value })}
                          placeholder={`${t.minAmount}: ${selectedDepositMethod.min_amount} - ${t.maxAmount}: ${selectedDepositMethod.max_amount}`}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          min={selectedDepositMethod.min_amount}
                          max={selectedDepositMethod.max_amount}
                          step="0.01"
                          required
                        />
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-gray-500">{t.minAmount}: {selectedDepositMethod.min_amount} ብር</span>
                          <span className="text-gray-500">{t.maxAmount}: {selectedDepositMethod.max_amount} ብር</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t.uploadProof}
                        </label>
                        <div className="mt-1">
                          <label className="block cursor-pointer">
                            <div className="flex flex-col items-center justify-center px-6 pt-10 pb-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 transition-colors bg-gray-50/50 dark:bg-gray-800/50">
                              <ArrowDownToLine className="h-12 w-12 text-gray-400 mb-4" />
                              <div className="flex flex-col items-center text-center">
                                <span className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors">
                                  {t.chooseFile}
                                </span>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                                  {t.dragHere}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                  {t.fileTypes}
                                </p>
                              </div>
                            </div>
                            <input
                              type="file"
                              name="proof_image"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="sr-only"
                              required
                            />
                          </label>
                        </div>
                        
                        {depositData.proof_image && (
                          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                                <div>
                                  <p className="font-medium text-green-800 dark:text-green-300">
                                    {depositData.proof_image.name}
                                  </p>
                                  <p className="text-sm text-green-600 dark:text-green-400">
                                    {(depositData.proof_image.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDepositData({ ...depositData, proof_image: null })}
                                className="text-sm text-red-600 hover:text-red-700"
                              >
                                {language === 'en' ? 'Remove' : 'አስወግድ'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <button
                          type="submit"
                          disabled={createDepositMutation.isPending}
                          className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {createDepositMutation.isPending 
                            ? (language === 'en' ? 'Processing...' : 'በማስተናገድ ላይ...')
                            : t.submitDeposit}
                        </button>
                        <button
                          type="button"
                          onClick={resetDepositForm}
                          className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deposits History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <ArrowDownToLine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {language === 'en' ? 'Deposit History' : 'የአስገባቶች ታሪክ'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredData.deposits.length} {language === 'en' ? 'items' : 'ንጥሎች'}
                </p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <Download className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {filteredData.deposits.map((deposit) => (
              <div 
                key={deposit.id} 
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-bold text-lg">
                        {parseFloat(deposit.amount).toLocaleString()} ብር
                      </p>
                      <div className="flex items-center space-x-2">
                        {getPaymentMethodIcon(deposit.payment_account_detail?.payment_method)}
                        <span className="text-sm text-gray-500">
                          {deposit.payment_account_detail?.payment_method_display}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(new Date(deposit.created_at))}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      deposit.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      deposit.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {deposit.status_display}
                    </span>
                    {deposit.proof_image && (
                      <a 
                        href={deposit.proof_image} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>{language === 'en' ? 'View Proof' : 'ማስረጃ ይመልከቱ'}</span>
                      </a>
                    )}
                  </div>
                </div>
                {deposit.admin_notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{language === 'en' ? 'Note:' : 'ማስታወሻ:'}</span> {deposit.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {filteredData.deposits.length === 0 && (
              <div className="text-center py-12">
                <ArrowDownToLine className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">{t.noDeposits}</p>
              </div>
            )}
          </div>
        </div>

        {/* Withdraw Requests History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                <ArrowUpFromLine className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {language === 'en' ? 'Withdrawal Requests' : 'የገንዘብ ማውጣት ጥያቄዎች'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredData.withdrawRequests.length} {language === 'en' ? 'items' : 'ንጥሎች'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {filteredData.withdrawRequests.map((request) => (
              <div 
                key={request.id} 
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">
                      {parseFloat(request.amount).toLocaleString()} ብር
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(new Date(request.created_at))}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {language === 'en' ? 'To:' : 'ወደ:'} {request.account_number}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {request.status === 'pending' && (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    )}
                    {request.status === 'approved' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {request.status === 'rejected' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      request.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {request.status_display}
                    </span>
                  </div>
                </div>
                {request.admin_notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{language === 'en' ? 'Note:' : 'ማስታወሻ:'}</span> {request.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {filteredData.withdrawRequests.length === 0 && (
              <div className="text-center py-12">
                <ArrowUpFromLine className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">{t.noWithdrawals}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transactions History */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.transactions}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredData.transactions.length} {language === 'en' ? 'items' : 'ንጥሎች'}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Download className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t.date}</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t.details}</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t.amount}</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.transactions.map((transaction) => (
                <tr 
                  key={transaction.id} 
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(new Date(transaction.created_at))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {transaction.type_display}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {transaction.description}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      {transaction.transaction_type === 'deposit' || 
                       transaction.transaction_type === 'prize_win' ||
                       transaction.transaction_type === 'refund' ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`font-bold ${
                        transaction.transaction_type === 'deposit' || 
                        transaction.transaction_type === 'prize_win' ||
                        transaction.transaction_type === 'refund' ? 
                        'text-green-600 dark:text-green-400' : 
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.transaction_type === 'deposit' || 
                         transaction.transaction_type === 'prize_win' ||
                         transaction.transaction_type === 'refund' ? '+' : '-'}
                        {parseFloat(transaction.amount).toLocaleString()} ብር
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      transaction.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {transaction.status_display}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.transactions.length === 0 && (
            <div className="text-center py-12">
              <History className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{t.noTransactions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Wallet