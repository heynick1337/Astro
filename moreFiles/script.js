import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getDatabase, ref, set, get, push, child, update, remove, onChildAdded, onChildRemoved, onValue } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_MMtOZ53JvbhhOGDxh40GG3Q1Hed0hks",
  authDomain: "astro-f1122.firebaseapp.com",
  databaseURL: "https://astro-f1122-default-rtdb.firebaseio.com",
  projectId: "astro-f1122",
  storageBucket: "astro-f1122.appspot.com",
  messagingSenderId: "500839311652",
  appId: "1:500839311652:web:b08544d6f839704097ebb1",
  measurementId: "G-WHYVQLHKBC"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── Theme System ───────────────────────────────────────────────────────────
const themes = {
  dark: {
    label: "Dark",
    vars: {
      "--bg-base": "#111924",
      "--bg-nav": "#212D3B",
      "--bg-input": "#192534",
      "--bg-msg-other": "#222E3A",
      "--bg-msg-self": "#0077cc",
      "--bg-admin-msg": "linear-gradient(135deg, #2a0a3a, #1a0530)",
      "--admin-border": "#9b30ff",
      "--admin-glow": "0 0 18px #8b00ff88, 0 2px 8px #000",
      "--text-primary": "#fff",
      "--text-secondary": "#7A8A96",
      "--accent": "#0099ff",
      "--scrollbar": "#00ffaa",
      "--bubble-bg": "#00000017",
      "--msg-tail-other": "#222E3A",
      "--msg-tail-self": "#0077cc",
    }
  },
  clean: {
    label: "Clean",
    vars: {
      "--bg-base": "#f0f4f8",
      "--bg-nav": "#ffffff",
      "--bg-input": "#f0f4f8",
      "--bg-msg-other": "#ffffff",
      "--bg-msg-self": "#2563eb",
      "--bg-admin-msg": "linear-gradient(135deg, #3b0764, #1e1b4b)",
      "--admin-border": "#a855f7",
      "--admin-glow": "0 0 20px #a855f740, 0 2px 8px #0002",
      "--text-primary": "#1e293b",
      "--text-secondary": "#64748b",
      "--accent": "#2563eb",
      "--scrollbar": "#2563eb",
      "--bubble-bg": "#00000009",
      "--msg-tail-other": "#ffffff",
      "--msg-tail-self": "#2563eb",
    }
  },
  modern: {
    label: "Modern",
    vars: {
      "--bg-base": "#0f0f0f",
      "--bg-nav": "#1a1a1a",
      "--bg-input": "#111111",
      "--bg-msg-other": "#1e1e1e",
      "--bg-msg-self": "#22c55e",
      "--bg-admin-msg": "linear-gradient(135deg, #1a0a2e, #0d001a)",
      "--admin-border": "#c084fc",
      "--admin-glow": "0 0 24px #c084fc55, 0 2px 12px #000",
      "--text-primary": "#f5f5f5",
      "--text-secondary": "#666",
      "--accent": "#22c55e",
      "--scrollbar": "#22c55e",
      "--bubble-bg": "#ffffff0a",
      "--msg-tail-other": "#1e1e1e",
      "--msg-tail-self": "#22c55e",
    }
  },
  casual: {
    label: "Casual",
    vars: {
      "--bg-base": "#1a0a2e",
      "--bg-nav": "#2d1457",
      "--bg-input": "#1f0d3a",
      "--bg-msg-other": "#2a1250",
      "--bg-msg-self": "#f43f5e",
      "--bg-admin-msg": "linear-gradient(135deg, #0f0520, #130830)",
      "--admin-border": "#e879f9",
      "--admin-glow": "0 0 22px #e879f966, 0 2px 10px #0008",
      "--text-primary": "#fce7f3",
      "--text-secondary": "#a78bfa",
      "--accent": "#f43f5e",
      "--scrollbar": "#f43f5e",
      "--bubble-bg": "#ffffff0d",
      "--msg-tail-other": "#2a1250",
      "--msg-tail-self": "#f43f5e",
    }
  },
  minimal: {
    label: "Minimal",
    vars: {
      "--bg-base": "#fafafa",
      "--bg-nav": "#f5f5f5",
      "--bg-input": "#eeeeee",
      "--bg-msg-other": "#e8e8e8",
      "--bg-msg-self": "#333333",
      "--bg-admin-msg": "linear-gradient(135deg, #1a003a, #0d0020)",
      "--admin-border": "#7c3aed",
      "--admin-glow": "0 0 16px #7c3aed33, 0 2px 6px #0001",
      "--text-primary": "#111",
      "--text-secondary": "#888",
      "--accent": "#333",
      "--scrollbar": "#333",
      "--bubble-bg": "#00000008",
      "--msg-tail-other": "#e8e8e8",
      "--msg-tail-self": "#333333",
    }
  }
};

