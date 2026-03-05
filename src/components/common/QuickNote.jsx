import { useState, useRef, useEffect, useCallback } from 'react'

export default function QuickNote({ value, onSave, placeholder = 'Aggiungi nota...' }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value || '')
  const textareaRef = useRef(null)
  const debounceRef = useRef(null)

  // Sync external value changes
  useEffect(() => {
    if (!editing) setText(value || '')
  }, [value, editing])

  const save = useCallback(
    (val) => {
      const trimmed = val.trim()
      if (trimmed !== (value || '').trim()) {
        onSave(trimmed)
      }
    },
    [value, onSave]
  )

  function handleClick() {
    setEditing(true)
    // Focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleChange(e) {
    const val = e.target.value
    setText(val)
    // Debounce auto-save after 1s of inactivity
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(val), 1000)
  }

  function handleBlur() {
    clearTimeout(debounceRef.current)
    save(text)
    setEditing(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      clearTimeout(debounceRef.current)
      setText(value || '')
      setEditing(false)
    }
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  if (!editing) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left text-xs text-fg-subtle hover:text-fg-muted hover:bg-overlay rounded px-2 py-1 transition-colors italic"
      >
        {text || placeholder}
      </button>
    )
  }

  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      rows={2}
      placeholder={placeholder}
      className="w-full px-2 py-1 text-xs border border-link/40 rounded bg-surface focus:ring-1 focus:ring-link/40 focus:border-link outline-none resize-none text-fg"
    />
  )
}
