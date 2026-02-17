import * as API from './api/index.js';

let currentUser = null;
let replyContext = null;
let replyToMessage = null;
let chatsUnsubscribe = null;

export async function initApp() {
  const ip = await getUserIP();
  currentUser = await API.getUserByIP(ip);
  renderApp();
}

async function getUserIP() {
  let ip = localStorage.getItem('satriamail_ip');
  if (!ip) {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ip = data.ip;
    } catch {
      ip = 'ip_' + Math.random().toString(36).substring(2, 10);
    }
    localStorage.setItem('satriamail_ip', ip);
  }
  return ip;
}

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

async function unreadCount() {
  if (!currentUser) return 0;
  const messages = await API.getMessagesForUser(currentUser.email);
  return messages.filter(m => !m.read).length;
}

async function renderApp() {
  const root = document.getElementById('app');
  if (!currentUser) {
    root.innerHTML = renderLanding();
    attachLandingEvents();
  } else {
    root.innerHTML = await renderHome();
    await attachHomeEvents();
    openTab('home');
  }
}

function renderLanding() {
  return `
    <div class="top-bar">
      <div class="app-name">Satriamail</div>
    </div>
    <div class="tab-view active">
      <div class="hero-card">
        <div class="icon-glow"><i class="fas fa-envelope-open-text"></i></div>
        <h2>Daftar dengan nama</h2>
        <p>kamu akan mendapatkan alamat ✦ <strong>nama@satria.dev</strong></p>
      </div>
      <div class="email-action-area" style="margin-top:-10px;">
        <label>Nama kamu</label>
        <input type="text" id="usernameInput" class="compose-input" placeholder="cth: Ilham" style="margin-bottom:12px;">
        <label>Foto profile (opsional - upload)</label>
        <input type="file" id="avatarUpload" accept="image/*" class="compose-input" style="padding:10px;">
        <label>Bio (opsional)</label>
        <textarea id="bioInput" class="public-textarea" rows="2" placeholder="tulis bio singkat..."></textarea>
        <button id="createAccountBtn" class="send-btn" style="width:100%; margin-top:16px;"><i class="fas fa-arrow-right"></i> Lanjut</button>
      </div>
    </div>
  `;
}

function attachLandingEvents() {
  const btn = document.getElementById('createAccountBtn');
  const inp = document.getElementById('usernameInput');
  const fileInput = document.getElementById('avatarUpload');
  const bioInp = document.getElementById('bioInput');
  
  btn.addEventListener('click', async () => {
    const name = inp.value.trim();
    if (!name || !/^[a-zA-Z0-9]+$/.test(name)) {
      alert('hanya huruf/angka tanpa spasi');
      return;
    }
    
    const ip = await getUserIP();
    const email = name + '@satria.dev';
    
    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        const avatarData = e.target.result;
        const newUser = {
          name, email, ip,
          avatar: avatarData,
          bio: bioInp.value.trim() || 'Halo, saya pengguna Satriamail',
          createdAt: Date.now()
        };
        
        const savedUser = await API.saveUser(newUser);
        currentUser = savedUser;
        renderApp();
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      const newUser = {
        name, email, ip,
        avatar: `https://ui-avatars.com/api/?name=${name}&background=111&color=fff`,
        bio: bioInp.value.trim() || 'Halo, saya pengguna Satriamail',
        createdAt: Date.now()
      };
      
      const savedUser = await API.saveUser(newUser);
      currentUser = savedUser;
      renderApp();
    }
  });
}

