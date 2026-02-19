import {
  collection,
  doc,
  getDoc,
  getDocs,
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
export const configRef = collection(db, 'config')

// ── Subcollection helpers ──

export function unitaRef(percorsoId) {
  return collection(db, 'percorsi', percorsoId, 'unita')
}

export function materialiRef(percorsoId) {
  return collection(db, 'percorsi', percorsoId, 'materiali')
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

// ── Percorsi ──

export function onPercorsi(callback) {
  return onSnapshot(percorsiRef, (snap) => {
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

// ── Materiali ──

export function onMateriali(percorsoId, callback) {
  return onSnapshot(materialiRef(percorsoId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addMateriale(percorsoId, data) {
  return addDoc(materialiRef(percorsoId), data)
}

export async function updateMateriale(percorsoId, materialeId, data) {
  return updateDoc(
    doc(db, 'percorsi', percorsoId, 'materiali', materialeId),
    data
  )
}

export async function deleteMateriale(percorsoId, materialeId) {
  return deleteDoc(
    doc(db, 'percorsi', percorsoId, 'materiali', materialeId)
  )
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
