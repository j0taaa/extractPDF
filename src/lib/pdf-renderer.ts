import type { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";

export type RenderedPdfPage = {
  pageNumber: number;
  data: Buffer;
  mimeType: string;
  width: number;
  height: number;
};

export type RenderPdfOptions = {
  maxPages?: number;
  scale?: number;
};

const DEFAULT_PDF_RENDER_SCALE = Math.max(
  1,
  Number.parseFloat(process.env.OPENROUTER_PDF_RENDER_SCALE ?? "2") || 2
);

type CanvasModule = typeof import("@napi-rs/canvas");

let pdfModule: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
let canvasModule: Promise<CanvasModule> | null = null;

async function getCanvasModule(): Promise<CanvasModule> {
  if (!canvasModule) {
    canvasModule = import("@napi-rs/canvas") as Promise<CanvasModule>;
  }
  return canvasModule;
}

function resolveDomMatrix(candidate: unknown): typeof globalThis.DOMMatrix | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const domMatrix = (candidate as { DOMMatrix?: unknown }).DOMMatrix;
  return typeof domMatrix === "function" ? (domMatrix as typeof globalThis.DOMMatrix) : null;
}

async function ensureDomMatrix(): Promise<void> {
  if (typeof globalThis.DOMMatrix !== "undefined") {
    return;
  }

  const canvasLib = await getCanvasModule();
  const domMatrixCtor =
    resolveDomMatrix(canvasLib) ||
    resolveDomMatrix((canvasLib as { default?: unknown }).default ?? null);

  if (domMatrixCtor) {
    (globalThis as Record<string, unknown>).DOMMatrix = domMatrixCtor;
    return;
  }

  throw new Error("Failed to locate a DOMMatrix implementation from @napi-rs/canvas");
}

async function getPdfModule() {
  if (!pdfModule) {
    pdfModule = (async () => {
      await ensureDomMatrix();
      return import("pdfjs-dist/legacy/build/pdf.mjs");
    })();
  }
  return pdfModule;
}

export async function renderPdfToImages(
  buffer: Buffer,
  options: RenderPdfOptions = {}
): Promise<{ pages: RenderedPdfPage[]; totalPages: number }> {
  const [pdfjsLib, canvasLib] = await Promise.all([getPdfModule(), getCanvasModule()]);
  const { createCanvas } = canvasLib;

  const initOptions: DocumentInitParameters & { disableWorker?: boolean } = {
    data: buffer,
    useSystemFonts: true,
    disableWorker: true
  };

  const loadingTask = pdfjsLib.getDocument(initOptions);

  const document = await loadingTask.promise;

  try {
    const totalPages = document.numPages;
    const limit = options.maxPages ? Math.min(options.maxPages, totalPages) : totalPages;
    const scale = Math.max(1, options.scale ?? DEFAULT_PDF_RENDER_SCALE);

    const pages: RenderedPdfPage[] = [];

    for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);

      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      const renderTask = page.render({
        // The rendering context provided by @napi-rs/canvas is compatible with
        // the CanvasRenderingContext2D expected by pdf.js at runtime, even
        // though the type definitions don't align perfectly.
        canvasContext: context as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport
      });

      await renderTask.promise;

      const imageBuffer = canvas.toBuffer("image/png");

      pages.push({
        pageNumber,
        data: imageBuffer,
        mimeType: "image/png",
        width,
        height
      });

      page.cleanup();
    }

    return { pages, totalPages };
  } finally {
    await loadingTask.destroy();
  }
}
