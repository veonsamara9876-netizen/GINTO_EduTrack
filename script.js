// ===== ONE-TIME CLEAN-UP OF OLD BROWSER DATA =====
// Everything is now saved online (Firebase), not in the browser. The first time a browser opens this version,
// the old test data that earlier versions kept in that browser (accounts, grades, ...) is erased.
const DATA_RESET_ID = 'cloud-2026-11-12';
(function wipeSavedData() {
  try {
    if (localStorage.getItem('ginto_data_reset') === DATA_RESET_ID) return;
    Object.keys(localStorage).filter(k => k.startsWith('ginto_')).forEach(k => localStorage.removeItem(k));
    Object.keys(sessionStorage).filter(k => k.startsWith('ginto_')).forEach(k => sessionStorage.removeItem(k));
    localStorage.setItem('ginto_data_reset', DATA_RESET_ID);
  } catch (err) {
    console.error('Could not reset saved data:', err);
  }
})();

// Any teacher can register (the teacher password code keeps students out) and picks ONE subject at sign-up.
// Teacher passwords must look like  12SHS_<the teacher's own password>
const TEACHER_PASSWORD_PREFIX = '12SHS_';
const SUBJECTS = ["Physics", "Earth and Space", "General Biology", "Research"];
const CLASSES = ["ACAD 12 - G", "ACAD 12 - H", "ACAD 12 - I"];
// School logo shown at the top left of the dashboard. Put this image in the SAME folder as index.html.
// If the file is missing, the round "GN" badge is shown instead.
const SCHOOL_LOGO = "902205124_1365387038859915_8825976409590398771_n.jpg";

// Default profile picture (used until someone uploads their own). Keep this image in the same folder as index.html.
const DEFAULT_AVATAR = "893713508_2379353969474570_990198340075586665_n.jpg";

// DepEd Highest Possible Scores (HPS) Config
// DepEd Order No. 015, s. 2026: Written Works, Performance Tasks and Examinations (ST1 + ST2 + TE)
// ("qa" below is the Examinations component)
const HPS = {
  ww: [5, 5, 10, 10, 10],  // Written Works activities, Total = 40
  pt: [100, 100, 100],     // Performance Tasks, Total = 300
  qa: [25, 25, 50]         // Examinations: ST1, ST2, TE, Total = 100
};

const HPS_TOTALS = {
  ww: HPS.ww.reduce((a, b) => a + b, 0),
  pt: HPS.pt.reduce((a, b) => a + b, 0),
  qa: HPS.qa.reduce((a, b) => a + b, 0)
};

// DepEd Grading Formulas
function calcPercentageScore(total, hpsTotal) {
  if (!hpsTotal) return 0;
  return (total / hpsTotal) * 100;
}

function calcWeightedScore(ps, weightPercent) {
  return (ps * (weightPercent / 100));
}

// New grading scale and descriptors (DepEd Order No. 015, s. 2026), Grades 4-12
//   A Advancing 90-100 | B Benchmarking 80-89 | C Connecting 75-79 | D Developing 65-74 | E Emerging 0-64
function getDescriptor(termGrade) {
  if (termGrade >= 90) return "Advancing";
  if (termGrade >= 80) return "Benchmarking";
  if (termGrade >= 75) return "Connecting";
  if (termGrade >= 65) return "Developing";
  return "Emerging";
}

// Adjusted Transmutation Table, SY 2026-2027 transition (DepEd Order No. 015, s. 2026):
// each pair is [lowest Initial Grade, Transmuted Grade]. An Initial Grade of 70.00 is needed to get 75.
const TRANSMUTATION_TABLE = [
  [99.50, 100], [98.32, 99], [97.14, 98], [95.96, 97], [94.78, 96], [93.60, 95],
  [92.42, 94], [91.24, 93], [90.06, 92], [88.88, 91], [87.70, 90], [86.52, 89],
  [85.34, 88], [84.16, 87], [82.98, 86], [81.80, 85], [80.62, 84], [79.44, 83],
  [78.26, 82], [77.08, 81], [75.90, 80], [74.72, 79], [73.54, 78], [72.36, 77],
  [71.18, 76], [70.00, 75], [65.34, 74], [60.67, 73], [56.01, 72], [51.34, 71],
  [46.67, 70], [42.01, 69], [37.34, 68], [32.68, 67], [28.01, 66], [23.35, 65],
  [18.68, 64], [14.01, 63], [9.35, 62], [4.68, 61], [0.00, 60]
];

function transmuteGrade(initial) {
  const row = TRANSMUTATION_TABLE.find(([lowest]) => initial >= lowest);
  return row ? row[1] : 60;
}
const GROUP_WEIGHTS = { ww: 20, pt: 50, qa: 30 }; // core academic subjects
const GROUP_NAMES = { ww: 'Written Works', pt: 'Performance Tasks', qa: 'Examinations' };
const MAX_ACTIVITIES = { ww: 15, pt: 15, qa: 3 }; // Examinations are fixed: ST1, ST2 and TE

const fmtNum = n => Number(Number(n).toFixed(2));
const hpsSum = arr => arr.reduce((a, b) => a + b, 0);
const isTeacherUser = () => !!state.currentUser && state.currentUser.role === 'teacher';

// The highest possible scores (one per activity column) for a section + subject
function getHpsConfig(section, subject) {
  const saved = state.hpsConfig[section] && state.hpsConfig[section][subject];
  return saved || { ww: [...HPS.ww], pt: [...HPS.pt], qa: [...HPS.qa] };
}

function ensureHpsConfig(section, subject) {
  if (!state.hpsConfig[section]) state.hpsConfig[section] = {};
  if (!state.hpsConfig[section][subject]) {
    state.hpsConfig[section][subject] = { ww: [...HPS.ww], pt: [...HPS.pt], qa: [...HPS.qa] };
  }
  return state.hpsConfig[section][subject];
}

// A student's scores, always the same number of columns as the section's config (missing = 0)
function getStudentScores(student, section, subject) {
  const cfg = getHpsConfig(section, subject);
  const raw = (student.scores && student.scores[subject]) || {};
  const out = {};
  ['ww', 'pt', 'qa'].forEach(k => {
    out[k] = cfg[k].map((_, i) => Number((raw[k] || [])[i]) || 0);
  });
  return out;
}

// Makes every student's saved scores match the section's current number of columns
function syncScoresToConfig(section, subject) {
  (state.classesData[section] || []).forEach(st => {
    st.scores = st.scores || {};
    st.scores[subject] = getStudentScores(st, section, subject);
  });
}

// Totals, initial grade (not transmuted), term grade (transmuted) and descriptor
// DepEd flow: Total -> PS (Percentage Score) -> WS (Weighted Score) -> Initial Grade -> Term Grade (transmuted)
function computeGrades(scores, cfg) {
  const totals = {}, ps = {}, ws = {};
  ['ww', 'pt', 'qa'].forEach(k => {
    totals[k] = scores[k].reduce((a, b) => a + b, 0);
    const hpsTotal = hpsSum(cfg[k]);
    ps[k] = hpsTotal > 0 ? Math.round((totals[k] / hpsTotal) * 10000) / 100 : 0; // PS = total / highest possible x 100
    ws[k] = Math.round(ps[k] * GROUP_WEIGHTS[k]) / 100;                          // WS = PS x weight
  });
  const initial = Math.round((ws.ww + ws.pt + ws.qa) * 100) / 100;               // Initial Grade = WW WS + PT WS + Examinations WS
  const term = transmuteGrade(initial);
  return { totals, ps, ws, initial, term, descriptor: getDescriptor(term) };
}

// Separate Male and Female students, each sorted in alphabetical order (A-Z) by Surname/Name
function getGroupedAndSortedRoster(roster) {
  const males = roster
    .filter(s => (s.sex || 'Male').toLowerCase() === 'male')
    .sort((a, b) => a.name.localeCompare(b.name));

  const females = roster
    .filter(s => (s.sex || 'Male').toLowerCase() === 'female')
    .sort((a, b) => a.name.localeCompare(b.name));

  return { males, females };
}

// ===== ONLINE STORAGE (Firebase Firestore) =====
// Everything the site saves (accounts, grades, announcements, presentations, pictures) is kept online, so a change
// made on one device shows up on every other device.
// Paste YOUR project's settings below: Firebase console > Project settings > General > Your apps > Web app.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAqA5abbjBOvRGtgipYmFg5WaG1LmYE4AA",
  authDomain: "ginto-edutrack-88beb.firebaseapp.com",
  projectId: "ginto-edutrack-88beb",
  appId: "1:957279787323:web:cdf5f67c704ba97bbc3f1e"
};
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB per stored presentation file
const BLOB_CHUNK = 700000;              // a file is saved in pieces of this many characters (one online document holds < 1 MB)

let db = null;
let authReady = null;

function initCloud() {
  if (!window.firebase || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.startsWith('PASTE')) return false;
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
  authReady = firebase.auth().signInAnonymously();
  return true;
}

// Document ids (names are lower-cased so "Cruz, Ana" and "cruz, ana" are the same person)
const userKey = name => encodeURIComponent(String(name).trim().toLowerCase()).replace(/~/g, '%7E');
const docKey = (...parts) => parts.map(p => encodeURIComponent(String(p)).replace(/~/g, '%7E')).join('~');

// Passwords and LRNs are never stored as typed; only a one-way hash is kept online
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const hashPassword = (name, password) => sha256Hex('ginto-pw|' + userKey(name) + '|' + password);
const hashLrn = lrn => sha256Hex('ginto-lrn|' + lrn);

// --- accounts (one document per person; looked up by name when logging in) ---
const userCache = {};

async function fetchUser(name) {
  const key = userKey(name);
  const snap = await db.collection('users').doc(key).get();
  if (snap.exists) {
    userCache[key] = snap.data();
    return userCache[key];
  }
  delete userCache[key];
  return null;
}

async function loadAvatar(key) {
  try {
    const snap = await db.collection('avatars').doc(key).get();
    return snap.exists && snap.data().data ? snap.data().data : DEFAULT_AVATAR;
  } catch (err) {
    return DEFAULT_AVATAR;
  }
}

function blankScores() {
  const scores = {};
  SUBJECTS.forEach(sub => {
    scores[sub] = { ww: [0, 0, 0, 0, 0], pt: [0, 0, 0], qa: [0, 0, 0] };
  });
  return scores;
}

// --- big files (presentations, announcement attachments), saved online in pieces ---
const blobCache = {};

async function saveBlob(dataUrl) {
  const id = 'b' + Date.now() + Math.random().toString(36).slice(2, 8);
  const parts = Math.ceil(dataUrl.length / BLOB_CHUNK);
  const batch = db.batch();
  for (let i = 0; i < parts; i++) {
    batch.set(db.collection('blobs').doc(id + '_' + String(i).padStart(3, '0')), {
      blob: id, i, data: dataUrl.slice(i * BLOB_CHUNK, (i + 1) * BLOB_CHUNK)
    });
  }
  await batch.commit();
  return { id, parts };
}

