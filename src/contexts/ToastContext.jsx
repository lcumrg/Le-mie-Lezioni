import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000, action = null) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type, action }])
    const effectiveDuration = action ? Math.max(duration, 5000) : duration
    if (effectiveDuration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, effectiveDuration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback({
    info: (msg, dur) => addToast(msg, 'info', dur),
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    action: (msg, { label, onClick }) => addToast(msg, 'success', 5000, { label, onClick }),
  }, [addToast])

  // Reassign as function with methods
  const toastFn = (msg, type, dur) => addToast(msg, type, dur)
  toastFn.info = toast.info
  toastFn.success = toast.success
  toastFn.error = toast.error
  toastFn.warning = toast.warning
  toastFn.action = toast.action

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

const TOAST_STYLES = {
  info: 'bg-blue-600',
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-600',
}

const TOAST_ICONS = {
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${TOAST_STYLES[t.type] || TOAST_STYLES.info} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-2 animate-[slideIn_0.2s_ease-out]`}
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={TOAST_ICONS[t.type] || TOAST_ICONS.info} />
          </svg>
          <span className="text-sm flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action.onClick(); onRemove(t.id) }}
              className="text-white font-semibold text-sm underline underline-offset-2 hover:text-white/90 shrink-0"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => onRemove(t.id)}
            className="text-white/70 hover:text-white shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