async function renderHome() {
  const unread = await unreadCount();
  return `
    <div class="top-bar">
      <div class="app-name">Satriamail</div>
    </div>

    <div id="homeTab" class="tab-view active">
      <div class="profile-card" id="profileAvatar">
        <div class="profile-card-avatar">
          <img src="${currentUser.avatar}" alt="">
        </div>
        <div class="profile-card-info">
          <h3>${currentUser.name}</h3>
          <p>${currentUser.bio || ''}</p>
        </div>
      </div>
      <div class="email-action-area">
        <label>Email mu</label>
        <div class="email-display">
          <span id="userEmail">${currentUser.email}</span>
          <button class="copy-btn" id="copyEmailBtn"><i class="far fa-copy"></i></button>
        </div>
      </div>
    </div>

    <div id="inboxTab" class="tab-view">
      <div class="section-header">
        <h2>Inbox <span class="badge" id="unreadBadge" style="${unread ? '' : 'display:none;'}">${unread}</span></h2>
        <button class="trash-btn" id="clearInboxBtn"><i class="fas fa-trash"></i></button>
      </div>
      <div id="inboxList" class="message-list"></div>
      <div id="emptyInbox" class="empty-placeholder"><i class="fas fa-inbox"></i> belum ada pesan</div>
    </div>

    <div id="publicTab" class="tab-view">
      <div class="section-header"><h2>Public chat</h2></div>
      <div id="publicList" class="public-chat-container"></div>
      <div id="replyContextBadge" class="reply-context-badge" style="display:none;">
        <i class="fas fa-reply"></i> Membalas ke <span id="replyToName"></span>: <span id="replyToText"></span>
        <span style="margin-left:auto; cursor:pointer;" id="cancelReply"><i class="fas fa-times"></i></span>
      </div>
      <textarea id="publicInput" class="public-textarea" placeholder="Tulis pesan publik..." rows="2"></textarea>
      <button id="sendPublicBtn" class="btn-secondary-full"><i class="fas fa-paper-plane"></i> Kirim ke publik</button>
    </div>

    <div id="composeTab" class="tab-view">
      <div class="section-header"><h2>Kirim pesan</h2></div>
      <div class="email-action-area">
        <label>Nama tujuan</label>
        <input type="text" id="targetName" class="compose-input" placeholder="contoh: ilham">
        <label>Pesan</label>
        <textarea id="messageText" class="public-textarea" rows="4" placeholder="tulis pesan..."></textarea>
        <button id="sendMsgBtn" class="btn-secondary-full"><i class="fas fa-paper-plane"></i> Kirim pesan</button>
      </div>
    </div>

    <div class="bottom-nav">
      <div class="nav-item active" data-tab="home"><i class="fas fa-home"></i><span>Home</span></div>
      <div class="nav-item" data-tab="inbox"><div class="icon-wrapper"><i class="fas fa-inbox"></i>${unread ? '<span class="nav-dot"></span>' : ''}</div><span>Inbox</span></div>
      <div class="nav-fab" data-tab="compose"><i class="fas fa-feather-alt"></i><span>Send</span></div>
      <div class="nav-item" data-tab="public"><i class="fas fa-globe"></i><span>Public</span></div>
    </div>

    <div id="profileModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Pengaturan Profile</h3>
          <button class="close-btn" id="closeProfileModal"><i class="fas fa-times"></i></button>
        </div>
        <div class="profile-settings">
          <div class="settings-avatar">
            <img src="${currentUser.avatar}" id="settingsAvatarImg">
          </div>
          <div class="settings-input">
            <label>Foto profile (upload)</label>
            <input type="file" id="settingsAvatarUpload" accept="image/*">
          </div>
          <div class="settings-input">
            <label>Nama</label>
            <input type="text" id="settingsName" value="${currentUser.name}" disabled>
          </div>
          <div class="settings-input">
            <label>Bio</label>
            <textarea id="settingsBio" rows="3">${currentUser.bio || ''}</textarea>
          </div>
          <button id="saveProfileBtn" class="send-btn" style="width:100%;"><i class="fas fa-save"></i> Simpan</button>
          <button id="deleteAccountBtn" class="delete-btn"><i class="fas fa-trash"></i> Hapus Akun</button>
        </div>
      </div>
    </div>

    <div id="userProfileModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Profile Pengguna</h3>
          <button class="close-btn" id="closeUserProfile"><i class="fas fa-times"></i></button>
        </div>
        <div class="profile-settings">
          <div class="settings-avatar" id="viewAvatar">
            <img src="" id="viewAvatarImg">
          </div>
          <div class="settings-input">
            <label>Nama</label>
            <input type="text" id="viewName" disabled>
          </div>
          <div class="settings-input">
            <label>Email</label>
            <input type="text" id="viewEmail" disabled>
          </div>
          <div class="settings-input">
            <label>Bio</label>
            <textarea id="viewBio" rows="3" disabled></textarea>
          </div>
        </div>
      </div>
    </div>

    <div id="messageModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <button class="close-btn" id="closeMsgModal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-meta" id="modalMeta">
          <div class="meta-avatar" id="modalAvatar"><img src="" id="modalAvatarImg"></div>
          <div class="meta-info">
            <span class="meta-from" id="modalFrom"></span>
            <span class="meta-time" id="modalTime"></span>
          </div>
        </div>
        <div class="modal-body" id="modalBody"></div>
        <div class="modal-actions">
          <button class="reply-modal-btn" id="modalReplyBtn"><i class="fas fa-reply"></i> Balas</button>
        </div>
      </div>
    </div>
  `;
}

