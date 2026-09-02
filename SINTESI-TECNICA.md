# Le mie Lezioni — Sintesi tecnica del codice

Fotografia tecnica del progetto al 2 settembre 2026, pensata per chi deve
valutarne architettura, dimensioni e portabilità. Il gemello divulgativo
di questo documento è [PRESENTAZIONE-PROGETTO.md](./PRESENTAZIONE-PROGETTO.md).

## Stack

| Livello | Tecnologia |
|---|---|
| Interfaccia | React 19 + Vite 7, Tailwind CSS 4, React Router 7 |
| Date e calendario | date-fns 4 + logica propria in `src/lib` |
| Backend | Nessun server proprio: Firebase — Auth (Google) + Cloud Firestore (realtime) |
| Import | SheetJS (`xlsx`) per l'orario da Excel |
| Test | Vitest — 41 test unitari sulla logica di calendario e anni |
| Qualità | ESLint 9, zero errori |
| Hosting | Firebase Hosting (in precedenza Netlify, ancora attivo come fallback) |

## Dimensioni

~11.200 righe di JavaScript/JSX in `src/` · 10 pagine · 21 componenti
riusabili · 3 context · 8 moduli di libreria · 41 test · 1 solo utente
previsto (per progetto, non per limite).

## Architettura

Single-page application interamente client-side: il browser dialoga
direttamente con Firestore tramite SDK (listener `onSnapshot`, quindi
UI in tempo reale), senza API né server da mantenere.

La sicurezza non dipende dal client: le **Firestore Security Rules**
(versionate nel repo, `firestore.rules`) consentono ogni lettura/scrittura
solo al token Google dell'unica email autorizzata, con email verificata.
Il client aggiunge una modalità sola-lettura per gli anni archiviati.
Le chiavi Firebase e l'email autorizzata entrano nella build come
variabili d'ambiente Vite (`.env`, non versionato; modello in
`.env.example`).

## Struttura del repository

| Percorso | Contenuto |
|---|---|
| `src/pages/` | Le viste: `OggiPage`, `SettimanaPage`, `PercorsiPage`, `ProgrammazionePage`, `AssenzePage`, `ExportPage` (stampa/PDF via browser), `ArchivioPage`, `ImpostazioniPage`, `NuovoAnnoPage` (wizard 6 passi), `LoginPage` |
| `src/components/` | Per area: `settimana/` (griglia lezioni, pannello di modifica, generazione, navigazione), `impostazioni/` (editor orario/assegnazioni/ore), `common/` (`StepWizard`, `ConfirmDialog`, `GlobalSearch`, `QuickNote`, `SlidePanel`…), `percorsi/`, `layout/` |
| `src/contexts/` | `AuthContext` (login Google e guardia email), `AppContext` (anno attivo e configurazione), `ToastContext` (notifiche con undo) |
| `src/lib/` | Il cuore: `firestore.js` (~50 funzioni di accesso dati), `calendario.js` (logica pura testata), `anni.js`, `settimane.js`, `importExcel.js`, `costanti.js`, `firebase.js` |
| Infrastruttura | `firestore.rules`, `firestore.indexes.json`, `firebase.json` (hosting + regole), `netlify.toml`, header di sicurezza (CSP) in `public/_headers` |
| Documenti | `ANALISI-STATO-2026-07.md`, `ROADMAP-2026-2027.md`, `GUIDA-DEPLOY-FIREBASE.md` |

## Modello dati (Firestore)

| Collezione | Contenuto |
|---|---|
| `config` | Documenti di configurazione: anni scolastici (date inizio/fine, giorno libero, anno attivo), `ricorrenze_{anno}` e `distribuzioni_{anno}` come mappe `{classe: {materia: …}}` |
| `assegnazioni` | Classe + materia + monte ore settimanale, per anno |
| `orari` | Gli slot dell'orario settimanale (giorno, ora I–VIII, classe, materia), per anno |
| `lezioni` | La collezione più grande: data, ora, classe, materia, stato (`pianificata`/`svolta`/`parziale`/`saltata`), argomento/note, riferimento facoltativo a percorso e unità, `annoScolastico`. Indice composito `annoScolastico + data` |
| `percorsi` (+ sub-collezione `unita`) | La programmazione didattica: percorsi per classe+materia, unità ordinate con stato |
| `vacanze` | Giorni/intervalli non scolastici con tipo (`vacanza`/`congedo`/`malattia`) |

Tutte le collezioni sono partizionate logicamente per anno scolastico:
l'archiviazione è un cambio di flag, il reset cancella solo l'anno indicato.

## La logica core (`src/lib`) — dove vive il valore

- **`calendario.js`** — funzioni pure e coperte da test:
  `giorniScolastici` (calendario reale tra due date, con vacanze e giorno
  libero), `oreDisponibili` e `oreDisponibiliPerAssegnazione` (budget ore
  residuo), `settimaneScolastiche`, `costruisciLezioniDaOrario`
  (la generazione: rispetta vacanze, giorno libero e fine scuola,
  deduplica con `chiaveLezione`, applica la priorità
  distribuzioni > ricorrenze).
- **`anni.js`** — validazione e successione degli anni
  (`annoSuccessivo`, `classeSuccessiva` per la clonazione 1A→2A).
- **`importExcel.js`** — parsing del file orario e scrittura batch.
- I test codificano i casi insidiosi: ultimo giorno di scuola incluso ma
  non superato, fine scuola di lunedì, conteggio "da oggi" a settimana
  iniziata, vacanze multi-giorno, generazione senza duplicati.

## Operazioni

Build statica (`npm run build`) e deploy con `firebase deploy`: hosting,
regole Firestore e indici escono dallo stesso repo con un comando.
Nessun processo server, nessun cron, nessuna manutenzione: i costi di
esercizio sono zero sui piani gratuiti.

## Portabilità (rilevante per una migrazione)

- **I dati** vivono in Firestore in collezioni piatte e ben nominate:
  esportabili via script in JSON/CSV senza lock-in significativo.
- **La logica** vive tutta nel client, concentrata e testata in
  `src/lib`: in una migrazione è la parte da tradurre nella piattaforma
  di destinazione (automazioni/formule) o da sostituire con lavoro
  manuale. È il vero costo del trasloco.
- **L'interfaccia** (pagine e componenti) è il resto del codice: non si
  migra, si abbandona a favore delle viste della piattaforma ospite.
