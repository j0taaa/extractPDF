# PDF Analyzer

This project provides a simple web interface to analyze PDF files page by page using [Ollama](https://ollama.com/) locally or [OpenRouter](https://openrouter.ai/) remotely.

## Features
- Converts uploaded PDF files into images (one per page)
- Sends each page image to an AI model for analysis
- Aggregates results and displays them in a web UI

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and adjust values.
3. Ensure [Poppler](https://poppler.freedesktop.org/) is installed for `pdftoppm` conversion.
4. Start the server:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` in your browser.

## Environment
- `ENVIRONMENT=local` uses Ollama with the `gemma3n:4b` model.
- `ENVIRONMENT=openrouter` uses the OpenRouter API. Set `OPENROUTER_KEY` and optionally `OPENROUTER_MODEL` in `.env`.
