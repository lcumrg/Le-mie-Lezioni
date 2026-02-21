import * as XLSX from 'xlsx'
import {
  addAssegnazione,
  addOrario,
  addPercorso,
  addUnita,
  addVacanza,
  setRicorrenzeClasse,
} from './firestore'

const GIORNI_MAP = {
  'lunedì': 0, 'lunedi': 0, 'lun': 0,
  'martedì': 1, 'martedi': 1, 'mar': 1,
  'mercoledì': 2, 'mercoledi': 2, 'mer': 2,
  'giovedì': 3, 'giovedi': 3, 'gio': 3,
  'venerdì': 4, 'venerdi': 4, 'ven': 4,
  'sabato': 5, 'sab': 5,
}

function parseGiorno(val) {
  if (typeof val === 'number') return val
  const n = GIORNI_MAP[(val || '').toString().trim().toLowerCase()]
  return n !== undefined ? n : null
}

function str(val) {
  return (val ?? '').toString().trim()
}

function num(val) {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function padTime(val) {
  const s = str(val)
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':')
    return `${h.padStart(2, '0')}:${m}`
  }
  return s || '08:00'
}

/**
 * Parses an Excel file and returns a structured preview of the data.
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const result = { classi: [], orario: [], percorsi: [], ricorrenze: [], vacanze: [] }

        // ── Classi e Materie ──
        const wsClassi = wb.Sheets['Classi e Materie']
        if (wsClassi) {
          const rows = XLSX.utils.sheet_to_json(wsClassi)
          for (const row of rows) {
            const classe = str(row['Classe'] || row['classe'])
            const materia = str(row['Materia'] || row['materia'])
            if (classe && materia) {
              result.classi.push({ classe, materia })
            }
          }
        }

        // ── Orario ──
        const wsOrario = wb.Sheets['Orario']
        if (wsOrario) {
          const rows = XLSX.utils.sheet_to_json(wsOrario)
          for (const row of rows) {
            const giorno = parseGiorno(row['Giorno'] || row['giorno'])
            const numeroOra = num(row['Ora'] || row['ora'] || row['NumeroOra'])
            const inizio = padTime(row['Inizio'] || row['inizio'] || row['OraInizio'])
            const fine = padTime(row['Fine'] || row['fine'] || row['OraFine'])
            const classe = str(row['Classe'] || row['classe'])
            if (giorno !== null && classe) {
              result.orario.push({ giorno, numeroOra, inizio, fine, classe })
            }
          }
        }

        // ── Percorsi e Unità ──
        const wsPercorsi = wb.Sheets['Percorsi e Unità'] || wb.Sheets['Percorsi e Unita']
        if (wsPercorsi) {
          const rows = XLSX.utils.sheet_to_json(wsPercorsi)
          for (const row of rows) {
            const classe = str(row['Classe'] || row['classe'])
            const percorso = str(row['Percorso'] || row['percorso'])
            const unita = str(row['Unità'] || row['Unita'] || row['unità'] || row['unita'])
            const ordine = num(row['Ordine'] || row['ordine'])
            const orePreviste = num(row['Ore Previste'] || row['OrePreviste'] || row['ore_previste'] || row['ore'])
            if (classe && percorso && unita) {
              result.percorsi.push({ classe, percorso, unita, ordine, orePreviste })
            }
          }
        }

        // ── Ricorrenze ──
        const wsRic = wb.Sheets['Ricorrenze']
        if (wsRic) {
          const rows = XLSX.utils.sheet_to_json(wsRic)
          for (const row of rows) {
            const classe = str(row['Classe'] || row['classe'])
            const giorno = parseGiorno(row['Giorno'] || row['giorno'])
            const ora = num(row['Ora'] || row['ora'])
            const percorso = str(row['Percorso'] || row['percorso'])
            if (classe && giorno !== null && percorso) {
              result.ricorrenze.push({ classe, giorno, ora, percorso })
            }
          }
        }

        // ── Vacanze ──
        const wsVac = wb.Sheets['Vacanze']
        if (wsVac) {
          const rows = XLSX.utils.sheet_to_json(wsVac)
          for (const row of rows) {
            const nome = str(row['Nome'] || row['nome'])
            const dataInizio = str(row['Data Inizio'] || row['DataInizio'] || row['data_inizio'] || row['inizio'])
            const dataFine = str(row['Data Fine'] || row['DataFine'] || row['data_fine'] || row['fine']) || dataInizio
            const tipo = str(row['Tipo'] || row['tipo']) || 'vacanza'
            if (nome && dataInizio) {
              result.vacanze.push({ nome, dataInizio, dataFine, tipo })
            }
          }
        }

        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Errore nella lettura del file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Imports parsed Excel data into Firestore.
 * Returns a summary of what was imported.
 */
