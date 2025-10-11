import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const copies = [
    ['index.html', 'index.html'],
    ['style.css', 'style.css'],
    ['script.js', 'script.js'],
    ['carGame', 'carGame'],
  ];

  for (const [src, dest] of copies) {
    const from = path.join(root, src);
    const to = path.join(distDir, dest);
    await cp(from, to, { recursive: true, force: true });
  }

  console.log('dist/ ready for packaging:', distDir);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
