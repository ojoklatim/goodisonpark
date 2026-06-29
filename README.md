# Goodison Park Properties Portal

A premium, responsive enterprise dashboard portal designed for **Goodison Park Properties**. Built on React, Vite, and TanStack React Query, using a fully responsive theme-aware UI and integrated with the InsForge backend client.

---

## 🚀 Key Features

* **Theme-Aware Branding:** Integrated the official vector logo throughout login screens, sidebar layouts, and registers.
* **Mobile-First Responsive Layouts:** Optimized all tables, categories list wrappers, dashboard grids, and auth cards to fit perfectly on mobile screens.
* **Live Database Dashboard:**
  * Real-time Revenue vs. Expenses monthly charts computed from live transaction history.
  * Live Pie Charts displaying employee task distributions.
  * Real-time company approvals list with instant mutators for managers.
* **Responsive Category Filtering:** The documents page adapts from a wide desktop sidebar list into a clean, horizontal scrollable tab interface on mobile devices.
* **Instant Messaging:** Fully active private messaging panel between team members.
* **Flexible Page Layouts:** Full support for dark and light contrast settings.

---

## 🛠️ Tech Stack

* **Framework:** React 19 + Vite 6
* **State Management & Data Fetching:** Zustand, TanStack React Query
* **Icons:** Lucide React
* **Styling:** CSS variables, Vanilla CSS responsive sheets
* **Backend Adapter:** `@insforge/sdk`
* **Deployments:** Ready for Cloudflare Pages

---

## 🔐 Getting Started & Login Details

Because this portal connects to a live, secure backend, initial administrator and employee credentials are created dynamically:

### 1. Register a Company (Admin Credentials)
1. Launch the local development server.
2. Go to the login page and click **Register Company** (or navigate directly to `/register`).
3. Complete the details to register your company branch.
4. The registered email and password immediately become your **Company Admin (Manager)** login details.

### 2. Employee Credentials
1. Log in using your registered Admin account.
2. Go to **Settings -> Users** or the **Directory** section.
3. Click **Invite User** or **Add Employee** to create employee records with predefined roles.
4. Log out and log back in using the created employee credentials to view the filtered **Employee Dashboard**.

---

## 💻 Local Setup & Development

### Installation
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

---

## ☁️ Cloudflare Pages Configuration

The repository is pre-configured and fully compatible with **Cloudflare Pages**:
* `wrangler.toml`: Set to monitor the Vite default output directory (`dist`).
* `public/_redirects`: Built with single-page application fallback rules (`/* /index.html 200`) to prevent page refreshes from throwing 404 errors.
