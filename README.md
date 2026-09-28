# 🍽️ TableFlow — Intelligent Restaurant Operating System

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)](https://react.dev/)
[![Flutter](https://img.shields.io/badge/Flutter-3.13+-02569B?logo=flutter)](https://flutter.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime_DB-3ECF8E?logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-gold.svg)]()

> **TableFlow** is an end-to-end, real-time restaurant operating system purpose-built for contemporary and luxury dining establishments.
> 
> The platform unifies a cross-platform **Flutter Mobile App** for guests, a high-performance **Next.js 16 Web Console** for staff and management, and a robust **Node.js/Express Backend Engine**, fully synchronized via **Supabase Realtime PostgreSQL** and cross-tab browser broadcast messaging.

---

## 📑 Table of Contents

1. [System Architecture & Tech Stack](#-system-architecture--tech-stack)
2. [Key Platform Features](#-key-platform-features)
3. [Repository Directory Structure](#-repository-directory-structure)
4. [Prerequisites](#-prerequisites)
5. [Step-by-Step Setup & Run Guide](#-step-by-step-setup--run-guide)
   - [Step 1: Database Setup & Migrations (Supabase)](#step-1-database-setup--migrations-supabase)
   - [Step 2: Backend API Setup (`/backend`)](#step-2-backend-api-setup-backend)
   - [Step 3: Admin Web Console Setup (`/admin`)](#step-3-admin-web-console-setup-admin)
   - [Step 4: Mobile Application Setup (`/mobile`)](#step-4-mobile-application-setup-mobile)
6. [Building for Production](#-building-for-production)
7. [Real-time Synchronization Architecture](#-real-time-synchronization-architecture)
8. [Roles & Access Permissions](#-roles--access-permissions)
9. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏛️ System Architecture & Tech Stack

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                          TableFlow Ecosystem                           │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
 📱 Mobile App (Flutter)        🌐 Admin Portal (Next.js)    ⚙️ Backend API (Express)
 ├─ Customer Pre-orders         ├─ Kitchen Display (KDS)     ├─ Inventory Locking RPC
 ├─ Table Reservations          ├─ Cashier POS Billing       ├─ Payment Audit Endpoints
 ├─ Bank Slip Upload            ├─ Payment Slip Audit Desk   ├─ FCM Push Notifications
 └─ Live Order Tracking         └─ Sales & Shift Reports     └─ Order Auto-Expiry Job
        ▲                            ▲                            ▲
        │                            │                            │
        └────────────────────────────┼────────────────────────────┘
                                     ▼
                      🗄️ Supabase Cloud (PostgreSQL)
                      ├─ Row Level Security (RLS)
                      ├─ Realtime Pub/Sub WebSockets
                      └─ Private Storage Bucket (payment-slips)
```

| Tier | Technology | Key Responsibilities |
| :--- | :--- | :--- |
| **Mobile Client** | **Flutter 3.13+ (Dart)** | Guest interface for browsing menu items, table reservations, pre-ordering, bank slip uploads, and live food prep tracking. |
| **Admin Portal** | **Next.js 16 (Turbopack) & React 19** | Management cockpit: Kitchen Display System (KDS), Cashier POS, Bank Slip Audit Desk, Analytics, Floor layouts. |
| **Backend Engine** | **Node.js & Express.js** | Business logic, atomic stock reservations, FCM push notification dispatch, and scheduled background workers. |
| **Database & Auth** | **Supabase (PostgreSQL + RLS)** | User identity authentication, persistent database, WebSocket subscriptions, and secure file storage. |
| **Push Notifications**| **Firebase Cloud Messaging (FCM)** | Automated push alerts dispatched directly to the customer's mobile device as order statuses evolve. |

---

## ✨ Key Platform Features

### 1. 📱 Guest Mobile App (Flutter)
- **Portion Sizing & Signature Customizations**: Support for portion variants (e.g. Regular Cut vs. King Cut 400g), artisanal sauces (e.g. Red Wine Glaze, Truffle Peppercorn), and gourmet add-ons with dynamic price calculation.
- **Direct Bank Transfer with Proof of Payment**: Seamless bank transfer workflow allowing customers to input their transaction reference number and upload receipt slips directly via camera or photo gallery.
- **Table Booking & Floor Reservations**: Select date, preferred time slot, and guest party count with instant floor allocation.
- **Live Order Status Tracker**: Real-time progress updates (`Pending` → `Preparing` → `Ready` → `Served`) with real-time WebSocket listeners.
- **Accessibility Modes**: Integrated toggle for High Contrast Theme and Large Font scaling to accommodate visually impaired guests.

### 2. 🧾 Payment Slip Audit Desk
- **Interactive Lightbox Inspector**: High-resolution image preview supporting zoom in/out, 90° clockwise rotation, and reference number copy-to-clipboard.
- **1-Click Kitchen Release**: Immediate verification triggers inventory commitment and pushes the order straight into the kitchen queue.
- **Dispute Resolution & Canned Rejection**: Categorize invalid receipts (e.g., blurry image, duplicate receipt, reference mismatch) with instant customer notification.
- **Zero-Latency Multi-Tab Sync**: Actions taken in the audit desk immediately update the Kitchen Orders page and sidebar badge counters without requiring a page reload.

### 3. 🍳 Kitchen Display System (KDS)
- **Hands-Free Kitchen Interface**: Real-time order cards showing order items, selected portion sizes, notes, and elapsed preparation times.
- **Urgency Time Thresholds**: Visual color-coded cards (Normal Green → Warning Gold after 10 mins → Critical Red after 20 mins).
- **Web Audio Chimes**: Synthesized browser audio alerts automatically fire whenever a new order arrives or a customer leaves a rating.

### 4. 💳 Cashier POS & Billing Terminal
- **Fast-Paced Dine-in & Takeaway Billing**: Rapid dish selection, table selection, and discount handling.
- **Payment Processing**: Multi-tender support (Cash, Card, Online) with instantaneous status updates and printable receipts.

### 5. 📊 Sales Reports & Shift Analytics (Z-Reports)
- **Revenue Summaries**: Gross sales, net revenue, tax breakdown, and service charges.
- **RFC 4180 Standard CSV Export**: Direct export of transactional data for external accounting tools.

---

## 📂 Repository Directory Structure

```text
TableFlow/
├── backend/                       # Node.js & Express REST Backend Engine
│   ├── src/
│   │   ├── config/supabase.js     # Supabase Service Role client configuration
│   │   ├── routes/paymentAudit.js # Payment verification & slip audit APIs
│   │   ├── services/fcm.js        # Firebase Cloud Messaging push dispatch
│   │   ├── jobs/orderExpiryJob.js # Background cron job for unverified stock
│   │   └── server.js              # Express app entry & HTTP routes
│   ├── payment_verification_migration.sql # DB schema, storage & RPC functions
│   └── package.json
│
├── admin/                         # Next.js 16 Web Administration Portal
│   ├── src/
│   │   ├── app/
│   │   │   ├── orders/            # Kitchen & Live Orders view
│   │   │   ├── payment-audit/     # Bank Transfer Slip Verification Lightbox
│   │   │   ├── kds/               # Kitchen Display System Screen
│   │   │   ├── pos/               # Cashier POS & Billing Terminal
│   │   │   ├── tables/            # Table & Floor Plan Management
│   │   │   ├── reservations/      # Booking Calendar & Table Sync
│   │   │   ├── reports/           # Financial Summaries & CSV Export
│   │   │   └── login/             # Staff Authentication Screen
│   │   ├── components/Sidebar.js  # Navigation Sidebar with live badge counts
│   │   └── lib/supabase.js        # Browser Supabase client instance
│   ├── admin.css                  # Design system stylesheet
│   └── package.json
│
└── mobile/                        # Flutter Cross-Platform Client Application
    ├── lib/
    │   ├── screens/customer/      # Cart, Menu, Tracker, Reservations
    │   ├── providers/             # CartProvider, SettingsProvider
    │   ├── services/              # SupabaseService, FCMService, ApiService
    │   └── main.dart              # Flutter App Entry Point
    └── pubspec.yaml
```

---

## 🛠️ Prerequisites

Ensure you have the following installed on your machine:

1. **Node.js**: `v18.0.0` or higher (LTS recommended) — [Download Node.js](https://nodejs.org/)
2. **Flutter SDK**: `v3.13.0` or higher — [Install Flutter](https://docs.flutter.dev/get-started/install)
3. **Git**: [Install Git](https://git-scm.com/)
4. **Google Chrome / Android Studio / Xcode**: A web browser, emulator, or physical device to run the mobile app.
5. **Supabase Account**: A Supabase project — [Create Supabase Project](https://supabase.com/)

---

## 🚀 Step-by-Step Setup & Run Guide

### Step 1: Database Setup & Migrations (Supabase)

1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor** tab.
3. Open and run the migration script located at:
   `backend/payment_verification_migration.sql`
   - This sets up the private `payment-slips` Storage bucket, creates the `payment_transactions` table, and adds atomic stock reservation RPC functions (`reserve_inventory_for_order`, `commit_reserved_stock`, `release_reserved_stock`).
4. Enable Supabase Realtime publication for live subscriptions by running:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE orders;
   ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions;
   ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
   ```

---

### Step 2: Backend API Setup (`/backend`)

The backend API handles core business logic, stock locks, and verification endpoints.

1. Open a terminal and navigate to `backend`:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables in `backend/.env`:
   ```env
   PORT=3000
   SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
   SUPABASE_ANON_KEY=<YOUR-SUPABASE-ANON-KEY>
   SUPABASE_SERVICE_ROLE_KEY=<YOUR-SUPABASE-SERVICE-ROLE-KEY>
   ```

4. Start the backend development server:
   ```bash
   npm run dev
   ```
   > ✅ When running successfully, the terminal displays: `Server is running on port 3000`.

---

### Step 3: Admin Web Console Setup (`/admin`)

The administrative portal runs on Next.js 16 with React 19.

1. Open a new terminal tab and navigate to `admin`:
   ```bash
   cd admin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create or verify `admin/.env.local`:
   ```env
   PORT=3001
   NEXT_PUBLIC_SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR-SUPABASE-ANON-KEY>
   ```

4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

5. Access the application in your browser:
   - **Admin Portal**: [http://localhost:3000](http://localhost:3000) (or [http://localhost:3001](http://localhost:3001) if port 3000 is occupied by the backend)
   - **Payment Audit Desk**: [http://localhost:3001/payment-audit](http://localhost:3001/payment-audit)
   - **Kitchen Screen (KDS)**: [http://localhost:3001/kds](http://localhost:3001/kds)
   - **Orders Management**: [http://localhost:3001/orders](http://localhost:3001/orders)

---

### Step 4: Mobile Application Setup (`/mobile`)

The mobile client runs seamlessly across iOS, Android, and Web browsers.

1. Open a new terminal tab and navigate to `mobile`:
   ```bash
   cd mobile
   ```

2. Fetch Flutter package dependencies:
   ```bash
   flutter pub get
   ```

3. Check available devices/emulators:
   ```bash
   flutter devices
   ```

4. Launch the application:
   - **On Chrome Web Browser:**
     ```bash
     flutter run -d chrome
     ```
   - **On Android Emulator / Connected Phone:**
     ```bash
     flutter run
     ```
   - **On iOS Simulator (macOS only):**
     ```bash
     open -a Simulator
     flutter run -d iPhone
     ```

---

## 🏗️ Building for Production

### 1. Backend Production Mode
```bash
cd backend
npm start
```
*(Or with Docker: `docker-compose up --build -d`)*

### 2. Admin Dashboard Production Bundle
```bash
cd admin
npm run build
npm run start
```
*(Produces an optimized production bundle inside the `.next` directory)*

### 3. Flutter Mobile App Release Builds
```bash
cd mobile

# Android Release APK
flutter build apk --release

# Android App Bundle (Google Play Store)
flutter build appbundle --release

# iOS Release Archive (Requires Xcode on macOS)
flutter build ios --release

# Production Web Build
flutter build web --release
```

---

## ⚡ Real-time Synchronization Architecture

To eliminate the need for manual browser refreshes, TableFlow employs a **4-layer live synchronization architecture**:

1. **Supabase Realtime WebSockets**:
   - `postgres_changes` events on `orders`, `payment_transactions`, and `reviews` broadcast database modifications directly to active subscribers.
2. **Browser `BroadcastChannel` API (`tableflow_orders_channel`)**:
   - When a staff member approves or rejects a slip in the Payment Audit Desk tab, an instant message is broadcast to all other open tabs/windows, refreshing the Kitchen Orders page and Sidebar badge counters in sub-10ms.
3. **Window Focus & Visibility Lifecycle Listeners**:
   - Switching back to an inactive tab triggers `window.onfocus` and `document.visibilityState === 'visible'` to re-sync the latest queue state immediately.
4. **Heartbeat Polling (4-second interval)**:
   - Serves as a reliable safety net in case network drops temporarily interrupt active WebSocket connections.

---

## 👥 Roles & Access Permissions

| Role | Permitted Areas & Capabilities |
| :--- | :--- |
| **`admin` / `manager`** | Complete access across all modules: Dashboard, Payment Audit, POS, KDS, Floor Plans, Financial Reports, and User Roles. |
| **`cashier`** | Access to POS Billing, Order Settlement (Cash/Card/Online), and Payment Slip Verification. |
| **`kitchen`** | Access restricted to the Kitchen Display System (KDS) screen to view tickets, manage prep stages, and mark food ready. |
| **`customer`** | Mobile app access for browsing luxury menus, placing pre-orders, reserving tables, and uploading bank transfer slips. |

---

## 🔧 Troubleshooting & FAQs

### Q1: "Port 3000 is already in use" Error
**Solution:**
Because the Express backend typically runs on port `3000`, the Next.js Admin dev server will automatically offer to run on port `3001` or `3002`. If an old zombie process is occupying port 3000, terminate it using:
```bash
# macOS / Linux:
kill $(lsof -t -i:3000)
```

### Q2: Orders page still shows "awaiting audit approval" banner even after slips are removed?
**Solution:**
Ensure you have the latest code in [orders/page.js](file:///Users/achinthaedirisinghe/Desktop/TableFlow/admin/src/app/orders/page.js). The `isAwaitingVerification` function excludes orders where `status` is `cancelled`, `payment_rejected`, `served`, `completed`, or where `payment_status` is `paid` or `failed`.

### Q3: Storage Permission Error when uploading slips from mobile
**Solution:**
Verify in your Supabase Dashboard under **Storage** that the bucket `payment-slips` exists and that the Row Level Security policies from `backend/payment_verification_migration.sql` have been executed.

---

## 📜 License & Credits

Developed with excellence for **TableFlow Luxury Dining Solutions**.  
All rights reserved © 2026.
