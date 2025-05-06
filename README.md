# Eternum WASD

A Next.js-based web application for managing and tracking members and realms. This project uses modern web technologies and follows best practices for a scalable and maintainable codebase.

## Tech Stack

- **Framework**: Next.js 15.3.1
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: MongoDB
- **Development**: Turbopack for faster development experience

## Project Structure

```
src/
├── app/              # Next.js app directory (routing and layouts)
├── components/       # React components
│   ├── Dashboard.tsx
│   ├── Header.tsx
│   └── MembersPage.tsx
├── services/         # Backend services and API integrations
│   └── realms.ts
├── types/           # TypeScript type definitions
└── lib/             # Utility functions and shared code
```

## Features

- Member management system
- Dashboard with data visualization
- Realm tracking and management
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

This project is private and proprietary.
