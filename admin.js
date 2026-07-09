/* =========================================================
   ADMIN — manage users, moderate products, categories, analytics.
   Access is restricted to users flagged isAdmin (see auth.js —
   demo mode grants this to admin@markethub.demo automatically).
   ========================================================= */

const ADMIN_TABS = [
  { id: "analytics", label: "Analytics" },
  { id: "users", label: "Users" },
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" }
];

async function renderAdminDashboard(tab = "analytics") {
  if (!Auth.requireLogin("Sign in as an admin to continue")) return emptyState("Sign in required", "🔒");
  if (!Auth.isAdmin()) return emptyState("Admins only", "🛡️", "This area is restricted to MarketHub administrators.");

  let body = "";
  if (tab === "analytics") body = await adminAnalyticsTab();
  else if (tab === "users") body = await adminUsersTab();
  else if (tab === "products") body = await adminProductsTab();
  else if (tab === "categories") body = adminCategoriesTab();

  return `
    <div class="container section">
      <h2>Admin Panel</h2>
      <div class="dash">
        <nav class="dash__nav">
          ${ADMIN_TABS.map(t => `<button data-admin-tab="${t.id}" class="${t.id === tab ? "active" : ""}">${t.label}</button>`).join("")}
        </nav>
        <div>${body}</div>
      </div>
    </div>`;
}

async function adminAnalyticsTab() {
  const [products, orders, users] = await Promise.all([DB.getAll("Products"), DB.getAll("Orders"), DB.getAll("Users")]);
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const sellers = new Set(products.map(p => p.sellerId)).size;
  return `
    <div class="statgrid">
      <div class="statcard"><span class="eyebrow">Total Revenue</span><strong>$${revenue.toFixed(2)}</strong></div>
      <div class="statcard"><span class="eyebrow">Orders</span><strong>${orders.length}</strong></div>
      <div class="statcard"><span class="eyebrow">Products Listed</span><strong>${products.length}</strong></div>
      <div class="statcard"><span class="eyebrow">Registered Users</span><strong>${users.length}</strong></div>
      <div class="statcard"><span class="eyebrow">Active Sellers</span><strong>${sellers}</strong></div>
    </div>
    <div class="card--panel">
      <h3>Recent Orders</h3>
      <table class="datatable">
        <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${orders.slice(0, 10).map(o => `<tr><td>#${o.id.slice(-6).toUpperCase()}</td><td>${o.address?.fullName || "—"}</td><td>$${o.total.toFixed(2)}</td><td><span class="pill pill--pending">${o.status}</span></td></tr>`).join("") || `<tr><td colspan="4">No orders yet</td></tr>`}</tbody>
      </table>
    </div>`;
}

async function adminUsersTab() {
  const users = await DB.getAll("Users");
  if (!users.length) return emptyState("No registered users yet", "👤", "Guests and Google sign-ins will appear here.");
  return `
    <div class="card--panel" style="overflow-x:auto">
      <table class="datatable">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.name}</td><td>${u.email || "—"}</td>
              <td>${u.isAdmin ? "Admin" : u.isSeller ? "Seller" : "Customer"}</td>
              <td>
                <button class="btn btn--sm btn--ghost" data-toggleseller="${u.id}">${u.isSeller ? "Revoke Seller" : "Make Seller"}</button>
                <button class="btn btn--sm btn--danger" data-banuser="${u.id}">Remove</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function adminProductsTab() {
  const products = await DB.getAll("Products");
  return `
    <div class="card--panel" style="overflow-x:auto">
      <table class="datatable">
        <thead><tr><th></th><th>Name</th><th>Seller</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><img src="${p.images[0]}" style="width:40px;height:40px;object-fit:cover;border-radius:6px"/></td>
              <td>${p.name}</td><td>${p.sellerName}</td><td>$${p.price.toFixed(2)}</td>
              <td><span class="pill ${p.active !== false ? "pill--active" : "pill--inactive"}">${p.active !== false ? "Active" : "Inactive"}</span></td>
              <td>
                <button class="btn btn--sm btn--ghost" data-admintoggle="${p.id}">${p.active !== false ? "Deactivate" : "Activate"}</button>
                <button class="btn btn--sm btn--danger" data-admindelete="${p.id}">Remove Listing</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function adminCategoriesTab() {
  return `
    <div class="card--panel">
      <h3>Categories</h3>
      <table class="datatable">
        <thead><tr><th>Icon</th><th>Name</th><th>ID</th></tr></thead>
        <tbody>${CATEGORIES.map(c => `<tr><td>${c.icon}</td><td>${c.name}</td><td><code>${c.id}</code></td></tr>`).join("")}</tbody>
      </table>
      <p style="color:var(--ink-soft); font-size:.85rem; margin-top:.8rem">Categories are seeded as a fixed taxonomy for this demo. In production, store them in the <code>Categories</code> Firestore collection and manage them here with add/edit/delete forms.</p>
    </div>`;
}

function wireAdminDashboardEvents(root) {
  root.querySelectorAll("[data-admin-tab]").forEach(b => b.onclick = () => { location.hash = `#/dashboard/admin/${b.dataset.adminTab}`; });
  root.querySelectorAll("[data-toggleseller]").forEach(b => b.onclick = async () => {
    const u = await DB.getById("Users", b.dataset.toggleseller);
    await DB.update("Users", u.id, { isSeller: !u.isSeller });
    router();
  });
  root.querySelectorAll("[data-banuser]").forEach(b => b.onclick = async () => {
    if (!confirm("Remove this user account?")) return;
    await DB.remove("Users", b.dataset.banuser); router();
  });
  root.querySelectorAll("[data-admintoggle]").forEach(b => b.onclick = async () => {
    const p = await DB.getById("Products", b.dataset.admintoggle);
    await DB.update("Products", p.id, { active: !(p.active !== false) });
    router();
  });
  root.querySelectorAll("[data-admindelete]").forEach(b => b.onclick = async () => {
    if (!confirm("Remove this listing? This cannot be undone.")) return;
    await DB.remove("Products", b.dataset.admindelete);
    toast("Listing removed");
    router();
  });
}
