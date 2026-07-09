/* =========================================================
   DB — thin data-access layer.
   Every other module talks to `DB`, never to Firestore or
   localStorage directly. When FIREBASE_ENABLED is true, calls
   are forwarded to Firestore. Otherwise everything is persisted
   to localStorage so the whole app is usable instantly as a demo.

   Collections (mirrors the Firestore structure the real backend
   should use):
   Users, Products, Categories, Orders, OrderItems, Cart,
   Wishlist, Reviews, Notifications, SellerProfiles, Addresses
   ========================================================= */

const LS_PREFIX = "markethub:";

function lsGet(key, fallback) {
  try { const raw = localStorage.getItem(LS_PREFIX + key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); }
function uid(prefix = "id") { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

const DB = {
  mode: FIREBASE_ENABLED ? "firebase" : "demo",

  async getAll(collection) {
    if (FIREBASE_ENABLED) {
      const snap = await fbDB.collection(collection).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return lsGet(collection, []);
  },

  async getById(collection, id) {
    if (FIREBASE_ENABLED) {
      const doc = await fbDB.collection(collection).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }
    const all = lsGet(collection, []);
    return all.find(x => x.id === id) || null;
  },

  async query(collection, predicate) {
    const all = await this.getAll(collection);
    return predicate ? all.filter(predicate) : all;
  },

  async add(collection, data) {
    if (FIREBASE_ENABLED) {
      const ref = await fbDB.collection(collection).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { id: ref.id, ...data };
    }
    const all = lsGet(collection, []);
    const record = { id: uid(collection.slice(0, 3).toLowerCase()), ...data, createdAt: Date.now() };
    all.unshift(record);
    lsSet(collection, all);
    return record;
  },

  async update(collection, id, patch) {
    if (FIREBASE_ENABLED) {
      await fbDB.collection(collection).doc(id).update(patch);
      return true;
    }
    const all = lsGet(collection, []);
    const idx = all.findIndex(x => x.id === id);
    if (idx > -1) { all[idx] = { ...all[idx], ...patch }; lsSet(collection, all); }
    return true;
  },

  async remove(collection, id) {
    if (FIREBASE_ENABLED) {
      await fbDB.collection(collection).doc(id).delete();
      return true;
    }
    const all = lsGet(collection, []).filter(x => x.id !== id);
    lsSet(collection, all);
    return true;
  },

  /** Upload one image file, returns a usable URL. In demo mode we just
   * inline it as a base64 data URL so no server round-trip is required. */
  async uploadImage(file, pathHint = "uploads") {
    if (FIREBASE_ENABLED && fbStorage) {
      const ref = fbStorage.ref().child(`${pathHint}/${uid("img")}_${file.name}`);
      await ref.put(file);
      return await ref.getDownloadURL();
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};

/* ---------------------------------------------------------
   DEMO SEED DATA — only written once, on first load, so a
   fresh browser has a populated marketplace to explore.
   --------------------------------------------------------- */
const CATEGORIES = [
  { id: "electronics", name: "Electronics", icon: "🔌" },
  { id: "fashion", name: "Fashion", icon: "👗" },
  { id: "home", name: "Home & Living", icon: "🛋️" },
  { id: "beauty", name: "Beauty", icon: "💄" },
  { id: "food", name: "Food", icon: "🍱" },
  { id: "gaming", name: "Gaming", icon: "🎮" },
  { id: "sports", name: "Sports", icon: "🏸" },
  { id: "automotive", name: "Automotive", icon: "🚗" },
  { id: "books", name: "Books", icon: "📚" },
  { id: "pets", name: "Pets", icon: "🐾" }
];

function seedProducts() {
  const names = {
    electronics: ["Wireless ANC Headphones", "27\" QHD Monitor", "Mechanical Keyboard", "Portable SSD 1TB", "Smart Home Hub"],
    fashion: ["Linen Overshirt", "High-Rise Denim", "Merino Crewneck", "Canvas Tote Bag", "Everyday Sneakers"],
    home: ["Ceramic Pour-Over Set", "Woven Storage Basket", "Linen Throw Pillow", "Bamboo Cutting Board", "Table Lamp, Amber Glass"],
    beauty: ["Vitamin C Serum", "Clay Cleansing Bar", "Refillable Perfume", "Bamboo Brush Set", "SPF 50 Daily Lotion"],
    food: ["Single-Origin Coffee Beans", "Artisan Honey Jar", "Chili Crisp Trio", "Herbal Tea Sampler", "Dark Chocolate Bark"],
    gaming: ["Wireless Pro Controller", "RGB Mousepad XL", "Streaming Mic Kit", "Retro Console Bundle", "Ergonomic Gaming Chair"],
    sports: ["Trail Running Shoes", "Adjustable Dumbbell Set", "Yoga Mat, Cork", "Insulated Water Bottle", "Badminton Racket Pro"],
    automotive: ["Dash Cam 4K", "Microfiber Detail Kit", "Tire Inflator, Portable", "Phone Mount, Magnetic", "LED Fog Light Set"],
    books: ["Atlas of Forgotten Places", "The Slow Kitchen", "Notes on Craft", "Field Guide to Fungi", "Letters to a Young Maker"],
    pets: ["Orthopedic Pet Bed", "Slow-Feed Bowl", "Woven Cat Tunnel", "Adjustable Dog Harness", "Freeze-Dried Treats"]
  };
  const sellers = ["North & Fable Co.", "Kettle & Kin", "Basin Supply", "Marrow Goods", "Talus Trade", "Petal & Pine"];
  const list = [];
  Object.entries(names).forEach(([cat, items]) => {
    items.forEach((n, i) => {
      const price = Math.round((15 + Math.random() * 180) * 100) / 100;
      const hasDiscount = Math.random() > 0.55;
      const discount = hasDiscount ? Math.round(10 + Math.random() * 35) : 0;
      list.push({
        id: uid("prd"),
        name: n,
        category: cat,
        brand: sellers[(i + cat.length) % sellers.length],
        sellerId: "demo-seller-1",
        sellerName: sellers[(i + cat.length) % sellers.length],
        price,
        discount,
        stock: Math.floor(Math.random() * 60),
        rating: Math.round((3.4 + Math.random() * 1.6) * 10) / 10,
        ratingCount: Math.floor(20 + Math.random() * 900),
        sold: Math.floor(Math.random() * 3000),
        tags: [cat, n.split(" ")[0].toLowerCase()],
        description: `${n} — thoughtfully made and built to last. A MarketHub favorite in the ${cat} stall, chosen for everyday quality without the markup.`,
        images: [1, 2, 3].map(k => `https://picsum.photos/seed/${encodeURIComponent(n)}${k}/600/600`),
        active: true,
        createdAt: Date.now() - Math.floor(Math.random() * 1e10)
      });
    });
  });
  return list;
}

function seedDemoDataIfNeeded() {
  if (FIREBASE_ENABLED) return;
  if (!lsGet("Categories", null)) lsSet("Categories", CATEGORIES);
  if (!lsGet("Products", null)) lsSet("Products", seedProducts());
  if (!lsGet("Users", null)) lsSet("Users", []);
  if (!lsGet("Orders", null)) lsSet("Orders", []);
  if (!lsGet("Reviews", null)) lsSet("Reviews", seedReviews());
  if (!lsGet("Notifications", null)) lsSet("Notifications", []);
  if (!lsGet("SellerProfiles", null)) lsSet("SellerProfiles", []);
}

function seedReviews() {
  const products = lsGet("Products", []);
  const sample = products.slice(0, 10);
  const authors = ["Jules M.", "Priya R.", "Andre K.", "Wren T.", "Sam O."];
  const comments = [
    "Exactly as described and arrived faster than expected.",
    "Good value — a bit smaller than I imagined, but solid quality.",
    "My second time ordering from this seller. Consistently great.",
    "Packaging was thoughtful, product feels durable.",
    "Would recommend, matched the listing photos closely."
  ];
  return sample.map((p, i) => ({
    id: uid("rev"),
    productId: p.id,
    author: authors[i % authors.length],
    rating: 4 + (i % 2),
    comment: comments[i % comments.length],
    images: [],
    createdAt: Date.now() - i * 8.64e7
  }));
}

seedDemoDataIfNeeded();
