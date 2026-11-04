# Perfume Manager

A private perfume inventory, sales, expenses, customer, and invoicing app. The active app uses Firebase Authentication and Cloud Firestore through its Node API. The earlier SQLite implementation and its local demo data remain in the repository for later use; they are not connected to Firebase.

## Run locally

Use Node.js 22.13 or newer. Copy `.env.example` to `.env` and provide the Firebase web configuration, project ID, and path to the root Admin SDK JSON file. The Firebase web values in `.env` are already configured in this workspace; `.env` and service account JSON files are ignored by Git. Keep the service account on the server only.

```sh
npm install
npm run dev
```

Sign in with the Firebase admin account. Public owner registration is disabled. `npm run dev`, `npm run preview`, and `npm start` all use the Firebase API. A bare static hosting deployment cannot serve the API endpoints; deploy the Node server together with `dist` or use an equivalent server environment.

```sh
npm run build
npm start
```

## Firebase setup

`npm run firebase:setup` enables email/password sign-in, creates or finds `ADMIN_EMAIL`, grants its `admin` custom claim, ensures the default Firestore database exists, and publishes [firestore.rules](firestore.rules). It preserves an existing Firebase password unless `--reset-password` is passed. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are read from `.env`; remove the password from that file after setup if no longer needed. The application does not allow public sign-up. Admin requests require a verified ID token; the Firestore rules grant CRUD only to an admin claim on the workspace collections.

`npm run firebase:seed-brand` saves **Perfume by Aysha** and `logo.jpg` to the Firestore business profile if those fields are empty. This is the only seeded cloud document. Product, customer, sale, expense, refund, and stock records start empty. The brand is loaded from Firestore on the login page, sidebar, PWA manifest, and invoices. You can change it later in Settings.

`npm run firebase:verify` checks sign-in, admin claim, published rules, access control, and cloud record counts without writing sample data. Cloud records are never copied from the local SQLite database.

The previous SQLite API, database code, and seed scripts remain available for later use. `npm run seed:demo` and `npm run seed:business` affect only local SQLite. The local SQLite test suite is `npm run sqlite:test`. SQLite data files are ignored by Git.

## Admin guide

- **Products:** Add a perfume name, category, ml size, selling price, quantity, and low-stock threshold. Products track stock automatically. Restock and Adjust record inventory changes; archive instead of deleting.
- **Sales:** Enter the customer name directly. Returning-customer suggestions fill their contact details. Type a perfume name and choose an inventory suggestion to fill its size and selling price, or enter a new perfume manually. Manual perfumes do not alter inventory. Use Add another perfume for multiple items; the final entered item is included when you save.
- **Customers:** The directory is built automatically from sales; no separate customer entry is needed. Matching phone numbers (including local Nigerian/international formats) reuse an existing customer. Selected customers can have contact details updated by their next sale; old invoice details stay as recorded. Returning customers are suggested by their saved contact details.
- **Invoices:** Every saved sale receives a unique sequential number such as `INV-00001`. The receipt offers PDF download, print, and the device share sheet. If file sharing is unsupported or denied, the PDF downloads for manual attachment. WhatsApp downloads the PDF and opens the customer's chat; attach that PDF before sending.
- **Transactions:** Search by invoice number, customer, phone, or date. Open an invoice, share it again, record further payments, or initiate a refund. Customer purchase histories link to their invoices here.
- **Refunds:** Choose Initiate refund, review the amount, and click Confirm refund. Confirmation immediately deducts the amount from net sales and payments in reports, and records it in invoice history. There is no pending stage or second approval. Refunds are limited to payments actually received minus previous refunds. A partial refund leaves stock unchanged; optionally cancel the entire sale and restore its items when refunding the full remaining payment. Repeated submission of the same confirmation cannot refund twice. The app records money returned through your usual payment method; it does not transfer funds itself.
- **Settings:** Save business details once to update login/sidebar branding, page title, workspace footer, installation name, invoice previews, PDF downloads, printing, sharing, and WhatsApp messages. Phone, WhatsApp, email, address, Instagram and TikTok usernames, logo, and thank-you message appear on invoices. Add social usernames and your WhatsApp number under Social accounts in Settings; blank accounts are omitted. An already-open invoice also refreshes when settings are saved in another browser tab. The default stock threshold applies to newly added products. Download backup exports all business records, including refund histories, as JSON (account passwords and sessions are excluded). For a separate backup, use a Firestore export from the Firebase project.
- **Reports:** Confirmed refunds immediately reduce net sales and payments. Net sales for a selected period reflect the current refund/cancellation state of the sales in that period. Export CSV records, including refunded amounts.

## Checks

```sh
npm test
npm run build
```

The active tests cover Firestore data operations, transaction rollback, invoice numbering, stock accounting, customer reuse, refunds, and Firebase API access controls. The SQLite tests remain available separately.

## Appearance and app installation

Use the sun/moon button on the sign-in page or workspace toolbar to switch themes. Settings → Appearance offers Light, Dark, or Use device setting. The preference is stored on the current device, follows system changes when selected, and is applied before the page renders.

The production build is an installable PWA with desktop/Android icons and an Apple touch icon. Run `npm run build && npm start`, then use Settings → Install app when supported, or the browser's installation menu. On iPhone/iPad, open the app in Safari and use Share → Add to Home Screen. Installation requires HTTPS or localhost; see the [browser installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

The production service worker caches the app shell and static assets. Firebase records and authentication still require the Node server; private API responses are never cached and offline changes are not queued. The app shows a connection notice when offline. An available update asks before reloading, so you can save your work first; close any entry dialog before applying it.

PWA registration and installation are also enabled with `npm run dev`. Restart Vite after changing its configuration, then open its localhost URL and use Settings → Install app when the browser offers installation. The development worker leaves navigation requests on the live Vite server so hot updates work; use the production build to test offline asset caching. An app installed from port 5173 uses that development server, while an app installed from port 4173 uses the production server.
