# Tasks

A running list of the major capabilities planned for extractPDF.

## Instruction Sets
- [x] Provide an instruction set that performs OCR on all text within each file.
- [x] Provide an instruction set that returns complete textual and visual page breakdowns.
- [x] Provide an instruction set that extracts filled form fields as structured JSON.
- [x] Provide an instruction set that detects signatures on uploaded pages.
- [x] Allow custom, user-defined prompts for bespoke analyses.

## Processing Flow
- [ ] Support executing prompts on a per-page basis and aggregating results into JSON arrays.
- [ ] Support secondary aggregation passes that combine page-level insights via an additional LLM call.

## User Interface
- [x] Let project creators choose the file type (PDF or image) and applicable instruction set.
- [x] Adapt the project UI to reflect the selected task, including field configuration for extraction workflows.

## Ingestion and Storage
- [ ] Enable direct uploads of files into a project.
- [ ] Enable optional API-based ingestion that can be toggled per project.
- [ ] Revisit file storage so uploads can be stored outside the application server if needed.
