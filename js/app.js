import * as API from '/api/index.js';

let currentUser = null;
let replyContext = null;
let replyToMessage = null;

async function initApp() {
    try {
        const ip = await getUserIP();
        currentUser = await API.getUserByIP(ip);
        
        if (currentUser) {
            showHome();
            updateUserInfo();
            loadInbox();
            loadPublicChats();
        } else {
            showLanding();
        }
        
        setupEventListeners();
        handleRouting();
    } catch (error) {
        console.error(error);
        showToast('Error: ' + error.message, true);
    }
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

function showLanding() {
    document.getElementById('landingPage').style.display = 'block';
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('inboxPage').style.display = 'none';
    document.getElementById('publicPage').style.display = 'none';
    document.getElementById('composePage').style.display = 'none';
    document.getElementById('satriaPage').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
}

function showHome() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('inboxPage').style.display = 'none';
    document.getElementById('publicPage').style.display = 'none';
    document.getElementById('composePage').style.display = 'none';
    document.getElementById('satriaPage').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'flex';
}

function showTab(tabId) {
    document.getElementById('homePage').style.display = tabId === 'home' ? 'block' : 'none';
    document.getElementById('inboxPage').style.display = tabId === 'inbox' ? 'block' : 'none';
    document.getElementById('publicPage').style.display = tabId === 'public' ? 'block' : 'none';
    document.getElementById('composePage').style.display = tabId === 'compose' ? 'block' : 'none';
    document.getElementById('satriaPage').style.display = tabId === 'satria' ? 'block' : 'none';
    
    document.querySelectorAll('.nav-item, .nav-fab').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.tab === tabId) {
            el.classList.add('active');
        }
    });
}

function updateUserInfo() {
    if (!currentUser) return;
    
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileBio').textContent = currentUser.bio || '';
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('profileAvatarImg').src = currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}&background=111&color=fff`;
    document.getElementById('settingsName').value = currentUser.name;
    document.getElementById('settingsBio').value = currentUser.bio || '';
    document.getElementById('settingsAvatarImg').src = currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}&background=111&color=fff`;
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item, .nav-fab').forEach(el => {
        el.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            if (tab) {
                showTab(tab);
                window.history.pushState({}, '', `/${tab}`);
                if (tab === 'inbox') loadInbox();
                if (tab === 'public') loadPublicChats();
            }
        });
    });

    document.getElementById('copyEmailBtn')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(currentUser.email).then(() => showToast('Email disalin'));
    });

    document.getElementById('createAccountBtn')?.addEventListener('click', createAccount);
    document.getElementById('sendMsgBtn')?.addEventListener('click', sendMessage);
    document.getElementById('sendPublicBtn')?.addEventListener('click', sendPublicChat);

    document.getElementById('cancelReply')?.addEventListener('click', () => {
        replyContext = null;
        document.getElementById('replyContextBadge').style.display = 'none';
    });

    document.getElementById('clearInboxBtn')?.addEventListener('click', clearInbox);
    document.getElementById('profileAvatar')?.addEventListener('click', () => {
        document.getElementById('profileModal').classList.add('show');
    });

    document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
    document.getElementById('deleteAccountBtn')?.addEventListener('click', deleteAccount);

    document.getElementById('closeProfileModal')?.addEventListener('click', () => {
        document.getElementById('profileModal').classList.remove('show');
    });

    document.getElementById('closeUserProfile')?.addEventListener('click', () => {
        document.getElementById('userProfileModal').classList.remove('show');
    });

    document.getElementById('closeMsgModal')?.addEventListener('click', () => {
        document.getElementById('messageModal').classList.remove('show');
    });

    document.getElementById('modalReplyBtn')?.addEventListener('click', () => {
        if (replyToMessage) {
            showTab('compose');
            document.getElementById('targetName').value = replyToMessage.from.split('@')[0];
            document.getElementById('messageModal').classList.remove('show');
        }
    });

    document.getElementById('satriaSendBtn')?.addEventListener('click', sendSatriaMessage);
    
    document.getElementById('satriaBackBtn')?.addEventListener('click', () => {
        window.location.href = '/';
    });
}

