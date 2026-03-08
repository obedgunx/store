// ════════════════════════════════════════════════════════
//  🔐 LUNASTORE AUTH SYSTEM
//  Handles: Email/Password, Google Login, Admin Auth,
//           Session persistence, Protected routes
// ════════════════════════════════════════════════════════

// ─── Firebase SDK imports (loaded via CDN) ───
// Pastikan firebase-config.js di-load sebelum file ini

let _auth, _db, _googleProvider;
let currentUser = null;
let authReady = false;

// ══════════════════════════════════════════
//  INIT FIREBASE
// ══════════════════════════════════════════
async function initFirebase() {
  try {
    // Import Firebase modules
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js");
    const { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
            createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
            signOut, updateProfile } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js");
    const { getDatabase, ref, set, get, push, onValue, off, serverTimestamp }
            = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js");

    const app = initializeApp(window.FIREBASE_CONFIG);
    _auth = getAuth(app);
    _db   = getDatabase(app);
    _googleProvider = new GoogleAuthProvider();

    // Expose DB helpers globally
    window._db = _db;
    window._dbRef = ref;
    window._dbSet = set;
    window._dbGet = get;
    window._dbPush = push;
    window._dbOnValue = onValue;
    window._dbOff = off;
    window._dbTimestamp = serverTimestamp;

    // Expose auth helpers
    window._auth = _auth;
    window._signIn = (email, pass) => signInWithEmailAndPassword(_auth, email, pass);
    window._signUp = (email, pass) => createUserWithEmailAndPassword(_auth, email, pass);
    window._googleSignIn = () => signInWithPopup(_auth, _googleProvider);
    window._signOut = () => signOut(_auth);
    window._updateProfile = (user, data) => updateProfile(user, data);

    // Auth state listener
    onAuthStateChanged(_auth, async (user) => {
      authReady = true;
      if (user) {
        currentUser = user;
        window.currentUser = user;
        const isAdmin = window.ADMIN_EMAILS?.includes(user.email);
        window.isAdmin = isAdmin;
        await ensureUserInDB(user, isAdmin);
        onAuthChanged(user, isAdmin);
      } else {
        currentUser = null;
        window.currentUser = null;
        window.isAdmin = false;
        onAuthChanged(null, false);
      }
    });

    console.log("✅ Firebase initialized");
    return true;
  } catch (err) {
    console.error("❌ Firebase init error:", err);
    // Fallback: run in demo mode
    window._demoMode = true;
    authReady = true;
    onAuthChanged(null, false);
    return false;
  }
}

// ══════════════════════════════════════════
//  SAVE USER TO DB
// ══════════════════════════════════════════
async function ensureUserInDB(user, isAdmin) {
  if (!_db) return;
  try {
    const userRef = window._dbRef(_db, `users/${user.uid}`);
    const snap = await window._dbGet(userRef);
    if (!snap.exists()) {
      await window._dbSet(userRef, {
        uid: user.uid,
        name: user.displayName || "Pengguna",
        email: user.email,
        photoURL: user.photoURL || "",
        role: isAdmin ? "admin" : "user",
        createdAt: Date.now(),
        orders: 0,
        totalSpent: 0,
      });
    } else {
      // Update last login
      await window._dbSet(window._dbRef(_db, `users/${user.uid}/lastLogin`), Date.now());
    }
  } catch (e) {
    console.warn("DB write error:", e);
  }
}

// ══════════════════════════════════════════
//  AUTH ACTIONS (called from UI)
// ══════════════════════════════════════════
async function authLogin(email, password, onSuccess, onError) {
  if (window._demoMode) {
    // Demo mode fallback
    const fakeUser = { email, displayName: email.split("@")[0], uid: "demo-" + Date.now() };
    const isAdmin = window.ADMIN_EMAILS?.includes(email);
    onSuccess(fakeUser, isAdmin);
    return;
  }
  try {
    const cred = await window._signIn(email, password);
    const isAdmin = window.ADMIN_EMAILS?.includes(cred.user.email);
    onSuccess(cred.user, isAdmin);
  } catch (err) {
    onError(friendlyError(err.code));
  }
}

