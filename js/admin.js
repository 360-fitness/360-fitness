// =============================================
// ADMIN.JS
// =============================================
import { db } from "./firebase-config.js";
import { requireAuth, formatDate, formatTime, showToast } from "./app.js";
import {
  collection, query, where, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc, doc, orderBy,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser, currentProfile;
let allMembers = [], allSessions = [], allBookingsAdmin = [];

requireAuth(async (user, profile) => {
  if (profile.role !== "admin") {
    document.querySelector(".main-content").innerHTML =
      `<div class="empty-state" style="margin-top:100px">⛔ Admin access only.</div>`;
    return;
  }
  currentUser    = user;
  currentProfile = profile;
  loadAdminStats();
  adminTab("sessions");
});

// ---- Stats ----
async function loadAdminStats() {
  const today = new Date().toISOString().split("T")[0];
  const [membersSnap, sessionsSnap, bookingsSnap, waitSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(query(collection(db, "sessions"), where("date", "==", today))),
    getDocs(query(collection(db, "bookings"), where("sessionDateStr", "==", today), where("status", "==", "booked"))),
    getDocs(query(collection(db, "bookings"), where("status", "==", "waitlist")))
  ]);
  document.getElementById("adminStatMembers").textContent  = membersSnap.size;
  document.getElementById("adminStatSessions").textContent = sessionsSnap.size;
  document.getElementById("adminStatBookings").textContent = bookingsSnap.size;
  document.getElementById("adminStatWaiting").textContent  = waitSnap.size;
}

// ---- Tab ----
window.adminTab = function(tab) {
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  event?.target?.classList.add("active");
  document.querySelectorAll(".filter-btn").forEach(b => {
    if (b.textContent.toLowerCase() === tab) b.classList.add("active");
  });
  ["sessions", "members", "bookings"].forEach(t => {
    document.getElementById("admin" + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle("hidden", t !== tab);
  });
  if (tab === "sessions") loadAdminSessions();
  if (tab === "members")  loadAdminMembers();
  if (tab === "bookings") loadAdminBookings();
};

// ---- Sessions ----
async function loadAdminSessions() {
  const listEl = document.getElementById("adminSessionsList");
  listEl.innerHTML = `<div class="loading-spinner"></div>`;
  const snap = await getDocs(query(collection(db, "sessions"), orderBy("date"), orderBy("time")));
  allSessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!allSessions.length) {
    listEl.innerHTML = `<div class="empty-state">No sessions yet. Add one above.</div>`;
    return;
  }
  listEl.innerHTML = allSessions.map(s => `
    <div class="booking-item">
      <div class="booking-time">${formatTime(s.time)}</div>
      <div class="booking-info">
        <div class="booking-name">${s.name}</div>
        <div class="booking-meta">${formatDate(s.date)} · ${s.bookedCount || 0}/${s.maxMembers} · ${s.trainer || "–"}</div>
      </div>
      <div class="admin-action-btns">
        <button class="btn-sm" onclick="editSession('${s.id}')">Edit</button>
        <button class="btn-sm danger" onclick="deleteSession('${s.id}')">Delete</button>
      </div>
    </div>`).join("");
}

// ---- Members ----
async function loadAdminMembers() {
  const listEl = document.getElementById("adminMembersList");
  listEl.innerHTML = `<div class="loading-spinner"></div>`;
  const snap = await getDocs(collection(db, "users"));
  allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMembersTable(allMembers);
}

