import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";

export function getStorageRoot(): string {
  const configured = process.env.FILE_STORAGE_ROOT;
  if (configured && configured.trim()) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "uploads");
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/\\/g, "/");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "upload";
}

export async function persistProjectFile(
  projectId: string,
  file: File,
  preferredName?: string
): Promise<{ relativePath: string; absolutePath: string }> {
  const root = getStorageRoot();
  const projectDir = path.join(root, projectId);
  await mkdir(projectDir, { recursive: true });

  const safeName = sanitizeFileName(preferredName ?? file.name ?? "upload");
  const uniquePrefix = randomBytes(8).toString("hex");
  const storedFileName = `${Date.now()}_${uniquePrefix}_${safeName}`;
  const absolutePath = path.join(projectDir, storedFileName);
  const relativePath = path.relative(root, absolutePath);

  const arrayBuffer = await file.arrayBuffer();
  await writeFile(absolutePath, Buffer.from(arrayBuffer));

  return { relativePath, absolutePath };
}

function resolveStoredFilePath(relativePath: string): string | null {
  const root = getStorageRoot();
  const normalizedRoot = path.resolve(root);
  const absolutePath = path.resolve(root, relativePath);
  const relative = path.relative(normalizedRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return absolutePath;
}

export async function readStoredFile(relativePath: string): Promise<Buffer | null> {
  const absolutePath = resolveStoredFilePath(relativePath);
  if (!absolutePath) {
    return null;
  }

  try {
    return await readFile(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function removeStoredFile(relativePath: string): Promise<void> {
  const absolutePath = resolveStoredFilePath(relativePath);
  if (!absolutePath) {
    return;
  }

  try {
    await unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return;
    }
    throw error;
  }
}
