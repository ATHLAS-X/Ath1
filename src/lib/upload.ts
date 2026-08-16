/**
 * Minimal local-disk upload helper. No upload pattern existed anywhere on
 * this branch before (confirmed via repo-wide search) — this is a small,
 * self-contained one for the trial-registration document/footage fields,
 * not a general-purpose service. Files are written to `public/uploads/`
 * (served statically by Next.js) and validated by magic bytes, not the
 * client-supplied MIME string, so a renamed file can't bypass the allowlist.
 */
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads', 'trial-docs')

const MAGIC_BYTES: { prefix: Buffer; ext: string }[] = [
  { prefix: Buffer.from([0xff, 0xd8, 0xff]), ext: 'jpg' },            // JPEG
  { prefix: Buffer.from([0x89, 0x50, 0x4e, 0x47]), ext: 'png' },      // PNG
  { prefix: Buffer.from('%PDF'), ext: 'pdf' },                        // PDF
]

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

export class UploadValidationError extends Error {}

/** Accepts a data: URI (the browser's native FileReader output), validates
 *  it against a real magic-byte allowlist, and writes it to disk. Returns
 *  the public URL path to store on the record. */
export async function saveTrialUpload(dataUri: string): Promise<string> {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUri)
  if (!match) throw new UploadValidationError('Expected a base64 data URI')

  const buf = Buffer.from(match[2], 'base64')
  if (buf.length === 0) throw new UploadValidationError('Empty file')
  if (buf.length > MAX_BYTES) throw new UploadValidationError('File exceeds 8MB limit')

  const detected = MAGIC_BYTES.find(m => buf.subarray(0, m.prefix.length).equals(m.prefix))
  if (!detected) throw new UploadValidationError('Only JPEG, PNG, or PDF files are accepted')

  await mkdir(UPLOAD_ROOT, { recursive: true })
  const filename = `${crypto.randomUUID()}.${detected.ext}`
  await writeFile(path.join(UPLOAD_ROOT, filename), buf)

  return `/uploads/trial-docs/${filename}`
}
