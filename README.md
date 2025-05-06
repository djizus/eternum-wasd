# Eternum WASD - S1 Pass Manager

An Next.js-based web application for managing WASD guild members and tracking S1 Season Passes. This project uses modern web technologies and follows best practices for a scalable and maintainable codebase.

## Tech Stack

- **Framework**: Next.js 15.3.1
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: MongoDB
- **Development**: Turbopack for faster development experience

## Project Structure

```
src/
├── app/
│   ├── api/              # API Routes
│   │   ├── cartridge-address/ # Fetches address from Cartridge API
│   │   │   └── route.ts
│   │   ├── members/          # Member CRUD operations
│   │   │   └── route.ts
│   │   ├── members-with-realm-counts/ # Fetches members with pass counts
│   │   │   └── route.ts
│   │   ├── owners/           # (Existing - purpose may need review)
│   │   ├── realms/           # Serves pass data from DB
│   │   │   └── route.ts
│   │   └── update-owners/    # (Existing - purpose may need review)
│   ├── members/          # Members page route
│   └── ... (other page routes, layout, globals)
├── components/       # React components
│   ├── Dashboard.css
│   ├── Dashboard.tsx     # Main S1 Pass dashboard component
│   ├── Header.css
│   ├── Header.tsx
│   ├── MembersPage.css
│   └── MembersPage.tsx   # Member management component
├── services/         # Backend services and integrations
│   └── realms.ts       # Helper functions for processing pass data
├── types/           # TypeScript type definitions
└── lib/             # Utility functions (e.g., MongoDB connection)
```

## Features

- Member management system (Add/Remove/List)
  - Fetch Starknet address from Cartridge username
  - Display count of S1 Passes owned per member (sorted by count desc)
- S1 Season Pass Dashboard
  - View list of S1 Passes with details (Resources, Troops)
  - Filter by Name/ID, Resource, Troop Type, Owner
  - Owner filter shows guild members (by username) first
  - Option to filter for passes owned by guild members only
  - Export filtered list to Excel
- Modern, responsive UI with TailwindCSS
- Type-safe development with TypeScript

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Available Scripts

- `npm run dev` - Start the development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code quality checks

## Development

The project uses:
- ESLint for code linting
- TypeScript for type safety
- TailwindCSS for styling
- MongoDB for data persistence

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

Copyright (c) 2025 - WASD

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
