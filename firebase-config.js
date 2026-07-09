/* =========================================================
   FIREBASE CONFIG
   Replace the values below with your own Firebase project's
   config (Project settings → General → Your apps → SDK setup).
   If apiKey is left as "YOUR_API_KEY", MarketHub automatically
   runs in DEMO MODE using localStorage instead of Firebase, so
   the whole site still works out of the box for previewing.
   ========================================================= */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const FIREBASE_ENABLED = firebaseConfig.apiKey !== "YOUR_API_KEY";

let fbApp = null, fbAuth = null, fbDB = null, fbStorage = null;

if (FIREBASE_ENABLED) {
  try {
    fbApp = firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
    fbDB = firebase.firestore();
    fbStorage = firebase.storage();
    console.info("[MarketHub] Firebase connected — live mode.");
  } catch (err) {
    console.error("[MarketHub] Firebase init failed, falling back to demo mode.", err);
  }
} else {
  console.info("[MarketHub] Running in DEMO MODE (localStorage). Add your Firebase config in firebase-config.js to go live.");
}
