# Analisi UX e Flusso di Lavoro — Le Mie Lezioni

## Il flusso attuale dell'utente (percorso tipico)

Un insegnante che usa l'app deve seguire questi passi:

1. **Impostazioni** — Configurare anno scolastico, classi, materie, orario settimanale, vacanze, ore scolastiche, data fine scuola
2. **Percorsi** — Creare percorsi didattici per ogni classe/materia, aggiungere unità con ore previste
3. **Programmazione** — Assegnare ore ricorrenti ai percorsi, distribuire le unità sulla timeline annuale
4. **Calendario** — Generare le lezioni settimanali dall'orario, collegare ogni lezione a un percorso/unità, segnare lo stato
5. **Dashboard** — Monitorare la settimana corrente, cambiare stati velocemente
6. **Export** — Esportare la programmazione iniziale o il consuntivo finale

---

## PROBLEMI IDENTIFICATI

### 1. Setup iniziale troppo frammentato e opaco (Impostazioni)

**Problema critico.** `ImpostazioniPage.jsx` è una pagina monolitica (~900 righe) che gestisce almeno 7 sezioni diverse (anno scolastico, classi, ore scolastiche, giorno libero, data fine scuola, orario settimanale, vacanze, import Excel). Un nuovo utente non ha idea di cosa configurare prima, in che ordine, e cosa è obbligatorio vs opzionale.

- Non c'è nessun **wizard/onboarding guidato** per il primo utilizzo
- L'utente scopre che mancano configurazioni solo quando va in altre pagine e vede messaggi come "Configura la data di fine scuola nelle Impostazioni"
- Le dipendenze tra configurazioni sono implicite: senza ore scolastiche la griglia della Dashboard non appare, senza orario il Calendario non genera lezioni, senza data fine scuola la Programmazione non mostra la timeline

### 2. Navigazione avanti-indietro continua tra pagine

**Problema importante.** Il flusso richiede salti costanti tra pagine disconnesse:

- Per collegare una lezione a un percorso nel **Calendario**, l'utente deve prima aver creato percorsi e unità nella pagina **Percorsi**
- La **Programmazione** mostra i percorsi in sola lettura con un link "Gestisci in Percorsi" che porta fuori dalla pagina, perdendo il contesto
- Se nel Calendario l'utente si accorge che manca un'unità, il `PercorsoSelector` permette di aggiungerne una inline, ma non permette di creare un nuovo percorso — per quello, deve tornare alla pagina Percorsi

### 3. Dashboard e Calendario: sovrapposizione funzionale

**Problema di design.** Le due pagine principali fanno cose molto simili ma con interfacce diverse:

- **Dashboard** — Vista griglia settimanale + vista lista fallback + "Vista Oggi" + ore rimanenti + percorsi attivi
- **Calendario** — Vista lista settimanale con editing inline + generazione lezioni + lezioni extra

L'utente deve capire da solo quando usare una e quando l'altra. Entrambe mostrano lezioni settimanali con bottoni di stato P/S/X. La distinzione non è comunicata.

### 4. Generazione lezioni: meccanismo poco intuitivo

Il Calendario ha un'auto-generazione silenziosa che crea lezioni appena si apre una settimana vuota, E un bottone manuale "Genera lezioni da orario". Questo crea confusione:

- L'auto-generazione scatta una volta per settimana senza feedback visivo
- Se l'utente cancella lezioni generate, non vengono ri-generate automaticamente
- Non c'è possibilità di generare lezioni per più settimane in avanti

### 5. Le "ricorrenze" nella Programmazione sono un concetto oscuro

La sezione "Ore ricorrenti" richiede di assegnare un percorso a ogni slot orario (giorno × ora). Concetto potente ma:

- Non è spiegato da nessuna parte
- La relazione tra ricorrenze e generazione lezioni nel Calendario è invisibile all'utente
- Le ricorrenze alimentano la generazione automatica pre-collegando il percorso alla lezione, ma l'utente non lo sa

### 6. Nessun flusso "dal giornaliero al settimanale"

La "Vista Oggi" nel Dashboard è una sezione collassata, non una vista primaria. Un insegnante al mattino vuole:

1. Vedere cosa ha oggi
2. Segnare rapidamente le lezioni svolte
3. Aggiungere note al volo

Invece deve: aprire la Dashboard, cercare l'evidenziatura di oggi nella griglia, e la Vista Oggi non ha editing inline (solo cambio stato). Per aggiungere note deve andare al Calendario.

### 7. Assenza di collegamento diretto tra vista e azione

- Nella Dashboard non si può cliccare su una lezione per aprirla in editing
- Nel pannello "Ore rimanenti" non c'è un link alla Programmazione per la classe
- I "Percorsi attivi" nella Dashboard non linkano alla pagina Percorsi