export async function importToFirestore(data, annoScolastico, oreLezioneConfig) {
  const summary = { classi: 0, orario: 0, percorsi: 0, unita: 0, ricorrenze: 0, vacanze: 0 }

  // 1. Assegnazioni (classi)
  for (const c of data.classi) {
    await addAssegnazione({
      annoScolastico,
      classe: c.classe.toUpperCase(),
      materia: c.materia,
      attiva: true,
      archiviata: false,
    })
    summary.classi++
  }

  // 2. Orario
  // Build a materia map from classi
  const materiaMap = {}
  for (const c of data.classi) {
    materiaMap[c.classe.toUpperCase()] = c.materia
  }

  for (const o of data.orario) {
    const classe = o.classe.toUpperCase()
    // Try to find matching ore config for inizio/fine
    let inizio = o.inizio
    let fine = o.fine
    if (oreLezioneConfig && o.numeroOra) {
      const cfg = oreLezioneConfig.find((c) => c.numero === o.numeroOra)
      if (cfg) {
        inizio = cfg.inizio
        fine = cfg.fine
      }
    }

    await addOrario({
      annoScolastico,
      giorno: o.giorno,
      numeroOra: o.numeroOra || null,
      oraInizio: inizio,
      oraFine: fine,
      classe,
      materia: materiaMap[classe] || '',
      ore: 1,
    })
    summary.orario++
  }

  // 3. Percorsi + Unità
  // Group by classe+percorso
  const percorsoGroups = {}
  for (const p of data.percorsi) {
    const key = `${p.classe.toUpperCase()}||${p.percorso}`
    if (!percorsoGroups[key]) {
      percorsoGroups[key] = { classe: p.classe.toUpperCase(), titolo: p.percorso, unita: [] }
    }
    percorsoGroups[key].unita.push({
      titolo: p.unita,
      ordine: p.ordine,
      orePreviste: p.orePreviste,
    })
  }

  // Map percorso name -> id (for ricorrenze)
  const percorsoIdMap = {} // "CLASSE||titolo" -> id

  for (const [key, group] of Object.entries(percorsoGroups)) {
    const percorsoRef = await addPercorso({
      annoScolastico,
      classe: group.classe,
      titolo: group.titolo,
      materia: materiaMap[group.classe] || '',
      descrizione: '',
      note: '',
    })
    const percorsoId = percorsoRef.id
    percorsoIdMap[key] = percorsoId
    summary.percorsi++

    // Sort and add unita
    const sortedUnita = group.unita.sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
    for (const u of sortedUnita) {
      await addUnita(percorsoId, {
        titolo: u.titolo,
        descrizione: '',
        ordine: u.ordine || 1,
        orePreviste: u.orePreviste || 1,
        stato: 'da_fare',
        materiali: [],
      })
      summary.unita++
    }
  }

  // 4. Ricorrenze
  // Group by classe
  const ricPerClasse = {}
  for (const r of data.ricorrenze) {
    const classe = r.classe.toUpperCase()
    if (!ricPerClasse[classe]) ricPerClasse[classe] = {}

    // Find percorsoId by matching titolo
    const pKey = `${classe}||${r.percorso}`
    const pId = percorsoIdMap[pKey]
    if (pId) {
      const slotKey = `${r.giorno}-${r.ora || 0}`
      ricPerClasse[classe][slotKey] = {
        percorsoId: pId,
        percorsoTitolo: r.percorso,
      }
      summary.ricorrenze++
    }
  }

  for (const [classe, ric] of Object.entries(ricPerClasse)) {
    await setRicorrenzeClasse(classe, ric)
  }

  // 5. Vacanze
  for (const v of data.vacanze) {
    await addVacanza({
      annoScolastico,
      nome: v.nome,
      dataInizio: v.dataInizio,
      dataFine: v.dataFine || v.dataInizio,
      tipo: v.tipo || 'vacanza',
    })
    summary.vacanze++
  }

  return summary
}
