# Eternum WASD S1 Dashboard

A modern web application for managing WASD guild members, tracking S1 Season Passes, and visualizing the Settling Map for the Eternum game. Built with Next.js, TypeScript, and MongoDB, it provides a robust dashboard, interactive map, and member management tools for guild administrators and members.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Member Management**
  - Add, remove, and list guild members
  - Fetch Starknet address from Cartridge username
  - Assign roles (warmonger, farmer, hybrid) and elite status
  - Display and sort by S1 Passes owned per member

- **S1 Season Pass Dashboard**
  - View all S1 Passes with details (resources, troops, owner, etc.)
  - Data is fetched periodically using a SQL query.
  - Filter by name/ID, resource, troop type, owner
  - Owner filter prioritizes guild members (by username)
  - Filter for passes owned by guild members only
  - Export filtered list to Excel
  - Automatically refreshes owner data every 5 minutes.

- **Settling Map**
  - Interactive hex map showing banks, zones, and occupation
  - Visualizes which members occupy which spots
  - Color-coded by member, zone, and special tiles
  - Clickable hexes for details

- **Authentication**
  - Discord login via NextAuth
  - Access control for map and dashboard

- **Modern UI**
  - Responsive, mobile-friendly design
  - TailwindCSS for rapid styling
  - Type-safe development with TypeScript

---

## Tech Stack

- **Framework:** Next.js 15.3.1
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Database:** MongoDB
- **Authentication:** NextAuth (Discord)
- **Development:** Turbopack
- **Other:** XLSX (Excel export), Node Fetch

---

## Project Structure

```
src/
├── app/
│   ├── api/                  # API routes (REST endpoints)
│   │   ├── cartridge-address/      # Fetches address from Cartridge API
│   │   ├── members/                # Member CRUD, roles, elite status
│   │   ├── members-with-realm-counts/ # Members with S1 Pass counts
│   │   ├── realms/                 # S1 Pass data
│   │   └── ...
│   ├── members/              # Members management page
│   ├── settling-map/         # Settling Map page
│   ├── season-passes/        # S1 Pass dashboard page
│   └── ... (layouts, globals)
├── components/               # React components
│   ├── Dashboard.tsx         # S1 Pass dashboard
│   ├── MembersPage.tsx       # Member management
│   ├── SettlingMapPage.tsx   # Interactive map
│   └── ... (styles, header, etc.)
├── services/                 # Backend logic (e.g., realms.ts)
├── types/                    # TypeScript types (e.g., resources, Realm)
├── lib/                      # Utilities (e.g., MongoDB connection)
└── ...
```

---

## API Endpoints

- `GET /api/members` — List all members
- `POST /api/members` — Add a member (by address or username)
- `DELETE /api/members` — Remove a member
- `PUT /api/members/roles` — Update member roles
- `PUT /api/members/update-elite` — Update elite status
- `GET /api/members-with-realm-counts` — List members with S1 Pass counts
- `GET /api/realms` — Fetch all S1 Passes (realms)
- `GET /api/cartridge-address` — Fetch Starknet address from Cartridge username
- `POST /api/update-owners` — Triggers an update of S1 Pass owners using a SQL query.
- ...and more (see `src/app/api/` for details)

---

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd eternum-wasd
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:**
   Create a `.env.local` file with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB=EternumWASD # (optional, defaults to this)
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   
   # Season Passes SQL query and contract address
   SEASON_PASSES_SQL=https://api.cartridge.gg/x/seasonpass-mainnet-2/torii/sql
   SEASON_PASSES_CONTRACT_ADDRESS=0x60e8836acbebb535dfcd237ff01f20be503aae407b67bb6e3b5869afae97156
   ```
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. **Open** [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

- `npm run dev` — Start the development server (Turbopack)
- `npm run build` — Build for production
- `npm run start` — Start the production server
- `npm run lint` — Run ESLint

---

## Development

- **Linting:** ESLint
- **Type Safety:** TypeScript
- **Styling:** TailwindCSS
- **Database:** MongoDB
- **Authentication:** NextAuth (Discord)

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License. See [LICENSE](LICENSE) for details.

Copyright (c) 2025 - WASD