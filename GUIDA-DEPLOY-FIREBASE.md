# Guida: pubblicare l'app su Firebase Hosting

Guida passo passo per il deploy su Firebase Hosting (sostituisce Netlify).
La configurazione è già nel repo (`firebase.json`): questi sono solo i
comandi da eseguire sul proprio computer.

## Prima volta (setup, ~10 minuti)

### 1. Aggiorna il progetto
```bash
git pull
git checkout claude/lesson-management-app-LnVPR
npm install
```

### 2. Installa la Firebase CLI
```bash
npm install -g firebase-tools
```
Verifica con `firebase --version` (un numero qualsiasi va bene).

### 3. Accedi con il tuo account Google
```bash
firebase login
```
Si apre il browser: accedi con l'account Google **proprietario del progetto
Firebase** (lo stesso con cui entri nell'app) e concedi i permessi.

### 4. Collega il progetto
```bash
firebase use --add
```
Compare l'elenco dei tuoi progetti Firebase: seleziona quello dell'app con
le frecce e premi Invio. Come alias scrivi `default`.
(Questo crea il file `.firebaserc`: va bene committarlo.)

### 5. Compila e pubblica
```bash
npm run build
firebase deploy --only hosting
```
Alla fine la CLI stampa l'indirizzo: `https://TUO-PROGETTO.web.app`.

### 6. Verifica
Apri l'indirizzo, fai login con Google e controlla che i dati ci siano.
Il login funziona subito: i domini `web.app` e `firebaseapp.com` del
progetto sono già autorizzati per l'autenticazione.

Se qualcosa non va (pagina bianca, login bloccato): apri la console del
browser (F12 → Console) e riporta l'errore in chat.

## Le volte successive (routine, ~1 minuto)

```bash
git pull
npm run build
firebase deploy --only hosting
```

## Note

- **Niente crediti/minuti di build**: la build avviene sul tuo computer,
  il deploy è un semplice upload. Non esiste un limite tipo Netlify.
- **Regole Firestore**: con `firebase deploy` (senza `--only hosting`)
  pubblichi anche regole e indici dal repo, tutto insieme.
- **Netlify**: non serve toccare nulla; il vecchio sito resta com'è e si
  può eliminare quando vuoi (Site configuration → Delete site). I file
  `netlify.toml`, `public/_redirects` e `public/_headers` nel repo non
  danno fastidio a Firebase.
- **Dominio personalizzato** (opzionale): console Firebase → Hosting →
  "Aggiungi dominio personalizzato", poi aggiungi lo stesso dominio in
  Authentication → Settings → Authorized domains.
- **Deploy automatico a ogni push** (opzionale, da fare con Claude):
  `firebase init hosting:github` configura una GitHub Action che builda
  e pubblica da sola.