async function loadBlob(id, parts) {
  const snaps = await Promise.all(Array.from({ length: parts }, (_, i) =>
    db.collection('blobs').doc(id + '_' + String(i).padStart(3, '0')).get()));
  return snaps.map(s => s.data().data).join('');
}

async function getBlobData(id, parts) {
  if (!blobCache[id]) blobCache[id] = await loadBlob(id, parts);
  return blobCache[id];
}

function deleteBlob(id, parts) {
  if (!db || !id) return;
  const batch = db.batch();
  for (let i = 0; i < (parts || 1); i++) batch.delete(db.collection('blobs').doc(id + '_' + String(i).padStart(3, '0')));
  batch.commit().catch(() => {});
}

async function triggerDownload(dataUrl, filename) {
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// --- saving: every call to saveAll() sends only what changed since the last save ---
const synced = {
  announcements: new Map(), presentations: new Map(), notifications: new Map(), hps: new Map(), students: new Map()
};
let unsubscribers = [];
let renderPending = false;
let deferredSnaps = {};
let lastSaveOps = 0;
let saveErrorShown = false;

const plain = obj => JSON.parse(JSON.stringify(obj));

// JSON text with sorted keys, so two copies of the same data always compare equal
function stable(value) {
  return JSON.stringify(value, (k, v) => (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {})
    : v);
}

function studentDoc(section, st) {
  return { id: st.id, name: st.name, nameKey: userKey(st.name), sex: st.sex || 'Male', section, scores: plain(st.scores || {}) };
}

function studentFingerprint(doc) {
  const base = { ...doc };
  delete base.scores;
  const subs = {};
  Object.keys(doc.scores).forEach(s => { subs[s] = stable(doc.scores[s]); });
  return { base: stable(base), subs };
}

function buildDocs() {
  const want = { announcements: new Map(), presentations: new Map(), notifications: new Map(), hps: new Map(), students: new Map() };
  state.announcements.forEach(a => want.announcements.set(String(a.id), plain(a)));
  state.presentations.forEach(p => want.presentations.set(String(p.id), plain(p)));
  state.notifications.forEach(n => want.notifications.set(String(n.id), plain(n)));
  Object.keys(state.hpsConfig).forEach(sec => Object.keys(state.hpsConfig[sec] || {}).forEach(sub => {
    const c = state.hpsConfig[sec][sub];
    want.hps.set(docKey(sec, sub), { section: sec, subject: sub, ww: [...c.ww], pt: [...c.pt], qa: [...c.qa] });
  }));
  Object.keys(state.classesData).forEach(sec => (state.classesData[sec] || []).forEach(st => {
    want.students.set(docKey(sec, userKey(st.name)), studentDoc(sec, st));
  }));
  return want;
}

function reportSaveError(err) {
  console.error('Online save failed:', err);
  if (saveErrorShown) return;
  saveErrorShown = true;
  alert('Your last change could not be saved online. Please check the internet connection and try again.');
  setTimeout(() => { saveErrorShown = false; }, 5000);
}

function saveAll() {
  if (!db) return true;
  const want = buildDocs();
  const ops = [];

  ['announcements', 'presentations', 'notifications', 'hps'].forEach(c => {
    want[c].forEach((obj, id) => {
      const json = stable(obj);
      if (synced[c].get(id) !== json) {
        synced[c].set(id, json);
        ops.push({ type: 'set', ref: db.collection(c).doc(id), data: obj });
      }
    });
    Array.from(synced[c].keys()).forEach(id => {
      if (!want[c].has(id)) {
        synced[c].delete(id);
        ops.push({ type: 'delete', ref: db.collection(c).doc(id) });
      }
    });
  });

  // Students: only the subject whose scores changed is sent, so two teachers can grade the same student at once
  want.students.forEach((doc, id) => {
    const fp = studentFingerprint(doc);
    const old = synced.students.get(id);
    const ref = db.collection('students').doc(id);
    if (!old || old.base !== fp.base) {
      ops.push({ type: 'merge', ref, data: doc });
    } else {
      const changed = {};
      let any = false;
      Object.keys(doc.scores).forEach(s => {
        if (old.subs[s] !== fp.subs[s]) { changed[s] = doc.scores[s]; any = true; }
      });
      if (any) ops.push({ type: 'merge', ref, data: { scores: changed } });
    }
    synced.students.set(id, fp);
  });
  Array.from(synced.students.keys()).forEach(id => {
    if (!want.students.has(id)) {
      synced.students.delete(id);
      ops.push({ type: 'delete', ref: db.collection('students').doc(id) });
    }
  });

  lastSaveOps = ops.length;
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach(op => {
      if (op.type === 'delete') batch.delete(op.ref);
      else if (op.type === 'merge') batch.set(op.ref, op.data, { merge: true });
      else batch.set(op.ref, op.data);
    });
    batch.commit().catch(reportSaveError);
  }
  return true;
}

// --- live updates: changes made on other devices arrive here ---
function setIfChanged(key, value) {
  const changed = stable(state[key]) !== stable(value);
  state[key] = value;
  return changed;
}

const newestFirst = (a, b) => b.id - a.id;

const snapshotHandlers = {
  announcements(snap) {
    const list = snap.docs.map(d => d.data()).sort(newestFirst);
    synced.announcements = new Map(list.map(a => [String(a.id), stable(plain(a))]));
    return setIfChanged('announcements', list);
  },
  presentations(snap) {
    const list = snap.docs.map(d => d.data()).sort(newestFirst);
    synced.presentations = new Map(list.map(p => [String(p.id), stable(plain(p))]));
    return setIfChanged('presentations', list);
  },
  notifications(snap) {
    const list = snap.docs.map(d => d.data()).sort(newestFirst);
    synced.notifications = new Map(list.map(n => [String(n.id), stable(plain(n))]));
    return setIfChanged('notifications', list);
  },
  hps(snap) {
    const cfg = {};
    synced.hps = new Map();
    snap.docs.forEach(d => {
      const x = d.data();
      (cfg[x.section] = cfg[x.section] || {})[x.subject] = { ww: x.ww, pt: x.pt, qa: x.qa };
      synced.hps.set(docKey(x.section, x.subject), stable({ section: x.section, subject: x.subject, ww: x.ww, pt: x.pt, qa: x.qa }));
    });
    return setIfChanged('hpsConfig', cfg);
  },
  students(snap) {
    const data = {};
    CLASSES.forEach(c => { data[c] = []; });
    synced.students = new Map();
    snap.docs.forEach(d => {
      const x = d.data();
      const st = { id: x.id, name: x.name, sex: x.sex || 'Male', scores: x.scores || {} };
      (data[x.section] = data[x.section] || []).push(st);
      synced.students.set(docKey(x.section, userKey(x.name)), studentFingerprint(studentDoc(x.section, st)));
    });
    return setIfChanged('classesData', data);
  }
};

function onSnapshotFor(name, snap) {
  // a score is being typed right now: hold the update back so it cannot overwrite what is being typed
  if (saveTimer !== null && (name === 'students' || name === 'hps')) {
    deferredSnaps[name] = snap;
    return false;
  }
  return snapshotHandlers[name](snap);
}

function applyDeferredSnapshots() {
  const names = Object.keys(deferredSnaps);
  let changed = false;
  names.forEach(n => {
    const snap = deferredSnaps[n];
    delete deferredSnaps[n];
    if (lastSaveOps === 0 && snapshotHandlers[n](snap)) changed = true; // if we just saved, the next update already includes it
  });
  if (changed) renderFromRemote();
}

// Redraw after a change from another device, but never while someone is typing or has a window open
function renderFromRemote() {
  if (state.view !== 'dashboard' || !state.currentUser) return;
  const el = document.activeElement;
  const typing = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && document.getElementById('app').contains(el);
  if (typing || state.editingAll || state.showUploadModal || state.showAnnouncementModal) {
    renderPending = true;
    return;
  }
  render();
}

document.addEventListener('focusout', () => {
  setTimeout(() => { if (renderPending) renderFromRemote(); }, 300);
});

function stopListeners() {
  unsubscribers.forEach(u => { try { u(); } catch (err) { /* ignore */ } });
  unsubscribers = [];
}

function resetLocalData() {
  stopListeners();
  deferredSnaps = {};
  state.announcements = [];
  state.presentations = [];
  state.notifications = [];
  state.hpsConfig = {};
  state.classesData = {};
  CLASSES.forEach(c => { state.classesData[c] = []; });
  Object.keys(synced).forEach(k => { synced[k] = new Map(); });
}

// Starts the live connection for the logged-in person and waits until the first data has arrived
function startListeners() {
  stopListeners();
  const user = state.currentUser;
  const isTeacher = user.role === 'teacher';
  const newest = c => db.collection(c).orderBy('id', 'desc').limit(100);
  const sources = [
    ['announcements', newest('announcements')],
    ['notifications', newest('notifications')],
    ['presentations', newest('presentations')],
    ['students', isTeacher ? db.collection('students') : db.collection('students').where('nameKey', '==', userKey(user.name))],
    ['hps', isTeacher ? db.collection('hps') : db.collection('hps').where('section', '==', state.selectedClass)]
  ];
  let started = false;
  const firsts = sources.map(([name, query]) => new Promise(resolve => {
    let first = true;
    unsubscribers.push(query.onSnapshot(snap => {
      const changed = onSnapshotFor(name, snap);
      if (first) {
        first = false;
        resolve();
        if (started) renderFromRemote();
      } else if (changed) {
        renderFromRemote();
      }
    }, err => {
      console.error('Live update failed for ' + name, err);
      resolve();
    }));
  }));
  return Promise.race([Promise.all(firsts), new Promise(r => setTimeout(r, 8000))]).then(() => { started = true; });
}

// --- LOGIN SESSION (survives refresh, ends when the tab/browser is closed) ---
const SESSION_KEY = 'ginto_session';

function saveSession() {
  try {
    if (!state.currentUser) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    // Avatar is NOT stored here (it can be large); it is re-read from its own key on restore
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      user: { name: state.currentUser.name, role: state.currentUser.role },
      selectedClass: state.selectedClass,
      activeSubject: state.activeSubject,
      activeTab: state.activeTab
    }));
  } catch (err) {
    console.error('Could not save session:', err);
  }
}

