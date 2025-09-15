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

## Platform Overview

extractPDF is evolving into a single workspace for running large batches of PDF and image analyses with the help of LLMs. Each project represents a collection of files plus the automation rules that dictate how those files are interpreted. Users pick the file type (PDF or image) when creating a project and then select the instruction set that best matches their goal.

## Available Instruction Sets

Projects can be configured with one of several predefined instruction bundles, with support for custom prompts when a bespoke workflow is required:

- **OCR all text** – capture every piece of text on each page.
- **Full page breakdown** – return all textual and visual information that appears on a page.
- **Extract filled fields** – produce structured JSON with the values discovered in predefined form fields.
- **Signature detection** – flag whether a page appears to contain a signature.
- **Custom prompt** – let the user define their own LLM instructions.

The execution strategy can vary per task. Some flows will run a prompt per page and aggregate the raw responses into a JSON array, while others may trigger a follow-up LLM call to combine page-level insights into a single structured payload.

## Adaptive Project Interfaces

The user interface changes based on the chosen instruction set. For example, projects that extract filled fields expose configuration inputs for each field name and type so downstream JSON objects are well defined. Other project types can reveal views suited to visual inspection, OCR review, or signature confirmation.

## File Intake and API Access

Every project can accept files uploaded directly in the application and, when enabled through the project configuration, through an API endpoint. Files are currently persisted on the server, though alternative storage backends may be introduced later.
