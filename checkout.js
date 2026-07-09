/* =========================================================
   CHECKOUT — address, delivery option, mock payment, confirmation.
   ========================================================= */

async function renderCheckout() {
  if (!Auth.requireLogin("Sign in to check out")) return emptyState("Sign in required", "🔒");
  const { rows, subtotal, shipping, tax, total } = await Cart.summary(Auth.currentUser.id);
  if (!rows.length) return emptyState("Your cart is empty", "🛒", "Add something to your cart before checking out.");
  const addresses = await DB.query("Addresses", a => a.userId === Auth.currentUser.id);

  return `
    <div class="container section">
      <h2>Checkout</h2>
      <div class="cartlayout">
        <form id="checkoutForm">
          <div class="card--panel" style="margin-bottom:1rem">
            <h3>Shipping Address</h3>
            ${addresses.length ? `
              <div class="field"><label>Use a saved address</label>
                <select id="savedAddress">
                  <option value="">— Enter new address —</option>
                  ${addresses.map(a => `<option value="${a.id}">${a.fullName}, ${a.street}, ${a.city}</option>`).join("")}
                </select>
              </div>` : ""}
            <div class="formgrid">
              <div class="field"><label>Full name</label><input required name="fullName" value="${Auth.currentUser.name || ""}"/></div>
              <div class="field"><label>Contact number</label><input required name="phone" type="tel" placeholder="+63 900 000 0000"/></div>
            </div>
            <div class="field"><label>Street address</label><input required name="street" placeholder="House no., street, barangay"/></div>
            <div class="formgrid">
              <div class="field"><label>City</label><input required name="city"/></div>
              <div class="field"><label>Postal code</label><input required name="zip"/></div>
            </div>
          </div>

          <div class="card--panel" style="margin-bottom:1rem">
            <h3>Delivery Option</h3>
            <label style="display:flex; gap:.6em; padding:.5em 0"><input type="radio" name="delivery" value="standard" checked/> Standard (3–5 days) — Free over $75</label>
            <label style="display:flex; gap:.6em; padding:.5em 0"><input type="radio" name="delivery" value="express"/> Express (1–2 days) — $12.00</label>
          </div>

          <div class="card--panel">
            <h3>Payment Method</h3>
            <label style="display:flex; gap:.6em; padding:.5em 0"><input type="radio" name="payment" value="cod" checked/> Cash on Delivery</label>
            <label style="display:flex; gap:.6em; padding:.5em 0"><input type="radio" name="payment" value="card"/> Credit Card (Demo)</label>
            <label style="display:flex; gap:.6em; padding:.5em 0"><input type="radio" name="payment" value="gcash"/> GCash (Demo)</label>
            <div id="cardFields" hidden class="formgrid" style="margin-top:.6rem">
              <div class="field"><label>Card number</label><input placeholder="4242 4242 4242 4242" maxlength="19"/></div>
              <div class="field"><label>Expiry</label><input placeholder="MM/YY"/></div>
            </div>
            <div id="gcashFields" hidden style="margin-top:.6rem">
              <div class="field"><label>GCash mobile number</label><input placeholder="09XX XXX XXXX"/></div>
            </div>
          </div>
        </form>

        <div class="summary">
          <h3>Order Summary</h3>
          ${rows.map(r => `<div class="summary__row"><span>${r.product.name} × ${r.item.qty}</span><span>$${(r.unit * r.item.qty).toFixed(2)}</span></div>`).join("")}
          <div class="summary__row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
          <div class="summary__row" id="shippingRow"><span>Shipping</span><span>${shipping === 0 ? "Free" : "$" + shipping.toFixed(2)}</span></div>
          <div class="summary__row"><span>Estimated tax</span><span>$${tax.toFixed(2)}</span></div>
          <div class="summary__row summary__row--total" id="totalRow"><span>Total</span><span>$${total.toFixed(2)}</span></div>
          <button class="btn btn--marigold btn--block" style="margin-top:1rem" id="placeOrderBtn">Place Order</button>
        </div>
      </div>
    </div>`;
}