function renderMembersTable(members) {
  const listEl = document.getElementById("adminMembersList");
  if (!members.length) {
    listEl.innerHTML = `<div class="empty-state">No members found.</div>`;
    return;
  }
  listEl.innerHTML = `
    <table class="members-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Membership</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(m => `
          <tr>
            <td>${m.firstName} ${m.lastName}</td>
            <td>${m.email}</td>
            <td>${m.phone || "–"}</td>
            <td>${m.membership || "monthly"}</td>
            <td>
              <select onchange="updateMemberRole('${m.id}', this.value)" style="background:var(--dark-3);border:1px solid var(--dark-5);color:var(--text-primary);padding:4px 8px;border-radius:4px;font-size:0.8rem">
                <option value="member"  ${m.role !== "admin" ? "selected" : ""}>Member</option>
                <option value="admin"   ${m.role === "admin" ? "selected" : ""}>Admin</option>
              </select>
            </td>
            <td>
              <div class="admin-action-btns">
                <button class="btn-sm danger" onclick="removeMember('${m.id}')">Remove</button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

window.searchMembers = function() {
  const q = document.getElementById("memberSearch").value.toLowerCase();
  const filtered = allMembers.filter(m =>
    `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q)
  );
  renderMembersTable(filtered);
};

window.updateMemberRole = async function(uid, role) {
  await updateDoc(doc(db, "users", uid), { role });
  showToast("Role updated.", "success");
};

window.removeMember = async function(uid) {
  if (!confirm("Remove this member? This only removes their profile, not their auth account.")) return;
  await deleteDoc(doc(db, "users", uid));
  showToast("Member removed.", "info");
  loadAdminMembers();
};

// ---- All Bookings ----
async function loadAdminBookings() {
  const listEl = document.getElementById("adminBookingsList");
  listEl.innerHTML = `<div class="loading-spinner"></div>`;
  const snap = await getDocs(query(collection(db, "bookings"), orderBy("sessionDate", "desc")));
  allBookingsAdmin = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!allBookingsAdmin.length) {
    listEl.innerHTML = `<div class="empty-state">No bookings yet.</div>`;
    return;
  }
  const now = new Date();
  listEl.innerHTML = allBookingsAdmin.map(b => {
    const isPast = new Date(b.sessionDateStr) < now;
    const statusClass = b.status === "waitlist" ? "status-waitlist" : isPast ? "status-past" : "status-booked";
    return `
      <div class="booking-item">
        <div class="booking-time">${formatTime(b.sessionTime)}</div>
        <div class="booking-info">
          <div class="booking-name">${b.sessionName}</div>
          <div class="booking-meta">${b.userFirstName} ${b.userLastName} · ${formatDate(b.sessionDateStr)}</div>
        </div>
        <span class="booking-status ${statusClass}">${b.status}</span>
        <button class="btn-sm danger" onclick="adminCancelBooking('${b.id}','${b.sessionId}',${b.status === "waitlist"})">Cancel</button>
      </div>`;
  }).join("");
}

window.adminCancelBooking = async function(bookingId, sessionId, isWaitlist) {
  if (!confirm("Cancel this booking?")) return;
  await deleteDoc(doc(db, "bookings", bookingId));
  if (!isWaitlist) {
    await updateDoc(doc(db, "sessions", sessionId), { bookedCount: increment(-1) });
  }
  showToast("Booking cancelled.", "info");
  loadAdminBookings();
};

// ---- Gym Schedule (fixed time slots) ----
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const GYM_SCHEDULE = {
  "1": [ // Monday
    { time: "05:00", duration: 60 },
    { time: "16:00", duration: 60 },
    { time: "17:00", duration: 60 },
    { time: "18:00", duration: 60 },
    { time: "19:00", duration: 60 }
  ],
  "2": [ // Tuesday
    { time: "05:00", duration: 60 },
    { time: "16:00", duration: 60 },
    { time: "17:00", duration: 60 },
    { time: "18:00", duration: 60 },
    { time: "19:00", duration: 60 }
  ],
  "3": [ // Wednesday
    { time: "05:00", duration: 60 },
    { time: "16:00", duration: 60 },
    { time: "17:00", duration: 60 },
    { time: "18:00", duration: 60 },
    { time: "19:00", duration: 60 }
  ],
  "4": [ // Thursday
    { time: "05:00", duration: 60 },
    { time: "16:00", duration: 60 },
    { time: "17:00", duration: 60 },
    { time: "18:00", duration: 60 },
    { time: "19:00", duration: 60 }
  ],
  "5": [ // Friday
    { time: "05:00", duration: 60 },
    { time: "16:00", duration: 60 }
  ],
  "6": [ // Saturday – Open Gym only
    { time: "08:00", duration: 60, label: "Open Gym" }
  ]
  // Sunday (0) – closed
};

function updateTimeSlots(dateStr) {
  const slotSelect = document.getElementById("sessTimeSlot");
  if (!slotSelect) return;
  slotSelect.innerHTML = "";
  if (!dateStr) return;
  const dow = new Date(dateStr + "T00:00:00").getDay().toString();
  const slots = GYM_SCHEDULE[dow];
  if (!slots || !slots.length) {
    slotSelect.innerHTML = `<option value="">Closed – no sessions</option>`;
    document.getElementById("sessDuration").value = "";
    return;
  }
  slots.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.time;
    opt.textContent = s.label ? `${s.time} – ${s.label}` : s.time;
    opt.dataset.duration = s.duration;
    opt.dataset.label    = s.label || "";
    slotSelect.appendChild(opt);
  });
  slotSelect.onchange = () => {
    const sel = slotSelect.selectedOptions[0];
    document.getElementById("sessDuration").value = sel?.dataset.duration || "60";
    if (sel?.dataset.label && !document.getElementById("editSessionId").value) {
      document.getElementById("sessName").value = sel.dataset.label;
    }
  };
  slotSelect.dispatchEvent(new Event("change"));
}

// ---- Add/Edit Session Modal ----
window.openAddSessionModal = function() {
  document.getElementById("sessionFormTitle").textContent = "Add Session";
  document.getElementById("editSessionId").value = "";
  document.getElementById("sessName").value     = "";
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("sessDate").value     = todayStr;
  document.getElementById("sessDuration").value = "60";
  document.getElementById("sessMax").value      = "15";
  document.getElementById("sessTrainer").value  = "";
  document.getElementById("sessType").value     = "hiit";
  document.getElementById("sessFormMsg").classList.add("hidden");
  updateTimeSlots(todayStr);
  document.getElementById("sessDate").onchange = (e) => updateTimeSlots(e.target.value);
  document.getElementById("sessionFormModal").classList.remove("hidden");
};

window.editSession = async function(id) {
  const snap = await getDoc(doc(db, "sessions", id));
  if (!snap.exists()) return;
  const s = snap.data();
  document.getElementById("sessionFormTitle").textContent = "Edit Session";
  document.getElementById("editSessionId").value = id;
  document.getElementById("sessName").value      = s.name;
  document.getElementById("sessDate").value      = s.date;
  document.getElementById("sessDuration").value  = s.duration || 60;
  document.getElementById("sessMax").value       = s.maxMembers || 15;
  document.getElementById("sessTrainer").value   = s.trainer || "";
  document.getElementById("sessType").value      = s.type || "hiit";
  document.getElementById("sessFormMsg").classList.add("hidden");
  // Populate time slots for that date and pre-select saved time
  updateTimeSlots(s.date);
  const slotSelect = document.getElementById("sessTimeSlot");
  if (slotSelect) {
    slotSelect.value = s.time;
    slotSelect.dispatchEvent(new Event("change"));
    document.getElementById("sessName").value = s.name; // restore after change event
  }
  document.getElementById("sessDate").onchange = (e) => updateTimeSlots(e.target.value);
  document.getElementById("sessionFormModal").classList.remove("hidden");
};

window.closeSessionModal = function() {
  document.getElementById("sessionFormModal").classList.add("hidden");
};

window.saveSession = async function() {
  const editId     = document.getElementById("editSessionId").value;
  const msgEl      = document.getElementById("sessFormMsg");
  const name       = document.getElementById("sessName").value.trim();
  const date       = document.getElementById("sessDate").value;
  const slotSelect = document.getElementById("sessTimeSlot");
  const time       = slotSelect ? slotSelect.value : "";
  const duration   = parseInt(document.getElementById("sessDuration").value);
  const maxMembers = parseInt(document.getElementById("sessMax").value);
  const trainer    = document.getElementById("sessTrainer").value.trim();
  const type       = document.getElementById("sessType").value;

  if (!name || !date || !time) {
    msgEl.textContent = "Name, date and time slot are required.";
    msgEl.className   = "form-msg error";
    msgEl.classList.remove("hidden");
    return;
  }
  const data = { name, date, time, duration, maxMembers, trainer, type };

  try {
    if (editId) {
      await updateDoc(doc(db, "sessions", editId), data);
      showToast("Session updated.", "success");
    } else {
      await addDoc(collection(db, "sessions"), { ...data, bookedCount: 0, waitlistCount: 0, createdAt: serverTimestamp() });
      showToast("Session added!", "success");
    }
    closeSessionModal();
    loadAdminSessions();
    loadAdminStats();
  } catch (err) {
    msgEl.textContent = "Error saving session.";
    msgEl.className   = "form-msg error";
    msgEl.classList.remove("hidden");
  }
};

window.deleteSession = async function(id) {
  if (!confirm("Delete this session? All bookings for it will remain in the database.")) return;
  await deleteDoc(doc(db, "sessions", id));
  showToast("Session deleted.", "info");
  loadAdminSessions();
};

// ---- Auto-Generate Sessions ----
const SESSION_TEMPLATES = {
  // Mon–Thu (1,2,3,4)
  weekday: [
    { time: "05:00", name: "Early Morning Training", type: "hiit",     duration: 60, maxMembers: 15 },
    { time: "16:00", name: "Afternoon Training",     type: "strength", duration: 60, maxMembers: 15 },
    { time: "17:00", name: "Evening Training",       type: "hiit",     duration: 60, maxMembers: 15 },
    { time: "18:00", name: "Evening Training",       type: "strength", duration: 60, maxMembers: 15 },
    { time: "19:00", name: "Evening Training",       type: "cardio",   duration: 60, maxMembers: 15 },
  ],
  // Friday (5)
  friday: [
    { time: "05:00", name: "Early Morning Training", type: "hiit",     duration: 60, maxMembers: 15 },
    { time: "16:00", name: "Afternoon Training",     type: "strength", duration: 60, maxMembers: 15 },
  ],
  // Saturday (6)
  saturday: [
    { time: "08:00", name: "Open Gym",               type: "open",     duration: 60, maxMembers: 15 },
  ]
};

window.generateSessions = async function() {
  const weeksInput = document.getElementById("generateWeeks");
  const weeks = parseInt(weeksInput?.value || "4");
  if (!confirm(`This will generate sessions for the next ${weeks} weeks. Existing sessions on those dates will be skipped. Continue?`)) return;

  const btn = document.getElementById("generateBtn");
  btn.disabled = true;
  btn.textContent = "Generating...";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let created = 0, skipped = 0;

  for (let d = 0; d < weeks * 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dow     = date.getDay(); // 0=Sun,1=Mon,...,6=Sat
    // Build dateStr from local time (not UTC) to avoid timezone shift in UTC+2
    const dateStr = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

    let templates = null;
    if (dow >= 1 && dow <= 4) templates = SESSION_TEMPLATES.weekday;
    else if (dow === 5)       templates = SESSION_TEMPLATES.friday;
    else if (dow === 6)       templates = SESSION_TEMPLATES.saturday;
    else continue; // Sunday — skip

    // Fetch all sessions for this date once (avoids compound index requirement)
    const dateSnap = await getDocs(query(
      collection(db, "sessions"),
      where("date", "==", dateStr)
    ));
    const existingTimes = new Set(dateSnap.docs.map(d => d.data().time));

    for (const t of templates) {
      if (existingTimes.has(t.time)) { skipped++; continue; }

      await addDoc(collection(db, "sessions"), {
        name:         t.name,
        date:         dateStr,
        time:         t.time,
        duration:     t.duration,
        maxMembers:   t.maxMembers,
        type:         t.type,
        trainer:      "",
        bookedCount:  0,
        waitlistCount: 0,
        createdAt:    serverTimestamp()
      });
      created++;
    }
  }

  btn.disabled = false;
  btn.textContent = "Generate Sessions";
  showToast(`✅ Done! ${created} sessions created, ${skipped} already existed.`, "success");
  loadAdminSessions();
  loadAdminStats();
};
