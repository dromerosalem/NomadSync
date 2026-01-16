
# Technical Specification: TacticalTravel Backend (Supabase)

**Version:** 1.0
**Context:** PWA Travel Itinerary & Expense Tracking App
**Target Platform:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)

## 1. Executive Summary
This document defines the backend architecture required to support the "TacticalTravel" frontend. The application relies on **Supabase** for Authentication, Database (PostgreSQL), and Real-time subscriptions. The core complexity lies in the relationship between **Trips**, **Members**, and **Itinerary Items** (which double as financial transactions).

## 2. Architecture Overview
*   **Database:** PostgreSQL (via Supabase).
*   **Auth:** Supabase Auth (Email/Password + Google OAuth).
*   **Storage:** Supabase Storage (Trip Covers, Avatars, Receipt Images).
*   **API:** PostgREST (auto-generated from tables) + Supabase Edge Functions (AI proxy, Email invites).

---

## 3. Database Schema
*Note: All tables must have `created_at` (default `now()`) and `updated_at` (managed by trigger) timestamps.*

### 3.1. Users & Profiles
Extends Supabase `auth.users`.

**Table: `profiles`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PK, FK -> `auth.users.id` | 1:1 link to Auth user. Cascade Delete. |
| `email` | text | Unique, Not Null | Mirrored from auth for easier querying via trigger. |
| `full_name` | text | | Display name (e.g., "Ghost Operative"). |
| `avatar_url` | text | | Path to Supabase Storage bucket `avatars`. |
| `class_level` | text | Default 'Pathfinder' | Gamification rank. |
| `total_miles` | float | Default 0.0 | Gamification stat. |

### 3.2. Trips
Stores the high-level mission data.

**Table: `trips`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PK, Default `gen_random_uuid()` | |
| `name` | text | Not Null | e.g., "OPERATION: TOKYO". |
| `destination` | text | Not Null | e.g., "Shibuya • Japan". |
| `start_date` | timestamptz | Not Null | |
| `end_date` | timestamptz | Not Null | |
| `cover_image_url` | text | | Path to bucket `trip-covers`. |
| `status` | text | Default 'PLANNING' | Enum: `PLANNING`, `IN_PROGRESS`, `COMPLETE`. |
| `budget_view_mode` | text | Default 'SMART' | Enum: `SMART`, `DIRECT`. Controls frontend debt calc logic. |
| `created_by` | uuid | FK -> `profiles.id` | The initial creator. |

### 3.3. Trip Members (Join Table)
Manages access, roles, and personal budgets.

**Table: `trip_members`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `trip_id` | uuid | PK, FK -> `trips.id` | Cascade Delete. |
| `user_id` | uuid | PK, FK -> `profiles.id` | Cascade Delete. |
| `role` | text | Not Null, Default 'PASSENGER' | Enum: `PATHFINDER` (Admin), `SCOUT` (Edit), `PASSENGER` (Read). |
| `personal_budget` | float | Default 0.0 | Private budget for this specific trip. |
| `status` | text | Default 'PENDING' | Enum: `ACTIVE`, `PENDING`, `BLOCKED`. |
| `pending_expense_invite`| boolean | Default false | Flag for "Share Past Expenses" feature. |

### 3.4. Itinerary Items (Expenses & Events)
The core table. Acts as both the Calendar Event and the Financial Ledger Entry.

**Table: `itinerary_items`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PK, Default `gen_random_uuid()` | |
| `trip_id` | uuid | FK -> `trips.id` | Cascade Delete. |
| `type` | text | Not Null | Enum: `STAY`, `TRANSPORT`, `ACTIVITY`, `FOOD`, `ESSENTIALS`, `SETTLEMENT`. |
| `title` | text | Not Null | |
| `location` | text | | Origin for Transport, Venue for others. |
| `end_location` | text | | Destination (only for `TRANSPORT`). |
| `start_date` | timestamptz | Not Null | |
| `end_date` | timestamptz | | |
| `duration_minutes` | int | | Detected from AI scanning or user input. |
| `cost` | float | Default 0.0 | Total cost of the item. |
| `paid_by` | uuid | FK -> `profiles.id` | Who swiped the card. |
| `created_by` | uuid | FK -> `profiles.id` | Who logged the item in the app. |
| `is_private` | boolean | Default false | If true, only visible to `created_by`. |
| `show_in_timeline` | boolean | Default true | If false, shows in Ledger but not Timeline. |
| `details` | text | | Notes, Seat #, confirmation codes. |
| `map_uri` | text | | Google Maps Link. |
| `tags` | text[] | | Array of strings (e.g., ["Work", "Nightlife"]). |

### 3.5. Expense Splits
Defines exactly how much each person owes for a specific `itinerary_item`.
*Logic:* If `itinerary_item.cost` is 100 and split between A and B equally, there are two rows here: (A, 50), (B, 50).

