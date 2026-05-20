import {
  SEO_CONTENT_MODIFIED,
  SEO_PUBLISHER_ID,
  SEO_PUBLISHER_NAME,
  SEO_PUBLISHER_URL,
  SEO_WEBSITE_ID,
  SITE_ORIGIN,
} from './siteSeo';

export type SeoPageKind = 'design' | 'guide' | 'home';

export function buildRouteJsonLd(args: {
  canonicalUrl: string;
  title: string;
  description: string;
  pageKind: SeoPageKind;
  breadcrumbLabel?: string;
}): string {
  const org = {
    '@type': 'Organization',
    '@id': SEO_PUBLISHER_ID,
    name: SEO_PUBLISHER_NAME,
    url: SEO_PUBLISHER_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo.jpg` },
    email: 'info@woodenmax.com',
    sameAs: [SITE_ORIGIN, SEO_PUBLISHER_URL],
  };

  const webPage: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${args.canonicalUrl}#webpage`,
    url: args.canonicalUrl,
    name: args.title,
    description: args.description,
    inLanguage: 'en-IN',
    dateModified: SEO_CONTENT_MODIFIED,
    isPartOf: { '@id': SEO_WEBSITE_ID },
    publisher: { '@id': SEO_PUBLISHER_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo.jpg` },
  };

  if (args.pageKind === 'guide') {
    webPage['@type'] = ['WebPage', 'TechArticle'];
    webPage.author = { '@id': SEO_PUBLISHER_ID };
    webPage.about = {
      '@type': 'Thing',
      name: 'Aluminium and uPVC window design, fabrication and quotation',
    };
  } else if (args.pageKind === 'design') {
    webPage.about = {
      '@type': 'SoftwareApplication',
      name: 'WoodenMax Window Designer',
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web browser',
    };
  }

  const crumbs: { name: string; item: string }[] = [
    { name: 'WoodenMax Window Designer', item: `${SITE_ORIGIN}/design/sliding` },
  ];
  if (args.pageKind === 'guide') {
    crumbs.push({ name: 'Guides', item: `${SITE_ORIGIN}/guides/index` });
    if (args.breadcrumbLabel) {
      crumbs.push({ name: args.breadcrumbLabel, item: args.canonicalUrl });
    }
  } else if (args.pageKind === 'design' && args.breadcrumbLabel) {
    crumbs.push({ name: args.breadcrumbLabel, item: args.canonicalUrl });
  }

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };

  const graph: Record<string, unknown>[] = [org, webPage, breadcrumb];

  if (args.pageKind === 'guide') {
    graph.push({
      '@type': 'HowTo',
      name: args.title.replace(/\s*\|\s*Guides.*$/i, '').trim(),
      description: args.description,
      dateModified: SEO_CONTENT_MODIFIED,
      author: { '@id': SEO_PUBLISHER_ID },
      publisher: { '@id': SEO_PUBLISHER_ID },
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
