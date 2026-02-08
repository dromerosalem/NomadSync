<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# NomadSync: Group Travel Refined

NomadSync is a modern PWA designed to be the ultimate companion for group travel. It combines itinerary management, real-time collaboration, and smart expense tracking into a single, offline-first application.

## 📖 Documentation

*   **[Product Overview](PRODUCT_OVERVIEW.md)**: Detailed breakdown of features, architecture, and core pillars.
*   **[Technical Specification](BACKEND_SPEC.md)**: In-depth view of the tech stack, database schema, and security policies.

## ✨ Key Features

*   **Itinerary Hub**: Visual timeline and interactive maps for your entire journey.
*   **Smart Expenses**: Split bills, scan receipts with AI (Gemini + Llama), and track real-time balances.
*   **Offline-First**: Access your data anywhere, even without a signal.
*   **Squad Sync**: Real-time updates and role-based permissions for your travel group.
*   **Seamless Navigation**: Deep linking support and URL synchronization for all trips and views.

## 🛠️ Tech Stack

Built with a focus on performance and developer experience:

*   **Frontend**: React 19, Ionic React, Ionic Router, Vite, Tailwind CSS, TypeScript.
*   **Backend**: Supabase (Auth, Postgres, Realtime, Storage).
*   **AI**: Google Gemini & Llama (Receipt Analysis).

## 🚀 Run Locally

**Prerequisites:** Node.js 20+

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Environment:**
    Set the `GEMINI_API_KEY` and Supabase credentials in [.env.local](.env.local).

3.  **Start the App:**
    ```bash
    npm run dev
    ```

4.  **View in Browser:**
    Open [http://localhost:5173](http://localhost:5173).