async function attachHomeEvents() {
  document.querySelectorAll('.nav-item, .nav-fab').forEach(el => {
    el.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.tab;
      if (tab) openTab(tab);
    });
  });

  document.getElementById('copyEmailBtn')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(currentUser.email).then(() => showToast('Email disalin'));
  });

  document.getElementById('clearInboxBtn')?.addEventListener('click', async () => {
    if (confirm('Hapus semua pesan masuk?')) {
      await API.deleteAllMessagesForUser(currentUser.email);
      await renderInbox();
      await updateUnreadBadge();
    }
  });

  document.getElementById('sendMsgBtn')?.addEventListener('click', async () => {
    const targetName = document.getElementById('targetName').value.trim();
    const text = document.getElementById('messageText').value.trim();
    if (!targetName || !text) return alert('isi semua');
    
    const targetEmail = targetName + '@satria.dev';
    await API.saveMessage({
      from: currentUser.email,
      to: targetEmail,
      text: text,
      timestamp: Date.now(),
      read: false
    });
    
    alert('pesan terkirim');
    document.getElementById('messageText').value = '';
    document.getElementById('targetName').value = '';
  });

  document.getElementById('sendPublicBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('publicInput');
    const txt = input.value.trim();
    if (!txt) return;
    
    await API.saveChat({
      from: currentUser.email,
      senderName: currentUser.name,
      text: txt,
      replyTo: replyContext ? { 
        id: replyContext.id, 
        text: replyContext.text, 
        from: replyContext.from, 
        name: replyContext.senderName 
      } : null,
      timestamp: Date.now()
    });
    
    input.value = '';
    replyContext = null;
    document.getElementById('replyContextBadge').style.display = 'none';
    await renderPublicChat();
  });

  document.getElementById('cancelReply')?.addEventListener('click', () => {
    replyContext = null;
    document.getElementById('replyContextBadge').style.display = 'none';
  });

  const closeMsgModal = document.getElementById('closeMsgModal');
  if (closeMsgModal) {
    closeMsgModal.addEventListener('click', () => {
      document.getElementById('messageModal').classList.remove('show');
    });
  }

  document.getElementById('closeProfileModal')?.addEventListener('click', () => {
    document.getElementById('profileModal').classList.remove('show');
  });

  document.getElementById('closeUserProfile')?.addEventListener('click', () => {
    document.getElementById('userProfileModal').classList.remove('show');
  });

  document.getElementById('profileAvatar')?.addEventListener('click', () => {
    document.getElementById('profileModal').classList.add('show');
  });

  document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('settingsAvatarUpload');
    const newBio = document.getElementById('settingsBio').value.trim();
    
    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        const avatarUrl = await API.uploadAvatar(e.target.result, currentUser.id);
        await API.updateUser(currentUser.id, { 
          avatar: avatarUrl,
          bio: newBio 
        });
        currentUser.avatar = avatarUrl;
        currentUser.bio = newBio;
        showToast('Profile diperbarui');
        document.getElementById('profileModal').classList.remove('show');
        renderApp();
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      await API.updateUser(currentUser.id, { bio: newBio });
      currentUser.bio = newBio;
      showToast('Profile diperbarui');
      document.getElementById('profileModal').classList.remove('show');
      renderApp();
    }
  });

  document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
    if (confirm('Yakin ingin menghapus akun? Semua data akan hilang.')) {
      await API.deleteUserAccount(currentUser.id, currentUser.email);
      currentUser = null;
      localStorage.removeItem('satriamail_ip');
      renderApp();
    }
  });

  document.getElementById('modalReplyBtn')?.addEventListener('click', () => {
    if (replyToMessage) {
      openTab('compose');
      document.getElementById('targetName').value = replyToMessage.from.split('@')[0];
      document.getElementById('messageText').focus();
      document.getElementById('messageModal').classList.remove('show');
      showToast('Membalas ke ' + replyToMessage.from);
    }
  });

  window.openMessageModal = async function(msg) {
    replyToMessage = msg;
    await API.markMessageAsRead(msg.id);
    
    document.getElementById('modalFrom').innerText = msg.from;
    document.getElementById('modalTime').innerText = new Date(msg.timestamp).toLocaleString();
    document.getElementById('modalBody').innerText = msg.text;
    
    const user = await API.getUserByIP(''); 
    document.getElementById('modalAvatarImg').src = user?.avatar || `https://ui-avatars.com/api/?name=${msg.from.charAt(0)}&background=111&color=fff`;
    document.getElementById('messageModal').classList.add('show');
    await updateUnreadBadge();
    await renderInbox();
  };

  window.viewUserProfile = function(email) {
    const user = appData.users.find(u => u.email === email);
    if (user) {
      document.getElementById('viewAvatarImg').src = user.avatar;
      document.getElementById('viewName').value = user.name;
      document.getElementById('viewEmail').value = user.email;
      document.getElementById('viewBio').value = user.bio || '';
      document.getElementById('userProfileModal').classList.add('show');
    }
  };

  await renderInbox();
  await renderPublicChat();
  await updateUnreadBadge();
  
  if (chatsUnsubscribe) chatsUnsubscribe();
  chatsUnsubscribe = API.subscribeToChats(async (chats) => {
    await renderPublicChat(chats);
  });
}