function applyTheme(name) {
  const theme = themes[name];
  if (!theme) return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
  localStorage.setItem('theme', name);
  document.querySelectorAll('.themeBtn').forEach(b => {
    b.classList.toggle('themeBtnActive', b.dataset.theme === name);
  });
}

function buildThemeSwitcher() {
  const container = document.getElementById('themeSwitcher');
  if (!container) return;
  for (const [key, t] of Object.entries(themes)) {
    const btn = document.createElement('button');
    btn.className = 'themeBtn';
    btn.dataset.theme = key;
    btn.textContent = t.label;
    btn.onclick = () => applyTheme(key);
    container.appendChild(btn);
  }
  applyTheme(localStorage.getItem('theme') || 'dark');
}

// ─── Clock ───────────────────────────────────────────────────────────────────
setInterval(() => {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const day = d.getDate();
  const suffix = ([,'st','nd','rd'][day%100>>3^1&&day%10]||'th');
  const timeStr = d.toLocaleString('en-US', { hour:'numeric', minute:'numeric', second:'numeric', hour12:true });
  const full = `${timeStr}, ${days[d.getDay()]} ${day}${suffix} of ${months[d.getMonth()]}, ${d.getFullYear()}`;
  const el1 = document.getElementById('currentTime');
  const el2 = document.getElementById('currentTime2');
  if (el1) el1.innerHTML = full;
  if (el2) el2.innerHTML = full;
}, 1000);

// ─── Fingerprint (pseudo device ID) ─────────────────────────────────────────
function getDeviceFingerprint() {
  const existing = localStorage.getItem('deviceId');
  if (existing) return existing;
  const fp = btoa([
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform || ''
  ].join('|')).replace(/=/g, '').substring(0, 32);
  localStorage.setItem('deviceId', fp);
  return fp;
}

const deviceId = getDeviceFingerprint();