async function restoreSession() {
  let s = null;
  try {
    s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch (err) {
    s = null;
  }
  if (!s || !s.user || !s.user.name) return;

  const role = s.user.role;
  const account = await fetchUser(s.user.name);
  if (!account || account.role !== role) return; // the account no longer exists

  const avatar = await loadAvatar(userKey(account.name));
  state.currentUser = { name: account.name, role, avatar };
  state.selectedClass = s.selectedClass || CLASSES[0];
  if (role !== 'teacher' && account.section) state.selectedClass = account.section;
  state.activeSubject = (role === 'teacher') ? getTeacherSubject(account.name) : (s.activeSubject || SUBJECTS[0]);
  state.activeTab = s.activeTab || 'HOME';
  state.view = 'dashboard';
  await startListeners();
}

// Escape user-typed text before putting it into innerHTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Application State
let state = {
  view: 'signup', // 'signup', 'login', or 'dashboard'
  activeTab: 'HOME',
  activeSubject: 'Physics',
  selectedClass: 'ACAD 12 - G',
  currentUser: null,
  errorMsg: '',
  successMsg: '',

  // Students appear here when they sign up (one list per section)
  classesData: {
    'ACAD 12 - G': [],
    'ACAD 12 - H': [],
    'ACAD 12 - I': []
  },

  // Highest possible scores / number of activity columns, per section and subject
  hpsConfig: {},

  notifications: [],

  announcements: [],

  presentations: [],

  editingAll: false,
  showUploadModal: false,
  showAnnouncementModal: false
};


function findTeacherAccount(name) {
  const account = userCache[userKey(name)];
  return account && account.role === 'teacher' ? account : undefined;
}

// Each teacher is fixed to the ONE subject they chose when they signed up
function getTeacherSubject(name) {
  const account = findTeacherAccount(name);
  return account && SUBJECTS.includes(account.subject) ? account.subject : SUBJECTS[0];
}

// (accounts now live online, one document per person; see fetchUser)

// Make sure every registered student appears in their section's roster




function render() {
  renderPending = false;
  const app = document.getElementById('app');
  if (state.view === 'signup') {
    app.innerHTML = renderSignupForm();
  } else if (state.view === 'login') {
    app.innerHTML = renderLoginForm();
  } else {
    app.innerHTML = renderDashboard();
  }
  hydrateAttachmentImages();
}

// --- SIGN UP FORM VIEW (Role & Section Selection present only here) ---
function renderSignupForm() {
  return `
    <div class="login-container">
      <div class="wrapper">
        <form onsubmit="handleSignup(event)">
          <h1>Sign Up</h1>
          <div class="subtitle">Guiguinto National Vocational High School</div>

          ${state.errorMsg ? `
            <div style="background: rgba(225, 29, 72, 0.2); border: 1px solid rgba(225, 29, 72, 0.5); color: #fecdd3; font-size: 11px; padding: 8px 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-weight: 500;">
              <i class='bx bx-error-circle mr-1'></i> ${state.errorMsg}
            </div>
          ` : ''}

          ${state.successMsg ? `
            <div style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.5); color: #d1fae5; font-size: 11px; padding: 8px 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-weight: 500;">
              <i class='bx bx-check-circle mr-1'></i> ${state.successMsg}
            </div>
          ` : ''}

          <!-- Role Selector -->
          <div class="input-box">
            <select id="signupRole" onchange="toggleSignupRoleFields(this.value)">
              <option value="student">Student Account</option>
              <option value="teacher">Teacher Account</option>
            </select>
            <i class='bx bxs-user-badge'></i>
          </div>

          <!-- Name Input -->
          <div class="input-box">
            <input type="text" id="signupName" placeholder="Surname, First Name Middle Name" required>
            <i class='bx bxs-user'></i>
          </div>

          <!-- Student-specific: LRN, Sex & Section Selection -->
          <div id="studentFields">
            <div class="input-box">
              <input type="text" id="signupLrn" placeholder="LRN (exactly 12 digits)" required inputmode="numeric" minlength="12" maxlength="12" pattern="[0-9]{12}" title="The LRN must be exactly 12 digits" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
              <i class='bx bx-id-card'></i>
            </div>
            <div class="input-box">
              <select id="signupSex" required>
                <option value="" disabled selected>Select Sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <i class='bx bx-male-female'></i>
            </div>
            <div class="input-box">
              <select id="signupSection" required>
                <option value="" disabled selected>Select Your Section</option>
                ${CLASSES.map(cls => `<option value="${cls}">${cls}</option>`).join('')}
              </select>
              <i class='bx bxs-school'></i>
            </div>
          </div>

          <!-- Teacher-specific: Email & Password -->
          <div id="teacherFields" style="display: none;">
            <div class="input-box">
              <select id="signupSubject">
                <option value="" disabled selected>Select the Subject You Teach</option>
                ${SUBJECTS.map(sub => `<option value="${sub}">${sub}</option>`).join('')}
              </select>
              <i class='bx bx-book-open'></i>
            </div>
            <div class="input-box">
              <input type="email" id="signupEmail" placeholder="Teacher Email Address">
              <i class='bx bxs-envelope'></i>
            </div>
            <div class="input-box">
              <input type="password" id="signupPass" placeholder="Password (security code_yourpassword)">
              <i class='bx bx-hide' onclick="togglePassword('signupPass', this)" title="Show password" style="cursor: pointer; user-select: none;"></i>
            </div>
          </div>

          <button type="submit" class="btn">Register Account</button>

          <p class="link">
            Already have an account? <a href="#" onclick="switchView('login')">Log In</a>
          </p>
        </form>
      </div>
    </div>
  `;
}

function toggleSignupRoleFields(role) {
  const studentFields = document.getElementById('studentFields');
  const teacherFields = document.getElementById('teacherFields');
  const sectionSelect = document.getElementById('signupSection');
  const sexSelect = document.getElementById('signupSex');
  const lrnInput = document.getElementById('signupLrn');

  if (role === 'teacher') {
    studentFields.style.display = 'none';
    teacherFields.style.display = 'block';
    document.getElementById('signupEmail').setAttribute('required', 'true');
    document.getElementById('signupPass').setAttribute('required', 'true');
    document.getElementById('signupSubject').setAttribute('required', 'true');
    lrnInput.removeAttribute('required');
    lrnInput.value = '';
    if (sectionSelect) sectionSelect.removeAttribute('required');
    if (sexSelect) sexSelect.removeAttribute('required');
  } else {
    studentFields.style.display = 'block';
    teacherFields.style.display = 'none';
    lrnInput.setAttribute('required', 'true');
    if (sectionSelect) sectionSelect.setAttribute('required', 'true');
    if (sexSelect) sexSelect.setAttribute('required', 'true');
    document.getElementById('signupEmail').removeAttribute('required');
    document.getElementById('signupPass').removeAttribute('required');
    document.getElementById('signupSubject').removeAttribute('required');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const btn = e.submitter;
  if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
  const fail = msg => { state.errorMsg = msg; render(); };

  try {
    const role = document.getElementById('signupRole').value;
    const name = document.getElementById('signupName').value.trim();
    const key = userKey(name);

    if (await fetchUser(name)) {
      return fail('An account with that name is already registered. Please log in.');
    }

    if (role === 'teacher') {
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPass').value;
      const subject = document.getElementById('signupSubject').value;

      if (!SUBJECTS.includes(subject)) {
        return fail('Please choose the subject you teach.');
      }
      if (!password.startsWith(TEACHER_PASSWORD_PREFIX) || password.length === TEACHER_PASSWORD_PREFIX.length) {
        return fail('Invalid teacher password. It must start with the teacher security code and an underscore, followed by your own chosen password.');
      }

      await db.collection('users').doc(key).set({
        name, role: 'teacher', email, subject, passHash: await hashPassword(name, password)
      });
      state.successMsg = 'Teacher account registered successfully! Please log in.';
    } else {
      const lrn = document.getElementById('signupLrn').value.trim();
      const sex = document.getElementById('signupSex').value;
      const section = document.getElementById('signupSection').value;

      if (!/^[0-9]{12}$/.test(lrn)) return fail('The LRN must be exactly 12 digits (numbers only).');
      if (!sex) return fail('Please select sex.');
      if (!section) return fail('Please select your class section.');

      const lrnHash = await hashLrn(lrn);
      const taken = await db.collection('users').where('lrnHash', '==', lrnHash).limit(1).get();
      if (!taken.empty) return fail('That LRN is already registered. Please log in.');

      await db.collection('users').doc(key).set({ name, role: 'student', lrnHash, sex, section });
      await db.collection('students').doc(docKey(section, key)).set({
        id: Date.now(), name, nameKey: key, sex, section, scores: blankScores()
      });
      state.successMsg = 'Student account registered successfully! Please log in.';
    }

    state.errorMsg = '';
    setTimeout(() => { switchView('login'); }, 1200);
    render();
  } catch (err) {
    console.error(err);
    fail('Could not reach the online database. Please check the internet connection and try again.');
  }
}

// --- LOGIN FORM VIEW (Name + Student LRN, or Name + Teacher Password) ---
function renderLoginForm() {
  return `
    <div class="login-container">
      <div class="wrapper">
        <form onsubmit="handleLogin(event)">
          <h1>Login</h1>
          <div class="subtitle">Guiguinto National Vocational High School</div>

          ${state.errorMsg ? `
            <div style="background: rgba(225, 29, 72, 0.2); border: 1px solid rgba(225, 29, 72, 0.5); color: #fecdd3; font-size: 11px; padding: 8px 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-weight: 500;">
              <i class='bx bx-error-circle mr-1'></i> ${state.errorMsg}
            </div>
          ` : ''}

          <!-- Name Input -->
          <div class="input-box">
            <input type="text" id="loginName" placeholder="Enter Full Name (Surname First)" required>
            <i class='bx bxs-user'></i>
          </div>

          <!-- LRN or Teacher Code Input -->
          <div class="input-box">
            <input type="password" id="loginPass" placeholder="LRN or Password" required>
            <i class='bx bx-hide' onclick="togglePassword('loginPass', this)" title="Show password" style="cursor: pointer; user-select: none;"></i>
          </div>

          <button type="submit" class="btn">Log in</button>

          <p class="link">
            Don't have an account? <a href="#" onclick="switchView('signup')">Sign Up</a>
          </p>
        </form>
      </div>
    </div>
  `;
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = e.submitter;
  if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
  const fail = msg => { state.currentUser = null; state.errorMsg = msg; render(); };

  const name = document.getElementById('loginName').value.trim();
  const passwordOrLrn = document.getElementById('loginPass').value.trim();

  try {
    const account = await fetchUser(name);

    // A registered teacher name, or a password carrying the teacher security code, means a teacher login
    if ((account && account.role === 'teacher') || passwordOrLrn.startsWith(TEACHER_PASSWORD_PREFIX)) {
      if (!account || account.role !== 'teacher') {
        return fail('No teacher account found for that name. Teachers must sign up first.');
      }
      // The password must be exactly the one chosen at sign-up
      if (await hashPassword(account.name, passwordOrLrn) !== account.passHash) {
        return fail('Access Denied: incorrect teacher password.');
      }
      state.currentUser = { name: account.name, role: 'teacher', avatar: await loadAvatar(userKey(account.name)) };
      state.selectedClass = CLASSES[0];
      state.activeSubject = getTeacherSubject(account.name);
    } else {
      // Student login checks Name and LRN
      if (!account || account.role !== 'student' || account.lrnHash !== await hashLrn(passwordOrLrn)) {
        return fail('Invalid Student Name or LRN. Please sign up first if you haven’t registered.');
      }
      state.currentUser = { name: account.name, role: 'student', avatar: await loadAvatar(userKey(account.name)) };
      state.selectedClass = account.section; // Automatically loads their registered section
    }

    state.view = 'dashboard';
    state.activeTab = 'HOME';
    state.errorMsg = '';
    state.successMsg = '';
    saveSession();
    await startListeners();
    render();
  } catch (err) {
    console.error(err);
    fail('Could not reach the online database. Please check the internet connection and try again.');
  }
}

// Eye icon in a password box: show / hide what was typed
function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  icon.className = reveal ? 'bx bx-show' : 'bx bx-hide';
  icon.title = reveal ? 'Hide password' : 'Show password';
}

