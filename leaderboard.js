import { db } from './firebase-config.js';
import {
  doc, setDoc, serverTimestamp,
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const LS_KEY = 'drizzy_username';

const getSaved  = () => localStorage.getItem(LS_KEY) || '';
const setSaved  = v  => localStorage.setItem(LS_KEY, v);

function validate(name) {
  const t = name.trim();
  if (t.length < 2 || t.length > 20)         return 'Name must be 2–20 characters';
  if (!/^[a-zA-Z0-9_\- ]+$/.test(t))         return 'Letters, numbers, _ - and spaces only';
  return null;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ── Firestore ops ────────────────────────────────────────────────────────────

async function postScore(username, score) {
  const id = username.trim().toLowerCase();
  await setDoc(doc(db, 'drizzyman', id), {
    username: username.trim(),
    score,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function fetchTopScores(n = 10) {
  const q = query(collection(db, 'drizzyman'), orderBy('score', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// ── Leaderboard panel rendering ──────────────────────────────────────────────

function renderBoard(rows, highlightUser) {
  const list = document.getElementById('lb-list');
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = '<li class="lb-empty">No scores yet — be first!</li>';
    return;
  }
  const hl = (highlightUser || '').trim().toLowerCase();
  list.innerHTML = rows.map((row, i) => {
    const mine = row.username.trim().toLowerCase() === hl;
    return `<li class="${mine ? 'lb-me' : ''}">
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${esc(row.username)}</span>
      <span class="lb-score">${row.score}</span>
    </li>`;
  }).join('');
}

function showToast(msg) {
  const t = document.getElementById('rank-toast');
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.style.opacity = '0'; }, 3200);
}

// ── Username-prompt modal (page load) ────────────────────────────────────────

function setupUsernameModal() {
  const modal   = document.getElementById('username-modal');
  const input   = document.getElementById('username-input');
  const confirm = document.getElementById('username-confirm');
  const err     = document.getElementById('username-err');
  if (!modal) return;

  if (getSaved()) { modal.style.display = 'none'; return; }
  modal.style.display = 'flex';
  input?.focus();

  const submit = () => {
    const e = validate(input?.value || '');
    if (e) { if (err) err.textContent = e; return; }
    setSaved(input.value.trim());
    modal.style.display = 'none';
  };

  confirm?.addEventListener('click', submit);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ── Save-score modal ─────────────────────────────────────────────────────────

function openSaveModal(currentScore) {
  const modal = document.getElementById('save-modal');
  const sv    = document.getElementById('save-score-val');
  const input = document.getElementById('save-username');
  const err   = document.getElementById('save-err');
  if (!modal) return;
  if (sv)    sv.textContent = currentScore;
  if (input) input.value   = getSaved();
  if (err)   err.textContent = '';
  modal.style.display = 'flex';
  input?.focus();
}

function closeSaveModal() {
  const modal = document.getElementById('save-modal');
  if (modal) modal.style.display = 'none';
}

function setupSaveModal() {
  const postBtn   = document.getElementById('save-post');
  const cancelBtn = document.getElementById('save-cancel');
  const input     = document.getElementById('save-username');
  const err       = document.getElementById('save-err');

  cancelBtn?.addEventListener('click', closeSaveModal);

  const submit = async () => {
    const username = input?.value || getSaved();
    const e = validate(username);
    if (e) { if (err) err.textContent = e; return; }

    const score = parseInt(document.getElementById('save-score-val')?.textContent || '0', 10);
    if (postBtn) { postBtn.disabled = true; postBtn.textContent = 'Saving…'; }

    try {
      await postScore(username, score);
      setSaved(username);
      const rows = await fetchTopScores(10);
      renderBoard(rows, username);
      const rank = rows.findIndex(r =>
        r.username.trim().toLowerCase() === username.trim().toLowerCase()) + 1;
      showToast(rank ? `${username}  →  #${rank} on the board!` : `${username}  — score saved!`);
      closeSaveModal();
    } catch (ex) {
      console.error(ex);
      if (err) err.textContent = 'Save failed — check your connection.';
    } finally {
      if (postBtn) { postBtn.disabled = false; postBtn.textContent = 'Save'; }
    }
  };

  postBtn?.addEventListener('click', submit);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ── Leaderboard panel toggle ─────────────────────────────────────────────────

function setupPanelToggle() {
  const panel  = document.getElementById('lb-panel');
  const title  = document.getElementById('lb-title');
  const toggle = document.getElementById('lb-toggle');
  if (!panel || !title) return;

  // Collapse by default on small screens to keep maze unobstructed
  if (window.innerWidth < 500) {
    panel.classList.add('collapsed');
    if (toggle) toggle.textContent = '▸';
  }

  title.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    if (toggle) toggle.textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
  });
}

// ── init (self-invoked on DOMContentLoaded) ──────────────────────────────────

async function init() {
  setupPanelToggle();
  setupUsernameModal();
  setupSaveModal();
  try {
    const rows = await fetchTopScores(10);
    renderBoard(rows);
  } catch (e) {
    console.error('Leaderboard load failed:', e);
    const list = document.getElementById('lb-list');
    if (list) list.innerHTML = '<li class="lb-empty">Could not load scores</li>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.Leaderboard = { openSaveModal, closeSaveModal, postScore, fetchTopScores };
