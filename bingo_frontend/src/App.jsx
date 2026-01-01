import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Games from './components/GameRoom'
import GameRoom from './components/GameRoom'
import Wallet from './pages/Wallet'
import Admin from './pages/Admin'
// በApp.jsx ውስጥ
import GameLobby from './components/GameLobby'

// በRoutes ውስጥ ይጨምሩ

// Components
import Layout from './components/Layout'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/lobby/:gameId" element={
  <PrivateRoute>
    <GameLobby />
  </PrivateRoute>
} />
            {/* Protected routes */}
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/home" element={<Dashboard />} />
              <Route index element={<Games />} />
              <Route path="/games/:gameId" element={<GameRoom />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            </Route>
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App