async function createAccount() {
    const name = document.getElementById('usernameInput').value.trim();
    if (!name || !/^[a-zA-Z0-9]+$/.test(name)) {
        alert('hanya huruf/angka tanpa spasi');
        return;
    }

    const ip = await getUserIP();
    const email = name + '@satria.dev';
    const bio = document.getElementById('bioInput').value.trim() || 'Halo, saya pengguna Satriamail';
    
    const fileInput = document.getElementById('avatarUpload');
    let avatar = `https://ui-avatars.com/api/?name=${name}&background=111&color=fff`;

    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            avatar = e.target.result;
            currentUser = await API.saveUser({ name, email, ip, avatar, bio, createdAt: Date.now() });
            updateUserInfo();
            showHome();
            loadInbox();
            loadPublicChats();
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        currentUser = await API.saveUser({ name, email, ip, avatar, bio, createdAt: Date.now() });
        updateUserInfo();
        showHome();
        loadInbox();
        loadPublicChats();
    }
}

async function sendMessage() {
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
    
    showToast('Pesan terkirim');
    document.getElementById('messageText').value = '';
    document.getElementById('targetName').value = '';
}

async function loadInbox() {
    if (!currentUser) return;
    
    const messages = await API.getMessagesForUser(currentUser.email);
    const container = document.getElementById('inboxList');
    const empty = document.getElementById('emptyInbox');
    
    if (messages.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        updateUnreadBadge();
        return;
    }
    
    empty.style.display = 'none';
    container.innerHTML = messages.map(m => `
        <div class="message-card ${m.read ? 'read' : 'unread'}" data-id="${m.id}">
            <div class="msg-content">
                <div class="msg-header">
                    <span class="msg-from">${m.from}</span>
                    <span class="msg-time">${new Date(m.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="msg-subject">✉️ pesan</div>
                <div class="msg-snippet">${m.text.substring(0,60)}${m.text.length>60?'...':''}</div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.message-card').forEach(card => {
        card.addEventListener('click', async () => {
            const id = card.dataset.id;
            const msg = messages.find(m => m.id === id);
            if (msg) {
                replyToMessage = msg;
                await API.markMessageAsRead(id);
                
                document.getElementById('modalFrom').innerText = msg.from;
                document.getElementById('modalTime').innerText = new Date(msg.timestamp).toLocaleString();
                document.getElementById('modalBody').innerText = msg.text;
                document.getElementById('modalAvatarImg').src = `https://ui-avatars.com/api/?name=${msg.from.charAt(0)}&background=111&color=fff`;
                document.getElementById('messageModal').classList.add('show');
                
                loadInbox();
            }
        });
    });

    updateUnreadBadge();
}

async function updateUnreadBadge() {
    if (!currentUser) return;
    
    const messages = await API.getMessagesForUser(currentUser.email);
    const unread = messages.filter(m => !m.read).length;
    const badge = document.getElementById('unreadBadge');
    const navDot = document.querySelector('.nav-dot');
    
    if (unread > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = unread;
        if (navDot) navDot.style.display = 'block';
    } else {
        badge.style.display = 'none';
        if (navDot) navDot.style.display = 'none';
    }
}

async function clearInbox() {
    if (confirm('Hapus semua pesan masuk?')) {
        await API.deleteAllMessagesForUser(currentUser.email);
        await loadInbox();
        showToast('Semua pesan dihapus');
    }
}

async function sendPublicChat() {
    const input = document.getElementById('publicInput');
    const txt = input.value.trim();
    if (!txt) return;
    
    await API.saveChat({
        from: currentUser.email,
        senderName: currentUser.name,
        text: txt,
        replyTo: replyContext,
        timestamp: Date.now()
    });
    
    input.value = '';
    replyContext = null;
    document.getElementById('replyContextBadge').style.display = 'none';
    await loadPublicChats();
}

