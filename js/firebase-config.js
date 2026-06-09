// =============================================
// FIREBASE CONFIGURATION
// Replace the config below with your own from:
// Firebase Console → Project Settings → Web App
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️  REPLACE THIS WITH YOUR FIREBASE CONFIG  ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyC4tsBDc1d-s9uhh1EAjwSS6PUH2t-hxd0",
  authDomain: "fitness-47605.firebaseapp.com",
  projectId: "fitness-47605",
  storageBucket: "fitness-47605.firebasestorage.app",
  messagingSenderId: "699950016599",
  appId: "1:699950016599:web:171f7527c9b91a7210db12",
  measurementId: "G-EWRKQW0FZF"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
