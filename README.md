# 🍽️ TableFlow — Intelligent Restaurant Operating System

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)](https://react.dev/)
[![Flutter](https://img.shields.io/badge/Flutter-3.13+-02569B?logo=flutter)](https://flutter.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime_DB-3ECF8E?logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-gold.svg)]()

> **TableFlow** යනු සුඛෝපභෝගී සහ නවීන ආපනශාලා (Fine Dining & Contemporary Restaurants) සඳහාම විශේෂයෙන් නිර්මාණය කරන ලද සම්පූර්ණ ඩිජිටල් කළමනාකරණ පද්ධතියකි (End-to-End Restaurant Management & Operating System). 
> 
> මෙහි **Flutter Mobile App** (පාරිභෝගිකයින් සඳහා), **Next.js Web Console** (ආපනශාලා කළමනාකරුවන්, මුදල් අයකැමියන් සහ මුළුතැන්ගෙයි කාර්ය මණ්ඩලය සඳහා), සහ **Express/Node.js Backend Engine** එකක් අන්තර්ගත වන අතර, මේ සියල්ල **Supabase Realtime Database** මඟින් තත්‍ය කාලීනව (Real-time) සම්බන්ධ වේ.

---

## 📑 පටුන (Table of Contents)

1. [පද්ධති සැකැස්ම සහ තාක්ෂණය (System Architecture & Tech Stack)](#-system-architecture--tech-stack)
2. [ප්‍රධාන විශේෂාංග (Core Features)](#-core-features)
3. [ෆෝල්ඩර ව්‍යුහය (Project Structure)](#-project-structure)
4. [පූර්වාවශ්‍යතා (Prerequisites)](#-prerequisites)
5. [පද්ධතිය පිහිටුවීම සහ Run කරන ආකාරය (Installation & Running Guide)](#-installation--running-guide)
   - [පියවර 1: Supabase Database සැකසීම (Database Setup)](#step-1-supabase-database-setup)
   - [පියවර 2: Backend API එක Run කිරීම (Backend Setup)](#step-2-backend-setup--run)
   - [පියවර 3: Admin Web Console එක Run කිරීම (Admin Setup)](#step-3-admin-web-console-setup--run)
   - [පියවර 4: Flutter Mobile App එක Run කිරීම (Mobile App Setup)](#step-4-flutter-mobile-app-setup--run)
6. [Production Build සාදන ආකාරය (Building for Production)](#-building-for-production)
7. [තත්‍ය කාලීන දත්ත සමමුහුර්තකරණය (Real-time Live Sync Architecture)](#-real-time-live-sync-architecture)
8. [පොදු ගැටලු සහ විසඳුම් (Troubleshooting & FAQs)](#-troubleshooting--faqs)

---

## 🏛️ System Architecture & Tech Stack

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                     TableFlow Ecosystem                     │
 └──────────────────────────────┬──────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 📱 Mobile App (Flutter)   🌐 Admin Portal (Next.js) ⚙️ Backend API (Node)
 ├─ Customer Pre-orders    ├─ Live Kitchen KDS      ├─ Inventory Lock RPC
 ├─ Table Reservations     ├─ POS Cashier Billing   ├─ Order Verification
 ├─ Bank Slip Upload       ├─ Payment Audit Desk    ├─ FCM Notification
 └─ Live Order Tracking    └─ Reports & CSV Export  └─ Background Cron Jobs
        ▲                       ▲                       ▲
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
               🗄️ Supabase Cloud (PostgreSQL)
               ├─ Row Level Security (RLS)
               ├─ Real-time Websocket Pub/Sub
               └─ Private Storage Bucket (Payment Slips)
```

| Component | Framework / Library | Primary Role |
| :--- | :--- | :--- |
| **Mobile Client** | **Flutter 3.13+ / Dart** | පාරිභෝගිකයින්ට Menu බැලීම, Table Reserve කිරීම, Pre-order දැමීම සහ Slip Upload කිරීම |
| **Admin Console** | **Next.js 16 (Turbopack) / React 19** | Cashier POS, Kitchen Display (KDS), Payment Slip Audit Desk, Analytics |
| **Backend API** | **Node.js / Express.js** | Atomic Inventory Locks, FCM Push Notifications, Background Order Expiry |
| **Database & Auth** | **Supabase (PostgreSQL + RLS)** | User Authentication, Real-time Subscriptions, Data Storage |
| **Push Alerts** | **Firebase Cloud Messaging (FCM)** | Order Updates පාරිභෝගිකයාගේ දුරකථනයට Push Notification ලෙස යැවීම |

---

## ✨ Core Features

### 1. 📱 Customer Mobile App (Flutter)
- **Interactive Fine Dining Menu**: Portion sizing (Regular / King Cut), Gourmet Add-ons, සහ Signature Sauces සමඟ ඇණවුම් කිරීම.
- **Table Booking & Floor Reservations**: වේලාව සහ පැමිණෙන පුද්ගලයින් ගණන අනුව මේස වෙන්කරවා ගැනීම.
- **Direct Bank Transfer & Slip Upload**: බැංකු හුවමාරු රිසිට්පත් කැමරාවෙන් හෝ ගැලරියෙන් සෘජුවම upload කිරීම.
- **Live Order Tracker**: ආහාර පිළියෙළ වන ආකාරය (Pending → Preparing → Ready → Served) Real-time බලාගැනීම.
- **Accessibility Modes**: පෙනීමේ අපහසුතා ඇති අය සඳහා High Contrast සහ Large Font පහසුකම්.

### 2. 🧾 Payment Slip Audit Desk
- පාරිභෝගිකයින් Upload කරන බැංකු රිසිට්පත් පරීක්ෂා කිරීම සඳහා වූ විශේෂිත Audit Desk.
- Zoom in / out සහ 90° Rotate කළ හැකි Interactive Lightbox Slip Viewer.
- 1-Click Verification: රිසිට්පත තහවුරු කළ සැණින් ස්වයංක්‍රීයව Order එක Kitchen Queue එකට යොමු වේ.
- Dispute Rejection: වැරදි රිසිට්පත් Canned Reason හෝ Custom හේතුවක් සමඟ Reject කර පාරිභෝගිකයාට දැනුම් දීම.
- Multi-Tab Live Sync: Audit Desk එකේදී සිදුකරන වෙනස්කම් Orders පිටුව සහ Sidebar එක තුළ ක්ෂණිකව live update වීම.

### 3. 🍳 Kitchen Display System (KDS)
- මුළුතැන්ගෙයි කෝකියන් සඳහාම වෙන්වූ විශේෂ Screen එකක්.
- නව Order එකක් පැමිණි විට හෝ Review එකක් ලැබුණු විට ස්වයංක්‍රීයව නාද වන **Web Audio Synthesizer Chimes**.
- Order එකක් ප්‍රමාද වන විට වර්ණය වෙනස් වන (Green → Gold → Red) Urgent Timers.

### 4. 💳 Cashier POS & Billing
- Walk-in පාරිභෝගිකයන් සහ Table Dine-in ඇණවුම් ඉක්මනින් Punch කළ හැකි POS Interface.
- Cash, Card, හෝ Split Payment ක්‍රම මඟින් බිල්පත් පියවීම සහ Instant Receipt Generation.

### 5. 📊 Reports & Register Reconciliation (Z-Reports)
- දෛනික ආදායම, Shift Summary, සහ Net Sales විශ්ලේෂණය.
- RFC 4180 Standard CSV Export පහසුකම.

---

## 📂 Project Structure

```text
TableFlow/
├── backend/                       # Node.js & Express REST Backend
│   ├── src/
│   │   ├── config/supabase.js     # Supabase Service Role Client
│   │   ├── routes/paymentAudit.js # Bank Transfer Audit & Verification APIs
│   │   ├── services/fcm.js        # Firebase Cloud Messaging Service
│   │   ├── jobs/orderExpiryJob.js # Auto-release unverified stock cron
│   │   └── server.js              # Express Application Entry
│   ├── payment_verification_migration.sql # DB Schema for Slips & Audit
│   └── package.json
│
├── admin/                         # Next.js 16 Admin & Staff Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── orders/            # Kitchen & Live Orders Management
│   │   │   ├── payment-audit/     # Bank Slip Verification Lightbox
│   │   │   ├── kds/               # Kitchen Display System Screen
│   │   │   ├── pos/               # Cashier POS Billing Terminal
│   │   │   ├── tables/            # Table & Floor Plan Management
│   │   │   ├── reservations/      # Booking Calendar & Table Sync
│   │   │   ├── reports/           # Financial Summaries & CSV Export
│   │   │   └── login/             # Staff Authentication Screen
│   │   ├── components/Sidebar.js  # Live Badge Navigation Sidebar
│   │   └── lib/supabase.js        # Browser Supabase Client
│   ├── admin.css                  # Modern High-End UI Stylesheet
│   └── package.json
│
└── mobile/                        # Flutter Cross-Platform Client App
    ├── lib/
    │   ├── screens/customer/      # Cart, Menu, Tracker, Reservations
    │   ├── providers/             # CartProvider, SettingsProvider
    │   ├── services/              # SupabaseService, FCMService, ApiService
    │   └── main.dart              # Flutter Entry Point
    └── pubspec.yaml
```

---

## 🛠️ Prerequisites

පද්ධතිය run කිරීමට පෙර ඔබේ පරිගණකයේ පහත මෘදුකාංග ස්ථාපනය කර තිබිය යුතුය:

1. **Node.js**: `v18.0.0` හෝ ඊට වැඩි (LTS recommended) — [Download Node.js](https://nodejs.org/)
2. **Flutter SDK**: `v3.13.0` හෝ ඊට වැඩි — [Install Flutter](https://docs.flutter.dev/get-started/install)
3. **Git**: [Install Git](https://git-scm.com/)
4. **Google Chrome / Android Studio / Xcode**: Mobile App එක Run කර බැලීම සඳහා Device Emulator එකක් හෝ Web Browser එකක්.
5. **Supabase Account**: දත්ත ගබඩාව සඳහා [Supabase](https://supabase.com/) ගිණුමක්.

---

## 🚀 Installation & Running Guide

### Step 1: Supabase Database Setup

1. [Supabase Dashboard](https://supabase.com/dashboard) එකට ගොස් නව Project එකක් සාදන්න (හෝ පවතින Project එක තෝරන්න).
2. Supabase හි **SQL Editor** එක විවෘත කරන්න.
3. `backend/payment_verification_migration.sql` හි ඇති SQL code එක Run කරන්න:
   - මෙමඟින් `payment-slips` Private Storage Bucket එක, `payment_transactions` table එක, සහ Stock Reservation stored functions (`reserve_inventory_for_order`, `commit_reserved_stock`, `release_reserved_stock`) නිර්මාණය වේ.
4. Real-time සක්‍රීය කිරීමට පහත SQL විධානයද SQL Editor එකේ run කරන්න:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE orders;
   ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions;
   ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
   ```

---

### Step 2: Backend Setup & Run

Backend Engine එක Express.js මඟින් ක්‍රියාත්මක වන අතර port `3000` හි ධාවනය වේ.

1. Terminal එකක් විවෘත කර `backend` ෆෝල්ඩරය වෙත යන්න:
   ```bash
   cd backend
   ```

2. Dependencies ස්ථාපනය කරන්න:
   ```bash
   npm install
   ```

3. `backend/.env` ගොනුව සාදන්න (හෝ පවතින ගොනුව සකසන්න):
   ```env
   PORT=3000
   SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
   SUPABASE_ANON_KEY=<YOUR-SUPABASE-ANON-KEY>
   SUPABASE_SERVICE_ROLE_KEY=<YOUR-SUPABASE-SERVICE-ROLE-KEY>
   ```

4. Backend සේවාදායකය (Development Mode) ධාවනය කරන්න:
   ```bash
   npm run dev
   ```
   > ✅ සාර්ථකව ක්‍රියාත්මක වූ විට Terminal එකේ `Server is running on port 3000` ලෙස දිස්වේ.

---

### Step 3: Admin Web Console Setup & Run

Admin Dashboard එක Next.js 16 මඟින් ධාවනය වේ.

1. නව Terminal ටැබ් එකක් විවෘත කර `admin` ෆෝල්ඩරය වෙත යන්න:
   ```bash
   cd admin
   ```

2. Dependencies ස්ථාපනය කරන්න:
   ```bash
   npm install
   ```

3. `admin/.env.local` ගොනුව සාදන්න:
   ```env
   PORT=3001
   NEXT_PUBLIC_SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR-SUPABASE-ANON-KEY>
   ```

4. Admin Dashboard එක ධාවනය කරන්න:
   ```bash
   npm run dev
   ```

5. ඔබේ Web Browser එක විවෘත කර පහත ලිපිනයට යන්න:
   - **Admin Portal**: [http://localhost:3000](http://localhost:3000) (හෝ Port 3000 busy නම් [http://localhost:3001](http://localhost:3001))
   - **Payment Audit Desk**: [http://localhost:3001/payment-audit](http://localhost:3001/payment-audit)
   - **Kitchen Screen (KDS)**: [http://localhost:3001/kds](http://localhost:3001/kds)
   - **Orders Management**: [http://localhost:3001/orders](http://localhost:3001/orders)

---

### Step 4: Flutter Mobile App Setup & Run

Mobile App එක Android, iOS, හෝ Web Browser මත පහසුවෙන්ම run කළ හැක.

1. නව Terminal ටැබ් එකක් විවෘත කර `mobile` ෆෝල්ඩරය වෙත යන්න:
   ```bash
   cd mobile
   ```

2. Flutter packages බාගත කරගන්න:
   ```bash
   flutter pub get
   ```

3. සම්බන්ධිත Devices / Emulators පරීක්ෂා කරන්න:
   ```bash
   flutter devices
   ```

4. App එක ධාවනය කරන්න:
   - **Chrome Web Browser මත:**
     ```bash
     flutter run -d chrome
     ```
   - **Android Emulator / Physical Device මත:**
     ```bash
     flutter run
     ```
   - **iOS Simulator (macOS පමණි):**
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
*(Docker භාවිත කරන්නේ නම්: `docker-compose up --build -d`)*

### 2. Admin Dashboard Production Build
```bash
cd admin
npm run build
npm run start
```
*(Build එක සාර්ථකව `.next` ෆෝල්ඩරය තුළ සම්පාදනය වේ)*

### 3. Flutter Mobile App Release Builds
```bash
cd mobile

# Android APK සාදාගැනීමට
flutter build apk --release

# Android App Bundle (Play Store සඳහා)
flutter build appbundle --release

# iOS Release (macOS & Xcode අවශ්‍ය වේ)
flutter build ios --release

# Web Static Build
flutter build web --release
```

---

## ⚡ Real-time Live Sync Architecture

TableFlow පද්ධතියේ කිසිදු පිටුවක් Manual Refresh කිරීමට අවශ්‍ය නොවන පරිදි ස්ථර 4 කින් යුත් **Multi-Channel Real-time Engine** එකක් ක්‍රියාත්මක වේ:

1. **Supabase Realtime Websockets**:
   - Database එකේ `orders` හෝ `payment_transactions` වෙනස් වූ සැණින් සියලු සම්බන්ධිත Clients වෙත WebSocket Push පැමිණේ.
2. **Browser `BroadcastChannel` (`tableflow_orders_channel`)**:
   - Admin කෙනෙක් වෙනම Tab එකක Payment Audit Desk හි Slip එකක් Approve/Reject කළ සැණින් Orders tab එක සහ Sidebar එක ක්ෂණිකව (<10ms) update වේ.
3. **Window Focus / Tab Visibility Detection**:
   - පරිශීලකයා වෙනත් Tab එකක සිට නැවත Orders tab එකට පැමිණි විගස `window.onfocus` මඟින් දත්ත අලුත් වේ.
4. **Heartbeat Polling Fallback (4s)**:
   - අන්තර්ජාල සම්බන්ධතාවය බිඳවැටී නැවත පැමිණියද කිසිදු ඇණවුමක් මගනොහැරෙන බව තහවුරු කරයි.

---

## 🔧 Troubleshooting & FAQs

### ප්‍රශ්නය 1: "Port 3000 is already in use" දෝෂය පැමිණියහොත්?
**විසඳුම:**
Backend එක port 3000 භාවිතා කරන බැවින් Next.js Admin app එක port 3001 හෝ 3002 හි ස්වයංක්‍රීයව ධාවනය වේ. පැරණි process එකක් නවතා දැමීමට අවශ්‍ය නම්:
```bash
# macOS / Linux:
kill $(lsof -t -i:3000)
```

### ප්‍රශ්නය 2: Audit Desk එකේ රිසිට්පත් නොමැති වුවද Orders පිටුවේ Banner එක දිස්වේද?
**විසඳුම:**
අප විසින් [orders/page.js](file:///Users/achinthaedirisinghe/Desktop/TableFlow/admin/src/app/orders/page.js) හි `isAwaitingVerification` ශ්‍රිතය නිවැරදි කර ඇති අතර, Cancelled, Rejected, Paid, හෝ Completed orders ස්වයංක්‍රීයව බැහැර කරනු ලබයි. ගැටලුවක් මතු වුවහොත් `orders` table එකේ status එක `'cancelled'` හෝ payment_status එක `'failed'` දැයි තහවුරු කරගන්න.

### ප්‍රශ්නය 3: Flutter App එකේ Slip Upload කරන විට Storage Permission දෝෂයක් ආවොත්?
**විසඳුම:**
Supabase Dashboard හි Storage අංශයට ගොස් `payment-slips` නමින් bucket එකක් පවතින බවත්, `payment_verification_migration.sql` හි අඩංගු Storage Policies ක්‍රියාත්මක කර ඇති බවත් තහවුරු කරගන්න.

---

## 👥 Roles & Access Permissions

| භූමිකාව (Role) | Access & Permissions |
| :--- | :--- |
| **`admin` / `manager`** | පද්ධතියේ සියලුම අංශ (Dashboard, Audit Desk, POS, KDS, Tables, Reports, User Management) වෙත පූර්ණ ප්‍රවේශය. |
| **`cashier`** | POS Billing, Orders පියවීම, Cash/Card Settlement, සහ Payment Slip Review. |
| **`kitchen`** | Kitchen Display Screen (KDS) පමණක් විවෘත වන අතර ඇණවුම් පිළියෙළ කිරීම සහ Ready කිරීම. |
| **`customer`** | Mobile App එක මඟින් ආහාර ඇණවුම් කිරීම, මේස වෙන්කරවා ගැනීම, සහ රිසිට්පත් Upload කිරීම. |

---

## 📜 License & Credits

Developed with ❤️ for **TableFlow Luxury Dining Solutions**.  
All rights reserved © 2026.