async function loadPublicChats() {
    const chats = await API.getChats();
    const container = document.getElementById('publicList');
    
    if (chats.length === 0) {
        container.innerHTML = '<div class="empty-placeholder"><i class="fas fa-comments"></i> belum ada obrolan</div>';
        return;
    }
    
    container.innerHTML = chats.map(c => `
        <div class="public-message">
            <div class="public-header">
                <div class="public-avatar"><img src="https://ui-avatars.com/api/?name=${c.senderName.charAt(0)}&background=111&color=fff"></div>
                <span class="public-name">${c.senderName}</span>
                <span class="public-time">${new Date(c.timestamp).toLocaleTimeString()}</span>
            </div>
            ${c.replyTo ? `<div class="reply-indicator"><i class="fas fa-reply"></i> <span class="reply-to">${c.replyTo.name || c.replyTo.from}</span>: ${c.replyTo.text.substring(0,50)}</div>` : ''}
            <div class="public-text">${c.text}</div>
            <div class="public-reply-trigger" data-id="${c.id}"><i class="fas fa-comment-dots"></i> Balas</div>
        </div>
    `).join('');

    document.querySelectorAll('.public-reply-trigger').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const chat = chats.find(c => c.id === id);
            if (chat) {
                replyContext = chat;
                document.getElementById('replyToName').innerText = chat.senderName;
                document.getElementById('replyToText').innerText = chat.text.substring(0,30);
                document.getElementById('replyContextBadge').style.display = 'flex';
                document.getElementById('publicInput').focus();
            }
        });
    });
}

async function saveProfile() {
    const fileInput = document.getElementById('settingsAvatarUpload');
    const newBio = document.getElementById('settingsBio').value.trim();
    
    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const avatarUrl = await API.uploadAvatar(e.target.result, currentUser.id);
            await API.updateUser(currentUser.id, { avatar: avatarUrl, bio: newBio });
            currentUser.avatar = avatarUrl;
            currentUser.bio = newBio;
            updateUserInfo();
            document.getElementById('profileModal').classList.remove('show');
            showToast('Profile diperbarui');
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        await API.updateUser(currentUser.id, { bio: newBio });
        currentUser.bio = newBio;
        updateUserInfo();
        document.getElementById('profileModal').classList.remove('show');
        showToast('Profile diperbarui');
    }
}

async function deleteAccount() {
    if (confirm('Yakin ingin menghapus akun? Semua data akan hilang.')) {
        await API.deleteUserAccount(currentUser.id, currentUser.email);
        currentUser = null;
        localStorage.removeItem('satriamail_ip');
        showLanding();
        showToast('Akun berhasil dihapus');
    }
}

async function sendSatriaMessage() {
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
}

function showToast(msg, isError = false) {
    const toast = document.querySelector('.toast');
    toast.textContent = msg;
    toast.style.background = isError ? '#ef4444' : '#1f2937';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function handleRouting() {
    const path = window.location.pathname;
    
    if (path.startsWith('/satria/')) {
        const targetEmail = path.replace('/satria/', '');
        document.getElementById('satriaTitle').textContent = `Kirim pesan ke ${targetEmail || 'tujuan'}`;
        document.getElementById('satriaTargetEmail').value = targetEmail;
        showTab('satria');
        document.getElementById('bottomNav').style.display = 'none';
    } else if (path === '/satria') {
        showTab('satria');
        document.getElementById('bottomNav').style.display = 'none';
    } else if (currentUser) {
        const tab = path.replace('/', '') || 'home';
        if (['home', 'inbox', 'public', 'compose'].includes(tab)) {
            showTab(tab);
            if (tab === 'inbox') loadInbox();
            if (tab === 'public') loadPublicChats();
        }
        document.getElementById('bottomNav').style.display = 'flex';
    }
}

window.addEventListener('popstate', handleRouting);
document.addEventListener('DOMContentLoaded', initApp);
