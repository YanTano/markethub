/* =========================================================
   CART — add, remove, quantity, save-for-later, order summary.
   ========================================================= */
const Cart = {
  async itemsFor(userId, { savedOnly = false } = {}) {
    const all = await DB.query("Cart", c => c.userId === userId);
    return all.filter(c => !!c.savedForLater === savedOnly);
  },

  async add(userId, productId, qty = 1) {
    const existing = (await DB.query("Cart", c => c.userId === userId && c.productId === productId && !c.savedForLater))[0];
    if (existing) await DB.update("Cart", existing.id, { qty: existing.qty + qty });
    else await DB.add("Cart", { userId, productId, qty, savedForLater: false });
    updateBadges();
  },

  async setQty(cartItemId, qty) {
    if (qty <= 0) return this.remove(cartItemId);
    await DB.update("Cart", cartItemId, { qty });
    updateBadges();
  },

  async remove(cartItemId) { await DB.remove("Cart", cartItemId); updateBadges(); },

  async saveForLater(cartItemId) { await DB.update("Cart", cartItemId, { savedForLater: true }); updateBadges(); },
  async moveToCart(cartItemId) { await DB.update("Cart", cartItemId, { savedForLater: false }); updateBadges(); },

  async count(userId) {
    if (!userId) return 0;
    const items = await this.itemsFor(userId);
    return items.reduce((s, i) => s + i.qty, 0);
  },

  async summary(userId) {
    const items = await this.itemsFor(userId);
    const products = await Promise.all(items.map(i => DB.getById("Products", i.productId)));
    let subtotal = 0;
    const rows = items.map((item, idx) => {
      const p = products[idx];
      if (!p) return null;
      const unit = p.price * (1 - (p.discount || 0) / 100);
      subtotal += unit * item.qty;
      return { item, product: p, unit };
    }).filter(Boolean);
    const shipping = subtotal === 0 ? 0 : subtotal > 75 ? 0 : 5.99;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const total = Math.round((subtotal + shipping + tax) * 100) / 100;
    return { rows, subtotal: Math.round(subtotal * 100) / 100, shipping, tax, total };
  }
};

async function renderCart() {
  if (!Auth.isLoggedIn() && !Auth.isGuest()) return emptyState("Sign in to view your cart", "🛒");
  const userId = Auth.currentUser.id;
  const { rows, subtotal, shipping, tax, total } = await Cart.summary(userId);
  const saved = await Cart.itemsFor(userId, { savedOnly: true });
  const savedProducts = await Promise.all(saved.map(s => DB.getById("Products", s.productId)));

  if (!rows.length && !saved.length) return emptyState("Your cart is empty", "🛒", "Browse the marketplace and add something you love.");

  return `
    <div class="container section">
      <h2>Your Cart</h2>
      <div class="cartlayout">
        <div>
          ${rows.length ? rows.map(({ item, product, unit }) => `
            <div class="cartitem">
              <img src="${product.images[0]}" alt="${product.name}"/>
              <div>
                <strong>${product.name}</strong>
                <div class="tag tag--price">$${unit.toFixed(2)}</div>
                <div class="pd__qty" style="margin-top:.4rem">
                  <button data-qty-down="${item.id}">−</button>
                  <input readonly value="${item.qty}"/>
                  <button data-qty-up="${item.id}">+</button>
                </div>
                <div class="cartitem__actions">
                  <button data-remove="${item.id}">Remove</button>
                  <button data-save="${item.id}">Save for later</button>
                </div>
              </div>
              <strong>$${(unit * item.qty).toFixed(2)}</strong>
            </div>`).join("") : `<p style="color:var(--ink-soft)">No items in cart right now.</p>`}

          ${saved.length ? `
            <h3 style="margin-top:2rem">Saved for later (${saved.length})</h3>
            ${saved.map((s, idx) => savedProducts[idx] ? `
              <div class="cartitem">
                <img src="${savedProducts[idx].images[0]}" alt=""/>
                <div><strong>${savedProducts[idx].name}</strong>
                  <div class="tag tag--price">$${savedProducts[idx].price.toFixed(2)}</div>
                </div>
                <button class="btn btn--sm btn--outline" data-movetocart="${s.id}">Move to cart</button>
              </div>` : "").join("")}
          ` : ""}
        </div>

        <div class="summary">
          <h3>Order Summary</h3>
          <div class="summary__row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
          <div class="summary__row"><span>Shipping</span><span>${shipping === 0 ? "Free" : "$" + shipping.toFixed(2)}</span></div>
          <div class="summary__row"><span>Estimated tax</span><span>$${tax.toFixed(2)}</span></div>
          <div class="summary__row summary__row--total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
          <button class="btn btn--marigold btn--block" style="margin-top:1rem" id="checkoutBtn" ${!rows.length ? "disabled" : ""}>Proceed to Checkout</button>
          <p style="font-size:.75rem; color:var(--ink-soft); margin-top:.6rem">Free shipping on orders over $75.</p>
        </div>
      </div>
    </div>`;
}

function wireCartEvents(root) {
  root.querySelectorAll("[data-qty-up]").forEach(b => b.onclick = async () => {
    const item = await DB.getById("Cart", b.dataset.qtyUp); await Cart.setQty(item.id, item.qty + 1); router();
  });
  root.querySelectorAll("[data-qty-down]").forEach(b => b.onclick = async () => {
    const item = await DB.getById("Cart", b.dataset.qtyDown); await Cart.setQty(item.id, item.qty - 1); router();
  });
  root.querySelectorAll("[data-remove]").forEach(b => b.onclick = async () => { await Cart.remove(b.dataset.remove); toast("Removed from cart"); router(); });
  root.querySelectorAll("[data-save]").forEach(b => b.onclick = async () => { await Cart.saveForLater(b.dataset.save); router(); });
  root.querySelectorAll("[data-movetocart]").forEach(b => b.onclick = async () => { await Cart.moveToCart(b.dataset.movetocart); router(); });
  const checkoutBtn = root.querySelector("#checkoutBtn");
  if (checkoutBtn) checkoutBtn.onclick = () => { location.hash = "#/checkout"; };
}
