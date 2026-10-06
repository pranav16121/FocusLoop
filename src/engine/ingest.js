const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);
const MAX_SOURCE_LENGTH = 100000;

function extensionOf(file) {
  return file.name?.toLowerCase().split('.').pop() || '';
}

function trimSource(text) {
  return String(text || '').slice(0, MAX_SOURCE_LENGTH).trim();
}

async function readTextFile(file) {
  return trimSource(await file.text());
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
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(pdfPageText(content.items));
  }
  return trimSource(pages.join('\n\n'));
}

async function readDocxFile(file) {
  const mammoth = await import('mammoth/mammoth.browser');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return trimSource(result.value);
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
  return trimSource(slides.join('\n\n'));
}

export async function ingestFile(file) {
  if (!file || typeof file.name !== 'string') throw new Error('A file is required.');
  const extension = extensionOf(file);
  if (TEXT_TYPES.has(file.type) || extension === 'txt' || extension === 'md' || extension === 'markdown') {
    return readTextFile(file);
  }
  if (extension === 'pdf' || file.type === 'application/pdf') return readPdfFile(file);
  if (extension === 'docx' || file.type.includes('wordprocessingml')) return readDocxFile(file);
  if (extension === 'pptx' || file.type.includes('presentationml')) return readPptxFile(file);
  throw new Error('Unsupported file type. Use TXT, Markdown, PDF, DOCX, or PPTX.');
}

export async function ingestSource(source) {
  if (typeof source === 'string') return trimSource(source);
  return ingestFile(source);
}

export { MAX_SOURCE_LENGTH };
