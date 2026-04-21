import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Saves a base64 encoded image to the uploads directory.
 * @param base64Data The base64 encoded image string (data:image/jpeg;base64,...)
 * @param prefix A prefix for the filename (e.g., 'photo')
 * @returns The relative path to the saved file (e.g., '/uploads/photo-123.jpg') or null if invalid
 */
export async function saveBase64Image(
  base64Data: string | null | undefined,
  prefix: string = "photo",
): Promise<string | null> {
  if (!base64Data) {
    return null;
  }

  // If it's already a saved file path, return it as is
  if (base64Data.startsWith("/uploads/")) {
    return base64Data;
  }

  if (!base64Data.startsWith("data:image")) {
    return null;
  }

  try {
    // Extract format and actual base64 content
    const match = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!match) return null;

    const extension = match[1];
    const data = match[2];
    const buffer = Buffer.from(data, "base64");

    // Ensure uploads directory exists
    const uploadsDir = path.resolve(__dirname, "..", "..", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    return `/uploads/${filename}`;
  } catch (error) {
    console.error("[saveBase64Image] Error saving image:", error);
    return null;
  }
}

/**
 * Deletes a file previously saved under /uploads.
 * Accepts a relative URL path such as /uploads/file-name.jpg.
 */
export function deleteUploadedFileByRelativePath(
  relativePath: string | null | undefined,
): void {
  if (!relativePath || !relativePath.startsWith("/uploads/")) {
    return;
  }

  const uploadsDir = path.resolve(__dirname, "..", "..", "uploads");
  const normalizedUploadsDir = path.normalize(`${uploadsDir}${path.sep}`);
  const normalizedRelative = relativePath.replace(/^[/\\]+/, "");
  const absolutePath = path.resolve(__dirname, "..", "..", normalizedRelative);
  const normalizedAbsolutePath = path.normalize(absolutePath);

  if (!normalizedAbsolutePath.startsWith(normalizedUploadsDir)) {
    return;
  }

  try {
    fs.unlinkSync(normalizedAbsolutePath);
  } catch {
    // ignore missing files or unlink errors for cleanup calls
  }
}
