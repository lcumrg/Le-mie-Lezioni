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
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-surface border border-edge rounded-sm max-w-sm w-full mx-4 p-5">
        <h3 className="text-base font-semibold text-fg mb-2">{title}</h3>
        <p className="text-sm text-fg-muted mb-5">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-fg bg-overlay border border-edge rounded hover:bg-overlay/80 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              danger
                ? 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25'
                : 'bg-link text-white hover:bg-link/80'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
