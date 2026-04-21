/**
 * After `vite build`, emit one static HTML per public route so the first response
 * includes the correct <link rel="canonical"> (fixes GSC "duplicate / wrong canonical"
 * for SPAs where crawlers only see the root shell).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const ORIGIN = 'https://window.woodenmax.in';

const DESIGN = [
  {
    seg: 'sliding',
    title: 'Sliding Window & Door Designer | 2-Track, 3-Track Systems | WoodenMax',
    description:
      'Design 2-track & 3-track aluminium or uPVC sliding windows and doors online. Configure shutters, mesh, glass & hardware; quotations & BOM — WoodenMax Window Designer.',
  },
  {
    seg: 'casement',
    title: 'Design Casement Windows, Doors & Foldable Systems Online | WoodenMax',
    description:
      'Design aluminium or uPVC casement windows, French doors & grids with hardware. Free casement designer with quotation PDF — WoodenMax.',
  },
  {
    seg: 'ventilator',
    title: 'Bathroom Ventilator Design Tool | Louvers & Exhaust Options | WoodenMax',
    description:
      'Bathroom ventilator & exhaust window designer (aluminium/uPVC): louvers, glass grids, fan cutouts. Quotation & BOM — WoodenMax.',
  },
  {
    seg: 'glass_partition',
    title: 'Create Modern Glass & Shower Partitions | Fixed, Sliding & Openable Designs | WoodenMax',
    description:
      'Glass partition & shower enclosure designer: fixed, sliding & openable panels. Cost estimate & PDF quote — WoodenMax.',
  },
  {
    seg: 'louvers',
    title: 'Premium Louver Design Tool | Elevation, Ventilation & Decorative Louvers | WoodenMax',
    description:
      'Louver designer for façades & ducts (aluminium/uPVC-style layouts). Blade spacing, profiles & quotation export — WoodenMax.',
  },
  {
    seg: 'corner',
    title: 'L-Type Corner Window Designer | Sliding & Casement Options | WoodenMax',
    description:
      'L-type corner window designer: sliding & casement sides for aluminium or uPVC. Quotation PDF — WoodenMax.',
  },
  {
    seg: 'mirror',
    title: 'Online Mirror Design Tool | Round, Square, Capsule & Custom Shapes | WoodenMax',
    description:
      'Custom mirror designer: round, oval, capsule & framed shapes. Instant pricing & quotation — WoodenMax Window Designer.',
  },
];

const GUIDES = [
  {
    slug: 'index',
    title: 'Features & Guides | WoodenMax Window Designer',
    description:
      'WoodenMax Window Designer — free PWA for aluminium & uPVC sliding & casement windows, glass partitions, louvers, ventilators, corner glazing & mirrors. Sizes, PDF quotations & BOM for uPVC window projects. Works online & offline at window.woodenmax.in. Read the full guide to features, audiences & export options.',
  },
  {
    slug: 'sliding',
    title: 'Sliding Windows & Doors | Guides & Help | WoodenMax Window Designer',
    description:
      'Step-by-step guide: sliding window tracks (aluminium & uPVC), shutters, glass & textures. WoodenMax — free sliding window design & quotation tool.',
  },
  {
    slug: 'casement',
    title: 'Casement | Guides & Help | WoodenMax Window Designer',
    description:
      'Guide to casement grids & uPVC/aluminium casement layouts, hardware & quotations — WoodenMax Designer.',
  },
  {
    slug: 'ventilator',
    title: 'Ventilator | Guides & Help | WoodenMax Window Designer',
    description:
      'Ventilator window guide: grid panels, louvers, exhaust fans & glass options in WoodenMax Designer.',
  },
  {
    slug: 'glass_partition',
    title: 'Glass Partition | Guides & Help | WoodenMax Window Designer',
    description:
      'Glass & shower partition guide: framed, frameless & sliding options with quotations — WoodenMax.',
  },
  {
    slug: 'louvers',
    title: 'Louvers | Guides & Help | WoodenMax Window Designer',
    description:
      'Louver design guide: elevation, ventilation & blade spacing — WoodenMax Window Designer.',
  },
  {
    slug: 'corner',
    title: 'Corner | Guides & Help | WoodenMax Window Designer',
    description:
      'Corner window guide: L-type layouts, sliding & casement combinations — WoodenMax.',
  },
  {
    slug: 'mirror',
    title: 'Mirror | Guides & Help | WoodenMax Window Designer',
    description:
      'Mirror design guide: shapes, frames & pricing — WoodenMax Window Designer.',
  },
  {
    slug: 'georgian_bars',
    title: 'Georgian Bars | Guides & Help | WoodenMax Window Designer',
    description:
      'Georgian bar grids on glass: luxury window & partition finish — WoodenMax guide.',
  },
  {
    slug: 'qna',
    title: 'FAQ & Q&A | Guides | WoodenMax Window Designer',
    description:
      'WoodenMax Window Designer FAQ: BOM export, profiles, data storage & who the tool is for.',
  },
];

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function patchHtml(html, { canonicalUrl, title, description }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  let out = html;
  out = out.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonicalUrl}"`);
  out = out.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${canonicalUrl}"`);
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  out = out.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${d}"`);
  out = out.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${t}"`);
  out = out.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${d}"`);
  out = out.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${t}"`);
  out = out.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${d}"`);
  return out;
}

function writeNestedIndex(relDir, html) {
  const dir = path.join(distDir, ...relDir.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function main() {
  const basePath = path.join(distDir, 'index.html');
  if (!fs.existsSync(basePath)) {
    console.error('seo-static-html: dist/index.html not found. Run vite build first.');
    process.exit(1);
  }
  const baseHtml = fs.readFileSync(basePath, 'utf8');

  for (const row of DESIGN) {
    const canonicalUrl = `${ORIGIN}/design/${row.seg}`;
    const html = patchHtml(baseHtml, {
      canonicalUrl,
      title: row.title,
      description: row.description,
    });
    writeNestedIndex(`design/${row.seg}`, html);
  }

  for (const row of GUIDES) {
    const canonicalUrl = `${ORIGIN}/guides/${row.slug}`;
    const html = patchHtml(baseHtml, {
      canonicalUrl,
      title: row.title,
      description: row.description,
    });
    writeNestedIndex(`guides/${row.slug}`, html);
  }

  console.log(
    `seo-static-html: wrote ${DESIGN.length} design/* and ${GUIDES.length} guides/* static index.html files.`
  );
}

main();
