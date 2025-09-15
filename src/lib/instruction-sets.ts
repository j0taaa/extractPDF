export type FileType = "pdf" | "image";

export const FILE_TYPES: { id: FileType; label: string; description: string }[] = [
  {
    id: "pdf",
    label: "PDF document",
    description: "Best for traditional PDF exports with selectable text and complex layouts."
  },
  {
    id: "image",
    label: "Image (JPEG/PNG)",
    description: "Optimized for scanned documents or photos that require OCR to capture content."
  }
];

export function isFileType(value: unknown): value is FileType {
  return typeof value === "string" && FILE_TYPES.some((type) => type.id === value);
}

export type InstructionSetId =
  | "ocr_all_text"
  | "page_breakdown"
  | "form_field_extraction"
  | "signature_detection";

type InstructionField = {
  name: string;
  description: string;
};

type InstructionSet = {
  id: InstructionSetId;
  name: string;
  summary: string;
  steps: string[];
  outputs: string[];
  fields: InstructionField[];
};

export const DEFAULT_INSTRUCTION_SET_ID: InstructionSetId = "ocr_all_text";

export const INSTRUCTION_SETS: InstructionSet[] = [
  {
    id: "ocr_all_text",
    name: "Full-document OCR",
    summary: "Extract searchable text from every page in reading order, preserving paragraphs where possible.",
    steps: [
      "Process each page with high-accuracy OCR tuned for dense documents.",
      "Normalize whitespace while retaining headings and paragraph boundaries.",
      "Return the full plain-text output grouped by page number."
    ],
    outputs: [
      "Page-level plain text suitable for downstream search or embeddings.",
      "Metadata indicating OCR confidence scores for each page."
    ],
    fields: [
      { name: "page", description: "The page index (1-based)." },
      { name: "text", description: "Full OCR text extracted from the page." },
      { name: "confidence", description: "Overall OCR confidence expressed as a decimal between 0 and 1." }
    ]
  },
  {
    id: "page_breakdown",
    name: "Page structure breakdown",
    summary: "Return a detailed inventory of textual blocks, tables, and visual regions for each page.",
    steps: [
      "Segment each page into logical regions (heading, paragraph, table, figure).",
      "Capture the bounding boxes for every detected region.",
      "Summarize the important textual content and describe relevant visual elements."
    ],
    outputs: [
      "A structured JSON array of all detected regions per page.",
      "Bounding box coordinates and human-readable descriptions for figures or charts."
    ],
    fields: [
      { name: "page", description: "The page index (1-based)." },
      { name: "regionType", description: "The classification for the region (heading, paragraph, table, figure)." },
      { name: "bounds", description: "Bounding box coordinates in PDF points: [x, y, width, height]." },
      { name: "content", description: "Primary text or a description of the detected region." }
    ]
  },
  {
    id: "form_field_extraction",
    name: "Filled form extraction",
    summary: "Detect filled form fields and return their values as normalized JSON objects.",
    steps: [
      "Locate form inputs, checkboxes, and signature lines on each page.",
      "Determine the captured value or selection state for every field.",
      "Normalize the values using consistent keys for easy downstream ingestion."
    ],
    outputs: [
      "Structured JSON keyed by form field names with detected values.",
      "A per-field confidence score and location metadata."
    ],
    fields: [
      { name: "fieldName", description: "Identifier inferred from nearby labels or PDF form metadata." },
      { name: "value", description: "Detected input value, checkbox state, or signature presence." },
      { name: "page", description: "The page number where the field appears." },
      { name: "confidence", description: "Confidence score between 0 and 1." }
    ]
  },
  {
    id: "signature_detection",
    name: "Signature detection",
    summary: "Flag and describe signatures or initials placed on uploaded pages.",
    steps: [
      "Scan each page for handwritten regions and signature blocks.",
      "Differentiate between typed names and genuine handwriting strokes.",
      "Return cropped location details to support downstream verification workflows."
    ],
    outputs: [
      "A list of detected signature regions with bounding boxes.",
      "Confidence scores and a label describing whether the mark is a signature or set of initials."
    ],
    fields: [
      { name: "page", description: "The page number containing the signature." },
      { name: "bounds", description: "Bounding box coordinates in PDF points: [x, y, width, height]." },
      { name: "type", description: "Whether the detection appears to be a full signature or initials." },
      { name: "confidence", description: "Confidence score between 0 and 1." }
    ]
  }
];

const instructionSetById = new Map(INSTRUCTION_SETS.map((set) => [set.id, set]));

export function isInstructionSetId(value: unknown): value is InstructionSetId {
  return typeof value === "string" && instructionSetById.has(value as InstructionSetId);
}

export function getInstructionSet(id: string | null | undefined) {
  if (!id) return null;
  return instructionSetById.get(id as InstructionSetId) ?? null;
}
