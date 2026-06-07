import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import {
  getDatabase, ref, set, push, remove,
  onChildAdded, onChildRemoved, onValue
} from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";

// ─── FIREBASE CONFIG ────────────────────────────────────────────
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
const db = getDatabase(app);

// ─── THEME ──────────────────────────────────────────────────────
const THEMES = ["midnight", "aurora", "rose", "forest", "light"];
let currentTheme = localStorage.getItem("globerTheme") || "midnight";

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("globerTheme", theme);
  // sync all pill/opt buttons
  document.querySelectorAll(".theme-pill").forEach(b =>
    b.classList.toggle("active", b.dataset.theme === theme));
  document.querySelectorAll(".theme-opt").forEach(b =>
    b.classList.toggle("active", b.dataset.theme === theme));
}
applyTheme(currentTheme);

// login screen theme pills
document.querySelectorAll(".theme-pill").forEach(btn => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
});

// ─── AVATAR COLOR ───────────────────────────────────────────────
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
function avatarLetter(name) { return name.charAt(0).toUpperCase(); }

// ─── SANITIZE ────────────────────────────────────────────────────
function sanitize(str) {
  const el = document.createElement("div");
  el.textContent = str;
  return el.innerHTML;
}

// ─── FORMAT MESSAGE ──────────────────────────────────────────────
const urlRegex = /(https?:\/\/[^\s]+)/g;
const mentionRegex = /(@\w+)/g;
function formatMessage(raw) {
  let safe = sanitize(raw);
  safe = safe.replace(urlRegex, url =>
    `<a class="chat-link" href="${url}" target="_blank" rel="noopener">${url}</a>`);
  safe = safe.replace(mentionRegex, m =>
    `<span class="chat-mention">${m}</span>`);
  return safe;
}
function isEmojiOnly(str) {
  return /^\p{Extended_Pictographic}+$/u.test(str.trim()) && str.trim().length <= 4;
}

// ─── TIME ────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleString("en-US", {
    hour: "numeric", minute: "numeric", hour12: true
  });
}

// ─── LOGIN ───────────────────────────────────────────────────────
const loginScreen  = document.getElementById("loginScreen");
const chatScreen   = document.getElementById("chatScreen");
const usernameInput= document.getElementById("usernameInput");
const charCount    = document.getElementById("charCount");
const inputHint    = document.getElementById("inputHint");
const inputWrap    = document.getElementById("inputWrap");
const loginBtn     = document.getElementById("loginBtn");

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

usernameInput.addEventListener("input", () => {
  const val = usernameInput.value;
  charCount.textContent = `${val.length}/16`;
  const valid = val.length >= 3 && val.length <= 16 && NAME_RE.test(val);
  loginBtn.disabled = !valid;
  inputWrap.classList.toggle("error", val.length > 0 && !valid);
  inputHint.classList.toggle("error-msg", val.length > 0 && !valid);
});
usernameInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !loginBtn.disabled) loginBtn.click();
});

loginBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim().toLowerCase();
  localStorage.setItem("globerUser", name);
  startChat(name);
});

// Check if returning user
const saved = localStorage.getItem("globerUser");
if (saved) {
  usernameInput.value = saved;
  charCount.textContent = `${saved.length}/16`;
  loginBtn.disabled = false;
}

// ─── CHAT INIT ───────────────────────────────────────────────────
function startChat(username) {
  loginScreen.style.animation = "cardOut 0.35s ease forwards";
  setTimeout(() => {
    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
  }, 350);

  // add cardOut keyframe dynamically
  if (!document.getElementById("cardOutStyle")) {
    const s = document.createElement("style");
    s.id = "cardOutStyle";
    s.textContent = `@keyframes cardOut {
      to { opacity: 0; transform: translateY(-16px) scale(0.97); }
    }`;
    document.head.appendChild(s);
  }

  initChat(username);
}

// ─── SIDEBAR / THEME TOGGLE ──────────────────────────────────────
const sidebar        = document.getElementById("sidebar");
const sidebarToggle  = document.getElementById("sidebarToggle");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeDropdown  = document.getElementById("themeDropdown");
const leaveBtn       = document.getElementById("leaveBtn");

// mobile sidebar overlay
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

document.querySelectorAll(".theme-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    applyTheme(btn.dataset.theme);
    themeDropdown.classList.add("hidden");
  });
});

