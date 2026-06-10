// =============================================
// AUTH.JS – Login & Registration
// =============================================
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Redirect if already logged in (guard against firing during active login/register)
let isAuthInProgress = false;
onAuthStateChanged(auth, (user) => {
  if (user && !isAuthInProgress) window.location.href = "pages/dashboard.html";
});

// ---- Tab Switching ----
window.switchTab = function(tab) {
  document.getElementById("loginForm").classList.toggle("hidden", tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab !== "register");
  document.getElementById("loginTab").classList.toggle("active", tab === "login");
  document.getElementById("registerTab").classList.toggle("active", tab === "register");
  clearError();
};

// ---- Login ----
window.handleLogin = async function() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) return showError("Please fill in all fields.");
  showLoader(true);
  isAuthInProgress = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "pages/dashboard.html";
  } catch (err) {
    isAuthInProgress = false;
    showError(friendlyError(err.code));
    showLoader(false);
  }
};

// ---- Register ----
window.handleRegister = async function() {
  const firstName = document.getElementById("regFirstName").value.trim();
  const lastName  = document.getElementById("regLastName").value.trim();
  const email     = document.getElementById("regEmail").value.trim();
  const phone     = document.getElementById("regPhone").value.trim();
  const password  = document.getElementById("regPassword").value;

  if (!firstName || !lastName || !email || !password)
    return showError("Please fill in all required fields.");
  if (password.length < 6)
    return showError("Password must be at least 6 characters.");

  showLoader(true);
  isAuthInProgress = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    // Create user profile in Firestore — must complete before redirecting
    await setDoc(doc(db, "users", uid), {
      firstName,
      lastName,
      email,
      phone:      phone || "",
      membership: "monthly",
      role:       "member",
      avatarUrl:  "",
      createdAt:  serverTimestamp(),
      memberId:   "360-" + uid.slice(0, 8).toUpperCase()
    });

    window.location.href = "pages/dashboard.html";
  } catch (err) {
    isAuthInProgress = false;
    showError(friendlyError(err.code));
    showLoader(false);
  }
};

// ---- Forgot Password ----
window.handleForgotPassword = async function() {
  const email = document.getElementById("loginEmail").value.trim();
  if (!email) return showError("Enter your email above first.");
  try {
    await sendPasswordResetEmail(auth, email);
    showError("Reset link sent! Check your inbox.", true);
  } catch (err) {
    showError(friendlyError(err.code));
  }
};

// ---- Helpers ----
function showError(msg, isSuccess = false) {
  const el = document.getElementById("authError");
  el.textContent = msg;
  el.className = isSuccess ? "auth-error" : "auth-error";
  el.style.color = isSuccess ? "var(--success)" : "";
  el.classList.remove("hidden");
}
function clearError() {
  document.getElementById("authError").classList.add("hidden");
}
function showLoader(show) {
  document.getElementById("authLoader").classList.toggle("hidden", !show);
}
function friendlyError(code) {
  const map = {
    "auth/user-not-found":     "No account found with this email.",
    "auth/wrong-password":     "Incorrect password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email":      "Please enter a valid email.",
    "auth/too-many-requests":  "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// Allow Enter key to submit
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const isLogin = !document.getElementById("loginForm").classList.contains("hidden");
    if (isLogin) handleLogin(); else handleRegister();
  }
});
