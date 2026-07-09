/* =========================================================
   PRODUCTS — cards, home sections, listing, details, reviews.
   ========================================================= */

function stars(rating) {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function productCard(p) {
  const unit = p.price * (1 - (p.discount || 0) / 100);
  const isFav = window.__wishlistIds?.has(p.id);
  return `
  <div class="card" data-product-card="${p.id}">
    <div class="card__imgwrap" data-goto="${p.id}">
      ${p.discount ? `<span class="tag tag--discount card__discount">-${p.discount}%</span>` : ""}
      <button class="card__fav ${isFav ? "active" : ""}" data-fav="${p.id}" aria-label="Toggle wishlist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}"><path d="M12 20s-7-4.35-9.5-8.5C.7 8 2 4.5 5.5 4a5 5 0 0 1 6.5 2 5 5 0 0 1 6.5-2C22 4.5 23.3 8 21.5 11.5 19 15.65 12 20 12 20Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      </button>
      <img src="${p.images[0]}" alt="${p.name}" loading="lazy"/>
    </div>
    <div class="card__body" data-goto="${p.id}">
      <span class="card__seller">${p.sellerName}</span>
      <span class="card__name">${p.name}</span>
      <span class="card__meta"><span class="stars">${stars(p.rating)}</span> (${p.ratingCount})</span>
      <span class="card__meta">${p.stock <= 5 ? `<span class="stock--low">Only ${p.stock} left</span>` : `${p.stock} in stock`}</span>
      <div class="card__prices">
        <span class="tag tag--price">$${unit.toFixed(2)}</span>
        ${p.discount ? `<span class="tag--old">$${p.price.toFixed(2)}</span>` : ""}
      </div>
    </div>
    <div class="card__foot" style="padding:0 .9rem .9rem">
      <button class="btn btn--outline btn--sm" style="flex:1" data-addcart="${p.id}">Add to Cart</button>
    </div>
  </div>`;
}

async function refreshWishlistCache() {
  window.__wishlistIds = new Set();
  if (Auth.currentUser) {
    const items = await Wishlist.itemsFor(Auth.currentUser.id);
    window.__wishlistIds = new Set(items.map(i => i.productId));
  }
}

function skeletonGrid(n = 8) {
  return `<div class="grid">${Array(n).fill(`<div class="card card--skeleton"><div class="skel skel--img"></div><div class="skel skel--line" style="width:80%"></div><div class="skel skel--line" style="width:40%"></div></div>`).join("")}</div>`;
}

async function renderHome() {
  await refreshWishlistCache();
  const products = await DB.getAll("Products");
  const active = products.filter(p => p.active !== false);
  const featured = [...active].sort((a, b) => b.sold - a.sold).slice(0, 8);
  const newArrivals = [...active].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const popular = [...active].sort((a, b) => (b.rating * b.ratingCount) - (a.rating * a.ratingCount)).slice(0, 8);
  const deals = active.filter(p => p.discount >= 20).slice(0, 8);

  return `
    <section class="hero">
      <div class="hero__inner">
        <div class="hero__copy">
          <span class="eyebrow">The everyday bazaar</span>
          <h1>Everything worth buying, in one open-air market.</h1>
          <p>Independent sellers, honest prices, and a search bar that actually finds what you're after. Original from stall to storefront.</p>
          <div class="hero__actions">
            <button class="btn btn--marigold" data-route-btn="/categories">Browse categories</button>
            <button class="btn btn--ghost" data-route-btn="/deals">See flash deals</button>
          </div>
        </div>
        <div class="hero__stalls">
          <div class="stall" data-route-btn="/category/electronics"><span>Electronics</span></div>
          <div class="stall" data-route-btn="/category/fashion"><span>Fashion</span></div>
          <div class="stall" data-route-btn="/category/home"><span>Home &amp; Living</span></div>
          <div class="stall" data-route-btn="/deals"><span>Flash Deals</span></div>
        </div>
      </div>
    </section>

    <div class="container section">
      <div class="section__head"><h2>Shop by category</h2></div>
      <div class="catstrip">
        ${CATEGORIES.map(c => `
          <div class="catchip" data-route-btn="/category/${c.id}">
            <span class="catchip__icon">${c.icon}</span>
            <span class="catchip__label">${c.name}</span>
          </div>`).join("")}
      </div>
    </div>

    ${productRow("⚡ Flash Deals", deals, "/deals")}
    ${productRow("Featured Products", featured, "/search?sort=popularity")}
    ${productRow("New Arrivals", newArrivals, "/search?sort=newest")}
    ${productRow("Popular Right Now", popular, "/search?sort=rating")}
  `;
}

function productRow(title, products, seeAllRoute) {
  if (!products.length) return "";
  return `
    <div class="container section">
      <div class="section__head">
        <h2>${title}</h2>
        <a href="#${seeAllRoute}" data-route="${seeAllRoute}">See all →</a>
      </div>
      <div class="grid">${products.map(productCard).join("")}</div>
    </div>`;
}

async function renderCategories() {
  return `
    <div class="container section">
      <h2>All Categories</h2>
      <div class="catstrip" style="flex-wrap:wrap">
        ${CATEGORIES.map(c => `
          <div class="catchip" style="width:140px" data-route-btn="/category/${c.id}">
            <span class="catchip__icon" style="width:84px;height:84px;font-size:2rem">${c.icon}</span>
            <span class="catchip__label">${c.name}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

async function renderProductDetail(productId) {
  const p = await DB.getById("Products", productId);
  if (!p) return emptyState("Product not found", "📦");
  await refreshWishlistCache();
  const isFav = window.__wishlistIds.has(p.id);
  const unit = p.price * (1 - (p.discount || 0) / 100);
  const reviews = (await DB.query("Reviews", r => r.productId === p.id)).sort((a, b) => b.createdAt - a.createdAt);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : p.rating;

  return `
    <div class="container section">
      <div class="pd">
        <div class="pd__gallery">
          <div class="pd__mainimg"><img id="pdMainImg" src="${p.images[0]}" alt="${p.name}"/></div>
          <div class="pd__thumbs">
            ${p.images.map((img, i) => `<img src="${img}" class="${i === 0 ? "active" : ""}" data-thumb="${img}"/>`).join("")}
          </div>
        </div>
        <div class="pd__info">
          <span class="eyebrow">${CATEGORIES.find(c => c.id === p.category)?.name || p.category}</span>
          <h1>${p.name}</h1>
          <div class="card__meta"><span class="stars">${stars(avg)}</span> ${avg} (${reviews.length || p.ratingCount} reviews) · Sold by <strong>${p.sellerName}</strong></div>
          <div class="pd__price">
            <span class="tag tag--price" style="font-size:1.4rem">$${unit.toFixed(2)}</span>
            ${p.discount ? `<span class="tag--old">$${p.price.toFixed(2)}</span><span class="tag tag--discount">-${p.discount}%</span>` : ""}
          </div>
          <p style="color:var(--ink-soft)">${p.description}</p>
          <p style="font-size:.85rem">${p.stock > 0 ? (p.stock <= 5 ? `<span class="stock--low">Only ${p.stock} left in stock</span>` : `${p.stock} available`) : `<span class="stock--low">Out of stock</span>`}</p>

          <div class="pd__qty">
            <button id="qtyMinus">−</button>
            <input id="qtyInput" value="1" readonly/>
            <button id="qtyPlus">+</button>
          </div>

          <div class="pd__actions">
            <button class="btn btn--outline" style="flex:1" id="addToCartBtn" ${p.stock === 0 ? "disabled" : ""}>Add to Cart</button>
            <button class="btn btn--marigold" style="flex:1" id="buyNowBtn" ${p.stock === 0 ? "disabled" : ""}>Buy Now</button>
            <button class="iconbtn" style="border:1px solid var(--line)" id="favToggleBtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? "var(--terracotta)" : "none"}"><path d="M12 20s-7-4.35-9.5-8.5C.7 8 2 4.5 5.5 4a5 5 0 0 1 6.5 2 5 5 0 0 1 6.5-2C22 4.5 23.3 8 21.5 11.5 19 15.65 12 20 12 20Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            </button>
          </div>

          <div class="tabs">
            <button class="active" data-tab="desc">Description</button>
            <button data-tab="seller">Seller Info</button>
            <button data-tab="reviews">Reviews (${reviews.length})</button>
          </div>
          <div id="tabPanels">
            <div data-panel="desc">
              <p>${p.description}</p>
              <p style="font-size:.85rem; color:var(--ink-soft)">Tags: ${p.tags.join(", ")}</p>
            </div>
            <div data-panel="seller" hidden>
              <p><strong>${p.sellerName}</strong></p>
              <p style="color:var(--ink-soft); font-size:.9rem">Independent seller on MarketHub. Ships within 2 business days.</p>
            </div>
            <div data-panel="reviews" hidden>${renderReviewsPanel(reviews, p.id)}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderReviewsPanel(reviews, productId) {
  return `
    ${Auth.isLoggedIn() ? `
      <form id="reviewForm" class="card--panel" style="margin-bottom:1.2rem">
        <div class="field"><label>Your rating</label>
          <select name="rating">${[5,4,3,2,1].map(n => `<option value="${n}">${n} star${n>1?"s":""}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Your review</label><textarea name="comment" required placeholder="Share your experience…"></textarea></div>
        <div class="field"><label>Photos (optional)</label><input type="file" name="images" accept="image/*" multiple/></div>
        <button class="btn btn--marigold" type="submit">Submit Review</button>
      </form>` : `<p style="color:var(--ink-soft)">Sign in to write a review.</p>`}
    ${reviews.length ? reviews.map(r => `
      <div class="review" data-review-id="${r.id}">
        <div class="review__head">
          <span><strong>${r.author}</strong> <span class="stars">${stars(r.rating)}</span></span>
          <span style="color:var(--ink-soft)">${timeAgo(r.createdAt)}</span>
        </div>
        <p>${r.comment}</p>
        ${r.images?.length ? `<div class="review__imgs">${r.images.map(im => `<img src="${im}"/>`).join("")}</div>` : ""}
        ${Auth.currentUser && r.authorId === Auth.currentUser.id ? `
          <div style="margin-top:.4rem"><button class="btn btn--sm btn--ghost" data-editreview="${r.id}">Edit</button>
          <button class="btn btn--sm btn--ghost" data-deletereview="${r.id}">Delete</button></div>` : ""}
      </div>`).join("") : `<p style="color:var(--ink-soft)">No reviews yet — be the first.</p>`}
    <div id="reviewsContainer" data-product-for-reviews="${productId}"></div>`;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function emptyState(title, icon = "📦", body = "") {
  return `<div class="container"><div class="emptystate"><div style="font-size:3rem">${icon}</div><h3>${title}</h3><p>${body}</p></div></div>`;
}

/* -------- shared event wiring for any screen that renders product cards -------- */
function wireProductCardEvents(root) {
  root.querySelectorAll("[data-goto]").forEach(el => el.onclick = () => { location.hash = `#/product/${el.dataset.goto}`; });
  root.querySelectorAll("[data-addcart]").forEach(el => el.onclick = async (e) => {
    e.stopPropagation();
    if (!Auth.currentUser) return openModal(loginModal());
    await Cart.add(Auth.currentUser.id, el.dataset.addcart, 1);
    toast("Added to cart");
  });
  root.querySelectorAll("[data-fav]").forEach(el => el.onclick = async (e) => {
    e.stopPropagation();
    if (!Auth.requireLogin("Sign in to save to wishlist")) return;
    const nowFav = await Wishlist.toggle(Auth.currentUser.id, el.dataset.fav);
    el.classList.toggle("active", nowFav);
    toast(nowFav ? "Saved to wishlist" : "Removed from wishlist");
  });
  root.querySelectorAll("[data-route-btn]").forEach(el => el.onclick = () => { location.hash = `#${el.dataset.routeBtn}`; });
}

function wireProductDetailEvents(root, productId) {
  const qtyInput = root.querySelector("#qtyInput");
  root.querySelector("#qtyMinus")?.addEventListener("click", () => { qtyInput.value = Math.max(1, +qtyInput.value - 1); });
  root.querySelector("#qtyPlus")?.addEventListener("click", () => { qtyInput.value = +qtyInput.value + 1; });

  root.querySelectorAll("[data-thumb]").forEach(t => t.onclick = () => {
    root.querySelector("#pdMainImg").src = t.dataset.thumb;
    root.querySelectorAll("[data-thumb]").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
  });

  root.querySelectorAll("[data-tab]").forEach(tabBtn => tabBtn.onclick = () => {
    root.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
    tabBtn.classList.add("active");
    root.querySelectorAll("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== tabBtn.dataset.tab);
  });

  root.querySelector("#addToCartBtn")?.addEventListener("click", async () => {
    if (!Auth.requireLogin()) return;
    await Cart.add(Auth.currentUser.id, productId, +qtyInput.value);
    toast("Added to cart");
  });
  root.querySelector("#buyNowBtn")?.addEventListener("click", async () => {
    if (!Auth.requireLogin()) return;
    await Cart.add(Auth.currentUser.id, productId, +qtyInput.value);
    location.hash = "#/checkout";
  });
  root.querySelector("#favToggleBtn")?.addEventListener("click", async () => {
    if (!Auth.requireLogin()) return;
    const nowFav = await Wishlist.toggle(Auth.currentUser.id, productId);
    toast(nowFav ? "Saved to wishlist" : "Removed from wishlist");
    router();
  });

  root.querySelector("#reviewForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const files = fd.getAll("images").filter(f => f.size);
    const images = await Promise.all(files.map(f => DB.uploadImage(f, "reviews")));
    await DB.add("Reviews", {
      productId, authorId: Auth.currentUser.id, author: Auth.currentUser.name,
      rating: +fd.get("rating"), comment: fd.get("comment"), images
    });
    toast("Review submitted");
    router();
  });
  root.querySelectorAll("[data-deletereview]").forEach(b => b.onclick = async () => {
    await DB.remove("Reviews", b.dataset.deletereview); toast("Review deleted"); router();
  });
  root.querySelectorAll("[data-editreview]").forEach(b => b.onclick = async () => {
    const rev = await DB.getById("Reviews", b.dataset.editreview);
    const newComment = prompt("Edit your review:", rev.comment);
    if (newComment != null) { await DB.update("Reviews", rev.id, { comment: newComment }); router(); }
  });
}
