export default function GenerateButton({ onGenerate, generating, hasOrari, lezioniCount, onToggleExtra, showExtraForm }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {hasOrari && (
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? 'Generazione...' : 'Genera lezioni da orario'}
        </button>
      )}
      <button
        onClick={onToggleExtra}
        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
      >
        {showExtraForm ? 'Chiudi form extra' : 'Lezione extra'}
      </button>
      {lezioniCount > 0 && (
        <span className="text-sm text-gray-500">
          {lezioniCount} lezioni questa settimana
        </span>
      )}
    </div>
  )
}
