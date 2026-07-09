/* =========================================================
   WISHLIST — save, remove, move to cart.
   ========================================================= */
const Wishlist = {
  async itemsFor(userId) { return DB.query("Wishlist", w => w.userId === userId); },

  async has(userId, productId) {
    const items = await this.itemsFor(userId);
    return items.find(i => i.productId === productId) || null;
  },

  async toggle(userId, productId) {
    const existing = await this.has(userId, productId);
    if (existing) { await DB.remove("Wishlist", existing.id); updateBadges(); return false; }
    await DB.add("Wishlist", { userId, productId });
    updateBadges();
    return true;
  },

  async remove(userId, productId) {
    const existing = await this.has(userId, productId);
    if (existing) await DB.remove("Wishlist", existing.id);
    updateBadges();
  },

  async moveToCart(userId, productId) {
    await Cart.add(userId, productId, 1);
    await this.remove(userId, productId);
  }
};

async function renderWishlist() {
  if (!Auth.isLoggedIn()) return emptyState("Sign in to build a wishlist", "🤍", "Save products you love and come back to them later.");
  const items = await Wishlist.itemsFor(Auth.currentUser.id);
  if (!items.length) return emptyState("Your wishlist is empty", "🤍", "Tap the heart on any product to save it here.");
  const products = await Promise.all(items.map(i => DB.getById("Products", i.productId)));
  return `
    <div class="container section">
      <div class="section__head"><h2>Wishlist</h2></div>
      <div class="grid">
        ${products.filter(Boolean).map(p => productCard(p)).join("")}
      </div>
    </div>`;
}
