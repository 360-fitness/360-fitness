// =============================================
// PROFILE.JS
// =============================================
import { db } from "./firebase-config.js";
import { requireAuth, formatTimestamp, showToast } from "./app.js";
import {
  doc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser, currentProfile;

requireAuth(async (user, profile) => {
  currentUser    = user;
  currentProfile = profile;
  populateForm(profile);
});

function populateForm(p) {
  document.getElementById("profFirstName").value  = p.firstName  || "";
  document.getElementById("profLastName").value   = p.lastName   || "";
  document.getElementById("profEmail").value      = p.email      || "";
  document.getElementById("profPhone").value      = p.phone      || "";
  document.getElementById("profMembership").value = p.membership || "monthly";
  document.getElementById("profSince").value      = formatTimestamp(p.createdAt);
  document.getElementById("profileNameDisplay").textContent = `${p.firstName} ${p.lastName}`;
  document.getElementById("membershipBadge").textContent =
    (p.membership || "Member").charAt(0).toUpperCase() + (p.membership || "member").slice(1);

  // Always show initials — no photo upload
  const avatarEl = document.getElementById("profileAvatar");
  avatarEl.textContent = ((p.firstName?.[0] || "") + (p.lastName?.[0] || "")).toUpperCase() || "?";
}

window.saveProfile = async function() {
  const firstName  = document.getElementById("profFirstName").value.trim();
  const lastName   = document.getElementById("profLastName").value.trim();
  const phone      = document.getElementById("profPhone").value.trim();
  const membership = document.getElementById("profMembership").value;
  const msgEl = document.getElementById("profileMsg");

  if (!firstName || !lastName) {
    msgEl.textContent = "First and last name are required.";
    msgEl.className   = "form-msg error";
    msgEl.classList.remove("hidden");
    return;
  }
  try {
    await updateDoc(doc(db, "users", currentUser.uid), { firstName, lastName, phone, membership });
    currentProfile = { ...currentProfile, firstName, lastName, phone, membership };
    populateForm(currentProfile);
    msgEl.textContent = "Profile saved!";
    msgEl.className   = "form-msg success";
    msgEl.classList.remove("hidden");
    setTimeout(() => msgEl.classList.add("hidden"), 3000);
  } catch (err) {
    msgEl.textContent = "Error saving profile.";
    msgEl.className   = "form-msg error";
    msgEl.classList.remove("hidden");
  }
};
