// =============================================
// BOOKINGS.JS – Browse & book sessions
// =============================================
import { db } from "./firebase-config.js";
import { requireAuth, formatDate, formatTime, showToast, getCurrentProfile } from "./app.js";
import {
  collection, query, where, getDocs, getDoc, doc,
  addDoc, updateDoc, increment, deleteDoc, serverTimestamp,
  orderBy, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser, currentProfile, selectedDate;
let currentSessionId = null;
const DAYS_AHEAD = 14;

requireAuth((user, profile) => {
  currentUser    = user;
  currentProfile = profile;
  buildDateScroller();
});

// ---- Date Scroller ----
function buildDateScroller() {
  const scroller = document.getElementById("dateScroller");
  const today    = new Date();
  scroller.innerHTML = "";
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d    = new Date(today);
    d.setDate(today.getDate() + i);
    const str  = d.toISOString().split("T")[0];
    const btn  = document.createElement("button");
    btn.className = "date-btn" + (i === 0 ? " active" : "");
    btn.dataset.date = str;
    btn.innerHTML = `
      <span class="date-day">${d.toLocaleDateString("en", { weekday: "short" })}</span>
      <span class="date-num">${d.getDate()}</span>`;
    btn.onclick = () => selectDate(str, btn);
    scroller.appendChild(btn);
  }
  selectDate(today.toISOString().split("T")[0], scroller.firstChild);
}

function selectDate(dateStr, btn) {
  selectedDate = dateStr;
  document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("slotsDateLabel").textContent = formatDate(dateStr) + " Sessions";
  loadSlots(dateStr);
}

// ---- Load Slots ----
async function loadSlots(dateStr) {
  const listEl = document.getElementById("slotsList");
  listEl.innerHTML = `<div class="loading-spinner"></div>`;

  const snap = await getDocs(query(
    collection(db, "sessions"),
    where("date", "==", dateStr),
    orderBy("time")
  ));

  if (snap.empty) {
    listEl.innerHTML = `<div class="empty-state">No sessions scheduled for this day.</div>`;
    return;
  }

  // Get current user's bookings for this date
  const mySnap = await getDocs(query(
    collection(db, "bookings"),
    where("userId", "==", currentUser.uid),
    where("sessionDateStr", "==", dateStr)
  ));
  const myBookings = {};
  mySnap.docs.forEach(d => { myBookings[d.data().sessionId] = { id: d.id, ...d.data() }; });

  listEl.className = "slots-grid";
  listEl.innerHTML = snap.docs.map(d => renderSlotCard(d, myBookings)).join("");
}

function renderSlotCard(d, myBookings) {
  const s       = d.data();
  const sid     = d.id;
  const booked  = s.bookedCount || 0;
  const max     = s.maxMembers || 15;
  const isFull  = booked >= max;
  const myBook  = myBookings[sid];
  const isBooked    = myBook?.status === "booked";
  const isWaitlisted = myBook?.status === "waitlist";
  const pct         = Math.min(100, Math.round(booked / max * 100));
  const fillClass   = pct >= 100 ? "full" : pct >= 75 ? "near-full" : "";
  const cardClass   = isBooked ? "slot-booked" : isWaitlisted ? "slot-waitlisted" : isFull ? "slot-full" : "";
  const statusText  = isBooked ? "Booked ✓" : isWaitlisted ? "Waitlisted" : isFull ? "Full" : "Available";
  const statusClass = isBooked ? "status-booked" : isWaitlisted ? "status-waitlist" : isFull ? "status-full" : "status-open";

  return `
    <div class="slot-card ${cardClass}" onclick="openSessionModal('${sid}')">
      <span class="slot-type-badge">${s.type || "session"}</span>
      <span class="slot-status-pill ${statusClass}">${statusText}</span>
      <div class="slot-name">${s.name}</div>
      <div class="slot-time">${formatTime(s.time)} · ${s.duration || 60} min</div>
      <div class="slot-trainer">${s.trainer ? "Coach: " + s.trainer : ""}</div>
      <div class="slot-capacity">
        <span>${booked}/${max}</span>
        <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%"></div></div>
      </div>
    </div>`;
}

