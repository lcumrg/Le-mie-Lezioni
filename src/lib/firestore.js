import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
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
  return setDoc(doc(db, 'config', 'distribuzioni'), { [classe]: settimane }, { merge: true })
}

export function onLezioniByPercorso(percorsoId, callback) {
  const q = query(lezioniRef, where('percorsoId', '==', percorsoId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}
