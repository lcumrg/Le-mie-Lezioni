import PercorsoSelector from '../calendario/PercorsoSelector'

export default function LessonEditPanel({ editingLezione, setEditingLezione, lez, percorsi, onSave, onDelete }) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
      <PercorsoSelector
        percorsi={percorsi.filter((p) => p.classe === lez.classe && p.materia === lez.materia)}
        percorsoId={editingLezione.percorsoId}
        unitaId={editingLezione.unitaId}
        onChange={({ percorsoId: pId, unitaId: uId, unitaTitolo }) => {
          setEditingLezione((prev) => ({
            ...prev,
            percorsoId: pId,
            unitaId: uId,
            titoloOverride: uId && !prev.titoloOverride ? unitaTitolo : prev.titoloOverride,
          }))
        }}
      />

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Titolo/argomento</label>
        <input
          type="text"
          value={editingLezione.titoloOverride}
          onChange={(e) => setEditingLezione((p) => ({ ...p, titoloOverride: e.target.value }))}
          placeholder={lez.materia}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
        <textarea
          value={editingLezione.note}
          onChange={(e) => setEditingLezione((p) => ({ ...p, note: e.target.value }))}
          rows={2}
          placeholder="Appunti sulla lezione..."
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
        >
          Salva
        </button>
        <button
          onClick={() => setEditingLezione(null)}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
        >
          Annulla
        </button>
        <button
          onClick={() => onDelete(lez.id)}
          className="ml-auto px-3 py-1.5 text-red-600 text-xs font-medium hover:bg-red-50 rounded-lg"
        >
          Elimina lezione
        </button>
      </div>
    </div>
  )
}
