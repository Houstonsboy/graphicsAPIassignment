Firebase Leaderboard Plan

Recommendation: Firebase Firestore (best fit)

Your game is static HTML + Canvas hosted on GitHub Pages. You do not need a custom Node/Python server.







Option



Setup time



Fits your game?



Notes





Firebase Firestore



~30–45 min



Best



Collection model, free tier, works from browser SDK





Firebase Realtime Database



~20 min



OK



Slightly faster wiring, less structured queries





Supabase



~45 min



OK



Similar to Firebase; more SQL-style





Custom backend + DB



Hours



Overkill



Not needed for this scope

Fastest honest path: Firestore with one collection and document ID = username. That gives you upsert (setDoc) in one call when a player posts a new score — no separate users collection required for v1.



Data model

Collection: leaderboard

Document ID: normalized username (lowercase, trimmed) — e.g. gift

Fields:

{
  username: "Gift",      // display name (original casing)
  score: 340,            // score the player chose to post
  updatedAt: Timestamp   // server timestamp on write
}

Behavior (matches your session flow):





Player plays; score in [index.html](index.html) increases during the run.



Player chooses when to post (not automatic on death).



Posting upserts their row: same username → overwrites previous posted score.



Leaderboard query: top 10 by score descending. 

sequenceDiagram
  participant Player
  participant Game as index.html
  participant UI as PostScoreModal
  participant FS as Firestore

  Player->>Game: play, eat pellets
  Game->>Game: score updates in memory
  Player->>UI: tap Post Score
  UI->>Player: enter/confirm username
  Player->>UI: confirm post current score
  UI->>FS: setDoc(leaderboard/username, score)
  FS-->>UI: success
  UI->>FS: getDocs(top 10)
  FS-->>UI: leaderboard rows
  UI->>Player: show updated board
  Player->>Game: retry (R / tap) without posting



Firebase console setup (one-time, ~10 min)





Go to Firebase Console → Create project (Spark / free plan).



Build → Firestore Database → Create database (start in test mode for dev, then apply rules below).



Project settings → Your apps → Web (</>) → register app → copy config object.



Authentication → Settings → Authorized domains → add your GitHub Pages domain (and localhost for local testing).

Firestore security rules (read public, write validated, no deletes):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{usernameId} {
      allow read: if true;
      allow create, update: if
        request.resource.data.keys().hasAll(['username', 'score', 'updatedAt'])
        && request.resource.data.username is string
        && request.resource.data.username.size() >= 2
        && request.resource.data.username.size() <= 20
        && request.resource.data.score is int
        && request.resource.data.score >= 0
        && request.resource.data.score <= 50000;
      allow delete: if false;
    }
  }
}

Composite index: Firestore will prompt you to create one for orderBy('score', 'desc') on first leaderboard fetch — click the link in the browser console error.



Code changes (minimal, keeps Canvas game intact)

New files







File



Purpose





[firebase-config.js](firebase-config.js)



Firebase init + exported db





[leaderboard.js](leaderboard.js)



postScore(), fetchTopScores(), localStorage username helper

Use Firebase modular SDK v9+ via CDN ES modules (no build step):

<script type="module" src="./leaderboard.js"></script>

UI (HTML overlay, not Canvas)

