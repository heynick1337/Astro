import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import {
  getDatabase, ref, set, get, push, update, remove,
  onChildAdded, onChildChanged, onChildRemoved, onValue, off,
  query, orderByChild
} from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";

// ═══════════════════════════════════════════════ FIREBASE CONFIG ══
const firebaseConfig = {
  apiKey:            "AIzaSyD_MMtOZ53JvbhhOGDxh40GG3Q1Hed0hks",
  authDomain:        "astro-f1122.firebaseapp.com",
  databaseURL:       "https://astro-f1122-default-rtdb.firebaseio.com",
  projectId:         "astro-f1122",
  storageBucket:     "astro-f1122.appspot.com",
  messagingSenderId: "500839311652",
  appId:             "1:500839311652:web:b08544d6f839704097ebb1"
};
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ═══════════════════════════════════════════════════ CONSTANTS ════
// Reserved admin usernames & secret codes
const ADMIN_NAMES      = ["nick", "nikhil"];       // reserved display names
const ADMIN_SECRETS    = ["nicksecret","nikhilsecret","admin123","astro_admin"]; // type any of these as "username" to log in as admin
const ADMIN_DISPLAY    = "nick";                   // the actual name shown in chat
const FLAG_THRESHOLD   = 7;
const TYPING_TIMEOUT   = 900;
const JOIN_MSG_EXPIRE  = 12000;

// ═══════════════════════════════════════════════════ GLOBALS ══════
let MY_NAME     = "";
let IS_ADMIN    = false;
let replyTarget = null;
let typingTimer = null;
let listeners   = [];
let onlineUsers = {};
let selectMode  = false;          // are we in select mode?
let selectedMsgs = new Set();     // keys of selected messages

// Tracks the most recently rendered chat-message row & its sender, so
// consecutive messages from the same person can be visually grouped
// (tight spacing + connected bubble corners). Reset to null whenever
// the run of consecutive messages should be considered broken (a join/
// leave notice, a broadcast, or a full clear-all).
let lastMsgRowEl   = null;
let lastMsgOwner   = null;

// Messages deleted "for me only" via selection — hidden locally for the
// current session only. They are NEVER removed from the server and are
// NOT persisted anywhere (no localStorage), so a page reload re-fetches
// them from the server and they show up again, exactly like they still
// do for everyone else.
let locallyDeletedKeys = new Set();
// Pin state: seeded from localStorage as a fast initial render; Firebase is
// the authoritative source and will correct stale entries in attachPinListener.
const pinnedMsgs = new Set(JSON.parse(localStorage.getItem('astro_pinned')||'[]'));
// Hide state: stored in Firebase so everyone sees the blur
const hiddenMsgs = new Set();

// In-memory store of message data keyed by Firebase key.
// Used so reply/copy buttons never embed raw message text or encoded
// percent-signs inside HTML onclick attributes (which breaks the JS parser).
const msgDataStore = {};

// ═══════════════════════════════════════════════════ HELPERS ══════
function timeNow() {
  return new Date().toLocaleString("en-US", { hour:"numeric", minute:"numeric", hour12:true });
}

function userColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360},55%,62%)`;
}

function sanitize(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatMsg(raw) {
  const safe = sanitize(raw);
  return safe
    .replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s<>"]+)/g,  '<a class="found-link" href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(@[a-zA-Z0-9_-]+)/g,        '<span class="found-mention">$1</span>');
}

function isEmojiOnly(str) {
  const trimmed = str.trim();
  return trimmed.length <= 4 && /^\p{Extended_Pictographic}+$/u.test(trimmed);
}

function scrollToBottom(force = false) {
  const wrap = document.getElementById("messages");
  if (!wrap) return;
  const nearBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 120;
  if (force || nearBottom) {
    requestAnimationFrame(() => { wrap.scrollTop = wrap.scrollHeight; });
  }
}

// ── Custom confirm modal ──────────────────────────────────────────
function showConfirm(message, onConfirm) {
  // Remove any existing confirm modal
  const existing = document.getElementById("customConfirmModal");
  if (existing) existing.remove();
  const overlay = document.getElementById("customConfirmOverlay");
  if (overlay) overlay.remove();

  const ov = document.createElement("div");
  ov.id = "customConfirmOverlay";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:500;backdrop-filter:blur(3px)";

  const modal = document.createElement("div");
  modal.id = "customConfirmModal";
  modal.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    width:96%;max-width:340px;
    background:var(--bg-2);border:1px solid var(--border);
    border-radius:14px;padding:24px;z-index:501;
    box-shadow:0 20px 60px rgba(0,0,0,0.5);
    animation:slideUp .25s ease;
  `;
  modal.innerHTML = `
    <div style="font-size:0.95rem;font-weight:700;color:var(--text);margin-bottom:10px">Confirm Action</div>
    <div style="font-size:0.82rem;color:var(--text-2);line-height:1.6;margin-bottom:18px">${sanitize(message)}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="confirmCancelBtn" style="padding:7px 16px;border-radius:7px;font-size:0.8rem;font-weight:600;background:var(--bg-3);border:1px solid var(--border);color:var(--text-2);cursor:pointer;transition:all .15s">Cancel</button>
      <button id="confirmOkBtn" style="padding:7px 16px;border-radius:7px;font-size:0.8rem;font-weight:600;background:#ef4444;color:#fff;cursor:pointer;border:none;transition:filter .15s">Confirm</button>
    </div>
  `;

  document.body.appendChild(ov);
  document.body.appendChild(modal);

  function closeConfirm() {
    ov.remove();
    modal.remove();
  }
  document.getElementById("confirmCancelBtn").onclick = closeConfirm;
  ov.onclick = closeConfirm;
  document.getElementById("confirmOkBtn").onclick = () => {
    closeConfirm();
    onConfirm();
  };
}

