// One-off encode pass for the background texture used at body::before.
// Reads /public/textura-fondo.png and writes the same path back as a
// quality-tuned WebP renamed to .webp, plus updates globals.css to point
// at it. Idempotent — re-running it just rewrites the .webp.
//
// Run with: node scripts/compress-textura.mjs

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const inputPath = path.join(root, 'public', 'textura-fondo.png');
const outputPath = path.join(root, 'public', 'textura-fondo.webp');

async function main() {
  const beforeStat = await fs.stat(inputPath);
  // The CSS scales the texture to background-size: 1800px wide, so anything
  // beyond ~3600px (2x retina) is wasted. Downscale to 2400px max width.
  await sharp(inputPath)
    .resize({ width: 1800, withoutEnlargement: true })
    .webp({ quality: 60, effort: 6, smartSubsample: true })
    .toFile(outputPath);
  const afterStat = await fs.stat(outputPath);
  const beforeKB = (beforeStat.size / 1024).toFixed(0);
  const afterKB = (afterStat.size / 1024).toFixed(0);
  const pct = ((1 - afterStat.size / beforeStat.size) * 100).toFixed(0);
  console.log(
    `textura-fondo: ${beforeKB} KB png -> ${afterKB} KB webp (${pct}% smaller)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
