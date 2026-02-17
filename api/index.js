import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { 
  getDatabase, ref, set, push, get, query, orderByChild, equalTo, onValue, update, remove 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";
import { 
  getStorage, ref as storageRef, uploadString, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBh59DxELiz-WmP12vgeZF4oLg2cMc67c",
  authDomain: "satriamail-684f1.firebaseapp.com",
  databaseURL: "https://satriamail-684f1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "satriamail-684f1",
  storageBucket: "satriamail-684f1.firebasestorage.app",
  messagingSenderId: "950841103392",
  appId: "1:950841103392:web:ac7c4bbb18da2063c39845"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

const ACCESS_KEY = "Satriadevs";
const encoder = new TextEncoder();

async function hashKey(key) {
  const msgBuffer = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const ACCESS_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

async function encryptData(text, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await hashKey(key);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(hash.slice(0, 32)), { name: 'AES-GCM' }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, keyMaterial, data
  );
  return {
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    data: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

async function decryptData(encryptedObj, key) {
  try {
    const iv = new Uint8Array(encryptedObj.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const data = new Uint8Array(encryptedObj.data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const hash = await hashKey(key);
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(hash.slice(0, 32)), { name: 'AES-GCM' }, false, ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, keyMaterial, data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

async function verifyAccess() {
  try {
    const accessRef = ref(database, '_access');
    const snapshot = await get(accessRef);
    if (!snapshot.exists()) {
      const hash = await hashKey(ACCESS_KEY);
      await set(accessRef, { hash, initialized: true });
      return true;
    }
    const data = snapshot.val();
    return data.hash === ACCESS_HASH;
  } catch {
    return false;
  }
}

async function secureOperation(operation) {
  const isValid = await verifyAccess();
  if (!isValid) throw new Error('Akses ditolak');
  return await operation();
}

export async function saveUser(userData) {
  return await secureOperation(async () => {
    const usersRef = ref(database, 'users');
    const userQuery = query(usersRef, orderByChild('ip'), equalTo(userData.ip));
    const snapshot = await get(userQuery);
    
    if (snapshot.exists()) {
      const existingUser = Object.entries(snapshot.val())[0];
      return { id: existingUser[0], ...existingUser[1] };
    }
    
    const encryptedData = {
      name: await encryptData(userData.name, ACCESS_KEY),
      email: await encryptData(userData.email, ACCESS_KEY),
      ip: await encryptData(userData.ip, ACCESS_KEY),
      avatar: userData.avatar ? await encryptData(userData.avatar, ACCESS_KEY) : null,
      bio: userData.bio ? await encryptData(userData.bio, ACCESS_KEY) : null,
      createdAt: await encryptData(userData.createdAt.toString(), ACCESS_KEY)
    };
    
    const newUserRef = push(usersRef);
    await set(newUserRef, encryptedData);
    
    return { id: newUserRef.key, ...userData };
  });
}

export async function getUserByIP(ip) {
  return await secureOperation(async () => {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      const decryptedIP = await decryptData(data.ip, ACCESS_KEY);
      if (decryptedIP === ip) {
        return {
          id,
          name: await decryptData(data.name, ACCESS_KEY),
          email: await decryptData(data.email, ACCESS_KEY),
          ip: decryptedIP,
          avatar: data.avatar ? await decryptData(data.avatar, ACCESS_KEY) : null,
          bio: data.bio ? await decryptData(data.bio, ACCESS_KEY) : null,
          createdAt: parseInt(await decryptData(data.createdAt, ACCESS_KEY))
        };
      }
    }
    return null;
  });
}

export async function updateUser(userId, updates) {
  return await secureOperation(async () => {
    const userRef = ref(database, `users/${userId}`);
    const encryptedUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        encryptedUpdates[key] = await encryptData(value.toString(), ACCESS_KEY);
      }
    }
    
    await update(userRef, encryptedUpdates);
  });
}

export async function saveMessage(messageData) {
  return await secureOperation(async () => {
    const messagesRef = ref(database, 'messages');
    const encryptedData = {
      from: await encryptData(messageData.from, ACCESS_KEY),
      to: await encryptData(messageData.to, ACCESS_KEY),
      text: await encryptData(messageData.text, ACCESS_KEY),
      timestamp: await encryptData(messageData.timestamp.toString(), ACCESS_KEY),
      read: await encryptData(messageData.read.toString(), ACCESS_KEY)
    };
    
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, encryptedData);
    return newMessageRef.key;
  });
}

export async function getMessagesForUser(email) {
  return await secureOperation(async () => {
    const messagesRef = ref(database, 'messages');
    const snapshot = await get(messagesRef);
    const messages = [];
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      const toEmail = await decryptData(data.to, ACCESS_KEY);
      if (toEmail === email) {
        messages.push({
          id,
          from: await decryptData(data.from, ACCESS_KEY),
          to: toEmail,
          text: await decryptData(data.text, ACCESS_KEY),
          timestamp: parseInt(await decryptData(data.timestamp, ACCESS_KEY)),
          read: await decryptData(data.read, ACCESS_KEY) === 'true'
        });
      }
    }
    
    return messages.sort((a, b) => b.timestamp - a.timestamp);
  });
}

export async function markMessageAsRead(messageId) {
  return await secureOperation(async () => {
    const messageRef = ref(database, `messages/${messageId}`);
    await update(messageRef, {
      read: await encryptData('true', ACCESS_KEY)
    });
  });
}

export async function deleteAllMessagesForUser(email) {
  return await secureOperation(async () => {
    const messagesRef = ref(database, 'messages');
    const snapshot = await get(messagesRef);
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      const toEmail = await decryptData(data.to, ACCESS_KEY);
      if (toEmail === email) {
        await remove(ref(database, `messages/${id}`));
      }
    }
  });
}

export async function saveChat(chatData) {
  return await secureOperation(async () => {
    const chatsRef = ref(database, 'chats');
    const encryptedData = {
      from: await encryptData(chatData.from, ACCESS_KEY),
      senderName: await encryptData(chatData.senderName, ACCESS_KEY),
      text: await encryptData(chatData.text, ACCESS_KEY),
      timestamp: await encryptData(chatData.timestamp.toString(), ACCESS_KEY)
    };
    
    if (chatData.replyTo) {
      encryptedData.replyTo = await encryptData(JSON.stringify({
        id: chatData.replyTo.id,
        text: chatData.replyTo.text,
        from: chatData.replyTo.from,
        name: chatData.replyTo.name
      }), ACCESS_KEY);
    }
    
    const newChatRef = push(chatsRef);
    await set(newChatRef, encryptedData);
    return newChatRef.key;
  });
}

export async function getChats() {
  return await secureOperation(async () => {
    const chatsRef = ref(database, 'chats');
    const snapshot = await get(chatsRef);
    const chats = [];
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      const chat = {
        id,
        from: await decryptData(data.from, ACCESS_KEY),
        senderName: await decryptData(data.senderName, ACCESS_KEY),
        text: await decryptData(data.text, ACCESS_KEY),
        timestamp: parseInt(await decryptData(data.timestamp, ACCESS_KEY))
      };
      
      if (data.replyTo) {
        const replyToStr = await decryptData(data.replyTo, ACCESS_KEY);
        chat.replyTo = JSON.parse(replyToStr);
      }
      
      chats.push(chat);
    }
    
    return chats.sort((a, b) => a.timestamp - b.timestamp);
  });
}

export async function uploadAvatar(base64Data, userId) {
  return await secureOperation(async () => {
    const avatarRef = storageRef(storage, `avatars/${userId}`);
    await uploadString(avatarRef, base64Data, 'data_url');
    return await getDownloadURL(avatarRef);
  });
}

export async function deleteUserAccount(userId, email) {
  return await secureOperation(async () => {
    await remove(ref(database, `users/${userId}`));
    
    const messagesRef = ref(database, 'messages');
    const messagesSnap = await get(messagesRef);
    for (const [id, data] of Object.entries(messagesSnap.val() || {})) {
      const toEmail = await decryptData(data.to, ACCESS_KEY);
      const fromEmail = await decryptData(data.from, ACCESS_KEY);
      if (toEmail === email || fromEmail === email) {
        await remove(ref(database, `messages/${id}`));
      }
    }
    
    const chatsRef = ref(database, 'chats');
    const chatsSnap = await get(chatsRef);
    for (const [id, data] of Object.entries(chatsSnap.val() || {})) {
      const fromEmail = await decryptData(data.from, ACCESS_KEY);
      if (fromEmail === email) {
        await remove(ref(database, `chats/${id}`));
      }
    }
  });
}

export function subscribeToChats(callback) {
  const chatsRef = ref(database, 'chats');
  return onValue(chatsRef, async (snapshot) => {
    const isValid = await verifyAccess();
    if (!isValid) return;
    
    const chats = [];
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      try {
        const chat = {
          id,
          from: await decryptData(data.from, ACCESS_KEY),
          senderName: await decryptData(data.senderName, ACCESS_KEY),
          text: await decryptData(data.text, ACCESS_KEY),
          timestamp: parseInt(await decryptData(data.timestamp, ACCESS_KEY))
        };
        
        if (data.replyTo) {
          const replyToStr = await decryptData(data.replyTo, ACCESS_KEY);
          chat.replyTo = JSON.parse(replyToStr);
        }
        
        chats.push(chat);
      } catch {}
    }
    callback(chats.sort((a, b) => a.timestamp - b.timestamp));
  });
}