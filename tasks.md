# Tasks

A running list of the major capabilities planned for extractPDF.

Focus first on the OpenRouter integration items below—these unblock every other downstream workflow.

## LLM Processing with OpenRouter
- [x] Setup OpenRouter API with Gemini 2.5 Flash. The API key will be provided in .env
- [x] Build a server-side OpenRouter client that composes prompts from instruction sets and dispatches document/page jobs.
- [x] Queue and orchestrate LLM calls so large documents process asynchronously with retries, backoff, and concurrency controls.
- [x] Persist raw LLM responses, extracted insights, and token/cost telemetry for each processing run.
- [x] Wire the processing pipeline into OCR and extraction outputs so every uploaded document can be sent to OpenRouter automatically.
- [x] Provide UI affordances to trigger processing, monitor job status, and review LLM results per document and page.
- [x] Implement guardrails for usage limits, error reporting, and developer-visible logs around OpenRouter requests.
- [x] Keep track of usage of LLM tokens to analyze documents and display in user's page

## Instruction Sets
- [x] Provide an instruction set that performs OCR on all text within each file.
- [x] Provide an instruction set that returns complete textual and visual page breakdowns.
- [x] Provide an instruction set that extracts filled form fields as structured JSON.
- [x] Provide an instruction set that detects signatures on uploaded pages.
- [x] Allow custom, user-defined prompts for bespoke analyses.

## Processing Flow
- [x] Support executing prompts on a per-page basis and aggregating results into JSON arrays.
- [x] Support secondary aggregation passes that combine page-level insights via an additional LLM call.

## User Interface
- [x] Let project creators choose the file type (PDF or image) and applicable instruction set.
- [x] Adapt the project UI to reflect the selected task, including field configuration for extraction workflows.

## Ingestion and Storage
- [x] Enable direct uploads of files into a project.
- [x] Enable optional API-based ingestion that can be toggled per project.
- [x] Revisit file storage so uploads can be stored outside the application server if needed.
- [x] Allow project owners to delete uploaded files and remove the binaries from storage.
- [x] Provide download links or previews so users can review uploaded files without leaving the app.
- [x] Validate uploaded file types against each project's configured type and surface friendly errors.
