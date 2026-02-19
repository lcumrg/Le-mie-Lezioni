import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, AUTHORIZED_EMAIL } from '../lib/firebase'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        if (AUTHORIZED_EMAIL && firebaseUser.email !== AUTHORIZED_EMAIL) {
          signOut(auth)
          setError('Account non autorizzato. Accesso riservato.')
          setUser(null)
        } else {
          setUser(firebaseUser)
          setError(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function login() {
    setError(null)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (AUTHORIZED_EMAIL && result.user.email !== AUTHORIZED_EMAIL) {
        await signOut(auth)
        setError('Account non autorizzato. Accesso riservato.')
      }
    } catch (err) {
      setError('Errore durante il login: ' + err.message)
    }
  }

  async function logout() {
    await signOut(auth)
  }

  const value = { user, loading, error, login, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