Add a small DOM panel in [index.html](index.html) (styled like the vinyl player: black + #00BFFF border):





"Post Score" button — fixed top-left (or below vinyl on mobile)



Modal with:





username input (prefill from localStorage.getItem('drizzy_username'))



text: Post current score: {score}



Post / Cancel



Leaderboard drawer — top 10 list, refresh after post + on page load

Why HTML instead of Canvas text for forms: mobile keyboard, input validation, and accessibility are much easier.

Game integration points in [index.html](index.html)

Hook into existing score flow only — do not auto-submit on gameOver.







Location



Change





[checkGhostCollision()](index.html) (~line 476)



No Firebase call here





[drawGameOver()](index.html) (~line 522)



Add hint: "Post score or tap to retry"





New openPostScoreModal()



Reads live score variable, calls window.Leaderboard.postScore(username, score)





[resetGame()](index.html) (~line 483)



Unchanged — retry clears score without posting

Session username: save to localStorage on first successful post so repeat posts in the same session (or future visits) prefill the name.

leaderboard.js API surface

window.Leaderboard = {
  init(),                          // connect Firestore, load board once
  postScore(username, score),      // upsert doc, refresh board
  fetchTopScores(limit = 10),      // query + return sorted rows
};

Upsert logic:

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const id = username.trim().toLowerCase();
await setDoc(doc(db, 'leaderboard', id), {
  username: username.trim(),
  score,
  updatedAt: serverTimestamp(),
}, { merge: true });



Player flow (what you can explain in comments)





Play — score lives in memory (score in application stage).



Optional post mid-run — tap Post Score anytime; posts current score.



Game over — vinyl pauses; overlay shows final score.



Choice:





Post Score → username + submit → leaderboard updates



Retry (R / tap) → resetGame() → score resets to 0, no DB write



Post again later — same username overwrites their leaderboard row with the newly selected score.



What stays unchanged





[entityrules.js](entityrules.js) — movement / swipes



[gameplay.js](gameplay.js) — ghost AI



Canvas rendering pipeline (application / geometry / rasterization)



Vinyl player behavior



Free tier limits (Spark plan)





50,000 reads/day, 20,000 writes/day — more than enough for a class/demo leaderboard.



No credit card required for Spark tier.



Optional v2 (not needed for first ship)





Best-score-only rule: only update if newScore > existingScore (read doc first, then conditional write).



Firebase Anonymous Auth: reduces fake username spam (adds ~15 min setup).



Rate limiting: Cloud Function or App Check if abused publicly.



Implementation order





Create Firebase project + Firestore + web app config



Add firebase-config.js + leaderboard.js



Add HTML/CSS modal + leaderboard panel to index.html



Wire Post Score button to live score



Test locally (python -m http.server or Live Server)



Deploy to GitHub Pages + add domain to Firebase authorized domains



Apply production Firestore rules (replace test mode)



AI Agent Implementation Specification



Audience: A downstream AI coding agent tasked with implementing the Firebase leaderboard for the Drizzyman project.
Repo root: /home/gift/Drizzyman
Primary file: [index.html](index.html) — static HTML5 Canvas game (Pac-Man style), no build step, no existing backend.
Supporting files: [entityrules.js](entityrules.js), [gameplay.js](gameplay.js) — do NOT modify unless strictly necessary.



1. Mission statement

Implement a client-side Firebase Firestore leaderboard for a static browser game. Players voluntarily post their current in-memory score under a username. Posting is never automatic on game over. The same username can post again later in the session; each new post overwrites that user's leaderboard row. Display a top-10 leaderboard sorted by score descending.

The agent MUST keep the existing Canvas game, vinyl player, mobile swipe controls, and graphics-pipeline comments intact. All new UI for username input and leaderboard display MUST be HTML/CSS overlays (not drawn on Canvas).



2. Preconditions the agent must verify

Before writing code, the agent should confirm:







Check



How





Node.js available



node --version (needed for Firebase CLI, optional but recommended)





Firebase CLI available



firebase --version; if missing, offer to install via npm install -g firebase-tools





User is logged into Firebase



firebase login:list — if empty, STOP and prompt user (see Section 4)





Firebase project exists



firebase projects:list — if none, STOP and prompt user to create one





Firestore enabled on project



firebase firestore:databases:list or console check — if none, STOP and prompt user (see Section 5)





Web app registered



User must provide firebaseConfig object from Firebase Console



3. User interaction protocol (mandatory)

The agent MUST NOT guess Firebase credentials. The agent MUST pause and ask the user to complete interactive steps when required.

3.1 When to prompt the user to log in

Prompt the user if ANY of these are true:





firebase login:list shows no accounts



firebase projects:list fails with auth error



User has not yet provided a firebaseConfig object

Exact prompt template for the agent to use:

Before I can wire up Firestore, you need to authenticate with Firebase.

Please run this in your terminal (it will open a browser window):
  firebase login

When the browser says "Success", come back here and reply "logged in".

If you don't have the Firebase CLI yet:
  npm install -g firebase-tools
  firebase login

After user confirms, agent runs firebase login:list to verify.

3.2 When to prompt for project creation

If firebase projects:list returns empty or user has no suitable project:

Please create a Firebase project:

Option A — Browser (easiest):
  1. Go to https://console.firebase.google.com
  2. Click "Add project"
  3. Name it e.g. "drizzyman-leaderboard"
  4. Disable Google Analytics if you don't need it (optional)
  5. Choose the Spark (free) plan

Reply with your Project ID (shown in Project Settings → General).

Agent then runs: firebase use <projectId>

3.3 When to prompt for Web App config

After project is linked, agent MUST ask:

Register a Web app in Firebase Console:
  1. Project Settings (gear icon) → General
  2. "Your apps" → Add app → Web (</>)
  3. App nickname: "Drizzyman Web"
  4. Do NOT enable Firebase Hosting unless you want it (GitHub Pages is fine)
  5. Copy the firebaseConfig object and paste it here

It looks like:
  const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  };