function switchView(targetView) {
  state.view = targetView;
  state.errorMsg = '';
  state.successMsg = '';
  render();
}

function handleLogout() {
  flushPendingSave();
  state.currentUser = null;
  saveSession();
  resetLocalData();
  state.view = 'login';
  state.errorMsg = '';
  state.successMsg = '';
  state.editingAll = false;
  state.showUploadModal = false;
  state.showAnnouncementModal = false;
  render();
}

// Profile picture upload handlers
function triggerAvatarUpload() {
  const fileInput = document.getElementById('avatarFileInput');
  if (fileInput) fileInput.click();
}

// Profile pictures are shrunk to a small square-ish JPEG before they are saved online
function resizeImageToDataUrl(file, maxSize = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable image')); };
    img.src = url;
  });
}

async function handleAvatarChange(event) {
  const file = event.target.files[0];
  if (!file || !state.currentUser) return;
  try {
    const newAvatarUrl = await resizeImageToDataUrl(file);
    await db.collection('avatars').doc(userKey(state.currentUser.name)).set({ data: newAvatarUrl });
    state.currentUser.avatar = newAvatarUrl;
  } catch (err) {
    console.error(err);
    alert('Sorry, your new picture could not be saved. Please try a different image and check the internet connection.');
  }
  render();
}

// --- PRESENTATION & UPLOAD HANDLERS ---
function toggleUploadModal(show) {
  state.showUploadModal = show;
  render();
}

async function handlePresentationUpload(event) {
  event.preventDefault();
  const titleInput = document.getElementById('presentationTitle').value.trim();
  const fileInput = document.getElementById('presentationFile');

  if (!titleInput || fileInput.files.length === 0) return;

  const file = fileInput.files[0];

  const deck = {
    id: Date.now(),
    subject: state.activeSubject,
    title: /\.(pptx|ppt|pdf)$/i.test(titleInput) ? titleInput : titleInput + '.pptx',
    author: state.currentUser.name,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
  };

  const finish = fileBlob => {
    if (fileBlob) deck.fileBlob = fileBlob; // where the file is kept online
    state.presentations.unshift(deck);
    state.notifications.unshift({
      id: deck.id,
      text: `${state.currentUser.name} has uploaded a presentation`,
      date: deck.date
    });
    state.showUploadModal = false;
    saveAll();
    render();
  };

  if (file.size > MAX_FILE_BYTES) {
    alert('This file is over 3 MB, so only the listing will be saved, not the file itself.');
    finish(null);
    return;
  }

  const btn = event.submitter;
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
  try {
    finish(await saveBlob(await readFileAsDataURL(file)));
  } catch (err) {
    console.error(err);
    alert('The file could not be uploaded, so only the listing was saved.');
    finish(null);
  }
}

