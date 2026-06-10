// =============================================
// AUTH.JS – Login & Registration
// =============================================
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- Helpers (defined first so everything below can use them) ----
function showError(msg, isSuccess = false) {
  const el = document.getElementById("authError");
  el.textContent = msg;
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
    "auth/user-not-found":        "No account found with this email.",
    "auth/wrong-password":        "Incorrect password.",
    "auth/email-already-in-use":  "An account with this email already exists.",
    "auth/invalid-email":         "Please enter a valid email.",
    "auth/too-many-requests":     "Too many attempts. Try again later.",
    "auth/network-request-failed":"Network error. Check your connection.",
    "auth/invalid-credential":    "Incorrect email or password.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ---- Auth state flag ----
let isAuthInProgress = false;

// ---- Handle Google redirect result on page load ----
(async () => {
  try {
    showLoader(true);
    const result = await getRedirectResult(auth);
    if (result?.user) {
      isAuthInProgress = true;
      const user = result.user;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        const nameParts = (user.displayName || "").split(" ");
        const firstName = nameParts[0] || "Member";
        const lastName  = nameParts.slice(1).join(" ") || "";
        await setDoc(doc(db, "users", user.uid), {
          firstName,
          lastName,
          email:      user.email,
          phone:      "",
          membership: "monthly",
          role:       "member",
          avatarUrl:  user.photoURL || "",
          createdAt:  serverTimestamp(),
          memberId:   "360-" + user.uid.slice(0, 8).toUpperCase()
        });
      }
      window.location.href = "pages/dashboard.html";
      return;
    }
  } catch (err) {
    showError(friendlyError(err.code));
  } finally {
    showLoader(false);
  }
})();

// ---- Redirect already-logged-in users ----
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

// ---- Google Sign-In ----
window.handleGoogleSignIn = async function() {
  isAuthInProgress = true;
  try {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
    // Page redirects to Google — getRedirectResult() at top handles the rest on return
  } catch (err) {
    isAuthInProgress = false;
    showError(friendlyError(err.code));
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

// ---- Enter key to submit ----
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const isLogin = !document.getElementById("loginForm").classList.contains("hidden");
    if (isLogin) handleLogin(); else handleRegister();
  }
});