// ── Custom alert modal ────────────────────────────────────────────
function showAlert(message) {
  const existing = document.getElementById("customAlertModal");
  if (existing) existing.remove();
  const exOv = document.getElementById("customAlertOverlay");
  if (exOv) exOv.remove();

  const ov = document.createElement("div");
  ov.id = "customAlertOverlay";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:500;backdrop-filter:blur(3px)";

  const modal = document.createElement("div");
  modal.id = "customAlertModal";
  modal.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    width:96%;max-width:340px;
    background:var(--bg-2);border:1px solid var(--border);
    border-radius:14px;padding:24px;z-index:501;
    box-shadow:0 20px 60px rgba(0,0,0,0.5);
    animation:slideUp .25s ease;
  `;
  modal.innerHTML = `
    <div style="font-size:0.85rem;color:var(--text-2);line-height:1.6;margin-bottom:18px">${sanitize(message)}</div>
    <div style="display:flex;justify-content:flex-end">
      <button id="alertOkBtn" style="padding:7px 18px;border-radius:7px;font-size:0.8rem;font-weight:600;background:var(--accent);color:#fff;cursor:pointer;border:none">OK</button>
    </div>
  `;

  document.body.appendChild(ov);
  document.body.appendChild(modal);

  function closeAlert() { ov.remove(); modal.remove(); }
  document.getElementById("alertOkBtn").onclick = closeAlert;
  ov.onclick = closeAlert;
}

// ═══════════════════════════════════════════════ MAIN ENTRY ═══════
window.startApp = async function(username) {
  const raw = username.toLowerCase().trim();

  // ── Determine login mode ────────────────────────────────────────
  // Mode 1: secret code (e.g. nicksecret) → admin as ADMIN_DISPLAY (nick)
  // Mode 2: username@admin suffix  → admin with that username
  // Mode 3: hardcoded master key FA33C083 → admin as ADMIN_DISPLAY
  // Mode 4: normal username
  const MASTER_KEY = "FA33C083";
  if (raw === MASTER_KEY.toLowerCase() || ADMIN_SECRETS.includes(raw)) {
    IS_ADMIN = true;
    MY_NAME  = ADMIN_DISPLAY;
  } else if (raw.endsWith("@admin")) {
    const namepart = raw.replace(/@admin$/, "").trim();
    if (!namepart || namepart.length < 2) {
      showAlert("⛔ Invalid admin username. Use: yourname@admin");
      document.getElementById("loginScreen").style.display  = "flex";
      document.getElementById("appScreen").style.display    = "none";
      return;
    }
    IS_ADMIN = true;
    MY_NAME  = namepart;
  } else {
    // Block reserved admin names from regular users
    if (ADMIN_NAMES.includes(raw)) {
      showAlert("⛔ That username is reserved. Please choose a different one.");
      document.getElementById("loginScreen").style.display  = "flex";
      document.getElementById("appScreen").style.display    = "none";
      return;
    }
    MY_NAME  = raw;
    IS_ADMIN = false;
  }

  // ── 1. Check if banned ─────────────────────────────────────────
  const blockedSnap = await get(ref(db, `blocked/${MY_NAME}`));
  if (blockedSnap.exists()) {
    showAlert("⛔ You have been banned from this chat.");
    document.getElementById("loginScreen").style.display  = "flex";
    document.getElementById("appScreen").style.display    = "none";
    return;
  }

  // ── 2. Check username uniqueness (allow admin to re-login) ──────
  const onlineSnap = await get(ref(db, `online/${MY_NAME}`));
  if (onlineSnap.exists() && !IS_ADMIN) {
    showAlert(`The username "${MY_NAME}" is already in use. Please choose a different one.`);
    document.getElementById("loginScreen").style.display  = "flex";
    document.getElementById("appScreen").style.display    = "none";
    return;
  }

  // ── 3. Seed UI ─────────────────────────────────────────────────
  if (IS_ADMIN) document.body.classList.add('is-admin');
  else          document.body.classList.remove('is-admin');
  if (window.renderProfilePanel) await window.renderProfilePanel(MY_NAME, IS_ADMIN);
  const topAv   = document.getElementById("topAvatar");
  const topName = document.getElementById("topName");
  topAv.textContent         = MY_NAME.charAt(0).toUpperCase();
  topAv.style.background    = IS_ADMIN ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : userColor(MY_NAME);
  topAv.style.color         = IS_ADMIN ? "#1e1e1e" : "#fff";
  topName.textContent       = MY_NAME;

  // Show admin button in topbar
  if (IS_ADMIN) {
    const topR = document.querySelector(".topbar-r");
    if (!document.getElementById("adminTopBtn")) {
      const ab = document.createElement("button");
      ab.id        = "adminTopBtn";
      ab.className = "admin-panel-btn";
      ab.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Admin`;
      ab.onclick = openAdminModal;
      topR.prepend(ab);
    }
  }

  // ── 4. Register online presence ────────────────────────────────
  const onlineRef = ref(db, `online/${MY_NAME}`);
  // Admin never exposes device details — only regular users do.
  let devicePayload = {};
  if (!IS_ADMIN) {
    try {
      const di = window._myDeviceInfo || {};
      devicePayload = {
        deviceType:  di.deviceType  || null,
        os:          di.os          || null,
        browser:     di.browserFull || null,
        screen:      di.screenLogical || null,
        pixelRatio:  di.pixelRatio  || null,
        viewport:    di.viewportRes || null,
        cores:       di.cores       || null,
        memory:      di.memory      || null,
        battery:     di.battery     || null,
        network:     di.network     || null,
        connType:    di.connType    || null,
        connSpeed:   di.connSpeed   || null,
        lang:        di.lang        || null,
        tz:          di.tz          || null,
        localTime:   di.localTime   || null,
        touchStr:    di.touchStr    || null,
        colorDepth:  di.colorDepth  || null,
        ua:          di.ua          || navigator.userAgent.slice(0,200),
      };
    } catch(_) {}
  }
  await set(onlineRef, { joinedAt: Date.now(), isAdmin: IS_ADMIN, ...devicePayload });

  const cleanup = () => remove(onlineRef);
  window.addEventListener("beforeunload", cleanup);

  // ── 5. Broadcast join message ───────────────────────────────────
  const joinKey = `join_${Date.now()}_${MY_NAME}`;
  await set(ref(db, `messages/${joinKey}`), {
    type:   "join",
    user:   MY_NAME,
    time:   timeNow(),
    ts:     Date.now()
  });
  setTimeout(() => remove(ref(db, `messages/${joinKey}`)), JOIN_MSG_EXPIRE);

  // ── 6. Attach Firebase listeners ───────────────────────────────
  attachListeners();
  attachFlagListener();
  attachPinListener();
  attachHideListener();

  // ── 7. Connected/disconnected indicator ────────────────────────
  const connRef = ref(db, ".info/connected");
  const connUnsub = onValue(connRef, snap => {
    const dot = document.getElementById("statusDot");
    const txt = document.getElementById("statusTxt");
    if (snap.val()) {
      dot.classList.add("on");
      txt.textContent = "Connected";
    } else {
      dot.classList.remove("on");
      txt.textContent = "Reconnecting…";
    }
  });
  listeners.push({ ref: connRef, unsub: connUnsub });

  // ── 8. Expose leave / flag helpers ─────────────────────────────
  window._leaveChat = async () => {
    await remove(onlineRef);
    detachListeners();
    window.removeEventListener("beforeunload", cleanup);
    const lk = `leave_${Date.now()}_${MY_NAME}`;
    await set(ref(db, `messages/${lk}`), {
      type: "leave", user: MY_NAME, time: timeNow(), ts: Date.now()
    });
    setTimeout(() => remove(ref(db, `messages/${lk}`)), JOIN_MSG_EXPIRE);
    MY_NAME = ""; IS_ADMIN = false; replyTarget = null;
    // Remove admin button if present
    const ab = document.getElementById("adminTopBtn");
    if (ab) ab.remove();
  };

  window._flagUser = (targetName) => flagUser(targetName);
};

// ═══════════════════════════════════════════════════ SOUND ════════
// Tones via Web Audio API. Browsers block AudioContext until a user gesture.
// Fix: create ctx on first gesture, queue any tone that arrives before that,
// then flush the queue on the next gesture.
let _audioCtx   = null;
let _audioReady = false;
let _pendingTone = null;  // queued tone waiting for first gesture

function _createAndResume(then) {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(_) { return; }
  }
  if (_audioCtx.state === "running") { _audioReady = true; then && then(); return; }
  _audioCtx.resume().then(() => { _audioReady = true; then && then(); }).catch(() => {});
}

function _onGesture() {
  _createAndResume(() => {
    if (_pendingTone) { const t = _pendingTone; _pendingTone = null; _playNow(t); }
  });
}
document.addEventListener("click",    _onGesture, { passive: true });
document.addEventListener("keydown",  _onGesture, { passive: true });
document.addEventListener("touchend", _onGesture, { passive: true });

