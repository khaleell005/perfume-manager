# Perfume Manager

A private, single-owner inventory, sales, expenses, and invoicing app. React + Vite + TypeScript + Tailwind, with a local Node.js API and SQLite database. Firebase initialization and configuration are commented out.

## Run locally

Use **Node.js 22.13 or newer** for its built-in SQLite support.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. On first launch, create your workspace owner account with an email and a password of at least 8 characters. Future visits show the sign-in form. There is no default password and no Firebase configuration is required.

SQLite automatically creates `data/perfume.sqlite`. Accounts, sessions, inventory, customers, sales, expenses, stock history, and settings persist there across browser refreshes and app restarts. The database stays on the machine running the Node server. Database files and `.env` are ignored by Git.

The development server includes the API, so only one command is needed. Keep the server running while using the app.

## Build and run

```sh
npm run build
npm start
```

The Node server serves the built frontend and SQLite API together at `http://127.0.0.1:4173`. `npm run preview` also includes the SQLite API. Static-only hosting is insufficient for this version.

Optional settings can be copied from `.env.example` into `.env`:

- `SQLITE_PATH`: database file location (default `data/perfume.sqlite`).
- `HOST` and `PORT`: address used by `npm start`.
- `COOKIE_SECURE=true`: use when the server is accessed over HTTPS.

Restart the server after changing configuration. Firebase files remain as references; they are not used by the app. Existing Firebase records are not automatically imported into SQLite.

## Optional admin seeding and password recovery

You can create the first owner through the app. For command-line setup instead, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```sh
npm run seed:admin
```

Seeding an existing owner preserves their password and rejects a different owner email. To recover a forgotten password, set the existing owner's email and a new password in `.env`, then explicitly run:

```sh
npm run seed:admin -- --reset-password
```

Remove `ADMIN_PASSWORD` from `.env` afterward. Passwords are stored as salted hashes. Sessions use HTTP-only cookies, and a password change invalidates previous sessions. Signed-in owners can change their password in Settings.

## Admin guide

- **Products:** Add a perfume name, category, ml size, selling price, quantity, and low-stock threshold. Products track stock automatically. Restock and Adjust record inventory changes; archive instead of deleting.
- **Sales:** Enter the customer name directly. Returning-customer suggestions fill their contact details. Type a perfume name and choose an inventory suggestion to fill its size and selling price, or enter a new perfume manually. Manual perfumes do not alter inventory. Use Add another perfume for multiple items; the final entered item is included when you save.
- **Customers:** The directory is built automatically from sales; no separate customer entry is needed. Matching phone numbers (including local Nigerian/international formats) reuse an existing customer. Selected customers can have contact details updated by their next sale; old invoice details stay as recorded. Historical named sales are linked to the directory when the server starts.
- **Invoices:** Every saved sale receives a unique sequential number such as `INV-00001`. The receipt offers PDF download, print, and the device share sheet. If file sharing is unsupported or denied, the PDF downloads for manual attachment. WhatsApp downloads the PDF and opens the customer's chat; attach that PDF before sending.
- **Transactions:** Search by invoice number, customer, phone, or date. Open an invoice, share it again, record further payments, or initiate a refund. Customer purchase histories link to their invoices here.
- **Refunds:** Choose Initiate refund, review the amount, and click Confirm refund. Confirmation immediately deducts the amount from net sales and payments in reports, and records it in invoice history. There is no pending stage or second approval. Refunds are limited to payments actually received minus previous refunds. A partial refund leaves stock unchanged; optionally cancel the entire sale and restore its items when refunding the full remaining payment. Repeated submission of the same confirmation cannot refund twice. The app records money returned through your usual payment method; it does not transfer funds itself.
- **Settings:** Save business details once to update login/sidebar branding, page title, workspace footer, installation name, invoice previews, PDF downloads, printing, sharing, and WhatsApp messages. Phone, WhatsApp, email, address, Instagram and TikTok usernames, logo, and thank-you message appear on invoices. Add social usernames and your WhatsApp number under Social accounts in Settings; blank accounts are omitted. An already-open invoice also refreshes when settings are saved in another browser tab. The default stock threshold applies to newly added products. Download backup exports all business records, including refund histories, as JSON (account passwords and sessions are excluded). For a complete database backup, stop the server and copy the `data` directory.
- **Reports:** Confirmed refunds immediately reduce net sales and payments. Net sales for a selected period reflect the current refund/cancellation state of the sales in that period. Export CSV records, including refunded amounts.

## Checks

To seed the example business branding, run `npm run seed:business`. It adds **Perfume by Aysha** if the business name is empty and uses the root `logo.jpg` when no logo is saved. It preserves existing contact details, custom logos, and subsequent customization, and creates no fictitious contact information. The supplied logo also appears in the favicon and installation icons.

Invoice previews and exported PDFs use a cream-and-gold layout with customer contacts, invoice tracking, perfume sizes, payment status, and an itemized balance summary. PDF exports repeat headings and page numbers for longer invoices. Printing and sharing use the same PDF layout.

For a populated sample workspace, run `npm run seed:demo`. It adds eight perfumes, five fictional customers, ten numbered invoices across the preceding week, six expenses, and one completed refund with a stock return. The sample covers paid, partial, and unpaid invoices, returning customers, a manual perfume, and low/out-of-stock alerts. Demo records carry `demo`/`demoKey` metadata; expense titles also start with “Demo”. Customer contacts are fictional examples.

Demo seeding also fills empty social fields with the example Instagram/TikTok username `perfume_by_aysha_demo` and fictional WhatsApp number `+1 202-555-0199`, so invoices demonstrate these details. Existing social accounts are preserved.

Demo seeding uses the configured `SQLITE_PATH`, preserves your owner account, existing business details, and records, and runs as one transaction. Repeating it skips existing demo records without changing their dates, prices, refunds, or stock counts. It does not reset a customized workspace. Refresh the app after running it. SQLite data stays local and is excluded from Git.

```sh
npm test
npm run build
```

Tests cover SQLite persistence, authentication and sessions, owner setup/recovery, stock accounting, sale rollback, cancellation, payments, customer matching/backfill, refund limits/idempotency/stock restoration, and API access controls.

## Appearance and app installation

Use the sun/moon button on the sign-in page or workspace toolbar to switch themes. Settings → Appearance offers Light, Dark, or Use device setting. The preference is stored on the current device, follows system changes when selected, and is applied before the page renders.

The production build is an installable PWA with desktop/Android icons and an Apple touch icon. Run `npm run build && npm start`, then use Settings → Install app when supported, or the browser's installation menu. On iPhone/iPad, open the app in Safari and use Share → Add to Home Screen. Installation requires HTTPS or localhost; see the [browser installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

The production service worker caches the app shell and static assets. SQLite records and authentication still require the Node server; private API responses are never cached and offline changes are not queued. The app shows a connection notice when offline. An available update asks before reloading, so you can save your work first; close any entry dialog before applying it.

PWA registration and installation are also enabled with `npm run dev`. Restart Vite after changing its configuration, then open its localhost URL and use Settings → Install app when the browser offers installation. The development worker leaves navigation requests on the live Vite server so hot updates work; use the production build to test offline asset caching. An app installed from port 5173 uses that development server, while an app installed from port 4173 uses the production server.