Agent writes this into firebase-config.js. The apiKey is public by design for client-side Firebase apps; security comes from Firestore rules, not hiding the key.

3.4 When to prompt for authorized domains

After first deploy or when testing on GitHub Pages:

Add your site to Firebase authorized domains:
  Firebase Console → Authentication → Settings → Authorized domains
  Add: localhost (usually already there)
  Add: <your-github-username>.github.io
  Add: any custom domain (e.g. from CNAME)

Note: Firestore reads/writes do not require Authentication to be enabled for this v1, but authorized domains matter if Auth is added later.



4. Firebase CLI — can Firestore be created via CLI?

Yes, partially. The Firebase CLI can manage Firestore rules, indexes, and (in recent CLI versions) database creation — but the first-time project setup still requires user login because firebase login opens an OAuth browser flow the agent cannot complete alone.

4.1 Recommended CLI workflow (agent executes after user logs in)

# 1. Install CLI (if missing)
npm install -g firebase-tools

# 2. USER MUST RUN (interactive browser OAuth)
firebase login

# 3. Verify login
firebase login:list

# 4. List projects; user picks one
firebase projects:list

# 5. Link repo to project (creates .firebaserc)
cd /home/gift/Drizzyman
firebase use --add
# select project, alias: default

# 6. Initialize Firestore config files in repo
firebase init firestore
# Select: use existing project
# Accept defaults for rules file: firestore.rules
# Accept defaults for indexes file: firestore.indexes.json

4.2 Creating the Firestore database instance

If no database exists yet, try CLI first:

# List existing databases
firebase firestore:databases:list

# Create native Firestore database (CLI v13+)
firebase firestore:databases:create "(default)" --location=us-central1

If that command is unavailable or fails, prompt the user to create via Console:

Create Firestore in the browser:
  1. Firebase Console → Build → Firestore Database
  2. Click "Create database"
  3. Location: us-central1 (or nearest to your users)
  4. Start in TEST MODE for initial dev (agent will deploy production rules next)
  5. Click Enable

Important: --location is immutable after creation. Pick once.

4.3 Deploy rules and indexes via CLI

Agent writes firestore.rules and firestore.indexes.json in repo root, then:

firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

This is preferred over pasting rules manually in Console because rules are version-controlled.



5. Firestore data schema (canonical)

Collection: leaderboard







Field



Type



Required



Notes





Document ID



string



yes



username.trim().toLowerCase() — e.g. "gift"





username



string



yes



Display name, original casing, 2–20 chars





score



int



yes



Score user chose to post; 0–50000





updatedAt



timestamp



yes



serverTimestamp() on write

Write semantics





Upsert: setDoc(ref, data, { merge: true })



Same username posting again replaces score and updatedAt



No delete operations from client



No automatic write on gameOver

Read semantics





Query: collection('leaderboard').orderBy('score', 'desc').limit(10)



Requires composite index (Firestore auto-generates link on first failed query, or define in firestore.indexes.json)

Example document

leaderboard/gift
{
  username: "Gift",
  score: 340,
  updatedAt: 2026-05-26T20:15:00Z
}



6. Firestore security rules (deploy via CLI)

File: firestore.rules at repo root

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{usernameId} {
      allow read: if true;
      allow create, update: if
        request.resource.data.keys().hasAll(['username', 'score', 'updatedAt'])
        && request.resource.data.username is string
        && request.resource.data.username.size() >= 2
        && request.resource.data.username.size() <= 20
        && request.resource.data.score is int
        && request.resource.data.score >= 0
        && request.resource.data.score <= 50000;
      allow delete: if false;
    }
  }
}