function _playNow(type) {
  if (!_audioCtx || _audioCtx.state !== "running") return;
  try {
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.type = "sine";
    const t = _audioCtx.currentTime;
    if (type === "send") {
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
      gain.gain.setValueAtTime(0.20, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.start(t); osc.stop(t + 0.13);
    } else {
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.setValueAtTime(900, t + 0.10);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.setValueAtTime(0.12, t + 0.10);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.start(t); osc.stop(t + 0.26);
    }
  } catch(_) {}
}

function playTone(type) {
  if (_audioReady && _audioCtx && _audioCtx.state === "running") {
    _playNow(type);
  } else {
    // Not unlocked yet — queue it (overwrites any previous pending tone)
    _pendingTone = type;
    // If ctx exists but suspended (e.g. tab hidden then shown), try resume
    if (_audioCtx && _audioCtx.state === "suspended") {
      _createAndResume(() => {
        if (_pendingTone) { const t = _pendingTone; _pendingTone = null; _playNow(t); }
      });
    }
  }
}

// ── Initial load guard ─────────────────────────────────────────────
// onChildAdded fires for ALL existing messages on load — suppress sounds
// during that burst. Only play for genuinely new live messages after.
let _initialLoadDone = false;
let _hadOthersOnLoad = false;

function markInitialLoadDone() {
  if (_initialLoadDone) return;
  _initialLoadDone = true;
  // Don't play a tone here — user may not have interacted yet.
  // Live messages arriving after this point will play normally.
}


function attachListeners() {
  const msgRef = ref(db, "messages");
  // ORDER BY ts — guarantees historical messages render in send-order on reload
  const msgOrdered  = query(msgRef, orderByChild("ts"));

  // Pre-fetch the count of already-existing messages so we know exactly
  // when the initial onChildAdded burst is done and it's safe to play sounds.
  let _pendingInitCount = -1; // -1 = get() not yet resolved
  let _seenInitCount    = 0;
  get(msgRef).then(snap => {
    _pendingInitCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    if (_pendingInitCount === 0) markInitialLoadDone();
    // onChildAdded may have already fired before get() resolved
    else if (_seenInitCount >= _pendingInitCount) markInitialLoadDone();
  }).catch(() => { _pendingInitCount = 0; markInitialLoadDone(); });

  const msgAdded = onChildAdded(msgOrdered, snap => {
    if (!_initialLoadDone) {
      _seenInitCount++;
      if (_pendingInitCount >= 0 && _seenInitCount >= _pendingInitCount) {
        markInitialLoadDone();
      }
    }
    onMsgAdded(snap);
  });

  const msgChanged  = onChildChanged(msgRef,     onMsgChanged);
  const msgRemoved  = onChildRemoved(msgRef,      onMsgRemoved);

  const onlineRef2 = ref(db, "online");
  const onlineVal = onValue(onlineRef2, snap => {
    onlineUsers = snap.val() || {};
    renderOnlineList();
    renderAdminUserList();   // safe to call always — guards IS_ADMIN inside
  });

  const kickRef = ref(db, `kicked/${MY_NAME}`);
  const kickVal = onValue(kickRef, snap => {
    if (snap.exists()) {
      remove(ref(db, `kicked/${MY_NAME}`));
      showAlert("🚫 You have been removed from the chat by an admin.");
      window._leaveChat?.();
      document.getElementById("appScreen").style.display  = "none";
      document.getElementById("loginScreen").style.display = "flex";
    }
  });

  const blockedRef = ref(db, `blocked/${MY_NAME}`);
  const blockedVal = onValue(blockedRef, snap => {
    if (snap.exists()) {
      showAlert("⛔ You have been banned from this chat.");
      window._leaveChat?.();
      document.getElementById("appScreen").style.display  = "none";
      document.getElementById("loginScreen").style.display = "flex";
    }
  });

  listeners = [
    { ref: msgOrdered,  unsub: msgAdded },
    { ref: msgRef,      unsub: msgChanged },
    { ref: msgRef,      unsub: msgRemoved },
    { ref: onlineRef2,  unsub: onlineVal },
    { ref: kickRef,     unsub: kickVal },
    { ref: blockedRef,  unsub: blockedVal },
  ];

  const inputBox = document.getElementById("inputBox");
  const sendBtn  = document.getElementById("sendBtn");
  inputBox.addEventListener("keydown", onInputKeydown);
  inputBox.addEventListener("input",   onInputChange);
  sendBtn.addEventListener("click",    sendMessage);
}

function detachListeners() {
  listeners.forEach(l => { try { l.unsub(); } catch(_) {} });
  listeners = [];
  // Reset load-state so sounds work correctly on re-login
  _initialLoadDone = false;
  _hadOthersOnLoad = false;
  const inputBox = document.getElementById("inputBox");
  const sendBtn  = document.getElementById("sendBtn");
  inputBox?.removeEventListener("keydown", onInputKeydown);
  inputBox?.removeEventListener("input",   onInputChange);
  sendBtn?.removeEventListener("click",    sendMessage);
}

// ═══════════════════════════════════════════════ MESSAGE ADDED ════
async function onMsgAdded(snap) {
  const d = snap.val();
  if (!d) return;

  // Hidden for me only — never render, regardless of message type
  if (locallyDeletedKeys.has(snap.key)) return;

  const wc = document.getElementById("welcomeCard");
  if (wc) wc.remove();

  const inner = document.getElementById("messagesInner");

  // ── JOIN / LEAVE / KICK notices ─────────────────────────────────
  if (d.type === "join" || d.type === "leave" || d.type === "kick") {
    let label;
    if (d.type === "join") label = "joined";
    else if (d.type === "leave") label = "left";
    else label = "was kicked from the chat";
    const who   = d.user === MY_NAME ? "You" : d.user;
    const el = document.createElement("div");
    el.className = "join-notice fade-in";
    el.id = snap.key + "_notice";
    el.innerHTML = `<div class="join-notice-inner"><span class="join-name">${sanitize(who)}</span> ${label} · ${d.time}</div>`;
    inner.appendChild(el);
    lastMsgRowEl = null; lastMsgOwner = null;
    scrollToBottom();
    return;
  }

  // ── BROADCAST (announcement) messages ─────────────────────────
  if (d.type === "broadcast") {
    // Store so startReplyByKey can look it up
    msgDataStore[snap.key] = { user: d.user || "Admin", msg: d.message || "" };
    const el = document.createElement("div");
    el.id = snap.key + "_row";
    el.innerHTML = `
      <div class="broadcast-card" id="${snap.key}_bc">
        <div class="broadcast-card-header">
          <div class="broadcast-card-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3L2 9.27l6.91 1.73L12 21l3.64-7.36L22 3z"/></svg>
          </div>
          <span class="broadcast-card-title">Admin Announcement</span>
          <span class="broadcast-card-time">${d.time || ""}</span>
        </div>
        <div class="broadcast-card-body">
          <div class="broadcast-card-msg">${formatMsg(d.message)}</div>
        </div>
        <div class="broadcast-card-footer">
          <span class="broadcast-card-from">from ${sanitize(d.user || "Admin")}</span>
          <button class="broadcast-card-reply" onclick="startReplyByKey('${snap.key}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
            Reply
          </button>
        </div>
      </div>
    `;
    inner.appendChild(el);
    lastMsgRowEl = null; lastMsgOwner = null;
    scrollToBottom(true);
    return;
  }

  // ── Regular messages ───────────────────────────────────────────
  if (!d.user || !d.message) return;

  // Store raw data so reply/copy handlers can look it up by key
  // instead of embedding encoded text in HTML onclick attributes.
  msgDataStore[snap.key] = { user: d.user, msg: d.message };

  const isMine    = (d.user === MY_NAME);
  const isAdminMsg= ADMIN_NAMES.includes(d.user);
  const color     = userColor(d.user);
  // Is this message back-to-back with the previous one from the same
  // sender? If so we group them: tighter spacing, connected bubble
  // corners, and the sender name is only shown once per group.
  const isContinuation = (lastMsgRowEl && lastMsgOwner === d.user);

  // Build reply quote HTML
  let replyHTML = "";
  if (d.replyTo) {
    const rUser    = d.replyTo.user === MY_NAME ? "You" : sanitize(d.replyTo.user);
    const rColor   = userColor(d.replyTo.user);
    // If the quoted message is hidden, show a placeholder instead of its content
    const isQuoteHidden = hiddenMsgs.has(d.replyTo.key);
    const rMsgText = isQuoteHidden
      ? "🔒 Hidden message"
      : sanitize(d.replyTo.msg.replace(/\n/g,' ')).substring(0, 80);
    replyHTML = `
      <div class="reply-quote" style="border-color:${rColor}"
           onclick="jumpToMsg('${sanitize(d.replyTo.key)}')">
        <div class="reply-q-user" style="color:${rColor}">${rUser}</div>
        <div class="reply-q-msg">${rMsgText}</div>
      </div>`;
  }

  const msgFormatted = formatMsg(d.message);
  const emojiOnly    = isEmojiOnly(d.message);

  // ── Action buttons ─────────────────────────────────────────────
  let actionsHTML = "";

  // Dot trigger button — floats inside the bubble corner
  const dotBtn = emojiOnly ? `` : `<button class="bubble-dot-btn" id="${snap.key}_dot" title="Options" onclick="toggleBubbleMenu(event,'${snap.key}')">•</button>`;

  // Empty toolbar shell — items are built dynamically when menu opens
  actionsHTML = `<div class="bubble-toolbar" id="${snap.key}_toolbar"
    data-key="${snap.key}"
    data-user="${sanitize(d.user)}"
    data-mine="${isMine}"
    data-isadmin="${IS_ADMIN}"
  ></div>`;

  // ── Show-more truncation ──────────────────────────────────────
  // If the raw message text is longer than 300 chars, truncate the
  // rendered HTML and append a "Show more" button.
  const TRUNC_LIMIT = 300;
  let msgInnerHTML = msgFormatted;
  if (!emojiOnly && d.message.length > TRUNC_LIMIT) {
    // We truncate the raw text and re-format to avoid cutting mid-tag
    const shortRaw  = sanitize(d.message.substring(0, TRUNC_LIMIT));
    const shortFmt  = shortRaw
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s<>"]+)/g,  '<a class="found-link" href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(@[a-zA-Z0-9_-]+)/g,          '<span class="found-mention">$1</span>');
    msgInnerHTML = `<span class="msg-truncated" id="${snap.key}_trunc">${shortFmt}<span id="${snap.key}_dots">… </span></span>` +
      `<span class="msg-full" id="${snap.key}_full" style="display:none">${msgFormatted}</span>` +
      `<button class="show-more-btn" id="${snap.key}_smb" onclick="toggleShowMore(event,'${snap.key}')">Show more</button>`;
  }

  // Avatar
  const avHTML = `<div class="msg-av" style="background:${isAdminMsg ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : color};color:${isAdminMsg?'#1e1e1e':'#fff'}">${d.user.charAt(0).toUpperCase()}</div>`;

  const el = document.createElement("div");

  // Admin's own regular messages: show like normal "mine" style (right-aligned)
  // Other-user admin messages (nick speaking): shown with admin highlight only if NOT isMine
  if (isAdminMsg && !isMine) {
    el.className = "msg-row theirs admin-highlighted msg-anim";
    el.id = snap.key + "_row";
    const senderLabel = isContinuation ? "" : `<div class="msg-sender-name admin-name-label" data-user="${sanitize(d.user)}">${sanitize(d.user)}</div>`;
    el.innerHTML = `
      ${senderLabel}
      <div class="bubble-row">
        ${avHTML}
        <div class="bubble-time-outer">${d.time}</div>
        <div class="bubble admin-bubble${emojiOnly ? " emoji-big" : ""}" id="${snap.key}_bubble">
          <div class="admin-badge-inline">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Admin
          </div>
          ${replyHTML}
          <div id="${snap.key}_msg">${msgInnerHTML}</div>
          ${dotBtn}
        </div>
      </div>
      ${actionsHTML}
    `;
  } else {
    // Normal / my message
    el.className = `msg-row ${isMine ? "mine" : "theirs"} msg-anim`;
    el.id = snap.key + "_row";

    const senderLabel = (!isMine && !isContinuation)
      ? `<div class="msg-sender-name" data-user="${sanitize(d.user)}" style="color:${isAdminMsg?'#fbbf24':color}">${sanitize(d.user)}</div>`
      : "";

    el.innerHTML = `
      ${senderLabel}
      <div class="bubble-row">
        ${!isMine ? avHTML : ""}
        ${!emojiOnly ? `<div class="bubble-time-outer">${d.time}</div>` : ""}
        <div class="bubble${emojiOnly ? " emoji-big" : ""}" id="${snap.key}_bubble">
          ${replyHTML}
          <div id="${snap.key}_msg">${msgInnerHTML}</div>
          ${emojiOnly ? "" : dotBtn}
        </div>
      </div>
      ${actionsHTML}
    `;
  }

  inner.appendChild(el);

  // Store key & owner for selection system
  el.dataset.key   = snap.key;
  el.dataset.owner = d.user || "";

  // ── Consecutive-message grouping ────────────────────────────────
  // Same sender as the message right before this one → tighten the
  // gap and "connect" the touching corners. Otherwise this message
  // starts its own group.
  if (isContinuation) {
    if (lastMsgRowEl.classList.contains("grp-only")) {
      lastMsgRowEl.classList.replace("grp-only", "grp-top");
    } else if (lastMsgRowEl.classList.contains("grp-bottom")) {
      lastMsgRowEl.classList.replace("grp-bottom", "grp-mid");
    }
    el.classList.add("grp-bottom");
  } else {
    el.classList.add("grp-only");
  }
  lastMsgRowEl = el;
  lastMsgOwner = d.user;

  // If select mode is already active, bind the tap listener
  if (selectMode) attachSelectTap(el);

  // Apply local pin state
  if (pinnedMsgs.has(snap.key)) el.classList.add("pinned-msg");
  // Apply hidden state via shared helper
  applyHiddenState(snap.key);

  // Double-click on bubble to reply
  const bubbleEl = el.querySelector(".bubble");
  if (bubbleEl) {
    bubbleEl._dblclickReply = (e) => {
      if (selectMode) return;
      // Allow reply even on hidden messages — quote shows a placeholder
      e.stopPropagation();
      window.startReplyByKey(snap.key);
    };
    bubbleEl.addEventListener("dblclick", bubbleEl._dblclickReply);
  }

  if (!isMine) {
  }
  // Stamp any flag state onto this freshly-rendered message
  updateAllFlagBadges();
  updateMyFlagButtons();

  // ── Sound ──────────────────────────────────────────────────────
  if (!isMine) {
    if (!_initialLoadDone) {
      _hadOthersOnLoad = true;  // noted — single tone will play when load finishes
    } else {
      playTone("receive");
    }
  }

  scrollToBottom(isMine);
}

// ═══════════════════════════════════════════════ MESSAGE REMOVED ══
function onMsgRemoved(snap) {
  const d = snap.val();
  if (!d) return;

  const notice = document.getElementById(snap.key + "_notice");
  if (notice) { notice.remove(); return; }

  const msgEl = document.getElementById(snap.key + "_msg");
  if (!msgEl) return;
  const bubble = document.getElementById(snap.key + "_bubble") || msgEl.closest(".bubble");
  if (bubble) {
    bubble.classList.add("deleted");
    const label = d.user === MY_NAME
      ? "You deleted this"
      : "Message deleted by admin";
    bubble.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> ${label}`;
  }

  const row = document.getElementById(snap.key + "_row");
  if (row) {
    // Remove pinned indicator if the row was pinned
    row.classList.remove("pinned-msg");
    // Remove toolbar and dot button
    const toolbar = row.querySelector(".bubble-toolbar");
    if (toolbar) toolbar.remove();
    const dot = row.querySelector(".bubble-dot-btn");
    if (dot) dot.remove();
    // Close any open actions
    row.classList.remove("actions-open");
    delete row.dataset.tapOpen;
    const acts = row.querySelector(".bubble-actions");
    if (acts) acts.remove();
    // A message that gets deleted while selected can no longer stay selected
    if (row.classList.contains("msg-selected")) {
      row.classList.remove("msg-selected");
      selectedMsgs.delete(snap.key);
      updateSelectionUI();
    }
  }

  if (d.type === "typing") {
    const ts = document.getElementById("typingStatus");
    const tt = document.getElementById("typingText");
    if (ts) ts.classList.add("idle");
    if (tt) tt.textContent = "Everyone's quiet";
  }
}

// ═══════════════════════════════════════════════ MESSAGE CHANGED ══
// Fired when a message node in Firebase is updated (e.g. edited fields).
// Currently the app doesn't edit message text, but this handler ensures
// that any future field changes are reflected instantly on all clients.
function onMsgChanged(snap) {
  // All real-time state (pins, hides) is driven by their own dedicated
  // Firebase listeners (attachPinListener / attachHideListener), so
  // onMsgChanged is intentionally a no-op for now but keeps the
  // onChildChanged subscription alive for future use.
}

// ═══════════════════════════════════════════════ SEND MESSAGE ═════
async function sendMessage() {
  const box = document.getElementById("inputBox");
  // Extract text preserving line breaks from <br> and block-level <div>s
  // that browsers insert in contenteditable when the user presses Enter.
  function extractText(node) {
    let result = "";
    node.childNodes.forEach((child, i) => {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeName === "BR") {
        result += "\n";
      } else if (child.nodeName === "DIV" || child.nodeName === "P") {
        // Block elements — prepend newline unless it's the very first child
        if (i > 0 || result.length > 0) result += "\n";
        result += extractText(child);
      } else {
        result += extractText(child);
      }
    });
    return result;
  }
  const raw = extractText(box)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "")
    .trim();
  if (!raw) return;
  box.innerHTML = "";
  box.focus();

  clearTypingIndicator();

  const time = timeNow();
  const key  = `msg_${Date.now()}_${MY_NAME}`;

  const payload = {
    type:    "message",
    user:    MY_NAME,
    message: raw,
    time,
    ts:      Date.now()
  };

  if (replyTarget) {
    payload.replyTo = {
      key:  replyTarget.key,
      user: replyTarget.user,
      msg:  replyTarget.msg.substring(0, 100)
    };
    clearReply();
  }

  playTone("send");
  await set(ref(db, `messages/${key}`), payload);
}

// ═══════════════════════════════════════════════ INPUT HANDLERS ═══
function onInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function onInputChange() {
  clearTypingIndicator();
  const box = document.getElementById("inputBox");
  if (box.innerText.trim()) {
    set(ref(db, `typing/${MY_NAME}`), { user: MY_NAME, ts: Date.now() });
    typingTimer = setTimeout(clearTypingIndicator, TYPING_TIMEOUT);
  }
}

function clearTypingIndicator() {
  if (typingTimer) clearTimeout(typingTimer);
  remove(ref(db, `typing/${MY_NAME}`)).catch(()=>{});
}

const _typingWatchers = {};

function watchTyping() {
  const typRef = ref(db, "typing");
  onChildAdded(typRef, snap => {
    if (!snap.val() || snap.val().user === MY_NAME) return;
    const ts = document.getElementById("typingStatus");
    const tt = document.getElementById("typingText");
    if (ts) ts.classList.remove("idle");
    if (tt) tt.textContent = `${snap.val().user} is typing…`;
  });
  onChildRemoved(typRef, () => {
    get(ref(db, "typing")).then(s => {
      const remaining = s.val() ? Object.values(s.val()).filter(v => v.user !== MY_NAME) : [];
      const ts = document.getElementById("typingStatus");
      const tt = document.getElementById("typingText");
      if (remaining.length === 0) {
        if (ts) ts.classList.add("idle");
        if (tt) tt.textContent = "Everyone's quiet";
      } else {
        if (ts) ts.classList.remove("idle");
        if (tt) tt.textContent = `${remaining[0].user} is typing…`;
      }
    });
  });
}
setTimeout(watchTyping, 100);

// ═══════════════════════════════════════════ MENU ITEM BUILDER ════
// SVG paths for menu icons — defined once, reused every open
const MI = {
  reply:  `<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>`,
  copy:   `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>`,
  del:    `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>`,
  pin:    `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>`,
  unpin:  `<line x1="1" y1="1" x2="23" y2="23"/><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0114.3-6.4"/>`,
  hide:   `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`,
  show:   `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  info:   `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  kick:   `<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>`,
  ban:    `<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>`,
  flag:   `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
  unflag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/><line x1="1" y1="1" x2="23" y2="23"/>`,
};

function buildMenuItem(iconPath, label, onclickStr, extraClass = '') {
  return `<button class="bact${extraClass ? ' ' + extraClass : ''}" onclick="${onclickStr}">
    <svg class="bact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
    ${label}
  </button>`;
}

function buildMenuHTML(key, msgUser, isMine, isAdminCtx) {
  const isPinned   = pinnedMsgs.has(key);
  const isHidden   = hiddenMsgs.has(key);
  const isFlagged  = myFlags.has(msgUser);
  const isAdminMsg = ADMIN_NAMES.includes(msgUser);
  const notAdmin   = !isAdminMsg;
  const sep        = `<div class="bact-sep"></div>`;

  let html = '';
  html += buildMenuItem(MI.reply, 'Reply', `startReplyByKey('${key}')`);
  html += buildMenuItem(MI.copy,  'Copy',  `copyMsg('${key}')`);

  // Pin / Hide / Unhide — only own messages or admin
  if (isMine || isAdminCtx) {
    html += sep;
    html += buildMenuItem(
      isPinned ? MI.unpin : MI.pin,
      isPinned ? 'Unpin'  : 'Pin',
      `togglePin('${key}')`,
      isPinned ? 'pinned' : ''
    );
    html += buildMenuItem(
      isHidden ? MI.show  : MI.hide,
      isHidden ? 'Unhide' : 'Hide',
      `toggleHide('${key}')`,
      isHidden ? 'hidden-msg' : ''
    );
  }

  html += buildMenuItem(MI.info, 'Info', `showMsgInfo('${key}')`);

  if (isMine) {
    // Own message: just delete
    html += sep;
    html += buildMenuItem(MI.del, 'Delete', `deleteMsg('${key}')`, 'del');
  } else if (isAdminCtx) {
    // Admin on someone else's message: full controls
    html += sep;
    html += buildMenuItem(MI.del, 'Delete', `deleteMsg('${key}')`, 'del');
    if (notAdmin) {
      html += buildMenuItem(MI.kick, 'Kick', `adminKick('${sanitize(msgUser)}')`, 'kick');
      html += buildMenuItem(MI.ban,  'Ban',  `adminBan('${sanitize(msgUser)}')`,  'del');
      html += buildMenuItem(
        isFlagged ? MI.unflag : MI.flag,
        isFlagged ? 'Unflag'  : 'Flag',
        `doFlag('${sanitize(msgUser)}','${key}')`,
        isFlagged ? 'flag flagged-by-me' : 'flag'
      );
    }
  } else {
    // Regular user on someone else's message: flag only
    if (notAdmin) {
      html += sep;
      html += buildMenuItem(
        isFlagged ? MI.unflag : MI.flag,
        isFlagged ? 'Unflag'  : 'Flag',
        `doFlag('${sanitize(msgUser)}','${key}')`,
        isFlagged ? 'flag flagged-by-me' : 'flag'
      );
    }
  }
  return html;
}

// ═══════════════════════════════════════════════ BUBBLE MENU ═════
window.toggleBubbleMenu = function(e, key) {
  e.stopPropagation();
  const row     = document.getElementById(key + "_row");
  const toolbar = document.getElementById(key + "_toolbar");
  if (!row || !toolbar) return;

  const isOpen = row.classList.contains("actions-open");

  // Close all first
  document.querySelectorAll(".msg-row.actions-open").forEach(r => {
    r.classList.remove("actions-open");
    delete r.dataset.tapOpen;
  });

  if (!isOpen) {
    // Rebuild menu HTML from live state every time
    // Always use live globals — data-isadmin stamped at render time may be stale
    const msgUser    = toolbar.dataset.user  || "";
    const isMine     = (toolbar.dataset.owner || toolbar.dataset.user) === MY_NAME;
    const isAdminCtx = IS_ADMIN;  // live global, never stale
    toolbar.innerHTML = buildMenuHTML(key, msgUser, isMine, isAdminCtx);

    row.classList.add("actions-open");

    // Position the context menu near the dot button using viewport coords
    const dot  = document.getElementById(key + "_dot");
    const msgs = document.getElementById("messages");
    if (dot && msgs) {
      const dotRect  = dot.getBoundingClientRect();
      const msgsRect = msgs.getBoundingClientRect();
      const isMineRow = row.classList.contains("mine");

      toolbar.style.display = "flex";
      const tw = toolbar.offsetWidth || 180;
      const th = toolbar.offsetHeight || 240;
      toolbar.style.display = "";

      toolbar.style.position = "fixed";

      let top  = dotRect.bottom + 4;
      let left = isMineRow ? dotRect.right - tw : dotRect.left;

      const maxLeft = msgsRect.right - tw - 8;
      const minLeft = msgsRect.left + 8;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      if (top + th > window.innerHeight - 8) {
        top = dotRect.top - th - 4;
        if (top < 8) top = 8;
      }

      toolbar.style.top  = top + "px";
      toolbar.style.left = left + "px";
    }
  }
};

// Click anywhere else → close all open toolbars
document.addEventListener("click", (e) => {
  if (!e.target.closest(".bubble-dot-btn") && !e.target.closest(".bubble-toolbar")) {
    document.querySelectorAll(".msg-row.actions-open").forEach(r => {
      r.classList.remove("actions-open");
      delete r.dataset.tapOpen;
    });
  }
});

// ═══════════════════════════════════════════════ PIN ════════════
// Track pin order for cycling
let pinnedOrder = JSON.parse(localStorage.getItem('astro_pinned_order') || '[]').filter(k => pinnedMsgs.has(k));
let pinnedCycleIdx = 0;

window.togglePin = function(key) {
  const row = document.getElementById(key + "_row");
  // Admin can act on any message; regular users only their own
  if (!IS_ADMIN && row && row.dataset.owner !== MY_NAME) return;
  if (row) { row.classList.remove("actions-open"); delete row.dataset.tapOpen; }
  if (pinnedMsgs.has(key)) {
    pinnedMsgs.delete(key);
    pinnedOrder = pinnedOrder.filter(k => k !== key);
    row && row.classList.remove("pinned-msg");
    // Always remove from Firebase so all clients update instantly
    remove(ref(db, `pinned/${key}`));
  } else {
    pinnedMsgs.add(key);
    if (!pinnedOrder.includes(key)) pinnedOrder.push(key);
    row && row.classList.add("pinned-msg");
    // Always push to Firebase (not just admin) so all clients see pin instantly
    const stored = msgDataStore[key];
    if (stored) set(ref(db, `pinned/${key}`), { key, user: stored.user, preview: stored.msg.substring(0,80), pinnedAt: Date.now() });
  }
  localStorage.setItem('astro_pinned', JSON.stringify([...pinnedMsgs]));
  localStorage.setItem('astro_pinned_order', JSON.stringify(pinnedOrder));
  renderPinnedBanner();
};

function renderPinnedBanner() {
  const existing = document.getElementById("pinnedBanner");
  if (pinnedMsgs.size === 0) { existing && existing.remove(); return; }

  const orderedKeys = pinnedOrder.filter(k => pinnedMsgs.has(k));
  if (orderedKeys.length === 0) { existing && existing.remove(); return; }

  const currentKey = orderedKeys[pinnedCycleIdx % orderedKeys.length] || orderedKeys[0];
  const stored = msgDataStore[currentKey];
  const preview = stored ? stored.msg.replace(/\n/g, ' ').substring(0, 60) : "Pinned message";
  const count = orderedKeys.length;

  if (existing) {
    existing.querySelector(".pinned-banner-text").textContent = preview;
    const countEl = existing.querySelector(".pinned-banner-count");
    if (countEl) countEl.textContent = `${(pinnedCycleIdx % count) + 1}/${count}`;
    return;
  }

  const banner = document.createElement("div");
  banner.id = "pinnedBanner"; banner.className = "pinned-banner";
  banner.innerHTML = `
    <svg class="pinned-banner-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
    <span class="pinned-banner-label">Pinned</span>
    <span class="pinned-banner-count">1/${count}</span>
    <span class="pinned-banner-text">${sanitize(preview)}</span>
    <button class="pinned-banner-close" onclick="event.stopPropagation();unpinCurrent()">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `;
  banner.onclick = () => cyclePinnedMsg();
  const chatMain = document.querySelector(".chat-main");
  const topbar = chatMain.querySelector(".topbar");
  chatMain.insertBefore(banner, topbar.nextSibling);
}

window.unpinCurrent = function() {
  const orderedKeys = pinnedOrder.filter(k => pinnedMsgs.has(k));
  if (!orderedKeys.length) return;
  const key = orderedKeys[pinnedCycleIdx % orderedKeys.length];
  window.togglePin(key);
};

function cyclePinnedMsg() {
  const orderedKeys = pinnedOrder.filter(k => pinnedMsgs.has(k));
  if (!orderedKeys.length) return;
  pinnedCycleIdx = (pinnedCycleIdx + 1) % orderedKeys.length;
  const key = orderedKeys[pinnedCycleIdx];
  jumpToMsg(key);
  // Update banner text and counter
  const banner = document.getElementById("pinnedBanner");
  if (banner) {
    const stored = msgDataStore[key];
    const preview = stored ? stored.msg.replace(/\n/g, ' ').substring(0, 60) : "Pinned message";
    const countEl = banner.querySelector(".pinned-banner-count");
    const textEl  = banner.querySelector(".pinned-banner-text");
    if (countEl) countEl.textContent = `${pinnedCycleIdx + 1}/${orderedKeys.length}`;
    if (textEl)  textEl.textContent  = preview;
  }
}

function attachPinListener() {
  onValue(ref(db, "pinned"), snap => {
    // Determine the full set of pinned keys from Firebase
    const serverPinned = snap.exists() ? Object.keys(snap.val()) : [];

    // Add any newly pinned keys (for all clients — admin pushes, others receive)
    serverPinned.forEach(key => {
      if (!pinnedMsgs.has(key)) {
        pinnedMsgs.add(key);
        if (!pinnedOrder.includes(key)) pinnedOrder.push(key);
        document.getElementById(key + "_row")?.classList.add("pinned-msg");
      }
    });

    // Remove any keys that were unpinned on Firebase
    const serverSet = new Set(serverPinned);
    [...pinnedMsgs].forEach(key => {
      if (!serverSet.has(key)) {
        pinnedMsgs.delete(key);
        pinnedOrder = pinnedOrder.filter(k => k !== key);
        document.getElementById(key + "_row")?.classList.remove("pinned-msg");
      }
    });

    // Keep cycleIdx in bounds after removals
    if (pinnedMsgs.size > 0 && pinnedCycleIdx >= pinnedMsgs.size) {
      pinnedCycleIdx = 0;
    }

    // Persist locally and refresh banner
    localStorage.setItem('astro_pinned', JSON.stringify([...pinnedMsgs]));
    localStorage.setItem('astro_pinned_order', JSON.stringify(pinnedOrder));

    if (pinnedMsgs.size === 0) {
      document.getElementById("pinnedBanner")?.remove();
      return;
    }
    renderPinnedBanner();
  });
}

// ═══════════════════════════════════════════════ HIDE ════════════
window.toggleHide = function(key) {
  const row = document.getElementById(key + "_row");
  // Admin can act on any message; regular users only their own
  if (!IS_ADMIN && row && row.dataset.owner !== MY_NAME) return;
  if (row) { row.classList.remove("actions-open"); delete row.dataset.tapOpen; }
  if (hiddenMsgs.has(key)) {
    hiddenMsgs.delete(key);
    remove(ref(db, `hidden/${key}`));
  } else {
    hiddenMsgs.add(key);
    set(ref(db, `hidden/${key}`), { by: MY_NAME, at: Date.now() });
  }
  applyHiddenState(key);
};

function applyHiddenState(key) {
  const bubble = document.getElementById(key + "_bubble");
  if (!bubble) return;
  const msgDiv = document.getElementById(key + "_msg");

  if (hiddenMsgs.has(key)) {
    bubble.classList.add("hidden-blur");
    // Block clicks on message content only — not the dot button
    if (msgDiv) msgDiv.onclick = (e) => e.stopPropagation();
  } else {
    bubble.classList.remove("hidden-blur");
    if (msgDiv) msgDiv.onclick = null;
  }
  // Update any reply-quote snippets in other bubbles that quote this message
  const isNowHidden = hiddenMsgs.has(key);
  document.querySelectorAll(`.reply-quote[onclick*="${key}"] .reply-q-msg`).forEach(el => {
    if (isNowHidden) {
      el.dataset.origText = el.dataset.origText || el.textContent;
      el.textContent = "🔒 Hidden message";
    } else {
      if (el.dataset.origText) el.textContent = el.dataset.origText;
    }
  });
}

function attachHideListener() {
  onValue(ref(db, "hidden"), snap => {
    hiddenMsgs.clear();
    if (snap.exists()) Object.keys(snap.val()).forEach(k => hiddenMsgs.add(k));
    document.querySelectorAll(".bubble[id]").forEach(b => {
      const key = b.id.replace("_bubble","");
      applyHiddenState(key);
    });
  });
}

// ═══════════════════════════════════════════════ INFO ════════════
window.showMsgInfo = function(key) {
  const row = document.getElementById(key + "_row");
  if (row) { row.classList.remove("actions-open"); delete row.dataset.tapOpen; }
  const stored = msgDataStore[key]; if (!stored) return;
  const timeEl = row?.querySelector(".bubble-time-outer");
  const timeStr = timeEl ? timeEl.textContent.trim() : "—";
  const dateStr = new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const msgLen = stored.msg.length;
  const wordCount = stored.msg.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById("msgInfoModal")?.remove(); document.getElementById("msgInfoOverlay")?.remove();
  const ov = document.createElement("div"); ov.id="msgInfoOverlay"; ov.className="modal-overlay"; ov.style.zIndex="498";
  const modal = document.createElement("div"); modal.id="msgInfoModal"; modal.className="msg-info-modal";
  modal.innerHTML = `<div class="msg-info-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Message Info</div>
    <div class="msg-info-row"><span class="msg-info-label">From</span><span class="msg-info-value">${sanitize(stored.user)}</span></div>
    <div class="msg-info-row"><span class="msg-info-label">Time</span><span class="msg-info-value">${sanitize(timeStr)}</span></div>
    <div class="msg-info-row"><span class="msg-info-label">Date</span><span class="msg-info-value">${dateStr}</span></div>
    <div class="msg-info-row"><span class="msg-info-label">Length</span><span class="msg-info-value">${msgLen} chars · ${wordCount} words</span></div>
    <div class="msg-info-row"><span class="msg-info-label">Hidden</span><span class="msg-info-value">${hiddenMsgs.has(key)?"Yes":"No"}</span></div>
    <div class="msg-info-row"><span class="msg-info-label">Pinned</span><span class="msg-info-value">${pinnedMsgs.has(key)?"Yes":"No"}</span></div>
    <div class="msg-info-row"><span class="msg-info-label">ID</span><span class="msg-info-value" style="font-family:'JetBrains Mono',monospace;font-size:0.62rem">${sanitize(key)}</span></div>
    <button class="msg-info-close" onclick="document.getElementById('msgInfoModal')?.remove();document.getElementById('msgInfoOverlay')?.remove()">Close</button>`;
  ov.onclick = () => { ov.remove(); modal.remove(); };
  document.body.appendChild(ov); document.body.appendChild(modal);
};


// ═══════════════════════════════════════════════ SHOW MORE ════════
window.toggleShowMore = function(e, key) {
  e.stopPropagation();
  const trunc = document.getElementById(key + "_trunc");
  const full  = document.getElementById(key + "_full");
  const btn   = document.getElementById(key + "_smb");
  if (!trunc || !full || !btn) return;
  const isExpanded = full.style.display !== "none";
  if (isExpanded) {
    trunc.style.display = "";
    full.style.display  = "none";
    btn.textContent = "Show more";
  } else {
    trunc.style.display = "none";
    full.style.display  = "";
    btn.textContent = "Show less";
  }
};

// ═══════════════════════════════════════════════ REPLY ════════════
// Safe key-based reply — looks up message data from msgDataStore so
// no encoded text ever has to live inside an HTML onclick attribute.
window.startReplyByKey = function(key) {
  const stored = msgDataStore[key];
  if (!stored) return;
  // If the message is hidden, show a placeholder — keep content concealed
  const isHidden = hiddenMsgs.has(key);
  const previewText = isHidden ? "🔒 Hidden message" : stored.msg;
  window.startReply(key, stored.user, previewText);
};

// Direct call (kept for any legacy usage). Now accepts plain text — no decoding.
window.startReply = function(key, user, msg) {
  replyTarget = { key, user, msg };
  document.getElementById("replyBar").style.display    = "block";
  document.getElementById("replyBarUser").textContent  = user;
  document.getElementById("replyBarMsg").textContent   = msg.substring(0, 80);
  document.getElementById("inputBox").focus();
};

window.clearReply = function() {
  replyTarget = null;
  document.getElementById("replyBar").style.display = "none";
};

window.jumpToMsg = function(key) {
  const row = document.getElementById(key + "_row");
  if (!row) return;
  row.scrollIntoView({ behavior:"smooth", block:"center" });
  row.classList.add("highlighted");
  setTimeout(() => row.classList.remove("highlighted"), 3000);
};

// ═══════════════════════════════════════════════ DELETE ═══════════
window.deleteMsg = function(key) {
  // Clean up any pin/hide state so the indicators vanish for everyone
  remove(ref(db, `messages/${key}`));
  remove(ref(db, `pinned/${key}`));
  remove(ref(db, `hidden/${key}`));
  // Also clean local pin state
  if (pinnedMsgs.has(key)) {
    pinnedMsgs.delete(key);
    pinnedOrder = pinnedOrder.filter(k => k !== key);
    localStorage.setItem('astro_pinned', JSON.stringify([...pinnedMsgs]));
    localStorage.setItem('astro_pinned_order', JSON.stringify(pinnedOrder));
  }
};

window.copyMsg = function(key) {
  // Get the full message text from msgDataStore (has raw \n newlines)
  const stored = msgDataStore[key];
  let text = stored ? stored.msg : "";
  if (!text) {
    // Fallback: extract from DOM, converting <br> back to newlines
    const fullEl = document.getElementById(key + "_full");
    const msgEl  = document.getElementById(key + "_msg");
    const source = fullEl || msgEl;
    if (source) {
      // Clone to safely manipulate
      const clone = source.cloneNode(true);
      clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
      text = clone.textContent || clone.innerText || "";
      text = text.replace(/Show (more|less)\s*$/, "").trim();
    }
  }
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    // Brief "Copied!" toast
    const toast = document.createElement("div");
    toast.className = "copy-toast";
    toast.textContent = "Copied!";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  });
  // Close toolbar
  const row = document.getElementById(key + "_row");
  if (row) { row.classList.remove("actions-open"); delete row.dataset.tapOpen; }
};

