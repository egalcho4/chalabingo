import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate, useSearchParams,Navigate } from 'react-router-dom'
const PrivateRoute = ({ children }) => {

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Check for token parameter on component mount
  useEffect(() => {
    const token = searchParams.get('token')
    //console.log(token)
    if (token) {
      // Save token to localStorage
      localStorage.setItem('access_token', token)
      
      // Remove token from URL for security
      navigate('/', { replace: true })
      
      // Optionally, you can auto-login with the token here
      // For now, just save it and let user login manually if needed
    }
  }, [searchParams, navigate])
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" />
}

export default PrivateRoute