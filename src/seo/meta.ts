import { WindowType } from '../types';

/** Open Graph / Twitter image (full WoodenMax logo). */
export const OG_IMAGE_URL = 'https://window.woodenmax.in/logo.jpg';

const DEFAULT_DESCRIPTION =
  'WoodenMax Window Designer — free PWA for aluminium & uPVC sliding & casement windows, glass partitions, louvers, ventilators, corner glazing & mirrors. Sizes, PDF quotations & BOM for uPVC window projects. Works online & offline at window.woodenmax.in.';

export const DEFAULT_PAGE_DESCRIPTION = DEFAULT_DESCRIPTION;

const DESIGN_DESCRIPTIONS: Partial<Record<WindowType, string>> = {
  [WindowType.SLIDING]:
    'Design 2-track & 3-track aluminium or uPVC sliding windows and doors online. Configure shutters, mesh, glass & hardware; quotations & BOM — WoodenMax Window Designer.',
  [WindowType.CASEMENT]:
    'Design aluminium or uPVC casement windows, French doors & grids with hardware. Free casement designer with quotation PDF — WoodenMax.',
  [WindowType.VENTILATOR]:
    'Bathroom ventilator & exhaust window designer (aluminium/uPVC): louvers, glass grids, fan cutouts. Quotation & BOM — WoodenMax.',
  [WindowType.GLASS_PARTITION]:
    'Glass partition & shower enclosure designer: fixed, sliding & openable panels. Cost estimate & PDF quote — WoodenMax.',
  [WindowType.LOUVERS]:
    'Louver designer for façades & ducts (aluminium/uPVC-style layouts). Blade spacing, profiles & quotation export — WoodenMax.',
  [WindowType.CORNER]:
    'L-type corner window designer: sliding & casement sides for aluminium or uPVC. Quotation PDF — WoodenMax.',
  [WindowType.MIRROR]:
    'Custom mirror designer: round, oval, capsule & framed shapes. Instant pricing & quotation — WoodenMax Window Designer.',
};

const GUIDE_DESCRIPTIONS: Record<string, string> = {
  index: `${DEFAULT_DESCRIPTION} Read the full guide to features, audiences & export options.`,
  sliding:
    'Step-by-step guide: sliding window tracks (aluminium & uPVC), shutters, glass & textures. WoodenMax — free sliding window design & quotation tool.',
  casement:
    'Guide to casement grids & uPVC/aluminium casement layouts, hardware & quotations — WoodenMax Designer.',
  ventilator:
    'Ventilator window guide: grid panels, louvers, exhaust fans & glass options in WoodenMax Designer.',
  glass_partition:
    'Glass & shower partition guide: framed, frameless & sliding options with quotations — WoodenMax.',
  louvers:
    'Louver design guide: elevation, ventilation & blade spacing — WoodenMax Window Designer.',
  corner:
    'Corner window guide: L-type layouts, sliding & casement combinations — WoodenMax.',
  mirror:
    'Mirror design guide: shapes, frames & pricing — WoodenMax Window Designer.',
  georgian_bars:
    'Georgian bar grids on glass: luxury window & partition finish — WoodenMax guide.',
  qna: 'WoodenMax Window Designer FAQ: BOM export, profiles, data storage & who the tool is for.',
};

export function getMetaDescription(args: {
  appView: 'designer' | 'guides';
  windowType: WindowType;
  guideSlug: string;
}): string {
  if (args.appView === 'guides') {
    return GUIDE_DESCRIPTIONS[args.guideSlug] ?? GUIDE_DESCRIPTIONS.index;
  }
  return DESIGN_DESCRIPTIONS[args.windowType] ?? DEFAULT_DESCRIPTION;
}

function ensureMetaName(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function ensureMetaProperty(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Updates description, Open Graph & Twitter cards for SPA route changes. */
export function applyRouteSeo(args: {
  title: string;
  description: string;
  canonicalUrl: string;
}) {
  ensureMetaName('description', args.description);
  ensureMetaProperty('og:title', args.title);
  ensureMetaProperty('og:description', args.description);
  ensureMetaProperty('og:url', args.canonicalUrl);
  ensureMetaProperty('og:type', 'website');
  ensureMetaProperty('og:image', OG_IMAGE_URL);
  ensureMetaProperty('og:image:alt', 'WoodenMax — window and door design');
  ensureMetaProperty('og:locale', 'en_IN');
  ensureMetaProperty('og:site_name', 'WoodenMax Window Designer');
  ensureMetaName('twitter:card', 'summary_large_image');
  ensureMetaName('twitter:title', args.title);
  ensureMetaName('twitter:description', args.description);
  ensureMetaName('twitter:image', OG_IMAGE_URL);
}
