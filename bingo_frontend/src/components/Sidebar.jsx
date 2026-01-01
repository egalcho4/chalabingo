import { NavLink } from 'react-router-dom'
import { Home, Gamepad2, Wallet, Settings, PlusCircle, Trophy, Users, BarChart3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

const Sidebar = () => {
  const { isAdmin, user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const baseNavItems = [
    { to: '/', icon: Gamepad2, label: 'Games', badge: '10+' },
    { to: '/home', icon: Home, label: 'Home', badge: null },
    
    { to: '/leaderboard', icon: Trophy, label: 'Leader', badge: null },
    { to: '/wallet', icon: Wallet, label: 'Wallet', badge: user?.balance ? `${user.balance} coins` : null },
  ]

  const adminNavItems = [
    { to: '/admin/dashboard', icon: BarChart3, label: 'Admin Dashboard', badge: null },
    { to: '/admin/users', icon: Users, label: 'Users', badge: null },
    { to: '/admin/games', icon: PlusCircle, label: 'Add Game', badge: null },
    { to: '/admin/settings', icon: Settings, label: 'Settings', badge: null },
  ]

  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems

  // Get current path
  const currentPath = window.location.pathname

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col bg-gradient-to-b from-white to-gray-50/50 border-r border-gray-200 min-h-[calc(100vh-5rem)] relative">
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 bg-white border border-gray-300 rounded-full p-1.5 shadow-md hover:shadow-lg transition-shadow z-10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <div className={`w-2 h-2 transition-transform ${collapsed ? 'rotate-180' : ''}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4 text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>

        {/* Sidebar Content */}
        <div className={`flex-1 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
          {/* Logo (Hidden when collapsed) */}
          {!collapsed && (
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-2 rounded-lg">
                  <Gamepad2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Bingo Games</h2>
                  <p className="text-xs text-gray-500">Winner's Training Arena</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              // Check if current item is active
              const isActive = (() => {
                // If it's the games tab, make it active when on root path '/' or any games path
                if (item.to === '/games') {
                  return currentPath === '/' || currentPath.startsWith('/games')
                }
                // For other tabs, use normal matching
                return currentPath === item.to || (item.to !== '/' && currentPath.startsWith(item.to))
              })()
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={
                    `group flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-200'
                        : 'text-gray-700 hover:bg-gray-100 hover:translate-x-1'
                    }`
                  }
                  title={collapsed ? item.label : ''}
                >
                  <div className="relative">
                    <item.icon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
                    {item.badge && !collapsed && (
                      <span className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="font-medium flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* User Info (Hidden when collapsed) */}
          {!collapsed && user && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">{user.username?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{user.username}</p>
                  <p className="text-xs text-gray-500">{isAdmin ? 'Administrator' : 'Player'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden" style={{height:"20px"}}>
        {/* Spacer to prevent content from being hidden behind bottom nav - HALF HEIGHT */}
        <div className="h-6"></div>
        
        {/* Bottom Navigation Bar - HALF HEIGHT */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-xl z-40 py-1">
          {/* Active indicator background - REDUCED HEIGHT */}
          <div className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-600"></div>
          
          <div className="flex items-center justify-around">
            {baseNavItems.map((item) => {
              const isActive = (() => {
                if (item.to === '/games') {
                  return currentPath === '/' || currentPath.startsWith('/games')
                }
                return currentPath === item.to || (item.to !== '/' && currentPath.startsWith(item.to))
              })()
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={
                    `group relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'text-primary-600 bg-primary-50'
                        : 'text-gray-600 hover:text-primary-600'
                    }`
                  }
                >
                  {/* Active indicator - REDUCED SIZE */}
                  {isActive && (
                    <div className="absolute -top-1.5 w-10 h-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-full"></div>
                  )}
                  <div className={`relative transition-transform duration-300 ${isActive ? 'scale-105' : ''}`}>
                    <item.icon className="h-5 w-5" />
                    {item.badge && (
                      <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                        {item.badge.includes('coins') ? '💎' : '!'}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] mt-0.5 font-medium transition-all duration-300 ${isActive ? 'scale-100 opacity-100' : 'scale-90 opacity-70'}`}>
                    {item.label}
                  </span>
                </NavLink>
              )
            })}

            {/* Admin Access Button (Mobile) */}
            {isAdmin && (() => {
              const isActive = currentPath.startsWith('/admin')
              
              return (
                <NavLink
                  key="/admin/dashboard"
                  to="/admin/dashboard"
                  className={
                    `group relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'text-red-600 bg-red-50'
                        : 'text-gray-600 hover:text-red-600'
                    }`
                  }
                >
                  {isActive && (
                    <div className="absolute -top-1.5 w-10 h-0.5 bg-gradient-to-r from-red-500 to-red-600 rounded-b-full"></div>
                  )}
                  <Settings className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-105' : ''}`} />
                  <span className={`text-[10px] mt-0.5 font-medium transition-all duration-300 ${isActive ? 'scale-100 opacity-100' : 'scale-90 opacity-70'}`}>
                    Admin
                  </span>
                </NavLink>
              )
            })()}
          </div>
        </nav>
      </div>
    </>
  )
}

export default Sidebar