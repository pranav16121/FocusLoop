import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ingestFile, MAX_FILE_BYTES } from '../src/engine/ingest.js';

const fixture = name => path.join(process.cwd(), 'tests', 'fixtures', name);

function fileFromBuffer(name, buffer, type = '') {
  return {
    name,
    type,
    size: buffer.byteLength,
    async arrayBuffer() { return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); },
    async text() { return buffer.toString('utf8'); },
  };
}

async function load(name, type = '') {
  const buffer = await fs.readFile(fixture(name));
  return fileFromBuffer(name, buffer, type);
}

test('ingests selectable text PDF content', async () => {
  const text = await ingestFile(await load('text.pdf', 'application/pdf'));
  assert.match(text, /Engineering Signals/);
  assert.match(text, /Fourier transform/);
});

test('reports scanned PDFs without selectable text', async () => {
  const scanned = await load('scanned.pdf', 'application/pdf');
  await assert.rejects(() => ingestFile(scanned), /no selectable text/i);
});

test('reports empty, corrupt, and oversized files clearly', async () => {
  const empty = await load('empty.txt', 'text/plain');
  const corrupt = await load('corrupt.pdf', 'application/pdf');
  await assert.rejects(() => ingestFile(empty), /empty/i);
  await assert.rejects(() => ingestFile(corrupt), /could not be read/i);
  const oversized = await load('oversized.txt', 'text/plain');
  assert.equal(oversized.size > MAX_FILE_BYTES, true);
  await assert.rejects(() => ingestFile(oversized), /larger than 5 MB/i);
});

test('ingests DOCX headings and all three PPTX slides', async () => {
  if (!globalThis.DOMParser) {
    const { DOMParser } = await import('linkedom');
    globalThis.DOMParser = DOMParser;
  }
  const docx = await ingestFile(await load('headings.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
  assert.match(docx, /Unit One Signals/);
  const pptx = await ingestFile(await load('three-slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'));
  assert.match(pptx, /Slide 1/);
  assert.match(pptx, /Slide 2/);
  assert.match(pptx, /Slide 3/);
});