// ---- Session Modal ----
window.openSessionModal = async function(sessionId) {
  currentSessionId = sessionId;
  const modal   = document.getElementById("sessionModal");
  const sessDoc = await getDoc(doc(db, "sessions", sessionId));
  if (!sessDoc.exists()) return;
  const s = sessDoc.data();

  document.getElementById("modalTitle").textContent = s.name;
  document.getElementById("modalMeta").innerHTML = `
    📅 ${formatDate(s.date)} &nbsp;⏰ ${formatTime(s.time)} &nbsp;⏱ ${s.duration || 60} min
    ${s.trainer ? `&nbsp;👤 ${s.trainer}` : ""}`;

  // Get bookings for this session
  const bookSnap = await getDocs(query(
    collection(db, "bookings"),
    where("sessionId", "==", sessionId),
    where("status", "==", "booked")
  ));
  const waitSnap = await getDocs(query(
    collection(db, "bookings"),
    where("sessionId", "==", sessionId),
    where("status", "==", "waitlist"),
    orderBy("createdAt")
  ));

  const booked = bookSnap.size;
  const max    = s.maxMembers || 15;
  document.getElementById("modalBookedCount").textContent = booked;
  document.getElementById("modalMaxCount").textContent    = max;
  document.getElementById("modalWaitlistCount").textContent = waitSnap.size;

  // Members list
  const membersList = document.getElementById("modalMembersList");
  membersList.innerHTML = bookSnap.empty
    ? `<li class="member-item" style="color:var(--text-muted)">No bookings yet.</li>`
    : bookSnap.docs.map(d => {
        const b = d.data();
        return `<li class="member-item">
          <div class="member-mini-avatar">${(b.userFirstName?.[0] || "?") + (b.userLastName?.[0] || "")}</div>
          <span>${b.userFirstName} ${b.userLastName}</span>
        </li>`;
      }).join("");

  // Waitlist
  const waitList = document.getElementById("modalWaitlist");
  waitList.innerHTML = waitSnap.empty
    ? `<li class="member-item" style="color:var(--text-muted)">Waitlist is empty.</li>`
    : waitSnap.docs.map((d, i) => {
        const b = d.data();
        return `<li class="member-item">
          <div class="member-mini-avatar">${i + 1}</div>
          <span>${b.userFirstName} ${b.userLastName}</span>
        </li>`;
      }).join("");

  // Actions
  const myBookDoc = bookSnap.docs.find(d => d.data().userId === currentUser.uid);
  const myWaitDoc = waitSnap.docs.find(d => d.data().userId === currentUser.uid);
  const actionsEl = document.getElementById("modalActions");
  const pastSession = new Date(s.date + "T" + s.time) < new Date();

  if (pastSession) {
    actionsEl.innerHTML = `<span style="color:var(--text-muted);font-size:0.85rem">This session has passed.</span>`;
  } else if (myBookDoc) {
    actionsEl.innerHTML = `<button class="btn-danger" onclick="cancelBooking('${myBookDoc.id}', '${sessionId}', false)">Cancel Booking</button>`;
  } else if (myWaitDoc) {
    actionsEl.innerHTML = `
      <span class="booking-status status-waitlist">On Waitlist</span>
      <button class="btn-danger" onclick="cancelBooking('${myWaitDoc.id}', '${sessionId}', true)">Leave Waitlist</button>`;
  } else if (booked >= max) {
    actionsEl.innerHTML = `<button class="btn-secondary" onclick="joinWaitlist('${sessionId}')">Join Waitlist</button>`;
  } else {
    actionsEl.innerHTML = `<button class="btn-primary" style="width:auto;padding:12px 28px" onclick="bookSession('${sessionId}')">Book This Session</button>`;
  }

  modal.classList.remove("hidden");
};

// ---- Book Session ----
window.bookSession = async function(sessionId) {
  const sessDoc = await getDoc(doc(db, "sessions", sessionId));
  if (!sessDoc.exists()) return;
  const s      = sessDoc.data();
  const booked = s.bookedCount || 0;
  const max    = s.maxMembers || 15;
  if (booked >= max) {
    showToast("Session is now full. Join the waitlist.", "error");
    return openSessionModal(sessionId);
  }
  try {
    await addDoc(collection(db, "bookings"), {
      userId:       currentUser.uid,
      userFirstName: currentProfile.firstName,
      userLastName:  currentProfile.lastName,
      sessionId,
      sessionName:   s.name,
      sessionDate:   Timestamp.fromDate(new Date(s.date + "T" + s.time)),
      sessionDateStr: s.date,
      sessionTime:   s.time,
      sessionDuration: s.duration,
      status:        "booked",
      createdAt:     serverTimestamp()
    });
    await updateDoc(doc(db, "sessions", sessionId), { bookedCount: increment(1) });
    showToast("Session booked! See you there 💪", "success");
    closeModal();
    loadSlots(selectedDate);
  } catch (err) {
    showToast("Booking failed. Please try again.", "error");
  }
};

// ---- Join Waitlist ----
window.joinWaitlist = async function(sessionId) {
  const sessDoc = await getDoc(doc(db, "sessions", sessionId));
  if (!sessDoc.exists()) return;
  const s = sessDoc.data();
  try {
    await addDoc(collection(db, "bookings"), {
      userId:        currentUser.uid,
      userFirstName: currentProfile.firstName,
      userLastName:  currentProfile.lastName,
      sessionId,
      sessionName:   s.name,
      sessionDate:   Timestamp.fromDate(new Date(s.date + "T" + s.time)),
      sessionDateStr: s.date,
      sessionTime:   s.time,
      sessionDuration: s.duration,
      status:        "waitlist",
      createdAt:     serverTimestamp()
    });
    await updateDoc(doc(db, "sessions", sessionId), { waitlistCount: increment(1) });
    showToast("Added to waitlist. We'll notify you if a spot opens.", "info");
    closeModal();
    loadSlots(selectedDate);
  } catch (err) {
    showToast("Error joining waitlist.", "error");
  }
};

// ---- Cancel Booking ----
window.cancelBooking = async function(bookingId, sessionId, isWaitlist) {
  if (!confirm("Cancel this booking?")) return;
  try {
    await deleteDoc(doc(db, "bookings", bookingId));
    if (!isWaitlist) {
      await updateDoc(doc(db, "sessions", sessionId), { bookedCount: increment(-1) });
      // Promote first person on waitlist
      promoteWaitlist(sessionId);
    } else {
      await updateDoc(doc(db, "sessions", sessionId), { waitlistCount: increment(-1) });
    }
    showToast("Booking cancelled.", "info");
    closeModal();
    loadSlots(selectedDate);
  } catch (err) {
    showToast("Error cancelling booking.", "error");
  }
};

async function promoteWaitlist(sessionId) {
  const waitSnap = await getDocs(query(
    collection(db, "bookings"),
    where("sessionId", "==", sessionId),
    where("status", "==", "waitlist"),
    orderBy("createdAt"),
    limit(1)
  ));
  if (!waitSnap.empty) {
    const first = waitSnap.docs[0];
    await updateDoc(doc(db, "bookings", first.id), { status: "booked" });
    await updateDoc(doc(db, "sessions", sessionId), {
      bookedCount:   increment(1),
      waitlistCount: increment(-1)
    });
  }
}
