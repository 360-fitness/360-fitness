// =============================================
// MEMBERSHIP-CARD.JS
// =============================================
import { requireAuth, formatTimestamp } from "./app.js";

requireAuth((user, profile) => {
  renderCard(profile);
});

function renderCard(p) {
  document.getElementById("mcName").textContent  = `${p.firstName} ${p.lastName}`;
  document.getElementById("mcEmail").textContent = p.email || "";
  document.getElementById("mcPhone").textContent = p.phone || "";
  document.getElementById("mcSince").textContent = formatTimestamp(p.createdAt);
  document.getElementById("mcMemberType").textContent = (p.membership || "Member").charAt(0).toUpperCase() + (p.membership || "member").slice(1);
  document.getElementById("mcId").textContent    = p.memberId || ("360-" + p.uid?.slice(0, 8).toUpperCase());

  // Avatar
  const avatarEl = document.getElementById("mcAvatar");
  if (p.avatarUrl) {
    avatarEl.innerHTML = `<img src="${p.avatarUrl}" style="width:100%;height:100%;object-fit:cover" />`;
  } else {
    avatarEl.textContent = ((p.firstName?.[0] || "") + (p.lastName?.[0] || "")).toUpperCase() || "?";
  }

  // QR Code – encodes the member's UID for reception scanning
  const qrData = JSON.stringify({ uid: p.uid, memberId: p.memberId, name: `${p.firstName} ${p.lastName}` });
  if (typeof QRCode !== "undefined") {
    new QRCode(document.getElementById("mcQrCode"), {
      text:          qrData,
      width:         120,
      height:        120,
      colorDark:     "#000000",
      colorLight:    "#ffffff",
      correctLevel:  QRCode.CorrectLevel.M
    });
  } else {
    document.getElementById("mcQrCode").innerHTML =
      `<div style="width:120px;height:120px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#333">QR loading...</div>`;
  }
}
