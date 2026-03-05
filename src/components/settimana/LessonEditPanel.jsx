import PercorsoSelector from '../calendario/PercorsoSelector'

export default function LessonEditPanel({ editingLezione, setEditingLezione, lez, percorsi, onSave, onDelete }) {
  return (
    <div className="mt-3 pt-3 border-t border-edge space-y-3">
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
        <label className="block text-xs font-medium text-fg-muted mb-1">Titolo/argomento</label>
        <input
          type="text"
          value={editingLezione.titoloOverride}
          onChange={(e) => setEditingLezione((p) => ({ ...p, titoloOverride: e.target.value }))}
          placeholder={lez.materia}
          className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-surface focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Note</label>
        <textarea
          value={editingLezione.note}
          onChange={(e) => setEditingLezione((p) => ({ ...p, note: e.target.value }))}
          rows={2}
          placeholder="Appunti sulla lezione..."
          className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-surface focus:ring-1 focus:ring-link/40 focus:border-link outline-none resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="px-3 py-1.5 bg-link text-canvas text-xs font-medium rounded-sm hover:bg-link/80"
        >
          Salva
        </button>
        <button
          onClick={() => setEditingLezione(null)}
          className="px-3 py-1.5 bg-overlay text-fg text-xs font-medium rounded-sm hover:bg-edge-muted"
        >
          Annulla
        </button>
        <button
          onClick={() => onDelete(lez.id)}
          className="ml-auto px-3 py-1.5 text-danger text-xs font-medium hover:bg-badge-x rounded-sm"
        >
          Elimina lezione
        </button>
      </div>
    </div>
  )
}
