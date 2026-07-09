/* =========================================================
   SEARCH — instant search, category listing, filters, sorting.
   ========================================================= */

function parseQueryString(qs) {
  const params = new URLSearchParams(qs || "");
  return Object.fromEntries(params.entries());
}

async function renderSearchResults(params = {}, categoryId = null) {
  await refreshWishlistCache();
  let products = await DB.getAll("Products");
  products = products.filter(p => p.active !== false);

  if (categoryId) products = products.filter(p => p.category === categoryId);
  if (params.q) {
    const q = params.q.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) ||
      p.sellerName.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)));
  }
  if (params.minPrice) products = products.filter(p => p.price >= +params.minPrice);
  if (params.maxPrice) products = products.filter(p => p.price <= +params.maxPrice);
  if (params.minRating) products = products.filter(p => p.rating >= +params.minRating);
  if (params.deals) products = products.filter(p => p.discount >= 20);

  const sort = params.sort || "newest";
  const sorters = {
    newest: (a, b) => b.createdAt - a.createdAt,
    price: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    popularity: (a, b) => b.sold - a.sold
  };
  products.sort(sorters[sort] || sorters.newest);

  const title = categoryId ? (CATEGORIES.find(c => c.id === categoryId)?.name || categoryId)
    : params.deals ? "⚡ Flash Deals"
    : params.q ? `Results for “${params.q}”` : "All Products";

  return `
    <div class="container section">
      <h2>${title}</h2>
      <div class="filterpanel">
        <aside class="filterpanel__side">
          <h4>Category</h4>
          <label><input type="radio" name="fcat" value="" ${!categoryId ? "checked" : ""}/> All</label>
          ${CATEGORIES.map(c => `<label><input type="radio" name="fcat" value="${c.id}" ${categoryId === c.id ? "checked" : ""}/> ${c.icon} ${c.name}</label>`).join("")}
          <h4 style="margin-top:1.2rem">Price</h4>
          <div class="field"><input type="number" id="minPrice" placeholder="Min" value="${params.minPrice || ""}"/></div>
          <div class="field"><input type="number" id="maxPrice" placeholder="Max" value="${params.maxPrice || ""}"/></div>
          <h4 style="margin-top:1.2rem">Minimum rating</h4>
          ${[4,3,2,1].map(r => `<label><input type="radio" name="frating" value="${r}" ${params.minRating == r ? "checked" : ""}/> ${"★".repeat(r)}${"☆".repeat(5-r)} &amp; up</label>`).join("")}
          <label><input type="radio" name="frating" value="" ${!params.minRating ? "checked" : ""}/> Any rating</label>
          <button class="btn btn--outline btn--block" id="applyFiltersBtn" style="margin-top:1rem">Apply Filters</button>
        </aside>
        <div>
          <div class="toolbar">
            <select class="select" id="sortSelect">
              <option value="newest" ${sort==="newest"?"selected":""}>Newest</option>
              <option value="price" ${sort==="price"?"selected":""}>Price: Low to High</option>
              <option value="priceDesc" ${sort==="priceDesc"?"selected":""}>Price: High to Low</option>
              <option value="rating" ${sort==="rating"?"selected":""}>Rating</option>
              <option value="popularity" ${sort==="popularity"?"selected":""}>Popularity</option>
            </select>
            <span style="color:var(--ink-soft); font-size:.85rem">${products.length} products</span>
          </div>
          ${products.length ? `<div class="grid">${products.map(productCard).join("")}</div>` : emptyState("No products match", "🔍", "Try adjusting your filters or search terms.")}
        </div>
      </div>
    </div>`;
}

function wireSearchEvents(root, currentParams, categoryId) {
  const goto = (overrides) => {
    const merged = { ...currentParams, ...overrides };
    Object.keys(merged).forEach(k => (merged[k] === "" || merged[k] == null) && delete merged[k]);
    const qs = new URLSearchParams(merged).toString();
    location.hash = categoryId ? `#/category/${categoryId}${qs ? "?" + qs : ""}` : `#/search${qs ? "?" + qs : ""}`;
  };
  root.querySelector("#sortSelect")?.addEventListener("change", (e) => goto({ sort: e.target.value }));
  root.querySelector("#applyFiltersBtn")?.addEventListener("click", () => {
    const cat = root.querySelector("input[name=fcat]:checked")?.value;
    const rating = root.querySelector("input[name=frating]:checked")?.value;
    const minPrice = root.querySelector("#minPrice").value;
    const maxPrice = root.querySelector("#maxPrice").value;
    if (cat) { location.hash = `#/category/${cat}`; return; }
    goto({ minPrice, maxPrice, minRating: rating });
  });
}

/* Instant search-as-you-type in the top bar */
function wireGlobalSearch() {
  const form = document.getElementById("searchForm");
  const input = document.getElementById("searchInput");
  let debounce;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim()) location.hash = `#/search?q=${encodeURIComponent(input.value.trim())}`;
  });
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (input.value.trim().length > 1) location.hash = `#/search?q=${encodeURIComponent(input.value.trim())}`;
    }, 450);
  });
}
