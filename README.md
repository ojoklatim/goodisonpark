# Goodison Park — Enterprise Business Management Platform

A premium, full-featured enterprise dashboard for managing company operations end-to-end: **Sales Pipeline**, **HR & Payroll**, **Employee Performance**, **Project Management**, **Finance**, **Documents**, **Messaging**, and **Analytics** — all in one unified interface.

Built with **React 19 + Vite**, powered by **InsForge** (Postgres-based BaaS), and styled with a responsive, theme-aware UI supporting both light and dark modes.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Setup Guide](#-setup-guide-new-insforge-project)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [User Roles & Permissions](#-user-roles--permissions)
- [Application Modules](#-application-modules)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

| Category | Capabilities |
|----------|-------------|
| **Sales Pipeline** | Leads tracking, Deals kanban, Quotation/Invoice generation (PDF), Client management, Commission tracking |
| **HR & People** | Leave requests, Payroll processing, Announcements, Training records, Employee directory |
| **Performance** | KPIs, Performance reviews, Attendance (self check-in + admin), Daily activity logs, Goals, Rewards & penalties |
| **Operations** | Departments, Projects, Tasks (with subtasks), Approvals workflow, SOPs, Calendar events |
| **Finance** | Expense tracking, Budget management, Revenue analytics, Department-level breakdowns |
| **Documents** | File uploads, Categorized document library, Export center with generated reports |
| **Communication** | Real-time private messaging between team members, In-app notifications |
| **Marketing** | Social media account tracking, Engagement metrics dashboards |
| **Analytics** | Sales dashboards, Performance analytics, Operations analytics, Revenue vs. Expenses charts |
| **Platform** | Multi-branch support, Role-based access control, Dark/light theme, Mobile-responsive, PDF export |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router DOM 7, Vite 6 |
| **State** | Zustand (auth/UI), TanStack React Query (server state) |
| **Forms** | React Hook Form + Zod validation |
| **Styling** | CSS Variables, TailwindCSS 3, Vanilla CSS responsive sheets |
| **Charts** | Recharts |
| **PDF** | html2canvas + jsPDF |
| **Drag & Drop** | @dnd-kit |
| **Icons** | Lucide React |
| **Backend** | InsForge (Postgres, Auth, Storage, Realtime) |
| **SDK** | @insforge/sdk |

---

## 📦 Prerequisites

Before starting, make sure you have:

1. **Node.js** ≥ 18 and **npm** ≥ 9
2. An **InsForge account** — sign up at [insforge.dev](https://insforge.dev)
3. A new **InsForge project** created in your account

---

## 🚀 Setup Guide (New InsForge Project)

Follow these steps **in order** to get the platform running on your own InsForge project.

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd goodisonpark
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Link to Your InsForge Project

```bash
npx @insforge/cli link
```

This will create `.insforge/project.json` with your project credentials.

### Step 4: Get Your API Keys

From your InsForge project dashboard, copy:
- **Project URL** (e.g., `https://XXXXXXXX.eu-central.insforge.app`)
- **Anon Key** (starts with `anon_...`)
- **Database URL** (starts with `postgresql://...`)

### Step 5: Create the `.env.local` File

```bash
# Create .env.local in the project root
cat > .env.local << 'EOF'
VITE_INSFORGE_URL=https://YOUR_APPKEY.eu-central.insforge.app
VITE_INSFORGE_ANON_KEY=anon_your_anon_key_here
DATABASE_URL=postgresql://postgres:your_password@YOUR_APPKEY.eu-central.database.insforge.app:5432/insforge?sslmode=require
EOF
```

Replace the placeholder values with your actual credentials from Step 4.

### Step 6: Run the Database Setup

This is the most critical step. Run the single `setup.sql` file to create the entire database:

```bash
npx @insforge/cli db query --file setup.sql
```

This creates:
- ✅ **36 tables** across all modules
- ✅ **140 RLS policies** for tenant isolation and role-based access
- ✅ **8 triggers** for auto-timestamps and email validation
- ✅ **9 indexes** for query performance
- ✅ **Views and functions** for secure profile lookups

### Step 7: Create Storage Buckets

The app uses two storage buckets for file uploads:

```bash
npx @insforge/cli storage create-bucket documents --public
npx @insforge/cli storage create-bucket branding --public
```

| Bucket | Purpose |
|--------|---------|
| `documents` | Deal attachments, client documents, exported reports |
| `branding` | Company logo uploads |

### Step 8: Configure Auth Settings (Optional)

The `insforge.toml` file contains auth configuration. Push it to your project:

```bash
npx @insforge/cli push config
```

Current auth settings:
- Email verification: **disabled** (can be enabled for production)
- Password minimum length: **6 characters**
- SMTP: **disabled** (configure for email features like password reset)

### Step 9: Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🔐 First Login & Registration

### Creating the First Admin Account

1. Open the app in your browser
2. Click **"Register Company"** (or navigate to `/auth/register-company`)
3. Fill in your company details:
   - Company name and slug
   - Admin first name, last name, email, and password
4. Submit — you are now the **Company Admin**

### Inviting Employees

1. Log in with your admin account
2. Navigate to **Settings → Users**
3. Click **"Invite User"**
4. Fill in the employee's details (name, email, role, department)
5. Share the invitation link with the employee
6. The employee registers through the invitation link and gains access based on their assigned role

---

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_INSFORGE_URL` | InsForge project API URL | ✅ |
| `VITE_INSFORGE_ANON_KEY` | InsForge anonymous key for client-side auth | ✅ |
| `DATABASE_URL` | Direct Postgres connection (for CLI operations only) | For CLI |

> ⚠️ **Never commit `.env.local` to version control.** It is already in `.gitignore`.

---

## 🗄️ Database Schema

The database consists of **36 tables** organized into 7 domains:

### Core
| Table | Description |
|-------|-------------|
| `companies` | Multi-tenant root — company profile, subscription, banking details |
| `branches` | Company branch offices |
| `profiles` | User profiles (extends `auth.users` via FK) |
| `role_permissions` | Per-role, per-module permission matrix |
| `employee_invitations` | Pending invitations with secure tokens |

### Sales Pipeline
| Table | Description |
|-------|-------------|
| `leads` | Sales leads with source tracking and priority |
| `deals` | Deal pipeline with stages (new_lead → closed_won/lost) |
| `deal_activities` | Timeline of calls, meetings, notes per deal |
| `clients` | Converted clients with lifetime deal value |
| `quotations` | Itemized quotation documents with tax/terms |
| `invoices` | Invoices with tax, discount, payment tracking |
| `commissions` | Sales commission records |

### Employee Performance
| Table | Description |
|-------|-------------|
| `kpis` | Key performance indicators per employee |
| `performance_reviews` | Periodic reviews with scoring |
| `attendance` | Daily check-in/out with self-service or admin entry |
| `daily_activity_logs` | Daily work summaries with admin review flow |
| `goals` | Employee goals with progress tracking |
| `rewards_penalties` | Points/monetary rewards and penalties |

### Operations & Projects
| Table | Description |
|-------|-------------|
| `departments` | Company departments with optional head |
| `projects` | Projects with status, priority, and deadlines |
| `tasks` | Tasks with subtask support, time estimates |
| `approvals` | Cross-module approval workflow |
| `documents` | File storage with metadata and categories |
| `sops` | Standard Operating Procedures with versioning |
| `events` | Calendar events with attendees |

### HR
| Table | Description |
|-------|-------------|
| `leave_requests` | Leave requests with approval workflow |
| `payroll` | Monthly payroll with allowances/deductions |
| `announcements` | Company-wide or targeted announcements |
| `training_records` | Employee training history and certificates |

### Finance
| Table | Description |
|-------|-------------|
| `expenses` | Expense claims with receipt uploads |
| `budgets` | Department/category budgets by period |

### Communication
| Table | Description |
|-------|-------------|
| `messages` | Private direct messages between team members |
| `notifications` | In-app notification feed |
| `social_media_accounts` | Connected social media platform accounts |
| `social_media_metrics` | Daily engagement/follower snapshots |

### Security Model

Every table has **Row-Level Security (RLS)** enabled:
- **Tenant isolation**: Users can only access data belonging to their company
- **Role-based writes**: Only managers and above can update records; only admins can delete
- **Self-service**: Employees can update their own profiles, attendance, and activity logs
- **Message privacy**: Users only see messages they sent or received
- **Notification privacy**: Users only see their own notifications

---

## 👥 User Roles & Permissions

| Role | Level | Capabilities |
|------|-------|-------------|
| `super_admin` | Platform | Full access to everything, can delete companies |
| `company_admin` | Company | Full company access, can delete records, manage users |
| `manager` | Department | Can update all records in company, manage team |
| `team_leader` | Team | Standard access with limited management |
| `employee` | Individual | Can view company data, update own profile/attendance |

Permissions are further refined per module via the `role_permissions` table, allowing granular control (view, create, edit, delete, export) for each role on each module.

---

## 📁 Application Modules

### Dashboard (`/`)
Live overview with revenue vs. expenses charts, task distributions, recent approvals, and quick stats.

### Sales (`/sales/*`)
- **Pipeline** — Visual deal pipeline with drag-and-drop stage management
- **Leads** — Lead capture and qualification workflow
- **Clients** — Client profiles with deal history
- **Quotations** — Create and manage quotation documents
- **Invoices** — Invoice generation with tax and payment tracking
- **Commissions** — Sales commission management
- **Sales Dashboard** — Revenue analytics and performance metrics

### HR (`/hr/*`)
- **Attendance** — Mark attendance (admin) or self check-in (employee)
- **Leave** — Submit and approve leave requests
- **Announcements** — Company-wide or role-targeted announcements
- **Daily Activity** — Employee daily work logs with manager review

### Operations (`/operations/*`)
- **Departments** — Manage organizational structure
- **Projects** — Project lifecycle management
- **Tasks** — Task assignment with subtasks and time tracking
- **Approvals** — Cross-module approval queue
- **SOPs** — Maintain standard operating procedures
- **Calendar** — Schedule and manage events

### Reports (`/reports/*`)
- **Sales Analytics** — Revenue trends, deal conversion rates
- **Performance Analytics** — Employee KPIs, attendance trends
- **Operations Analytics** — Project progress, task completion rates
- **Export Center** — Generate and download PDF/CSV reports

### Company Settings (`/company/*`)
- **Settings** — Company profile, logo, banking details
- **Users** — Employee directory and invitation management
- **Branches** — Manage company locations
- **Roles** — Configure per-module permissions for each role

### Messages (`/messages`)
Real-time private messaging between team members with read receipts.

---

## ☁️ Deployment

### Cloudflare Pages (Recommended)

1. Push your repository to GitHub
2. Connect to Cloudflare Pages
3. Configure:
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Environment variables**: Add `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY`
4. The `public/_redirects` file is included for SPA routing support

### Any Static Host

```bash
npm run build
```

Deploy the `dist/` folder to any static hosting service (Vercel, Netlify, etc.). Make sure to:
- Set environment variables in the hosting dashboard
- Configure SPA fallback routing (all routes → `index.html`)

---

## 📂 Project Structure

```
goodisonpark/
├── .env.local                  # Environment variables (not committed)
├── .insforge/                  # InsForge project config (not committed)
│   └── project.json
├── insforge.toml               # InsForge auth/storage/realtime config
├── setup.sql                   # ⭐ Complete database setup (run once)
├── index.html                  # Vite entry point
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS theme config
├── postcss.config.js           # PostCSS config
├── public/
│   └── logo.jpg                # Company logo asset
└── src/
    ├── main.jsx                # App entry point
    ├── App.jsx                 # Root component with auth state
    ├── index.css               # Global styles and CSS variables
    ├── components/
    │   ├── ui/                 # Reusable UI components (Button, Modal, DataTable, etc.)
    │   ├── layout/             # Sidebar, TopBar
    │   ├── hr/                 # HR-specific components (CheckInWidget)
    │   └── sales/              # Sales-specific components (DealDrawer)
    ├── pages/
    │   ├── auth/               # Login, Register, ForgotPassword, ResetPassword
    │   ├── dashboard/          # Main dashboard overview
    │   ├── sales/              # Pipeline, Leads, Clients, Invoices, Quotations
    │   ├── hr/                 # Attendance, Leave, Announcements, DailyActivity
    │   ├── operations/         # Departments, Projects, Tasks, Approvals, SOPs
    │   ├── reports/            # Analytics dashboards, Export center
    │   ├── company/            # Settings, Users, Branches, Roles
    │   ├── employees/          # Employee directory
    │   └── messages/           # Private messaging
    ├── hooks/                  # Custom React hooks
    ├── layouts/                # AppLayout, AuthLayout
    ├── lib/
    │   ├── insforge.js         # InsForge SDK client wrapper
    │   ├── queryKeys.js        # React Query key factory
    │   ├── schema.types.js     # Zod validation schemas
    │   └── utils.js            # Shared utility functions
    ├── router/
    │   └── index.jsx           # Route definitions
    └── store/
        ├── authStore.js        # Zustand auth state
        └── uiStore.js          # Zustand UI state (sidebar, theme)
```

---

## 🔧 Troubleshooting

### "Permission denied" / "Row-level security violation"
- Ensure `setup.sql` was executed successfully
- Verify the user has the correct role in the `profiles` table
- Check that `get_my_company_id()` returns a valid UUID for the current user

### "relation does not exist"
- Run `setup.sql` again — it uses `IF NOT EXISTS` so it's safe to re-run
- Verify with: `npx @insforge/cli db tables`

### Storage upload fails
- Ensure buckets were created: `npx @insforge/cli storage create-bucket documents --public`
- Check bucket permissions in the InsForge dashboard

### Auth / Login issues
- Verify `.env.local` has the correct `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY`
- For password reset to work via email, configure SMTP in `insforge.toml` and push config

### Empty pages / Missing data
- Register a company first at `/auth/register-company` — most pages require a company context
- Invite employees through **Settings → Users** to populate the directory

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 5173) |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview production build locally |

---

## 📄 License

Private — All rights reserved.

---

# 📖 Comprehensive User Manual

Welcome to the Goodison Park platform! This manual is written for non-technical users to help you understand how to navigate the platform, use its features, and complete your daily tasks. 

It is divided into two main sections: **The Employee Guide** (for everyday use) and **The Administrator Guide** (for managers and company admins).

## 🏢 Part 1: The Employee Guide
*(For all staff members)*

### 1. Getting Started
* **Logging In**: Go to the login page, enter your email and password, and click "Sign In". If you forget your password, click "Forgot password?" to reset it.
* **Navigation**: On the left side of the screen, you will see a menu (Sidebar) with all the modules you have access to. 
* **Dark/Light Mode**: You can toggle between dark and light themes using the moon/sun icon at the top right of the screen.

### 2. Dashboard
* The Dashboard is the first screen you see after logging in. It gives you a quick snapshot of the company's health.
* You will see summary cards (like total revenue, active projects, etc.), interactive charts, and a feed of recent activity and approvals that require your attention.

### 3. HR & Performance
* **Attendance**: Click on **HR → Attendance**. Here you can "Check In" when you start work and "Check Out" when you finish. A daily record is kept automatically.
* **Daily Activity**: Click on **HR → Daily Activity**. At the end of each day, fill out a simple log of what you accomplished today and what you plan to do tomorrow. Your manager will review this.
* **Leave Requests**: Click on **HR → Leave**. To request time off, click "New Request", select the dates, and submit. You can track whether it has been approved or rejected here.
* **Announcements**: Check the **Announcements** page for important updates from management. Pinned announcements will always stay at the top.

### 4. Sales Pipeline (For Sales Team)
* **Leads**: Go to **Sales → Leads** to track potential customers. You can add notes and contact details.
* **Pipeline (Deals)**: Go to **Sales → Pipeline**. This is a visual "Kanban" board. You can drag and drop deals from one stage (e.g., "Negotiation") to the next (e.g., "Closed Won").
* **Clients**: Once a deal is won, the lead becomes a Client. View all active clients and their total value in the **Sales → Clients** tab.
* **Quotations & Invoices**: Generate professional PDF documents to send to clients. You can itemize services, add tax, and track whether an invoice is paid or unpaid.

### 5. Operations & Projects
* **Projects & Tasks**: Go to **Operations → Projects** to see ongoing work. Click on a project to see its Tasks. You can update task statuses (e.g., from "To Do" to "In Progress") as you work on them.
* **SOPs (Standard Operating Procedures)**: Need to know how to do something? Check the SOPs section for company manuals and guidelines.

### 6. Communication & Documents
* **Messages**: Click the chat icon or go to **Messages** to send direct, instant messages to your colleagues. 
* **Export Center**: In the **Reports** section, you can generate and download data (like client lists or performance reports) as CSV or PDF files.

---

## 👑 Part 2: The Administrator Guide
*(For Company Admins, HR, and Managers)*

### 1. Setting Up Your Company
* **Company Settings**: Go to **Company → Settings**. Here you can upload your company logo, update your address, and enter bank details (which automatically appear on invoices).
* **Branches & Departments**: Before inviting employees, go to **Company → Branches** and **Operations → Departments** to set up your organizational structure.

### 2. Managing Employees (Users)
* **Inviting Staff**: Go to **Company → Users** and click "Invite User". Enter their name and email, and assign them a Role (e.g., Manager, Employee) and Department. They will receive a link to set their password and join.
* **Roles & Permissions**: Go to **Company → Roles**. Here you can decide exactly what each role can do. For example, you can allow Managers to "Edit" sales deals, but restrict Employees to "View" only.

### 3. Approvals Workflow
* Go to **Operations → Approvals**. When an employee submits a leave request, an expense claim, or a discount on a quotation, it will appear here. 
* Managers can review the details, leave a note, and click **Approve** or **Reject**.

### 4. Finance & Budgets
* **Expenses**: Employees can submit expense claims with receipt uploads. Managers review and approve them in the **Finance → Expenses** tab.
* **Budgets**: Set spending limits for specific departments.
* **Payroll**: Go to **HR → Payroll** at the end of the month to generate salary slips, add bonuses/deductions, and mark salaries as paid.

### 5. Advanced Reporting (Analytics)
* Managers have access to detailed Analytics dashboards under the **Reports** section.
* **Sales Analytics**: View revenue trends, win/loss ratios, and top-performing sales reps.
* **Performance Analytics**: Review company-wide attendance patterns and KPI achievements.
* **Operations Analytics**: Track how quickly tasks are being completed and identify bottlenecks in projects.

### 6. Troubleshooting
* **Missing Data?** If an employee cannot see certain data, check their Role in **Company → Users**, then go to **Company → Roles** to ensure that role has "View" permissions for that specific module.
* **Unable to upload logos?** Ensure the `branding` and `documents` storage buckets have been created in your InsForge dashboard as per the Setup Guide.
