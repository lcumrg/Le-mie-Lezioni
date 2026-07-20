/**
 * Contenitore generico per flussi a passi: indicatore di avanzamento,
 * contenuto del passo corrente e navigazione Indietro/Avanti.
 * La logica (validazione, salvataggi, stato) vive nel chiamante.
 */
export default function StepWizard({
  steps,
  current,
  onBack,
  onNext,
  nextLabel = 'Avanti',
  nextDisabled = false,
  busy = false,
  children,
}) {
  return (
    <div>
      {/* Indicatore passi */}
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 mb-6">
        {steps.map((titolo, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={titolo} className="flex items-center gap-1">
              <span
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  done
                    ? 'bg-accent text-white'
                    : active
                      ? 'bg-link text-white'
                      : 'bg-overlay text-fg-subtle'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`text-xs ${
                  active ? 'text-fg font-semibold' : done ? 'text-fg-muted' : 'text-fg-subtle'
                } hidden sm:inline`}
              >
                {titolo}
              </span>
              {i < steps.length - 1 && <span className="w-4 h-px bg-edge mx-1 hidden sm:block" />}
            </li>
          )
        })}
      </ol>

      {/* Titolo passo corrente (visibile su mobile dove le label sono nascoste) */}
      <h2 className="text-lg font-semibold text-fg mb-4 sm:hidden">
        {current + 1}. {steps[current]}
      </h2>

      {/* Contenuto */}
      <div className="bg-surface rounded-sm border border-edge p-6">{children}</div>

      {/* Navigazione */}
      <div className="flex items-center justify-between mt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={current === 0 || busy}
          className="px-4 py-2 bg-overlay text-fg-muted text-sm font-medium rounded-sm hover:text-fg disabled:opacity-40"
        >
          ← Indietro
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || busy}
          className="px-5 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
        >
          {busy ? 'Salvataggio…' : nextLabel}
        </button>
      </div>
    </div>
  )
}