async function authRegister(name, email, password, onSuccess, onError) {
  if (window._demoMode) {
    onSuccess({ email, displayName: name, uid: "demo-" + Date.now() }, false);
    return;
  }
  try {
    const cred = await window._signUp(email, password);
    await window._updateProfile(cred.user, { displayName: name });
    onSuccess(cred.user, false);
  } catch (err) {
    onError(friendlyError(err.code));
  }
}

async function authGoogleLogin(onSuccess, onError) {
  if (window._demoMode) {
    onSuccess({ email: "demo@gmail.com", displayName: "Demo User", uid: "demo-google" }, false);
    return;
  }
  try {
    const cred = await window._googleSignIn();
    const isAdmin = window.ADMIN_EMAILS?.includes(cred.user.email);
    onSuccess(cred.user, isAdmin);
  } catch (err) {
    onError(friendlyError(err.code));
  }
}

async function authLogout(onDone) {
  try {
    if (!window._demoMode) await window._signOut();
    currentUser = null;
    window.currentUser = null;
    window.isAdmin = false;
    if (onDone) onDone();
  } catch (err) {
    console.error(err);
  }
}

// ══════════════════════════════════════════
//  HELPER: FRIENDLY ERROR MESSAGES
// ══════════════════════════════════════════
function friendlyError(code) {
  const map = {
    "auth/invalid-credential":    "Email atau password salah.",
    "auth/user-not-found":        "Akun tidak ditemukan.",
    "auth/wrong-password":        "Password salah.",
    "auth/email-already-in-use":  "Email sudah terdaftar.",
    "auth/weak-password":         "Password minimal 6 karakter.",
    "auth/invalid-email":         "Format email tidak valid.",
    "auth/too-many-requests":     "Terlalu banyak percobaan. Coba lagi nanti.",
    "auth/popup-closed-by-user":  "Login Google dibatalkan.",
    "auth/network-request-failed":"Cek koneksi internet kamu.",
  };
  return map[code] || "Terjadi kesalahan. Coba lagi.";
}

// ══════════════════════════════════════════
//  REALTIME DB HELPERS
// ══════════════════════════════════════════

// Chat: kirim pesan
async function dbSendMessage(chatId, message, senderUid, senderName) {
  if (!_db) return;
  const msgRef = window._dbRef(_db, `chats/${chatId}/messages`);
  await window._dbPush(msgRef, {
    text: message,
    senderUid,
    senderName,
    timestamp: Date.now(),
    read: false,
  });
  // Update last message
  await window._dbSet(window._dbRef(_db, `chats/${chatId}/lastMessage`), {
    text: message,
    time: Date.now(),
    senderName,
  });
}

// Chat: listen pesan
function dbListenMessages(chatId, callback) {
  if (!_db) return () => {};
  const msgRef = window._dbRef(_db, `chats/${chatId}/messages`);
  window._dbOnValue(msgRef, (snap) => {
    const data = snap.val() || {};
    const msgs = Object.entries(data).map(([k, v]) => ({ id: k, ...v }))
                       .sort((a, b) => a.timestamp - b.timestamp);
    callback(msgs);
  });
  return () => window._dbOff(msgRef);
}

// Orders: simpan order baru
async function dbCreateOrder(order) {
  if (!_db) return "demo-order-" + Date.now();
  const ordersRef = window._dbRef(_db, "orders");
  const newRef = await window._dbPush(ordersRef, {
    ...order,
    createdAt: Date.now(),
    status: "Menunggu",
  });
  // Notifikasi ke admin
  await window._dbPush(window._dbRef(_db, "notifications"), {
    type: "order",
    title: "Pesanan baru masuk",
    sub: `${order.userEmail} — ${formatPriceDB(order.total)}`,
    orderId: newRef.key,
    time: Date.now(),
    read: false,
  });
  return newRef.key;
}

