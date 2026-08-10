/**
 * Real file-content validation for uploads — never trust the client-supplied
 * `file.type` (just an attacker-controlled multipart header) or filename
 * extension. Detects the actual type from magic bytes via `file-type`.
 */
import { fileTypeFromBuffer } from "file-type";

export class UploadValidationError extends Error {}

export interface ValidatedUpload {
  buffer: Buffer;
  mime: string;
  ext: string;
}

/** Browser-displayable raster images only. SVG is excluded by design — it's
 *  XML and can embed <script>/onload, i.e. it's a script-injection vector,
 *  not "just an image". GIF is excluded too (animated-avatar support is a
 *  separate decision, not assumed here). */
export const IMAGE_ALLOWLIST: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Same image set, plus PDF — for document-style uploads (certificates, ID
 *  scans, scorecards) that legitimately need to accept either. Still real
 *  magic-byte detection, still excludes SVG/GIF/HTML/etc. */
export const IMAGE_OR_PDF_ALLOWLIST: Record<string, string> = {
  ...IMAGE_ALLOWLIST,
  "application/pdf": "pdf",
};

/**
 * Read a File's bytes, re-check size against the actual buffer (not the
 * multipart Content-Length header), detect its real type via magic bytes,
 * and reject anything not in `allowlist`. Returns the raw bytes plus the
 * canonical extension for the *detected* type — callers must use this
 * extension when persisting, never the original filename's extension.
 */
export async function readAndValidateUpload(
  file: File,
  maxBytes: number,
  allowlist: Record<string, string> = IMAGE_ALLOWLIST,
): Promise<ValidatedUpload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    throw new UploadValidationError("Uploaded file is empty");
  }
  if (buffer.length > maxBytes) {
    throw new UploadValidationError(`File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit`);
  }

  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime;
  if (!mime || !(mime in allowlist)) {
    throw new UploadValidationError("Unsupported or unrecognized file type");
  }

  return { buffer, mime, ext: allowlist[mime] };
}