**Table: `expense_splits`**
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `item_id` | uuid | PK, FK -> `itinerary_items.id` | Cascade Delete. |
| `user_id` | uuid | PK, FK -> `profiles.id` | The person who consumes/owes. |
| `amount` | float | Not Null | The specific amount this user is responsible for. |

---

## 4. Row Level Security (RLS) Policies

Security is paramount. The app relies on "Clearance Levels".

1.  **Profiles:**
    *   `SELECT`: Public (Authenticated users can search others by email to invite).
    *   `UPDATE`: Users can only update their own profile (`id = auth.uid()`).

2.  **Trips:**
    *   `SELECT`: Users can see trips where they are a member: `exists(select 1 from trip_members where trip_id = trips.id and user_id = auth.uid())`.
    *   `INSERT`: Authenticated users.
    *   `UPDATE`: Only members with role `PATHFINDER` or `SCOUT`.

3.  **Itinerary Items:**
    *   `SELECT`:
        *   If `is_private = false`: Visible to all trip members.
        *   If `is_private = true`: Visible ONLY if `created_by = auth.uid()`.
    *   `INSERT/UPDATE/DELETE`: Only members with role `PATHFINDER` or `SCOUT`, OR if `created_by = auth.uid()` (Users can always edit/delete their own private items).

4.  **Expense Splits:**
    *   Inherits visibility/permissions from the parent `itinerary_item`.

---

## 5. API Logic & Edge Functions

### 5.1. Database Functions (RPCs)
To optimize the `BudgetEngine` component, implement a Postgres Function.

**RPC:** `get_trip_balances(trip_uuid)`
*   **Logic:**
    1.  Fetch all items for the trip where `is_private = false`.
    2.  Sum `paid_by` amounts per user (Credit).
    3.  Sum `expense_splits` amounts per user (Debit).
    4.  Return a JSON object with `net_balance` per member.

### 5.2. Edge Function: Receipt Scanning (AI Proxy)
**Function Name:** `analyze-receipt`
*   **Trigger:** HTTPS POST (from `services/geminiService.ts`).
*   **Environment Variables:** `GEMINI_API_KEY`.
*   **Input:** Base64 Image/PDF string + `tripStartDate` context.
*   **Action:**
    1.  Validate User Auth Token (Supabase Auth).
    2.  Construct prompt for Google Gemini Flash 2.5 model.
    3.  Call Google GenAI API.
    4.  Return structured JSON (Item Type, Cost, Date, Title) to frontend.
*   **Security:** Keeps the Gemini API Key hidden from the browser client.

### 5.3. Edge Function: Invite System
**Function Name:** `send-invite`
*   **Input:** Email, TripID, Role.
*   **Action:**
    1.  Check if user exists in `profiles`.
    2.  If yes: Create `trip_member` entry (Status: PENDING) and send Push Notification/Email.
    3.  If no: Send Email with "Join App" link containing a referral token.

---

## 6. Logging & KPIs

Backend should track events to `app_logs` table for monitoring.

### 6.1. Application Logs Table
**Table: `app_logs`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `created_at` | timestamptz | |
| `event_name` | text | e.g., `TRIP_CREATED`, `EXPENSE_LOGGED` |
| `user_id` | uuid | FK -> `profiles.id` |
| `metadata` | jsonb | Extra details (trip_id, amount, error_msg) |

### 6.2. Mandatory KPI Metrics
Create SQL Views for a Dashboard tracking:
1.  **Mission Velocity:** count of `itinerary_items` added where `created_at > now() - interval '7 days'`.
2.  **Financial Flow:** `sum(cost)` of all items (Gross Transaction Volume).
3.  **Settlement Ratio:** `(Sum of SETTLEMENT items / Sum of EXPENSE items)`. Indicates how much users are actually paying each other back.
4.  **Retention:** % of users who log an item > 7 days after signup.

---

## 7. Implementation Checklist

1.  [ ] **Init Supabase Project:** Set up new project.
2.  [ ] **Run Migration:** Create tables defined in Section 3.
3.  [ ] **Setup Storage Buckets:**
    *   `trip-covers` (Public read, Authenticated upload).
    *   `avatars` (Public read, Authenticated upload).
4.  [ ] **Apply RLS Policies:** Strict policies as defined in Section 4.
5.  [ ] **Deploy Edge Functions:** `analyze-receipt` and `send-invite`.
6.  [ ] **Database Triggers:**
    *   Auto-create `profile` on `auth.users` insert.
    *   Update `profiles.total_miles` when a Trip is marked `COMPLETE`.
7.  [ ] **Testing:** Verify "Smart Split" math in SQL against frontend logic.
