import { join } from 'node:path';

const DATA_ROOT = join(process.cwd(), 'data');

export function dataPath(...parts: string[]): string {
  return join(DATA_ROOT, ...parts);
}