// ═══════════════════════════════════════════════ SELECT MODE ══════

window.toggleSelectMode = function() {
  selectMode = !selectMode;
  selectedMsgs.clear();
  updateSelectionUI();

  const btn = document.getElementById("selectBtn");
  if (selectMode) {
    btn.classList.add("active");
    btn.querySelector("span").textContent = "Cancel";
    document.getElementById("messagesInner").classList.add("select-mode");
    // Attach tap listeners to all existing rows
    document.querySelectorAll(".msg-row[data-key]").forEach(row => {
      attachSelectTap(row);
    });
  } else {
    btn.classList.remove("active");
    btn.querySelector("span").textContent = "Select";
    document.getElementById("messagesInner").classList.remove("select-mode");
    document.getElementById("deleteSelectedBtn").style.display = "none";
    document.querySelectorAll(".msg-row.msg-selected").forEach(r => r.classList.remove("msg-selected"));
  }
};

function attachSelectTap(row) {
  if (row.dataset.selectBound) return;
  row.dataset.selectBound = "1";
  row.addEventListener("click", onSelectRowClick);
}

function onSelectRowClick(e) {
  if (!selectMode) return;
  // Don't intercept toolbar button clicks
  if (e.target.closest(".bubble-toolbar, .show-more-btn, .reply-quote, a")) return;
  // Already-deleted messages can't be selected
  if (this.querySelector(".bubble.deleted")) return;
  const key = this.dataset.key;
  if (!key) return;
  if (selectedMsgs.has(key)) {
    selectedMsgs.delete(key);
    this.classList.remove("msg-selected");
  } else {
    selectedMsgs.add(key);
    this.classList.add("msg-selected");
  }
  updateSelectionUI();
}

