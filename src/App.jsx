import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { ToastProvider } from './contexts/ToastContext'
import AppLayout from './components/layout/AppLayout'
import LoadingSpinner from './components/common/LoadingSpinner'

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CalendarioPage = lazy(() => import('./pages/CalendarioPage'))
const PercorsiPage = lazy(() => import('./pages/PercorsiPage'))
const ProgrammazionePage = lazy(() => import('./pages/ProgrammazionePage'))
const ArchivioPage = lazy(() => import('./pages/ArchivioPage'))
const ImpostazioniPage = lazy(() => import('./pages/ImpostazioniPage'))
const ExportPage = lazy(() => import('./pages/ExportPage'))

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (user) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AppProvider>
                <AppLayout />
              </AppProvider>
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/percorsi" element={<PercorsiPage />} />
          <Route path="/programmazione" element={<ProgrammazionePage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/archivio" element={<ArchivioPage />} />
          <Route path="/impostazioni" element={<ImpostazioniPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
