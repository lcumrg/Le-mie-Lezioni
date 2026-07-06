import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

// ── Collection references ──

export const percorsiRef = collection(db, 'percorsi')
export const assegnazioniRef = collection(db, 'assegnazioni')
export const orariRef = collection(db, 'orari')
export const lezioniRef = collection(db, 'lezioni')
export const vacanzeRef = collection(db, 'vacanze')
export const configRef = collection(db, 'config')

// ── Subcollection helpers ──

export function unitaRef(percorsoId) {
  return collection(db, 'percorsi', percorsoId, 'unita')
}

// ── Config ──

export async function getAnnoScolasticoConfig() {
  const snap = await getDoc(doc(db, 'config', 'anno_scolastico'))
  return snap.exists() ? snap.data() : null
}

export function onAnnoScolasticoConfig(callback) {
  return onSnapshot(doc(db, 'config', 'anno_scolastico'), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export async function setAnnoScolasticoConfig(data) {
  return setDoc(doc(db, 'config', 'anno_scolastico'), data, { merge: true })
}

// ── Percorsi ──

export function onPercorsi(annoScolastico, callback) {
  const q = query(percorsiRef, where('annoScolastico', '==', annoScolastico))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addPercorso(data) {
  return addDoc(percorsiRef, { ...data, createdAt: serverTimestamp() })
}

export async function updatePercorso(id, data) {
  return updateDoc(doc(db, 'percorsi', id), data)
}

export async function deletePercorso(id) {
  return deleteDoc(doc(db, 'percorsi', id))
}

// ── Unita ──

export function onUnita(percorsoId, callback) {
  const q = query(unitaRef(percorsoId), orderBy('ordine'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addUnita(percorsoId, data) {
  return addDoc(unitaRef(percorsoId), data)
}

export async function updateUnita(percorsoId, unitaId, data) {
  return updateDoc(doc(db, 'percorsi', percorsoId, 'unita', unitaId), data)
}

export async function deleteUnita(percorsoId, unitaId) {
  return deleteDoc(doc(db, 'percorsi', percorsoId, 'unita', unitaId))
}

// ── Assegnazioni ──

export function onAssegnazioni(annoScolastico, callback) {
  const q = query(assegnazioniRef, where('annoScolastico', '==', annoScolastico))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addAssegnazione(data) {
  return addDoc(assegnazioniRef, data)
}

export async function updateAssegnazione(id, data) {
  return updateDoc(doc(db, 'assegnazioni', id), data)
}

export async function deleteAssegnazione(id) {
  return deleteDoc(doc(db, 'assegnazioni', id))
}

// ── Orari ──

export function onOrari(annoScolastico, callback) {
  const q = query(orariRef, where('annoScolastico', '==', annoScolastico))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addOrario(data) {
  return addDoc(orariRef, data)
}

export async function updateOrario(id, data) {
  return updateDoc(doc(db, 'orari', id), data)
}

export async function deleteOrario(id) {
  return deleteDoc(doc(db, 'orari', id))
}

// ── Lezioni ──

export function onLezioni(annoScolastico, callback) {
  const q = query(lezioniRef, where('annoScolastico', '==', annoScolastico))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function onLezioniSettimana(annoScolastico, inizioSettimana, fineSettimana, callback) {
  const q = query(
    lezioniRef,
    where('annoScolastico', '==', annoScolastico),
    where('data', '>=', inizioSettimana),
    where('data', '<=', fineSettimana)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Fetch lezioni in un intervallo di date (one-shot, per dedup nella generazione multi-settimana) */
export async function getLezioniRange(annoScolastico, inizio, fine) {
  const q = query(
    lezioniRef,
    where('annoScolastico', '==', annoScolastico),
    where('data', '>=', inizio),
    where('data', '<=', fine)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addLezione(data) {
  return addDoc(lezioniRef, data)
}

export async function updateLezione(id, data) {
  return updateDoc(doc(db, 'lezioni', id), data)
}

export async function deleteLezione(id) {
  return deleteDoc(doc(db, 'lezioni', id))
}

// ── Vacanze ──

export function onVacanze(annoScolastico, callback) {
  const q = query(vacanzeRef, where('annoScolastico', '==', annoScolastico))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addVacanza(data) {
  return addDoc(vacanzeRef, data)
}

export async function updateVacanza(id, data) {
  return updateDoc(doc(db, 'vacanze', id), data)
}

export async function deleteVacanza(id) {
  return deleteDoc(doc(db, 'vacanze', id))
}

// ── Distribuzioni (pianificazione settimanale per classe) ──

export function onDistribuzioni(callback) {
  return onSnapshot(doc(db, 'config', 'distribuzioni'), (snap) => {
    callback(snap.exists() ? snap.data() : {})
  })
}

export async function setDistribuzioniClasse(classe, settimane) {
  const ref = doc(db, 'config', 'distribuzioni')
  try {
    await updateDoc(ref, { [classe]: settimane })
  } catch {
    // Document doesn't exist yet, create it
    await setDoc(ref, { [classe]: settimane })
  }
}

// ── Ricorrenze (slot giorno/ora → percorso per classe) ──

export function onRicorrenze(callback) {
  return onSnapshot(doc(db, 'config', 'ricorrenze'), (snap) => {
    callback(snap.exists() ? snap.data() : {})
  })
}

export async function setRicorrenzeClasse(classe, ricorrenze) {
  const ref = doc(db, 'config', 'ricorrenze')
  try {
    await updateDoc(ref, { [classe]: ricorrenze })
  } catch {
    // Document doesn't exist yet, create it
    await setDoc(ref, { [classe]: ricorrenze })
  }
}

export function onLezioniByPercorso(percorsoId, callback) {
  const q = query(lezioniRef, where('percorsoId', '==', percorsoId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ── Archivio ──

/** Fetch percorsi for a year (one-shot, for archive view) */
export async function getPercorsi(annoScolastico) {
  const q = query(percorsiRef, where('annoScolastico', '==', annoScolastico))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Fetch unita for a percorso (one-shot) */
export async function getUnita(percorsoId) {
  const q = query(unitaRef(percorsoId), orderBy('ordine'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Fetch lezioni for a year (one-shot, for archive stats) */
export async function getLezioni(annoScolastico) {
  const q = query(lezioniRef, where('annoScolastico', '==', annoScolastico))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Fetch assegnazioni for a year (one-shot) */
export async function getAssegnazioni(annoScolastico) {
  const q = query(assegnazioniRef, where('annoScolastico', '==', annoScolastico))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Clone percorsi (with their unita) from one anno to another.
 * Unita are copied with stato reset to 'da_fare'.
 * Returns count of cloned percorsi.
 */
export async function clonePercorsiToAnno(annoOrigine, annoDestinazione) {
  const percorsi = await getPercorsi(annoOrigine)
  let count = 0

  for (const p of percorsi) {
    // Create new percorso
    const newPercorsoRef = await addDoc(percorsiRef, {
      annoScolastico: annoDestinazione,
      classe: p.classe,
      materia: p.materia || '',
      titolo: p.titolo,
      descrizione: p.descrizione || '',
      createdAt: serverTimestamp(),
    })

    // Copy unita
    const unita = await getUnita(p.id)
    for (const u of unita) {
      await addDoc(unitaRef(newPercorsoRef.id), {
        titolo: u.titolo,
        descrizione: u.descrizione || '',
        ordine: u.ordine,
        orePreviste: u.orePreviste || 0,
        stato: 'da_fare',
        materiali: u.materiali || [],
      })
    }

    count++
  }

  return count
}

// ── Reset: cancella tutti i dati di un anno scolastico ──

async function deleteCollectionByAnno(collRef, annoScolastico) {
  const q = query(collRef, where('annoScolastico', '==', annoScolastico))
  const snap = await getDocs(q)
  let count = 0
  // Firestore batches max 500 ops
  let batch = writeBatch(db)
  let batchCount = 0
  for (const d of snap.docs) {
    batch.delete(d.ref)
    batchCount++
    count++
    if (batchCount >= 450) {
      await batch.commit()
      batch = writeBatch(db)
      batchCount = 0
    }
  }
  if (batchCount > 0) await batch.commit()
  return count
}

/**
 * Deletes all data for a given anno scolastico:
 * assegnazioni, orari, lezioni, vacanze, percorsi (with subcollection unita),
 * ricorrenze and distribuzioni for affected classes.
 */
export async function resetAnnoScolastico(annoScolastico) {
  const summary = { assegnazioni: 0, orari: 0, lezioni: 0, vacanze: 0, percorsi: 0, unita: 0 }

  // 1. Delete percorsi + their unita subcollections
  const percQ = query(percorsiRef, where('annoScolastico', '==', annoScolastico))
  const percSnap = await getDocs(percQ)
  for (const percDoc of percSnap.docs) {
    // Delete all unita in subcollection
    const unitaSnap = await getDocs(collection(db, 'percorsi', percDoc.id, 'unita'))
    let batch = writeBatch(db)
    let bc = 0
    for (const u of unitaSnap.docs) {
      batch.delete(u.ref)
      bc++
      summary.unita++
      if (bc >= 450) { await batch.commit(); batch = writeBatch(db); bc = 0 }
    }
    batch.delete(percDoc.ref)
    bc++
    summary.percorsi++
    if (bc > 0) await batch.commit()
  }

  // 2. Delete flat collections
  summary.assegnazioni = await deleteCollectionByAnno(assegnazioniRef, annoScolastico)
  summary.orari = await deleteCollectionByAnno(orariRef, annoScolastico)
  summary.lezioni = await deleteCollectionByAnno(lezioniRef, annoScolastico)
  summary.vacanze = await deleteCollectionByAnno(vacanzeRef, annoScolastico)

  // 3. Clear config docs (ricorrenze, distribuzioni)
  try {
    const ricRef = doc(db, 'config', 'ricorrenze')
    const ricSnap = await getDoc(ricRef)
    if (ricSnap.exists()) {
      const data = ricSnap.data()
      const updates = {}
      for (const key of Object.keys(data)) {
        updates[key] = deleteField()
      }
      if (Object.keys(updates).length > 0) await updateDoc(ricRef, updates)
    }
  } catch { /* ignore */ }

  try {
    const distRef = doc(db, 'config', 'distribuzioni')
    const distSnap = await getDoc(distRef)
    if (distSnap.exists()) {
      const data = distSnap.data()
      const updates = {}
      for (const key of Object.keys(data)) {
        updates[key] = deleteField()
      }
      if (Object.keys(updates).length > 0) await updateDoc(distRef, updates)
    }
  } catch { /* ignore */ }

  return summary
}