// Figure out whether a set of selected message keys is made up entirely
// of my own messages, entirely of other people's messages, or a mix.
function getSelectionOwnership(keys) {
  let hasMine   = false;
  let hasTheirs = false;
  keys.forEach(key => {
    const row   = document.getElementById(key + "_row");
    const owner = row ? row.dataset.owner : null;
    if (owner === MY_NAME) hasMine = true;
    else hasTheirs = true;
  });
  return { hasMine, hasTheirs };
}

function updateSelectionUI() {
  const count = selectedMsgs.size;
  const delBtn = document.getElementById("deleteSelectedBtn");
  const selCount = document.getElementById("selCount");
  const delLabel = document.getElementById("deleteSelLabel");
  if (count > 0) {
    delBtn.style.display = "flex";
    selCount.textContent = count;
    const { hasMine, hasTheirs } = getSelectionOwnership([...selectedMsgs]);
    if (IS_ADMIN || (hasMine && !hasTheirs)) {
      delLabel.textContent = "Delete permanently";
      delBtn.title = "Delete permanently (removes for everyone)";
    } else {
      delLabel.textContent = "Delete for me";
      delBtn.title = "Delete for me (only removes from your view)";
    }
  } else {
    delBtn.style.display = "none";
  }
}

window.deleteSelected = function() {
  if (selectedMsgs.size === 0) return;
  const keys = [...selectedMsgs];

  // Figure out whether the selection is made up entirely of my own
  // messages, entirely of other people's messages, or a mix of both.
  const { hasMine, hasTheirs } = getSelectionOwnership(keys);

  if (IS_ADMIN) {
    // Admin always deletes permanently — for everyone
    keys.forEach(key => deleteMsg(key));
  } else if (hasMine && !hasTheirs) {
    // My own messages only → permanent delete
    keys.forEach(key => deleteMsg(key));
  } else {
    // Contains someone else's messages → local-only hide
    keys.forEach(key => locallyDeletedKeys.add(key));
    execLocalDelete(keys);
  }

  exitSelectMode();
};

