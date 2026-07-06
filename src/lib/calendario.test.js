import { describe, it, expect } from 'vitest'
import { parseISO } from 'date-fns'
import {
  toDayStr,
  giornoIndex,
  vacanzaDelGiorno,
  isGiornoScolastico,
  giorniScolastici,
  oreDisponibili,
  oreDisponibiliPerAssegnazione,
  settimaneScolastiche,
  chiaveLezione,
  costruisciLezioniDaOrario,
} from './calendario'

// Riferimenti fissi (giugno 2026):
// lun 2026-06-01, mar 02, mer 03, gio 04, ven 05, sab 06, dom 07
// lun 2026-06-08, mar 09, mer 10 (= fine scuola nei test), …
const d = (s) => parseISO(s)

const ORARI = [
  { giorno: 0, classe: '1A', materia: 'Informatica', numeroOra: 1, oraInizio: '08:00', oraFine: '09:00', ore: 1 },
  { giorno: 0, classe: '1A', materia: 'Informatica', numeroOra: 2, oraInizio: '09:00', oraFine: '10:00', ore: 1 },
  { giorno: 2, classe: '1A', materia: 'Informatica', numeroOra: 1, oraInizio: '08:00', oraFine: '09:00', ore: 1 },
  { giorno: 2, classe: '2B', materia: 'Matematica', numeroOra: 3, oraInizio: '10:00', oraFine: '11:00', ore: 1 },
  { giorno: 4, classe: '2B', materia: 'Matematica', numeroOra: 1, oraInizio: '08:00', oraFine: '09:00', ore: 1 },
]

describe('giornoIndex', () => {
  it('mappa lunedì=0, sabato=5, domenica=6', () => {
    expect(giornoIndex(d('2026-06-01'))).toBe(0)
    expect(giornoIndex(d('2026-06-06'))).toBe(5)
    expect(giornoIndex(d('2026-06-07'))).toBe(6)
  })
})

describe('vacanzaDelGiorno', () => {
  const vacanze = [{ dataInizio: '2026-04-06', dataFine: '2026-04-11', nome: 'Pasqua' }]
  it('copre gli estremi inclusi', () => {
    expect(vacanzaDelGiorno('2026-04-06', vacanze)?.nome).toBe('Pasqua')
    expect(vacanzaDelGiorno('2026-04-11', vacanze)?.nome).toBe('Pasqua')
    expect(vacanzaDelGiorno('2026-04-08', vacanze)?.nome).toBe('Pasqua')
  })
  it('non copre i giorni fuori intervallo', () => {
    expect(vacanzaDelGiorno('2026-04-05', vacanze)).toBeNull()
    expect(vacanzaDelGiorno('2026-04-12', vacanze)).toBeNull()
  })
})

describe('isGiornoScolastico', () => {
  it('esclude la domenica', () => {
    expect(isGiornoScolastico(d('2026-06-07'))).toBe(false)
  })
  it('esclude il giorno libero', () => {
    expect(isGiornoScolastico(d('2026-06-06'), { giornoLibero: 5 })).toBe(false)
    expect(isGiornoScolastico(d('2026-06-05'), { giornoLibero: 5 })).toBe(true)
  })
  it('esclude le vacanze', () => {
    const vacanze = [{ dataInizio: '2026-06-02', dataFine: '2026-06-02' }]
    expect(isGiornoScolastico(d('2026-06-02'), { vacanze })).toBe(false)
    expect(isGiornoScolastico(d('2026-06-03'), { vacanze })).toBe(true)
  })
})