async function downloadPresentation(id) {
  const p = state.presentations.find(x => x.id === id);

  // Real file saved online
  if (p && p.fileBlob) {
    try {
      await triggerDownload(await loadBlob(p.fileBlob.id, p.fileBlob.parts), p.title);
    } catch (err) {
      console.error(err);
      alert('Sorry, the file could not be downloaded. Please check the internet connection and try again.');
    }
    return;
  }

  // No stored file (e.g. the sample deck): placeholder download
  const title = p ? p.title : 'presentation';
  const fileContent = `Guiguinto National Vocational High School - GINTO EduTrack\nPresentation Deck: ${title}\nDownloaded successfully.`;
  const blob = new Blob([fileContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = title.endsWith('.pptx') ? title : title + '.pptx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- DASHBOARD VIEW ---
function renderDashboard() {
  const isTeacher = state.currentUser.role === 'teacher';

  return `
    <div class="dashboard-root flex flex-col md:flex-row h-[100dvh] bg-slate-100 w-full overflow-hidden">
      
      <!-- SIDEBAR NAVIGATION -->
      <aside class="w-full md:w-64 max-h-[45vh] md:max-h-none overflow-y-auto bg-[#701c1c] text-white flex-shrink-0 flex flex-col justify-between sidebar-container shadow-xl no-print">
        <div>
          <div class="p-4 border-b border-[#5a1616] flex items-center gap-3 bg-[#3d0e0e]">
            <img src="${SCHOOL_LOGO}" alt="Guiguinto National Vocational High School logo" class="w-11 h-11 rounded-full object-contain bg-white flex-shrink-0" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
            <div style="display: none;" class="w-11 h-11 rounded-full bg-amber-500 text-slate-950 items-center justify-center font-black text-xs flex-shrink-0">GN</div>
            <div class="leading-tight">
              <h1 class="text-xs font-black text-amber-400">Guiguinto National Vocational High School</h1>
            </div>
          </div>

          <!-- User Profile & Avatar Upload Section -->
          <div class="p-4 text-center border-b border-[#5a1616] bg-[#701c1c]/50">
            <div class="relative inline-block group cursor-pointer mx-auto mb-2" onclick="triggerAvatarUpload()" title="Click to change profile picture">
              <img src="${state.currentUser.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow group-hover:opacity-80 transition">
              <div class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition text-[10px] text-amber-300 font-bold">
                Edit
              </div>
            </div>
            <input type="file" id="avatarFileInput" accept="image/*" class="hidden" onchange="handleAvatarChange(event)">

            <div class="text-xs font-bold text-amber-300 break-words">${escapeHtml(state.currentUser.name)}</div>
            <div class="text-[10px] text-slate-400 uppercase mt-0.5">Role: <span class="text-white font-bold">${state.currentUser.role}</span></div>
            <div class="text-[10px] text-amber-400 font-bold uppercase mt-1">Section: ${state.selectedClass}</div>
            ${isTeacher ? `<div class="text-[10px] text-rose-300 font-bold uppercase mt-0.5">Subject: ${state.activeSubject}</div>` : ''}
          </div>

          <nav class="p-3 space-y-1">
            <button onclick="setActiveTab('HOME')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${state.activeTab === 'HOME' ? 'bg-amber-500 text-slate-950 shadow' : 'hover:bg-[#5a1616] text-slate-300'}">
              <i class="fa-solid fa-house w-4"></i> HOME
            </button>
            <button onclick="setActiveTab('RECORD')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${state.activeTab === 'RECORD' ? 'bg-amber-500 text-slate-950 shadow' : 'hover:bg-[#5a1616] text-slate-300'}">
              <i class="fa-solid fa-table-list w-4"></i> RECORD
            </button>
            <button onclick="setActiveTab('PRESENTATIONS')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${state.activeTab === 'PRESENTATIONS' ? 'bg-amber-500 text-slate-950 shadow' : 'hover:bg-[#5a1616] text-slate-300'}">
              <i class="fa-solid fa-file-powerpoint w-4"></i> PRESENTATIONS
            </button>
            <button onclick="setActiveTab('ANNOUNCEMENTS')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${state.activeTab === 'ANNOUNCEMENTS' ? 'bg-amber-500 text-slate-950 shadow' : 'hover:bg-[#5a1616] text-slate-300'}">
              <i class="fa-solid fa-bullhorn w-4"></i> ANNOUNCEMENTS
            </button>
            <button onclick="setActiveTab('PRINT')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${state.activeTab === 'PRINT' ? 'bg-amber-500 text-slate-950 shadow' : 'hover:bg-[#5a1616] text-slate-300'}">
              <i class="fa-solid fa-print w-4"></i> PRINT REPORT
            </button>
            ${state.currentUser.role === 'teacher' ? `
            <button onclick="setActiveTab('PRINTABLE')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${state.activeTab === 'PRINTABLE' ? 'bg-amber-500 text-slate-950 shadow' : 'hover:bg-[#5a1616] text-slate-300'}">
              <i class="fa-solid fa-file-lines w-4"></i> PRINTABLE RECORD
            </button>` : ''}
          </nav>
        </div>

        <div class="p-3 border-t border-[#5a1616] space-y-2">
          <button onclick="deleteMyAccount()" class="w-full bg-transparent border border-rose-400/50 hover:bg-rose-900 text-rose-300 text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-user-xmark"></i> Delete My Account
          </button>
          <button onclick="handleLogout()" class="w-full bg-rose-900/50 hover:bg-rose-900 text-rose-200 text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      </aside>

      <!-- MAIN CONTENT WORKSPACE -->
      <div class="flex-grow flex flex-col min-w-0 min-h-0 w-full overflow-hidden">
        <header class="no-print bg-[#701c1c] text-white p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm md:text-base font-black uppercase text-amber-400 tracking-wider">
            ${state.activeTab}${['RECORD', 'PRINT', 'PRINTABLE'].includes(state.activeTab) ? ' &bull; ' + state.activeSubject : ''}
          </h2>

          ${(state.activeTab === 'RECORD' || (state.activeTab === 'PRINT' && !isTeacher)) ? `
          <div class="flex flex-wrap items-center gap-2 text-xs">
            ${isTeacher ? `
              <select onchange="selectClass(this.value)" class="bg-[#5a1616] text-white border border-[#8a2a2a] text-xs font-bold rounded px-2.5 py-1">
                ${CLASSES.map(cls => `<option value="${cls}" ${state.selectedClass === cls ? 'selected' : ''}>${cls}</option>`).join('')}
              </select>
            ` : `
              <span class="bg-[#5a1616] text-amber-300 border border-[#8a2a2a] px-2.5 py-1 rounded font-bold text-[11px]">Section: ${state.selectedClass}</span>
            `}

            ${isTeacher ? `
              <span class="bg-[#5a1616] text-amber-300 border border-[#8a2a2a] px-2.5 py-1 rounded font-bold text-[11px]">Subject: ${state.activeSubject}</span>
            ` : `
              <select onchange="selectSubject(this.value)" class="bg-[#5a1616] text-white border border-[#8a2a2a] text-xs font-bold rounded px-2.5 py-1">
                ${SUBJECTS.map(sub => `<option value="${sub}" ${state.activeSubject === sub ? 'selected' : ''}>${sub}</option>`).join('')}
              </select>
            `}
          </div>
          ` : ''}
        </header>

        <main class="main-content p-4 md:p-6 flex-grow min-h-0 overflow-auto bg-slate-100 text-slate-900 w-full">
          ${state.activeTab === 'HOME' ? renderHomeTab() : ''}
          ${state.activeTab === 'RECORD' ? renderRecordTab() : ''}
          ${state.activeTab === 'PRESENTATIONS' ? renderPresentationsTab() : ''}
          ${state.activeTab === 'ANNOUNCEMENTS' ? renderAnnouncementsTab() : ''}
          ${state.activeTab === 'PRINT' ? renderPrintTab() : ''}
          ${state.activeTab === 'PRINTABLE' && state.currentUser.role === 'teacher' ? renderPrintableRecordTab() : ''}
        </main>
      </div>
    </div>
  `;
}

// Notifications are general: everyone sees the same feed.
// Announcement notifications show only the announcement's title, never who posted it.
function getVisibleNotifications() {
  return state.notifications.map(n => {
    const text = String(n.text);
    if (/^An announcement has been (made|posted)/.test(text)) {
      const a = state.announcements.find(x => x.id === n.id);
      return { ...n, isAnnouncement: true, announcementId: a ? a.id : null, text: a ? 'New Announcement: ' + a.title : 'A new announcement has been posted' };
    }
    if (/^New Announcement: /.test(text)) {
      const a = state.announcements.find(x => x.id === n.id);
      return { ...n, isAnnouncement: true, announcementId: a ? a.id : null };
    }
    // older presentation notifications said "...uploaded a presentation on <subject>"; presentations are general now
    if (/ has uploaded a presentation on .+$/.test(text)) {
      return { ...n, text: text.replace(/ has uploaded a presentation on .+$/, ' has uploaded a presentation') };
    }
    return n;
  });
}

function renderHomeTab() {
  return `
    <div class="w-full max-w-4xl mx-auto space-y-4">
      <div class="bg-[#701c1c] text-white p-3 font-bold text-sm rounded-t-xl uppercase tracking-wider flex items-center gap-2">
        <i class="fa-solid fa-bell text-amber-400"></i> Notifications Feed
      </div>
      <div class="space-y-3 w-full">
        ${getVisibleNotifications().map(n => n.isAnnouncement ? `
          <div onclick="openAnnouncement(${n.announcementId === null ? 'null' : n.announcementId})" class="cursor-pointer bg-white hover:bg-rose-50 hover:border-[#701c1c] transition border border-slate-300 p-4 rounded-xl text-xs font-bold text-slate-800 shadow-sm w-full" title="Click to see the full announcement">
            <p class="text-sm break-words"><i class="fa-solid fa-bullhorn text-amber-500 mr-1.5"></i>${escapeHtml(n.text)}</p>
            <div class="flex items-center justify-between mt-1">
              <span class="text-[10px] text-slate-400 font-normal">[${n.date}]</span>
              <span class="text-[10px] text-[#701c1c] font-bold">View details <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>
        ` : `
          <div class="bg-white border border-slate-300 p-4 rounded-xl text-xs font-bold text-slate-800 shadow-sm w-full">
            <p class="text-sm break-words">${escapeHtml(n.text)}</p>
            <span class="text-[10px] text-slate-400 font-normal mt-1 block">[${n.date}]</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRecordTab(printMode = false) {
  const isTeacher = state.currentUser.role === 'teacher';
  const showActions = isTeacher && !printMode; // Edit/Delete, HPS inputs, add/remove column buttons
  const section = state.selectedClass;
  const subject = state.activeSubject;
  const cfg = getHpsConfig(section, subject);
  let roster = state.classesData[section] || [];

  if (!isTeacher) {
    roster = roster.filter(student => student.name.toLowerCase() === state.currentUser.name.toLowerCase());
  }

  const { males, females } = getGroupedAndSortedRoster(roster);

  // Teacher: "Actions" switches the whole table into edit mode (everyone at once)
  const editingAll = showActions && !!state.editingAll;
  const showComputed = isTeacher; // students only see their raw scores (and the totals), not PS / WS / grades

  const groups = [
    { key: 'ww', label: 'WRITTEN WORKS', head: 'bg-amber-50',  sub: 'bg-amber-100',  cell: 'bg-amber-50',  canEdit: true,  name: i => String(i + 1) },
    { key: 'pt', label: 'PERFORMANCE TASKS', head: 'bg-rose-50', sub: 'bg-rose-100',  cell: 'bg-rose-50',   canEdit: true,  name: i => String(i + 1) },
    // Examinations (ST/TE): Summative Test 1, Summative Test 2 and the Term Examination (fixed columns)
    { key: 'qa', label: 'EXAMINATIONS (ST/TE)', head: 'bg-purple-50', sub: 'bg-purple-100', cell: 'bg-purple-50', canEdit: false, name: i => ['ST1', 'ST2', 'TE'][i] || ('EX' + (i + 1)) }
  ];

  const colCount = groups.reduce((acc, g) => acc + cfg[g.key].length + (showComputed ? 3 : 1), 1) + (showComputed ? 3 : 0) + (editingAll ? 1 : 0);

  const renderStudentRow = (student) => {
    const isEditing = editingAll;
    const scores = getStudentScores(student, section, subject);
    const r = computeGrades(scores, cfg);

    return `
      <tr>
        <td class="border border-slate-300 p-2 text-left font-sans font-bold text-slate-900">${escapeHtml(student.name)}</td>

        ${groups.map(g => scores[g.key].map((val, i) => `
          <td class="border border-slate-300 p-0.5">
            ${isEditing
              ? `<input type="number" id="edit-${student.id}-${g.key}-${i}" value="${val}" min="0" max="${cfg[g.key][i]}" step="any" oninput="onScoreInput(this, ${student.id}, '${g.key}', ${i})" class="w-12 text-center border rounded p-0.5 text-[10px]">`
              : fmtNum(val)}
          </td>`).join('') + `<td id="tot-${student.id}-${g.key}" class="border border-slate-300 p-1 font-bold ${g.cell}">${fmtNum(r.totals[g.key])}</td>` + (showComputed ? `<td id="ps-${student.id}-${g.key}" class="border border-slate-300 p-1 ${g.cell}">${r.ps[g.key].toFixed(2)}</td><td id="ws-${student.id}-${g.key}" class="border border-slate-300 p-1 font-bold ${g.cell}">${r.ws[g.key].toFixed(2)}</td>` : '')).join('')}

        ${showComputed ? `
        <td id="init-${student.id}" class="border border-slate-300 p-1 font-bold">${r.initial.toFixed(2)}</td>
        <td id="term-${student.id}" class="border border-slate-300 p-1 font-black text-rose-900 bg-amber-200 text-xs">${r.term}</td>
        <td id="desc-${student.id}" class="border border-slate-300 p-1 font-sans font-bold text-[10px]">${r.descriptor}</td>` : ''}
        ${editingAll ? `
          <td class="border border-slate-300 p-1 text-center">
            <button onclick="deleteStudent(${student.id})" class="text-white bg-rose-600 hover:bg-rose-700 text-xs font-bold px-2 py-0.5 rounded" title="Delete ${escapeHtml(student.name)}'s account"><i class="fa-solid fa-trash"></i></button>
          </td>` : ''}
      </tr>
    `;
  };

  return `
    <div class="w-full space-y-4">
      <div class="bg-white p-4 rounded-xl border border-slate-300 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div class="min-w-0">
          <div class="text-xs font-bold text-slate-700">
            DepEd e-Class Record for <span class="text-[#701c1c] font-extrabold">${subject}</span> (${section})
            ${showActions ? '<span class="ml-2 text-emerald-600 font-semibold">&bull; Score Editing Enabled</span>' : ''}
          </div>
        </div>
        ${showActions ? `
        <div class="no-print flex flex-wrap items-center gap-2 ml-auto">
          ${editingAll ? `
            <span class="text-[11px] font-bold text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i>Changes save automatically</span>
            <button onclick="finishEditing()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"><i class="fa-solid fa-check"></i> Done</button>
          ` : `
            <button onclick="startEditAll()" class="bg-[#701c1c] hover:bg-[#521313] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5" title="Edit everyone's scores"><i class="fa-solid fa-pen-to-square"></i> Actions</button>
          `}
        </div>` : ''}
        ${printMode ? `
        <button onclick="window.print()" class="no-print bg-[#701c1c] hover:bg-[#521313] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1">
          <i class="fa-solid fa-print"></i> Print Report
        </button>` : ''}
      </div>

      <div class="bg-white border border-slate-300 rounded-xl p-4 w-full overflow-x-auto shadow-sm">
        ${!isTeacher && roster.length === 0 ? `
          <div class="p-6 text-center text-xs text-rose-600 font-bold">
            No grade record found under the name "${escapeHtml(state.currentUser.name)}" in section ${section}.
          </div>
        ` : `
          <table class="w-full text-center border-collapse border border-slate-300 text-[11px] whitespace-nowrap">
            <thead>
              <tr class="bg-slate-100 font-bold text-slate-800">
                <th rowspan="2" class="border border-slate-300 p-2 text-left min-w-[140px]">LEARNER NAME</th>
                ${groups.map(g => `
                  <th colspan="${cfg[g.key].length + (showComputed ? 3 : 1)}" class="border border-slate-300 p-1 ${g.head}">
                    <div class="flex items-center justify-center gap-1">
                      <span>${g.label} (${GROUP_WEIGHTS[g.key]}%)</span>
                      ${showActions && g.canEdit ? `
                        <span class="no-print flex gap-0.5 ml-1">
                          <button onclick="addActivity('${g.key}')" class="w-4 h-4 leading-none rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold" title="Add another ${GROUP_NAMES[g.key]} column">+</button>
                          <button onclick="removeActivity('${g.key}')" class="w-4 h-4 leading-none rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold" title="Remove the last ${GROUP_NAMES[g.key]} column">&minus;</button>
                        </span>` : ''}
                    </div>
                  </th>`).join('')}
                ${showComputed ? `
                <th rowspan="2" class="border border-slate-300 p-1 w-14">Initial Grade</th>
                <th rowspan="2" class="border border-slate-300 p-1 bg-amber-200 w-14 font-black">Term Grade</th>
                <th rowspan="2" class="border border-slate-300 p-2 min-w-[90px]">Descriptor</th>` : ''}
                ${editingAll ? `<th rowspan="2" class="border border-slate-300 p-1 w-14">Actions</th>` : ''}
              </tr>
              <tr class="bg-slate-50 font-semibold text-[10px] text-slate-600">
                ${groups.map(g => cfg[g.key].map((_, i) => `<th class="border border-slate-300 p-1">${g.name(i, cfg[g.key].length)}</th>`).join('') + `<th class="border border-slate-300 p-1 ${g.sub} font-bold">Total</th>` + (showComputed ? `<th class="border border-slate-300 p-1 ${g.sub} font-bold">PS</th><th class="border border-slate-300 p-1 ${g.sub} font-bold">WS</th>` : '')).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 font-mono">
              <!-- Highest Possible Score row -->
              <tr class="bg-slate-200 font-bold text-slate-800">
                <td class="border border-slate-300 p-2 text-left font-sans uppercase text-[10px]">Highest Possible Score</td>
                ${groups.map(g => cfg[g.key].map((hps, i) => `
                  <td class="border border-slate-300 p-0.5">
                    ${showActions
                      ? `<input type="number" min="1" max="1000" step="any" value="${hps}" onchange="setHps('${g.key}', ${i}, this.value)" class="w-12 text-center border border-slate-400 rounded p-0.5 text-[10px] bg-white" title="Highest possible score">`
                      : hps}
                  </td>`).join('') + `<td class="border border-slate-300 p-1 ${g.cell}">${fmtNum(hpsSum(cfg[g.key]))}</td>` + (showComputed ? `<td class="border border-slate-300 p-1 ${g.cell}">100</td><td class="border border-slate-300 p-1 ${g.cell}">${GROUP_WEIGHTS[g.key]}</td>` : '')).join('')}
                ${showComputed ? `
                <td class="border border-slate-300 p-1">100</td>
                <td class="border border-slate-300 p-1">100</td>
                <td class="border border-slate-300 p-1 font-sans text-[10px]">&mdash;</td>` : ''}
                ${editingAll ? `<td class="border border-slate-300 p-1"></td>` : ''}
              </tr>

              ${isTeacher ? `
                <!-- MALE SECTION -->
                <tr class="bg-sky-100/70 font-black text-slate-700 text-left">
                  <td colspan="${colCount}" class="border border-slate-300 px-2 py-1 uppercase tracking-wider text-[10px]">MALE</td>
                </tr>
                ${males.length ? males.map(renderStudentRow).join('') : `<tr><td colspan="${colCount}" class="border border-slate-300 p-2 text-slate-400 italic">No male students</td></tr>`}

                <!-- BLANK SPACER ROW -->
                <tr class="bg-slate-100/50 h-4">
                  <td colspan="${colCount}" class="border border-slate-300"></td>
                </tr>

                <!-- FEMALE SECTION -->
                <tr class="bg-rose-100/70 font-black text-slate-700 text-left">
                  <td colspan="${colCount}" class="border border-slate-300 px-2 py-1 uppercase tracking-wider text-[10px]">FEMALE</td>
                </tr>
                ${females.length ? females.map(renderStudentRow).join('') : `<tr><td colspan="${colCount}" class="border border-slate-300 p-2 text-slate-400 italic">No female students</td></tr>`}
              ` : `
                <!-- STUDENT INDIVIDUAL VIEW -->
                ${roster.map(renderStudentRow).join('')}
              `}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

function renderPrintTab() {
  const isTeacher = state.currentUser.role === 'teacher';
  const fullRecord = `
    <div class="w-full space-y-4">
      <div class="text-center">
        <p class="text-[11px] font-semibold text-slate-600">Republic of the Philippines &bull; Department of Education</p>
        <h2 class="text-lg font-extrabold text-[#701c1c] uppercase">Guiguinto National Vocational High School</h2>
        <p class="text-xs font-bold text-slate-700">Learner Progress Report &mdash; ${escapeHtml(state.selectedClass)} &bull; ${escapeHtml(state.activeSubject)}</p>
      </div>
      ${renderRecordTab(true)}
      <p class="no-print text-[11px] text-slate-500 text-center">Use the section and subject menus at the top to choose which report to print, then click <strong>Print Report</strong>.</p>
    </div>
  `;

  if (isTeacher) return fullRecord;

  // Students: see the whole record on screen, but only the summary record is printed
  return `
    <div class="no-print">${fullRecord}</div>
    <div class="print-only">${renderPrintableRecordTab()}</div>
  `;
}

// Summary record view: totals, term grade and descriptor only
function renderPrintableRecordTab() {
  const isTeacher = state.currentUser.role === 'teacher';
  let roster = state.classesData[state.selectedClass] || [];
  if (!isTeacher) {
    roster = roster.filter(st => st.name.toLowerCase() === state.currentUser.name.toLowerCase());
  }
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  const cfg = getHpsConfig(state.selectedClass, state.activeSubject);
  const { males, females } = getGroupedAndSortedRoster(roster);

  const renderPrintRows = (list) => list.map((student, idx) => {
    const r = computeGrades(getStudentScores(student, state.selectedClass, state.activeSubject), cfg);
    const tWW = fmtNum(r.totals.ww);
    const tPT = fmtNum(r.totals.pt);
    const tQA = fmtNum(r.totals.qa);
    return `
      <tr>
        <td class="border border-slate-400 p-2">${idx + 1}</td>
        <td class="border border-slate-400 p-2 text-left font-bold text-slate-900">${escapeHtml(student.name)}</td>
        <td class="border border-slate-400 p-2">${tWW}</td>
        <td class="border border-slate-400 p-2">${tPT}</td>
        <td class="border border-slate-400 p-2">${tQA}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="w-full space-y-4">
      <div class="no-print bg-white p-4 rounded-xl border border-slate-300 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div class="text-xs font-bold text-slate-700">
          Printable summary for <span class="text-[#701c1c] font-extrabold">${state.activeSubject}</span> (${state.selectedClass})
        </div>
        <button onclick="window.print()" class="bg-[#701c1c] hover:bg-[#521313] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1">
          <i class="fa-solid fa-print"></i> Print Record
        </button>
      </div>

      <div class="bg-white border border-slate-300 rounded-xl p-6 w-full shadow-sm">
        <div class="text-center mb-4">
          <p class="text-[11px] font-semibold text-slate-600">Republic of the Philippines &bull; Department of Education</p>
          <h2 class="text-lg font-extrabold text-[#701c1c] uppercase">Guiguinto National Vocational High School</h2>
          <p class="text-xs font-bold text-slate-700">Summary of Scores &mdash; ${escapeHtml(state.selectedClass)} &bull; ${escapeHtml(state.activeSubject)}</p>
        </div>

        ${roster.length === 0 ? `
          <div class="p-6 text-center text-xs text-slate-500 font-medium">${isTeacher ? 'No students in this section yet.' : 'No grade record found for you in section ' + escapeHtml(state.selectedClass) + '.'}</div>
        ` : `
          <table class="summary-table w-full text-center border-collapse border border-slate-400 text-xs">
            <thead>
              <tr class="bg-slate-100 font-bold text-slate-800">
                <th class="border border-slate-400 p-2 w-10">No.</th>
                <th class="border border-slate-400 p-2 text-left">LEARNER NAME</th>
                <th class="border border-slate-400 p-2 bg-amber-50">TOTAL<br>WRITTEN WORKS<br><span class="font-normal text-[10px]">(out of ${fmtNum(hpsSum(cfg.ww))})</span></th>
                <th class="border border-slate-400 p-2 bg-rose-50">TOTAL<br>PERFORMANCE TASKS<br><span class="font-normal text-[10px]">(out of ${fmtNum(hpsSum(cfg.pt))})</span></th>
                <th class="border border-slate-400 p-2 bg-purple-50">TOTAL<br>EXAMINATIONS<br><span class="font-normal text-[10px]">(out of ${fmtNum(hpsSum(cfg.qa))})</span></th>
              </tr>
            </thead>
            <tbody>
              ${isTeacher ? `
                <!-- MALE GROUP -->
                <tr class="bg-sky-100 font-bold text-left">
                  <td colspan="5" class="border border-slate-400 px-2 py-1">MALE</td>
                </tr>
                ${males.length ? renderPrintRows(males) : `<tr><td colspan="5" class="border border-slate-400 p-2 text-slate-400 italic">No male students</td></tr>`}

                <!-- BLANK SPACER ROW -->
                <tr class="h-4">
                  <td colspan="5" class="border border-slate-400"></td>
                </tr>

                <!-- FEMALE GROUP -->
                <tr class="bg-rose-100 font-bold text-left">
                  <td colspan="5" class="border border-slate-400 px-2 py-1">FEMALE</td>
                </tr>
                ${females.length ? renderPrintRows(females) : `<tr><td colspan="5" class="border border-slate-400 p-2 text-slate-400 italic">No female students</td></tr>`}
              ` : `
                <!-- STUDENT INDIVIDUAL PRINT SUMMARY -->
                ${renderPrintRows(roster)}
              `}
            </tbody>
          </table>
        `}

        <div class="mt-6 flex justify-between text-[11px] text-slate-600">
          <span>${isTeacher ? 'Prepared by' : 'Learner'}: <strong class="text-slate-800">${escapeHtml(state.currentUser.name)}</strong></span>
          <span>Date printed: ${today}</span>
        </div>
      </div>
    </div>
  `;
}

function renderPresentationsTab() {
  const isTeacher = state.currentUser.role === 'teacher';
  // Presentations are general: every upload shows here, whatever subject it is for
  const decks = state.presentations;

  return `
    <div class="w-full max-w-4xl mx-auto space-y-4">
      <div class="bg-white p-4 rounded-xl border border-slate-300 flex items-center justify-between shadow-sm">
        <div class="font-bold text-xs uppercase text-slate-800">
          Learning Decks & Presentations
        </div>
        ${isTeacher ? `
          <button onclick="toggleUploadModal(true)" class="bg-[#701c1c] hover:bg-[#521313] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow">
            <i class="fa-solid fa-cloud-arrow-up"></i> Upload PowerPoint
          </button>
        ` : ''}
      </div>

      <div class="space-y-3">
        ${decks.length === 0 ? `
          <div class="bg-white border border-slate-300 p-6 rounded-xl text-center text-xs text-slate-500 font-medium">
            No PowerPoint presentations uploaded yet.
          </div>
        ` : decks.map(p => `
          <div class="bg-white border border-slate-300 p-4 rounded-xl flex items-center justify-between text-xs shadow-2xs">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                <i class="fa-solid fa-file-powerpoint"></i>
              </div>
              <div>
                <strong class="text-slate-900 text-sm block break-words">${escapeHtml(p.title)}</strong>
                <span class="text-slate-500 text-[11px]">Uploaded by ${escapeHtml(p.author)} &bull; ${p.date} (${p.size})</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="downloadPresentation(${p.id})" class="bg-[#5a1616] hover:bg-[#701c1c] text-white px-3 py-1.5 rounded transition font-bold flex items-center gap-1.5">
                <i class="fa-solid fa-download"></i> Download
              </button>
              ${isTeacher && p.author === state.currentUser.name ? `
                <button onclick="deletePresentation(${p.id})" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded transition font-bold flex items-center gap-1.5" title="Delete">
                  <i class="fa-solid fa-trash"></i> Delete
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Upload Modal -->
      ${state.showUploadModal ? `
        <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div class="flex items-center justify-between border-b pb-3">
              <h3 class="font-bold text-sm text-slate-900 uppercase">
                <i class="fa-solid fa-file-powerpoint text-orange-600 mr-1.5"></i> Upload PowerPoint
              </h3>
              <button onclick="toggleUploadModal(false)" class="text-slate-400 hover:text-slate-600 font-bold text-sm">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onsubmit="handlePresentationUpload(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Presentation Title / Topic:</label>
                <input type="text" id="presentationTitle" required placeholder="e.g., Chapter 5.pptx" class="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none">
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Select File (.pptx, .ppt, .pdf):</label>
                <input type="file" id="presentationFile" accept=".pptx, .ppt, .pdf" required class="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-600">
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t">
                <button type="button" onclick="toggleUploadModal(false)" class="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-lg text-xs font-bold">Cancel</button>
                <button type="submit" class="bg-[#701c1c] hover:bg-[#521313] text-white px-4 py-2 rounded-lg text-xs font-bold shadow">Upload File</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAnnouncementsTab() {
  const isTeacher = state.currentUser.role === 'teacher';
  // To let students post too, change the line below to: const canPost = true;
  const canPost = isTeacher;

  // Announcements are general: everyone sees all of them, whatever the subject
  const items = state.announcements;

  return `
    <div class="w-full max-w-4xl mx-auto space-y-4">
      <div class="bg-white p-4 rounded-xl border border-slate-300 flex items-center justify-between shadow-sm">
        <div class="font-bold text-xs uppercase text-slate-800">
          General Announcements
        </div>
        ${canPost ? `
          <button onclick="toggleAnnouncementModal(true)" class="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow">
            <i class="fa-solid fa-plus"></i> Post Announcement
          </button>
        ` : ''}
      </div>

      <div class="space-y-3">
        ${items.length === 0 ? `
          <div class="bg-white border border-slate-300 p-6 rounded-xl text-center text-xs text-slate-500 font-medium">
            No announcements yet.
          </div>
        ` : items.map(a => `
          <div id="ann-${a.id}" class="border p-5 rounded-xl space-y-2 shadow-2xs ${state.highlightAnnouncementId === a.id ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400' : 'bg-white border-slate-300'}">
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-bold text-sm text-[#701c1c] break-words">${escapeHtml(a.title)}</h4>
              ${isTeacher && a.author === state.currentUser.name ? `
                <button onclick="deleteAnnouncement(${a.id})" class="text-rose-600 hover:text-rose-800 text-xs" title="Delete">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
            <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line break-words">${escapeHtml(a.content)}</p>
            ${renderAttachments(a)}
            <span class="text-[10px] text-slate-400 block">By ${escapeHtml(a.author)} (${escapeHtml(a.role)}) on ${escapeHtml(a.date)}</span>
          </div>
        `).join('')}
      </div>

      <!-- Post Announcement Modal -->
      ${state.showAnnouncementModal ? `
        <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200">
            <div class="flex items-center justify-between border-b pb-3">
              <h3 class="font-bold text-sm text-slate-900 uppercase">
                <i class="fa-solid fa-bullhorn text-amber-500 mr-1.5"></i> New Announcement
              </h3>
              <button onclick="toggleAnnouncementModal(false)" class="text-slate-400 hover:text-slate-600 font-bold text-sm">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onsubmit="handleAnnouncementPost(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Title:</label>
                <input type="text" id="announcementTitle" required maxlength="100" placeholder="e.g., Quiz on Friday"
                       class="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none">
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Message:</label>
                <textarea id="announcementContent" required rows="5" placeholder="Write your announcement..."
                          class="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none"></textarea>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1"><i class="fa-solid fa-paperclip mr-1"></i>Attach files (optional):</label>
                <input type="file" id="announcementFiles" multiple
                       class="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2 file:mr-3 file:rounded file:border-0 file:bg-[#701c1c] file:text-white file:text-xs file:font-bold file:px-3 file:py-1 file:cursor-pointer">
                <p class="text-[10px] text-slate-500 mt-1">Images, presentations, documents, etc. Up to ${MAX_ATTACH_FILES} files, 1 MB each (2 MB total). For bigger files, add a link below instead.</p>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1"><i class="fa-solid fa-link mr-1"></i>Links (optional, one per line):</label>
                <textarea id="announcementLinks" rows="2" placeholder="https://drive.google.com/..."
                          class="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none"></textarea>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t">
                <button type="button" onclick="toggleAnnouncementModal(false)" class="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-lg text-xs font-bold">Cancel</button>
                <button type="submit" class="bg-[#701c1c] hover:bg-[#521313] text-white px-4 py-2 rounded-lg text-xs font-bold shadow">Post</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function toggleAnnouncementModal(show) {
  state.showAnnouncementModal = show;
  render();
}

// --- Announcement attachments (kept online, in pieces) ---
const MAX_ATTACH_FILES = 5;
const MAX_ATTACH_FILE_BYTES = 1024 * 1024;       // 1 MB per file
const MAX_ATTACH_TOTAL_BYTES = 2 * 1024 * 1024;  // 2 MB per announcement
const MAX_ATTACH_LINKS = 5;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileIconFor(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['ppt', 'pptx', 'pps', 'ppsx'].includes(ext)) return 'fa-file-powerpoint text-orange-600';
  if (['doc', 'docx'].includes(ext)) return 'fa-file-word text-sky-700';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel text-emerald-600';
  if (ext === 'pdf') return 'fa-file-pdf text-red-600';
  if (['zip', 'rar', '7z'].includes(ext)) return 'fa-file-zipper text-amber-600';
  return 'fa-file text-slate-500';
}

// Turns what the teacher typed into a safe http(s) link, or returns null if it isn't a valid link
function normalizeLink(raw) {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
  } catch (err) {
    return null;
  }
}

const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function renderAttachments(a) {
  const list = Array.isArray(a.attachments) ? a.attachments : [];
  if (list.length === 0) return '';

  const indexed = list.map((x, i) => ({ x, i }));
  const files = indexed.filter(({ x }) => x.kind === 'file' && (x.blobId || (typeof x.data === 'string' && x.data.startsWith('data:'))));
  const isImage = ({ x }) => /^image\/(png|jpe?g|gif|webp)$/i.test(x.type || '');
  const images = files.filter(isImage);
  const others = files.filter(f => !isImage(f));
  const links = list.filter(x => x.kind === 'link' && /^https?:\/\//i.test(x.url || ''));

  return `
    <div class="pt-2 space-y-2">
      ${images.length ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${images.map(({ x, i }) => `
            <button type="button" onclick="downloadAttachment(${a.id}, ${i})" title="Click to download ${escapeHtml(x.name)}"
               class="block text-left border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <img src="${x.blobId ? BLANK_IMG : x.data}" ${x.blobId ? `data-blob="${escapeHtml(x.blobId)}" data-parts="${Number(x.parts) || 1}"` : ''} alt="${escapeHtml(x.name)}" class="w-full max-h-64 object-contain">
              <span class="block text-[10px] text-slate-500 px-2 py-1 truncate">${escapeHtml(x.name)} &bull; ${formatFileSize(x.size || 0)}</span>
            </button>
          `).join('')}
        </div>` : ''}
      ${others.length ? `
        <div class="flex flex-wrap gap-2">
          ${others.map(({ x, i }) => `
            <button type="button" onclick="downloadAttachment(${a.id}, ${i})"
               class="flex items-center gap-2 border border-slate-300 hover:border-[#701c1c] hover:bg-rose-50 rounded-lg px-3 py-2 text-xs text-slate-800 transition max-w-full">
              <i class="fa-solid ${fileIconFor(x.name)} text-base"></i>
              <span class="font-semibold truncate">${escapeHtml(x.name)}</span>
              <span class="text-[10px] text-slate-400 whitespace-nowrap">${formatFileSize(x.size || 0)}</span>
              <i class="fa-solid fa-download text-[#701c1c]"></i>
            </button>
          `).join('')}
        </div>` : ''}
      ${links.length ? `
        <div class="space-y-1">
          ${links.map(x => `
            <a href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer"
               class="flex items-center gap-2 text-xs text-[#701c1c] hover:underline break-all">
              <i class="fa-solid fa-link"></i> ${escapeHtml(x.url)}
            </a>
          `).join('')}
        </div>` : ''}
    </div>
  `;
}

// Picture attachments are fetched from the online storage after the page is drawn
function hydrateAttachmentImages() {
  document.querySelectorAll('img[data-blob]').forEach(img => {
    if (img.dataset.loading) return;
    img.dataset.loading = '1';
    getBlobData(img.dataset.blob, Number(img.dataset.parts) || 1)
      .then(data => { img.src = data; })
      .catch(() => { /* the picture stays blank; the download button still works */ });
  });
}

async function downloadAttachment(annId, idx) {
  const a = state.announcements.find(x => x.id === annId);
  const att = a && Array.isArray(a.attachments) ? a.attachments[idx] : null;
  if (!att) return;
  try {
    await triggerDownload(att.data || await getBlobData(att.blobId, att.parts || 1), att.name);
  } catch (err) {
    console.error(err);
    alert('Sorry, the file could not be downloaded. Please check the internet connection and try again.');
  }
}

// Click on an announcement notification (Home tab): jump to the Announcements tab and highlight it
function openAnnouncement(id) {
  state.activeTab = 'ANNOUNCEMENTS';
  state.highlightAnnouncementId = id;
  saveSession();
  render();
  if (id !== null) {
    setTimeout(() => {
      const el = document.getElementById('ann-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }
}

async function handleAnnouncementPost(e) {
  e.preventDefault();
  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  if (!title || !content) return;

  const btn = e.submitter;
  const fail = msg => {
    alert(msg);
    if (btn) { btn.disabled = false; btn.textContent = 'Post'; }
  };
  if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }

  // --- validate attachments ---
  const fileInput = document.getElementById('announcementFiles');
  const files = fileInput ? Array.from(fileInput.files) : [];
  if (files.length > MAX_ATTACH_FILES) return fail('You can attach up to ' + MAX_ATTACH_FILES + ' files per announcement.');
  const tooBig = files.find(f => f.size > MAX_ATTACH_FILE_BYTES);
  if (tooBig) return fail('"' + tooBig.name + '" is larger than 1 MB. Please use a smaller file, or add a link to it instead (e.g., Google Drive).');
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_ATTACH_TOTAL_BYTES) return fail('The attached files add up to more than 2 MB. Please attach fewer or smaller files, or use links.');

  const linkInput = document.getElementById('announcementLinks');
  const rawLinks = linkInput ? linkInput.value.split('\n').map(l => l.trim()).filter(Boolean) : [];
  if (rawLinks.length > MAX_ATTACH_LINKS) return fail('You can add up to ' + MAX_ATTACH_LINKS + ' links per announcement.');
  const links = [];
  for (const raw of rawLinks) {
    const url = normalizeLink(raw);
    if (!url) return fail('"' + raw + '" is not a valid link.');
    links.push(url);
  }

  // --- read the files ---
  const attachments = [];
  try {
    for (const f of files) {
      const blob = await saveBlob(await readFileAsDataURL(f)); // the file itself is kept online, in pieces
      attachments.push({
        kind: 'file',
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
        blobId: blob.id,
        parts: blob.parts
      });
    }
  } catch (err) {
    console.error(err);
    return fail('Sorry, one of the files could not be uploaded. Please check the internet connection and try again.');
  }
  links.forEach(url => attachments.push({ kind: 'link', url }));

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const id = Date.now();

  state.announcements.unshift({
    id,
    title,
    author: state.currentUser.name,
    role: state.currentUser.role === 'teacher' ? 'Teacher' : 'Student',
    date: today,
    content,
    attachments
  });

  // Shows up in everyone's HOME notifications feed (title only)
  state.notifications.unshift({
    id,
    text: `New Announcement: ${title}`,
    date: today
  });

  saveAll();

  state.showAnnouncementModal = false;
  render();
}

function deleteAnnouncement(id) {
  if (!state.currentUser || state.currentUser.role !== 'teacher') return;
  const target = state.announcements.find(a => a.id === id);
  if (!target || target.author !== state.currentUser.name) return; // teachers can only delete their own posts
  if (!confirm('Delete this announcement?')) return;
  state.announcements = state.announcements.filter(a => a.id !== id);
  state.notifications = state.notifications.filter(n => n.id !== id);
  saveAll();
  (target.attachments || []).forEach(x => { if (x.blobId) deleteBlob(x.blobId, x.parts); });
  render();
}

// Teacher-only: remove an uploaded presentation
function deletePresentation(id) {
  if (!state.currentUser || state.currentUser.role !== 'teacher') return;
  const target = state.presentations.find(p => p.id === id);
  if (!target || target.author !== state.currentUser.name) return; // teachers can only delete their own uploads
  if (!confirm('Delete this presentation?')) return;
  state.presentations = state.presentations.filter(p => p.id !== id);
  state.notifications = state.notifications.filter(n => n.id !== id);
  saveAll();
  if (target.fileBlob) deleteBlob(target.fileBlob.id, target.fileBlob.parts);
  render();
}

// Any signed-in user: permanently delete their own account
async function deleteMyAccount() {
  const user = state.currentUser;
  if (!user) return;
  if (!confirm('Permanently delete your account' +
      (user.role === 'student' ? ' and all your grade records' : '') +
      '?\n\n' + (user.role === 'teacher' ? 'You will need to sign up again to log in.\n\n' : '') + 'This cannot be undone.')) return;

  const key = userKey(user.name);
  try {
    // 1. Students: remove their grade record
    if (user.role === 'student') {
      await db.collection('students').doc(docKey(state.selectedClass, key)).delete();
    }
    // 2. Remove the login account and the saved profile picture
    await db.collection('users').doc(key).delete();
    await db.collection('avatars').doc(key).delete();
  } catch (err) {
    console.error(err);
    alert('Your account could not be deleted. Please check the internet connection and try again.');
    return;
  }
  delete userCache[key];

  handleLogout();
  state.successMsg = 'Your account has been deleted.';
  render();
}

// Helpers
function startEditAll() {
  if (!isTeacherUser()) return;
  state.editingAll = true;
  render();
}

// --- Auto-save: every score typed is stored right away and the grades update live ---
let saveTimer = null;

function flushPendingSave() {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  saveAll();
  applyDeferredSnapshots();
}

function scheduleSave() {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPendingSave, 250);
}

window.addEventListener('beforeunload', flushPendingSave);

function onScoreInput(inp, studentId, group, idx) {
  if (!isTeacherUser()) return;
  const section = state.selectedClass;
  const subject = state.activeSubject;
  const student = (state.classesData[section] || []).find(st => st.id === studentId);
  if (!student) return;

  // never above the highest possible score, never below 0
  const hps = parseFloat(inp.max);
  let v = parseFloat(inp.value);
  if (v > hps) { v = hps; inp.value = hps; }
  if (v < 0) { v = 0; inp.value = 0; }

  const cfg = getHpsConfig(section, subject);
  const scores = getStudentScores(student, section, subject);
  scores[group][idx] = v >= 0 ? Math.round(v * 100) / 100 : 0; // a blank box counts as 0
  student.scores = student.scores || {};
  student.scores[subject] = scores;

  // refresh this learner's totals and grades without redrawing the table (keeps the cursor in the box)
  const r = computeGrades(scores, cfg);
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  ['ww', 'pt', 'qa'].forEach(k => {
    setText(`tot-${studentId}-${k}`, fmtNum(r.totals[k]));
    setText(`ps-${studentId}-${k}`, r.ps[k].toFixed(2));
    setText(`ws-${studentId}-${k}`, r.ws[k].toFixed(2));
  });
  setText(`init-${studentId}`, r.initial.toFixed(2));
  setText(`term-${studentId}`, r.term);
  setText(`desc-${studentId}`, r.descriptor);

  scheduleSave();
}

function finishEditing() {
  flushPendingSave();
  state.editingAll = false;
  render();
}

// Reads every score box on screen into the saved data (clamped 0..highest possible score)
function applyEditedScores() {
  const section = state.selectedClass;
  const subject = state.activeSubject;
  const cfg = getHpsConfig(section, subject);
  (state.classesData[section] || []).forEach(student => {
    const scores = getStudentScores(student, section, subject);
    let touched = false;
    ['ww', 'pt', 'qa'].forEach(k => {
      cfg[k].forEach((hps, i) => {
        const inp = document.getElementById(`edit-${student.id}-${k}-${i}`);
        if (!inp) return;
        touched = true;
        let v = parseFloat(inp.value);
        if (!(v >= 0)) v = 0;                                      // blank / invalid = 0
        scores[k][i] = Math.round(Math.min(v, hps) * 100) / 100;   // never above the highest possible score
      });
    });
    if (touched) {
      student.scores = student.scores || {};
      student.scores[subject] = scores;
    }
  });
}

// Teacher-only: permanently remove a student's account and grade record
function deleteStudent(studentId) {
  if (!state.currentUser || state.currentUser.role !== 'teacher') return;
  const roster = state.classesData[state.selectedClass] || [];
  const student = roster.find(s => s.id === studentId);
  if (!student) return;

  if (!confirm('Delete the account and all grade records of "' + student.name + '"?\n\nThis cannot be undone.')) return;
  if (state.editingAll) applyEditedScores(); // keep what was typed for the other learners

  const key = userKey(student.name);

  // 1. Remove the login account and saved picture (so they can't log in any more)
  db.collection('users').doc(key).delete().catch(reportSaveError);
  db.collection('avatars').doc(key).delete().catch(reportSaveError);
  delete userCache[key];

  // 2. Remove from the class roster (all subjects' scores live on the student object);
  //    saveAll() then deletes the grade record online
  state.classesData[state.selectedClass] = roster.filter(s => s.id !== studentId);

  saveAll();
  render();
}

// Teacher: change the highest possible score of one activity column
function setHps(group, idx, value) {
  if (!isTeacherUser()) return;
  const section = state.selectedClass;
  const subject = state.activeSubject;
  const cfg = ensureHpsConfig(section, subject);

  let v = parseFloat(value);
  if (!(v > 0)) {
    alert('The highest possible score must be a number greater than 0.');
    render();
    return;
  }
  v = Math.min(Math.round(v * 100) / 100, 1000);

  const roster = state.classesData[section] || [];
  const over = roster.filter(st => getStudentScores(st, section, subject)[group][idx] > v);
  if (over.length > 0 && !confirm(over.length + ' student(s) already have a score higher than ' + v + ' in this column. Their scores will be lowered to ' + v + '.\n\nContinue?')) {
    render();
    return;
  }

  if (state.editingAll) applyEditedScores();
  cfg[group][idx] = v;
  roster.forEach(st => {
    const sc = getStudentScores(st, section, subject);
    if (sc[group][idx] > v) sc[group][idx] = v;
    st.scores = st.scores || {};
    st.scores[subject] = sc;
  });
  saveAll();
  render();
}

// Teacher: add another activity column (e.g. Written Work 6)
function addActivity(group) {
  if (!isTeacherUser()) return;
  if (group === 'qa') { alert('Examinations are fixed: Summative Test 1, Summative Test 2 and the Term Exam.'); return; }
  const section = state.selectedClass;
  const subject = state.activeSubject;
  const cfg = ensureHpsConfig(section, subject);

  if (cfg[group].length >= MAX_ACTIVITIES[group]) {
    alert('You can have at most ' + MAX_ACTIVITIES[group] + ' ' + GROUP_NAMES[group] + ' columns.');
    return;
  }
  if (state.editingAll) applyEditedScores();
  cfg[group].push(cfg[group][cfg[group].length - 1] || 10); // same highest possible score as the previous column; change it in the gray row
  syncScoresToConfig(section, subject);
  saveAll();
  render();
}

// Teacher: remove the last activity column
function removeActivity(group) {
  if (!isTeacherUser()) return;
  if (group === 'qa') { alert('Examinations are fixed: Summative Test 1, Summative Test 2 and the Term Exam.'); return; }
  const section = state.selectedClass;
  const subject = state.activeSubject;
  const cfg = ensureHpsConfig(section, subject);

  if (cfg[group].length <= 1) {
    alert('At least one ' + GROUP_NAMES[group] + ' column is required.');
    return;
  }
  if (!confirm('Remove the last ' + GROUP_NAMES[group] + ' column?\n\nThe scores in that column will be deleted for every student in ' + section + '.')) return;

  if (state.editingAll) applyEditedScores();
  cfg[group].pop();
  syncScoresToConfig(section, subject);
  saveAll();
  render();
}

function setActiveTab(tab) { state.activeTab = tab; state.editingAll = false; state.highlightAnnouncementId = null; saveSession(); render(); }
function selectClass(cls) {
  if (!state.currentUser || state.currentUser.role !== 'teacher') return; // students are fixed to the section they signed up with
  state.selectedClass = cls; state.editingAll = false; saveSession(); render();
}
function selectSubject(sub) {
  if (state.currentUser && state.currentUser.role === 'teacher') return; // teachers are fixed to their assigned subject
  state.activeSubject = sub;
  state.editingAll = false;
  saveSession();
  render();
}

(async function boot() {
  const app = document.getElementById('app');
  const message = (title, body) => {
    app.innerHTML = `<div class="login-container"><div class="wrapper"><h1 style="font-size:22px">${title}</h1><p class="link">${body}</p></div></div>`;
  };

  if (!initCloud()) {
    message('Setup needed', 'Open <code>script.js</code> and paste your Firebase settings into <code>FIREBASE_CONFIG</code>.');
    return;
  }
  message('GINTO EduTrack', 'Loading...');

  try {
    await authReady;
  } catch (err) {
    console.error(err);
    message('Cannot connect', 'Could not connect to the online database. Please check the internet connection and try again.');
    return;
  }

  try {
    await restoreSession();
  } catch (err) {
    console.error(err);
    state.currentUser = null;
    state.view = 'login';
  }
  render();
})();