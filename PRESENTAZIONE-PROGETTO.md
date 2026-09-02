# Le mie Lezioni — Presentazione del progetto

Documento di sintesi per chi deve valutare il progetto senza conoscerlo
(ad esempio per un confronto con altre piattaforme, come Notion).
Aggiornato al 2 settembre 2026. Il gemello tecnico di questo documento è
[SINTESI-TECNICA.md](./SINTESI-TECNICA.md).

## L'idea in una frase

Un'applicazione web personale con cui un docente pianifica, genera e
traccia tutte le lezioni dell'anno scolastico, e ha sempre la risposta
alla domanda che conta: **"quante ore mi restano davvero, e ce la faccio
a finire il programma?"**

## Il problema

Un docente con più classi e materie deve tenere allineati: un orario
settimanale fisso, le vacanze, il proprio giorno libero, gli imprevisti
(assenze, malattie), la programmazione didattica (percorsi e unità) e il
conteggio delle ore effettivamente svolte rispetto a quelle disponibili.
Il registro elettronico scolastico non è pensato per la pianificazione
personale; agende e fogli di calcolo richiedono lavoro manuale ripetitivo
e producono conteggi fragili, che si sfasano al primo imprevisto.

## La soluzione

Un'app web privata, per un solo utente: login con Google limitato a
un'unica email autorizzata, dati nel cloud sincronizzati in tempo reale
su qualsiasi dispositivo (PC, tablet, telefono), costo di esercizio zero
(piani gratuiti di Firebase). Nessuna installazione: è un sito.

## I concetti del dominio

| Concetto | Cos'è |
|---|---|
| **Anno scolastico** | Il contenitore di tutto (es. 2026-2027), con date di inizio/fine scuola. È *attivo* oppure *archiviato* (consultabile in sola lettura). |
| **Assegnazione** | Una coppia classe+materia con il suo monte ore settimanale (es. 2B — Italiano, 6 h). |
| **Orario settimanale** | La griglia fissa giorno × ora (I–VIII) → classe/materia. |
| **Lezione** | L'istanza concreta in una data: stato (Pianificata / Svolta / Parziale / Saltata), argomento, note, collegamento facoltativo a percorso/unità. Il conteggio ore pesa lo stato: svolta = 1 h, parziale = 0,5, saltata = 0. |
| **Percorso didattico** | La programmazione di una materia in una classe, composta di **unità** ordinabili con stato (Da fare / In corso / Completata / Saltata). |
| **Ricorrenze e distribuzioni** | Regole per classe+materia che pre-compilano gli argomenti delle lezioni generate (es. "il martedì grammatica") o distribuiscono le ore tra attività. |
| **Vacanze e assenze** | Giorni non scolastici (vacanza, congedo, malattia) esclusi automaticamente da generazione e conteggi. |
| **Giorno libero** | Il giorno settimanale senza lezioni del docente. |

## Il flusso di lavoro

### 1. Settembre — il setup (una volta l'anno)
Wizard "Nuovo anno" in 6 passi: anno e date → classi e materie
(ripartendo da quelle dell'anno precedente) → ore scolastiche →
orario settimanale (a mano o importato da Excel) → vacanze →
riepilogo con clonazione dei percorsi dall'anno prima, incluse le
rimappature di classe (la 1A che diventa 2A).

### 2. La generazione automatica delle lezioni
Dall'orario l'app genera con un click le lezioni della settimana corrente
o delle prossime 2/4 settimane: salta vacanze e giorno libero, si ferma
all'ultimo giorno di scuola, non crea mai duplicati (si può rilanciare
senza paura) e pre-compila gli argomenti da ricorrenze e distribuzioni.

### 3. Ogni giorno — pagina "Oggi" (il gesto da 30 secondi)
Le lezioni di oggi in ordine: un tap per cambiare stato, note veloci,
aggancio all'unità del percorso che si sta svolgendo, ore residue
aggiornate in tempo reale.

### 4. Ogni settimana — pagina "Settimana"
La griglia completa: modificare, spostare, aggiungere lezioni extra,
eliminare con possibilità di annullamento, navigare tra le settimane o
saltare a una data.

### 5. La regia — pagine "Percorsi" e "Programmazione"
Avanzamento delle unità per ogni percorso e confronto tra ore rimanenti
e programma da svolgere: il colpo d'occhio che dice se si è in pari,
in anticipo o in ritardo.

### 6. Gli imprevisti — pagina "Assenze"
Calendario di vacanze, congedi e malattie: aggiungere un giorno qui
aggiorna automaticamente generazione e conteggi.

### 7. Fine anno — "Archivio" ed "Export"
Chiusura dell'anno (che diventa archiviato, in sola lettura, sempre
consultabile), stampa/PDF del registro delle lezioni, e via col wizard
del nuovo anno.

## Stato del progetto (settembre 2026)

- **In produzione**, usato quotidianamente per l'intero anno 2025-2026;
  pronto per il 2026-2027.
- Estate 2026: irrobustimento completo — test automatici sulla logica di
  calendario, regole di sicurezza versionate, correzione dei difetti noti,
  wizard nuovo anno, archiviazione protetta (dettagli in
  [ROADMAP-2026-2027.md](./ROADMAP-2026-2027.md)).
- Hosting in migrazione da Netlify a Firebase Hosting.

## Requisiti per valutare una piattaforma alternativa

Qualunque strumento candidato a sostituire l'app va misurato su queste
capacità, in ordine di importanza:

1. **Generazione automatica delle lezioni** dall'orario settimanale,
   saltando vacanze e giorno libero, senza mai creare duplicati
   (oggi: un click).
2. **Conteggi sempre aggiornati**: ore svolte/residue per classe+materia
   pesate per stato, settimane rimanenti alla fine della scuola
   (oggi: automatici ovunque).
3. **Velocità del gesto quotidiano**: segnare l'esito di 4-5 lezioni deve
   costare secondi, anche dal telefono.
4. **Relazioni tra i dati**: lezione ↔ percorso/unità,
   assegnazioni ↔ orario ↔ lezioni.
5. **Ciclo annuale**: archiviare un anno in sola lettura e ripartire
   puliti clonando la programmazione con rimappatura delle classi.
6. **Import da Excel** dell'orario; **stampa/PDF** del registro.
7. **Privacy e costo**: accesso strettamente personale, esercizio gratuito.

Nota per la valutazione: i punti 3, 4, 5 e 7 si modellano bene con
database, relazioni e viste di una piattaforma come Notion; i punti
1 e 2 — generazione automatica e calcoli di calendario con vacanze —
sono il cuore "applicativo" del progetto: lì una migrazione richiede
automazioni e formule avanzate, oppure l'accettazione di un ritorno al
lavoro manuale (duplicazione di modelli settimanali, conteggi
semi-manuali). Il punto 6 dipende dai formati supportati.