leaveBtn.addEventListener("click", () => {
  if (confirm("Leave the chat?")) {
    localStorage.removeItem("globerUser");
    location.reload();
  }
});

// ─── MAIN CHAT LOGIC ─────────────────────────────────────────────
function initChat(username) {
  const sentAudio    = new Audio("moreFiles/sent.wav");
  const recvAudio    = new Audio("moreFiles/received.wav");

  const messagesEl   = document.getElementById("messages");
  const msgInput     = document.getElementById("msgInput");
  const sendBtn      = document.getElementById("sendBtn");
  const typingText   = document.getElementById("typingText");
  const typingBar    = document.getElementById("typingBar");
  const replyPreview = document.getElementById("replyPreview");
  const replyToUser  = document.getElementById("replyToUser");
  const replyToMsg   = document.getElementById("replyToMsg");
  const closeReply   = document.getElementById("closeReply");
  const userList     = document.getElementById("userList");
  const onlineCount  = document.getElementById("onlineCount");

  let replyState = null;    // { key, user, text }
  let typingTimer = null;
  const TYPING_TIMEOUT = 1500;

  // announce join
  const joinTime = nowTime();
  const joinKey = Date.now();
  set(ref(db, `messages/${joinKey}`), {
    user: username, time: joinTime, join: true
  });
  // register presence
  const presenceRef = ref(db, `presence/${username}`);
  set(presenceRef, { name: username, time: joinTime });

  // cleanup on leave
  window.addEventListener("beforeunload", () => {
    remove(presenceRef);
    remove(ref(db, "messages/typing"));
  });

  // ── Online users ───────────────────────────────────────────────
  onValue(ref(db, "presence"), snap => {
    userList.innerHTML = "";
    const users = snap.val() || {};
    const names = Object.keys(users);
    onlineCount.textContent = names.length;
    names.forEach(name => {
      const li = document.createElement("li");
      li.className = "user-item";
      const color = avatarColor(name);
      li.innerHTML = `
        <div class="user-avatar" style="background:${color};color:#fff">${avatarLetter(name)}</div>
        <span class="user-name${name === username ? " is-you" : ""}">${sanitize(name)}</span>`;
      userList.appendChild(li);
    });
  });

  // ── Send message ───────────────────────────────────────────────
  function sendMsg() {
    const text = msgInput.textContent.trim();
    if (!text) return;

    const ts = Date.now();
    const time = nowTime();
    const payload = { user: username, message: text, time };

    if (replyState) {
      payload.reply = true;
      payload.replyKey = replyState.key;
      payload.replyToUser = replyState.user;
      payload.replyToMsg = replyState.text;
    }

    set(ref(db, `messages/${ts}`), payload).then(() => {
      sentAudio.play().catch(() => {});
    });

    msgInput.textContent = "";
    msgInput.focus();
    clearReply();
    clearTypingSignal();
  }

  sendBtn.addEventListener("click", sendMsg);
  msgInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });

  // ── Typing indicator ───────────────────────────────────────────
  function sendTypingSignal() {
    set(ref(db, "messages/typing"), { user: username, typer: true });
  }
  function clearTypingSignal() {
    clearTimeout(typingTimer);
    remove(ref(db, "messages/typing"));
  }
  msgInput.addEventListener("input", () => {
    sendTypingSignal();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(clearTypingSignal, TYPING_TIMEOUT);
  });

  // ── Reply ──────────────────────────────────────────────────────
  function startReply(key, user, text) {
    replyState = { key, user, text };
    replyToUser.textContent = user === username ? "You" : user;
    replyToMsg.textContent = text;
    replyPreview.classList.remove("hidden");
    msgInput.focus();
  }
  function clearReply() {
    replyState = null;
    replyPreview.classList.add("hidden");
  }
  closeReply.addEventListener("click", clearReply);

  // ── Scroll to bottom ───────────────────────────────────────────
  function scrollBottom() {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
  }

  // ── Render message ─────────────────────────────────────────────
  function renderMessage(snap) {
    const val = snap.val();
    const key = snap.key;
    const isMine = val.user === username;

    // ── Join event
    if (val.join) {
      const div = document.createElement("div");
      div.className = "event-msg";
      div.id = `${key}_event`;
      const who = val.user === username ? "You" : sanitize(val.user);
      div.innerHTML = `<span class="event-pill"><strong>${who}</strong> joined · ${val.time}</span>`;
      messagesEl.appendChild(div);
      setTimeout(() => remove(ref(db, `messages/${key}`)), 12000);
      scrollBottom();
      return;
    }

    // ── Typing (ephemeral node, handled separately)
    if (val.typer) return;

    // ── Regular message
    const row = document.createElement("div");
    row.className = `msg-row ${isMine ? "mine" : "theirs"}`;
    row.id = `msg_${key}`;
    row.setAttribute("data-key", key);

    const color = avatarColor(val.user);
    const formatted = formatMessage(val.message);
    const emojiOnly = isEmojiOnly(val.message);
    const displayUser = isMine ? "You" : sanitize(val.user);

    // reply snippet inside bubble
    let replyHTML = "";
    if (val.reply) {
      const rUser = val.replyToUser === username ? "You" : sanitize(val.replyToUser);
      replyHTML = `
        <div class="bubble-reply" onclick="scrollToMsg('${val.replyKey}')">
          <span class="bubble-reply-user">${rUser}</span>
          <p class="bubble-reply-text">${sanitize(val.replyToMsg || "")}</p>
        </div>`;
    }

    // action buttons
    const delBtn = isMine
      ? `<button class="msg-action-btn del" onclick="deleteMsg('${key}')">Delete</button>`
      : "";
    const replyBtn = `<button class="msg-action-btn" onclick="replyToMsg_('${key}','${sanitize(val.user)}','${sanitize(val.message).replace(/'/g,"\\'")}')">Reply</button>`;

    row.innerHTML = `
      <div class="msg-avatar" style="background:${color};color:#fff">${avatarLetter(val.user)}</div>
      <div class="msg-bubble-wrap">
        ${!isMine ? `<span class="msg-sender" style="color:${color}">${sanitize(val.user)}</span>` : ""}
        <div class="msg-bubble${emojiOnly ? " emoji-only" : ""}" id="bubble_${key}">
          ${replyHTML}
          <span id="msgtext_${key}">${formatted}</span>
        </div>
        <div class="msg-meta">
          <span class="msg-time">${val.time}</span>
          <div class="msg-actions">
            ${replyBtn}
            ${delBtn}
          </div>
        </div>
      </div>`;

    messagesEl.appendChild(row);
    scrollBottom();

    if (!isMine) recvAudio.play().catch(() => {});
  }

  // ── Firebase listeners ─────────────────────────────────────────
  onChildAdded(ref(db, "messages"), snap => {
    if (snap.val().typer) {
      // typing signal node
      if (snap.val().user !== username) {
        showTyping(snap.val().user);
      }
      return;
    }
    renderMessage(snap);
  });

  onChildRemoved(ref(db, "messages"), snap => {
    if (snap.val().typer) {
      hideTyping();
      return;
    }
    if (snap.val().join) {
      const el = document.getElementById(`${snap.key}_event`);
      if (el) el.remove();
      return;
    }
    // deleted message
    const bubble = document.getElementById(`bubble_${snap.key}`);
    if (bubble) {
      bubble.classList.add("deleted");
      bubble.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.5;margin-right:5px"><circle cx="12" cy="12" r="9"/><line x1="4.5" y1="4.5" x2="19.5" y2="19.5"/></svg>${snap.val().user === username ? "You deleted this" : "Message deleted"}`;
      const meta = bubble.parentElement.querySelector(".msg-meta .msg-actions");
      if (meta) meta.remove();
    }
  });

  // real-time typing watcher
  onValue(ref(db, "messages/typing"), snap => {
    if (snap.exists() && snap.val().user !== username) {
      showTyping(snap.val().user);
    } else {
      hideTyping();
    }
  });

  let typingHideTimer;
  function showTyping(user) {
    typingText.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>&nbsp;<strong>${sanitize(user)}</strong> is typing…`;
    clearTimeout(typingHideTimer);
    typingHideTimer = setTimeout(hideTyping, 3000);
  }
  function hideTyping() {
    typingText.innerHTML = "";
  }

  // ── Global helpers (called from inline onclick) ────────────────
  window.deleteMsg = key => remove(ref(db, `messages/${key}`));

  window.replyToMsg_ = (key, user, text) => startReply(key, user, text);

  window.scrollToMsg = key => {
    const el = document.getElementById(`msg_${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const bubble = document.getElementById(`bubble_${key}`);
    if (bubble) {
      bubble.classList.add("highlighted");
      setTimeout(() => bubble.classList.remove("highlighted"), 2000);
    }
  };
}
