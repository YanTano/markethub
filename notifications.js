/* =========================================================
   NOTIFICATIONS — order updates, promotions, stock alerts.
   ========================================================= */
const Notify = {
  async listFor(userId) {
    return (await DB.query("Notifications", n => n.userId === userId))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async push(userId, { type = "info", title, body }) {
    return DB.add("Notifications", { userId, type, title, body, read: false });
  },

  async markRead(id) { return DB.update("Notifications", id, { read: true }); },
  async markAllRead(userId) {
    const list = await this.listFor(userId);
    await Promise.all(list.filter(n => !n.read).map(n => DB.update("Notifications", n.id, { read: true })));
  },

  async unreadCount(userId) {
    if (!userId) return 0;
    const list = await this.listFor(userId);
    return list.filter(n => !n.read).length;
  }
};

async function renderNotifications() {
  if (!Auth.isLoggedIn() && !Auth.isGuest()) return emptyState("Sign in to see notifications", "🔔");
  const list = await Notify.listFor(Auth.currentUser.id);
  await Notify.markAllRead(Auth.currentUser.id);
  updateBadges();
  if (!list.length) return emptyState("Nothing here yet", "🔔", "Order updates, promotions, and stock alerts will show up here.");
  return `
    <div class="container section">
      <h2>Notifications</h2>
      <div style="max-width:640px">
        ${list.map(n => `
          <div class="card--panel" style="margin-bottom:.8rem; border-left:3px solid ${n.type === 'promo' ? 'var(--marigold)' : n.type === 'stock' ? 'var(--terracotta)' : 'var(--teal)'}">
            <strong>${n.title}</strong>
            <p style="color:var(--ink-soft); font-size:.88rem; margin:.3rem 0 0">${n.body}</p>
            <small style="color:var(--ink-soft)">${timeAgo(n.createdAt)}</small>
          </div>`).join("")}
      </div>
    </div>`;
}
