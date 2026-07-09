/* =========================================================
   AUTH — Google sign-in, guest mode, session persistence.
   In live mode (FIREBASE_ENABLED) this wraps Firebase Auth with
   GoogleAuthProvider. In demo mode it simulates a Google profile
   locally so the whole flow can still be exercised without a
   real Firebase project.
   ========================================================= */

const Auth = {
  currentUser: null,
  _listeners: [],

  onChange(cb) { this._listeners.push(cb); },
  _emit() { this._listeners.forEach(cb => cb(this.currentUser)); },

  async init() {
    if (FIREBASE_ENABLED) {
      fbAuth.onAuthStateChanged(async (fbUser) => {
        if (fbUser) {
          this.currentUser = await this._syncUserRecord({
            id: fbUser.uid, name: fbUser.displayName || "MarketHub User",
            email: fbUser.email, photo: fbUser.photoURL, isGuest: false
          });
        } else {
          this.currentUser = lsGet("session", null); // guest sessions persist locally
        }
        this._emit();
      });
    } else {
      this.currentUser = lsGet("session", null);
      this._emit();
    }
  },

  async _syncUserRecord(base) {
    const existing = await DB.getById("Users", base.id).catch(() => null);
    if (existing) {
      await DB.update("Users", base.id, { name: base.name, photo: base.photo });
      return { ...existing, ...base };
    }
    const record = {
      ...base, role: "customer", isSeller: false, isAdmin: base.email === "admin@markethub.demo",
      joinedAt: Date.now()
    };
    if (FIREBASE_ENABLED) { await fbDB.collection("Users").doc(base.id).set(record); }
    else { const all = lsGet("Users", []); all.push(record); lsSet("Users", all); }
    return record;
  },

  async loginWithGoogle() {
    if (FIREBASE_ENABLED) {
      const provider = new firebase.auth.GoogleAuthProvider();
      await fbAuth.signInWithPopup(provider);
      return;
    }
    // Demo mode: simulate the Google profile picker with a lightweight prompt.
    openModal(demoGoogleLoginModal());
  },

  async completeDemoGoogleLogin(name, email) {
    const id = "demo_" + btoa(email).replace(/[^a-z0-9]/gi, "").slice(0, 16);
    const user = await this._syncUserRecord({
      id, name, email, photo: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(email)}`,
      isGuest: false
    });
    this.currentUser = user;
    lsSet("session", user);
    this._emit();
    closeModal();
    toast(`Welcome back, ${name.split(" ")[0]}!`);
  },

  async continueAsGuest() {
    const guest = {
      id: lsGet("guestId", null) || uid("guest"), name: "Guest", email: null, photo: null,
      isGuest: true, role: "guest", isSeller: false, isAdmin: false
    };
    lsSet("guestId", guest.id);
    this.currentUser = guest;
    lsSet("session", guest);
    this._emit();
    closeModal();
    toast("Browsing as guest — sign in anytime to save your cart.");
  },

  async logout() {
    if (FIREBASE_ENABLED && fbAuth.currentUser) await fbAuth.signOut();
    this.currentUser = null;
    localStorage.removeItem(LS_PREFIX + "session");
    this._emit();
    location.hash = "#/home";
    toast("Signed out.");
  },

  isLoggedIn() { return !!this.currentUser && !this.currentUser.isGuest; },
  isGuest() { return !!this.currentUser?.isGuest; },
  isSeller() { return !!this.currentUser?.isSeller; },
  isAdmin() { return !!this.currentUser?.isAdmin; },

  requireLogin(message = "Please log in to continue.") {
    if (this.isLoggedIn()) return true;
    toast(message, "error");
    openModal(loginModal());
    return false;
  },

  async becomeSeller(storeName) {
    if (!this.isLoggedIn()) return false;
    await DB.update("Users", this.currentUser.id, { isSeller: true });
    this.currentUser.isSeller = true;
    lsSet("session", this.currentUser);
    await DB.add("SellerProfiles", { userId: this.currentUser.id, storeName, rating: 5, productsCount: 0 });
    this._emit();
    return true;
  }
};

function loginModal() {
  const div = document.createElement("div");
  div.className = "modal-overlay";
  div.innerHTML = `
    <div class="modal">
      <div class="modal__head"><h3>Welcome to MarketHub</h3><button class="modal__close" data-close>&times;</button></div>
      <p style="color:var(--ink-soft); margin-bottom:1.2rem">Sign in to save your cart, track orders, and sell on MarketHub.</p>
      <button class="btn btn--block" style="background:#fff;color:#1C231F;border:1.5px solid var(--line)" id="googleLoginBtn">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.5 0-14 4.2-17.3 10.4Z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 35.4 26.9 36 24 36c-5.4 0-9.9-3.3-11.4-8H5.8v5.4C9 39.7 16 44 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 3.1-3.1 5.6-5.7 7.5v.1l6.6 5.4C40.6 37.5 44 31.4 44 24c0-1.2-.1-2.4-.4-3.5Z"/></svg>
        Continue with Google
      </button>
      <button class="btn btn--ghost btn--block" style="margin-top:.7rem" id="guestLoginBtn">Continue as Guest</button>
      <p style="font-size:.75rem; color:var(--ink-soft); margin-top:1rem">${FIREBASE_ENABLED ? "" : "Demo mode: enter any name and email to simulate a Google account."}</p>
    </div>`;
  div.querySelector("[data-close]").onclick = closeModal;
  div.querySelector("#googleLoginBtn").onclick = () => Auth.loginWithGoogle();
  div.querySelector("#guestLoginBtn").onclick = () => Auth.continueAsGuest();
  div.onclick = (e) => { if (e.target === div) closeModal(); };
  return div;
}

function demoGoogleLoginModal() {
  const div = document.createElement("div");
  div.className = "modal-overlay";
  div.innerHTML = `
    <div class="modal">
      <div class="modal__head"><h3>Simulate Google Sign-in</h3><button class="modal__close" data-close>&times;</button></div>
      <form id="demoGoogleForm">
        <div class="field"><label>Full name</label><input required name="name" placeholder="Alex Rivera"/></div>
        <div class="field"><label>Email</label><input required type="email" name="email" placeholder="alex@example.com"/></div>
        <button class="btn btn--marigold btn--block" type="submit">Continue</button>
      </form>
    </div>`;
  div.querySelector("[data-close]").onclick = closeModal;
  div.querySelector("#demoGoogleForm").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Auth.completeDemoGoogleLogin(fd.get("name"), fd.get("email"));
  };
  div.onclick = (e) => { if (e.target === div) closeModal(); };
  return div;
}