async function openTab(tabId) {
  document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId + 'Tab').classList.add('active');
  document.querySelectorAll('.nav-item, .nav-fab').forEach(i => i.classList.remove('active'));
  const activeNav = Array.from(document.querySelectorAll('.nav-item, .nav-fab')).find(n => n.dataset.tab === tabId);
  if (activeNav) activeNav.classList.add('active');
  
  if (tabId === 'inbox') {
    await renderInbox();
    await updateUnreadBadge();
  }
  if (tabId === 'public') await renderPublicChat();
  
  window.history.pushState({}, '', `/${tabId}`);
}

async function updateUnreadBadge() {
  const count = await unreadCount();
  const badge = document.getElementById('unreadBadge');
  const navDot = document.querySelector('.nav-item .icon-wrapper .nav-dot');
  
  if (badge) {
    if (count > 0) {
      badge.style.display = 'inline-block';
      badge.innerText = count;
    } else {
      badge.style.display = 'none';
    }
  }
  
  if (navDot) {
    if (count > 0) navDot.style.display = 'block';
    else navDot.style.display = 'none';
  }
}

async function renderInbox() {
  const container = document.getElementById('inboxList');
  const empty = document.getElementById('emptyInbox');
  if (!container) return;
  
  const messages = await API.getMessagesForUser(currentUser.email);
  
  if (messages.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  container.innerHTML = messages.map(m => {
    return `
    <div class="message-card ${m.read ? 'read' : 'unread'}" data-msg='${JSON.stringify(m).replace(/'/g, '&apos;')}'>
      <div class="msg-content">
        <div class="msg-header"><span class="msg-from">${m.from}</span><span class="msg-time">${new Date(m.timestamp).toLocaleTimeString()}</span></div>
        <div class="msg-subject">✉️ pesan</div>
        <div class="msg-snippet">${m.text.substring(0,60)}${m.text.length>60?'...':''}</div>
      </div>
    </div>`;
  }).join('');
  
  document.querySelectorAll('.message-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const msgData = card.dataset.msg;
      if (msgData) {
        try {
          const msg = JSON.parse(msgData.replace(/&apos;/g, "'"));
          window.openMessageModal(msg);
        } catch (err) {}
      }
    });
  });
}

