import { FEED_CATEGORIES } from '../lib/constants';

interface ParsedFeed {
  title: string;
  url: string;
  category: string;
}

export function exportToOPML(feeds: any[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<opml version="2.0">\n';
  xml += '  <head>\n';
  xml += '    <title>RSSer Feeds Export</title>\n';
  xml += '  </head>\n';
  xml += '  <body>\n';
  
  // Group by category to make it nicer? Or just flat. 
  // Let's do flat for simplicity for now.
  feeds.forEach(feed => {
    xml += `    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" category="${escapeXml(feed.category || 'Allgemein')}" />\n`;
  });
  
  xml += '  </body>\n';
  xml += '</opml>';
  return xml;
}

export async function importFromOPML(xmlString: string): Promise<ParsedFeed[]> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const outlines = xmlDoc.getElementsByTagName("outline");
  const feeds: ParsedFeed[] = [];

  for (let i = 0; i < outlines.length; i++) {
    const outline = outlines[i];
    const xmlUrl = outline.getAttribute("xmlUrl");
    const title = outline.getAttribute("title") || outline.getAttribute("text") || "Unbekannter Feed";
    const category = outline.getAttribute("category") || "Allgemein";

    if (xmlUrl) {
      // Validate category, map to Allgemein if invalid
      const validCategory = FEED_CATEGORIES.includes(category) ? category : "Allgemein";
      feeds.push({ title, url: xmlUrl, category: validCategory });
    }
  }
  return feeds;
}

function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
            default: return c;
        }
    });
}
