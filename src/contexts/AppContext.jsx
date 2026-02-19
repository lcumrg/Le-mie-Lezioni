import { createContext, useContext, useEffect, useState } from 'react'
import { onAnnoScolasticoConfig } from '../lib/firestore'
import { useAuth } from './AuthContext'

const AppContext = createContext(null)

export function useApp() {
  return useContext(AppContext)
}

export function AppProvider({ children }) {
  const { user } = useAuth()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setConfig(null)
      setLoading(false)
      return
    }

    const unsubscribe = onAnnoScolasticoConfig((data) => {
      setConfig(data)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const annoAttivo = config?.annoAttivo || null

  const annoConfig = annoAttivo
    ? config?.anniScolastici?.[annoAttivo] || null
    : null

  const value = {
    config,
    annoAttivo,
    annoConfig,
    loading,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
