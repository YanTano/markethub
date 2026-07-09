/* =========================================================
   APP — router, theming, toasts, modals, nav wiring.
   ========================================================= */

/* ---------- Toasts ---------- */
function toast(message, type = "success") {
  const host = document.getElementById("toastHost");
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- Modals ---------- */
function openModal(el) { document.getElementById("modalRoot").innerHTML = ""; document.getElementById("modalRoot").appendChild(el); }
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

/* ---------- Theme ---------- */
function initTheme() {
  const saved = localStorage.getItem(LS_PREFIX + "theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", saved);
  syncThemeIcon(saved);
  document.getElementById("themeToggle").onclick = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(LS_PREFIX + "theme", next);
    syncThemeIcon(next);
  };
}
function syncThemeIcon(theme) {
  document.getElementById("themeIconSun").style.display = theme === "dark" ? "none" : "block";
  document.getElementById("themeIconMoon").style.display = theme === "dark" ? "block" : "none";
}

/* ---------- Nav / badges / user menu ---------- */
async function updateBadges() {
  const u = Auth.currentUser;
  const [cartCount, wishCount, notifCount] = await Promise.all([
    u ? Cart.count(u.id) : 0, u ? Wishlist.itemsFor(u.id).then(l => l.length) : 0, u ? Notify.unreadCount(u.id) : 0
  ]);
  setBadge("cartBadge", cartCount);
  setBadge("wishlistBadge", wishCount);
  setBadge("notifBadge", notifCount);
}
function setBadge(id, count) {
  const el = document.getElementById(id);
  el.hidden = !count;
  el.textContent = count > 99 ? "99+" : count;
}

function renderUserZone() {
  const zone = document.getElementById("userZone");
  const u = Auth.currentUser;
  if (!u) { zone.innerHTML = `<button class="btn btn--ghost" id="loginBtn">Log in</button>`; zone.querySelector("#loginBtn").onclick = () => openModal(loginModal()); return; }
  zone.innerHTML = `
    <div class="userchip" id="userChip">
      ${u.photo ? `<img class="avatar" src="${u.photo}"/>` : `<div class="avatar" style="background:var(--bg-alt); display:flex; align-items:center; justify-content:center; font-weight:700">${(u.name || "G")[0]}</div>`}
      <span class="userchip__name">${u.isGuest ? "Guest" : u.name}</span>
    </div>
    <div class="usermenu" id="userMenu">
      <a href="#/dashboard" data-route="/dashboard">👤 My Account</a>
      <a href="#/dashboard/orders" data-route="/dashboard/orders">📦 My Orders</a>
      <a href="#/wishlist" data-route="/wishlist">🤍 Wishlist</a>
      <a href="#/cart" data-route="/cart">🛒 Cart</a>
      ${u.isSeller ? `<a href="#/dashboard/seller" data-route="/dashboard/seller">🏷️ Seller Dashboard</a>` : `<a href="#/seller" data-route="/seller">🏷️ Become a Seller</a>`}
      ${u.isAdmin ? `<a href="#/dashboard/admin" data-route="/dashboard/admin">🛡️ Admin Panel</a>` : ""}
      <hr/>
      <button id="logoutMenuBtn">↩ Log out</button>
    </div>`;
  const chip = zone.querySelector("#userChip"), menu = zone.querySelector("#userMenu");
  chip.onclick = () => menu.classList.toggle("open");
  document.addEventListener("click", (e) => { if (!zone.contains(e.target)) menu.classList.remove("open"); });
  zone.querySelector("#logoutMenuBtn").onclick = () => Auth.logout();
}

/* ---------- Static content pages ---------- */
const STATIC_PAGES = {
  about: { title: "About MarketHub", body: "MarketHub is an independent marketplace connecting everyday sellers with everyday buyers. This build is a demo showcasing a full marketplace experience powered entirely by Firebase." },
  contact: { title: "Contact Us", body: "Questions or feedback? Reach the MarketHub team at support@markethub.demo — we typically respond within one business day." },
  privacy: { title: "Privacy Policy", body: "MarketHub collects only the information required to operate your account, cart, and orders. Data is stored in Firebase Authentication, Firestore, and Storage, and is never sold to third parties." },
  terms: { title: "Terms of Service", body: "By using MarketHub you agree to list and purchase items in good faith, provide accurate information, and follow applicable consumer-protection laws. Sellers are responsible for the accuracy of their own listings." },
  faq: { title: "Frequently Asked Questions", body: "How do I sell? Head to \u201cSell on MarketHub\u201d and open your stall. How do I track an order? Visit My Account \u2192 My Orders. What payment methods are supported? Cash on Delivery, and demo Credit Card / GCash flows for this build." }
};
function renderStaticPage(key) {
  const p = STATIC_PAGES[key];
  if (!p) return emptyState("Page not found", "🧭");
  return `<div class="container section" style="max-width:720px"><h2>${p.title}</h2><p style="color:var(--ink-soft); line-height:1.7">${p.body}</p></div>`;
}

