# Eternum WASD S1 Dashboard

A Next.js web application for WASD guild members to manage members, track S1 Season Passes, and visualize the Live Map for the Eternum game.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Member Management:** Add, remove, list, and assign roles/elite status to guild members. Includes S1 Pass ownership tracking.
- **S1 Season Pass Dashboard:** View, filter (by name, resource, owner, etc.), and export S1 Pass data. Guild member passes are prioritized.
- **Live Map:** Interactive hex map displaying banks, occupied spots, and member presence with clickable details.
- **Authentication:** Discord login via NextAuth for access control.
- **Modern UI:** Responsive design with TailwindCSS and TypeScript.

---

## Tech Stack

- **Framework:** Next.js
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Database:** MongoDB
- **Authentication:** NextAuth (Discord)
- **Development:** Turbopack (via `npm run dev`)
- **Other:** XLSX (Excel export)

---

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repo-url>
    cd eternum-wasd
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    Create a `.env.local` file with (see original README for more details if needed):
    ```env
    MONGODB_URI=
    NEXTAUTH_URL=http://localhost:3000
    NEXTAUTH_SECRET=
    DISCORD_CLIENT_ID=
    DISCORD_CLIENT_SECRET=
    GAME_DATA_SQL=your_game_data_sql_endpoint # e.g., https://api.cartridge.gg/x/s1_eternum_data/torii/sql
    ```
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
5.  **Open** [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

- `npm run dev`: Start the development server.
- `npm run build`: Build for production.
- `npm run start`: Start the production server.
- `npm run lint`: Run ESLint.

---

## API Endpoints

Key API routes are located in `src/app/api/`. Main endpoints include:
- `/api/members`: Member management.
- `/api/members-with-realm-counts`: Members with S1 Pass counts.
- `/api/realms`: S1 Pass data (structures).
- `/api/cartridge-address`: Fetch Starknet address from Cartridge username.

---

## Contributing

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/your-feature`).
3.  Commit your changes (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/your-feature`).
5.  Open a Pull Request.

---

## License

MIT License. Copyright (c) 2025 - WASD