# Guida per dummies: pubblicare l'app su Firebase Hosting

Zero prerequisiti dati per scontati. Regola d'oro: **un comando alla
volta** — copia la riga, incollala nel terminale, premi Invio, aspetta
che il terminale finisca (ricompare la riga di attesa con `>` o `$`),
poi passa al comando successivo.

Per incollare nel terminale: Windows → tasto destro del mouse (o Ctrl+V);
Mac → Cmd+V.

---

## Parte 0 — Cosa ti serve (solo la prima volta)

### 0.1 Node.js
1. Vai su [nodejs.org](https://nodejs.org) e scarica la versione **LTS**.
2. Installa: Avanti → Avanti → Fine (tutte le impostazioni di default).
3. Verifica: apri un terminale qualsiasi e scrivi `node --version` → se
   esce un numero (es. `v22.x.x`), è a posto. Chiudi pure quel terminale.

### 0.2 La cartella del progetto
Se hai già la cartella dell'app sul computer, salta a 0.3.

Se non ce l'hai:
1. Vai su `github.com/lcumrg/le-mie-lezioni` (loggato con il tuo account GitHub).
2. Pulsante verde **Code** → **Download ZIP**.
3. Estrai lo ZIP (tasto destro → Estrai tutto) dentro Documenti.
4. Otterrai una cartella tipo `Le-mie-Lezioni-claude-lesson-management-app-...`:
   puoi rinominarla semplicemente `le-mie-lezioni`.

### 0.3 Aprire il terminale DENTRO la cartella
Questo è il passaggio che frega tutti: i comandi vanno dati "da dentro"
la cartella del progetto.

- **Windows 11**: apri la cartella in Esplora file → click destro su uno
  spazio vuoto (non su un file) → **"Apri nel terminale"**.
- **Windows 10**: apri la cartella in Esplora file → clicca nella barra
  dell'indirizzo in alto, scrivi `cmd` e premi Invio.
- **Mac**: apri Finder sulla cartella → tasto destro sul nome della
  cartella → Servizi → "Nuovo terminale nella cartella".

Verifica: nella riga del terminale deve comparire il nome della cartella
(es. `...\le-mie-lezioni>`).

D'ora in poi TUTTI i comandi si danno in questo terminale.

### 0.4 Il file `.env` (le "chiavi" dell'app)
L'app ha bisogno delle sue chiavi Firebase per funzionare. Per sicurezza
NON sono su GitHub: stanno in un file chiamato `.env` che devi avere tu.
Se ce l'hai già (hai già fatto girare l'app in locale), salta alla Parte 1.

Se non ce l'hai, crealo così:

1. Nel terminale scrivi (Windows):
   ```
   copy .env.example .env
   ```
   (su Mac: `cp .env.example .env`)
2. Aprilo con il Blocco note (Windows):
   ```
   notepad .env
   ```
   (su Mac: `open -e .env`)
3. In un'altra finestra del browser apri
   [console.firebase.google.com](https://console.firebase.google.com) →
   clicca sul tuo progetto → icona **ingranaggio ⚙** in alto a sinistra →
   **Impostazioni progetto** → scheda **Generali** → scendi fino a
   **Le tue app** → clicca sulla tua app web → seleziona **Configurazione**
   (o "Config"). Vedrai un blocco con apiKey, authDomain, ecc.
4. Copia ogni valore nel file `.env`, riga per riga, così:

   | Dalla console Firebase | Nel file .env |
   |---|---|
   | apiKey | `VITE_FIREBASE_API_KEY=...` |
   | authDomain | `VITE_FIREBASE_AUTH_DOMAIN=...` |
   | projectId | `VITE_FIREBASE_PROJECT_ID=...` |
   | storageBucket | `VITE_FIREBASE_STORAGE_BUCKET=...` |
   | messagingSenderId | `VITE_FIREBASE_MESSAGING_SENDER_ID=...` |
   | appId | `VITE_FIREBASE_APP_ID=...` |

   E nell'ultima riga metti la tua email:
   `VITE_AUTHORIZED_EMAIL=la-tua-email@gmail.com`

   Attenzione: niente virgolette, niente spazi prima o dopo l'`=`.
5. Salva e chiudi il Blocco note.

---

## Parte 1 — Setup Firebase (solo la prima volta)

Un comando alla volta, nel terminale aperto dentro la cartella.

**1.** Scarica i "pezzi" dell'app (1-2 minuti, tante righe, eventuali
scritte gialle WARN sono normali):
```
npm install
```

**2.** Installa lo strumento di Firebase:
```
npm install -g firebase-tools
```
(Su Mac, se dice "permission denied": `sudo npm install -g firebase-tools`
e inserisci la password del computer.)

**3.** Fai login:
```
firebase login
```
Alla domanda sulle statistiche (Y/n) puoi rispondere `n`. Si apre il
browser: scegli il tuo account Google (lo stesso dell'app) → **Consenti**.
Torna al terminale: deve dire `Success! Logged in as ...`.

**4.** Collega il progetto:
```
firebase use --add
```
Compare l'elenco dei tuoi progetti: muoviti con le frecce ↑ ↓, premi
Invio su quello dell'app. Quando chiede l'alias, scrivi `default` e Invio.

**5.** Compila l'app (deve finire con `✓ built in ...`):
```
npm run build
```

**6.** Pubblica:
```
firebase deploy --only hosting
```
Alla fine stampa una riga tipo:
`Hosting URL: https://tuo-progetto.web.app`
**← Questo è il nuovo indirizzo dell'app.** Salvalo nei preferiti,
anche sul telefono.

**7.** Aprilo nel browser, fai il login con Google e controlla che i tuoi
dati ci siano tutti. In fondo alla barra laterale la data di "deploy"
deve essere quella di oggi.

---

## Parte 2 — Le volte successive

Terminale nella cartella (passo 0.3), poi:
```
npm run build
```
```
firebase deploy --only hosting
```
Fine. (Se nel frattempo Claude ha pubblicato aggiornamenti del codice:
prima riscarica lo ZIP da GitHub come in 0.2 — oppure chiedi a Claude di
configurare il deploy automatico, così questa parte sparisce del tutto.)

---

## Se qualcosa va storto

Copia le righe rosse di errore dal terminale (o dalla console del browser:
F12 → scheda Console) e incollale in chat a Claude. Nessun errore qui è
grave: il sito vecchio resta comunque al suo posto finché non funziona
quello nuovo.
