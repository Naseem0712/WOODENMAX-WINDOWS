/**
 * After `vite build`, emit one static HTML per public route so the first response
 * includes the correct <link rel="canonical"> (fixes GSC "duplicate / wrong canonical"
 * for SPAs where crawlers only see the root shell).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');
const ORIGIN = 'https://window.woodenmax.in';
const PUBLISHER_NAME = 'WoodenMax Architectural Elements';
const PUBLISHER_URL = 'https://www.woodenmax.in';
const PUBLISHER_ID = `${PUBLISHER_URL}/#organization`;
const WEBSITE_ID = `${ORIGIN}/#website`;
const CONTENT_MODIFIED = '2026-05-21';
const ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

const DESIGN = [
  {
    seg: 'sliding',
    title: 'Sliding Window & Door Designer | 2-Track, 3-Track Systems | WoodenMax',
    description:
      'Design 2-track & 3-track aluminium or uPVC sliding windows online — WinOptimiser-style stock logic, window design tools, quotation app PDF & BOM — WoodenMax Window Designer.',
    breadcrumb: 'Sliding Window & Door Designer',
  },
  {
    seg: 'casement',
    title: 'Design Casement Windows, Doors & Foldable Systems Online | WoodenMax',
    description:
      'Design aluminium or uPVC casement windows, French doors & grids with hardware. Free casement designer with quotation PDF — WoodenMax.',
    breadcrumb: 'Casement Windows & Doors',
  },
  {
    seg: 'ventilator',
    title: 'Bathroom Ventilator Design Tool | Louvers & Exhaust Options | WoodenMax',
    description:
      'Bathroom ventilator & exhaust window designer (aluminium/uPVC): louvers, glass grids, fan cutouts. Quotation & BOM — WoodenMax.',
    breadcrumb: 'Bathroom Ventilator Designer',
  },
  {
    seg: 'glass_partition',
    title: 'Create Modern Glass & Shower Partitions | Fixed, Sliding & Openable Designs | WoodenMax',
    description:
      'Glass partition & shower enclosure designer: fixed, sliding & openable panels. Cost estimate & PDF quote — WoodenMax.',
    breadcrumb: 'Glass & Shower Partitions',
  },
  {
    seg: 'louvers',
    title: 'Premium Louver Design Tool | Elevation, Ventilation & Decorative Louvers | WoodenMax',
    description:
      'Louver designer for façades & ducts (aluminium/uPVC-style layouts). Blade spacing, profiles & quotation export — WoodenMax.',
    breadcrumb: 'Louver Designer',
  },
  {
    seg: 'corner',
    title: 'L-Type Corner Window Designer | Sliding & Casement Options | WoodenMax',
    description:
      'L-type corner window designer: sliding & casement sides for aluminium or uPVC. Quotation PDF — WoodenMax.',
    breadcrumb: 'L-Type Corner Windows',
  },
  {
    seg: 'mirror',
    title: 'Online Mirror Design Tool | Round, Square, Capsule & Custom Shapes | WoodenMax',
    description:
      'Custom mirror designer: round, oval, capsule & framed shapes. Instant pricing & quotation — WoodenMax Window Designer.',
    breadcrumb: 'Mirror Designer',
  },
  {
    seg: 'railing',
    title: 'Glass & SS Railing Designer | Staircase Balcony Layouts — Same quotation as windows | WoodenMax',
    description:
      'Glass railing CAD-style designer: staircase, balcony, straight and custom perimeter; hardware & glass BOM; each line merges into WoodenMax unified quotation PDF with windows.',
    breadcrumb: 'Glass railing designer',
  },
];

const GUIDES = [
  {
    slug: 'index',
    title: 'Features & Guides | Aluminium & uPVC Window Design Help | WoodenMax',
    description:
      'Expert guides for WoodenMax Window Designer (WinOptimiser): aluminium & uPVC sliding & casement windows, glass partitions, louvers, ventilators, corner glazing & mirrors — PDF quotations, BOM & offline PWA at window.woodenmax.in.',
    breadcrumb: 'Features & Guides',
  },
  {
    slug: 'sliding',
    title: 'Sliding Windows & Doors Guide | Tracks, Glass & Quotations | WoodenMax',
    description:
      'Fabricator guide: 2-track & 3-track aluminium and uPVC sliding windows — shutters, mesh, glass types and PDF quotations with WoodenMax Window Designer.',
    breadcrumb: 'Sliding Windows & Doors',
  },
  {
    slug: 'casement',
    title: 'Casement Windows Guide | Grids, Hardware & uPVC Layouts | WoodenMax',
    description:
      'How to design aluminium or uPVC casement windows and French doors: grids, hardware, rates and quotation export — WoodenMax Designer.',
    breadcrumb: 'Casement Windows & Doors',
  },
  {
    slug: 'ventilator',
    title: 'Bathroom Ventilator Guide | Louvers, Exhaust & Glass | WoodenMax',
    description:
      'Ventilator window guide for bathrooms and ducts: louvers, exhaust fans, glass grids and quotation workflow — WoodenMax.',
    breadcrumb: 'Bathroom Ventilators',
  },
  {
    slug: 'glass_partition',
    title: 'Glass Partition Guide | Shower & Bathroom Glazing | WoodenMax',
    description:
      'Glass and shower partition guide: framed, frameless and sliding panels with sizes, rates and PDF quotes — WoodenMax.',
    breadcrumb: 'Glass & Shower Partitions',
  },
  {
    slug: 'louvers',
    title: 'Louver Design Guide | Façade & Ventilation | WoodenMax',
    description:
      'Elevation and ventilation louver guide: blade spacing, profiles and quotation export for aluminium-style layouts — WoodenMax.',
    breadcrumb: 'Louvers',
  },
  {
    slug: 'corner',
    title: 'Corner Window Guide | L-Type Sliding & Casement | WoodenMax',
    description:
      'L-type corner window guide: combining sliding and casement sides for aluminium or uPVC corner glazing — WoodenMax.',
    breadcrumb: 'Corner Windows',
  },
  {
    slug: 'mirror',
    title: 'Mirror Design Guide | Shapes, Frames & Pricing | WoodenMax',
    description:
      'Mirror design guide: round, oval, capsule and framed mirrors with instant pricing and quotation — WoodenMax Window Designer.',
    breadcrumb: 'Mirrors',
  },
  {
    slug: 'georgian_bars',
    title: 'Georgian Bars Guide | Decorative Glazing Grids | WoodenMax',
    description:
      'Georgian bar grids on glass for premium window and partition finishes — design guide from WoodenMax Window Designer.',
    breadcrumb: 'Georgian Bars',
  },
  {
    slug: 'embed_api',
    title: 'Embed & API Links Guide | Campaign URLs & iframe | WoodenMax',
    description:
      'Embed WoodenMax Window Designer on your site: direct design links, query parameters and iframe examples for sliding, casement and other modules.',
    breadcrumb: 'Embed & API Links',
  },
  {
    slug: 'qna',
    title: 'FAQ | Window Designer, BOM & Profiles | WoodenMax',
    description:
      'Frequently asked questions: BOM export, custom profiles, browser storage, offline PWA and who WoodenMax Window Designer is built for.',
    breadcrumb: 'FAQ & Q&A',
  },
];

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function buildRouteJsonLd({ canonicalUrl, title, description, pageKind, breadcrumbLabel }) {
  const org = {
    '@type': 'Organization',
    '@id': PUBLISHER_ID,
    name: PUBLISHER_NAME,
    url: PUBLISHER_URL,
    logo: { '@type': 'ImageObject', url: `${ORIGIN}/logo.jpg` },
    email: 'info@woodenmax.com',
    sameAs: [ORIGIN, PUBLISHER_URL],
  };

  const webPage = {
    '@type': pageKind === 'guide' ? ['WebPage', 'TechArticle'] : 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: 'en-IN',
    dateModified: CONTENT_MODIFIED,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': PUBLISHER_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: `${ORIGIN}/logo.jpg` },
  };
  if (pageKind === 'guide') {
    webPage.author = { '@id': PUBLISHER_ID };
    webPage.about = {
      '@type': 'Thing',
      name: 'Aluminium and uPVC window design, fabrication and quotation',
    };
  } else if (pageKind === 'design') {
    webPage.about = {
      '@type': 'SoftwareApplication',
      name: 'WoodenMax Window Designer',
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web browser',
    };
  }

  const crumbs = [{ name: 'WoodenMax Window Designer', item: `${ORIGIN}/design/sliding` }];
  if (pageKind === 'guide') {
    crumbs.push({ name: 'Guides', item: `${ORIGIN}/guides/index` });
    if (breadcrumbLabel) crumbs.push({ name: breadcrumbLabel, item: canonicalUrl });
  } else if (breadcrumbLabel) {
    crumbs.push({ name: breadcrumbLabel, item: canonicalUrl });
  }

  const graph = [
    org,
    webPage,
    {
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: c.item,
      })),
    },
  ];

  if (pageKind === 'guide') {
    graph.push({
      '@type': 'HowTo',
      name: breadcrumbLabel || title,
      description,
      dateModified: CONTENT_MODIFIED,
      author: { '@id': PUBLISHER_ID },
      publisher: { '@id': PUBLISHER_ID },
      inLanguage: 'en-IN',
      step: [
        {
          '@type': 'HowToStep',
          name: 'Open the matching designer',
          text: 'Use the link in this guide to open the WoodenMax designer for that window type.',
        },
        {
          '@type': 'HowToStep',
          name: 'Configure size and options',
          text: 'Enter width and height, tracks, glass, hardware and finishes as described in the guide.',
        },
        {
          '@type': 'HowToStep',
          name: 'Save to quotation',
          text: 'Add the configured unit to your quotation list with quantity and rate.',
        },
        {
          '@type': 'HowToStep',
          name: 'Export PDF or BOM',
          text: 'Open View Quotation to export a client PDF or material summary for fabrication.',
        },
      ],
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

function upsertRouteJsonLd(html, jsonLd) {
  const block = `<script type="application/ld+json" id="seo-route-jsonld">${jsonLd}</script>`;
  if (html.includes('id="seo-route-jsonld"')) {
    return html.replace(
      /<script type="application\/ld\+json" id="seo-route-jsonld">[\s\S]*?<\/script>/,
      block
    );
  }
  return html.replace('</head>', `    ${block}\n  </head>`);
}

function patchHtml(html, { canonicalUrl, title, description, pageKind, breadcrumbLabel }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  let out = html;
  out = out.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonicalUrl}"`);
  out = out.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${canonicalUrl}"`);
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  out = out.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${d}"`);
  out = out.replace(/<meta name="robots" content="[^"]*"/, `<meta name="robots" content="${ROBOTS}"`);
  out = out.replace(/<meta name="author" content="[^"]*"/, `<meta name="author" content="${escapeAttr(PUBLISHER_NAME)}"`);
  if (!out.includes('name="publisher"')) {
    out = out.replace(
      /<meta name="author"[^>]*>/,
      `$&\n    <meta name="publisher" content="${escapeAttr(PUBLISHER_NAME)}" />`
    );
  } else {
    out = out.replace(
      /<meta name="publisher" content="[^"]*"/,
      `<meta name="publisher" content="${escapeAttr(PUBLISHER_NAME)}"`
    );
  }
  if (pageKind === 'guide') {
    if (!out.includes('property="article:publisher"')) {
      out = out.replace(
        /<meta property="og:locale"[^>]*>/,
        `$&\n    <meta property="article:publisher" content="${PUBLISHER_URL}" />\n    <meta name="article:modified_time" content="${CONTENT_MODIFIED}" />`
      );
    } else {
      out = out.replace(
        /<meta name="article:modified_time" content="[^"]*"/,
        `<meta name="article:modified_time" content="${CONTENT_MODIFIED}"`
      );
    }
  }
  out = out.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${t}"`);
  out = out.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${d}"`);
  out = out.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${t}"`);
  out = out.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${d}"`);
  const jsonLd = buildRouteJsonLd({ canonicalUrl, title, description, pageKind, breadcrumbLabel });
  out = upsertRouteJsonLd(out, jsonLd);
  return out;
}

function writeNestedIndex(relDir, html) {
  const dir = path.join(distDir, ...relDir.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function writeSitemap() {
  const urls = [
    { loc: `${ORIGIN}/design/sliding`, priority: '1.0', changefreq: 'weekly' },
    ...DESIGN.map((row) => ({
      loc: `${ORIGIN}/design/${row.seg}`,
      priority: row.seg === 'sliding' ? '1.0' : '0.9',
      changefreq: 'monthly',
    })),
    ...GUIDES.map((row) => ({
      loc: `${ORIGIN}/guides/${row.slug}`,
      priority: row.slug === 'index' ? '0.8' : '0.65',
      changefreq: 'weekly',
    })),
  ];
  const seen = new Set();
  const unique = urls.filter((u) => {
    if (seen.has(u.loc)) return false;
    seen.add(u.loc);
    return true;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${CONTENT_MODIFIED}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  for (const dir of [distDir, publicDir]) {
    fs.writeFileSync(path.join(dir, 'sitemap.xml'), xml, 'utf8');
  }
}

function writeIndexingUrls() {
  const lines = [
    '# window.woodenmax.in — copy into Google Search Console → URL Inspection → Request indexing',
    '# Primary homepage canonical: /design/sliding (root / redirects 301)',
    '',
    ...[
      ...DESIGN.map((r) => `${ORIGIN}/design/${r.seg}`),
      ...GUIDES.map((r) => `${ORIGIN}/guides/${r.slug}`),
      `${ORIGIN}/llms.txt`,
      `${ORIGIN}/sitemap.xml`,
      `${ORIGIN}/robots.txt`,
    ].map((url) => url),
    '',
  ];
  fs.writeFileSync(path.join(publicDir, 'indexing-urls.txt'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(distDir, 'indexing-urls.txt'), lines.join('\n'), 'utf8');
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
      pageKind: 'design',
      breadcrumbLabel: row.breadcrumb,
    });
    writeNestedIndex(`design/${row.seg}`, html);
  }

  for (const row of GUIDES) {
    const canonicalUrl = `${ORIGIN}/guides/${row.slug}`;
    const html = patchHtml(baseHtml, {
      canonicalUrl,
      title: row.title,
      description: row.description,
      pageKind: 'guide',
      breadcrumbLabel: row.breadcrumb,
    });
    writeNestedIndex(`guides/${row.slug}`, html);
  }

  writeSitemap();
  writeIndexingUrls();

  console.log(
    `seo-static-html: wrote ${DESIGN.length} design/*, ${GUIDES.length} guides/* static HTML, sitemap.xml, indexing-urls.txt.`
  );
}

main();