describe('giorniScolastici', () => {
  it('include entrambi gli estremi', () => {
    const giorni = giorniScolastici(d('2026-06-01'), d('2026-06-03'))
    expect(giorni.map(toDayStr)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
  it("non va oltre l'ultimo giorno di scuola", () => {
    const giorni = giorniScolastici(d('2026-06-08'), d('2026-06-10'))
    expect(giorni.map(toDayStr)).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })
  it('intervallo vuoto quando da > a', () => {
    expect(giorniScolastici(d('2026-07-06'), d('2026-06-10'))).toEqual([])
  })
})

describe('oreDisponibili', () => {
  const base = { giornoLibero: null, vacanze: [] }

  it('conta le ore di una classe+materia nei giorni scolastici', () => {
    // lun 1/6 (2h) + mer 3/6 (1h) + lun 8/6 (2h) + mer 10/6 (1h) = 6h per 1A
    const ore = oreDisponibili(ORARI, { ...base, da: d('2026-06-01'), a: d('2026-06-10'), classe: '1A', materia: 'Informatica' })
    expect(ore).toBe(6)
  })

  it('"da oggi" esclude i giorni già trascorsi della settimana corrente', () => {
    // da mercoledì 3/6: il lunedì 1/6 (2h di 1A) non conta più
    const ore = oreDisponibili(ORARI, { ...base, da: d('2026-06-03'), a: d('2026-06-10'), classe: '1A', materia: 'Informatica' })
    expect(ore).toBe(4) // mer 3/6 + lun 8/6 (2h) + mer 10/6
  })

  it("include l'ultimo giorno di scuola ma non i successivi", () => {
    // fine scuola mercoledì 10/6: il venerdì 12/6 di 2B non conta
    const ore = oreDisponibili(ORARI, { ...base, da: d('2026-06-08'), a: d('2026-06-10'), classe: '2B', materia: 'Matematica' })
    expect(ore).toBe(1) // solo mer 10/6
  })

  it('fine scuola di lunedì: la settimana finale conta quel lunedì', () => {
    // (bug storico: il while con isBefore perdeva la settimana quando
    //  la fine scuola cadeva di lunedì)
    const ore = oreDisponibili(ORARI, { ...base, da: d('2026-06-03'), a: d('2026-06-08'), classe: '1A', materia: 'Informatica' })
    expect(ore).toBe(3) // mer 3/6 (1h) + lun 8/6 (2h)
  })

  it('esclude vacanze e giorno libero', () => {
    // vacanza il mercoledì 3/6 e lunedì libero: resta solo il venerdì di 2B
    const vacanze = [{ dataInizio: '2026-06-03', dataFine: '2026-06-03' }]
    const ore = oreDisponibili(ORARI, { da: d('2026-06-01'), a: d('2026-06-06'), vacanze, giornoLibero: 0 })
    expect(ore).toBe(1)
  })

  it('somma o.ore anche quando maggiore di 1, e default 1 se assente', () => {
    const orari = [
      { giorno: 0, classe: '3C', materia: 'Lab', oraInizio: '08:00', ore: 2 },
      { giorno: 0, classe: '3C', materia: 'Lab', oraInizio: '10:00' }, // senza ore → 1
    ]
    const ore = oreDisponibili(orari, { da: d('2026-06-01'), a: d('2026-06-01'), classe: '3C', materia: 'Lab' })
    expect(ore).toBe(3)
  })

  it('zero quando da > a (fine scuola già passata)', () => {
    const ore = oreDisponibili(ORARI, { ...base, da: d('2026-07-06'), a: d('2026-06-10'), classe: '1A', materia: 'Informatica' })
    expect(ore).toBe(0)
  })
})

describe('oreDisponibiliPerAssegnazione', () => {
  it('raggruppa per classe|materia', () => {
    const map = oreDisponibiliPerAssegnazione(ORARI, { da: d('2026-06-01'), a: d('2026-06-06') })
    expect(map).toEqual({ '1A|Informatica': 3, '2B|Matematica': 2 })
  })
})

describe('settimaneScolastiche', () => {
  it('la prima settimana parte dal lunedì anche se da è a metà settimana', () => {
    const weeks = settimaneScolastiche({ da: d('2026-06-03'), a: d('2026-06-10') })
    expect(weeks).toHaveLength(2)
    expect(weeks[0].startStr).toBe('2026-06-01')
    // i giorni già trascorsi della settimana restano in timeline
    expect(weeks[0].giorni.map(toDayStr)).toContain('2026-06-01')
  })

  it("l'ultima settimana è troncata alla fine scuola", () => {
    const weeks = settimaneScolastiche({ da: d('2026-06-01'), a: d('2026-06-10') })
    const last = weeks[weeks.length - 1]
    expect(last.startStr).toBe('2026-06-08')
    expect(last.giorni.map(toDayStr)).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })

  it('fine scuola di lunedì: la sua settimana è inclusa con quel solo giorno', () => {
    const weeks = settimaneScolastiche({ da: d('2026-06-01'), a: d('2026-06-08') })
    expect(weeks).toHaveLength(2)
    expect(weeks[1].giorni.map(toDayStr)).toEqual(['2026-06-08'])
  })

  it('settimana interamente in vacanza: zero giorni, nome della vacanza', () => {
    const vacanze = [{ dataInizio: '2026-06-01', dataFine: '2026-06-06', nome: 'Ponte' }]
    const weeks = settimaneScolastiche({ da: d('2026-06-01'), a: d('2026-06-06'), vacanze })
    expect(weeks[0].giorni).toEqual([])
    expect(weeks[0].vacanzaGiorni).toBe(6)
    expect(weeks[0].vacanzaNome).toBe('Ponte')
  })

  it('il giorno libero non è né scolastico né vacanza', () => {
    const weeks = settimaneScolastiche({ da: d('2026-06-01'), a: d('2026-06-06'), giornoLibero: 5 })
    expect(weeks[0].giorni.map(giornoIndex)).toEqual([0, 1, 2, 3, 4])
    expect(weeks[0].vacanzaGiorni).toBe(0)
  })

  it('nessuna settimana quando la fine scuola è già passata', () => {
    expect(settimaneScolastiche({ da: d('2026-07-06'), a: d('2026-06-10') })).toEqual([])
  })
})

describe('costruisciLezioniDaOrario', () => {
  const base = {
    da: d('2026-06-01'),
    a: d('2026-06-06'),
    annoScolastico: '2025-2026',
    orari: ORARI,
  }

  it('genera una lezione per ogni slot dei giorni scolastici, con i campi attesi', () => {
    const { lezioni, giorniSaltati } = costruisciLezioniDaOrario(base)
    expect(lezioni).toHaveLength(5)
    expect(giorniSaltati).toBe(0)
    const prima = lezioni[0]
    expect(prima).toMatchObject({
      annoScolastico: '2025-2026',
      giorno: 0,
      numeroOra: 1,
      oraInizio: '08:00',
      oraFine: '09:00',
      classe: '1A',
      materia: 'Informatica',
      ore: 1,
      stato: 'pianificata',
      note: '',
      titoloOverride: '',
    })
    expect(toDayStr(prima.data)).toBe('2026-06-01')
    expect(prima.percorsoId).toBeUndefined()
  })

  it('rilanciare la generazione con le stesse chiavi non crea duplicati', () => {
    const existingKeys = new Set()
    const prima = costruisciLezioniDaOrario({ ...base, existingKeys })
    const seconda = costruisciLezioniDaOrario({ ...base, existingKeys })
    expect(prima.lezioni).toHaveLength(5)
    expect(seconda.lezioni).toHaveLength(0)
  })

  it('rispetta le chiavi esistenti (lezioni già sul DB)', () => {
    const existingKeys = new Set([chiaveLezione('2026-06-01', '08:00', '1A')])
    const { lezioni } = costruisciLezioniDaOrario({ ...base, existingKeys })
    expect(lezioni).toHaveLength(4)
  })

  it('le distribuzioni vincono sulle ricorrenze e portano unitaId', () => {
    const distribuzioni = { '1A': { '2026-06-01_1': { percorsoId: 'P1', unitaId: 'U1' } } }
    const ricorrenze = { '1A': { '0-1': { percorsoId: 'P2' } } }
    const { lezioni } = costruisciLezioniDaOrario({ ...base, distribuzioni, ricorrenze })
    const lun1 = lezioni.find((l) => toDayStr(l.data) === '2026-06-01' && l.numeroOra === 1)
    expect(lun1.percorsoId).toBe('P1')
    expect(lun1.unitaId).toBe('U1')
  })

  it('senza distribuzione si applica la ricorrenza (solo percorso, mai unità)', () => {
    const ricorrenze = { '1A': { '0-2': { percorsoId: 'P2' } } }
    const { lezioni } = costruisciLezioniDaOrario({ ...base, ricorrenze })
    const lun2 = lezioni.find((l) => toDayStr(l.data) === '2026-06-01' && l.numeroOra === 2)
    expect(lun2.percorsoId).toBe('P2')
    expect(lun2.unitaId).toBeUndefined()
  })

  it('salta le vacanze contandole, il giorno libero senza contarlo', () => {
    const vacanze = [{ dataInizio: '2026-06-03', dataFine: '2026-06-03' }]
    const { lezioni, giorniSaltati } = costruisciLezioniDaOrario({ ...base, vacanze, giornoLibero: 4 })
    expect(giorniSaltati).toBe(1)
    // spariscono: mer 1A, mer 2B (vacanza) e ven 2B (giorno libero)
    expect(lezioni).toHaveLength(2)
    expect(lezioni.every((l) => toDayStr(l.data) === '2026-06-01')).toBe(true)
  })

  it("non genera oltre l'ultimo giorno: intervallo di un solo giorno", () => {
    const { lezioni } = costruisciLezioniDaOrario({ ...base, da: d('2026-06-03'), a: d('2026-06-03') })
    expect(lezioni).toHaveLength(2) // mer: 1A + 2B
    expect(lezioni.every((l) => toDayStr(l.data) === '2026-06-03')).toBe(true)
  })

  it('intervallo vuoto quando da > a', () => {
    const { lezioni } = costruisciLezioniDaOrario({ ...base, da: d('2026-06-10'), a: d('2026-06-01') })
    expect(lezioni).toHaveLength(0)
  })
})
