// EPUB e-book export (for self-publishing or reading on an e-reader), built
// with a tiny zip writer so no extra library is needed.
import type { Project } from '../types';

const enc = new TextEncoder();

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Stored (uncompressed) zip, which is valid for EPUB and keeps "mimetype" first as required. */
function zip(files: { name: string; data: string }[]): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.data);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/epub+zip' });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const para = (t: string) => esc(t).replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

export function buildEpub(p: Project): Blob {
  const id = `urn:uuid:${p.id}`;
  const chapters = p.chapters.filter((c) => c.text.trim());
  const xhtml = (title: string, body: string) =>
    `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${esc(title)}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`;
  const files = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'OEBPS/style.css', data: 'body{font-family:serif;line-height:1.5;margin:0 5%}h1{text-align:center;margin:3em 0 .3em;font-weight:normal}h2{text-align:center;font-weight:normal;font-style:italic;margin-bottom:2em}p{text-indent:1.4em;margin:0}p.first{text-indent:0}p.sep{text-align:center;text-indent:0;margin:1em 0}.title{text-align:center;margin-top:30%}' },
    { name: 'OEBPS/title.xhtml', data: xhtml(p.title, `<div class="title"><h1>${esc(p.title)}</h1>${p.author ? `<p class="sep">${esc(p.author)}</p>` : ''}</div>`) },
    ...chapters.map((c, i) => ({
      name: `OEBPS/ch${i + 1}.xhtml`,
      data: xhtml(
        c.title,
        `<h1>Chapter ${i + 1}</h1>${c.title ? `<h2>${esc(c.title)}</h2>` : ''}${c.text
          .split(/\n\s*\n|\n/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t, k) => (/^(\*|#|\*\s?\*\s?\*)$/.test(t) ? '<p class="sep">*</p>' : `<p${k === 0 ? ' class="first"' : ''}>${para(t)}</p>`))
          .join('')}`,
      ),
    })),
    {
      name: 'OEBPS/nav.xhtml',
      data: xhtml('Contents', `<nav epub:type="toc"><h1>Contents</h1><ol>${chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">Chapter ${i + 1}${c.title ? `: ${esc(c.title)}` : ''}</a></li>`).join('')}</ol></nav>`),
    },
    {
      name: 'OEBPS/content.opf',
      data: `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${id}</dc:identifier><dc:title>${esc(p.title)}</dc:title><dc:creator>${esc(p.author || 'Author')}</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>${chapters.map((_, i) => `<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine><itemref idref="title"/>${chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('')}</spine></package>`,
    },
  ];
  return zip(files);
}
