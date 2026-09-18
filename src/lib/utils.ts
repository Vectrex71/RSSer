
export const getRootDomain = (urlStr: string) => {
  try {
    const hostname = new URL(urlStr).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const secondToLast = parts[parts.length - 2];
      const tlds = ['com', 'co', 'org', 'net', 'edu', 'gov', 'ac', 'de', 'ch', 'at'];
      if (tlds.includes(secondToLast)) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return null;
  }
};

export const getCanonicalOrigin = () => {
  if (typeof window === 'undefined') return 'https://rsser.news';
  const origin = window.location.origin;
  // During development or preview, we want links to be relative to the current origin
  // so that internal navigation works within the platform.
  if (origin.includes('run.app') || origin.includes('localhost')) {
    return origin;
  }
  return origin;
};

export const isInternalBlogLink = (link: string) => {
    if (!link) return false;
    try {
        const url = new URL(link, window.location.origin);
        
        // Hostname check
        const isInternalHost = url.hostname === window.location.hostname || 
                            url.hostname.includes('rsser.news') || 
                            url.hostname.includes('run.app') || 
                            url.hostname.includes('localhost') ||
                            url.hostname === '127.0.0.1';
        
        if (!isInternalHost) return false;

        const path = url.pathname;
        
        // List of routes that should be handled internally
        const internalRoutes = [
            '/blogs',
            '/blog/',
            '/article/',
            '/p/',
            '/user/',
            '/u/',
            '/author/',
            '/discover',
            '/rss',
            '/radio',
            '/youtube',
            '/webcam'
        ];
        
        return internalRoutes.some(route => path.includes(route));
    } catch {
        // Relative link check
        if (link.startsWith('/')) {
            const path = link.split('?')[0].split('#')[0];
            const internalRoutes = [
                '/blogs',
                '/blog/',
                '/article/',
                '/p/',
                '/user/',
                '/discover',
                '/rss',
                '/radio',
                '/youtube',
                '/webcam'
            ];
            return internalRoutes.some(route => path.includes(route));
        }
        return false;
    }
};

export const getInternalBlogPath = (link: string) => {
    if (!link) return '/';
    try {
        const url = new URL(link, window.location.origin);
        return url.pathname + url.search + url.hash;
    } catch {
        return link;
    }
};

export const normalizeLinks = (html: string) => {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  const links = div.querySelectorAll('a');
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;

    const hasProtocol = /^(https?:\/\/|mailto:|tel:)/i.test(href);
    const isRelative = href.startsWith('/') || href.startsWith('#');

    // If it's an absolute-looking link without protocol (e.g., www.example.com or example.com)
    if (!hasProtocol && !isRelative) {
      if (href.startsWith('www.') || (href.includes('.') && !href.startsWith('.'))) {
        a.setAttribute('href', 'https://' + href);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        return;
      }
    }

    // For all links, if it's external, ensure target="_blank"
    if (href.startsWith('http')) {
      try {
        const url = new URL(href, window.location.origin);
        const isInternal = url.hostname === window.location.hostname || 
                          url.hostname.includes('rsser.news') || 
                          url.hostname.includes('run.app') || 
                          url.hostname.includes('localhost') ||
                          url.hostname === '127.0.0.1';
        if (!isInternal) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      } catch (e) {
        // ignore
      }
    }
  });
  return div.innerHTML;
};

/**
 * Intercepts clicks on links within dangerouslySetInnerHTML or other rendered HTML.
 * If the link is internal, it uses the provided navigate function.
 */
export const handleInternalLinkClick = (e: React.MouseEvent, navigate: (path: string) => void) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (anchor) {
        const rawHref = anchor.getAttribute('href');
        
        // If it looks like a domain but lacks a protocol (e.g., rsser.news or www.rsser.news)
        // it shouldn't be treated as a relative path by the browser.
        const looksLikeDomain = rawHref && !rawHref.startsWith('/') && !rawHref.startsWith('#') && !rawHref.includes('://') && rawHref.includes('.');
        
        if (looksLikeDomain) {
            e.preventDefault();
            e.stopPropagation();
            window.open('https://' + rawHref, '_blank', 'noopener,noreferrer');
            return;
        }

        if (anchor.href && isInternalBlogLink(anchor.href)) {
            e.preventDefault();
            e.stopPropagation();
            navigate(getInternalBlogPath(anchor.href));
        }
    }
};
