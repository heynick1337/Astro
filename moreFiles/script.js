import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import {
  getDatabase, ref, set, remove, onChildAdded, onChildRemoved, onValue
} from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";

/* ══════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyD_MMtOZ53JvbhhOGDxh40GG3Q1Hed0hks",
  authDomain: "astro-f1122.firebaseapp.com",
  databaseURL: "https://astro-f1122-default-rtdb.firebaseio.com",
  projectId: "astro-f1122",
  storageBucket: "astro-f1122.appspot.com",
  messagingSenderId: "500839311652",
  appId: "1:500839311652:web:b08544d6f839704097ebb1"
};
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

/* ══════════════════════════════════════════════════════════
   ADMIN SETUP
   — Secret code is checked client-side (obfuscated).
   — Username "nick" is reserved; only the secret bypasses it.
══════════════════════════════════════════════════════════ */
const ADMIN_NAME   = "nick";
// Secret code: "astro@admin2024"  (stored reversed so it's not plain-text)
const ADMIN_SECRET = "4202nimda@ortsa".split("").reverse().join("");
const RESERVED     = ADMIN_NAME.toLowerCase();

/* ══════════════════════════════════════════════════════════
   THEME
══════════════════════════════════════════════════════════ */
let currentTheme = localStorage.getItem("globerTheme") || "midnight";

