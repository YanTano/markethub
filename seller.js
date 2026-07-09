/* =========================================================
   SELLER — become a seller, add/edit/delete products, orders.
   ========================================================= */

async function renderSellerLanding() {
  if (Auth.isLoggedIn() && Auth.isSeller()) { location.hash = "#/dashboard/seller"; return ""; }
  return `
    <div class="container section" style="max-width:640px">
      <span class="eyebrow">Sell on MarketHub</span>
      <h1>Open your stall in minutes.</h1>
      <p style="color:var(--ink-soft)">List products, manage stock and pricing, and track orders — no setup fees, no server to run.</p>
      ${Auth.isLoggedIn() ? `
        <form id="becomeSellerForm" class="card--panel">
          <div class="field"><label>Store name</label><input required name="storeName" placeholder="e.g. Basin Supply Co."/></div>
          <button class="btn btn--marigold" type="submit">Start Selling</button>
        </form>` : `<button class="btn btn--marigold" id="sellerLoginBtn">Log in to get started</button>`}
    </div>`;
}

function wireSellerLandingEvents(root) {
  root.querySelector("#becomeSellerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await Auth.becomeSeller(fd.get("storeName"));
    toast("You're now a seller!");
    location.hash = "#/dashboard/seller";
  });
  root.querySelector("#sellerLoginBtn")?.addEventListener("click", () => openModal(loginModal()));
}

const SELLER_TABS = [
  { id: "products", label: "My Products" },
  { id: "add", label: "Add Product" },
  { id: "orders", label: "Orders" }
];

async function renderSellerDashboard(tab = "products") {
  if (!Auth.requireLogin("Sign in to access your seller dashboard")) return emptyState("Sign in required", "🔒");
  if (!Auth.isSeller()) { location.hash = "#/seller"; return ""; }

  let body = "";
  if (tab === "products") body = await sellerProductsTab();
  else if (tab === "add") body = sellerAddProductForm();
  else if (tab === "orders") body = await sellerOrdersTab();

  return `
    <div class="container section">
      <h2>Seller Dashboard</h2>
      <div class="dash">
        <nav class="dash__nav">
          ${SELLER_TABS.map(t => `<button data-seller-tab="${t.id}" class="${t.id === tab ? "active" : ""}">${t.label}</button>`).join("")}
        </nav>
        <div>${body}</div>
      </div>
    </div>`;
}