// Orders: listen semua orders (admin)
function dbListenOrders(callback) {
  if (!_db) return () => {};
  const ref = window._dbRef(_db, "orders");
  window._dbOnValue(ref, (snap) => {
    const data = snap.val() || {};
    const orders = Object.entries(data).map(([k, v]) => ({ id: k, ...v }))
                         .sort((a, b) => b.createdAt - a.createdAt);
    callback(orders);
  });
  return () => window._dbOff(ref);
}

// Orders: update status
async function dbUpdateOrderStatus(orderId, status) {
  if (!_db) return;
  await window._dbSet(window._dbRef(_db, `orders/${orderId}/status`), status);
  if (status === "Selesai") {
    // Kurangi stok, tambah sold (handled server-side idealnya, tapi untuk demo:)
    const snap = await window._dbGet(window._dbRef(_db, `orders/${orderId}`));
    const order = snap.val();
    if (order) {
      // Update user stats
      const userRef = window._dbRef(_db, `users/${order.userId}`);
      const userSnap = await window._dbGet(userRef);
      if (userSnap.exists()) {
        const u = userSnap.val();
        await window._dbSet(window._dbRef(_db, `users/${order.userId}/orders`), (u.orders || 0) + 1);
        await window._dbSet(window._dbRef(_db, `users/${order.userId}/totalSpent`), (u.totalSpent || 0) + order.total);
      }
    }
  }
}

// Notifications: listen (admin)
function dbListenNotifications(callback) {
  if (!_db) return () => {};
  const ref = window._dbRef(_db, "notifications");
  window._dbOnValue(ref, (snap) => {
    const data = snap.val() || {};
    const notifs = Object.entries(data).map(([k, v]) => ({ id: k, ...v }))
                         .sort((a, b) => b.time - a.time);
    callback(notifs);
  });
  return () => window._dbOff(ref);
}

// Products: sync produk ke DB (admin only)
async function dbSyncProducts(products) {
  if (!_db) return;
  await window._dbSet(window._dbRef(_db, "products"), products);
}

// Products: load dari DB
async function dbLoadProducts() {
  if (!_db) return null;
  const snap = await window._dbGet(window._dbRef(_db, "products"));
  return snap.val();
}

// Ratings: simpan rating
async function dbSaveRating(productId, userId, rating, review) {
  if (!_db) return;
  await window._dbSet(window._dbRef(_db, `ratings/${productId}/${userId}`), {
    rating, review, userId,
    timestamp: Date.now(),
  });
}

// ══════════════════════════════════════════
//  UTIL
// ══════════════════════════════════════════
function formatPriceDB(p) { return "Rp " + (p || 0).toLocaleString("id-ID"); }

// Export globals
window.initFirebase       = initFirebase;
window.authLogin          = authLogin;
window.authRegister       = authRegister;
window.authGoogleLogin    = authGoogleLogin;
window.authLogout         = authLogout;
window.dbSendMessage      = dbSendMessage;
window.dbListenMessages   = dbListenMessages;
window.dbCreateOrder      = dbCreateOrder;
window.dbListenOrders     = dbListenOrders;
window.dbUpdateOrderStatus= dbUpdateOrderStatus;
window.dbListenNotifications = dbListenNotifications;
window.dbSyncProducts     = dbSyncProducts;
window.dbLoadProducts     = dbLoadProducts;
window.dbSaveRating       = dbSaveRating;

// ══════════════════════════════════════════
//  CALLBACK HOOKS (override in each page)
// ══════════════════════════════════════════
// Override ini di index.html dan admin.html:
//   window.onAuthChanged = function(user, isAdmin) { ... }
window.onAuthChanged = function(user, isAdmin) {
  console.log("Auth changed:", user?.email, "| Admin:", isAdmin);
};
