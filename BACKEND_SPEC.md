# Technical Specification: NomadSync Backend (Supabase)

**Version:** 2.1
**Context:** PWA Group Travel Companion
**Target Platform:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)

## 1. Executive Summary
This document defines the backend architecture required to support the "NomadSync" frontend. The application relies on **Supabase** for Authentication, Database (PostgreSQL), and Real-time subscriptions. The core complexity lies in the relationship between **Trips**, **Members**, and **Itinerary Items** (which double as financial transactions), facilitated by a modern React frontend hosted on Vercel.

## 2. Architecture Overview

### Tech Stack
*   **Frontend**: React 19, Ionic React, Ionic Router, Vite, TypeScript, Tailwind CSS, Shadcn/ui, Lucide Icons.
*   **Backend**: Supabase.
    *   **Database**: PostgreSQL 15+.
    *   **Auth**: Supabase Auth (Email + Google OAuth).
    *   **Storage**: Supabase Storage (Trip Covers, Receipt Images).
    *   **Edge Functions**: Deno (AI analysis, Emails).
*   **AI Models**:
    *   **Standard Tier**: Google Gemini Flash 2.5 Lite, Llama 4 Maverick (via Groq).
    *   **Premium Tier**: Google Gemini Flash 2.5 (Premium).

### Data Flow
1.  **Client (React/PWA)** interacts with Supabase via `@supabase/supabase-js`.
2.  **Real-time** updates are pushed to clients via Postgres Changes (CDC).
3.  **Heavy Processing** (e.g., AI receipt scanning) is offloaded to **Edge Functions**.
4.  **Static Assets** are served via Vercel CDN.

---

## 3. Database Schema
*Note: All tables must have `created_at` (default `now()`) and `updated_at` (managed by trigger) timestamps.*

### 3.1. Users & Profiles
Extends Supabase `auth.users`.

**Table: `profiles`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PK, FK -> `auth.users.id` | 1:1 link to Auth user. Cascade Delete. |
| `email` | text | Unique, Not Null | Mirrored from auth for easier querying. |
| `full_name` | text | | Display name (e.g., "Alex Wanderer"). |
| `avatar_url` | text | | Path to Supabase Storage bucket `avatars`. |
| `class_level` | text | Default 'Pathfinder' | Gamification rank. |
| `total_miles` | float | Default 0.0 | Gamification stat. |

### 3.2. Trips
Stores the high-level adventure data.

**Table: `trips`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PK, Default `gen_random_uuid()` | |
| `name` | text | Not Null | e.g., "Euro Summer 2026". |
| `destination` | text | Not Null | e.g., "Paris • France". |
| `start_date` | timestamptz | Not Null | |
| `end_date` | timestamptz | Not Null | |
| `cover_image_url` | text | | Path to bucket `trip-covers`. |
| `status` | text | Default 'PLANNING' | Enum: `PLANNING`, `ACTIVE`, `COMPLETED`. |
| `budget_view_mode` | text | Default 'SMART' | Enum: `SMART`, `DIRECT`. Controls debt calc. |
| `created_by` | uuid | FK -> `profiles.id` | The initial creator. |

### 3.3. Trip Members (Join Table)
Manages access, roles, and personal budgets.

**Table: `trip_members`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `trip_id` | uuid | PK, FK -> `trips.id` | Cascade Delete. |
| `user_id` | uuid | PK, FK -> `profiles.id` | Cascade Delete. |
| `role` | text | Not Null, Default 'MEMBER' | Enum: `LEAD` (Admin), `EDITOR` (Edit), `VIEWER` (Read). |
| `status` | text | Default 'PENDING' | Enum: `ACTIVE`, `PENDING`, `BLOCKED`. |

### 3.4. Itinerary Items (Expenses & Events)
The core table. Acts as both the Calendar Event and the Financial Ledger Entry.

**Table: `itinerary_items`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PK, Default `gen_random_uuid()` | |
| `trip_id` | uuid | FK -> `trips.id` | Cascade Delete. |
| `type` | text | Not Null | Enum: `STAY`, `TRANSPORT`, `ACTIVITY`, `FOOD`, `OTHER`, `SETTLEMENT`. |
| `title` | text | Not Null | |
| `location` | text | | Origin for Transport, Venue for others. |
| `start_date` | timestamptz | Not Null | |
| `end_date` | timestamptz | | |
| `cost` | float | Default 0.0 | Total cost of the item. |
| `paid_by` | uuid | FK -> `profiles.id` | Who paid. |
| `created_by` | uuid | FK -> `profiles.id` | Who logged the item. |
| `is_private` | boolean | Default false | If true, only visible to `created_by`. |
| `details` | text | | Notes, confirmation codes. |
| `receipt_items` | jsonb | | **Itemized Data**: Array of objects (`name`, `price`, `quantity`) extracted from receipts. |

### 3.5. Expense Splits
Defines exactly how much each person owes for a specific `itinerary_item`.

