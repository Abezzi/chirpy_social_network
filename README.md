# Chirpy

A full-featured social media backend built with **TypeScript** and **Express.js** as part of the Boot.dev "HTTP Servers" course.

![Chirpy](https://via.placeholder.com/800x200/4f46e5/ffffff?text=CHIRPY)

## Features

### Authentication & Security
- User registration and login
- JWT Access Tokens (1 hour expiration)
- Refresh Tokens (60 days) with secure revocation
- Password hashing using Argon2
- Protected routes with Bearer token authentication

### Chirps (Posts)
- Create chirps (max 140 characters)
- Get all chirps with optional filtering (`?authorId=...`)
- Sort chirps by creation date (`?sort=asc|desc`)
- Delete your own chirps only

### User Management
- Update email and password
- Protected account updates

### Chirpy Red (Premium)
- Webhook integration with Polka payment provider
- Upgrade users to Chirpy Red membership
- Protected webhook endpoint with API key verification

### Other
- Health check endpoint
- Admin metrics dashboard
- Static file serving
- Comprehensive error handling

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT + Refresh Tokens
- **Password Hashing**: Argon2
- **Environment**: dotenv

## API Endpoints

### Public
- `GET /api/healthz` - Health check
- `POST /api/login` - Login user
- `POST /api/refresh` - Refresh access token
- `POST /api/revoke` - Revoke refresh token
- `GET /api/chirps` - Get chirps (with optional filters)

### Authenticated
- `POST /api/chirps` - Create a new chirp
- `DELETE /api/chirps/:chirpId` - Delete a chirp (own only)
- `PUT /api/users` - Update email and password

### Admin / Webhooks
- `GET /admin/metrics` - View server metrics
- `POST /admin/reset` - Reset metrics
- `POST /api/polka/webhooks` - Polka webhook for Chirpy Red upgrades

## Project Structure

├── src/
│   ├── index.ts          # Main server file
│   ├── auth.ts           # Auth utilities (JWT, tokens, etc.)
│   ├── config.ts         # Configuration & env vars
│   ├── schema.ts         # Database schema (Drizzle)
│   └── handlers/         # Route handlers (recommended structure)
├── .env                  # Environment variables
├── drizzle/              # Migrations
└── package.json

## Getting Started

### Prerequisites
- Node.js
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (.env)

```ts
JWT_SECRET=your_super_long_random_secret
POLKA_KEY=f271c81ff7084ee5b99a5091b42d486e
DATABASE_URL=postgresql://...
```

4. Generate and Migrate

```bash
npm run generate
npm run migrate
```

### Run

```bash
npm run dev
```

Built with ❤️ as part of the Boot.dev curriculum
A social network backend called Chirpy.