Index file: firestore.indexes.json

{
  "indexes": [
    {
      "collectionGroup": "leaderboard",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "score", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}



7. Files to create or modify

7.1 NEW: firebase-config.js

ES module. Exports initialized app and db.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// USER-PROVIDED — agent must ask user to paste this
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

Use Firebase JS SDK v10.x modular CDN imports — no npm bundler in this project.

7.2 NEW: leaderboard.js

ES module. Imports from ./firebase-config.js.

Public API (attach to window for non-module game script):

window.Leaderboard = {
  init,           // async: fetch top 10 on load, render panel
  postScore,      // async (username, score): validate, upsert, refresh
  fetchTopScores, // async (limit=10): return array of { username, score, updatedAt }
  openModal,      // show post-score modal with current score
  closeModal,
};

Validation before write:





username.trim().length >= 2 && <= 20



/^[a-zA-Z0-9_\- ]+$/.test(username) — alphanumeric, underscore, hyphen, space



Number.isInteger(score) && score >= 0

localStorage key: drizzy_username — save on successful post, prefill modal.

Error handling: show user-visible message in modal on network/rules failure; console.error for debug.

7.3 MODIFY: index.html

HTML additions (inside <body>, z-index above canvas)





Leaderboard panel — fixed top-left, below safe area





Title: "LEADERBOARD"



<ol id="leaderboard-list"> — populated by JS



Loading / empty states



Post Score button — fixed bottom-center or top-left





id="btn-post-score"



Visible during gameplay AND on game-over (not hidden)



Modal overlay — hidden by default





id="post-score-modal"



Username <input id="post-username" maxlength="20">



Label: Post current score: <span id="post-score-value">0</span>



Buttons: Post (submit), Cancel (close)



Error message area

CSS additions

Match existing game aesthetic:





Background: rgba(0,0,0,0.88)



Border: 2px solid #00BFFF



Text: #ffb8ae (score/HUD color), accents #00BFFF



Font: monospace



Mobile: panel collapsible or scrollable; modal full-width with safe-area padding



z-index: canvas wrap ~auto, vinyl 200, leaderboard 150, modal 300

Script tag order (critical)

<script src="./entityrules.js"></script>
<script src="./gameplay.js"></script>
<script type="module" src="./leaderboard.js"></script>  <!-- NEW: before inline game script -->
<script>
  // existing inline game code — score, gameLoop, etc.
</script>

leaderboard.js is a module and loads async. Inline game script should call window.Leaderboard?.init() inside DOMContentLoaded or at end of body, NOT assume immediate availability. Pattern:

document.addEventListener('DOMContentLoaded', () => {
  window.Leaderboard?.init?.();
});
document.getElementById('btn-post-score')?.addEventListener('click', () => {
  window.Leaderboard?.openModal?.(score);
});

Game logic hooks (DO / DO NOT)







Action



Required?





Auto-submit score in checkGhostCollision()



NO — forbidden





Call Firebase in resetGame()



NO





Pass live score variable to openModal(score)



YES





Update drawGameOver() text to mention Post Score



YES — e.g. "Post score or tap to retry"





Modify entity movement, maze template, ghost AI



NO



8. Player UX flow (agent must implement exactly)

flowchart TD
  start[Page load] --> init[Leaderboard.init fetches top 10]
  init --> play[Player plays game]
  play --> scoreUp[score variable increases]
  scoreUp --> choice{Player action}
  choice -->|Tap Post Score| modal[Modal opens with current score]
  choice -->|Keep playing| play
  choice -->|Ghost collision| gameOver[gameOver=true vinyl pauses]
  gameOver --> choice2{Player action}
  choice2 -->|Post Score| modal
  choice2 -->|R or tap retry| reset[resetGame score=0]
  reset --> play
  modal --> enterName[Enter or confirm username]
  enterName --> submit[postScore upserts Firestore doc]
  submit --> refresh[Refresh top 10 list]
  refresh --> closeModal[Close modal]
  closeModal --> choice



9. Integration with existing score system

In [index.html](index.html), score is a global let variable:

let score = 0;  // ~line 419

Increments in checkPelletEat() (+10 pellet, +50 power). Resets to 0 in resetGame(). The leaderboard module reads this variable at post time only — it never subscribes to score changes.

Agent must expose a way for the modal to receive current score:





Option A (recommended): Leaderboard.openModal(currentScore) parameter



Option B: window.getCurrentScore = () => score set in inline script



10. Testing checklist (agent runs and reports)

Local

cd /home/gift/Drizzyman
python3 -m http.server 8080
# open http://localhost:8080







Test



Expected





Page loads, leaderboard panel shows "Loading..." then top 10 or empty



Pass





Play game, score increases, tap Post Score



Modal shows correct score





Submit username + score



Firestore doc created; list refreshes





Same username, higher score, post again



Same doc updated, list re-sorted





Tap retry without posting



score resets, no new Firestore write





Mobile swipe still moves player



Pass





Vinyl still plays/pauses with game



Pass

Firestore verification

firebase firestore:databases:list
# or check Firebase Console → Firestore → leaderboard collection

Production (GitHub Pages)





Push to repo, confirm live URL



Add URL to Firebase authorized domains if using Auth later



Confirm rules deployed (firebase deploy --only firestore:rules)



11. Repo files after implementation

/home/gift/Drizzyman/
├── index.html              (modified — HTML/CSS/modal/hooks)
├── leaderboard.js          (NEW)
├── firebase-config.js      (NEW — contains user's firebaseConfig)
├── firestore.rules         (NEW — deployed via CLI)
├── firestore.indexes.json  (NEW — deployed via CLI)
├── .firebaserc             (NEW — created by firebase use --add)
├── firebase.json           (NEW — created by firebase init firestore)
├── entityrules.js          (unchanged)
├── gameplay.js             (unchanged)
├── ImUpset.mp3
├── Drake.jpeg
└── images/

.gitignore recommendation

Do NOT gitignore firebase-config.js for this static client app (apiKey is public). If user prefers, use firebase-config.example.js template and gitignore the real file — agent should ask user preference.



12. Failure modes and agent responses







Error



Cause



Agent action





Missing or insufficient permissions



Rules not deployed or too strict



Deploy firestore.rules; verify field names





The query requires an index



Missing composite index



Deploy indexes OR click URL in error





firebase: command not found



CLI not installed



npm install -g firebase-tools





Not logged in



No OAuth session



Prompt user: firebase login





No Firebase project



Project not created



Prompt user via Console (Section 3.2)





Firestore has not been enabled



DB not created



CLI create OR Console (Section 4.2)





CORS / network errors on localhost



Serving via file://



Must use HTTP server, not open file directly





Empty leaderboard after post



Wrong collection name or query



Verify collection is leaderboard, index exists



13. Explicit non-goals (v1)





No Firebase Authentication (email/Google login)



No Cloud Functions



No npm/webpack build step



No automatic score submit on death



No best-score-only logic (user's chosen score always wins)



No modifications to Canvas rendering pipeline comments



14. Agent execution order (step-by-step)





Verify repo structure and read index.html score/gameOver/resetGame code



Check firebase --version; install if missing



Run firebase login:list — if empty, prompt user to firebase login



Run firebase projects:list — if empty, prompt user to create project



Run firebase use --add in repo



Run firebase init firestore (creates rules/indexes scaffolding)



Check firebase firestore:databases:list — create DB if missing (CLI or prompt user)



Prompt user for firebaseConfig — write firebase-config.js



Write firestore.rules and firestore.indexes.json per Section 6



Run firebase deploy --only firestore:rules,firestore:indexes



Implement leaderboard.js



Add HTML/CSS/modal/panel/button to index.html



Wire hooks per Section 7.3



Test locally with HTTP server



Prompt user to add GitHub Pages domain to authorized domains



Commit and report test results



15. Acceptance criteria

Implementation is complete when ALL are true:





User can enter username and post current score voluntarily



Posting same username again updates (not duplicates) their row



Top 10 leaderboard displays and refreshes after post



Game over does NOT auto-post score



Retry (R / tap) resets game without posting



Mobile swipes and vinyl behavior unchanged



Firestore rules deployed (not test-mode open rules)



Username persisted in localStorage for convenience



Agent documented which Firebase project ID was used

