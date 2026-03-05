export default function GenerateButton({ onGenerate, generating, hasOrari, lezioniCount, onToggleExtra, showExtraForm }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {hasOrari && (
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-4 py-2 bg-link text-canvas text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
        >
          {generating ? 'Generazione...' : 'Genera lezioni da orario'}
        </button>
      )}
      <button
        onClick={onToggleExtra}
        className="px-4 py-2 bg-special text-canvas text-sm font-medium rounded-sm hover:bg-special/80"
      >
        {showExtraForm ? 'Chiudi form extra' : 'Lezione extra'}
      </button>
      {lezioniCount > 0 && (
        <span className="text-sm text-fg-muted">
          {lezioniCount} lezioni questa settimana
        </span>
      )}
    </div>
  )
}