// ─── Main App ─────────────────────────────────────────────────────────────────
function retrieveData() {
  const sent = new Audio('moreFiles/sent.wav');
  const received = new Audio('moreFiles/received.wav');
  const userMessage = document.getElementById("inputBox");
  const usernameEl = document.getElementById("name");
  const img = document.getElementById("img");
  const userValid = /^[a-zA-Z0-9_-]+$/;
  const admin = 'nick'; // lowercase comparison

  let userName;

  // ─── Check device ban ──────────────────────────────────────────────────────
  async function checkIfBanned() {
    const snap = await get(ref(db, 'bans/devices/' + deviceId));
    if (snap.exists()) {
      showBanScreen("Your device has been permanently banned from this chat.");
      return true;
    }
    return false;
  }

  function showBanScreen(msg) {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#0a0014;color:#fff;font-family:sans-serif;gap:20px;padding:30px;text-align:center;">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        <h2 style="font-size:1.5rem;color:#ff4444">Access Denied</h2>
        <p style="color:#aaa;max-width:360px">${msg}</p>
      </div>`;
  }

  // ─── Username uniqueness check ─────────────────────────────────────────────
  async function isUsernameTaken(name) {
    if (name === admin) return false; // Admin can always use their name
    const snap = await get(ref(db, 'joinedUsers/' + name));
    return snap.exists();
  }

  async function isUsernameBanned(name) {
    const snap = await get(ref(db, 'bans/usernames/' + name));
    return snap.exists();
  }

  function showLoginModal(retryMsg) {
    const overlay = document.createElement('div');
    overlay.id = 'loginOverlay';
    overlay.innerHTML = `
      <div class="loginBox">
        <div class="loginLogo">
          <svg width="40" height="40" viewBox="0 0 95.05 113.63" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lg2" x1="37.47" x2="62.79" y1="9.1" y2="90.19" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#d089ff"/><stop offset="1" stop-color="#7f00f5"/>
              </linearGradient>
            </defs>
            <path fill="url(#lg2)" d="M76.12 66.56c0 15.63-13.23 28.31-29.54 28.31-16.3 0-29.73-12.68-29.53-28.31.28-21.7 21.5-33.27 22.1-50.09 10.79 2.2 36.97 24.8 36.97 50.09z"/>
          </svg>
          <span>Astro</span>
        </div>
        <h2 class="loginTitle">Join the Chat</h2>
        <p class="loginSub">Choose a username to get started</p>
        ${retryMsg ? `<p class="loginError">${retryMsg}</p>` : ''}
        <input class="loginInput" id="loginInput" type="text" placeholder="Enter username (3–12 chars)" maxlength="12" autocomplete="off" spellcheck="false">
        <button class="loginBtn" id="loginBtn">Join Chat</button>
        <p class="loginHint">Letters, numbers, _ and - only</p>
      </div>`;
    document.body.appendChild(overlay);

    const input = document.getElementById('loginInput');
    const btn = document.getElementById('loginBtn');
    input.focus();

    async function tryLogin() {
      const val = input.value.toLowerCase().trim();
      if (!val.match(userValid) || val.length < 3 || val.length > 12) {
        input.classList.add('loginInputError');
        input.placeholder = '3–12 chars, letters/numbers/_/-';
        setTimeout(() => input.classList.remove('loginInputError'), 800);
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Checking...';

      if (await isUsernameBanned(val)) {
        input.value = '';
        btn.disabled = false; btn.textContent = 'Join Chat';
        overlay.querySelector('.loginBox').insertAdjacentHTML('beforeend',
          `<p class="loginError" id="dynErr">This username is banned.</p>`);
        return;
      }
      if (val !== admin && await isUsernameTaken(val)) {
        input.value = '';
        btn.disabled = false; btn.textContent = 'Join Chat';
        const existing = document.getElementById('dynErr');
        if (existing) existing.remove();
        overlay.querySelector('.loginBox').insertAdjacentHTML('beforeend',
          `<p class="loginError" id="dynErr">Username already in use. Choose another.</p>`);
        return;
      }

      localStorage.setItem('userName', val);
      overlay.remove();
      finishInit(val);
    }

    btn.onclick = tryLogin;
    input.onkeydown = e => { if (e.key === 'Enter') tryLogin(); };
  }

  async function startLogin() {
    const banned = await checkIfBanned();
    if (banned) return;

    const saved = localStorage.getItem('userName');
    if (saved) {
      if (await isUsernameBanned(saved)) {
        localStorage.removeItem('userName');
        showLoginModal('Your username was banned. Please choose a new one.');
        return;
      }
      if (saved !== admin && await isUsernameTaken(saved)) {
        showLoginModal('Your previous username is taken. Choose a new one.');
        return;
      }
      finishInit(saved);
    } else {
      showLoginModal();
    }
  }

  function finishInit(name) {
    userName = name;
    const isAdmin = (userName === admin);

    usernameEl.innerText = userName;
    document.getElementById('myUsername2').innerHTML = userName;
    img.innerText = userName.charAt(0).toUpperCase();
    getNavColor(userName.charAt(0));

    // Mark presence
    const getDate = new Date();
    const currentTime = getDate.toLocaleString('en-US', { hour:'numeric', minute:'numeric', second:'numeric', hour12:true });
    set(ref(db, 'joinedUsers/' + userName), { time: currentTime, deviceId });

    setTimeout(() => {
      set(ref(db, 'messages/' + new Date().getTime()), {
        user: userName, time: currentTime, join: true
      });
    }, 1000);

    if (isAdmin) setupAdminPanel();
    setupChat();
    buildThemeSwitcher();
    listenForKick();
  }

  // ─── Color helper ──────────────────────────────────────────────────────────
  function colorFromName(name) {
    if (!name) return '#888';
    const code = name.charCodeAt(0);
    const s = code.toString().repeat(3);
    const num = Math.round(0xffffff * parseInt(s));
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgb(${r},${g},${b})`;
  }
  function getNavColor(char) {
    document.getElementById('slash').style.color = colorFromName(char);
  }

  // ─── Listen for kick ───────────────────────────────────────────────────────
  function listenForKick() {
    onValue(ref(db, 'kicks/' + userName), snap => {
      if (snap.exists()) {
        remove(ref(db, 'kicks/' + userName));
        localStorage.removeItem('userName');
        showBanScreen("You have been removed from the chat by the admin.");
      }
    });
  }

  // ─── Admin Panel ────────────────────────────────────────────────────────────
  function setupAdminPanel() {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.style.display = 'flex';

    document.getElementById('adminClearChat').onclick = () => {
      if (confirm('Clear all messages?')) remove(ref(db, 'messages/'));
    };

    document.getElementById('adminShowUsers').onclick = async () => {
      const modal = document.getElementById('adminUsersModal');
      modal.style.display = 'flex';
      await refreshUserList();
    };

    document.getElementById('adminCloseUsers').onclick = () => {
      document.getElementById('adminUsersModal').style.display = 'none';
    };

    document.getElementById('adminMsgForm').onsubmit = e => {
      e.preventDefault();
      const txt = document.getElementById('adminMsgInput').value.trim();
      if (!txt) return;
      const ts = new Date().getTime();
      const time = new Date().toLocaleString('en-US', { hour:'numeric', minute:'numeric', second:'numeric', hour12:true });
      set(ref(db, 'messages/' + ts), {
        user: admin, message: txt, time, date: time, isAdmin: true
      });
      document.getElementById('adminMsgInput').value = '';
    };

    document.getElementById('adminBanInput') && (document.getElementById('adminBanBtn').onclick = async () => {
      const name = document.getElementById('adminBanInput').value.trim().toLowerCase();
      if (!name) return;
      await set(ref(db, 'bans/usernames/' + name), { by: admin, at: Date.now() });
      const snap = await get(ref(db, 'joinedUsers/' + name));
      if (snap.exists() && snap.val().deviceId) {
        await set(ref(db, 'bans/devices/' + snap.val().deviceId), { by: admin, at: Date.now() });
      }
      await remove(ref(db, 'joinedUsers/' + name));
      await set(ref(db, 'kicks/' + name), { by: admin });
      document.getElementById('adminBanInput').value = '';
      showAdminToast(`"${name}" banned.`);
    });
  }

  async function refreshUserList() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = '<p style="color:#888;padding:10px">Loading...</p>';
    const snap = await get(ref(db, 'joinedUsers'));
    list.innerHTML = '';
    if (!snap.exists()) { list.innerHTML = '<p style="color:#888;padding:10px">No users online.</p>'; return; }
    snap.forEach(child => {
      const name = child.key;
      const data = child.val();
      if (name === admin) return;
      const row = document.createElement('div');
      row.className = 'adminUserRow';
      row.innerHTML = `
        <span class="adminUserName">${name}</span>
        <div class="adminUserBtns">
          <button class="adminKickBtn" data-name="${name}">Kick</button>
          <button class="adminBanUserBtn" data-name="${name}" data-device="${data.deviceId || ''}">Ban</button>
        </div>`;
      list.appendChild(row);
    });

    list.querySelectorAll('.adminKickBtn').forEach(btn => {
      btn.onclick = async () => {
        const name = btn.dataset.name;
        await set(ref(db, 'kicks/' + name), { by: admin });
        await remove(ref(db, 'joinedUsers/' + name));
        btn.closest('.adminUserRow').remove();
        showAdminToast(`Kicked "${name}".`);
      };
    });
    list.querySelectorAll('.adminBanUserBtn').forEach(btn => {
      btn.onclick = async () => {
        const name = btn.dataset.name;
        const devId = btn.dataset.device;
        await set(ref(db, 'bans/usernames/' + name), { by: admin, at: Date.now() });
        if (devId) await set(ref(db, 'bans/devices/' + devId), { by: admin, at: Date.now() });
        await remove(ref(db, 'joinedUsers/' + name));
        await set(ref(db, 'kicks/' + name), { by: admin });
        btn.closest('.adminUserRow').remove();
        showAdminToast(`Banned "${name}".`);
      };
    });
  }

  function showAdminToast(msg) {
    const t = document.createElement('div');
    t.className = 'adminToast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ─── Flag System ────────────────────────────────────────────────────────────
  async function flagUser(targetUser) {
    if (targetUser === userName) return;
    if (targetUser === admin) return;
    const flagKey = `flag_${userName}_${targetUser}`;
    const alreadyFlagged = localStorage.getItem(flagKey);
    if (alreadyFlagged) { showAdminToast('You already flagged this user.'); return; }

    const flagRef = ref(db, 'flags/' + targetUser + '/' + userName);
    await set(flagRef, { at: Date.now() });
    localStorage.setItem(flagKey, '1');

    const allFlags = await get(ref(db, 'flags/' + targetUser));
    if (allFlags.exists() && Object.keys(allFlags.val()).length >= 7) {
      const snap = await get(ref(db, 'joinedUsers/' + targetUser));
      if (snap.exists() && snap.val().deviceId) {
        await set(ref(db, 'bans/devices/' + snap.val().deviceId), { by: 'community', at: Date.now() });
      }
      await set(ref(db, 'bans/usernames/' + targetUser), { by: 'community', at: Date.now() });
      await remove(ref(db, 'joinedUsers/' + targetUser));
      await set(ref(db, 'kicks/' + targetUser), { by: 'community' });
      await set(ref(db, 'messages/' + new Date().getTime()), {
        user: 'System', message: `⚠️ "${targetUser}" was removed by the community.`,
        time: new Date().toLocaleString('en-US', { hour:'numeric', minute:'numeric', hour12:true }),
        date: '', isSystem: true
      });
      showAdminToast(`${targetUser} has been community-banned.`);
    } else {
      showAdminToast(`Flagged "${targetUser}". ${7 - Object.keys(allFlags.val()).length} more flags needed.`);
    }
  }

  // ─── Chat Logic ──────────────────────────────────────────────────────────────
  function setupChat() {
    const userData = document.getElementById("messageSec");
    const typerStatus = document.getElementById('typerStatus');
    const connectionStatus = document.getElementById('connectionStatus');
    const typer = document.getElementById('typer');
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const nameRegex = /(@[^\s]+)/g;
    let timer, timeoutVal = 800;

    module.sendMsg = function () {
      const msg = userMessage.innerText.trim();
      if (!msg.length) { userMessage.focus(); userMessage.innerText = ''; return; }
      const ts = new Date().getTime();
      const time = new Date().toLocaleString('en-US', { hour:'numeric', minute:'numeric', second:'numeric', hour12:true });

      // Admin special commands (still supported)
      if (userName === admin) {
        if (msg === admin + '@clear') { remove(ref(db, 'messages/')); userMessage.innerText = ''; return; }
      }

      const isAdminMsg = (userName === admin);
      const base = { user: userName, message: msg, time, date: time };
      if (isAdminMsg) base.isAdmin = true;

      const replyPad = document.querySelector('.replyToMsgSecPad');
      if (replyPad) {
        const rMsgBox = document.getElementById("replyToMsgBoxIn");
        const rUser = document.getElementById("replyToUserBoxIn").innerHTML.trim();
        set(ref(db, 'messages/' + ts), { ...base, key: rMsgBox.getAttribute('key'), replyToUser: rUser, replyToMsg: rMsgBox.innerText.trim(), reply: true })
          .then(() => { sent.play(); document.getElementById("replyToMsgSec").innerHTML = ''; });
      } else {
        set(ref(db, 'messages/' + ts), base).then(() => sent.play());
      }
      userMessage.focus();
      userMessage.innerText = '';
    };

    onChildAdded(ref(db, 'messages'), (snapshot) => {
      const loader = document.getElementById("loader");
      if (loader) loader.remove();
      setTimeout(() => userMessage.focus(), 500);

      const val = snapshot.val();

      if (val.join) {
        const isMe = val.user === userName;
        userData.innerHTML += `<div class="joinedSec" id="${snapshot.key}join">
          <div class="joined">
            <span class="joining">
              <span class="joinedPerson ${isMe ? '' : ''}">${isMe ? 'You' : val.user}</span>
              joined the Chat <span class="joinedTime">${val.time}</span>
            </span>
          </div>
        </div>`;
        setTimeout(() => remove(ref(db, 'messages/' + snapshot.key)), 10000);
        userData.scrollTop = userData.scrollHeight;
        return;
      }

      if (val.typer) {
        typerStatus.innerHTML = val.user === userName
          ? `<span class="typerName">Typing...</span>`
          : `<span class="typerName" id="${snapshot.key}name">${val.user}</span> is typing...`;
        return;
      }

      const isMe = val.user === userName;
      const isAdminMsg = val.isAdmin;
      const isSystemMsg = val.isSystem;
      const isAdminUser = (val.user === admin);

      if (isSystemMsg) {
        userData.innerHTML += `<div class="systemMsgWrap">
          <div class="systemMsg">${val.message}</div>
        </div>`;
        userData.scrollTop = userData.scrollHeight;
        return;
      }

      if (isMe) {
        userData.innerHTML += `
          <div id="${snapshot.key}outerSkin" class="outerSkin myOuterSkin${isAdminMsg ? ' adminOuterSkin' : ''}" ondblclick="module.replyTo(${snapshot.key})">
            <div class="msgContainer myMsgContainer" id="${snapshot.key}msgContainer">
              <div class="funcBtns" id="${snapshot.key}funcBtns">
                <button id="${snapshot.key}selectBtn" class="selectMsgBox" onclick="module.selectMsg(${snapshot.key})">
                  <svg width="11px" height="11px" viewBox="0 0 24 24" fill="none" stroke="#fff"><path d="M16.584 6C15.8124 4.2341 14.0503 3 12 3C9.23858 3 7 5.23858 7 8V10.0288M12 14.5V16.5M7 10.0288C7.47142 10 8.05259 10 8.8 10H15.2C16.8802 10 17.7202 10 18.362 10.327C18.9265 10.6146 19.3854 11.0735 19.673 11.638C20 12.2798 20 13.1198 20 14.8V16.2C20 17.8802 20 18.7202 19.673 19.362C19.3854 19.9265 18.9265 20.3854 18.362 20.673C17.7202 21 16.8802 21 15.2 21H8.8C7.11984 21 6.27976 21 5.63803 20.673C5.07354 20.3854 4.6146 19.9265 4.32698 19.362C4 18.7202 4 17.8802 4 16.2V14.8C4 13.1198 4 12.2798 4.32698 11.638C4.6146 11.0735 5.07354 10.6146 5.63803 10.327C5.99429 10.1455 6.41168 10.0647 7 10.0288Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button id="${snapshot.key}delBtn" class="deleteMsg" onclick="module.delMsg(${snapshot.key})">Del</button>
              </div>
              <div id="${snapshot.key}mainMsgSec" class="mainMsgSec myMainMsgSec${isAdminMsg ? ' adminMsgBubble' : ''}">
                <div class="replyToMsgSec" id="${snapshot.key}replyToMsgSec"></div>
                ${isAdminMsg ? '<div class="adminMsgBadge"><span class="adminBadgeIcon">⭐</span>Admin</div>' : ''}
                <div class="msgBox myMsgBox" id="${snapshot.key}msgBox">
                  <span id="${snapshot.key}" class="message myMessage${isAdminMsg ? ' adminMsgText' : ''}">${val.message}</span>
                </div>
                <div class="myDate date">${val.date}</div>
              </div>
            </div>
            <div class="moreDetail" id="${snapshot.key}details">
              <div class="timeBox">
                <span class="time myTime">${val.time}</span>
                <span id="${snapshot.key}name" class="username myUsername">${isAdminMsg ? '👑 You (Admin)' : 'You'}</span>
              </div>
            </div>
          </div>`;
      } else {
        const canDelete = (userName === admin);
        const profileInitial = val.user.charAt(0).toUpperCase();

        userData.innerHTML += `
          <div id="${snapshot.key}outerSkin" class="outerSkin yourOuterSkin${isAdminMsg ? ' adminOuterSkin' : ''}" ondblclick="module.replyTo(${snapshot.key})">
            <div class="msgContainer yourMsgContainer" id="${snapshot.key}msgContainer">
              <div id="${snapshot.key}profilePic" class="profilePic yourProfilePic${isAdminMsg ? ' adminProfilePic' : ''}">${profileInitial}</div>
              <div class="mainMsgSec yourMainMsgSec${isAdminMsg ? ' adminMsgBubble' : ''}">
                <div class="replyToMsgSec" id="${snapshot.key}replyToMsgSec"></div>
                ${isAdminMsg ? '<div class="adminMsgBadge"><span class="adminBadgeIcon">⭐</span>Admin Announcement</div>' : ''}
                <div class="msgBox yourMsgBox" id="${snapshot.key}msgBox">
                  <span id="${snapshot.key}" class="message yourMessage${isAdminMsg ? ' adminMsgText' : ''}">${val.message}</span>
                </div>
                <div class="yourDate date">${val.date}</div>
              </div>
              <div class="funcBtns" id="${snapshot.key}funcBtns">
                ${canDelete ? `<button id="${snapshot.key}delBtn" class="deleteMsg" onclick="module.delMsg(${snapshot.key})">Del</button>` : ''}
                <button class="flagBtn" onclick="module.flagUser('${val.user}')" title="Flag user">🚩</button>
              </div>
            </div>
            <div class="moreDetail" id="${snapshot.key}details">
              <div class="timeBox">
                <span id="${snapshot.key}name" class="username yourUsername${isAdminMsg ? ' adminUsername' : ''}">${isAdminMsg ? '👑 ' + val.user : val.user}</span>
                <span class="time yourTime">${val.time}</span>
              </div>
            </div>
          </div>`;

        // Set profile pic color
        const profilePic = document.getElementById(snapshot.key + 'profilePic');
        const nameEl = document.getElementById(snapshot.key + 'name');
        if (!isAdminMsg) {
          const c = colorFromName(val.user.charAt(0));
          if (profilePic) profilePic.style.backgroundColor = c;
          if (nameEl) nameEl.style.color = c;
        }
        received.play();
      }

      // Reply rendering
      if (val.reply) {
        let xName = val.replyToUser === userName ? 'You' : val.replyToUser;
        const replyHTML = (isMine) => `
          <div class="replyToMsgSecIn ${isMine ? 'replyToMsgSecInMy' : 'replyToMsgSecInYour'}">
            <div id="${snapshot.key}replyToMsgSecInner" class="replyToMsgSecInner ${isMine ? 'replyToMsgSecInnerMy' : 'replyToMsgSecInnerYour'}"
              onclick="window.location.href='#${val.key}outerSkin';document.getElementById('${val.key}outerSkin').classList.add('highlighted');setTimeout(()=>document.getElementById('${val.key}outerSkin').classList.remove('highlighted'),5000)">
              <div class="replyToUserBox ${isMine ? 'replyToUserBoxMy' : 'replyToUserBoxYour'}">
                <span class="replyToUserBoxIn" id="${snapshot.key}replyToUserBoxIn">${xName}</span>
              </div>
              <div class="replyToMsgBox ${isMine ? 'replyToMsgBoxMy' : 'replyToMsgBoxYour'}">
                <span class="replyToMsgBoxIn">${val.replyToMsg}</span>
              </div>
            </div>
          </div>`;
        const sec = document.getElementById(snapshot.key + 'replyToMsgSec');
        if (sec) sec.innerHTML = replyHTML(isMe);

        const rUser = document.getElementById(snapshot.key + 'replyToUserBoxIn');
        const rInner = document.getElementById(snapshot.key + 'replyToMsgSecInner');
        if (rUser && rInner) {
          const c = colorFromName(val.replyToUser.charAt(0));
          rUser.style.color = c;
          rInner.style.borderColor = c;
        }
      }

      // Inline formatting
      const msgEl = document.getElementById(snapshot.key);
      if (msgEl) {
        let html = val.message;
        if (val.message.match(nameRegex)) html = html.replace(nameRegex, n => `<i class="foundUsername">${n}</i>`);
        if (val.message.match(urlRegex)) html = html.replace(urlRegex, u => `<a class="foundLink" href="${u}" target="_blank">${u}</a>`);
        msgEl.innerHTML = html;
        if (val.message.length <= 1) msgEl.classList.add('singleItem');
        if (/\p{Extended_Pictographic}/u.test(val.message) && val.message.length <= 2) msgEl.classList.add('imojiMsg');
      }

      userData.scrollTop = userData.scrollHeight;
      connectionStatus.innerText = 'Connected';
    });

    onChildRemoved(ref(db, 'messages'), (snapshot) => {
      const msgEl = document.getElementById(snapshot.key);
      const noIconSvg = `<svg class="noIcon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><g transform="translate(1.41 1.41) scale(2.81 2.81)"><path d="M45 90c-12.02 0-23.32-4.681-31.82-13.181C4.681 68.32 0 57.02 0 45c0-12.02 4.681-23.32 13.18-31.82C21.68 4.681 32.98 0 45 0c12.02 0 23.32 4.681 31.819 13.18C85.319 21.68 90 32.98 90 45c0 12.02-4.681 23.32-13.181 31.819C68.32 85.319 57.02 90 45 90zM45 8c-9.883 0-19.174 3.849-26.163 10.837C11.849 25.826 8 35.117 8 45c0 9.883 3.849 19.174 10.837 26.163C25.826 78.151 35.117 82 45 82c9.883 0 19.174-3.849 26.163-10.837C78.151 64.174 82 54.883 82 45c0-9.883-3.849-19.174-10.837-26.163C64.174 11.849 54.883 8 45 8z" class="noIconColor"/><rect x="4" y="41" rx="0" ry="0" width="82" height="8" class="noIconColor" transform="matrix(0.707 -0.7072 0.7072 0.707 -18.6396 45.0055)"/></g></svg>`;

      if (msgEl) {
        msgEl.innerHTML = snapshot.val().user === userName
          ? `<i class="deletedMsg myDeletedMsg">${noIconSvg}You deleted this message</i>`
          : `<i class="deletedMsg yourDeletedMsg">${noIconSvg}This message was deleted</i>`;
        const fb = document.getElementById(snapshot.key + 'funcBtns');
        const rb = document.getElementById(snapshot.key + 'replyToMsgSec');
        if (fb) fb.remove();
        if (rb) rb.remove();
      }
      if (snapshot.val().typer) {
        typerStatus.innerHTML = `<span class="typerName">All</span> done typing!`;
      }
    });

    // Typing indicator
    typer.onkeydown = () => {
      clearTimeout(timer);
      set(ref(db, 'messages/typings'), { typer: true, user: userName });
    };
    typer.onkeyup = () => {
      clearTimeout(timer);
      timer = setTimeout(() => remove(ref(db, 'messages/typings')), timeoutVal);
    };

    // Cleanup on leave
    window.addEventListener('beforeunload', () => {
      remove(ref(db, 'joinedUsers/' + userName));
    });
  }

  module.delMsg = key => remove(ref(db, 'messages/' + key));
  module.selectMsg = key => document.getElementById(key + 'outerSkin').classList.toggle('outerSkinSelected');
  module.flagUser = flagUser;
  module.replyTo = function(key) {
    userMessage.focus();
    const nameEl = document.getElementById(key + 'name');
    if (!nameEl) return;
    let replyToUser = nameEl.innerHTML.replace('👑 ', '').split(' ')[0].trim();
    if (replyToUser === 'You' || replyToUser === 'You (Admin)') replyToUser = userName;
    const replyToMsg = document.getElementById(key).innerHTML.trim();
    const replyToMsgSec = document.getElementById("replyToMsgSec");
    replyToMsgSec.innerHTML = `
      <div class="replyToMsgSecPad">
        <div class="replyToMsgSecIn">
          <button class="closeReplying" type="button" onclick="document.getElementById('replyToMsgSec').innerHTML=''">×</button>
          <div class="replyToMsgSecInner" onclick="window.location.href='#${key}outerSkin';document.getElementById('${key}outerSkin').classList.add('highlighted');setTimeout(()=>document.getElementById('${key}outerSkin').classList.remove('highlighted'),5000)">
            <div class="replyToUserBox"><span class="replyToUserBoxIn" id="replyToUserBoxIn">${replyToUser}</span></div>
            <div class="replyToMsgBox"><span class="replyToMsgBoxIn" id="replyToMsgBoxIn" key="${key}">${replyToMsg}</span></div>
          </div>
        </div>
      </div>`;
  };

  startLogin();
}

retrieveData();
