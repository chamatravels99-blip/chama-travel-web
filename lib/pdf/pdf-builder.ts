/**
 * Minimal dependency-free PDF writer (standard Type 1 fonts only) so document
 * generation works on Cloudflare Workers/OpenNext without native modules.
 */
export type PdfFont = 'regular' | 'bold' | 'mono';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const FONT_NAMES: Record<PdfFont, string> = { regular: 'F1', bold: 'F2', mono: 'F3' };
const MONO_WIDTH = 0.6;
const AVERAGE_WIDTH = 0.52;

/** Converts text to the printable-ASCII subset used by the standard fonts. */
export function pdfSafeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e]/g, '?');
}

function escapePdfString(value: string) {
  return pdfSafeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function fixed(value: number) {
  return value.toFixed(2);
}

export class PdfBuilder {
  private pages: string[][] = [[]];
  private y = PAGE_HEIGHT - MARGIN;

  get contentWidth() {
    return PAGE_WIDTH - MARGIN * 2;
  }

  get left() {
    return MARGIN;
  }

  get right() {
    return PAGE_WIDTH - MARGIN;
  }

  private current() {
    return this.pages[this.pages.length - 1];
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.pages.push([]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  moveDown(amount: number) {
    this.y -= amount;
  }

  text(value: string, x: number, size = 10, font: PdfFont = 'regular', align: 'left' | 'right' = 'left') {
    const safe = escapePdfString(value);
    let originX = x;
    if (align === 'right') {
      const width = value.length * size * (font === 'mono' ? MONO_WIDTH : AVERAGE_WIDTH);
      originX = x - width;
    }
    this.current().push(
      `BT /${FONT_NAMES[font]} ${fixed(size)} Tf ${fixed(originX)} ${fixed(this.y)} Td (${safe}) Tj ET`
    );
  }

  paragraph(value: string, x: number, maxWidth: number, size = 10, font: PdfFont = 'regular', leading = size + 4) {
    const charWidth = size * (font === 'mono' ? MONO_WIDTH : AVERAGE_WIDTH + 0.03);
    const maxChars = Math.max(8, Math.floor(maxWidth / charWidth));
    const words = pdfSafeText(value).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxChars) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      line = rest;
    }
    if (line || lines.length === 0) lines.push(line);
    for (const item of lines) {
      this.ensureSpace(leading);
      this.text(item, x, size, font);
      this.y -= leading;
    }
    return lines.length;
  }

  rule(gray = 0.75) {
    this.current().push(
      `${fixed(gray)} G 0.6 w ${fixed(this.left)} ${fixed(this.y)} m ${fixed(this.right)} ${fixed(this.y)} l S 0 G`
    );
  }

  build() {
    const encoder = new TextEncoder();
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = add('');
    const pagesId = add('');
    const fontIds = (['Helvetica', 'Helvetica-Bold', 'Courier'] as const).map((name) =>
      add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`)
    );

    const pageIds: number[] = [];
    this.pages.forEach((commands, index) => {
      const footer = `BT /F1 8.00 Tf ${fixed(MARGIN)} 28.00 Td (Page ${index + 1} of ${this.pages.length}) Tj ET`;
      const stream = [...commands, footer].join('\n');
      const contentId = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
      const pageId = add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${fixed(PAGE_WIDTH)} ${fixed(PAGE_HEIGHT)}] ` +
        `/Resources << /Font << /F1 ${fontIds[0]} 0 R /F2 ${fontIds[1]} 0 R /F3 ${fontIds[2]} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] =
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let output = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(encoder.encode(output).length);
      output += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = encoder.encode(output).length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return encoder.encode(output);
  }
}
