# Perfume Manager

A private perfume inventory, sales, expenses, customer, and invoicing app. Local development uses SQLite; the production build uses Firebase Authentication and Cloud Firestore directly from the browser.

## Local SQLite

Use Node.js 22.13 or newer. Local development, preview, and `npm start` use `data/perfume.sqlite`. The existing local owner and demo records remain available. No Firebase connection is made by the local app.

```sh
npm install
npm run dev
```

If this machine has no local owner yet, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the ignored `.env` file and run `npm run seed:admin`. `npm run seed:business` and `npm run seed:demo` update only SQLite. SQLite data files and `.env` are ignored by Git.

`npm start` builds and serves the local SQLite version. `npm run preview` does the same through Vite. To build without starting a server, use `npm run build:local`.

## Production Firebase

`npm run build` produces the Firebase frontend using the `VITE_FIREBASE_*` environment values supplied by the build environment. The signed-in admin reads and writes Firestore directly under the deployed admin-only security rules. The browser does not call a `/api` workspace server in this build. Sales, stock, invoice numbering, payments, and refunds use Firestore transactions.

The root `.env` has its Firebase settings commented out. `SQLITE_PATH` selects the local database. `npm run dev`, `npm start`, and `npm run preview` use SQLite. Local owner accounts and business records remain available after commenting these keys; no local records are sent to Firestore.

The production sign-in screen and installation manifest include the bundled business branding. After sign-in, invoice and workspace details load from the saved Firestore business profile. The Admin SDK key is not needed by the browser build.

## Admin guide

- **Session security:** Five minutes without interaction signs you out. Activity in another open tab keeps the session active. Refreshing or returning from a suspended tab does not revive an expired session.
- **Your profile:** Save your full name in Settings → Your profile. Your account name appears in the dashboard welcome and header and persists across sessions. Successful login, logout, and saved actions show a two-second confirmation toast.
- **Products:** Add a perfume name, category, ml size, selling price, quantity, and low-stock threshold. Products track stock automatically. Restock and Adjust record inventory changes; archive instead of deleting.
- **Sales:** Enter the customer name directly. Returning-customer suggestions fill their contact details. Type a perfume name and choose an inventory suggestion to fill its size and selling price, or enter a new perfume manually. Manual perfumes do not alter inventory. Use Add another perfume for multiple items; the final entered item is included when you save.
- **Customers:** The directory is built automatically from sales; no separate customer entry is needed. Matching phone numbers (including local Nigerian/international formats) reuse an existing customer. Selected customers can have contact details updated by their next sale; old invoice details stay as recorded. Returning customers are suggested by their saved contact details.
- **Invoices:** Every saved sale receives a unique sequential number such as `INV-00001`. The receipt offers PDF download, print, and the device share sheet. If file sharing is unsupported or denied, the PDF downloads for manual attachment. WhatsApp shares the PDF and invoice message through the device’s share sheet when file sharing is supported; choose WhatsApp and the customer. Browsers cannot preselect a WhatsApp recipient while attaching a file. On unsupported browsers, the PDF downloads and a button opens the customer’s chat; attach the downloaded PDF as a document before sending.
- **Transactions:** Search by invoice number, customer, phone, or date. Open an invoice, share it again, record further payments, or initiate a refund. Customer purchase histories link to their invoices here.
- **Refunds:** Choose Initiate refund, review the amount, and click Confirm refund. Confirmation immediately deducts the amount from net sales and payments in reports, and records it in invoice history. There is no pending stage or second approval. Refunds are limited to payments actually received minus previous refunds. A partial refund leaves stock unchanged; optionally cancel the entire sale and restore its items when refunding the full remaining payment. Repeated submission of the same confirmation cannot refund twice. The app records money returned through your usual payment method; it does not transfer funds itself.
- **Settings:** Save business details once to update login/sidebar branding, page title, workspace footer, installation name, invoice previews, PDF downloads, printing, sharing, and WhatsApp messages. Phone, WhatsApp, email, address, Instagram and TikTok usernames, logo, and thank-you message appear on invoices. Add social usernames and your WhatsApp number under Social accounts in Settings; blank accounts are omitted. An already-open invoice also refreshes when settings are saved in another browser tab. The default stock threshold applies to newly added products. Download backup exports business records, including refund histories, as JSON in either environment (account passwords and sessions are excluded). For a complete local database backup, stop the local server and copy `data/perfume.sqlite`; use a Firestore export for cloud backups.
- **Reports:** Confirmed refunds immediately reduce net sales and payments. Net sales for a selected period reflect the current refund/cancellation state of the sales in that period. Export CSV records, including refunded amounts.

## Checks

```sh
npm test
npm run build
```

Tests cover both the local SQLite API and Firebase data operations, including stock accounting, refunds, and API access controls.

## Appearance and app installation

Use the sun/moon button on the sign-in page or workspace toolbar to switch themes. Settings → Appearance offers Light, Dark, or Use device setting. The preference is stored on the current device, follows system changes when selected, and is applied before the page renders.

The production build is an installable PWA with desktop/Android icons and an Apple touch icon. Run `npm run build && npm start`, then use Settings → Install app when supported, or the browser's installation menu. On iPhone/iPad, open the app in Safari and use Share → Add to Home Screen. Installation requires HTTPS or localhost; see the [browser installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

The production service worker caches the app shell and static assets. Local SQLite records require the local server, and Firebase records require an internet connection; private API responses are never cached and offline changes are not queued. The app shows a connection notice when offline. An available update asks before reloading, so you can save your work first; close any entry dialog before applying it.

PWA registration and installation are also enabled with `npm run dev`. Restart Vite after changing its configuration, then open its localhost URL and use Settings → Install app when the browser offers installation. The development worker leaves navigation requests on the live Vite server so hot updates work; use the production build to test offline asset caching. An app installed from port 5173 uses that development server, while an app installed from port 4173 uses the production server.
