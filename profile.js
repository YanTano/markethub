/* =========================================================
   PROFILE — user dashboard: profile, orders, purchase history.
   ========================================================= */

function userDashboardTabs() {
  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "orders", label: "My Orders" }
  ];
  if (Auth.isSeller()) tabs.push({ id: "seller", label: "Seller Dashboard", route: "/dashboard/seller" });
  if (Auth.isAdmin()) tabs.push({ id: "admin", label: "Admin Panel", route: "/dashboard/admin" });
  return tabs;
}

async function renderUserDashboard(tab = "profile") {
  if (!Auth.requireLogin("Sign in to view your account")) return emptyState("Sign in required", "🔒");
  const tabs = userDashboardTabs();
  let body = "";
  if (tab === "profile") body = renderProfileTab();
  else if (tab === "orders") body = await renderOrdersTab();

  return `
    <div class="container section">
      <h2>My Account</h2>
      <div class="dash">
        <nav class="dash__nav">
          ${tabs.map(t => `<button data-dash-tab="${t.id}" data-dash-route="${t.route || ""}" class="${t.id === tab ? "active" : ""}">${t.label}</button>`).join("")}
        </nav>
        <div>${body}</div>
      </div>
    </div>`;
}

function renderProfileTab() {
  const u = Auth.currentUser;
  return `
    <div class="card--panel" style="max-width:480px">
      <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.2rem">
        ${u.photo ? `<img src="${u.photo}" class="avatar" style="width:56px;height:56px"/>` : `<div class="avatar" style="width:56px;height:56px;background:var(--bg-alt);display:flex;align-items:center;justify-content:center;font-weight:700">${(u.name||"?")[0]}</div>`}
        <div><strong>${u.name}</strong><br/><span style="color:var(--ink-soft); font-size:.85rem">${u.email || "Guest session"}</span></div>
      </div>
      <p><strong>Role:</strong> ${u.isAdmin ? "Admin" : u.isSeller ? "Seller" : u.isGuest ? "Guest" : "Customer"}</p>
      <p style="color:var(--ink-soft); font-size:.85rem">Member since ${u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : "today"}</p>
      <button class="btn btn--ghost" id="logoutBtn" style="margin-top:1rem">Log out</button>
    </div>`;
}

async function renderOrdersTab() {
  const orders = (await DB.query("Orders", o => o.userId === Auth.currentUser.id)).sort((a, b) => b.createdAt - a.createdAt);
  if (!orders.length) return emptyState("No orders yet", "📦", "Your purchase history will show up here.");
  return `
    <div class="card--panel" style="overflow-x:auto">
      <table class="datatable">
        <thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>#${o.id.slice(-6).toUpperCase()}</td>
              <td>${o.items.map(i => `${i.name} ×${i.qty}`).join(", ")}</td>
              <td>$${o.total.toFixed(2)}</td>
              <td><span class="pill pill--pending">${o.status}</span></td>
              <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function wireUserDashboardEvents(root) {
  root.querySelectorAll("[data-dash-tab]").forEach(b => b.onclick = () => {
    location.hash = b.dataset.dashRoute ? `#${b.dataset.dashRoute}` : `#/dashboard/${b.dataset.dashTab}`;
  });
  root.querySelector("#logoutBtn")?.addEventListener("click", () => Auth.logout());
}
