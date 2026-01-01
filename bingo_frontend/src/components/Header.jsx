import { useAuth } from '../context/AuthContext'
import { Wallet, LogOut, User, Menu, X, Crown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'

const Header = () => {
  const { user, logout, isAdmin ,isAgent} = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-primary-50 to-white shadow-lg border-b border-primary-100 w-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-10 md:h-12">
          {/* Logo - Reduced size */}
          <Link 
            to="/" 
            className="flex items-center space-x-1 group"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 to-primary-600 rounded blur opacity-15 group-hover:opacity-25 transition duration-300"></div>
              <div className="relative bg-gradient-to-r from-primary-500 to-primary-700 text-white p-1.5 rounded-md">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                ቢንጎ ጨዋታ
              </h1>
              <p className="text-[10px] text-gray-500 hidden md:block leading-tight">የኢትዮጵያውያን የአሸናፊዎች ማሰልጠኛ</p>
            </div>
          </Link>

          {/* Mobile menu button */}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-primary-50 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-primary-600" />
              ) : (
                <Menu className="h-5 w-5 text-primary-600" />
              )}
            </button>
          )}

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center space-x-2 lg:space-x-3">
              {/* Wallet Button */}
              <Link
                to="/wallet"
                className="group relative flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-primary-50 to-white border border-primary-100 rounded-lg hover:border-primary-300 hover:shadow transition-all duration-200"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-primary-400 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative bg-gradient-to-br from-primary-500 to-primary-600 p-1.5 rounded-full">
                    <Wallet className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-semibold text-gray-800">{user.username}</span>
                    {isAdmin && (
                      <Crown className="h-3 w-3 text-yellow-500 fill-yellow-200" />
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-600">ቦርሳ</span>
                    <span className="text-xs text-green-600 font-bold">•</span>
                    <span className="text-xs font-bold text-green-600">እንቁ</span>
                  </div>
                </div>
              </Link>
                {isAgent && (
                <Link
                  to="/admin"
                  className="group relative flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-red-50 to-white border border-red-100 rounded-lg hover:border-red-300 hover:shadow transition-all duration-200"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-400 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                    <div className="relative bg-gradient-to-br from-red-500 to-red-600 p-1.5 rounded-full">
                      <User className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-700 whitespace-nowrap">Agent</span>
                </Link>
              )}
              {/* Admin Button */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="group relative flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-red-50 to-white border border-red-100 rounded-lg hover:border-red-300 hover:shadow transition-all duration-200"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-400 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                    <div className="relative bg-gradient-to-br from-red-500 to-red-600 p-1.5 rounded-full">
                      <User className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-700 whitespace-nowrap">አስተዳዳሪ</span>
                </Link>
              )}

              {/* Logout Button */}
              <button
                onClick={logout}
                className="group relative flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg hover:border-red-200 hover:shadow transition-all duration-200"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-red-400 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative bg-gradient-to-br from-red-500 to-red-600 p-1.5 rounded-full">
                    <LogOut className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">ውጣ</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden animate-fadeIn">
            <div className="py-3 px-2 border-t border-primary-100 bg-white/95 backdrop-blur-sm rounded-b-lg shadow-lg">
              <div className="space-y-2">
                {/* User Info */}
                <div className="flex items-center justify-between p-2.5 bg-primary-50 rounded-md">
                  <div className="flex items-center space-x-2.5">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-1.5 rounded-full">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{user.username}</p>
                      <p className="text-xs text-gray-600">ተጠቃሚ</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Crown className="h-4 w-4 text-yellow-500 fill-yellow-200" />
                  )}
                </div>

                {/* Mobile Menu Items */}
                <Link
                  to="/wallet"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2.5 p-2.5 hover:bg-primary-50 rounded-md transition-colors group"
                >
                  <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-1.5 rounded-md">
                    <Wallet className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 text-sm">ቦርሳ</p>
                    <p className="text-xs text-gray-600">የእርስዎ ቦርሳ</p>
                  </div>
                  <div className="text-right">
                    <span className="text-green-600 font-bold text-sm">እንቁ</span>
                  </div>
                </Link>
                 {isAgent && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2.5 p-2.5 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <div className="bg-gradient-to-br from-red-500 to-red-600 p-1.5 rounded-md">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-red-700 text-sm">Agent</p>
                      <p className="text-xs text-red-600">Agent admistration</p>
                    </div>
                  </Link>
                )}

               
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2.5 p-2.5 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <div className="bg-gradient-to-br from-red-500 to-red-600 p-1.5 rounded-md">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-red-700 text-sm">አስተዳዳሪ ፓነል</p>
                      <p className="text-xs text-red-600">የስርዓት አስተዳደር</p>
                    </div>
                  </Link>
                )}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    logout()
                  }}
                  className="w-full flex items-center space-x-2.5 p-2.5 hover:bg-red-50 rounded-md transition-colors text-red-600"
                >
                  <div className="bg-gradient-to-br from-red-500 to-red-600 p-1.5 rounded-md">
                    <LogOut className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium text-sm">ከስርዓቱ ይውጡ</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header