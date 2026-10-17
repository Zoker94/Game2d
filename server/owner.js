// Chủ server (toàn quyền): tài khoản Google có email nằm trong ADMIN_EMAILS.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'nguyendung.itcv@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function isOwner(u) {
  return !!(u && u.googleId && !String(u.googleId).startsWith('dev:') && u.email && ADMIN_EMAILS.includes(String(u.email).toLowerCase()));
}

module.exports = { ADMIN_EMAILS, isOwner };
