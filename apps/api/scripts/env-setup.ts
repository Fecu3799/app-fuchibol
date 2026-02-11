#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const pairs = [
  ['.env.example', '.env'],
  ['.env.test.example', '.env.test'],
];

for (const [source, target] of pairs) {
  const srcPath = path.join(root, source);
  const destPath = path.join(root, target);

  if (!fs.existsSync(srcPath)) {
    console.log(`skip: ${source} not found`);
    continue;
  }

  if (fs.existsSync(destPath)) {
    console.log(`skip: ${target} already exists`);
    continue;
  }

  fs.copyFileSync(srcPath, destPath);
  console.log(`created: ${target} (from ${source})`);
}