### 8. Gestione delle unità distribuita in troppe interfacce

Le unità possono essere:
- Create/modificate nel `UnitaPanel` (dentro PercorsiPage)
- Create inline nel `PercorsoSelector` (dentro CalendarioPage)
- Visualizzate in sola lettura nella ProgrammazionePage
- Distribuite sulla timeline nella ProgrammazionePage

Tre interfacce diverse per la stessa entità, con funzionalità diverse in ognuna.

### 9. Problemi minori ma ricorrenti

- Nessun undo/annulla per cambi di stato lezione (click immediato e irreversibile)
- Nessun feedback di caricamento sui singoli bottoni di stato
- Legenda stati duplicata tra Dashboard e Calendario con stili diversi
- "Segna tutte svolte" nel Calendario è un bottone piccolo facile da non notare
- Il form "lezione extra" non suggerisce la data contestuale

---

## IDEE ALTERNATIVE PER MIGLIORARE IL FLUSSO

### A. Wizard di Onboarding (setup guidato)

Sostituire la pagina Impostazioni come punto di ingresso per i nuovi utenti con un wizard step-by-step:

```
Step 1: Anno scolastico (2025-2026)
Step 2: Classi e materie (3A — Informatica, 4B — Matematica...)
Step 3: Ore scolastiche (orari, giorno libero)
Step 4: Orario settimanale (griglia giorno × ora → classe)
Step 5: Vacanze/chiusure
Step 6: Data fine scuola
```

Ogni step mostra solo quello che serve con spiegazioni chiare. La pagina Impostazioni resta per modifiche successive.

### B. Unificare Dashboard e Calendario in una sola vista

Eliminare la separazione e creare una vista unica con due modalità:

- **Vista compatta**: griglia settimanale per overview rapido, click sulla cella apre editing inline
- **Vista dettaglio**: lista espansa con tutti i dettagli

Toggle in alto per passare da una all'altra. Stessa pagina, stessi dati, nessuna duplicazione.

### C. "Oggi" come vista primaria

Rendere la vista giornaliera il punto di ingresso principale dell'app:

- Lista verticale delle lezioni di oggi con:
  - Cambio stato con un tap
  - Editing inline (note, titolo, percorso/unità)
  - Indicatore "lezione in corso" basato sull'orario attuale
- Barra di navigazione rapida: "Ieri | Oggi | Domani | Settimana"
- Swipe per navigare tra i giorni (mobile-friendly)

### D. Pannello laterale contestuale

Quando l'utente lavora nel Calendario e clicca "collega percorso", un pannello slide-in potrebbe:

- Mostrare i percorsi della classe corrente
- Permettere di creare un nuovo percorso al volo
- Permettere di aggiungere/modificare unità
- Tutto senza lasciare la pagina corrente

Stesso approccio per la Programmazione: pannello laterale editabile invece del link "Gestisci in Percorsi".

### E. Rendere le "ricorrenze" più esplicite

Invece della griglia astratta giorno × ora → percorso:

1. Mostrare l'orario settimanale in modo visuale (come la griglia Dashboard)
2. Permettere di "colorare" ogni slot con un percorso usando drag & drop o click
3. Mostrare immediatamente l'impatto: "Percorso X: 2h/settimana, coprirà le sue unità in ~8 settimane"
4. Rendere esplicito che queste assegnazioni saranno usate nella generazione automatica

### F. Stato lezione "in sospeso" + note rapide

Aggiungere un quarto stato "Parziale" per lezioni non completamente svolte. Aggiungere un campo "nota rapida" accessibile direttamente dalla Dashboard.

### G. Timeline collegata al consuntivo

Nella Programmazione, mostrare per ogni settimana passata cosa è stato effettivamente svolto (dati reali) vs cosa era pianificato. Il confronto piano/realtà esiste solo nella pagina Export come testo.

---

## RIEPILOGO PRIORITÀ

| Priorità | Problema | Impatto |
|----------|---------|---------|
| Alta | Setup iniziale opaco senza guida | Abbandono al primo utilizzo |
| Alta | Dashboard/Calendario sovrapposti e confusi | Frustrazione quotidiana |
| Alta | Nessuna vista "Oggi" come entry point | Uso quotidiano scomodo |
| Media | Navigazione frammentata tra pagine | Workflow lento |
| Media | Ricorrenze incomprensibili | Feature potente ma inutilizzata |
| Media | Celle Dashboard non cliccabili | Interazione interrotta |
| Bassa | Nessun undo su cambi stato | Errori accidentali |
| Bassa | Unità gestite in 3 posti diversi | Confusione sulla feature |