function execLocalDelete(keys) {
  keys.forEach(key => {
    const row = document.getElementById(key + "_row");
    if (!row) return;
    row.style.transition = "opacity .25s, transform .25s";
    row.style.opacity = "0";
    row.style.transform = "scale(0.95)";
    setTimeout(() => row.remove(), 260);
  });
}

function exitSelectMode() {
  selectMode = false;
  selectedMsgs.clear();
  const btn = document.getElementById("selectBtn");
  if (btn) {
    btn.classList.remove("active");
    btn.querySelector("span").textContent = "Select";
  }
  document.getElementById("messagesInner").classList.remove("select-mode");
  document.getElementById("deleteSelectedBtn").style.display = "none";
  document.querySelectorAll(".msg-row.msg-selected").forEach(r => r.classList.remove("msg-selected"));
}

// ═══════════════════════════════════════════════ ONLINE LIST ══════
function renderDeviceRowsFromData(d) {
  // d is the raw Firebase data object for a user
  if (!d) return '<div class="profile-row"><div class="profile-row-label" style="font-size:0.6rem;color:var(--text-3);padding:4px 10px">No device info stored</div></div>';
  const info = {
    deviceType:   d.deviceType,
    os:           d.os,
    browserFull:  d.browser,
    screenLogical:d.screen,
    screenPhysical: null,
    pixelRatio:   d.pixelRatio,
    colorDepth:   d.colorDepth,
    viewportRes:  d.viewport,
    cores:        d.cores,
    memory:       d.memory,
    battery:      d.battery,
    network:      d.network,
    connType:     d.connType,
    connSpeed:    d.connSpeed,
    lang:         d.lang,
    tz:           d.tz,
    tzOffset:     '',
    localTime:    d.localTime,
    touchStr:     d.touchStr,
    ua:           d.ua,
  };
  return (window.renderDeviceRows ? window.renderDeviceRows(info) : '') +
    (d.ua ? `<div class="ouc-ua">${d.ua}</div>` : '');
}

