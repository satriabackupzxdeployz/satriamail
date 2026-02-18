import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { 
  getDatabase, ref, set, push, get, update, remove 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";
import { 
  getStorage, ref as storageRef, uploadString, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBh59DxELiz-WmP43vgeZF4oLg2cMc67c",
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

// Enkripsi sederhana (XOR + base64)
function encryptData(text) {
  const key = ACCESS_KEY;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function decryptData(encryptedText) {
  try {
    const key = ACCESS_KEY;
    const text = atob(encryptedText);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return null;
  }
}

// Fungsi-fungsi API (tanpa verifikasi akses tambahan agar koneksi lancar)

export async function saveUser(userData) {
  try {
    const usersRef = ref(database, 'users');
    
    // Cek apakah user sudah ada berdasarkan IP
    const snapshot = await get(usersRef);
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      const decryptedIP = decryptData(data.ip);
      if (decryptedIP === userData.ip) {
        return { 
          id, 
          name: decryptData(data.name),
          email: decryptData(data.email),
          ip: decryptedIP,
          avatar: data.avatar ? decryptData(data.avatar) : null,
          bio: data.bio ? decryptData(data.bio) : null,
          createdAt: parseInt(decryptData(data.createdAt))
        };
      }
    }
    
    // Buat user baru
    const encryptedData = {
      name: encryptData(userData.name),
      email: encryptData(userData.email),
      ip: encryptData(userData.ip),
      avatar: userData.avatar ? encryptData(userData.avatar) : null,
      bio: userData.bio ? encryptData(userData.bio) : null,
      createdAt: encryptData(userData.createdAt.toString())
    };
    
    const newUserRef = push(usersRef);
    await set(newUserRef, encryptedData);
    
    return { id: newUserRef.key, ...userData };
  } catch (error) {
    console.error('Save user error:', error);
    throw error;
  }
}

export async function getUserByIP(ip) {
  try {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      const decryptedIP = decryptData(data.ip);
      if (decryptedIP === ip) {
        return {
          id,
          name: decryptData(data.name),
          email: decryptData(data.email),
          ip: decryptedIP,
          avatar: data.avatar ? decryptData(data.avatar) : null,
          bio: data.bio ? decryptData(data.bio) : null,
          createdAt: parseInt(decryptData(data.createdAt))
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

export async function updateUser(userId, updates) {
  try {
    const userRef = ref(database, `users/${userId}`);
    const encryptedUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        encryptedUpdates[key] = encryptData(value.toString());
      }
    }
    
    await update(userRef, encryptedUpdates);
    return true;
  } catch (error) {
    console.error('Update user error:', error);
    throw error;
  }
}

export async function saveMessage(messageData) {
  try {
    const messagesRef = ref(database, 'messages');
    const encryptedData = {
      from: encryptData(messageData.from),
      to: encryptData(messageData.to),
      text: encryptData(messageData.text),
      timestamp: encryptData(messageData.timestamp.toString()),
      read: encryptData(messageData.read.toString())
    };
    
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, encryptedData);
    return newMessageRef.key;
  } catch (error) {
    console.error('Save message error:', error);
    throw error;
  }
}

export async function getMessagesForUser(email) {
  try {
    const messagesRef = ref(database, 'messages');
    const snapshot = await get(messagesRef);
    const messages = [];
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      try {
        const toEmail = decryptData(data.to);
        if (toEmail === email) {
          messages.push({
            id,
            from: decryptData(data.from),
            to: toEmail,
            text: decryptData(data.text),
            timestamp: parseInt(decryptData(data.timestamp)),
            read: decryptData(data.read) === 'true'
          });
        }
      } catch (e) {
        console.warn('Error decrypting message:', e);
      }
    }
    
    return messages.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

export async function markMessageAsRead(messageId) {
  try {
    const messageRef = ref(database, `messages/${messageId}`);
    await update(messageRef, {
      read: encryptData('true')
    });
  } catch (error) {
    console.error('Mark message error:', error);
  }
}

export async function deleteAllMessagesForUser(email) {
  try {
    const messagesRef = ref(database, 'messages');
    const snapshot = await get(messagesRef);
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      const toEmail = decryptData(data.to);
      if (toEmail === email) {
        await remove(ref(database, `messages/${id}`));
      }
    }
  } catch (error) {
    console.error('Delete messages error:', error);
  }
}

export async function saveChat(chatData) {
  try {
    const chatsRef = ref(database, 'chats');
    const encryptedData = {
      from: encryptData(chatData.from),
      senderName: encryptData(chatData.senderName),
      text: encryptData(chatData.text),
      timestamp: encryptData(chatData.timestamp.toString())
    };
    
    if (chatData.replyTo) {
      encryptedData.replyTo = encryptData(JSON.stringify({
        id: chatData.replyTo.id,
        text: chatData.replyTo.text,
        from: chatData.replyTo.from,
        name: chatData.replyTo.name
      }));
    }
    
    const newChatRef = push(chatsRef);
    await set(newChatRef, encryptedData);
    return newChatRef.key;
  } catch (error) {
    console.error('Save chat error:', error);
    throw error;
  }
}

export async function getChats() {
  try {
    const chatsRef = ref(database, 'chats');
    const snapshot = await get(chatsRef);
    const chats = [];
    
    for (const [id, data] of Object.entries(snapshot.val() || {})) {
      try {
        const chat = {
          id,
          from: decryptData(data.from),
          senderName: decryptData(data.senderName),
          text: decryptData(data.text),
          timestamp: parseInt(decryptData(data.timestamp))
        };
        
        if (data.replyTo) {
          const replyToStr = decryptData(data.replyTo);
          chat.replyTo = JSON.parse(replyToStr);
        }
        
        chats.push(chat);
      } catch (e) {
        console.warn('Error decrypting chat:', e);
      }
    }
    
    return chats.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Get chats error:', error);
    return [];
  }
}

export async function uploadAvatar(base64Data, userId) {
  try {
    const avatarRef = storageRef(storage, `avatars/${userId}`);
    await uploadString(avatarRef, base64Data, 'data_url');
    return await getDownloadURL(avatarRef);
  } catch (error) {
    console.error('Upload avatar error:', error);
    throw error;
  }
}

export async function deleteUserAccount(userId, email) {
  try {
    await remove(ref(database, `users/${userId}`));
    
    const messagesRef = ref(database, 'messages');
    const messagesSnap = await get(messagesRef);
    for (const [id, data] of Object.entries(messagesSnap.val() || {})) {
      try {
        const toEmail = decryptData(data.to);
        const fromEmail = decryptData(data.from);
        if (toEmail === email || fromEmail === email) {
          await remove(ref(database, `messages/${id}`));
        }
      } catch (e) {}
    }
    
    const chatsRef = ref(database, 'chats');
    const chatsSnap = await get(chatsRef);
    for (const [id, data] of Object.entries(chatsSnap.val() || {})) {
      try {
        const fromEmail = decryptData(data.from);
        if (fromEmail === email) {
          await remove(ref(database, `chats/${id}`));
        }
      } catch (e) {}
    }
    
    return true;
  } catch (error) {
    console.error('Delete account error:', error);
    throw error;
  }
}

export default {
  saveUser,
  getUserByIP,
  updateUser,
  saveMessage,
  getMessagesForUser,
  markMessageAsRead,
  deleteAllMessagesForUser,
  saveChat,
  getChats,
  uploadAvatar,
  deleteUserAccount
};