**Table: `expense_splits`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `item_id` | uuid | PK, FK -> `itinerary_items.id` | Cascade Delete. |
| `user_id` | uuid | PK, FK -> `profiles.id` | The person who consumes/owes. |
| `amount` | float | Not Null | The specific amount this user owes. |

---

## 4. Security (RLS) Policies

1.  **Profiles**: Public read (for invites), Owner update.
2.  **Trips**: Visible to members only.
3.  **Itinerary Items**:
    *   **Public**: Visible to all trip members.
    *   **Private**: Visible only to creator.
    *   **Edit**: Only `LEAD` or `EDITOR` roles, or item creator.

---

## 5. API Logic & Edge Functions

### 5.1. Database Functions (RPCs)
**RPC:** `get_trip_balances(trip_uuid)`
*   Calculates net balances for all members based on `paid_by` (credit) vs `expense_splits` (debit).

### 5.2. Edge Function: Receipt Scanning (AI Proxy)
**Function Name:** `analyze-receipt`
*   **Trigger**: POST from Client.
*   **Orchestator**:
    *   **Primary Round-Robin**: Randomly selects between **Gemini Flash 2.5 Lite** and **Llama 4 Maverick**.
    *   **Fallback**: If primary model confidence < 90%, retries with **Gemini Flash 2.5 Premium**.
*   **Logic**:
    1.  Receives image/PDF.
    2.  Selects AI model based on orchestration logic.
    3.  Extracts: Date, Total, Merchant, Currency, and **Line Items**.
    4.  Returns structured JSON including `receiptItems` array.

### 5.3. Edge Function: Invites
**Function Name:** `send-invite`
*   **Logic**: Sends email invitations via localized transactional email service.

---

## 6. Client-Side & Offline Architecture (Local-First)

### 6.1. Storage Stratagy
NomadSync employs a **Local-First** architecture to ensure functionality in low-connectivity environments (e.g., remote travel locations).
*   **IndexedDB (Dexie.js)**: The primary persistent store for application data.
    *   `trips`: Stores full trip details.
    *   `items`: Stores all itinerary items and their `receipt_items`.
    *   `trip_members`: Stores member roles and profiles.
    *   `sync_queue`: Queues mutations (`INSERT`, `UPDATE`, `DELETE`) that occur while offline.
*   **Cache API**: Stores static assets (JS/CSS bundles) and map tiles (`nomadsync-map-tiles-v1`) for offline map rendering.
*   **LocalStorage**: Stores lightweight state like `nomadsync_device_id` and Auth tokens.

### 6.2. Navigation & Routing
*   **Ionic React Router**: Manages application state via URL synchronization.
*   **Deep Linking**: Supports direct access to specific trips (`/journey/:tripId`) and views (`/dashboard`, `/profile`).
*   **Scroll Management**: Custom handling for intuitive scroll position retention and resetting between views.

### 6.3. Synchronization Logic
*   **Optimistic UI**: All user actions (creates, updates) are applied immediately to the local `Dexie` database and reflected in the UI.
*   **Background Sync**:
    *   A **Status Queue** tracks all local changes.
    *   **Trigger**: The Service Worker listens for `sync` events, or the app attempts to flush the queue when the network status becomes `online`.
    *   **Conflict Resolution**: Server timestamps generally win. Non-conflicting field updates are merged intelligently.

---

## 7. Notification System (Mission Intel)

### 7.1. Architecture
*   **Protocol**: Web Push API with VAPID authentication.
*   **Backend**: Supabase Edge Function (`push-dispatch`).
*   **Provider**: `@negrel/webpush` (Deno compatible).

### 7.2. Components
1.  **Frontend**:
    *   `NotificationManager` requests permission and subscribes the user agent to the push service.
    *   Stores `subscription` object + unique `device_id` in Supabase table `user_devices`.
2.  **Service Worker (`sw.js`)**:
    *   Listens for `push` events.
    *   Displays system notifications with Deep Linking support (e.g., clicking opens specific trip).
3.  **Edge Function (`push-dispatch`)**:
    *   Triggered via Database Webhooks (Database Trigger -> HTTP Request).
    *   Fetches target devices from `user_devices`.
    *   Broadcasts payloads using VAPID keys.

### 7.3. Triggers (The "When")
| Event | Trigger Condition | Notification Title | Target Audience |
| :--- | :--- | :--- | :--- |
| **New Intel** | `INSERT` on `itinerary_items` | "New Mission Intel" | All other Trip Members (excluding creator). |
| **Duty Call** | `INSERT` on `trip_members` | "Mission Invite" | The specific user invited. |

---

## 8. Implementation Checklist
1.  [x] **Init Supabase Project**
2.  [x] **Database Schema Migration**
3.  [x] **Storage Buckets Setup**
4.  [x] **RLS Policies Applied**
5.  [x] **Edge Functions Deployment**
