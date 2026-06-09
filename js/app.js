// =============================================
// APP.JS – Shared utilities & auth guard
// =============================================
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- Auth Guard & User Bootstrap ----
let currentUser    = null;
let currentProfile = null;

export function getCurrentUser()    { return currentUser; }
export function getCurrentProfile() { return currentProfile; }

// Wait for auth + profile before calling callback
export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      currentProfile = { uid: user.uid, ...snap.data() };
    } else {
      currentProfile = { uid: user.uid, email: user.email, role: "member", firstName: "User", lastName: "" };
    }
    setupNav(currentProfile);
    if (callback) callback(currentUser, currentProfile);
  });
}

// ---- Nav Setup ----
function setupNav(profile) {
  // Show admin link if role is admin
  const adminNav = document.getElementById("adminNavItem");
  if (adminNav && profile.role === "admin") adminNav.classList.remove("hidden");

  // Sidebar user info
  const sidebarUser = document.getElementById("sidebarUser");
  if (sidebarUser) {
    sidebarUser.textContent = `${profile.firstName} ${profile.lastName}`;
  }

  // Mobile avatar
  const mobileAvatar = document.getElementById("mobileAvatar");
  if (mobileAvatar) {
    if (profile.avatarUrl) {
      mobileAvatar.innerHTML = `<img src="${profile.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
    } else {
      mobileAvatar.textContent = (profile.firstName?.[0] || "?") + (profile.lastName?.[0] || "");
    }
  }
}

// ---- Logout ----
window.handleLogout = async function() {
  await signOut(auth);
  window.location.href = "../index.html";
};

// ---- Sidebar Toggle (mobile) ----
window.toggleSidebar = function() {
  const sidebar  = document.getElementById("sidebar");
  const overlay  = document.getElementById("sidebarOverlay");
  sidebar.classList.toggle("open");
  overlay.classList.toggle("hidden");
};

// ---- Toast Notifications ----
let toastContainer;
function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}
export function showToast(msg, type = "info", duration = 3000) {
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
window.showToast = showToast;

// ---- Format Helpers ----
export function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}
export function formatTime(timeStr) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12  = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}
export function formatTimestamp(ts) {
  if (!ts) return "–";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}
export function initials(profile) {
  return ((profile.firstName?.[0] || "") + (profile.lastName?.[0] || "")).toUpperCase() || "?";
}
export function avatarHTML(profile, size = 36) {
  if (profile.avatarUrl) {
    return `<img src="${profile.avatarUrl}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover" />`;
  }
  return initials(profile);
}

window.closeModal = function() {
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
};
