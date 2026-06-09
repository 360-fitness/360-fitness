// =============================================
// DASHBOARD.JS
// =============================================
import { db } from "./firebase-config.js";
import { requireAuth, formatDate, formatTime, showToast } from "./app.js";
import {
  collection, query, where, getDocs, orderBy, limit,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

requireAuth(async (user, profile) => {
  // Welcome name
  document.getElementById("userFirstName").textContent = profile.firstName || "Athlete";

  // Show admin stats card if admin
  if (profile.role === "admin") {
    document.getElementById("adminStatsCard")?.classList.remove("hidden");
    loadAdminStats();
  }

  loadUserStats(user.uid);
  loadUpcoming(user.uid);
  loadTodaySlots(user.uid);
});

async function loadUserStats(uid) {
  const now = Timestamp.now();
  // Upcoming bookings
  const upSnap = await getDocs(query(
    collection(db, "bookings"),
    where("userId", "==", uid),
    where("status", "==", "booked"),
    where("sessionDate", ">=", now)
  ));
  document.getElementById("statUpcoming").textContent = upSnap.size;

  // Past
  const pastSnap = await getDocs(query(
    collection(db, "bookings"),
    where("userId", "==", uid),
    where("status", "==", "booked"),
    where("sessionDate", "<", now)
  ));
  document.getElementById("statCompleted").textContent = pastSnap.size;

  // Waitlist
  const waitSnap = await getDocs(query(
    collection(db, "bookings"),
    where("userId", "==", uid),
    where("status", "==", "waitlist")
  ));
  document.getElementById("statWaiting").textContent = waitSnap.size;
}

async function loadAdminStats() {
  const membersSnap = await getDocs(collection(db, "users"));
  document.getElementById("statMembers").textContent = membersSnap.size;
}

async function loadUpcoming(uid) {
  const listEl = document.getElementById("upcomingList");
  const now = Timestamp.now();
  const snap = await getDocs(query(
    collection(db, "bookings"),
    where("userId", "==", uid),
    where("status", "==", "booked"),
    where("sessionDate", ">=", now),
    orderBy("sessionDate"),
    limit(5)
  ));
  if (snap.empty) {
    listEl.innerHTML = `<div class="empty-state">No upcoming sessions. <a href="bookings.html">Book one now!</a></div>`;
    return;
  }
  listEl.innerHTML = snap.docs.map(d => {
    const b = d.data();
    return `
      <div class="booking-item">
        <div class="booking-time">${formatTime(b.sessionTime)}</div>
        <div class="booking-info">
          <div class="booking-name">${b.sessionName}</div>
          <div class="booking-meta">${formatDate(b.sessionDateStr)} · ${b.sessionDuration || 60} min</div>
        </div>
        <span class="booking-status status-booked">Booked</span>
      </div>`;
  }).join("");
}

async function loadTodaySlots(uid) {
  const listEl = document.getElementById("todaySlots");
  const today  = new Date().toISOString().split("T")[0];
  const snap   = await getDocs(query(
    collection(db, "sessions"),
    where("date", "==", today),
    orderBy("time")
  ));
  if (snap.empty) {
    listEl.innerHTML = `<div class="empty-state">No sessions scheduled today.</div>`;
    return;
  }
  // Get user's bookings for today
  const mySnap = await getDocs(query(
    collection(db, "bookings"),
    where("userId", "==", uid),
    where("sessionDateStr", "==", today)
  ));
  const myBookedIds = new Set(mySnap.docs.map(d => d.data().sessionId));

  listEl.innerHTML = snap.docs.map(d => {
    const s = d.data();
    const booked = (s.bookedCount || 0);
    const max    = s.maxMembers || 15;
    const isFull = booked >= max;
    const isMine = myBookedIds.has(d.id);
    const pct    = Math.min(100, Math.round(booked / max * 100));
    const fillClass = pct >= 100 ? "full" : pct >= 75 ? "near-full" : "";
    return `
      <div class="booking-item">
        <div class="booking-time">${formatTime(s.time)}</div>
        <div class="booking-info">
          <div class="booking-name">${s.name}</div>
          <div class="booking-meta">${s.trainer || ""} · ${s.duration || 60} min</div>
        </div>
        <span class="booking-status ${isMine ? "status-booked" : isFull ? "status-full" : "status-open"}">
          ${isMine ? "Booked" : isFull ? "Full" : `${booked}/${max}`}
        </span>
      </div>`;
  }).join("");
}
