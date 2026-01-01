import React, { createContext, useState, useContext, useEffect } from 'react'
import { authAPI } from '../api/auth'
import { jwtDecode } from 'jwt-decode'
import toast from 'react-hot-toast'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token')
      if (token) {
        try {
          const decoded = jwtDecode(token)
          if (decoded.exp * 1000 < Date.now()) {
            // Token expired
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('user')
          } else {
            // Get user profile
            const response = await authAPI.getProfile()
            setUser(response.data)
          }
        } catch (error) {
          console.error('Auth init error:', error)
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user')
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      const { access, refresh } = response.data
      
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      
      // Get user profile
      const profileResponse = await authAPI.getProfile()
      setUser(profileResponse.data)
      
      toast.success('በተሳካ ሁኔታ ገብተዋል!')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'ስህተት ተከስቷል' }
    }
  }

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData)
      toast.success(response.data.message)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data || 'ስህተት ተከስቷል' }
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
    toast.success('በተሳካ ሁኔታ ወጥተዋል')
  }

  const updateProfile = async (userData) => {
    try {
      const response = await authAPI.updateProfile(userData)
      setUser(response.data)
      toast.success('የተጠቃሚ መረጃ ተስተካክሏል')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data || 'ስህተት ተከስቷል' }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      updateProfile,
      isAuthenticated: !!user,
      isAdmin: user?.is_staff || false,
      isAgent:user?.user_type == 'agent'
    }}>
      {children}
    </AuthContext.Provider>
  )
}