async function sellerProductsTab() {
  const products = await DB.query("Products", p => p.sellerId === Auth.currentUser.id);
  if (!products.length) return emptyState("No products yet", "🏷️", "Add your first product to start selling.");
  return `
    <div class="card--panel" style="overflow-x:auto">
      <table class="datatable">
        <thead><tr><th></th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><img src="${p.images[0]}" style="width:44px;height:44px;object-fit:cover;border-radius:6px"/></td>
              <td>${p.name}</td>
              <td><input class="input" style="width:90px" type="number" step="0.01" value="${p.price}" data-editprice="${p.id}"/></td>
              <td><input class="input" style="width:70px" type="number" value="${p.stock}" data-editstock="${p.id}"/></td>
              <td><span class="pill ${p.active !== false ? "pill--active" : "pill--inactive"}">${p.active !== false ? "Active" : "Inactive"}</span></td>
              <td style="display:flex; gap:.4rem">
                <button class="btn btn--sm btn--ghost" data-toggleactive="${p.id}">${p.active !== false ? "Deactivate" : "Activate"}</button>
                <button class="btn btn--sm btn--danger" data-deleteproduct="${p.id}">Delete</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function sellerAddProductForm(existing = null) {
  const p = existing || {};
  return `
    <form id="productForm" class="card--panel" data-editing="${existing ? existing.id : ""}">
      <h3>${existing ? "Edit Product" : "Add Product"}</h3>
      <div class="formgrid">
        <div class="field"><label>Product name</label><input required name="name" value="${p.name || ""}"/></div>
        <div class="field"><label>Brand</label><input required name="brand" value="${p.brand || ""}"/></div>
      </div>
      <div class="field"><label>Description</label><textarea required name="description">${p.description || ""}</textarea></div>
      <div class="formgrid">
        <div class="field"><label>Category</label>
          <select name="category">${CATEGORIES.map(c => `<option value="${c.id}" ${p.category === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Tags (comma separated)</label><input name="tags" value="${(p.tags || []).join(", ")}"/></div>
      </div>
      <div class="formgrid">
        <div class="field"><label>Price ($)</label><input required type="number" step="0.01" name="price" value="${p.price || ""}"/></div>
        <div class="field"><label>Discount (%)</label><input type="number" name="discount" value="${p.discount || 0}"/></div>
      </div>
      <div class="field"><label>Stock quantity</label><input required type="number" name="stock" value="${p.stock ?? ""}"/></div>
      <div class="field"><label>Product images (multiple)</label><input type="file" name="images" accept="image/*" multiple ${existing ? "" : "required"}/>
        <small>${existing ? "Leave empty to keep current images." : "Stored in Firebase Storage (or locally in demo mode)."}</small>
      </div>
      <button class="btn btn--marigold" type="submit">${existing ? "Save Changes" : "Publish Product"}</button>
    </form>`;
}

async function sellerOrdersTab() {
  const myProducts = await DB.query("Products", p => p.sellerId === Auth.currentUser.id);
  const myIds = new Set(myProducts.map(p => p.id));
  const orders = await DB.getAll("Orders");
  const relevant = orders.filter(o => o.items.some(i => myIds.has(i.productId)));
  if (!relevant.length) return emptyState("No orders yet", "📦");
  return `
    <div class="card--panel" style="overflow-x:auto">
      <table class="datatable">
        <thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${relevant.map(o => `
            <tr>
              <td>#${o.id.slice(-6).toUpperCase()}</td>
              <td>${o.items.filter(i => myIds.has(i.productId)).map(i => `${i.name} ×${i.qty}`).join(", ")}</td>
              <td>$${o.total.toFixed(2)}</td>
              <td><span class="pill pill--pending">${o.status}</span></td>
              <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function wireSellerDashboardEvents(root) {
  root.querySelectorAll("[data-seller-tab]").forEach(b => b.onclick = () => { location.hash = `#/dashboard/seller/${b.dataset.sellerTab}`; });

  root.querySelector("#productForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const files = fd.getAll("images").filter(f => f.size);
    const editingId = form.dataset.editing;
    const patch = {
      name: fd.get("name"), brand: fd.get("brand"), description: fd.get("description"),
      category: fd.get("category"), tags: fd.get("tags").split(",").map(t => t.trim()).filter(Boolean),
      price: +fd.get("price"), discount: +fd.get("discount") || 0, stock: +fd.get("stock")
    };
    if (files.length) patch.images = await Promise.all(files.map(f => DB.uploadImage(f, "products")));

    if (editingId) {
      await DB.update("Products", editingId, patch);
      toast("Product updated");
    } else {
      await DB.add("Products", {
        ...patch, sellerId: Auth.currentUser.id, sellerName: Auth.currentUser.name,
        rating: 0, ratingCount: 0, sold: 0, active: true, images: patch.images || []
      });
      toast("Product published");
    }
    location.hash = "#/dashboard/seller/products";
  });

  root.querySelectorAll("[data-toggleactive]").forEach(b => b.onclick = async () => {
    const p = await DB.getById("Products", b.dataset.toggleactive);
    await DB.update("Products", p.id, { active: !(p.active !== false) });
    router();
  });
  root.querySelectorAll("[data-deleteproduct]").forEach(b => b.onclick = async () => {
    if (!confirm("Delete this product permanently?")) return;
    await DB.remove("Products", b.dataset.deleteproduct);
    toast("Product deleted");
    router();
  });
  root.querySelectorAll("[data-editprice]").forEach(inp => inp.onchange = () => DB.update("Products", inp.dataset.editprice, { price: +inp.value }));
  root.querySelectorAll("[data-editstock]").forEach(inp => inp.onchange = () => DB.update("Products", inp.dataset.editstock, { stock: +inp.value }));
}
