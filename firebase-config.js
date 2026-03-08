// ════════════════════════════════════════════════════════
//  🔥 LUNASTORE — FIREBASE CONFIGURATION
//  Isi dengan kredensial Firebase project kamu!
//  Cara dapat: Firebase Console → Project Settings → Your Apps
// ════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB-72tqNaUZGzy6QBpa2-pqKO7SVvqizwY",
  authDomain:        "webweb-12520.firebaseapp.com",
  projectId:         "webweb-12520",
  storageBucket:     "webweb-12520.firebasestorage.app",
  messagingSenderId: "10117314413",
  appId:             "1:10117314413:web:c789b1933704baa2448c64",
  measurementId:     "G-M02TV5YJBD",

  // ⚠️  Cek URL ini di Firebase Console → Realtime Database
  // Kemungkinan besar URL-nya ini (region Singapore):
  databaseURL: "https://webweb-12520-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// ════════════════════════════════════════════════════════
//  ADMIN CONFIG — ganti dengan email kamu!
// ════════════════════════════════════════════════════════
const ADMIN_EMAILS = [
  // "creeppermoment@gmail.com",  // ← hapus tanda // dan isi email admin
];

// ════════════════════════════════════════════════════════
//  JANGAN UBAH DI BAWAH INI
// ════════════════════════════════════════════════════════
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.ADMIN_EMAILS    = ADMIN_EMAILS;
