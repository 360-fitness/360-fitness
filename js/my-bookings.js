// =============================================
// MY-BOOKINGS.JS – Booking history
// =============================================
import { db } from "./firebase-config.js";
import { requireAuth, formatDate, formatTime, showToast } from "./app.js";
import {
  collection, query, where, getDocs, deleteDoc,
  doc, updateDoc, increment, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser, allBookings = [];

requireAuth(async (user, profile) => {
  currentUser = user;
  await loadBookings(user.uid);
});

async function loadBookings(uid) {
  const snap = await getDocs(query(
    collection(db, "bookings"),
    where("userId", "==", uid),
    orderBy("sessionDate", "desc")
  ));
  allBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  filterBookings("upcoming");
}

window.filterBookings = function(filter) {
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  event?.target?.classList.add("active");
  // Fix: find the button by text
  document.querySelectorAll(".filter-btn").forEach(b => {
    if (b.textContent.toLowerCase().includes(filter)) b.classList.add("active");
  });

  const now = new Date();
  let filtered;
  switch (filter) {
    case "upcoming":
      filtered = allBookings.filter(b => b.status === "booked" && new Date(b.sessionDateStr) >= now);
      break;
    case "past":
      filtered = allBookings.filter(b => b.status === "booked" && new Date(b.sessionDateStr) < now);
      break;
    case "waitlist":
      filtered = allBookings.filter(b => b.status === "waitlist");
      break;
    default:
      filtered = allBookings;
  }
  renderBookings(filtered, filter);
};

function renderBookings(bookings, filter) {
  const listEl = document.getElementById("myBookingsList");
  if (!bookings.length) {
    listEl.innerHTML = `<div class="empty-state">No ${filter} bookings found. <a href="bookings.html">Book a session!</a></div>`;
    return;
  }
  const now = new Date();
  listEl.innerHTML = bookings.map(b => {
    const isPast = new Date(b.sessionDateStr) < now;
    const statusClass = b.status === "waitlist" ? "status-waitlist"
      : isPast ? "status-past" : "status-booked";
    const statusText = b.status === "waitlist" ? "Waitlist"
      : isPast ? "Attended" : "Upcoming";

    const canCancel = !isPast && (b.status === "booked" || b.status === "waitlist");
    return `
      <div class="booking-item">
        <div class="booking-time">${formatTime(b.sessionTime)}</div>
        <div class="booking-info">
          <div class="booking-name">${b.sessionName}</div>
          <div class="booking-meta">${formatDate(b.sessionDateStr)} · ${b.sessionDuration || 60} min</div>
        </div>
        <span class="booking-status ${statusClass}">${statusText}</span>
        ${canCancel ? `<button class="btn-sm danger" onclick="cancelMyBooking('${b.id}','${b.sessionId}',${b.status === "waitlist"})">Cancel</button>` : ""}
      </div>`;
  }).join("");
}

window.cancelMyBooking = async function(bookingId, sessionId, isWaitlist) {
  if (!confirm("Cancel this booking?")) return;
  try {
    await deleteDoc(doc(db, "bookings", bookingId));
    if (!isWaitlist) {
      await updateDoc(doc(db, "sessions", sessionId), { bookedCount: increment(-1) });
    } else {
      await updateDoc(doc(db, "sessions", sessionId), { waitlistCount: increment(-1) });
    }
    showToast("Booking cancelled.", "info");
    allBookings = allBookings.filter(b => b.id !== bookingId);
    filterBookings("all");
  } catch (err) {
    showToast("Error cancelling.", "error");
  }
};