async function renderPublicChat(chatsData) {
  const container = document.getElementById('publicList');
  if (!container) return;
  
  const chats = chatsData || await API.getChats();
  
  if (chats.length === 0) {
    container.innerHTML = '<div class="empty-placeholder"><i class="fas fa-comments"></i> belum ada obrolan</div>';
    return;
  }
  
  container.innerHTML = chats.map(c => {
    const user = { name: c.senderName, avatar: null };
    return `
    <div class="public-message">
      <div class="public-header" onclick="viewUserProfile('${c.from}')">
        <div class="public-avatar"><img src="${user.avatar || `https://ui-avatars.com/api/?name=${user.name.charAt(0)}&background=111&color=fff`}"></div>
        <span class="public-name">${user.name}</span>
        <span class="public-time">${new Date(c.timestamp).toLocaleTimeString()}</span>
      </div>
      ${c.replyTo ? `<div class="reply-indicator"><i class="fas fa-reply"></i> <span class="reply-to">${c.replyTo.name || c.replyTo.from}</span>: ${c.replyTo.text.substring(0,50)}</div>` : ''}
      <div class="public-text">${c.text}</div>
      <div class="public-reply-trigger" data-chatid="${c.id}"><i class="fas fa-comment-dots"></i> Balas</div>
    </div>`;
  }).join('');
  
  document.querySelectorAll('.public-reply-trigger').forEach(el => {
    el.addEventListener('click', (e) => {
      const chatId = e.currentTarget.dataset.chatid;
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        replyContext = chat;
        document.getElementById('replyToName').innerText = chat.senderName || chat.from;
        document.getElementById('replyToText').innerText = chat.text.substring(0,30);
        document.getElementById('replyContextBadge').style.display = 'flex';
        document.getElementById('publicInput').focus();
      }
    });
  });
}

async function handleRouting() {
  const path = window.location.pathname;
  
  if (path === '/satria' || path.startsWith('/satria/')) {
    const root = document.getElementById('app');
    const targetEmail = path.replace('/satria/', '') || '';
    root.innerHTML = renderSatriaPage(targetEmail);
    attachSatriaEvents(targetEmail);
  } else if (currentUser) {
    const tab = path.replace('/', '') || 'home';
    if (['home', 'inbox', 'public', 'compose'].includes(tab)) {
      openTab(tab);
    }
  }
}

function renderSatriaPage(targetEmail = '') {
  return `
    <div class="top-bar">
      <div class="app-name">Satriamail</div>
    </div>
    <div class="tab-view active">
      <div class="hero-card">
        <div class="icon-glow"><i class="fas fa-paper-plane"></i></div>
        <h2>Kirim pesan ke ${targetEmail || 'tujuan'}</h2>
        <p>isi formulir di bawah untuk mengirim pesan</p>
      </div>
      <div class="email-action-area" style="margin-top:-10px;">
        <label>Dari (nama kamu)</label>
        <input type="text" id="satriaFromName" class="compose-input" placeholder="cth: Budi" style="margin-bottom:12px;">
        <label>Email tujuan</label>
        <input type="text" id="satriaTargetEmail" class="compose-input" value="${targetEmail}" placeholder="nama@satria.dev" style="margin-bottom:12px;">
        <label>Pesan</label>
        <textarea id="satriaMessage" class="public-textarea" rows="4" placeholder="tulis pesan..."></textarea>
        <button id="satriaSendBtn" class="send-btn" style="width:100%; margin-top:16px;"><i class="fas fa-paper-plane"></i> Kirim Pesan</button>
        <button id="satriaBackBtn" class="btn-secondary-full" style="margin-top:8px;"><i class="fas fa-arrow-left"></i> Kembali ke Beranda</button>
      </div>
    </div>
  `;
}

function attachSatriaEvents(targetEmail) {
  document.getElementById('satriaSendBtn')?.addEventListener('click', async () => {
    const fromName = document.getElementById('satriaFromName').value.trim();
    const toEmail = document.getElementById('satriaTargetEmail').value.trim();
    const text = document.getElementById('satriaMessage').value.trim();
    
    if (!fromName || !toEmail || !text) {
      alert('Semua field harus diisi');
      return;
    }
    
    if (!toEmail.endsWith('@satria.dev')) {
      alert('Email tujuan harus berakhiran @satria.dev');
      return;
    }
    
    const fromEmail = fromName + '@anonymous.satria';
    
    await API.saveMessage({
      from: fromEmail,
      to: toEmail,
      text: `[Anonymous ${fromName}]: ${text}`,
      timestamp: Date.now(),
      read: false
    });
    
    alert('Pesan terkirim!');
    document.getElementById('satriaMessage').value = '';
    document.getElementById('satriaFromName').value = '';
  });
  
  document.getElementById('satriaBackBtn')?.addEventListener('click', () => {
    window.location.href = '/';
  });
}

window.addEventListener('popstate', handleRouting);
document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  await handleRouting();
});