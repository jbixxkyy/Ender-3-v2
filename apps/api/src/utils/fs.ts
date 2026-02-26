import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const dataRoot = path.resolve(process.cwd(), '../../data');
export const uploadsDir = path.join(dataRoot, 'uploads');
export const slicedDir = path.join(dataRoot, 'sliced');

export async function ensureDataDirs() {
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(slicedDir, { recursive: true });
}

export async function writeAndHashFile(filePath: string, content: Buffer | string) {
  const buffer = typeof content === 'string' ? Buffer.from(content) : content;
  await writeFile(filePath, buffer);
  const hash = createHash('sha256').update(buffer).digest('hex');
  return { sizeBytes: buffer.byteLength, sha256: hash };
}

export async function hashFile(filePath: string) {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}