/* ---------- Router ---------- */
async function router() {
  const main = document.getElementById("main");
  const hash = location.hash.replace(/^#/, "") || "/home";
  const [pathPart, queryPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const params = parseQueryString(queryPart);

  main.innerHTML = skeletonGrid(4);
  window.scrollTo({ top: 0 });

  try {
    if (segments[0] === "home" || segments.length === 0) {
      main.innerHTML = await renderHome();
    } else if (segments[0] === "categories") {
      main.innerHTML = await renderCategories();
    } else if (segments[0] === "category" && segments[1]) {
      main.innerHTML = await renderSearchResults(params, segments[1]);
      wireSearchEvents(main, params, segments[1]);
    } else if (segments[0] === "search") {
      main.innerHTML = await renderSearchResults(params);
      wireSearchEvents(main, params, null);
    } else if (segments[0] === "deals") {
      main.innerHTML = await renderSearchResults({ ...params, deals: "1" });
      wireSearchEvents(main, { ...params, deals: "1" }, null);
    } else if (segments[0] === "product" && segments[1]) {
      main.innerHTML = await renderProductDetail(segments[1]);
      wireProductDetailEvents(main, segments[1]);
    } else if (segments[0] === "cart") {
      main.innerHTML = await renderCart(); wireCartEvents(main);
    } else if (segments[0] === "checkout") {
      main.innerHTML = await renderCheckout(); wireCheckoutEvents(main);
    } else if (segments[0] === "order-confirmation" && segments[1]) {
      main.innerHTML = await renderOrderConfirmation(segments[1]);
    } else if (segments[0] === "wishlist") {
      main.innerHTML = await renderWishlist(); wireProductCardEvents(main);
    } else if (segments[0] === "notifications") {
      main.innerHTML = await renderNotifications();
    } else if (segments[0] === "seller" && !segments[1]) {
      main.innerHTML = await renderSellerLanding(); wireSellerLandingEvents(main);
    } else if (segments[0] === "dashboard" && segments[1] === "seller") {
      main.innerHTML = await renderSellerDashboard(segments[2] || "products"); wireSellerDashboardEvents(main);
    } else if (segments[0] === "dashboard" && segments[1] === "admin") {
      main.innerHTML = await renderAdminDashboard(segments[2] || "analytics"); wireAdminDashboardEvents(main);
    } else if (segments[0] === "dashboard") {
      main.innerHTML = await renderUserDashboard(segments[1] || "profile"); wireUserDashboardEvents(main);
    } else if (STATIC_PAGES[segments[0]]) {
      main.innerHTML = renderStaticPage(segments[0]);
    } else {
      main.innerHTML = emptyState("Page not found", "🧭", "Let's get you back to the marketplace.");
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = emptyState("Something went wrong", "⚠️", "Please try again.");
  }

  wireProductCardEvents(main);
  highlightActiveNav(segments[0] ? `/${segments[0]}` : "/home");
  updateBadges();
}

function highlightActiveNav(routeBase) {
  document.querySelectorAll("[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === routeBase));
}

/* ---------- Mobile menu ---------- */
function initMobileMenu() {
  const btn = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");
  btn.onclick = () => {
    const willOpen = !menu.classList.contains("open");
    menu.classList.toggle("open", willOpen);
    menu.hidden = false; // let the .open class control visibility, not the attribute
    btn.setAttribute("aria-expanded", String(willOpen));
  };
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }));
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

/* ---------- Boot ---------- */
document.getElementById("year").textContent = new Date().getFullYear();

async function boot() {
  initTheme();
  initMobileMenu();
  wireGlobalSearch();
  await Auth.init();
  Auth.onChange(() => { renderUserZone(); updateBadges(); });
  renderUserZone();
  window.addEventListener("hashchange", router);
  await router();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("[MarketHub] Service worker not registered:", err));
  }
}
boot();
