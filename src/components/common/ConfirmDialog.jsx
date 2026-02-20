import { useEffect, useRef } from 'react'

/**
 * Modal di conferma riutilizzabile.
 *
 * Props:
 *   open        - boolean, mostra/nasconde il dialogo
 *   title       - titolo del dialogo
 *   message     - messaggio/domanda
 *   confirmText - testo pulsante conferma (default "Conferma")
 *   cancelText  - testo pulsante annulla (default "Annulla")
 *   danger      - boolean, se true il pulsante conferma e rosso
 *   onConfirm   - callback conferma
 *   onCancel    - callback annullamento
 */
export default function ConfirmDialog({
  open,
  title = 'Conferma',
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
