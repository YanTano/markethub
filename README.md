# MarketHub

A complete, original-design e-commerce marketplace — HTML5, CSS3, vanilla ES6 JavaScript, and Firebase (Auth, Firestore, Storage). No backend server required.

Runs in two modes automatically:

- **Demo mode (default):** works instantly, no setup. All data lives in your browser's `localStorage`, and "Continue with Google" is simulated with a simple name/email form so you can try every role (customer, seller, admin) without a real Firebase project.
- **Live mode:** add your Firebase project's config to `firebase-config.js` and MarketHub automatically switches to real Firebase Authentication, Firestore, and Storage — no other code changes needed.

## Quick start (demo mode)

Just open `index.html` in a browser, or serve the folder locally:

```bash
npx serve .
```

Try it as different roles:
- **Customer:** "Continue with Google" (any name/email) or "Continue as Guest".
- **Seller:** log in, then click "Sell on MarketHub" → open a stall → add products.
- **Admin:** log in with the email `admin@markethub.demo` (any name) — this account is auto-granted admin rights in demo mode.

## Going live with real Firebase

1. Create a project at https://console.firebase.google.com.
2. Enable **Authentication → Sign-in method → Google**.
3. Create a **Firestore Database** (start in production mode).
4. Enable **Storage**.
5. Copy your web app config into `firebase-config.js`, replacing the placeholder values.
6. Deploy security rules and hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init            # select Hosting, Firestore, Storage — reuse existing firebase.json
firebase deploy
```

Firestore rules are in `firestore.rules`, Storage rules in `storage.rules` — both implement the role-based permissions described below and deploy automatically with `firebase deploy`.

To make a real user an admin in live mode, manually set `isAdmin: true` on their document in the `Users` collection from the Firebase console (there is intentionally no in-app way to self-grant admin).

## Firestore collections

| Collection | Purpose |
|---|---|
| `Users` | Profile, role flags (`isSeller`, `isAdmin`) |
| `Products` | Listings: name, price, discount, stock, images, sellerId, active |
| `Categories` | Fixed taxonomy (Electronics, Fashion, Home & Living, …) |
| `Orders` | Placed orders: items, totals, address, delivery, payment, status |
| `OrderItems` | Line-item records per order (kept alongside `Orders.items` for reporting) |
| `Cart` | Per-user cart lines, incl. "saved for later" |
| `Wishlist` | Saved products per user |
| `Reviews` | Product reviews: rating, comment, photos |
| `Notifications` | Order updates, promotions, stock alerts per user |
| `SellerProfiles` | Store name and stats for sellers |
| `Addresses` | Saved shipping addresses per user |

## Security model

- Guests can browse everything but cannot cart, wishlist, review, or purchase.
- Only a seller can create/edit/delete their **own** products (`sellerId` must match the signed-in uid).
- Only admins can deactivate/delete any listing, manage users, or view analytics.
- Cart, Wishlist, Addresses, and Notifications are private per-user documents.
- See `firestore.rules` and `storage.rules` for the full rule set.

## Project structure

```
index.html          Single-page shell (all views render into #main)
style.css            Design tokens + full responsive layout, light & dark themes
firebase-config.js   Firebase project config (edit this to go live)
db.js                Data-access layer (Firestore ⇄ localStorage) + demo seed data
auth.js              Google login, guest mode, session, role helpers
products.js          Product cards, home sections, product detail, reviews
search.js            Instant search, category filters, price/rating filters, sorting
cart.js              Cart CRUD, save-for-later, order summary math
checkout.js          Address form, delivery option, mock payments, confirmation
wishlist.js          Wishlist CRUD
seller.js            Seller onboarding + dashboard (add/edit/delete products, orders)
admin.js             Admin dashboard (users, products, categories, analytics)
profile.js           User dashboard (profile, orders)
notifications.js     Notification center + unread badge
app.js               Hash router, theme toggle, toasts, modals, nav wiring
firestore.rules       Firestore security rules
storage.rules         Storage security rules
firebase.json         Hosting/Firestore/Storage deploy config
manifest.json / sw.js PWA manifest + offline app-shell caching
assets/               Original SVG mark (no third-party icons/branding)
```

## Notes on mock payments

Credit Card and GCash payment methods are **demo-only** — no real payment processor is called. Swap in Stripe, PayMongo, or another provider inside `checkout.js` (`#placeOrderBtn` handler) when you're ready to accept real payments.