function wireCheckoutEvents(root) {
  const cardFields = root.querySelector("#cardFields");
  const gcashFields = root.querySelector("#gcashFields");
  root.querySelectorAll("input[name=payment]").forEach(r => r.onchange = () => {
    cardFields.hidden = r.value !== "card" || !r.checked;
    gcashFields.hidden = r.value !== "gcash" || !r.checked;
  });
  root.querySelectorAll("input[name=payment]").forEach(r => { if (r.checked) r.onchange(); });

  const savedSel = root.querySelector("#savedAddress");
  if (savedSel) savedSel.onchange = async () => {
    if (!savedSel.value) return;
    const addr = await DB.getById("Addresses", savedSel.value);
    const form = root.querySelector("#checkoutForm");
    form.fullName.value = addr.fullName; form.phone.value = addr.phone;
    form.street.value = addr.street; form.city.value = addr.city; form.zip.value = addr.zip;
  };

  root.querySelectorAll("input[name=delivery]").forEach(r => r.onchange = async () => {
    const { subtotal, tax } = await Cart.summary(Auth.currentUser.id);
    const express = root.querySelector("input[name=delivery]:checked").value === "express";
    const shipping = express ? 12 : (subtotal > 75 ? 0 : 5.99);
    const total = (subtotal + shipping + tax).toFixed(2);
    root.querySelector("#shippingRow span:last-child").textContent = shipping === 0 ? "Free" : "$" + shipping.toFixed(2);
    root.querySelector("#totalRow span:last-child").textContent = "$" + total;
  });

  root.querySelector("#placeOrderBtn").onclick = async (e) => {
    e.preventDefault();
    const form = root.querySelector("#checkoutForm");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payment = fd.get("payment");
    const delivery = fd.get("delivery");
    const { rows, subtotal, tax } = await Cart.summary(Auth.currentUser.id);
    const shipping = delivery === "express" ? 12 : (subtotal > 75 ? 0 : 5.99);
    const total = Math.round((subtotal + shipping + tax) * 100) / 100;

    await DB.add("Addresses", {
      userId: Auth.currentUser.id, fullName: fd.get("fullName"), phone: fd.get("phone"),
      street: fd.get("street"), city: fd.get("city"), zip: fd.get("zip")
    });

    const order = await DB.add("Orders", {
      userId: Auth.currentUser.id, items: rows.map(r => ({ productId: r.product.id, name: r.product.name, qty: r.item.qty, unit: r.unit })),
      subtotal, shipping, tax, total, delivery, payment, status: "processing",
      address: { fullName: fd.get("fullName"), phone: fd.get("phone"), street: fd.get("street"), city: fd.get("city"), zip: fd.get("zip") }
    });
    for (const r of rows) await DB.add("OrderItems", { orderId: order.id, productId: r.product.id, qty: r.item.qty, unit: r.unit });

    const cartItems = await Cart.itemsFor(Auth.currentUser.id);
    for (const c of cartItems) await DB.remove("Cart", c.id);
    updateBadges();

    await Notify.push(Auth.currentUser.id, { type: "order", title: "Order placed", body: `Order #${order.id.slice(-6).toUpperCase()} is now processing.` });

    location.hash = `#/order-confirmation/${order.id}`;
  };
}

async function renderOrderConfirmation(orderId) {
  const order = await DB.getById("Orders", orderId);
  if (!order) return emptyState("Order not found", "📦");
  return `
    <div class="container section" style="max-width:640px">
      <div class="emptystate" style="padding-top:0">
        <div style="font-size:3rem">✅</div>
        <h3>Thank you — your order is confirmed!</h3>
        <p>Order <strong>#${order.id.slice(-6).toUpperCase()}</strong> · Paying via ${order.payment === "cod" ? "Cash on Delivery" : order.payment === "card" ? "Credit Card (Demo)" : "GCash (Demo)"}</p>
      </div>
      <div class="card--panel">
        ${order.items.map(i => `<div class="summary__row"><span>${i.name} × ${i.qty}</span><span>$${(i.unit * i.qty).toFixed(2)}</span></div>`).join("")}
        <div class="summary__row summary__row--total"><span>Total paid</span><span>$${order.total.toFixed(2)}</span></div>
      </div>
      <div style="text-align:center; margin-top:1.4rem">
        <a class="btn btn--marigold" href="#/dashboard">View My Orders</a>
        <a class="btn btn--ghost" href="#/home">Continue Shopping</a>
      </div>
    </div>`;
}
