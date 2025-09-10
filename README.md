# extractPDF

A Next.js application that will power a PDF analysis platform. The project currently includes user authentication using [Better Auth](https://github.com/better-auth/better-auth) and persists data in PostgreSQL.

## Getting Started

1. Copy `.env.example` to `.env` and adjust the values.
2. Start a PostgreSQL database (e.g. `docker compose up db`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run database migrations:
   ```bash
   npm run migrate
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Visit [http://localhost:3000](http://localhost:3000) to access the site.

## Docker

A `Dockerfile` and `docker-compose.yml` are provided. To run the app and database in containers:

```bash
docker compose up --build
```

The web application will be available at `http://localhost:3000` and PostgreSQL will listen on port `5432`.
