const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);
const MAX_SOURCE_LENGTH = 100000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function extensionOf(file) {
  return file.name?.toLowerCase().split('.').pop() || '';
}

function trimSource(text) {
  return String(text || '').slice(0, MAX_SOURCE_LENGTH).trim();
}

function assertFileSize(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 5 MB. Try a smaller file or paste the relevant section.');
}

function assertNotEmpty(text) {
  if (!trimSource(text)) throw new Error('This file is empty. Choose a file with readable study material.');
  return trimSource(text);
}

async function readTextFile(file) {
  return assertNotEmpty(await file.text());
}

function pdfPageText(items) {
  const sizes = items.map(item => item.height || item.transform?.[0] || 0).filter(Boolean);
  const largest = Math.max(...sizes, 0);
  const lines = [];
  let currentY = null;
  let currentLine = [];

  const flush = () => {
    if (!currentLine.length) return;
    const text = currentLine.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    if (text) lines.push({ text, size: Math.max(...currentLine.map(item => item.height || item.transform?.[0] || 0)) });
    currentLine = [];
  };

  items.forEach(item => {
    const y = item.transform?.[5] ?? 0;
    if (currentY !== null && Math.abs(y - currentY) > 3) flush();
    currentY = y;
    currentLine.push(item);
  });
  flush();

  return lines.map(line => line.size >= largest * 0.9 && line.text.length <= 120 ? `# ${line.text}` : line.text).join('\n');
}

async function readPdfFile(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(pdfPageText(content.items));
  }
  const text = trimSource(pages.join('\n\n'));
  if (!text) throw new Error('This PDF has no selectable text. It may be scanned or image-only.');
  return text;
}

async function readDocxFile(file) {
  const mammothModule = typeof window === 'undefined'
    ? await import('mammoth')
    : await import('mammoth/mammoth.browser.js');
  const mammoth = mammothModule.default || mammothModule;
  const bytes = await file.arrayBuffer();
  const input = typeof window === 'undefined' ? { buffer: Buffer.from(bytes) } : { arrayBuffer: bytes };
  const result = await mammoth.convertToHtml(input);
  const parser = new DOMParser();
  const document = parser.parseFromString(result.value, 'text/html');
  const nodes = document.body?.children?.length ? [...document.body.children] : [...document.children];
  const lines = nodes.map(node => {
    const text = node.textContent?.trim() || '';
    return /^H[1-6]$/i.test(node.tagName) ? `# ${text}` : text;
  }).filter(Boolean);
  return assertNotEmpty(lines.join('\n\n'));
}

async function readPptxFile(file) {
  const JSZip = (await import('jszip')).default;
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(archive.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const parser = new DOMParser();
  const slides = [];
  for (const name of slideNames) {
    const xml = await archive.files[name].async('text');
    const document = parser.parseFromString(xml, 'application/xml');
    const text = [...document.getElementsByTagName('a:t')].map(node => node.textContent).join(' ').trim();
    if (text) slides.push(text);
  }
  return assertNotEmpty(slides.join('\n\n'));
}

export async function ingestFile(file) {
  if (!file || typeof file.name !== 'string') throw new Error('A file is required.');
  assertFileSize(file);
  const extension = extensionOf(file);
  const type = file.type || '';
  try {
    if (TEXT_TYPES.has(type) || extension === 'txt' || extension === 'md' || extension === 'markdown') return await readTextFile(file);
    if (extension === 'pdf' || type === 'application/pdf') return await readPdfFile(file);
    if (extension === 'docx' || type.includes('wordprocessingml')) return await readDocxFile(file);
    if (extension === 'pptx' || type.includes('presentationml')) return await readPptxFile(file);
    throw new Error('Unsupported file type. Use TXT, Markdown, PDF, DOCX, or PPTX.');
  } catch (error) {
    if (error.message.includes('selectable text') || error.message.includes('empty') || error.message.includes('larger than') || error.message.includes('Unsupported')) throw error;
    throw new Error('This file could not be read. Check that it is not corrupt and try again.');
  }
}

export async function ingestSource(source) {
  if (typeof source === 'string') return trimSource(source);
  return ingestFile(source);
}

export { MAX_FILE_BYTES, MAX_SOURCE_LENGTH };