function renderOnlineList() {
  const list  = document.getElementById("onlineList");
  const badge = document.getElementById("onlineBadge");
  if (!list) return;
  list.innerHTML = "";
  const users = Object.keys(onlineUsers);
  badge.textContent = users.length;

  users.sort((a, b) => {
    if (ADMIN_NAMES.includes(a)) return -1;
    if (ADMIN_NAMES.includes(b)) return 1;
    return a.localeCompare(b);
  });

  users.forEach(name => {
    const isMe     = name === MY_NAME;
    const isAdminU = ADMIN_NAMES.includes(name);
    const color    = isAdminU ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : userColor(name);
    const data     = onlineUsers[name] || {};

    // Admin view: expandable card with device info + kick/ban
    if (IS_ADMIN && !isMe && !isAdminU) {
      const card = document.createElement("div");
      card.className = "online-user-card";

      const chevron = `<svg class="ouc-toggle" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

      card.innerHTML = `
        <div class="online-user-card-header">
          <div class="online-av" style="background:${color};color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.55rem;font-weight:700;flex-shrink:0">${name.charAt(0).toUpperCase()}</div>
          <span class="ouc-name">${sanitize(name)}</span>
          <div class="ouc-actions">
            <button class="ouc-kick" onclick="event.stopPropagation();adminKick('${sanitize(name)}')">Kick</button>
            <button class="ouc-ban"  onclick="event.stopPropagation();adminBan('${sanitize(name)}')">Ban</button>
          </div>
          ${chevron}
        </div>
        <div class="ouc-device-panel">
          ${renderDeviceRowsFromData(data)}
        </div>
      `;

      // Toggle expand on header click
      card.querySelector(".online-user-card-header").addEventListener("click", () => {
        card.classList.toggle("expanded");
      });

      list.appendChild(card);
      return;
    }

    // Normal view (self, admins, or non-admin users)
    const tag = isMe
      ? `<span class="online-me-tag">you</span>`
      : isAdminU
        ? `<span class="online-admin-tag">Admin</span>`
        : "";

    const div = document.createElement("div");
    div.className = "online-user";
    div.innerHTML = `
      <div class="online-av" style="background:${color};color:${isAdminU?'#1e1e1e':'#fff'}">${name.charAt(0).toUpperCase()}</div>
      <span>${sanitize(name)}</span>
      ${tag}
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════ ADMIN FEATURES ═══

window.adminKick = async function(targetName) {
  if (!IS_ADMIN || ADMIN_NAMES.includes(targetName)) return;
  showConfirm(`Kick "${targetName}" from the chat?`, async () => {
    await set(ref(db, `kicked/${targetName}`), { by: MY_NAME, at: Date.now() });
    await remove(ref(db, `online/${targetName}`));
    const kickMsgKey = `kick_${Date.now()}`;
    await set(ref(db, `messages/${kickMsgKey}`), {
      type: "kick",
      user: targetName,
      time: timeNow(),
      ts:   Date.now()
    });
    setTimeout(() => remove(ref(db, `messages/${kickMsgKey}`)), JOIN_MSG_EXPIRE);
  });
};

window.adminBan = async function(targetName, reason = "Admin decision") {
  if (!IS_ADMIN || ADMIN_NAMES.includes(targetName)) return;
  showConfirm(`Permanently ban "${targetName}"?`, async () => {
    await set(ref(db, `blocked/${targetName}`), { by: MY_NAME, at: Date.now(), reason });
    await remove(ref(db, `online/${targetName}`));
    await set(ref(db, `kicked/${targetName}`), { by: MY_NAME, at: Date.now() });
    // Use the same kick-notice type so it appears as a subtle log line, not a broadcast
    const banMsgKey = `ban_${Date.now()}`;
    await set(ref(db, `messages/${banMsgKey}`), {
      type: "kick",
      user: targetName,
      time: timeNow(),
      ts:   Date.now()
    });
    setTimeout(() => remove(ref(db, `messages/${banMsgKey}`)), JOIN_MSG_EXPIRE);
  });
};

window.adminUnblock = async function(targetName) {
  if (!IS_ADMIN) return;
  await remove(ref(db, `blocked/${targetName}`));
  refreshAdminBlockedList();
};

window.adminClearAll = async function() {
  if (!IS_ADMIN) return;
  showConfirm("Delete ALL messages, pins, and announcements? This cannot be undone.", async () => {
    await Promise.all([
      remove(ref(db, "messages")),
      remove(ref(db, "pinned")),
      remove(ref(db, "hidden")),
    ]);
    // Clear local state
    pinnedMsgs.clear();
    pinnedOrder = [];
    hiddenMsgs.clear();
    Object.keys(msgDataStore).forEach(k => delete msgDataStore[k]);
    localStorage.setItem('astro_pinned', JSON.stringify([]));
    localStorage.setItem('astro_pinned_order', JSON.stringify([]));
    document.getElementById("messagesInner").innerHTML = "";
    document.getElementById("pinnedBanner")?.remove();
    lastMsgRowEl = null; lastMsgOwner = null;
    closeAdminModal();
  });
};

window.sendBroadcast = async function() {
  const txt = document.getElementById("broadcastInput").value.trim();
  if (!txt) return;
  await set(ref(db, `messages/bc_${Date.now()}`), {
    type:    "broadcast",
    user:    MY_NAME,
    message: txt,
    time:    timeNow(),
    ts:      Date.now()
  });
  document.getElementById("broadcastInput").value = "";
  closeBroadcast();
};

// ── Render admin user list ─────────────────────────────────────────
function renderAdminUserList() {
  if (!IS_ADMIN) return;
  const list = document.getElementById("adminUserList");
  if (!list) return;
  const users = Object.keys(onlineUsers).filter(n => !ADMIN_NAMES.includes(n));
  if (users.length === 0) {
    list.innerHTML = `<div class="empty-state">No other users online right now.</div>`;
    return;
  }
  list.innerHTML = users.map(name => {
    const color = userColor(name);
    return `
      <div class="admin-user-row">
        <div class="admin-user-av" style="background:${color}">${name.charAt(0).toUpperCase()}</div>
        <div class="admin-user-info">
          <div class="admin-user-name">${sanitize(name)}</div>
          <div class="admin-user-meta">online now</div>
        </div>
        <div class="admin-user-actions">
          <button class="admin-kick-btn" onclick="adminKick('${sanitize(name)}');closeAdminModal()">Kick</button>
          <button class="admin-ban-btn"  onclick="adminBan('${sanitize(name)}');closeAdminModal()">Ban</button>
        </div>
      </div>
    `;
  }).join("");
}
window.refreshAdminUserList = renderAdminUserList;

window.refreshAdminBlockedList = async function() {
  const list = document.getElementById("adminBlockedList");
  if (!list) return;
  const snap = await get(ref(db, "blocked"));
  if (!snap.exists()) {
    list.innerHTML = `<div class="empty-state">No blocked users.</div>`;
    return;
  }
  const blocked = snap.val();
  list.innerHTML = Object.keys(blocked).map(name => {
    const d = blocked[name];
    return `
      <div class="blocked-row">
        <div>
          <div class="blocked-name">${sanitize(name)}</div>
          <div class="blocked-reason">${sanitize(d.reason || "No reason given")}</div>
        </div>
        <button class="unblock-btn" onclick="adminUnblock('${sanitize(name)}')">Unblock</button>
      </div>
    `;
  }).join("");
};

window.openAdminModal = function() {
  if (!IS_ADMIN) return;
  document.getElementById("adminModal").style.display        = "flex";
  document.getElementById("adminModalOverlay").style.display = "block";
  renderAdminUserList();
  window.refreshAdminBlockedList();
};
window.closeAdminModal = function() {
  document.getElementById("adminModal").style.display        = "none";
  document.getElementById("adminModalOverlay").style.display = "none";
};
window.closeBroadcast = function() {
  document.getElementById("broadcastModal").style.display  = "none";
  document.getElementById("broadcastOverlay").style.display = "none";
};
window.openBroadcast = function() {
  closeAdminModal();
  document.getElementById("broadcastModal").style.display   = "flex";
  document.getElementById("broadcastOverlay").style.display = "block";
  document.getElementById("broadcastInput").focus();
};
window.switchAdminTab = function(tab, btn) {
  ["Users","Blocked","Settings"].forEach(t => {
    document.getElementById("adminTab"+t).style.display = "none";
  });
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
  document.getElementById("adminTab" + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = "block";
  btn.classList.add("active");
  if (tab === "blocked") window.refreshAdminBlockedList();
  if (tab === "users")   renderAdminUserList();
};

// ═══════════════════════════════════════════════ FLAG SYSTEM ══════

// Local cache: { username -> count }
const flagCounts = {};
// Set of usernames I have personally flagged
const myFlags = new Set();

// Live listener for all flags — updates counts and re-stamps sender names in chat
function attachFlagListener() {
  const flagsRef = ref(db, "flags");
  onValue(flagsRef, snap => {
    const data = snap.val() || {};
    // Rebuild flagCounts AND myFlags from scratch every time, so state
    // never goes stale (e.g. after an unflag) and never bleeds between
    // users — each client only ever sees its own MY_NAME in flaggers.
    Object.keys(flagCounts).forEach(k => delete flagCounts[k]);
    myFlags.clear();
    Object.entries(data).forEach(([user, flaggers]) => {
      flagCounts[user] = Object.keys(flaggers).length;
      if (flaggers[MY_NAME]) myFlags.add(user);
    });
    // Re-render all flag badges in chat
    updateAllFlagBadges();
    // Re-color all my flag buttons
    updateMyFlagButtons();
  });
}

function updateAllFlagBadges() {
  document.querySelectorAll(".msg-sender-name[data-user]").forEach(el => {
    const user = el.dataset.user;
    const count = flagCounts[user] || 0;
    let badge = el.querySelector(".flag-count-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "flag-count-badge";
        el.appendChild(badge);
      }
      badge.textContent = `⚑${count}`;
    } else {
      if (badge) badge.remove();
    }
  });
}

function updateMyFlagButtons() {
  // Color all flag buttons red and relabel them if I've flagged that user
  document.querySelectorAll(".bact.flag[data-flagtarget]").forEach(btn => {
    const target = btn.dataset.flagtarget;
    if (myFlags.has(target)) {
      btn.classList.add("flagged-by-me");
      btn.textContent = "⚑ Unflag";
    } else {
      btn.classList.remove("flagged-by-me");
      btn.textContent = "⚑ Flag";
    }
  });
}

// Toggle flag — click flags, click again unflags. No confirmation modal.
window.doFlag = async function(targetName, msgKey) {
  if (!targetName || targetName === MY_NAME || ADMIN_NAMES.includes(targetName)) return;
  // Close toolbar first
  const row = document.getElementById(msgKey + "_row");
  if (row) { row.classList.remove("actions-open"); delete row.dataset.tapOpen; }

  if (myFlags.has(targetName)) {
    await unflagUser(targetName);
  } else {
    await flagUser(targetName);
  }
};

async function flagUser(targetName) {
  // Never allow flagging the admin
  if (!targetName || targetName === MY_NAME || ADMIN_NAMES.includes(targetName)) return;

  const flagRef   = ref(db, `flags/${targetName}/${MY_NAME}`);
  const existSnap = await get(flagRef);
  if (existSnap.exists()) {
    // Already flagged by me — keep state in sync and treat as a no-op
    myFlags.add(targetName);
    updateMyFlagButtons();
    return;
  }

  await set(flagRef, { at: Date.now() });
  myFlags.add(targetName);
  updateMyFlagButtons();

  const allFlags = await get(ref(db, `flags/${targetName}`));
  const count    = allFlags.exists() ? Object.keys(allFlags.val()).length : 0;

  if (count >= FLAG_THRESHOLD) {
    await set(ref(db, `blocked/${targetName}`), {
      by:     "community",
      at:     Date.now(),
      reason: `Auto-banned: flagged by ${count} users`
    });
    await remove(ref(db, `online/${targetName}`));
    const autoBanKey = `autoban_${Date.now()}`;
    await set(ref(db, `kicked/${targetName}`), { by: "system", at: Date.now() });
    await set(ref(db, `messages/${autoBanKey}`), {
      type: "kick",
      user: targetName,
      time: timeNow(),
      ts:   Date.now()
    });
    setTimeout(() => remove(ref(db, `messages/${autoBanKey}`)), JOIN_MSG_EXPIRE);
  } else {
    const remaining = FLAG_THRESHOLD - count;
    const note = document.createElement("div");
    note.style.cssText = "position:fixed;bottom:80px;right:20px;padding:10px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;font-size:0.78rem;color:var(--text-2);z-index:999;animation:slideUp .3s ease";
    note.textContent = `${targetName} flagged (${count}/${FLAG_THRESHOLD}). ${remaining} more needed for auto-ban.`;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 4000);
  }
}

async function unflagUser(targetName) {
  if (!targetName || targetName === MY_NAME) return;

  const flagRef = ref(db, `flags/${targetName}/${MY_NAME}`);
  await remove(flagRef);
  myFlags.delete(targetName);
  updateMyFlagButtons();

  const note = document.createElement("div");
  note.style.cssText = "position:fixed;bottom:80px;right:20px;padding:10px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;font-size:0.78rem;color:var(--text-2);z-index:999;animation:slideUp .3s ease";
  note.textContent = `Flag removed from ${targetName}.`;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 2500);
}

// ═══════════════════════════════════════════════ THEME SYNC ══════
document.querySelectorAll(".sb-theme").forEach(b => {
  b.addEventListener("click", () => {
    const t = b.dataset.theme;
    document.body.setAttribute("data-theme", t);
    localStorage.setItem("astro_theme", t);
    document.querySelectorAll(".theme-opt, .sb-theme").forEach(el => {
      el.classList.toggle("active", el.dataset.theme === t);
    });
  });
});

// ── Auto-login: triggered after module fully loads ─────────────────
// index.html sets window._pendingAutoLogin if a saved username exists.
// We handle it here because startApp is only defined inside this module.
if (window._pendingAutoLogin) {
  const _pending = window._pendingAutoLogin;
  window._pendingAutoLogin = null;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display   = 'flex';
  window.startApp(_pending);
}
