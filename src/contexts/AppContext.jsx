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

  // Reset al logout durante il render (evita setState sincrono nell'effect);
  // il sentinel undefined fa scattare il ramo anche al primo render senza utente
  const [prevUser, setPrevUser] = useState(undefined)
  if (user !== prevUser) {
    setPrevUser(user)
    if (!user) {
      setConfig(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return undefined

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