function applyTheme(t) {
  currentTheme = t;
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("globerTheme", t);
  document.querySelectorAll(".theme-pill, .theme-opt").forEach(b =>
    b.classList.toggle("active", b.dataset.theme === t));
}
applyTheme(currentTheme);
document.querySelectorAll(".theme-pill").forEach(b =>
  b.addEventListener("click", () => applyTheme(b.dataset.theme)));

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function sanitize(str = "") {
  const el = document.createElement("div");
  el.textContent = str;
  return el.innerHTML;
}
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360},52%,44%)`;
}
function initial(name = "") { return name.charAt(0).toUpperCase(); }
function nowTime() {
  return new Date().toLocaleString("en-US", { hour:"numeric", minute:"numeric", hour12:true });
}
const urlRe     = /(https?:\/\/[^\s]+)/g;
const mentionRe = /(@\w+)/g;
function formatMsg(raw) {
  let s = sanitize(raw);
  s = s.replace(urlRe,     u => `<a class="chat-link" href="${u}" target="_blank" rel="noopener">${u}</a>`);
  s = s.replace(mentionRe, m => `<span class="chat-mention">${m}</span>`);
  return s;
}
function isEmojiOnly(str) {
  return /^\p{Extended_Pictographic}+$/u.test(str.trim()) && str.trim().length <= 4;
}

/* ══════════════════════════════════════════════════════════
   LOGIN — DOM REFS
══════════════════════════════════════════════════════════ */
const loginScreen   = document.getElementById("loginScreen");
const chatScreen    = document.getElementById("chatScreen");
const usernameInput = document.getElementById("usernameInput");
const charCount     = document.getElementById("charCount");
const inputHint     = document.getElementById("inputHint");
const inputWrap     = document.getElementById("inputWrap");
const loginBtn      = document.getElementById("loginBtn");

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

/* ── Input validation ─────────────────────────────────── */
usernameInput.addEventListener("input", () => {
  const v = usernameInput.value;
  charCount.textContent = `${v.length}/16`;
  const isSecret  = v === ADMIN_SECRET;
  const isReserved = v.toLowerCase() === RESERVED && !isSecret;
  const basic = v.length >= 3 && v.length <= 16 && NAME_RE.test(v);

  if (isReserved) {
    inputHint.textContent = `"${RESERVED}" is a reserved username.`;
    inputHint.classList.add("error-msg");
    inputWrap.classList.add("error");
    loginBtn.disabled = true;
    return;
  }
  // secret code bypasses length check (it's longer than 16)
  if (isSecret) {
    inputHint.textContent = "🔑 Admin access detected";
    inputHint.classList.remove("error-msg");
    inputWrap.classList.remove("error");
    loginBtn.disabled = false;
    return;
  }
  const ok = basic;
  inputHint.textContent = "3–16 chars · letters, numbers, _ or −";
  inputHint.classList.toggle("error-msg", v.length > 0 && !ok);
  inputWrap.classList.toggle("error", v.length > 0 && !ok);
  loginBtn.disabled = !ok;
});

usernameInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !loginBtn.disabled) loginBtn.click();
});

/* ── Login button ─────────────────────────────────────── */
loginBtn.addEventListener("click", () => {
  const raw = usernameInput.value.trim();
  let username, isAdmin;

  if (raw === ADMIN_SECRET) {
    // Secret code → log in as "nick" with admin flag
    username = ADMIN_NAME;
    isAdmin  = true;
  } else {
    username = raw.toLowerCase();
    isAdmin  = false;
  }

  // Persist to localStorage
  localStorage.setItem("globerUser",    username);
  localStorage.setItem("globerIsAdmin", isAdmin ? "1" : "0");

  transitionToChat(username, isAdmin);
});

/* ── Returning user ───────────────────────────────────── */
const savedUser    = localStorage.getItem("globerUser");
const savedIsAdmin = localStorage.getItem("globerIsAdmin") === "1";
if (savedUser) {
  usernameInput.value   = savedUser === ADMIN_NAME && savedIsAdmin ? ADMIN_NAME : savedUser;
  charCount.textContent = `${usernameInput.value.length}/16`;
  loginBtn.disabled     = false;
  inputHint.textContent = savedIsAdmin ? "🔑 Admin access detected" : "3–16 chars · letters, numbers, _ or −";
}

/* ── Transition animation ─────────────────────────────── */
function transitionToChat(username, isAdmin) {
  if (!document.getElementById("_cardOut")) {
    const s = document.createElement("style");
    s.id = "_cardOut";
    s.textContent = "@keyframes cardOut{to{opacity:0;transform:translateY(-16px) scale(.97)}}";
    document.head.appendChild(s);
  }
  loginScreen.style.animation = "cardOut .3s ease forwards";
  setTimeout(() => {
    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    initChat(username, isAdmin);
  }, 300);
}

// Auto-enter if returning session
if (savedUser) {
  // small delay so page renders first
  setTimeout(() => transitionToChat(savedUser, savedIsAdmin), 120);
}

/* ══════════════════════════════════════════════════════════
   CHAT SIDEBAR / THEME / ABOUT BINDINGS
   (outside initChat — available regardless of session state)
══════════════════════════════════════════════════════════ */
const sidebar        = document.getElementById("sidebar");
const sidebarToggle  = document.getElementById("sidebarToggle");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeDropdown  = document.getElementById("themeDropdown");
const leaveBtn       = document.getElementById("leaveBtn");
const aboutBtn       = document.getElementById("aboutBtn");
const aboutModal     = document.getElementById("aboutModal");
const closeAbout     = document.getElementById("closeAbout");

// Mobile overlay
const overlay = document.createElement("div");
overlay.className = "sidebar-overlay";
document.body.appendChild(overlay);

sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
});
overlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
});

themeToggleBtn.addEventListener("click", e => {
  e.stopPropagation();
  themeDropdown.classList.toggle("hidden");
});
document.addEventListener("click", () => themeDropdown.classList.add("hidden"));
themeDropdown.addEventListener("click", e => e.stopPropagation());
document.querySelectorAll(".theme-opt").forEach(b =>
  b.addEventListener("click", () => { applyTheme(b.dataset.theme); themeDropdown.classList.add("hidden"); }));

leaveBtn.addEventListener("click", () => {
  if (confirm("Leave the chat?")) {
    localStorage.removeItem("globerUser");
    localStorage.removeItem("globerIsAdmin");
    location.reload();
  }
});

aboutBtn.addEventListener("click",  () => aboutModal.classList.remove("hidden"));
closeAbout.addEventListener("click", () => aboutModal.classList.add("hidden"));
aboutModal.addEventListener("click", e => { if (e.target === aboutModal) aboutModal.classList.add("hidden"); });

/* ══════════════════════════════════════════════════════════
   MAIN CHAT
══════════════════════════════════════════════════════════ */
function initChat(username, isAdmin) {
  const sentAudio = new Audio("moreFiles/sent.wav");
  const recvAudio = new Audio("moreFiles/received.wav");

  const messagesEl    = document.getElementById("messages");
  const msgInput      = document.getElementById("msgInput");
  const sendBtn       = document.getElementById("sendBtn");
  const typingText    = document.getElementById("typingText");
  const replyPreview  = document.getElementById("replyPreview");
  const replyToUserEl = document.getElementById("replyToUserEl");
  const replyToMsgEl  = document.getElementById("replyToMsgEl");
  const closeReply    = document.getElementById("closeReply");
  const userList      = document.getElementById("userList");
  const onlineCount   = document.getElementById("onlineCount");
  const myChip        = document.getElementById("myChip");
  const myChipAvatar  = document.getElementById("myChipAvatar");
  const myChipName    = document.getElementById("myChipName");
  const adminCrown    = document.getElementById("adminCrown");

  // Setup topbar chip
  const chipColor = isAdmin ? "var(--admin-color)" : avatarColor(username);
  myChipAvatar.style.background = chipColor;
  myChipAvatar.textContent      = initial(username);
  myChipName.textContent        = username;
  if (isAdmin) {
    adminCrown.classList.remove("hidden");
    myChipName.style.color = "var(--admin-color)";
  }

  let replyState  = null;
  let typingTimer = null;
  const TYPING_TIMEOUT = 1500;

  /* ── Announce join ──────────────────────────────────── */
  const joinKey = Date.now();
  set(ref(db, `messages/${joinKey}`), {
    user: username, time: nowTime(), join: true, isAdmin
  });

  /* ── Register presence ──────────────────────────────── */
  const presRef = ref(db, `presence/${username}`);
  set(presRef, { name: username, time: nowTime(), isAdmin });
  window.addEventListener("beforeunload", () => {
    remove(presRef);
    remove(ref(db, "messages/typing"));
  });

  /* ── Online users list ──────────────────────────────── */
  onValue(ref(db, "presence"), snap => {
    userList.innerHTML = "";
    const users = snap.val() || {};
    let count = 0;
    Object.values(users).forEach(u => {
      count++;
      const li       = document.createElement("li");
      li.className   = "user-item";
      const color    = u.isAdmin ? "var(--admin-color)" : avatarColor(u.name);
      const crown    = u.isAdmin ? `<span class="user-admin-badge">👑</span>` : "";
      const isYou    = u.name === username;
      li.innerHTML = `
        <div class="user-avatar" style="background:${color}">${initial(u.name)}</div>
        <span class="user-name${isYou ? " is-you" : ""}">${sanitize(u.name)}</span>
        ${crown}`;
      userList.appendChild(li);
    });
    onlineCount.textContent = count;
  });

  /* ── Send message ───────────────────────────────────── */
  function sendMessage() {
    const text = msgInput.textContent.trim();
    if (!text) return;

    // ── Admin commands (typed in chat input) ────────────
    if (isAdmin) {
      // Clear all messages: type /clear
      if (text === "/clear") {
        remove(ref(db, "messages/"));
        // Post a system event
        set(ref(db, `messages/${Date.now()}`), {
          user: username, time: nowTime(), system: true,
          systemMsg: "🗑️ Admin cleared all messages."
        });
        msgInput.textContent = "";
        clearReply();
        return;
      }
      // Rename user: /rename oldname newname
      if (text.startsWith("/rename ")) {
        const parts = text.split(" ");
        if (parts.length >= 3) {
          set(ref(db, `messages/${Date.now()}`), {
            user: username, time: nowTime(), system: true,
            systemMsg: `🔧 Admin renamed @${parts[1]} → @${parts[2]}.`
          });
        }
        msgInput.textContent = "";
        clearReply();
        return;
      }
    }

    const ts   = Date.now();
    const payload = { user: username, message: text, time: nowTime(), isAdmin };
    if (replyState) {
      payload.reply       = true;
      payload.replyKey    = replyState.key;
      payload.replyToUser = replyState.user;
      payload.replyToMsg  = replyState.text;
    }
    set(ref(db, `messages/${ts}`), payload).then(() => sentAudio.play().catch(() => {}));

    msgInput.textContent = "";
    msgInput.focus();
    clearReply();
    clearTyping();
  }

  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  /* ── Typing signal ──────────────────────────────────── */
  function sendTyping() {
    set(ref(db, "messages/typing"), { user: username, typer: true });
  }
  function clearTyping() {
    clearTimeout(typingTimer);
    remove(ref(db, "messages/typing"));
  }
  msgInput.addEventListener("input", () => {
    sendTyping();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(clearTyping, TYPING_TIMEOUT);
  });

  /* ── Reply ──────────────────────────────────────────── */
  function startReply(key, user, text) {
    replyState            = { key, user, text };
    replyToUserEl.textContent = user === username ? "You" : user;
    replyToMsgEl.textContent  = text;
    replyPreview.classList.remove("hidden");
    msgInput.focus();
  }
  function clearReply() {
    replyState = null;
    replyPreview.classList.add("hidden");
  }
  closeReply.addEventListener("click", clearReply);

  /* ── Scroll ─────────────────────────────────────────── */
  function scrollBottom() {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
  }

  /* ── Render a message node ──────────────────────────── */
  function renderMessage(snap) {
    const val  = snap.val();
    const key  = snap.key;
    const mine = val.user === username;

    // ── Join event
    if (val.join) {
      const div = document.createElement("div");
      div.className = "event-msg";
      div.id        = `ev_${key}`;
      const who     = val.user === username ? "You" : sanitize(val.user);
      const crown   = val.isAdmin ? " 👑" : "";
      div.innerHTML = `<span class="event-pill"><strong>${who}${crown}</strong> joined · ${val.time}</span>`;
      messagesEl.appendChild(div);
      setTimeout(() => remove(ref(db, `messages/${key}`)), 12000);
      scrollBottom();
      return;
    }

    // ── Typing signal (ephemeral)
    if (val.typer) return;

    // ── System / admin event
    if (val.system) {
      const div = document.createElement("div");
      div.className = "event-msg";
      div.id        = `ev_${key}`;
      div.innerHTML = `<span class="event-pill admin-event">${sanitize(val.systemMsg)}</span>`;
      messagesEl.appendChild(div);
      scrollBottom();
      return;
    }

    // ── Regular message
    const row      = document.createElement("div");
    const msgAdmin = val.isAdmin;
    row.className  = `msg-row ${mine ? "mine" : "theirs"}${msgAdmin ? " is-admin" : ""}`;
    row.id         = `msg_${key}`;

    const color     = msgAdmin ? "var(--admin-color)" : avatarColor(val.user);
    const formatted = formatMsg(val.message);
    const emojiOnly = isEmojiOnly(val.message);

    // Reply bubble inside message
    let replyHTML = "";
    if (val.reply) {
      const ru = val.replyToUser === username ? "You" : sanitize(val.replyToUser);
      replyHTML = `
        <div class="bubble-reply" onclick="window._scrollToMsg('${val.replyKey}')">
          <span class="bubble-reply-user">${ru}</span>
          <p class="bubble-reply-text">${sanitize(val.replyToMsg || "")}</p>
        </div>`;
    }

    // Admin can delete ANY message; others only their own
    const canDelete = mine || isAdmin;
    const delBtn    = canDelete
      ? `<button class="msg-action-btn del" onclick="window._delMsg('${key}')">Delete</button>`
      : "";
    const replyBtn  = `<button class="msg-action-btn" onclick="window._replyTo('${key}','${sanitize(val.user).replace(/'/g,"\\'")}','${sanitize(val.message).replace(/'/g,"\\'")}')">Reply</button>`;

    // Sender label with crown for admin
    const senderLabel = !mine
      ? `<span class="msg-sender" style="color:${color}">
           ${msgAdmin ? `<span class="msg-sender-crown">👑</span>` : ""}
           ${sanitize(val.user)}
         </span>`
      : "";

    row.innerHTML = `
      <div class="msg-avatar" style="background:${color}">${initial(val.user)}</div>
      <div class="msg-bubble-wrap">
        ${senderLabel}
        <div class="msg-bubble${emojiOnly ? " emoji-only" : ""}" id="bubble_${key}">
          ${replyHTML}
          <span id="mtext_${key}">${formatted}</span>
        </div>
        <div class="msg-meta">
          <span class="msg-time">${val.time}</span>
          <div class="msg-actions">${replyBtn}${delBtn}</div>
        </div>
      </div>`;

    messagesEl.appendChild(row);
    scrollBottom();
    if (!mine) recvAudio.play().catch(() => {});
  }

  /* ── Firebase: onChildAdded ─────────────────────────── */
  onChildAdded(ref(db, "messages"), snap => {
    if (snap.val().typer) {
      if (snap.val().user !== username) showTyping(snap.val().user);
      return;
    }
    renderMessage(snap);
  });

  /* ── Firebase: onChildRemoved ───────────────────────── */
  onChildRemoved(ref(db, "messages"), snap => {
    if (snap.val().typer)   { hideTyping(); return; }
    if (snap.val().join || snap.val().system) {
      const el = document.getElementById(`ev_${snap.key}`);
      if (el) el.remove();
      return;
    }
    // Deleted message
    const bubble = document.getElementById(`bubble_${snap.key}`);
    if (bubble) {
      bubble.classList.add("deleted");
      bubble.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.5;flex-shrink:0">
          <circle cx="12" cy="12" r="9"/><line x1="4.5" y1="4.5" x2="19.5" y2="19.5"/>
        </svg>
        ${snap.val().user === username ? "You deleted this" : "Message deleted"}`;
      const actions = bubble.closest(".msg-bubble-wrap")?.querySelector(".msg-actions");
      if (actions) actions.remove();
    }
  });

  /* ── Typing indicator (realtime) ────────────────────── */
  onValue(ref(db, "messages/typing"), snap => {
    if (snap.exists() && snap.val().user !== username) showTyping(snap.val().user);
    else hideTyping();
  });

  let typingHideTimer;
  function showTyping(user) {
    typingText.innerHTML = `
      <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
      &nbsp;<strong>${sanitize(user)}</strong> is typing…`;
    clearTimeout(typingHideTimer);
    typingHideTimer = setTimeout(hideTyping, 3000);
  }
  function hideTyping() { typingText.innerHTML = ""; }

  /* ── Admin: inline panel in chat ────────────────────── */
  if (isAdmin) {
    const panel = document.createElement("div");
    panel.className = "event-msg";
    panel.innerHTML = `
      <div class="admin-panel">
        <div class="admin-panel-title">👑 Admin Controls</div>
        <div class="admin-btns">
          <button class="admin-btn clear" id="adminClearBtn">🗑️ Clear All Messages</button>
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin-top:8px">
          Type <code style="background:var(--bg-tertiary);padding:1px 5px;border-radius:4px">/clear</code> to clear chat &nbsp;·&nbsp;
          <code style="background:var(--bg-tertiary);padding:1px 5px;border-radius:4px">/rename old new</code> to rename a user
        </p>
      </div>`;
    messagesEl.querySelector(".messages-spacer").after(panel);
    document.getElementById("adminClearBtn").addEventListener("click", () => {
      if (confirm("Delete ALL messages permanently?")) {
        remove(ref(db, "messages/")).then(() => {
          set(ref(db, `messages/${Date.now()}`), {
            user: username, time: nowTime(), system: true,
            systemMsg: "🗑️ Admin cleared all messages."
          });
        });
      }
    });
  }

  /* ── Global helpers for inline onclick attrs ────────── */
  window._delMsg = key => {
    if (confirm("Delete this message?")) remove(ref(db, `messages/${key}`));
  };
  window._replyTo = (key, user, text) => startReply(key, user, text);
  window._scrollToMsg = key => {
    const el = document.getElementById(`msg_${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior:"smooth", block:"center" });
    const b = document.getElementById(`bubble_${key}`);
    if (b) { b.classList.add("highlighted"); setTimeout(() => b.classList.remove("highlighted"), 2000); }
  };

  // Focus input
  setTimeout(() => msgInput.focus(), 300);
}
