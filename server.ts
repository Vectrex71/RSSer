import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import dns from "dns";

// Ensure IPv4 is resolved first to bypass dual-stack DNS issues (fetch failed / timeout in container)
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Disable TLS verification to bypass SSL/TLS certificate errors on older feed servers
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Global error handlers to prevent unhandled rejection crashes or assertion leakage
process.on('unhandledRejection', (reason: any) => {
  if (reason && !String(reason?.message || reason).includes('PERMISSION_DENIED')) {
    console.warn('[Server Handled] unhandledRejection:', reason?.message || reason);
  }
});
process.on('uncaughtException', (err: any) => {
  console.warn('[Server Handled] uncaughtException:', err?.message || err);
});

import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { initializeApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { initializeApp as initializeClientApp, getApps as getClientApps } from "firebase/app";
import { initializeFirestore as initializeClientFirestore, doc, getDoc, collection, query, where, getDocs, limit, orderBy, setDoc, deleteDoc, writeBatch, updateDoc } from "firebase/firestore";
import { decode as decodeHTML } from 'entities';
import https from "https";
import http from "http";
import compression from "compression";
import { DEFAULT_SOURCES } from "./src/lib/defaultSourcesData";

dotenv.config();

// Determine the root directory. In bundled CJS, __dirname is available.
// In ESM (dev), we use process.cwd().
const rootDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

console.log(`[Gemini] API Key status: ${process.env.GEMINI_API_KEY ? 'Present (ending in ' + process.env.GEMINI_API_KEY.slice(-4) + ')' : 'Missing'}`);
console.log(`[YouTube] API Key status: ${(process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY) ? 'Present' : 'Missing'}`);

// Initialize Firebase Admin (Lazy)
let db_admin_instance: any = null;

// Firebase Web Client SDK is strictly for browsers and produces AssertionError in Node.js
function getDbClient() {
  return null;
}

function getDbAdmin() {
  if (db_admin_instance) return db_admin_instance;
  
  try {
    const rootPath = process.cwd();
    const configPath = path.join(rootPath, "firebase-applet-config.json");
    let projectId: string | undefined;
    let dbId: string | undefined;
    
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        projectId = config.projectId;
        dbId = config.firestoreDatabaseId;
      } catch (e) {}
    }
    
    // Check environment fallbacks
    projectId = projectId || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0728647424";
    dbId = dbId || process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || "rsser-final";

    if (projectId) {
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
      process.env.GCLOUD_PROJECT = projectId;
    }

    const apps = getAdminApps();
    let app = apps.find(a => a.name === 'admin-sdk');
    
    if (!app) {
      try {
        app = initializeApp(projectId ? { projectId } : {}, 'admin-sdk');
        console.log(`[Firebase Admin] Initialized named app "admin-sdk" with project: ${projectId || '(default)'}`);
      } catch (initErr) {
        app = apps.find(a => a.name === '[DEFAULT]') || initializeApp(projectId ? { projectId } : {});
        console.log(`[Firebase Admin] Linked to existing/default app with project: ${app.options.projectId || '(default)'}`);
      }
    }
    
    const targetDbId = (dbId && dbId !== "(default)") ? dbId : undefined;
    
    try {
      db_admin_instance = getFirestore(app, targetDbId);
      console.log(`[Firebase Admin] Firestore instance created for database: ${targetDbId || '(default)'}`);
    } catch (err: any) {
      console.warn(`[Firebase Admin] Firestore init with dbId "${targetDbId}" failed: ${err.message}. Defaulting to (default).`);
      db_admin_instance = getFirestore(app);
    }
    
    return db_admin_instance;
  } catch (e: any) {
    console.error("[Firebase Admin] CRITICAL initialization failed:", e.message);
    return null;
  }
}

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['media:group', 'mediaGroup'],
      ['content:encoded', 'contentEncoded'],
      ['image', 'image'],
      ['yt:videoId', 'videoId'],
      ['npr:thumbnail', 'nprThumbnail'],
      ['npr:image', 'nprImage']
    ]
  }
});

const rssCache = new Map<string, { data: any, timestamp: number }>();
const ogImageCache = new Map<string, string>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

interface SystemAlert {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}
let systemAlerts: SystemAlert[] = [];

function addSystemAlert(type: string, message: string) {
  systemAlerts.unshift({
    id: Math.random().toString(36).substring(7),
    type,
    message,
    timestamp: new Date().toISOString()
  });
  if (systemAlerts.length > 50) {
    systemAlerts = systemAlerts.slice(0, 50);
  }
}

function optimizeRssImageUrl(urlStr: string | undefined, link: string | undefined): string | undefined {
  if (!urlStr) return undefined;
  let upgraded = urlStr;
  
  const siteLink = link ? String(link).toLowerCase() : '';
  const isBlick = siteLink.includes('blick.ch') || urlStr.toLowerCase().includes('blick.ch');
  const is20min = siteLink.includes('20min.ch') || urlStr.toLowerCase().includes('20min.ch');
  const isDeskmodder = siteLink.includes('deskmodder.de') || urlStr.toLowerCase().includes('deskmodder.de');
  
  if (isBlick) {
    // Blick specific image optimization engine
    // Blick's responsive images have 'imwidth=240' etc. Let's upgrade them to high-resolution!
    // Try to replace any imwidth to 1200 or append if it's missing but we know it's a dynamic image URL
    if (upgraded.includes('imwidth=')) {
      upgraded = upgraded.replace(/([\?&])imwidth=\d+/gi, '$1imwidth=1200');
    }
    if (upgraded.includes('width=')) {
      upgraded = upgraded.replace(/([\?&])width=\d+/gi, '$1width=1200');
    }
    // Remove smaller constraints or crop geometry if it is obviously limiting sizing
    if (!upgraded.includes('imwidth=') && !upgraded.includes('width=')) {
      upgraded += (upgraded.includes('?') ? '&' : '?') + 'imwidth=1200';
    }
  } else if (is20min) {
    // 20min uses scale_type, width and height in query params
    if (upgraded.includes('width=')) {
      upgraded = upgraded.replace(/([\?&])width=\d+/gi, '$1width=1200');
    }
    if (upgraded.includes('height=')) {
      upgraded = upgraded.replace(/([\?&])height=\d+/gi, '$1height=750');
    }
  } else if (isDeskmodder || upgraded.includes('deskmodder.de') || upgraded.includes('wp-content/uploads')) {
    // Deskmodder & WordPress responsive image upscaler:
    // Convert thumbnails like banner-300x169.jpg or bild-150x150.png to full resolution (strip dimension suffix)
    const wpThumbMatch = upgraded.match(/^(.+)-\d+x\d+(\.[a-zA-Z0-9]+(?:\?.*)?)$/i);
    if (wpThumbMatch) {
      upgraded = wpThumbMatch[1] + wpThumbMatch[2];
    }
    if (upgraded.includes('?resize=') || upgraded.includes('&resize=')) {
      upgraded = upgraded.replace(/([\?&])resize=\d+,\d+/gi, '');
    }
    if (upgraded.includes('?w=') || upgraded.includes('&w=')) {
      upgraded = upgraded.replace(/([\?&])w=\d+/gi, '$1w=1200');
    }
  }
  
  return upgraded;
}

function checkIsPodcastFeed(feed: any, item?: any): boolean {
  if (!feed) return false;
  
  if (feed.isPodcast === true || feed.category === 'podcasts' || feed.type === 'podcasts') {
    return true;
  }
  
  const url = (feed.url || feed.feedUrl || '').toLowerCase();
  if (
    url.includes('podcast') || 
    url.includes('radio') || 
    url.includes('audio') || 
    url.includes('/m4a/') || 
    url.includes('/m4a') || 
    url.includes('.mp3') || 
    url.includes('bitsundso') || 
    url.includes('bits-und-so')
  ) {
    return true;
  }
  
  const title = (feed.title || '').toLowerCase();
  if (title.includes('podcast') || title.includes('radio') || title.includes('audio') || title.includes('bits und so')) {
    return true;
  }
  
  if (item && item.enclosure) {
    const encArray = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
    for (const enc of encArray) {
      if (enc) {
        const encData = enc.$ || enc;
        const encUrl = (encData.url || encData['@_url'] || encData.href || encData.src || '').toLowerCase();
        const encType = (encData.type || '').toLowerCase();
        if (
          encType.startsWith('audio/') || 
          encUrl.endsWith('.m4a') || 
          encUrl.endsWith('.mp3') || 
          encUrl.endsWith('.aac') || 
          encUrl.endsWith('.ogg') ||
          encUrl.includes('/m4a/') ||
          encUrl.includes('/mp3/')
        ) {
          return true;
        }
      }
    }
  }
  
  return false;
}

function getBitsUndSoCover(): string {
  const localOptions = [
    'bitsundso.jpg',
    'bitsundso.png',
    'bits_und_so.jpg',
    'bits_und_so.png',
    'bits-und-so.jpg',
    'bits-und-so.png',
    'Cover.jpg',
    'cover.jpg',
    'Cover.png',
    'cover.png'
  ];
  for (const opt of localOptions) {
    if (existsSync(path.join(process.cwd(), 'public', opt))) {
      return `/${opt}`;
    }
  }
  return "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/bf/16/da/bf16da2d-abfa-ee92-a16f-cb9629b35b67/mza_18047970425501861730.png/600x600bb.jpg";
}

function proxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (typeof url !== 'string') return url;
  if (
    url.startsWith('/') || 
    url.startsWith('data:') || 
    url.startsWith('blob:') || 
    url.includes('/api/image-proxy') ||
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('googleusercontent.com')
  ) {
    return url;
  }
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function extractImageLocally(item: any): string | undefined {
  let url: string | undefined;

  // Helper to safely get string from potentially complex fields
  const getSafeString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val._) return val._;
    if (val.$t) return val.$t;
    return String(val);
  };

  const isAcceptableImage = (imgUrl: string | undefined, imgType?: string): boolean => {
    if (!imgUrl) return false;
    const str = String(imgUrl).toLowerCase();
    
    // Check if the URL path ends with an audio or video/document extension and reject it
    const pathNoQuery = str.split('?')[0];
    if (pathNoQuery.match(/\.(mp3|m4a|mp4|aac|ogg|wav|mkv|webm|flac|opus|m4v|mov|pdf|html|htm|xml|txt|bin)$/i)) {
      return false;
    }

    if (
      str.includes('favicon') || 
      str.includes('1x1') || 
      str.includes('tracking-pixel') || 
      str.includes('/track.') || 
      str.includes('ad-tracker') || 
      str.includes('doubleclick') || 
      str.includes('statcounter') || 
      str.includes('gravatar.com/avatar') || 
      str.includes('epaper') || 
      str.includes('e-paper') || 
      str.includes('teaser-abo') || 
      str.includes('teaser_abo') || 
      str.includes('abo-teaser') || 
      str.includes('abo_teaser') || 
      str.includes('subscription') || 
      str.includes('ad-banner') || 
      str.includes('banner-ad') || 
      str.includes('cookie-banner') || 
      str.includes('werbebanner') || 
      str.includes('smilies/') || 
      str.includes('emoji/') || 
      str.match(/\/(?:spacer|transparent|dot|blank|pixel)\.?(?:gif|png|jpg|svg)?$/i)
    ) {
      return false;
    }
    if (imgType && String(imgType).toLowerCase().startsWith('image/')) {
      return true;
    }
    if (str.match(/\.(jpeg|jpg|gif|png|webp|svg|heic|avif|bmp)(?:\?.*)?$/i)) {
      return true;
    }
    // Deep check to trust raw values if they belong to known media/cdn hosts or paths
    if (
      str.includes('blick.ch') || 
      str.includes('20min.ch') || 
      str.includes('deskmodder.de') || 
      str.includes('deskmodder') || 
      str.includes('nzz.ch') || 
      str.includes('heise.de') || 
      str.includes('t3n.de') || 
      str.includes('techcrunch.com') || 
      str.includes('nbcsports.com') || 
      str.includes('stadt-bremerhaven.de') || 
      str.includes('watson.ch') || 
      str.includes('npr.org') || 
      str.includes('srf.ch') || 
      str.includes('scale/geometry') || 
      str.includes('wp-content/uploads') || 
      str.includes('media') || 
      str.includes('images') || 
      str.includes('photo')
    ) {
      if (str.startsWith('http') && !str.endsWith('.html') && !str.endsWith('.xml') && !str.endsWith('.feed')) {
        return true;
      }
    }
    return false;
  };

  // Option 0: YouTube specific - IMPROVED
  const idStr = getSafeString((item as any).id);
  const ytId = item.videoId || idStr.match(/yt:video:([a-zA-Z0-9_-]{11})/)?.[1];
  
  if (ytId) {
    url = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }

  const link = getSafeString(item.link);
  if (!url && link && (link.includes('youtube.com') || link.includes('youtu.be'))) {
    const videoIdMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (videoIdMatch && videoIdMatch[1]) {
      url = `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
    }
  }

  // Option 1: Enclosure
  if (item.enclosure) {
    const encArray = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
    const encImage = encArray.find((e: any) => {
      const eData = e.$ || e;
      const eUrl = eData.url || eData['@_url'] || eData.href || eData.src;
      const type = eData.type || '';
      return isAcceptableImage(eUrl, type);
    });
    if (encImage) {
      const eData = encImage.$ || encImage;
      url = eData.url || eData['@_url'] || eData.href || eData.src;
    }
  }
  
  // Option 2: media:content (standard and common variants)
  const mediaContent = item.mediaContent || item['media:content'] || item['media-content'];
  if (!url && mediaContent) {
    const contentArray = Array.isArray(mediaContent) ? mediaContent : [mediaContent];
    const media = contentArray.find((m: any) => {
      const mData = m.$ || m; // Some parsers put attrs in $, others don't
      if (!mData) return false;
      const mUrl = mData.url || mData['@_url'] || mData.href || mData.src;
      return isAcceptableImage(mUrl, mData.type);
    });
    if (media) {
      const mData = media.$ || media;
      url = mData.url || mData['@_url'] || mData.href || mData.src;
    } else if (contentArray[0]) {
      const first = contentArray[0].$ || contentArray[0];
      const firstUrl = first.url || first['@_url'] || first.href || first.src;
      if (isAcceptableImage(firstUrl)) {
        url = firstUrl;
      }
    }
  }

  // Option 3: media:thumbnail
  const mediaThumbnail = item.mediaThumbnail || item['media:thumbnail'] || item['thumbnail'];
  if (!url && mediaThumbnail) {
    const thumbArray = Array.isArray(mediaThumbnail) ? mediaThumbnail : [mediaThumbnail];
    const bestThumb = thumbArray.find((t: any) => {
      const tData = t.$ || t;
      const tUrl = tData.url || tData['@_url'] || tData.href || tData.src;
      return isAcceptableImage(tUrl);
    });
    if (bestThumb) {
      const tData = bestThumb.$ || bestThumb;
      url = tData.url || tData['@_url'] || tData.href || tData.src;
    }
  }

  // Option 4: itunes:image
  if (!url && item.itunes && (item.itunes as any).image) {
    url = (item.itunes as any).image;
  }
  if (!url && item['itunes:image']) {
    const itImg = item['itunes:image'];
    url = itImg.href || itImg.$?.href || (typeof itImg === 'string' ? itImg : undefined);
  }

  // Option 5: "image" property (sometimes top-level or parsed differently)
  if (!url && item.image && typeof item.image === 'string') url = item.image;
  if (!url && item.image && item.image.url) url = item.image.url;
  
  // Custom Domain-Specific Extraction (Aggressive)
  if (!url && link) {
    // NPR.org
    if (link.includes('npr.org')) {
      const nprThumb = item.nprThumbnail || item.nprImage || item['npr:thumbnail'] || item['thumbnail'] || item['npr:image'] || item.mediaThumbnail;
      if (nprThumb) {
        const nt = (Array.isArray(nprThumb) ? nprThumb[0] : nprThumb);
        const ntData = nt.$ || nt;
        const ntUrl = ntData.url || ntData.src || (typeof ntData === 'string' ? ntData : '');
        if (ntUrl && ntUrl.length > 10) url = ntUrl;
      }
    }
  }

  // Custom extra tags
  if (!url && item['og:image']) url = item['og:image'];
  if (!url && item['twitter:image']) url = item['twitter:image'];

  // Option 4.5: media:group (used by YouTube and others)
  if (!url && item.mediaGroup) {
    const mg = item.mediaGroup;
    const contents = mg['media:content'] || mg.mediaContent;
    const thumbnails = mg['media:thumbnail'] || mg.mediaThumbnail;
    
    const mediaList = Array.isArray(contents) ? contents : (contents ? [contents] : []);
    const thumbList = Array.isArray(thumbnails) ? thumbnails : (thumbnails ? [thumbnails] : []);
    
    const best = [...mediaList, ...thumbList].find((m: any) => {
        const mData = m.$ || m;
        const mUrl = mData.url || mData['@_url'] || mData.href || mData.src;
        return isAcceptableImage(mUrl);
    });
    
    if (best) {
        const mData = best.$ || best;
        url = mData.url || mData['@_url'] || mData.href || mData.src;
    }
  }

  // Option 5: Parse HTML content for images
  if (!url) {
    const contentsToCheck = [
      item.contentEncoded,
      item['content:encoded'],
      item.content,
      item.description,
      item.summary,
      item['media:description'],
      item.text,
      item['itunes:summary']
    ];

    for (const html of contentsToCheck) {
      if (html && typeof html === 'string') {
        const unescapedHtml = decodeHTML(html);
        
        // 1. Cheerio-based structured extraction
        try {
          if (unescapedHtml.includes('<img') || unescapedHtml.includes('<source') || unescapedHtml.includes('wp-content')) {
            const $ = cheerio.load(unescapedHtml);
            $('img').each((_, el) => {
              if (url) return;
              const $img = $(el);
              const candidates: (string | undefined)[] = [
                $img.attr('data-large-file'),
                $img.attr('data-full-url'),
                $img.attr('data-orig-file'),
                $img.attr('src'),
                $img.attr('data-src'),
                $img.attr('data-original'),
                $img.attr('data-img-src'),
                $img.attr('data-lazy-src')
              ];

              // Check srcset: WordPress and Deskmodder include 500w, 810w, 1264w
              const srcset = $img.attr('srcset') || $img.attr('data-srcset');
              if (srcset) {
                const parts = srcset.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
                // Prefer crisp responsive images
                for (let i = parts.length - 1; i >= 0; i--) {
                  candidates.unshift(parts[i]);
                }
              }

              for (const cand of candidates) {
                if (cand && isAcceptableImage(cand)) {
                  url = cand;
                  break;
                }
              }
            });

            // Also check anchor links wrapping images linking to high-res media files
            if (!url) {
              $('a').each((_, el) => {
                if (url) return;
                const href = $(el).attr('href');
                if (href && (href.includes('wp-content/uploads') || href.includes('deskmodder.de')) && href.match(/\.(jpeg|jpg|png|webp|avif)(?:\?.*)?$/i)) {
                  if (isAcceptableImage(href)) {
                    url = href;
                  }
                }
              });
            }
          }
        } catch (e) {}

        if (url) break;
          
        // 2. Regex fallback for any loose or malformed tags
        const imgRegexes = [
          /<img[^>]+src=["']([^"']+)["']/gi,
          /<img[^>]+data-src=["']([^"']+)["']/gi,
          /<img[^>]+data-original=["']([^"']+)["']/gi,
          /<img[^>]+data-img-src=["']([^"']+)["']/gi,
          /<img[^>]+data-lazy-src=["']([^"']+)["']/gi,
          /<img[^>]+srcset=["']([^"'\s,]+)/gi, 
          /<img[^>]+data-srcset=["']([^"'\s,]+)/gi,
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
          /<div[^>]+style=["'][^"']*background-image:\s*url\(["']?([^"'\)]+)["']?\)/gi,
          /\[img\]([^\[\]]+)\[\/img\]/gi, // Some forum formats
          /<source[^>]+srcset=["']([^"'\s,]+)/gi // Responsive images
        ];

        for (const regex of imgRegexes) {
          const matches = unescapedHtml.matchAll(regex);
          for (const match of matches) {
            const testUrl = match[1];
            if (isAcceptableImage(testUrl)) {
              url = testUrl;
              break;
            }
          }
          if (url) break;
        }
        if (url) break;
      }
    }
  }

  // Option 6: Last resort catch-all - check everything for an image URL
  if (!url) {
    const allKeys = Object.keys(item);
    for (const key of allKeys) {
      const val = item[key];
      if (typeof val === 'string' && val.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|svg)/i)) {
        if (isAcceptableImage(val)) {
          url = val;
          break;
        }
      }
      if (typeof val === 'object' && val && val.url && typeof val.url === 'string' && val.url.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|svg)/i)) {
        if (isAcceptableImage(val.url)) {
          url = val.url;
          break;
        }
      }
    }
  }

  if (url) {
    // Basic decode of HTML entities if they still exist in URL
    url = url.replace(/&amp;/g, '&');
    
    try {
      const baseLink = item.link || '';
      if (baseLink) {
        url = new URL(url, baseLink).href;
      }
    } catch (e) {}
    
    // Apply quality optimizer / upscaler
    url = optimizeRssImageUrl(url, item.link);
    
    return url;
  }

  return undefined;
}

let isFirestoreOgCacheAvailable = true;

async function fetchOgImage(url: string, useProxy = false): Promise<string | undefined> {
  if (!url) return undefined;
  if (ogImageCache.has(url)) {
    return ogImageCache.get(url);
  }

  // Check Firestore Cache first to load in milliseconds if available and permitted
  const dbAdmin = getDbAdmin();
  const clientDb = getDbClient();
  const cacheId = Buffer.from(url).toString('base64').substring(0, 500).replace(/\//g, '_');
  
  let cachedData: any = null;
  let cacheFound = false;

  if (isFirestoreOgCacheAvailable && dbAdmin) {
    try {
      const docSnap = await dbAdmin.collection("og_images_cache").doc(cacheId).get();
      if (docSnap.exists) {
        cachedData = docSnap.data();
        cacheFound = true;
      }
    } catch (e: any) {
      if (e?.code === 7 || e?.code === 9 || e?.message?.includes('PERMISSION_DENIED') || e?.message?.includes('FAILED_PRECONDITION')) {
        isFirestoreOgCacheAvailable = false;
      }
      // Quietly ignore and let fallback try
    }
  }

  if (!cacheFound && clientDb) {
    try {
      const docSnap = await getDoc(doc(clientDb, "og_images_cache", cacheId));
      if (docSnap.exists()) {
        cachedData = docSnap.data();
        cacheFound = true;
      }
    } catch (e: any) {
      if (!e?.message?.includes('PERMISSION_DENIED') && e?.code !== 7) {
        console.warn(`[Firestore Cache Read Error] for ${url}:`, e?.message || e);
      }
    }
  }

  if (cacheFound && cachedData && typeof cachedData.imageUrl === 'string') {
    ogImageCache.set(url, cachedData.imageUrl);
    return cachedData.imageUrl;
  }

  try {
    const fetchWithTimeout = async (targetUrl: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    };

    let response: Response | null = null;
    let html = '';
    
    // 1. Direct fetch with a balanced timeout (3.5s)
    try {
      response = await fetchWithTimeout(url, 3500);
      if (response && response.ok) {
        html = await response.text();
      } else {
        throw new Error(`Direct fetch status: ${response ? response.status : 'unknown'}`);
      }
    } catch (err: any) {
      // 2. Direct fetch failed. Try resilient proxies to bypass any geo-blocks or scraping firewalls!
      const isDeskmodderUrl = url.toLowerCase().includes('deskmodder.de');
      const proxyUrls = isDeskmodderUrl ? [
        `https://r.jina.ai/${url}`,
        `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
      ] : [
        `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        `https://r.jina.ai/${url}`
      ];
      
      for (const proxyUrl of proxyUrls) {
        try {
          const pResponse = await fetchWithTimeout(proxyUrl, 3500);
          if (pResponse && pResponse.ok) {
            html = await pResponse.text();
            if (html && (html.toLowerCase().includes('<html') || html.toLowerCase().includes('<meta') || html.includes('Markdown Content:'))) {
              break;
            }
          }
        } catch (pErr) {
          // ignore proxy error, try next
        }
      }
    }

    if (!html) {
      return undefined;
    }

    // Check if proxy returned Jina markdown instead of HTML
    if (html.includes('Markdown Content:') || (html.includes('![') && !html.includes('<html'))) {
      const imgMatches = [...html.matchAll(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g)];
      for (const m of imgMatches) {
        const candidate = m[1];
        const lowerCand = candidate ? candidate.toLowerCase() : '';
        if (
          candidate &&
          candidate.startsWith('http') &&
          !lowerCand.includes('avatar') &&
          !lowerCand.includes('gravatar') &&
          !lowerCand.includes('smilies') &&
          !lowerCand.includes('deskmodder_logo') &&
          !lowerCand.includes('site-logo') &&
          !lowerCand.includes('header-logo') &&
          !lowerCand.includes('favicon') &&
          !lowerCand.includes('pixel') &&
          !candidate.endsWith('.html') &&
          !candidate.endsWith('.xml')
        ) {
          ogImageCache.set(url, candidate);
          return candidate;
        }
      }
    }

    const $ = cheerio.load(html);
    
    // 1. Check standard OpenGraph and Twitter cards
    const getBestMeta = () => {
      // Priority 1: High quality OG image
      let img = $('meta[property="og:image:secure_url"]').attr('content') || 
                $('meta[property="og:image"]').attr('content') || 
                $('meta[property="og:image:url"]').attr('content');
      
      // Priority 2: Twitter cards (usually good quality)
      if (!img || img.toLowerCase().includes('logo') || img.toLowerCase().includes('icon')) {
        const tw = $('meta[name="twitter:image"]').attr('content') || 
                   $('meta[name="twitter:image:src"]').attr('content');
        if (tw && !tw.toLowerCase().includes('logo') && !tw.toLowerCase().includes('icon')) img = tw;
      }
      
      // Priority 3: Other meta images
      if (!img) img = $('meta[name="image"]').attr('content');
      
      return img;
    };

    let ogImage = getBestMeta();
    
    // 2. Check Schema.org markup / JSON-LD
    if (!ogImage) {
      try {
        const jsonLd = $('script[type="application/ld+json"]');
        jsonLd.each((_, el) => {
          try {
            const data = JSON.parse($(el).html() || '{}');
            if (data.image) {
              if (typeof data.image === 'string') ogImage = data.image;
              else if (Array.isArray(data.image) && typeof data.image[0] === 'string') ogImage = data.image[0];
              else if (data.image.url) ogImage = data.image.url;
            }
            if (ogImage) return false; // break loop
          } catch (e) {}
        });
      } catch (e) {}
    }

    if (!ogImage) ogImage = $('meta[itemprop="image"]').attr('content');
    if (!ogImage) ogImage = $('link[rel="image_src"]').attr('href');
    
    // 3. Try to find the first image in an article or main tag (High priority)
    if (!ogImage) {
      const selectors = [
        'article img', 
        'main img', 
        '.article-body img', 
        '.content img', 
        '#main-content img',
        '.post-content img',
        '.entry-content img',
        '.featured-media img',
        '.article-image img',
        '.main-image img'
      ];
      for (const selector of selectors) {
        const el = $(selector).first();
        const src = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src') || el.attr('srcset')?.split(' ')[0];
        if (src && !src.includes('logo') && !src.includes('icon') && src.length > 10) {
          ogImage = src;
          break;
        }
      }
    }

    // 5. Check for common class-based images and high-res versions
    if (!ogImage) {
      const highResAttr = [
        'data-high-res', 'data-full-src', 'data-original', 'data-src-hq', 'data-zoom-src'
      ];
      for (const attr of highResAttr) {
        const found = $(`img[${attr}]`).attr(attr);
        if (found && found.length > 10 && !found.includes('logo') && !found.includes('icon')) {
          ogImage = found;
          break;
        }
      }
    }

    // 6. Fallback to site icons if absolutely necessary (Lowest priority)
    if (!ogImage) ogImage = $('link[rel="apple-touch-icon"]').attr('href');
    if (!ogImage) ogImage = $('link[rel="shortcut icon"]').attr('href');
    if (!ogImage) ogImage = $('link[rel="icon"]').attr('href');
    
    // Ensure we don't return a tiny tracking pixel or favicon if we have better options
    if (ogImage && (ogImage.includes('pixel') || ogImage.includes('favicon') || ogImage.includes('dot.gif') || ogImage.includes('spacer.gif'))) {
      const betterOption = $('img').map((_, el) => $(el).attr('src')).get().find(s => s && s.length > 20 && !s.includes('pixel') && !s.includes('icon'));
      if (betterOption) ogImage = betterOption;
    }

    if (ogImage) {
      try {
        ogImage = new URL(ogImage, url).href;
      } catch(e) {}
      ogImage = optimizeRssImageUrl(ogImage, url) || ogImage;
    }
    
    if (ogImage) {
      ogImageCache.set(url, ogImage);
      const clientDb = getDbClient();
      if (isFirestoreOgCacheAvailable && (dbAdmin || clientDb)) {
        const cacheId = Buffer.from(url).toString('base64').substring(0, 500).replace(/\//g, '_');
        const cachePayload = {
          url,
          imageUrl: ogImage,
          scrapedAt: new Date().toISOString()
        };

        if (clientDb) {
          setDoc(doc(clientDb, "og_images_cache", cacheId), cachePayload).catch((e: any) => {
            if (e?.code === 7 || e?.code === 9 || e?.message?.includes('PERMISSION_DENIED') || e?.message?.includes('FAILED_PRECONDITION')) {
              isFirestoreOgCacheAvailable = false;
            }
          });
        } else if (dbAdmin) {
          dbAdmin.collection("og_images_cache").doc(cacheId).set(cachePayload).catch((e: any) => {
            if (e?.code === 7 || e?.code === 9 || e?.message?.includes('PERMISSION_DENIED') || e?.message?.includes('FAILED_PRECONDITION')) {
              isFirestoreOgCacheAvailable = false;
            } else {
              console.warn(`[Firestore Cache Write Error] for ${url}:`, e?.message || e);
            }
          });
        }
      }
    }
    return ogImage;
  } catch (error) {
    return undefined;
  }
}

async function fetchYouTubeVideoDetails(videoIds: string[], apiKey: string): Promise<Record<string, string>> {
  if (videoIds.length === 0 || !apiKey) return {};
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds.join(',')}&key=${apiKey}`, {
      headers: { 
        'Referer': 'https://rsser.news/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const data = await res.json() as any;
      const map: Record<string, string> = {};
      data.items?.forEach((v: any) => {
        const thumbs = v.snippet?.thumbnails;
        // Prefer maxres, then high, then medium, then default
        map[v.id] = thumbs?.maxres?.url || thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url;
      });
      return map;
    }
  } catch (e) {
    console.error("YouTube Videos API error", e);
  }
  return {};
}

async function cleanupOldArticles() {
  const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000);
  
  // Try Admin SDK first
  const db = getDbAdmin();
  if (db) {
    try {
      const snap = await db.collection('publicRssCache')
        .where('updatedAt', '<', fiveDaysAgo)
        .limit(500)
        .get();
      
      if (!snap.empty) {
        const batch = db.batch();
        let count = 0;
        snap.docs.forEach((doc: any) => {
          batch.delete(doc.ref);
          count++;
        });
        await batch.commit();
        console.log(`[Global Cleanup] Removed ${count} expired RSS cache entries (Admin SDK).`);
      }
      
      // Clean up old item votes (no updates in 5 days)
      const votesSnap = await db.collection('itemVotes')
        .where('updatedAt', '<', fiveDaysAgo)
        .limit(500)
        .get();
        
      if (!votesSnap.empty) {
        const batch = db.batch();
        let count = 0;
        votesSnap.docs.forEach((doc: any) => {
          batch.delete(doc.ref);
          count++;
        });
        await batch.commit();
        console.log(`[Global Cleanup] Removed ${count} expired item vote entries (Admin SDK).`);
      }
      return; // Success
    } catch (e: any) {
      // If permission denied, fall through to Client SDK attempt
    }
  }

  // Fallback to Client SDK for cleanup if Admin lacks permissions
  const clientDb = getDbClient();
  if (clientDb) {
    try {
      const q = query(
        collection(clientDb, 'publicRssCache'),
        where('updatedAt', '<', fiveDaysAgo),
        limit(10) // Small limit for client SDK in background
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        // We delete one by one on client SDK as there's no easy batch on the web SDK in same way
        let count = 0;
        for (const d of snap.docs) {
           // On web SDK we don't usually delete from server code, but let's try if rules allow
           // However, rules might block this.
           // Since we can't reliably do cleanup without Admin SDK permissions, we just log it once.
           count++; 
        }
        // In reality, let's just ignore if both fail
      }
    } catch (e: any) {
      if (!global.cleanupErrorLogged) {
        console.warn("[Global Cleanup] Background cleanup disabled (Permission Denied).");
        global.cleanupErrorLogged = true;
      }
    }
  }
}

async function resetAllItemVotesToZero() {
  const db = getDbAdmin();
  if (db) {
    try {
      const snapshot = await db.collection('itemVotes').get();
      if (!snapshot.empty) {
        let batch = db.batch();
        let i = 0;
        let count = 0;
        for (const doc of snapshot.docs) {
          batch.update(doc.ref, { votes: 0, voters: {} });
          i++;
          count++;
          if (i === 400) {
            await batch.commit();
            batch = db.batch();
            i = 0;
          }
        }
        if (i > 0) {
          await batch.commit();
        }
        console.log(`[Migration] Successfully reset ${count} item votes in Firestore database to 0.`);
      }
    } catch (e: any) {
      // Silently skip if Admin SDK has no write credentials
    }
  }
}

declare global {
  var cleanupErrorLogged: boolean;
}
global.cleanupErrorLogged = false;

// Deep decode HTML entities
function deepDecode(text: string | undefined | null): string {
  if (!text) return "";
  let current = String(text);
  let prev = "";
  // Decode up to 3 times to catch nested entities like &amp;#8217;
  for (let i = 0; i < 3; i++) {
    prev = current;
    current = decodeHTML(current);
    if (prev === current) break;
  }
  return current;
}

function xmlEscape(str: string): string {
  if (!str) return "";
  return str.replace(/[<>&"']/g, (c) => {
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

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    // Fast health check endpoint for Cloud Run and platform startup probes
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok" });
    });

    app.use(compression());
    app.use(express.json());

  app.post("/api/admin/cleanup-sources", async (req, res) => {
    try {
      const db = getDbAdmin();
      const clientDb = getDbClient();
      
      let docs: any[] = [];
      let usingAdmin = false;
      
      if (db) {
        try {
          const snapshot = await db.collection('publicSources').limit(500).get();
          docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ref: doc.ref, url: doc.data().url, title: doc.data().title }));
          usingAdmin = true;
        } catch (e) {}
      }
      
      if (!usingAdmin && clientDb) {
        try {
          const q = query(collection(clientDb, 'publicSources'), limit(500));
          const snap = await getDocs(q);
          docs = snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, url: doc.data().url, title: doc.data().title }));
        } catch (e) {}
      }
      
      if (docs.length === 0) {
        return res.json({ success: true, deleted: [], message: "Keine Quellen in der Datenbank gefunden oder keine Berechtigung." });
      }
      
      const deleted: any[] = [];
      const checked: any[] = [];
      
      const checkAndCleanup = async (item: any) => {
        const url = item.url;
        if (!url) return;
        
        let isBroken = false;
        
        // Known problematic / old patterns that always cause 404 or fail
        const deadPatterns = [
          "la-ruina",
          "entiende-tu-mente",
          "bloggerwissen.de",
          "mindsandmarkets.de",
          "bitsundso.de/feed/m4a/",
          "deutschlandfunk.de/der-tag-104.xml"
        ];
        
        if (deadPatterns.some(pattern => url.toLowerCase().includes(pattern))) {
          isBroken = true;
        } else {
          // Check live
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);
            const response = await fetch(url, {
              method: "GET",
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
              signal: controller.signal
            });
            clearTimeout(timeout);
            
            if (response.status === 404 || response.status === 410) {
              isBroken = true;
            }
          } catch (err) {
            // Unreachable or DNS error
            isBroken = true;
          }
        }
        
        checked.push({ title: item.title, url, isBroken });
        
        if (isBroken) {
          try {
            if (usingAdmin) {
              await item.ref.delete();
            } else if (clientDb) {
              await deleteDoc(item.ref);
            }
            deleted.push({ id: item.id, title: item.title, url });
          } catch (delErr) {
            console.error(`Failed to delete broken source ${item.title}:`, delErr);
          }
        }
      };
      
      // Process in chunks of 15 to not overwhelm connection pools
      const chunks = [];
      const chunkSize = 15;
      for (let i = 0; i < docs.length; i += chunkSize) {
        chunks.push(docs.slice(i, i + chunkSize));
      }
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(checkAndCleanup));
      }
      
      res.json({
        success: true,
        deletedCount: deleted.length,
        checkedCount: checked.length,
        deleted,
        message: `${deleted.length} fehlerhafte Quellen wurden erfolgreich identifiziert und aus der Datenbank entfernt.`
      });
    } catch (err: any) {
      console.error("[api/admin/cleanup-sources] Error during cleanup:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const DEAD_SOURCE_URLS = new Set([
    "https://www.bloggerwissen.de/feed/",
    "https://mindsandmarkets.de/feed/",
    "https://www.bitsundso.de/feed/m4a/",
    "https://www.deutschlandfunk.de/der-tag-104.xml"
  ]);

  app.get("/api/public-sources", async (req, res) => {
    const normUrl = (u?: string) => (u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    const sanitizeSource = (s: any) => {
      let imageUrl = s.imageUrl;
      if (
        (s.title && s.title.toLowerCase().includes('lage der nation')) ||
        (s.url && s.url.toLowerCase().includes('lagedernation')) ||
        (imageUrl && (imageUrl.includes('da720bc5-6fe3-b09b-65c9-9430c5e13589') || imageUrl.includes('mza_1079549307223055428')))
      ) {
        if (!s.customImageUrl) {
          imageUrl = 'https://lagedernation.org/wp-content/blogs.dir/10/files/2020/06/apple_podcast_artwork_reverse.png';
        }
      }
      return { ...s, imageUrl };
    };

    // Bootstrap fallback ONLY if the database is 100% empty
    const defaultSourcesWithId = DEFAULT_SOURCES
      .filter(s => s.url && !DEAD_SOURCE_URLS.has(s.url))
      .map((s, idx) => sanitizeSource({
        id: (s as any).id || `default-${s.type || 'src'}-${idx}`,
        ...s,
        category: s.category === 'Technik' ? 'Tech' : s.category
      }));

    try {
      const db = getDbAdmin();
      if (db) {
        try {
          const snapshot = await db.collection('publicSources').limit(1000).get();
          if (!snapshot.empty) {
            // Firestore database is the ONLY source of truth
            const dbSources = snapshot.docs
              .filter((doc: any) => !doc.data().deleted)
              .map((doc: any) => {
                const data = doc.data();
                const mappedCategory = data.category === 'Technik' ? 'Tech' : data.category;
                return sanitizeSource({ id: doc.id, ...data, category: mappedCategory });
              })
              .filter((s: any) => s.url && !DEAD_SOURCE_URLS.has(s.url));

            dbSources.sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));
            return res.json(dbSources);
          }
        } catch (adminErr: any) {
          if (!adminErr.message?.includes('PERMISSION_DENIED')) {
            console.warn("[Firebase Admin] Public sources fetch failed:", adminErr.message);
          }
        }
      }

      // Fallback to clientDb if Admin SDK is unavailable
      const clientDb = getDbClient();
      if (clientDb) {
        try {
          const snap = await getDocs(query(collection(clientDb, 'publicSources'), limit(1000)));
          if (!snap.empty) {
            const dbSources = snap.docs
              .filter((d: any) => !d.data().deleted)
              .map((d: any) => {
                const data = d.data();
                const mappedCategory = data.category === 'Technik' ? 'Tech' : data.category;
                return sanitizeSource({ id: d.id, ...data, category: mappedCategory });
              })
              .filter((s: any) => s.url && !DEAD_SOURCE_URLS.has(s.url));

            dbSources.sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));
            return res.json(dbSources);
          }
        } catch (clientErr: any) {
          // Ignore
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('PERMISSION_DENIED')) {
        console.error("[api/public-sources] Error:", err.message);
      }
    }
    return res.json(defaultSourcesWithId);
  });

  const imageProxyCache = new Map<string, { buffer: Buffer, contentType: string, timestamp: number }>();

  app.get("/api/image-proxy", async (req, res) => {
    let imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("URL required");
    }

    // Fix known broken mzstatic image URLs that Apple 404ed
    if (imageUrl.includes('da720bc5-6fe3-b09b-65c9-9430c5e13589') || imageUrl.includes('mza_1079549307223055428')) {
      imageUrl = 'https://lagedernation.org/wp-content/blogs.dir/10/files/2020/06/apple_podcast_artwork_reverse.png';
    }

    if (!imageUrl.startsWith("http")) {
      return res.status(400).send("Absolute URL required");
    }

    // Check in-memory image cache
    const now = Date.now();
    const cachedImage = imageProxyCache.get(imageUrl);
    if (cachedImage && (now - cachedImage.timestamp < 12 * 60 * 60 * 1000)) { // 12 hours server cache
      res.setHeader("Content-Type", cachedImage.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(cachedImage.buffer);
    }

    // Occasional cache eviction to prevent excessive memory usage
    if (Math.random() < 0.05) {
      for (const [key, value] of imageProxyCache.entries()) {
        if (now - value.timestamp > 12 * 60 * 60 * 1000) {
          imageProxyCache.delete(key);
        }
      }
    }

    let imageRes: Response | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s direct timeout
      
      imageRes = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": new URL(imageUrl).origin
        }
      });
      clearTimeout(timeoutId);

      if (!imageRes.ok) {
        throw new Error(`Failed to fetch image: ${imageRes.status}`);
      }
    } catch (error: any) {
      // Direct fetch failed (e.g. ECONNREFUSED from Hetzner/Deskmodder or timeout).
      // Fall back to high-reliability image CDN proxies:
      const fallbackProxies = [
        `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`,
        `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`
      ];
      for (const fbUrl of fallbackProxies) {
        try {
          const fbController = new AbortController();
          const fbTimeout = setTimeout(() => fbController.abort(), 6000);
          const fbRes = await fetch(fbUrl, { signal: fbController.signal });
          clearTimeout(fbTimeout);
          if (fbRes.ok) {
            imageRes = fbRes;
            break;
          }
        } catch (fbErr) {
          // ignore, try next fallback
        }
      }
    }

    if (!imageRes || !imageRes.ok) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(404).send("Image not found or inaccessible");
    }

    try {
      const contentType = imageRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");

      const arrayBuffer = await imageRes.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      
      // Save fetched image to in-memory cache
      imageProxyCache.set(imageUrl, { buffer: buf, contentType, timestamp: now });

      return res.send(buf);
    } catch (streamErr) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(404).send("Image streaming failed");
    }
  });

  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    const userToken = req.headers['x-user-token']; // Very basic check - we should ideally verify this

    if (!targetUrl) {
      return res.status(400).send("URL required");
    }
    
    // Safety check: Only allow some domains OR require a token if you're the owner
    // For now, let's at least log it and require that it's an HTTP URL
    if (!targetUrl.startsWith('http')) {
      return res.status(403).send("Only absolute HTTP(S) links allowed");
    }

    try {
      // REDUCED TIMEOUT to be less taxing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const targetRes = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        }
      });
      
      clearTimeout(timeoutId);
      
      const contentType = targetRes.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return res.redirect(targetUrl);
      }
      
      let html = await targetRes.text();
      
      const parsedUrl = new URL(targetUrl);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      
      // Inject base tag
      html = html.replace(/<head[^>]*>/i, `$&<base href="${baseUrl}/">`);
      
      // Inject script to prevent top navigation
      html = html.replace(/<head[^>]*>/i, `$&<script>window.top = window.self; window.parent = window.self;</script>`);
      
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Frame-Options", "ALLOWALL"); 
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(html);
      
    } catch (err: any) {
      console.error("Proxy error:", err);
      res.status(500).send(`
        <div style="font-family: sans-serif; padding: 2rem; text-align: center;">
          <h2>Die Seite konnte nicht geladen werden</h2>
          <p>${err.message}</p>
          <a href="${targetUrl}" target="_blank" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #f97316; color: white; text-decoration: none; border-radius: 9999px;">Im Original öffnen</a>
        </div>
      `);
    }
  });
  
  app.get("/api/alerts", (req, res) => {
    res.json(systemAlerts);
  });
  
  app.delete("/api/alerts", (req, res) => {
    systemAlerts = [];
    res.json({ success: true });
  });

  // Gemini AI Endpoints
  const getGenAI = (req?: express.Request) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }
    
    const headers: Record<string, string> = {
      'User-Agent': 'aistudio-build',
    };

    // Forward Referer and Origin if they exist in the incoming browser request, or fallback to the app's domain
    let refererToUse = req?.headers?.referer as string;
    if (!refererToUse) {
      refererToUse = "https://rsser.news/";
    }
    headers['Referer'] = refererToUse;

    if (req?.headers?.origin) {
      headers['Origin'] = req.headers.origin as string;
    } else {
      try {
        const refUrl = new URL(refererToUse);
        headers['Origin'] = `${refUrl.protocol}//${refUrl.host}`;
      } catch (e) {
        headers['Origin'] = "https://rsser.news";
      }
    }

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers,
      }
    });
  };

  app.post("/api/ai/translate", async (req, res) => {
    try {
      const { text, targetLangs } = req.body;
      if (!text || !targetLangs || !Array.isArray(targetLangs)) {
        return res.status(400).json({ error: "Missing text or targetLangs array" });
      }

      const ai = getGenAI(req);

      const prompt = `Du bist ein professioneller Übersetzer. Übersetze den folgenden HTML-Inhalt (die Ausgangssprache kann Deutsch, Englisch, Französisch oder Spanisch sein) in diese Sprachen: ${targetLangs.join(", ")}.
      
      REGELN:
      1. Übersetze NUR den Textinhalt IN oder ZWISCHEN den HTML-Tags.
      2. Behalte ALLE HTML-Tags (wie <strong>, <p>, <ul>, <li>, <br>, <a>, <img>) exakt so bei, wie sie sind.
      3. Füge KEINEN zusätzlichen Text oder Kommentare hinzu.
      4. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt.
      5. SEHR WICHTIG: Alle HTML-Attribute wie href="..." oder src="..." MÜSSEN im übersetzten JSON-String absolut korrekt mit Backslashes maskiert werden (z. B. \\" oder \\"https://...\\"). Das JSON muss 100% syntaktisch valide sein.
      
      ZIEL-JSON-STRUKTUR:
      {
        ${targetLangs.map(l => `"${l}": "Übersetzter Text hier"`).join(",\n        ")}
      }
      
      AUSGANGSINHALT:
      ${text}`;

      const properties: Record<string, { type: Type }> = {};
      for (const lang of targetLangs) {
        properties[lang] = { type: Type.STRING };
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties,
            required: targetLangs,
          }
        }
      });
      
      let responseText = response.text || "{}";
      responseText = responseText.trim();
      
      // Clean up markdown code blocks if any got returned despite responseMimeType
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```(?:json)?\n?/i, "");
        responseText = responseText.replace(/\n?```$/, "");
        responseText = responseText.trim();
      }
      
      try {
        res.json(JSON.parse(responseText));
      } catch (parseErr: any) {
        console.error("[Gemini AI] JSON parse error of raw response:", responseText, parseErr);
        // Fallback: If parsing failed, try to isolate the JSON block by finding the outer curly braces
        try {
          const firstBrace = responseText.indexOf("{");
          const lastBrace = responseText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const trimmedJson = responseText.substring(firstBrace, lastBrace + 1);
            res.json(JSON.parse(trimmedJson));
          } else {
            throw parseErr;
          }
        } catch (fallbackErr: any) {
          throw new Error(`Ungültiges JSON-Format von KI empfangen: ${parseErr.message}`);
        }
      }
    } catch (err: any) {
      console.error("[Gemini AI] Translation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/test", async (req, res) => {
    try {
      const ai = getGenAI(req);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Antworte kurz ob du bereit bist.",
      });
      res.json({ text: response.text || "Bereit" });
    } catch (err: any) {
      console.error("[Gemini AI] Test error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/og-image", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL parameter 'url' is required" });
    }
    try {
      if (ogImageCache.has(url)) {
        return res.json({ imageUrl: ogImageCache.get(url) });
      }
      const imageUrl = await fetchOgImage(url);
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Active feeds map to track currently active users' feeds for background pre-caching
  const activeFeedsToCrawler = new Map<string, { url: string, maxDays: number, lastRequested: number }>();

  function fetchWithHttpsModule(urlToFetch: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(urlToFetch);
        const options = {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.5',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'close'
          },
          rejectUnauthorized: false, // Bypass SSL issues!
          timeout: 6000
        };

        const lib = parsedUrl.protocol === 'https:' ? https : http;
        const req = lib.request(urlToFetch, options, (res) => {
          if (res.statusCode && (res.statusCode >= 300 && res.statusCode < 400) && res.headers.location) {
            // Handle redirect
            resolve(fetchWithHttpsModule(new URL(res.headers.location, urlToFetch).toString()));
            return;
          }

          if (res.statusCode && res.statusCode !== 200) {
            reject(new Error(`Status code ${res.statusCode}`));
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });

        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  const inFlightFeedRequests = new Map<string, Promise<any>>();

  async function parseFeedWithLogic(url: string, maxDays: number = 30, shouldBypass: boolean = false): Promise<any> {
    if (shouldBypass) {
      return executeParseFeedWithLogic(url, maxDays, true);
    }
    const flightKey = `${url}_${maxDays}`;
    if (inFlightFeedRequests.has(flightKey)) {
      return inFlightFeedRequests.get(flightKey);
    }
    const reqPromise = (async () => {
      try {
        return await executeParseFeedWithLogic(url, maxDays, false);
      } finally {
        inFlightFeedRequests.delete(flightKey);
      }
    })();
    inFlightFeedRequests.set(flightKey, reqPromise);
    return reqPromise;
  }

  async function executeParseFeedWithLogic(url: string, maxDays: number = 30, shouldBypass: boolean = false): Promise<any> {
    // Intercept internal/blog URLs and convert to standard RSS user feed URL
    if (url && (url.includes('/blogs/user/') || url.includes('/blogs/author/') || url.includes('/api/rss/user/'))) {
      let userId = '';
      if (url.includes('/blogs/user/')) {
        userId = url.split('/blogs/user/').pop()?.split('/')[0] || '';
      } else if (url.includes('/blogs/author/')) {
        userId = url.split('/blogs/author/').pop()?.split('/')[0] || '';
      } else if (url.includes('/api/rss/user/')) {
        userId = url.split('/api/rss/user/').pop()?.split('?')[0] || '';
      }
      if (userId) {
        url = `http://127.0.0.1:3000/api/rss/user/${userId}`;
      }
    }

    const convertJinaMarkdownToRssXml = (feedTitle: string, feedDesc: string, feedUrl: string, content: string): string => {
      try {
        const items: Array<{ title: string, link: string, pubDate: string, description: string, image?: string }> = [];
        const blocks = content.split(/###\s+\[/);
        
        for (let i = 1; i < blocks.length; i++) {
          const block = blocks[i];
          const titleEnd = block.indexOf(']');
          if (titleEnd === -1) continue;
          const title = block.substring(0, titleEnd).trim();
          
          const linkStart = block.indexOf('(', titleEnd);
          if (linkStart === -1) continue;
          const linkEnd = block.indexOf(')', linkStart);
          if (linkEnd === -1) continue;
          const link = block.substring(linkStart + 1, linkEnd).trim();
          
          const remaining = block.substring(linkEnd + 1).trim();
          const lines = remaining.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          let pubDate = new Date().toUTCString();
          let description = '';
          let image = '';
          
          for (const line of lines) {
            // Check for markdown image ![alt](url)
            const imgMatch = line.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
            if (imgMatch && !image) {
              image = imgMatch[1];
              continue;
            }

            if (line.includes('[') && line.includes(']')) {
              continue;
            }
            const looksLikeDate = /^[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(line) ||
                                  /\d{4}-\d{2}-\d{2}/.test(line) ||
                                  /^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(line);
            if (looksLikeDate) {
              pubDate = line;
            } else if (line.length > 10 && !description) {
              description = line;
            }
          }
          
          items.push({ title, link, pubDate, description: description || title, image });
        }

        let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
        xml += `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">\n`;
        xml += `  <channel>\n`;
        xml += `    <title><![CDATA[${feedTitle || 'Parsed Feed'}]]></title>\n`;
        xml += `    <link>${feedUrl}</link>\n`;
        xml += `    <description><![CDATA[${feedDesc || 'Bypassed feed parsed via Jina Reader'}]]></description>\n`;
        
        for (const item of items) {
          xml += `    <item>\n`;
          xml += `      <title><![CDATA[${item.title}]]></title>\n`;
          xml += `      <link>${item.link}</link>\n`;
          xml += `      <guid isPermaLink="true">${item.link}</guid>\n`;
          
          let parsedPubDate = item.pubDate;
          try {
            parsedPubDate = new Date(item.pubDate).toUTCString();
          } catch (e) {}
          
          xml += `      <pubDate>${parsedPubDate}</pubDate>\n`;
          xml += `      <description><![CDATA[${item.description}]]></description>\n`;
          if (item.image) {
            xml += `      <media:thumbnail url="${item.image}"/>\n`;
            xml += `      <media:content url="${item.image}" medium="image"/>\n`;
          }
          xml += `    </item>\n`;
        }
        
        xml += `  </channel>\n`;
        xml += `</rss>`;
        return xml;
      } catch (e) {
        console.error("Error converting Jina markdown to RSS XML", e);
        return "";
      }
    };

    const convertRss2JsonToXml = (jsonStr: string): string => {
      try {
        const data = JSON.parse(jsonStr);
        if (data && data.status === 'ok' && data.feed) {
          const feed = data.feed;
          const items = data.items || [];
          
          let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
          xml += `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">\n`;
          xml += `  <channel>\n`;
          xml += `    <title><![CDATA[${feed.title || ''}]]></title>\n`;
          xml += `    <link>${feed.link || ''}</link>\n`;
          xml += `    <description><![CDATA[${feed.description || ''}]]></description>\n`;
          if (feed.image) {
            xml += `    <image>\n`;
            xml += `      <url>${feed.image}</url>\n`;
            xml += `      <title><![CDATA[${feed.title || ''}]]></title>\n`;
            xml += `      <link>${feed.link || ''}</link>\n`;
            xml += `    </image>\n`;
          }
          
          for (const item of items) {
            xml += `    <item>\n`;
            xml += `      <title><![CDATA[${item.title || ''}]]></title>\n`;
            xml += `      <link>${item.link || ''}</link>\n`;
            
            let pubDate = item.pubDate;
            if (pubDate) {
              try {
                pubDate = new Date(pubDate).toUTCString();
              } catch (e) {
                // keep as-is
              }
            }
            xml += `      <pubDate>${pubDate || ''}</pubDate>\n`;
            xml += `      <guid isPermaLink="${item.guid && item.guid.startsWith('http') ? 'true' : 'false'}">${item.guid || item.link || ''}</guid>\n`;
            xml += `      <description><![CDATA[${item.description || ''}]]></description>\n`;
            xml += `      <content:encoded><![CDATA[${item.content || ''}]]></content:encoded>\n`;
            if (item.author) {
              xml += `      <dc:creator><![CDATA[${item.author}]]></dc:creator>\n`;
            }
            if (item.categories && Array.isArray(item.categories)) {
              for (const cat of item.categories) {
                xml += `      <category><![CDATA[${cat}]]></category>\n`;
              }
            }
            if (item.enclosure && item.enclosure.link) {
              xml += `      <enclosure url="${item.enclosure.link}" type="${item.enclosure.type || 'audio/mpeg'}" length="${item.enclosure.length || '0'}"/>\n`;
            }
            let thumbnail = item.thumbnail;
            if (!thumbnail && (item.description || item.content)) {
              const combined = (item.content || '') + ' ' + (item.description || '');
              const imgMatch = combined.match(/<img\s+[^>]*?(?:src|data-src|data-original)=["']([^"']+)["']/i);
              if (imgMatch && imgMatch[1]) {
                thumbnail = imgMatch[1].replace(/&amp;/g, '&').trim();
              } else {
                const srcsetMatch = combined.match(/<img\s+[^>]*?(?:srcset|data-srcset)=["']([^"'\s,]+)/i);
                if (srcsetMatch && srcsetMatch[1]) {
                  thumbnail = srcsetMatch[1].replace(/&amp;/g, '&').trim();
                }
              }
            }
            if (thumbnail) {
              xml += `      <media:thumbnail url="${thumbnail}"/>\n`;
              xml += `      <media:content url="${thumbnail}" medium="image"/>\n`;
              xml += `      <enclosure url="${thumbnail}" type="image/jpeg" length="0"/>\n`;
            }
            xml += `    </item>\n`;
          }
          
          xml += `  </channel>\n`;
          xml += `</rss>\n`;
          return xml;
        }
      } catch (e) {
        // ignore
      }
      return jsonStr;
    };

    const cacheKey = `${url}-${maxDays}`;
    const cacheId = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);
    
    const cached = rssCache.get(cacheKey);
    // Cleanup old cache entries occasionally
    if (Math.random() < 0.05) {
      const now = Date.now();
      for (const [key, value] of rssCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) rssCache.delete(key);
      }
    }

    function applyDeepDecodeToItems(data: any) {
      if (!data) return data;

      // Handle custom cover for Bits und so ONLY if no valid pre-existing image URL exists
      const feedUrlStr = (data.feedUrl || data.url || url || '').toLowerCase();
      const feedTitleStr = (data.title || '').toLowerCase();
      const hasPreExistingImage = (data.image && data.image.url) || data.originalImageUrl || (data.itunes && data.itunes.image);
      const isHardcodedITunes = (img: any) => typeof img === 'string' && img.includes('mza_11977799580453303866');
      const needsCoverOverride = !hasPreExistingImage || isHardcodedITunes(data.image?.url) || isHardcodedITunes(data.originalImageUrl) || isHardcodedITunes(data.itunes?.image);
      
      if (needsCoverOverride && (feedUrlStr.includes('bitsundso') || feedUrlStr.includes('bits-und-so') || feedTitleStr.includes('bits und so'))) {
         const customCover = getBitsUndSoCover();
         data.image = { url: customCover };
         if (data.itunes) {
           data.itunes.image = customCover;
         }
         data.originalImageUrl = customCover;
      }

      if (data.image && typeof data.image.url === 'string' && data.image.url.startsWith('http://')) {
        data.image.url = data.image.url.replace('http://', 'https://');
      }
      if (data.itunes && typeof data.itunes.image === 'string' && data.itunes.image.startsWith('http://')) {
        data.itunes.image = data.itunes.image.replace('http://', 'https://');
      }
      if (data.originalImageUrl && typeof data.originalImageUrl === 'string' && data.originalImageUrl.startsWith('http://')) {
        data.originalImageUrl = data.originalImageUrl.replace('http://', 'https://');
      }

      // Proxy top-level images to bypass client CORS/hotlink protections
      if (data.image && data.image.url) {
        data.image.url = proxyImageUrl(data.image.url);
      }
      if (data.originalImageUrl) {
        data.originalImageUrl = proxyImageUrl(data.originalImageUrl);
      }
      if (data.itunes && data.itunes.image) {
        data.itunes.image = proxyImageUrl(data.itunes.image);
      }

      if (data && data.items && Array.isArray(data.items)) {
        const feedImage = (data.itunes && data.itunes.image) || (data.image && data.image.url) || data.originalImageUrl || null;
        let secureFeedImage = typeof feedImage === 'string' ? feedImage : null;
        if (secureFeedImage && secureFeedImage.startsWith('http://')) {
          secureFeedImage = secureFeedImage.replace('http://', 'https://');
        }
        
        const isPodcast = checkIsPodcastFeed(data);

        data.items = data.items.filter((item: any) => {
          return item && item.title && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.trim().toLowerCase() !== 'ohne titel';
        });
        data.items.forEach((item: any) => {
          item.title = deepDecode(item.title);
          item.contentSnippet = deepDecode(item.contentSnippet);
          item.description = deepDecode(item.description);
          item.summary = deepDecode(item.summary);
          if (item.content) item.content = decodeHTML(item.content);
          if (item.contentEncoded) item.contentEncoded = decodeHTML(item.contentEncoded);
          
          // Sanitize item.imageUrl to ensure no mp3 or non-image URLs are passed as images
          if (item.imageUrl && typeof item.imageUrl === 'string') {
            const lowerImg = item.imageUrl.toLowerCase();
            const decodedImg = decodeURIComponent(lowerImg);
            const pathPart = decodedImg.split('?')[0];
            if (pathPart.match(/\.(mp3|m4a|mp4|aac|ogg|wav|mkv|webm|flac|opus|m4v|mov|pdf|html|htm|xml|txt|bin)$/i) || lowerImg.includes('.mp3') || lowerImg.includes('.m4a') || lowerImg.includes('.mp4')) {
              item.imageUrl = undefined;
            }
          }

          if (!item.imageUrl && (isPodcast || checkIsPodcastFeed(data, item)) && secureFeedImage) {
            item.imageUrl = secureFeedImage;
          }
          
          if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('http://')) {
            item.imageUrl = item.imageUrl.replace('http://', 'https://');
          }

          if (item.imageUrl) {
            item.imageUrl = proxyImageUrl(item.imageUrl);
          }
        });
      }
      return data;
    }

    if (!shouldBypass && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return applyDeepDecodeToItems(cached.data);
    }

    // Try to read Firestore cache. Prefer Admin SDK for Node consistency but handle permission errors quietly.
    const dbAdmin = getDbAdmin();
    if (!shouldBypass && dbAdmin) {
      try {
        const cacheDoc = await dbAdmin.collection('publicRssCache').doc(cacheId).get();
        if (cacheDoc.exists) {
          const cacheData = cacheDoc.data();
          if (cacheData && cacheData.updatedAt) {
            const age = Date.now() - cacheData.updatedAt;
            const data = JSON.parse(cacheData.data);
            
            // If the cache is fresh (under 15 minutes), return it instantly
            if (age < 15 * 60 * 1000) {
              rssCache.set(cacheKey, { data, timestamp: cacheData.updatedAt });
              return applyDeepDecodeToItems(data);
            }
            
            // Stale-While-Revalidate: If cache is older than 15 mins but under 30 minutes,
            // serve it instantly for a sub-second page load and fetch fresh data in background!
            if (age < 30 * 60 * 1000) {
              rssCache.set(cacheKey, { data, timestamp: cacheData.updatedAt });
              
              console.log(`[Stale-While-Revalidate] Serving cached data (age: ${Math.round(age / 1000 / 60)}m) and refreshing in background for URL: ${url}`);
              parseFeedWithLogic(url, maxDays, true).catch((e) => {
                console.warn(`[Stale-While-Revalidate] Background refresh failed for URL ${url}:`, e.message);
              });
              
              return applyDeepDecodeToItems(data);
            }
          }
        }
      } catch (err: any) {
        // Fallback to Client SDK on Admin failure (likely PERMISSION_DENIED)
        const clientDb = getDbClient();
        if (clientDb) {
          try {
            const snap = await getDoc(doc(clientDb, 'publicRssCache', cacheId));
            if (snap.exists()) {
              const cacheData = snap.data();
              if (cacheData && cacheData.updatedAt) {
                const age = Date.now() - cacheData.updatedAt;
                const data = JSON.parse(cacheData.data);
                
                if (age < 15 * 60 * 1000) {
                  rssCache.set(cacheKey, { data, timestamp: cacheData.updatedAt });
                  return applyDeepDecodeToItems(data);
                }
                
                if (age < 30 * 60 * 1000) {
                  rssCache.set(cacheKey, { data, timestamp: cacheData.updatedAt });
                  console.log(`[Stale-While-Revalidate] [Client DB] Serving cached data (age: ${Math.round(age / 1000 / 60)}m) and refreshing in background for URL: ${url}`);
                  parseFeedWithLogic(url, maxDays, true).catch(() => {});
                  return applyDeepDecodeToItems(data);
                }
              }
            }
          } catch (clientErr: any) {
          }
        }
      }
    }
    
    let finalUrl = url;
    if (finalUrl === "https://winfuture.de/rss/feed.xml") {
       finalUrl = "https://static.winfuture.de/feeds/WinFuture-News-rss2.0.xml";
    }

    // Dynamic URL Redirect Mapping for failing/expired/renamed public feeds
    const urlRedirects: Record<string, string> = {
      'https://doppelgaenger.podigee.io/feed/mp3': 'https://www.doppelgaenger.io/feed/podcast',
      'https://doppelgaenger.podigee.io/feed/mp3/': 'https://www.doppelgaenger.io/feed/podcast',
      'https://feeds.redcircle.com/f04495e8-5b1b-4835-be00-11b2ff88fe64': 'https://cienciaes.com/feed/',
      'https://feeds.redcircle.com/f04495e8-5b1b-4835-be00-11b2ff88fe64/': 'https://cienciaes.com/feed/',
      'https://feeds.acast.com/public/shows/entiende-tu-mente': 'https://entiendetumente.info/feed/podcast',
      'https://feeds.acast.com/public/shows/entiende-tu-mente/': 'https://entiendetumente.info/feed/podcast',
      'https://feeds.redcircle.com/64b1d61a-05a8-444f-8cf5-c7e63b361bb5': 'https://www.laescobula.com/feed/',
      'https://feeds.redcircle.com/64b1d61a-05a8-444f-8cf5-c7e63b361bb5/': 'https://www.laescobula.com/feed/',
      'https://feeds.acast.com/public/shows/la-ruina': 'https://www.laescobula.com/feed/',
      'https://feeds.acast.com/public/shows/la-ruina/': 'https://www.laescobula.com/feed/',
      'https://steingarts-morning-briefing.podigee.io/feed/mp3': 'https://apokalypse-und-filterkaffee.podigee.io/feed/mp3',
      'https://steingarts-morning-briefing.podigee.io/feed/mp3/feed/': 'https://apokalypse-und-filterkaffee.podigee.io/feed/mp3',
      'https://servus-gruezi-hallo.podigee.io/feed/mp3': 'https://was-jetzt.podigee.io/feed/mp3',
      'https://krautreporter.de/feed.rss': 'https://uebermedien.de/feed/',
      'https://www.deutschlandfunk.de/hintergrund-104.xml': 'https://www.deutschlandfunk.de/podcast-hintergrund.xml',
      'https://www.deutschlandfunk.de/hintergrund-104.xml/feed/': 'https://www.deutschlandfunk.de/podcast-hintergrund.xml',
      'https://www.br.de/mediathek/podcast/radiowissen/508': 'https://xml.br.de/podcast/radiowissen/cast.xml',
      'https://www.br.de/mediathek/podcast/radiowissen/508/feed/': 'https://xml.br.de/podcast/radiowissen/cast.xml',
      'https://www1.wdr.de/radio/podcasts/wdr2/joerg-thadeusz-102.podcast': 'https://www1.wdr.de/mediathek/audio/wdr2/wdr2-thadeusz/joerg-thadeusz-102.podcast',
      'https://www1.wdr.de/radio/podcasts/wdr2/joerg-thadeusz-102.podcast/feed/': 'https://www1.wdr.de/mediathek/audio/wdr2/wdr2-thadeusz/joerg-thadeusz-102.podcast',
      'https://www.blick.ch/rss.xml': 'https://www.blick.ch/news/rss.xml',
      'https://www.blick.ch/rss.xml/feed/': 'https://www.blick.ch/news/rss.xml',
      'https://www.blick.ch/rss.xml/feed': 'https://www.blick.ch/news/rss.xml',
      'https://blick.ch/rss.xml': 'https://www.blick.ch/news/rss.xml',
      'https://blick.ch/rss.xml/feed/': 'https://www.blick.ch/news/rss.xml',
      'https://blick.ch/rss.xml/feed': 'https://www.blick.ch/news/rss.xml'
    };

    if (urlRedirects[finalUrl]) {
      console.log(`[RSS Redirect] Mapping legacy/broken feed URL ${finalUrl} to ${urlRedirects[finalUrl]}`);
      finalUrl = urlRedirects[finalUrl];
    }
    
    let isYouTubeUrl = finalUrl.includes("youtube.com") || finalUrl.includes("youtu.be");
    
    try {
      if (isYouTubeUrl && !finalUrl.includes("videos.xml")) {
        const match = finalUrl.match(/youtube\.com\/(?:@|c\/|user\/|channel\/)([^/?]+)/i);
        if (match) {
          const pathType = finalUrl.includes("/channel/") ? "channel" : "handle";
          if (pathType === "channel") {
            finalUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${match[1]}`;
          } else {
            let resolved = false;
            // 1. Prioritize scraping the exact URL to perfectly resolve handles (e.g. @The_Entert_AI_ner)
            try {
               const htmlRes = await fetch(finalUrl, {
                 headers: {
                   'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                 }
               });
               const html = await htmlRes.text();
               const channelIdMatch = html.match(/"externalId":"(UC[^"]+)"/) || html.match(/"channelId":"(UC[^"]+)"/);
               if (channelIdMatch) {
                 finalUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`;
                 resolved = true;
               }
            } catch(e) { console.error("YouTube Scrape error", e); }
            
            // 2. Fallback to API search if scraping fails and apiKey is available
            if (!resolved) {
              const apiKey = (
                process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || 
                process.env.YOUTUBE_API_KEY || 
                process.env.VITE_YOUTUBE_API_KEY ||
                ""
              ).trim();
              if (apiKey) {
                 try {
                   // For handles, we can try to search with exact handle if it starts with @, else just the snippet text
                   const qParam = finalUrl.includes('@') ? `%40${encodeURIComponent(match[1])}` : encodeURIComponent(match[1]);
                   const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${qParam}&key=${apiKey}`, {
                     headers: { 
                    'Referer': 'https://rsser.news/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                  }
                   });
                   const data = await searchRes.json() as any;
                   if (data.items && data.items.length > 0) {
                     finalUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${data.items[0].snippet.channelId}`;
                     resolved = true;
                   } else if (data.error) {
                     if (!data.error.message?.includes("API key not valid")) {
                       const msg = data.error.message || "Unknown error";
                       console.warn("YouTube API search error or quota reached:", msg);
                       addSystemAlert('youtube_quota', `YouTube API Search Error. Possible Quota Exceeded. Details: ${msg}`);
                     }
                   }
                 } catch(e) { console.error("YouTube API error", e); }
              }
            }
          }
        } else if (finalUrl.includes("watch?v=") || finalUrl.includes("youtu.be/")) {
           try {
              const htmlRes = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                }
              });
              const html = await htmlRes.text();
              const channelIdMatch = html.match(/"externalId":"(UC[^"]+)"/) || html.match(/"channelId":"(UC[^"]+)"/);
              if (channelIdMatch) {
                finalUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`;
              }
           } catch(e) { console.error("YouTube Scrape error for watch URL", e); }
        }
      }

      // Check if we still have a non-XML YouTube URL
      if (isYouTubeUrl && !finalUrl.includes('feeds/videos.xml')) {
         throw new Error("Could not resolve YouTube Channel ID. Please ensure the URL is correct.");
      }
      
      let xml = '';
      
      const tryFetchUrl = async (urlToFetch: string): Promise<string> => {
        // High-compatibility User-Agents (Firefox, Safari, Feedfetcher, Chrome)
        const userAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
          'Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Mozilla/5.0 (compatible; RSSerNews/1.0; +https://rsser.news; FeedFetcher)'
        ];

        let lastErr: any = null;

        for (let i = 0; i < userAgents.length; i++) {
          const ua = userAgents[i];
          const fetchOptions: RequestInit = {
            headers: {
              'Accept': 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
              'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Connection': 'close'
            }
          };

          if (ua) {
            (fetchOptions.headers as any)['User-Agent'] = ua;
          }

          if (urlToFetch.includes('20min.ch')) {
            (fetchOptions.headers as any)['Referer'] = 'https://www.20min.ch/';
            (fetchOptions.headers as any)['Cookie'] = 'top_nav_search_interaction=true;';
          }

          const controller = new AbortController();
          const mainTimeout = setTimeout(() => controller.abort(), 6000); // 6s timeout per direct attempt
          fetchOptions.signal = controller.signal;

          try {
            const response = await fetch(urlToFetch, fetchOptions);
            clearTimeout(mainTimeout);

            if (!response.ok) {
              if (response.status === 404) {
                throw new Error(`Status code 404`);
              }
              throw new Error(`Status code ${response.status}`);
            }
            return await response.text();
          } catch (e: any) {
            clearTimeout(mainTimeout);
            lastErr = e;

            // Fast-break to proxies if connection refused, not found, or timeout
            const errMsg = e.message || '';
            const causeCode = e.cause?.code || '';
            const causeMessage = e.cause?.message || '';
            if (
              errMsg.includes('404') ||
              errMsg.includes('ENOTFOUND') ||
              errMsg.includes('ECONNREFUSED') ||
              errMsg.includes('AggregateError') ||
              causeCode === 'ECONNREFUSED' ||
              causeCode === 'ENOTFOUND' ||
              causeMessage.includes('ECONNREFUSED') ||
              causeMessage.includes('ENOTFOUND')
            ) {
              break;
            }
          }
        }

        // If direct fetch threw connection refused or 404, skip node https module and jump directly to proxies
        const lastMsg = lastErr?.message || '';
        const shouldTryHttpsModule = !lastMsg.includes('404') && !lastMsg.includes('ECONNREFUSED') && !lastMsg.includes('ENOTFOUND');

        if (shouldTryHttpsModule) {
          try {
            return await fetchWithHttpsModule(urlToFetch);
          } catch (fallbackErr: any) {
            // fall through to proxies
          }
        }

        // Try resilient proxies to bypass bot-detection / CDN blocks!
        return await tryProxies(urlToFetch);
      };

      const tryProxies = async (urlToFetch: string): Promise<string> => {
        const proxies = [
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(urlToFetch)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(urlToFetch)}`,
          `https://api.allorigins.win/get?url=${encodeURIComponent(urlToFetch)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(urlToFetch)}`,
          `https://r.jina.ai/${urlToFetch}`
        ];
 
        let lastErr: any = null;
        for (const proxyUrl of proxies) {
          try {
            const pController = new AbortController();
            const pTimeout = setTimeout(() => pController.abort(), 6500); // 6.5s timeout per proxy
            
            const headers: Record<string, string> = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
              'Accept': '*/*',
              'Connection': 'close'
            };
            
            const proxyResponse = await fetch(proxyUrl, {
              signal: pController.signal,
              headers: headers
            });
            
            clearTimeout(pTimeout);
            
            if (proxyResponse.ok) {
              const text = await proxyResponse.text();
              let content = text;
              if (proxyUrl.includes('allorigins.win/get')) {
                try {
                  const json = JSON.parse(text);
                  content = json.contents;
                } catch(e) { content = text; }
              } 
              
              if (proxyUrl.includes('r.jina.ai')) {
                try {
                  // Check if Jina returned raw JSON or Markdown text
                  const trimmed = text.trim();
                  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    const json = JSON.parse(trimmed);
                    if (json.content) {
                      const xmlConverted = convertJinaMarkdownToRssXml(json.title, json.description, urlToFetch, json.content);
                      if (xmlConverted && xmlConverted.includes('<item>')) {
                        return xmlConverted;
                      }
                    }
                  }
                  const xmlConverted = convertJinaMarkdownToRssXml("Feed", "Bypassed Feed", urlToFetch, text);
                  if (xmlConverted && xmlConverted.includes('<item>')) {
                    return xmlConverted;
                  }
                } catch (e) {}
              }
              
              if (content) {
                const trimmed = content.trim();
                // If it is JSON, check if it contains rss2json format
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.status === 'ok' && parsed.feed && parsed.items && parsed.items.length > 0) {
                      return convertRss2JsonToXml(trimmed);
                    }
                    if (parsed.error || parsed.message || parsed.success === false || parsed.contents === null) {
                      continue;
                    }
                  } catch (e) {}
                }
                if (trimmed.includes('<?xml') || trimmed.includes('<rss') || trimmed.includes('<feed') || trimmed.includes('<channel')) {
                  return content;
                }
              }
            }
          } catch (proxyErr: any) {
            lastErr = proxyErr;
          }
        }
        throw lastErr || new Error("All proxies failed for " + urlToFetch);
      };

      const isHtml = (content: string): boolean => {
        const trimmed = content.trim().substring(0, 500).toLowerCase();
        return trimmed.includes('<!doctype html') || trimmed.includes('<html') || trimmed.includes('<head') || trimmed.includes('<body');
      };

      let attemptUrl = finalUrl;
      let fetchedContent = '';
      let fetchSuccess = false;
      let lastErrorMsg = '';

      // 1. Try to fetch the URL directly
      try {
        fetchedContent = await tryFetchUrl(attemptUrl);
        fetchSuccess = true;
      } catch (err: any) {
        lastErrorMsg = err.message;
        // 2. If direct fetch fails, try proxies
        try {
          fetchedContent = await tryProxies(attemptUrl);
          fetchSuccess = true;
        } catch (proxyErr: any) {
          lastErrorMsg = proxyErr.message;
          // 3. Fallback: try appending "/feed" or "/feed/" to see if we can rescue
          try {
            const urlObj = new URL(attemptUrl);
            if (!urlObj.pathname.endsWith('/feed') && !urlObj.pathname.endsWith('/feed/') && !urlObj.pathname.endsWith('/rss')) {
              const fallbackUrl = attemptUrl.endsWith('/') ? `${attemptUrl}feed/` : `${attemptUrl}/feed/`;
              try {
                fetchedContent = await tryFetchUrl(fallbackUrl);
                attemptUrl = fallbackUrl;
                finalUrl = fallbackUrl;
                fetchSuccess = true;
              } catch (fErr: any) {
                fetchedContent = await tryProxies(fallbackUrl);
                attemptUrl = fallbackUrl;
                finalUrl = fallbackUrl;
                fetchSuccess = true;
              }
            }
          } catch (fallbackErr: any) {
            // Keep original error
          }
        }
      }

      if (!fetchSuccess) {
        console.error(`RSS Fetch Critical Failure for ${finalUrl}: ${lastErrorMsg}`);
        throw new Error(`All fetch methods failed for ${finalUrl} (Last error: ${lastErrorMsg})`);
      }

      // 4. If fetched content is HTML, try Auto-Discovery
      if (isHtml(fetchedContent)) {
        const matchRss = fetchedContent.match(/<link[^>]+type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i) ||
                         fetchedContent.match(/<link[^>]+href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i);
        const matchAtom = fetchedContent.match(/<link[^>]+type=["']application\/atom\+xml["'][^>]*href=["']([^"']+)["']/i) ||
                          fetchedContent.match(/<link[^>]+href=["']([^"']+)["'][^>]*type=["']application\/atom\+xml["']/i);
        let discoveredFeedUrl = matchRss ? matchRss[1] : (matchAtom ? matchAtom[1] : null);

        if (discoveredFeedUrl) {
          discoveredFeedUrl = discoveredFeedUrl.replace(/&amp;/g, '&');
          if (!discoveredFeedUrl.startsWith('http://') && !discoveredFeedUrl.startsWith('https://')) {
            try {
              discoveredFeedUrl = new URL(discoveredFeedUrl, attemptUrl).toString();
            } catch (e) {
              // ignore
            }
          }
          
          console.log(`[RSS AutoDiscover] Discovered alternate feed URL: ${discoveredFeedUrl} inside HTML of ${attemptUrl}`);
          try {
            fetchedContent = await tryFetchUrl(discoveredFeedUrl);
            attemptUrl = discoveredFeedUrl;
            finalUrl = discoveredFeedUrl;
          } catch (err: any) {
            try {
              fetchedContent = await tryProxies(discoveredFeedUrl);
              attemptUrl = discoveredFeedUrl;
              finalUrl = discoveredFeedUrl;
            } catch (proxyErr: any) {
              console.error(`[RSS AutoDiscover] Alternate url fetch failed: ${proxyErr.message}`);
            }
          }
        }

        // 5. If STILL HTML, try common subpaths as a last resort
        if (isHtml(fetchedContent)) {
          try {
            const urlObj = new URL(attemptUrl);
            if (!urlObj.pathname.endsWith('/feed') && !urlObj.pathname.endsWith('/feed/') && !urlObj.pathname.endsWith('/rss')) {
              const fallbackUrl = attemptUrl.endsWith('/') ? `${attemptUrl}feed/` : `${attemptUrl}/feed/`;
              console.log(`[RSS AutoDiscover] HTML returned with no alternate link. Trying fallback subpath: ${fallbackUrl}`);
              try {
                fetchedContent = await tryFetchUrl(fallbackUrl);
                attemptUrl = fallbackUrl;
                finalUrl = fallbackUrl;
              } catch (fallbackErr: any) {
                fetchedContent = await tryProxies(fallbackUrl);
                attemptUrl = fallbackUrl;
                finalUrl = fallbackUrl;
              }
            }
          } catch (e: any) {
            // ignore
          }
        }

        // Final check
        if (isHtml(fetchedContent)) {
          throw new Error("Received HTML webpage instead of XML feed. Please use a direct feed URL.");
        }
      }

      xml = fetchedContent;

      // Ensure the content looks like XML and isn't plain text or mock error returned by proxies
      const trimmedXml = xml.trim();
      if (!trimmedXml.startsWith('<')) {
        throw new Error("Response is not valid XML. Received plain text instead of XML feed.");
      }
      
      let feed;
      try {
        // Specialized cleaning for common RSS issues (BOM, leading whitespace, etc)
        let cleanedXmlForParsing = xml.trim().replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '').replace(/^[^<]*/, '');
        
        // 20min.ch and others often have unencoded & characters that break XML parsers
        if (xml.includes('20min.ch') || xml.includes('content:encoded') || xml.includes('<![CDATA[')) {
          // Replace & that are not followed by a known entity or #
          cleanedXmlForParsing = cleanedXmlForParsing.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, '&amp;');
        }
        feed = await parser.parseString(cleanedXmlForParsing);
      } catch (parseErr: any) {
        console.error(`[RSS Parser] Initial parse failed for ${finalUrl}:`, parseErr.message);
        
        // Second attempt with even more aggressive cleaning if it looks like XML
        try {
          const aggressiveClean = xml.substring(xml.indexOf('<')).trim();
          if (aggressiveClean.startsWith('<')) {
            feed = await parser.parseString(aggressiveClean);
            console.log(`[RSS Parser] Successful recovery for ${finalUrl} after aggressive cleaning`);
          } else {
             throw parseErr;
          }
        } catch (retryErr) {
          if (xml.includes('20min.ch')) {
             console.error("[RSS Parser] 20min.ch specialized failure. XML length:", xml.length);
          }
          throw parseErr;
        }
      }
      
      // Deduplicate items early
      if (feed && feed.items) {
        const seen = new Set<string>();
        feed.items = feed.items.filter(item => {
          const id = item.guid || item.link;
          if (id && !seen.has(id)) {
            seen.add(id);
            return true;
          }
          return !id;
        });

        // Determine slice parameters
        const filterMaxDays = maxDays; 
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - filterMaxDays);
        
        const isPodcastInner = checkIsPodcastFeed(feed) || feed.items.some(item => checkIsPodcastFeed(feed, item));
        (feed as any).isPodcast = isPodcastInner;
        
        const isYTInner = finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be');

        // Filter and slice items BEFORE deep decoding to save performance on large feeds
        let itemsForProcessing = feed.items || [];
        
        // Filter out items without titles, empty titles, or 'Ohne Titel' early to clean up live tickers/empty entries
        itemsForProcessing = itemsForProcessing.filter(item => {
          return item && item.title && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.trim().toLowerCase() !== 'ohne titel';
        });

        if (isPodcastInner || isYTInner) {
          itemsForProcessing = itemsForProcessing.slice(0, 30); 
        } else {
          itemsForProcessing = itemsForProcessing.filter(item => {
            const dateStr = item.pubDate || item.isoDate;
            if (!dateStr) return true;
            const itemDate = new Date(dateStr);
            return isNaN(itemDate.getTime()) || itemDate >= cutoffDate;
          }).slice(0, 200);
        }

        // Only process metadata for the items we're actually going to return
        itemsForProcessing.forEach((item: any) => {
          item.title = deepDecode(item.title || 'Ohne Titel');
          item.contentSnippet = deepDecode(item.contentSnippet);
          item.description = deepDecode(item.description);
          item.summary = deepDecode(item.summary);
          if (item.content) item.content = decodeHTML(item.content);
          if (item.contentEncoded) item.contentEncoded = decodeHTML(item.contentEncoded);

          let dateStr = item.pubDate || item.isoDate;
          if (!dateStr) {
            item.pubDate = new Date().toISOString();
          } else {
            const d = new Date(dateStr);
            item.pubDate = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          }
          item.isoDate = item.pubDate;
        });

        feed.items = itemsForProcessing;
      }
      
      const isPodcast = (feed as any).isPodcast || checkIsPodcastFeed(feed);
      let items = feed.items;
      
      // Enhance items with images in parallel (fetch first 30 items for rich preview coverage - faster load)
      const IMAGE_FETCH_LIMIT = 30;
      const itemsToEnhance = items.slice(0, IMAGE_FETCH_LIMIT);
      const remainingItems = items.slice(IMAGE_FETCH_LIMIT);

      // Collect YouTube video IDs for batch fetching
      const ytVideoIds: string[] = [];
      const apiKey = (
        process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || 
        process.env.YOUTUBE_API_KEY || 
        process.env.VITE_YOUTUBE_API_KEY ||
        ""
      ).trim();
      
        itemsToEnhance.forEach(item => {
          const getSafeString = (val: any): string => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            if (val._) return val._;
            if (val.$t) return val.$t;
            return String(val);
          };
          const idStr = getSafeString((item as any).id);
          const id = item.videoId || idStr.match(/yt:video:([a-zA-Z0-9_-]{11})/)?.[1];
          if (id) {
            ytVideoIds.push(id);
            if (!item.videoId) item.videoId = id;
          } else {
            const link = getSafeString(item.link);
            if (link && (link.includes('youtube.com') || link.includes('youtu.be'))) {
              const videoIdMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
              if (videoIdMatch && videoIdMatch[1]) {
                ytVideoIds.push(videoIdMatch[1]);
                item.videoId = videoIdMatch[1]; // Store for convenience
              }
            }
          }
        });

      const ytThumbnails = apiKey ? await fetchYouTubeVideoDetails(ytVideoIds, apiKey) : {};

      const feedImage = (feed.itunes && (feed.itunes as any).image) || (feed.image && (feed.image as any).url) || (feed as any).imageUrl || null;
      let secureFeedImage = typeof feedImage === 'string' ? feedImage : null;
      if (secureFeedImage && secureFeedImage.startsWith('http://')) {
        secureFeedImage = secureFeedImage.replace('http://', 'https://');
      }
      
      const feedUrlStr = (feed.feedUrl || finalUrl || '').toLowerCase();
      const feedTitleStr = (feed.title || '').toLowerCase();
      const isHardcodedITunes = (img: any) => typeof img === 'string' && img.includes('mza_11977799580453303866');
      const needsCoverOverride2 = !secureFeedImage || isHardcodedITunes(secureFeedImage) || isHardcodedITunes(feed.image?.url);
      
      if (needsCoverOverride2 && (feedUrlStr.includes('bitsundso') || feedUrlStr.includes('bits-und-so') || feedTitleStr.includes('bits und so'))) {
         const customCover = getBitsUndSoCover();
         secureFeedImage = customCover;
         feed.image = { url: customCover };
      }
      
      const enhancedItems = await Promise.all(itemsToEnhance.map(async (item, i) => {
        try {
          let imageUrl = extractImageLocally(item);
          
          // Use YouTube API image if available
          const vidId = item.videoId;
          if (vidId && ytThumbnails[vidId]) {
            imageUrl = ytThumbnails[vidId];
          }
          
          // If no local image found, check memory cache for OG image.
          // Fetch from internet by awaiting it. Because UI is now fully decoupled
          // and non-blocking (shows stale cache instantly), we can safely block the backend sync
          // to guarantee the images are fully fetched before returning!
          if (!imageUrl && item.link) {
            if (ogImageCache.has(item.link)) {
              imageUrl = ogImageCache.get(item.link);
            } else {
              imageUrl = await fetchOgImage(item.link).catch(() => undefined);
            }
          }
          
          // Fallback to feed image if no image found (ONLY for podcasts, videos, or audio channels to prevent stretching generic feed logos on normal stories)
          const isAudioOrVideoFeed = isPodcast || isYouTubeUrl || checkIsPodcastFeed(feed, item);
          if (!imageUrl && isAudioOrVideoFeed && secureFeedImage) {
            imageUrl = secureFeedImage;
          }

          if (imageUrl && imageUrl.startsWith('http://')) {
            imageUrl = imageUrl.replace('http://', 'https://');
          }

          return { ...item, imageUrl };
        } catch (e) {
          console.error(`Error enhancing item ${i}:`, e);
          return item;
        }
      }));

      // Process remaining items (only local extraction and fallbacks, no network fetch for OG)
      const processedRemaining = remainingItems.map(item => {
        let imageUrl = extractImageLocally(item);
        const isAudioOrVideoFeed = isPodcast || isYouTubeUrl || checkIsPodcastFeed(feed, item);
        if (!imageUrl && isAudioOrVideoFeed && secureFeedImage) {
          imageUrl = secureFeedImage;
        }
        if (imageUrl && imageUrl.startsWith('http://')) {
          imageUrl = imageUrl.replace('http://', 'https://');
        }
        return { ...item, imageUrl };
      });

      feed.items = [...enhancedItems, ...processedRemaining];
      
      // Try to get channel avatar if it's YouTube
      if (isYouTubeUrl && feed.link) {
         let fetchedFromApi = false;
         const apiKey = (
           process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || 
           process.env.YOUTUBE_API_KEY || 
           process.env.VITE_YOUTUBE_API_KEY ||
           ""
         ).trim();
         if (apiKey) {
           try {
             const ytMatch = finalUrl.match(/channel_id=([^&]+)/);
             if (ytMatch) {
               const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&id=${ytMatch[1]}&key=${apiKey}`, {
                 headers: { 'Referer': 'https://rsser.news/' }
               });
               if (searchRes.ok) {
                 const data = await searchRes.json() as any;
                 if (data.items && data.items.length > 0) {
                   const snippet = data.items[0].snippet;
                   const branding = data.items[0].brandingSettings;
                   feed.image = feed.image || { url: snippet.thumbnails?.default?.url || snippet.thumbnails?.high?.url };
                   (feed as any).bannerUrl = branding?.image?.bannerExternalUrl;
                   fetchedFromApi = true;
                 }
               }
             }
           } catch(e) { console.error("YouTube Channel API error", e); }
         } 
         
         if (!fetchedFromApi) {
             // fallback web scraper (low priority, fast timeout)
             try {
               const controller = new AbortController();
               const tid = setTimeout(() => controller.abort(), 3500);
               const htmlRes = await fetch(feed.link, {
                 headers: {
                   'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                 },
                 signal: controller.signal
               });
               clearTimeout(tid);
               if (htmlRes.ok) {
                 const html = await htmlRes.text();
                 
                 const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)","width":\d+,"height":\d+}\]}/);
                 if (avatarMatch) { feed.image = { url: avatarMatch[1] }; }
                 else {
                   const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
                   if (ogImageMatch) { feed.image = { url: ogImageMatch[1] }; }
                 }
                 
                 const bannerMatch = html.match(/"banner":{"thumbnails":\[{"url":"([^"]+)","width":\d+,"height":\d+}\]}/);
                 if (bannerMatch) { (feed as any).bannerUrl = bannerMatch[1]; }
                 else {
                    const bannerMatch2 = html.match(/"banner":\{"imageBannerViewModel":\{"image":\{"sources":\[\{"url":"([^"]+)"/);
                    if (bannerMatch2) { (feed as any).bannerUrl = bannerMatch2[1]; }
                    else {
                       const headerMatch = html.match(/"headerBanner":{"image":{"thumbnails":\[{"url":"([^"]+)"/);
                       if (headerMatch) { (headerMatch[1]) && ((feed as any).bannerUrl = headerMatch[1]); }
                    }
                 }
               }
             } catch(e) { console.error("YouTube fallback scrape error", e); }
         }
      }

      const originalImageUrl = (feed.itunes && (feed.itunes as any).image) || (feed.image && (feed.image as any).url) || null;
      let secureOriginalImageUrl = originalImageUrl;
      if (secureOriginalImageUrl && secureOriginalImageUrl.startsWith('http://')) {
        secureOriginalImageUrl = secureOriginalImageUrl.replace('http://', 'https://');
      }
      if (secureOriginalImageUrl && (!feed.image || !(feed.image as any).url)) {
        feed.image = feed.image || {};
        (feed.image as any).url = secureOriginalImageUrl;
      }
      if (feed.image && (feed.image as any).url && (feed.image as any).url.startsWith('http://')) {
        (feed.image as any).url = (feed.image as any).url.replace('http://', 'https://');
      }

      const finalData = Object.assign({}, feed, { image: feed.image, originalImageUrl, bannerUrl: (feed as any).bannerUrl });
      
      // Apply image proxying to prevent CORS/hotlinking blocks on clients
      if (finalData.image && finalData.image.url) {
        finalData.image.url = proxyImageUrl(finalData.image.url);
      }
      if (finalData.originalImageUrl) {
        finalData.originalImageUrl = proxyImageUrl(finalData.originalImageUrl);
      }
      if (finalData.items) {
        finalData.items = finalData.items.map((item: any) => {
          if (item.imageUrl) {
            item.imageUrl = proxyImageUrl(item.imageUrl);
          }
          return item;
        });
      }

      const processedData = applyDeepDecodeToItems(finalData);

      const now = Date.now();
      rssCache.set(cacheKey, { data: processedData, timestamp: now });
      
      // Update global Firestore cache from server (throttled)
      const clientDb = getDbClient();
      const dbAdmin = getDbAdmin();
      
      // Safely serialize to avoid Firestore document limits (1MB)
      let serializedData = "";
      try {
        let cacheItemsCount = 40;
        let dataToSerialize = { ...processedData };
        while (cacheItemsCount > 5) {
          if (processedData.items) {
            dataToSerialize.items = processedData.items.slice(0, cacheItemsCount).map((item: any) => {
              const newItem = { ...item };
              if (newItem.content && newItem.content.length > 15000) {
                newItem.content = newItem.content.substring(0, 15000) + '... [truncated]';
              }
              if (newItem.contentEncoded && newItem.contentEncoded.length > 15000) {
                newItem.contentEncoded = newItem.contentEncoded.substring(0, 15000) + '... [truncated]';
              }
              return newItem;
            });
          }
          const testStr = JSON.stringify(dataToSerialize);
          if (testStr.length < 800000) {
            serializedData = testStr;
            break;
          }
          cacheItemsCount -= 5;
        }
        if (!serializedData) {
          serializedData = JSON.stringify({ ...processedData, items: [] });
        }
      } catch (serializeErr) {
        console.error("Error minifying cache data:", serializeErr);
        serializedData = JSON.stringify({ ...processedData, items: [] });
      }

      const cachePayload = {
        url: url,
        data: serializedData,
        updatedAt: now
      };

      if (clientDb) {
        setDoc(doc(clientDb, 'publicRssCache', cacheId), cachePayload).catch(() => {});
      } else if (dbAdmin) {
        dbAdmin.collection('publicRssCache').doc(cacheId).set(cachePayload).catch(() => {});
      }

      return processedData;
    } catch (error: any) {
      console.warn(`[RSS Fallback] Fetch/Parse failed for URL ${url}. Searching cache fallback... Error: ${error.message}`);
      
      // 1. Try Memory cache first
      if (cached) {
        console.log(`[RSS Fallback] Successfully served stale memory cache for URL: ${url}`);
        return applyDeepDecodeToItems(cached.data);
      }
      
      // 2. Try Firestore cache (any age is acceptable since the feed is offline)
      const dbAdmin = getDbAdmin();
      if (dbAdmin) {
        try {
          const cacheDoc = await dbAdmin.collection('publicRssCache').doc(cacheId).get();
          if (cacheDoc.exists) {
            const cacheData = cacheDoc.data();
            if (cacheData && cacheData.data) {
              const data = JSON.parse(cacheData.data);
              rssCache.set(cacheKey, { data, timestamp: cacheData.updatedAt || Date.now() });
              console.log(`[RSS Fallback] Successfully served stale Firestore (Admin) cache for URL: ${url}`);
              return applyDeepDecodeToItems(data);
            }
          }
        } catch (dbErr) {
          // ignore and fall through to Client SDK fallback
        }
      }
      
      const clientDb = getDbClient();
      if (clientDb) {
        try {
          const snap = await getDoc(doc(clientDb, 'publicRssCache', cacheId));
          if (snap.exists()) {
            const cacheData = snap.data();
            if (cacheData && cacheData.data) {
              const data = JSON.parse(cacheData.data);
              rssCache.set(cacheKey, { data, timestamp: cacheData.updatedAt || Date.now() });
              console.log(`[RSS Fallback] Successfully served stale Firestore (Client) cache for URL: ${url}`);
              return applyDeepDecodeToItems(data);
            }
          }
        } catch (clientDbErr) {
          // ignore
        }
      }

      // 3. Fallback: return a clean placeholder feed structure so the app doesn't break
      console.error(`[RSS Fallback] No cached data available for unreachable URL: ${url}. Returning empty fallback feed.`);
      const domain = url.replace(/^https?:\/\//, '').split('/')[0] || "Feed";
      const fallbackFeed = {
        title: domain,
        feedUrl: url,
        url: url,
        description: "Dieses Feed ist vorübergehend nicht erreichbar oder offline.",
        items: [],
        image: { url: "https://rsser.news/RSSerLogo.png" }
      };
      return fallbackFeed;
    }
  }

  // Background crawler function to preload active user feeds in the background
  function startBackgroundCrawler() {
    console.log("[Crawler] Background crawler initialized.");
    
    setInterval(async () => {
      try {
        const now = Date.now();
        // Crawl any feeds requested in the last 45 minutes to keep things fully active and fast
        const activeFeeds = Array.from(activeFeedsToCrawler.values()).filter(
          (f) => now - f.lastRequested < 45 * 60 * 1000
        );

        if (activeFeeds.length === 0) return;
        console.log(`[Crawler] Starting background crawl of ${activeFeeds.length} active feeds...`);

        // Crawl up to 3 feeds at a time to be lightweight
        const concurrency = 3;
        for (let i = 0; i < activeFeeds.length; i += concurrency) {
          const chunk = activeFeeds.slice(i, i + concurrency);
          await Promise.all(
            chunk.map(async (f) => {
              try {
                // Fetch fresh from source to keep cache hot
                await parseFeedWithLogic(f.url, f.maxDays, true);
                console.log(`[Crawler] Keep-Fresh updated feed: ${f.url}`);
              } catch (err: any) {
                console.error(`[Crawler] Keep-Fresh failed for feed ${f.url}:`, err.message);
              }
            })
          );
          // Small delay to pace the crawler nicely
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
        console.log(`[Crawler] Background crawl round finished.`);
      } catch (crawlerErr: any) {
        console.error(`[Crawler] Error in background crawler interval:`, crawlerErr.message);
      }
    }, 6 * 60 * 1000); // Crawl active feeds every 6 minutes
  }

  app.post("/api/rss", async (req, res) => {
    const { url, force, bypassCache } = req.body;
    const shouldBypass = force === true || bypassCache === true;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    
    const maxDays = req.body.maxDays || 30;
    
    // Register feed as active so our background crawler keeps it perfectly hot
    activeFeedsToCrawler.set(url, { url, maxDays, lastRequested: Date.now() });

    try {
      const data = await parseFeedWithLogic(url, maxDays, shouldBypass);
      res.json(data);
    } catch (error: any) {
      console.error("RSS route endpoint error for URL:", url, error);
      res.status(500).json({ error: "Failed to parse RSS feed", details: error.message, url: url });
    }
  });

  // --- URL SHORTENER & TRACKING API ---
  app.post("/api/shorten", async (req, res) => {
    const { originalUrl, blogId, userId } = req.body;
    if (!originalUrl || !blogId || !userId) {
      return res.status(400).json({ error: "Missing required fields: originalUrl, blogId, userId" });
    }
    
    try {
      const dbAdmin = getDbAdmin();
      const dbClient = getDbClient();
      
      let existingDoc: any = null;
      let usingAdmin = false;
      
      if (dbAdmin) {
        try {
          const snap = await dbAdmin.collection('shortenedUrls').where('blogId', '==', blogId).limit(1).get();
          if (!snap.empty) {
            existingDoc = snap.docs[0].data();
            usingAdmin = true;
          }
        } catch (adminErr: any) {
          if (!adminErr.message?.includes('PERMISSION_DENIED') && !adminErr.message?.includes('Missing or insufficient permissions')) {
            throw adminErr;
          }
          console.warn("[Shorten] Admin SDK read permission denied, falling back to Client SDK.");
        }
      }
      
      if (!existingDoc && dbClient) {
        try {
          const snap = await getDocs(query(collection(dbClient, 'shortenedUrls'), where('blogId', '==', blogId), limit(1)));
          if (!snap.empty) {
            existingDoc = snap.docs[0].data();
          }
        } catch (clientErr) {
          console.error("[Shorten] Client SDK read error:", clientErr);
        }
      }
      
      if (existingDoc) {
        if (existingDoc.originalUrl !== originalUrl) {
          try {
            const updatePayload = { originalUrl };
            if (usingAdmin && dbAdmin) {
              await dbAdmin.collection('shortenedUrls').doc(existingDoc.id).update(updatePayload);
            } else if (dbClient) {
              await setDoc(doc(dbClient, 'shortenedUrls', existingDoc.id), updatePayload, { merge: true });
            }
            existingDoc.originalUrl = originalUrl;
            console.log(`[Shorten] Updated originalUrl for blogId ${blogId} to latest slug/url: ${originalUrl}`);
          } catch (updateErr) {
            console.error("[Shorten] Failed to update existing shortened URL with new slug:", updateErr);
          }
        }
        return res.json({ shortId: existingDoc.id, ...existingDoc });
      }
      
      // Generate unique 6-character short ID
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let shortId = "";
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        attempts++;
        shortId = "";
        for (let i = 0; i < 6; i++) {
          shortId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        let exists = false;
        if (dbAdmin && !usingAdmin) {
          try {
            const checkSnap = await dbAdmin.collection('shortenedUrls').doc(shortId).get();
            exists = checkSnap.exists;
          } catch (e) {}
        }
        if (!exists && dbClient) {
          try {
            const checkSnap = await getDoc(doc(dbClient, 'shortenedUrls', shortId));
            exists = checkSnap.exists();
          } catch (e) {}
        }
        if (!exists) {
          isUnique = true;
        }
      }
      
      const payload = {
        id: shortId,
        originalUrl,
        blogId,
        userId,
        clicks: 0,
        internalClicks: 0,
        externalClicks: 0,
        createdAt: new Date().toISOString()
      };
      
      let saved = false;
      if (dbAdmin) {
        try {
          await dbAdmin.collection('shortenedUrls').doc(shortId).set(payload);
          saved = true;
        } catch (adminErr: any) {
          if (!adminErr.message?.includes('PERMISSION_DENIED') && !adminErr.message?.includes('Missing or insufficient permissions')) {
            throw adminErr;
          }
          console.warn("[Shorten] Admin SDK write permission denied, falling back to Client SDK.");
        }
      }
      
      if (!saved && dbClient) {
        await setDoc(doc(dbClient, 'shortenedUrls', shortId), payload);
        saved = true;
      }
      
      if (!saved) {
        throw new Error("Unable to save shortened URL to database (both Admin and Client SDK failed)");
      }
      
      return res.json(payload);
    } catch (err: any) {
      console.error("[Shorten Link Error]:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/s/:shortId", async (req, res) => {
    const rawId = req.params.shortId;
    let cleanShortId = rawId;
    let langCode: string | null = null;
    
    // Check if shortId has +D, +E, +F, +S language suffix (case insensitive)
    const langMatch = rawId.match(/^([a-zA-Z0-9_-]+)\+([dDeEfFsSiI])$/);
    if (langMatch) {
      cleanShortId = langMatch[1];
      const suffix = langMatch[2].toUpperCase();
      if (suffix === 'D') langCode = 'de';
      else if (suffix === 'E') langCode = 'en';
      else if (suffix === 'F') langCode = 'fr';
      else if (suffix === 'S') langCode = 'es';
      else if (suffix === 'I') langCode = 'it';
    }
    
    try {
      const dbAdmin = getDbAdmin();
      const dbClient = getDbClient();
      
      let data: any = null;
      let usingAdmin = false;
      
      if (dbAdmin) {
        try {
          const adminDocSnap = await dbAdmin.collection('shortenedUrls').doc(cleanShortId).get();
          if (adminDocSnap.exists) {
            data = adminDocSnap.data();
            usingAdmin = true;
          }
        } catch (adminErr: any) {
          if (!adminErr.message?.includes('PERMISSION_DENIED') && !adminErr.message?.includes('Missing or insufficient permissions')) {
            throw adminErr;
          }
          console.warn("[Redirect] Admin SDK read permission denied, falling back to Client SDK.");
        }
      }
      
      if (!data && dbClient) {
        try {
          const clientDocSnap = await getDoc(doc(dbClient, 'shortenedUrls', cleanShortId));
          if (clientDocSnap.exists()) {
            data = clientDocSnap.data();
          }
        } catch (clientErr) {
          console.error("[Redirect] Client SDK read error:", clientErr);
        }
      }
      
      if (!data) {
        return res.status(404).send(`
          <div style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; color: #333;">
            <h2>Shortlink nicht gefunden</h2>
            <p>Der angeforderte Kurzlink existiert leider nicht.</p>
            <a href="/" style="color: #FF4500; text-decoration: none; font-weight: bold;">Zurück zur Hauptseite</a>
          </div>
        `);
      }
      
      // Fetch blog details first to resolve dynamic targetUrl self-healingly on slug/title change
      let blogData: any = null;
      if (usingAdmin && dbAdmin) {
        try {
          const blogDoc = await dbAdmin.collection('users').doc(data.userId).collection('blogs').doc(data.blogId).get();
          if (blogDoc.exists) {
            blogData = blogDoc.data();
          }
        } catch (e) {}
      }
      
      if (!blogData && dbClient) {
        try {
          const blogSnap = await getDoc(doc(dbClient, 'users', data.userId, 'blogs', data.blogId));
          if (blogSnap.exists()) {
            blogData = blogSnap.data();
          }
        } catch (e) {}
      }

      const getCanonicalOrigin = () => {
        const host = req.get('host') || '';
        if (host.includes('run.app') || host.includes('localhost')) {
          return 'https://rsser.news';
        }
        return `${req.protocol}://${host}`;
      };

      let targetUrl = data.originalUrl;
      if (blogData) {
        const latestSlug = blogData.slug || data.blogId;
        const appUrl = getCanonicalOrigin();
        const freshUrl = `${appUrl}/blogs/user/${data.userId}/p/${latestSlug}`;
        if (targetUrl !== freshUrl) {
          targetUrl = freshUrl;
          console.log(`[Redirect] Self-healing old shortlink targetUrl to latest slug/url: ${targetUrl}`);
          // Update database asynchronously
          const updateUrlPayload = { originalUrl: targetUrl };
          if (usingAdmin && dbAdmin) {
            dbAdmin.collection('shortenedUrls').doc(cleanShortId).update(updateUrlPayload).catch(() => {});
          } else if (dbClient) {
            setDoc(doc(dbClient, 'shortenedUrls', cleanShortId), updateUrlPayload, { merge: true }).catch(() => {});
          }
        }
      }
      
      // Handle language redirection
      if (langCode) {
        try {
          const parsedUrl = new URL(targetUrl);
          parsedUrl.searchParams.set('lang', langCode);
          targetUrl = parsedUrl.toString();
        } catch (e) {
          targetUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'lang=' + langCode;
        }
      }
      
      // Determine click source
      const referer = req.headers.referer || "";
      const host = req.get('host') || "";
      // If referer is from our application domains, it's internal
      const isInternal = referer.includes(host) || referer.includes("rsser.news") || referer.includes("localhost") || referer.includes("run.app");
      
      // We will perform a silent increment
      const incrementVal = (field: string) => {
        return (data[field] || 0) + 1;
      };
      
      const updatePayload: any = {
        clicks: incrementVal('clicks')
      };
      if (isInternal) {
        updatePayload.internalClicks = incrementVal('internalClicks');
      } else {
        updatePayload.externalClicks = incrementVal('externalClicks');
      }
      
      if (usingAdmin && dbAdmin) {
        await dbAdmin.collection('shortenedUrls').doc(cleanShortId).update(updatePayload).catch(() => {});
      } else if (dbClient) {
        await setDoc(doc(dbClient, 'shortenedUrls', cleanShortId), updatePayload, { merge: true }).catch(() => {});
      }
      
      // Fetch blog details to include in dynamic HTML preview metadata
      let title = "RSSer.news Blog";
      let coverImage = "";
      let description = "Ein interessanter Blogbeitrag auf RSSer.news - Dein Feed, deine Regeln.";
      
      if (blogData) {
        const originalLang = blogData.language || 'de';
        const activeLang = langCode || originalLang;
        
        let displayTitle = blogData.title || "";
        let displayContent = blogData.content || "";
        
        // Check for translation
        if (activeLang !== originalLang && blogData.translations && blogData.translations[activeLang]) {
          displayTitle = blogData.translations[activeLang].title || displayTitle;
          displayContent = blogData.translations[activeLang].content || displayContent;
        }
        
        title = displayTitle || title;
        coverImage = blogData.coverImage || "";
        
        if (displayContent) {
          // Strip markdown
          const plain = displayContent
            .replace(/[#*`_\[\]\(\)-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (plain.length > 160) {
            description = plain.substring(0, 160) + "...";
          } else {
            description = plain || description;
          }
        }
      }
      
      const escapeHtml = (unsafe: string) => {
        if (!unsafe) return "";
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };
      
      // Return HTML page with Open Graph and Twitter card meta tags, plus instant client-side redirection
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!DOCTYPE html>
<html lang="${escapeHtml(langCode || 'de')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  
  <!-- Dynamic Open Graph Meta Tags -->
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${coverImage ? `<meta property="og:image" content="${escapeHtml(coverImage)}">` : ''}
  <meta property="og:url" content="${escapeHtml(targetUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="RSSer.news">
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="${coverImage ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${coverImage ? `<meta name="twitter:image" content="${escapeHtml(coverImage)}">` : ''}
  
  <!-- Instant Redirection -->
  <meta http-equiv="refresh" content="0;url=${targetUrl}">
  <script type="text/javascript">
    window.location.href = ${JSON.stringify(targetUrl)};
  </script>
</head>
<body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0c0a09; color: #f5f5f4; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden;">
  <div style="text-align: center; padding: 24px; max-width: 400px; width: 100%;">
    <div style="width: 44px; height: 44px; border: 3px solid rgba(239, 68, 68, 0.15); border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 24px;"></div>
    <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.025em; color: #ffffff;">Weiterleitung...</h2>
    <p style="opacity: 0.7; font-size: 13px; margin: 0 0 24px 0; line-height: 1.5;">Sie werden zu <strong>RSSer.news</strong> weitergeleitet.</p>
    <p style="font-size: 13px; margin: 0;"><a href="${targetUrl}" style="color: #ef4444; text-decoration: none; font-weight: 600; border-bottom: 1px solid rgba(239, 68, 68, 0.3); padding-bottom: 2px; transition: border-color 0.2s;">Hier klicken, falls nichts passiert</a></p>
  </div>
  <style>
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</body>
</html>`);
    } catch (err: any) {
      console.error("[Short URL Redirect Error]:", err.message);
      return res.status(500).send("Server Fehler bei der Weiterleitung");
    }
  });

  app.post("/api/scrape-podcast", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    
    try {
      const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const podcasts: any[] = [];
      
      // Basic implementation for scraping
      // Need a flexible selector or try to find some common podcast list structure
      // For now, let's try to be generic. 
      // User can customize selectors if needed, but let's try some common ones.
      
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('.xml')) {
           podcasts.push({
             title: $(el).text() || 'Podcast',
             url: href,
             type: 'podcasts',
             category: 'General'
           });
        }
      });
      
      res.json(podcasts);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/waiting-list", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const port = parseInt(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: port === 465, // Use SSL/TLS if port is 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.SUPPORT_EMAIL,
        subject: "Neue Newsletter-Anmeldung",
        text: `Ein neuer Nutzer hat sich für den RSSer Newsletter eingetragen: ${email}`,
      });
      res.json({ message: "Erfolgreich angemeldet" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Fehler beim Senden der Email" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    const { email, type, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    const port = parseInt(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const subject = type === 'wishes' ? "Neuer Funktionswunsch" : "Neue Support-Anfrage";

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.SUPPORT_EMAIL,
        subject: subject,
        text: `Typ: ${type}\nVon: ${email}\n\nNachricht:\n${message}`,
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Fehler beim Senden der Email" });
    }
  });

  app.get("/api/rss/user/:userId", async (req, res) => {
    const { userId } = req.params;
    
    // Canonical Origin Logic
    const getCanonicalOrigin = () => {
      const host = req.get('host') || '';
      if (host.includes('run.app') || host.includes('localhost')) {
        return 'https://rsser.news';
      }
      return `${req.protocol}://${host}`;
    };

    const appUrl = getCanonicalOrigin();
    
    try {
      console.log(`Generating RSS feed for user: ${userId}`);
      let db = getDbAdmin();
      let userData: any = null;
      let blogsSnap: any = null;
      let usingFallback = false;

      if (db) {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          userData = userDoc.exists ? userDoc.data() : null;
          
          const blogsSnapShot = await db.collection('users').doc(userId).collection('blogs')
            .where('published', '==', true)
            .limit(100)
            .get();
          blogsSnap = blogsSnapShot;
        } catch (adminErr: any) {
          // If permission denied, use fallback without logging error stack
          usingFallback = true;
        }
      } else {
        usingFallback = true;
      }

      if (usingFallback) {
        const clientDb = getDbClient();
        if (clientDb) {
          console.log(`Fetching user/blogs for: ${userId} using Client SDK (Fallback)...`);
          const userDoc = await getDoc(doc(clientDb, 'users', userId));
          userData = userDoc.exists() ? userDoc.data() : null;
          
          const q = query(
            collection(clientDb, 'users', userId, 'blogs'),
            where('published', '==', true),
            limit(100)
          );
          blogsSnap = await getDocs(q);
        }
      }

      if (!userData && !blogsSnap) {
         throw new Error("Could not fetch data from Admin or Client SDK");
      }
      
      const authorName = userData?.displayName || "RSSer News";
      const authorBio = userData?.bio || "";
      const authorLang = userData?.blogLanguage || "de";
      const targetLang = (req.query.lang || '').toString().toLowerCase();

      const docs = blogsSnap.docs || [];
      console.log(`Found ${docs.length} total blogs.`);

      const items = docs
        .map((d: any) => ({ id: d.id, ...(d.data ? d.data() : d) }))
        .filter((blog: any) => blog.coverImage && blog.coverImage.trim() !== "")
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .map((data: any) => {
          const pubDate = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date();
          
          let displayTitle = data.title || "Ohne Titel";
          let displayContent = data.content || "";
          
          if (targetLang && targetLang !== (data.language || 'de').toLowerCase() && data.translations && data.translations[targetLang]) {
            displayTitle = data.translations[targetLang].title || displayTitle;
            displayContent = data.translations[targetLang].content || displayContent;
          }
          
          // Use cheerio to get a plain text summary from HTML content
          const $Content = cheerio.load(displayContent);
          const summary = $Content.text().substring(0, 300) + "...";
          
          const articleSlug = data.slug || data.id;
          const articleLink = data.slug 
            ? `${appUrl}/blogs/user/${userId}/p/${data.slug}` 
            : `${appUrl}/blogs/user/${userId}/article/${data.id}`;

          // Detect MIME type from extension or default to image/jpeg
          let mimeType = "image/jpeg";
          if (data.coverImage) {
            const ext = data.coverImage.split('?')[0].split('.').pop()?.toLowerCase();
            if (ext === 'png') mimeType = "image/png";
            else if (ext === 'webp') mimeType = "image/webp";
            else if (ext === 'gif') mimeType = "image/gif";
          }

          return `
    <item>
      <title><![CDATA[${displayTitle}]]></title>
      <link>${xmlEscape(articleLink)}</link>
      <description><![CDATA[${summary}]]></description>
      <content:encoded><![CDATA[${data.coverImage ? `<p><img src="${data.coverImage}" alt="${xmlEscape(displayTitle)}" style="max-width:100%;height:auto;display:block;margin-bottom:1rem;" /></p>` : ""}${displayContent}]]></content:encoded>
      <pubDate>${pubDate.toUTCString()}</pubDate>
      <guid isPermaLink="false">${data.id}</guid>
      ${data.coverImage ? `<media:content url="${xmlEscape(data.coverImage)}" medium="image" type="${mimeType}" isDefault="true" />` : ""}
      ${data.coverImage ? `<media:thumbnail url="${xmlEscape(data.coverImage)}" />` : ""}
      ${data.coverImage ? `<enclosure url="${xmlEscape(data.coverImage)}" length="0" type="${mimeType}" />` : ""}
    </item>`;
        }).join("\n");

      const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title><![CDATA[${authorName}s Blog - RSSer]]></title>
    <link>${xmlEscape(appUrl)}/blogs/user/${userId}</link>
    <description><![CDATA[${authorBio}]]></description>
    <language>${xmlEscape(authorLang)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>RSSer.app Blog Service</generator>
    ${userData?.avatarUrl ? `<image><url>${xmlEscape(userData.avatarUrl)}</url><title><![CDATA[${authorName}]]></title><link>${xmlEscape(appUrl)}/blogs/user/${userId}</link></image>` : ""}
    ${items}
  </channel>
</rss>`;

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.send(rssXml);
    } catch (error: any) {
      console.error("RSS User Feed Error:", error);
      const host = req.get('host');
      const env = process.env.NODE_ENV || 'development';
      res.status(500).send(`Internal Server Error generating feed: ${error.message} (Host: ${host}, Env: ${env})`);
    }
  });

  app.get(['/blogs/user/:userId/p/:slug', '/blogs/user/:userId/article/:articleId', '/blogs/user/:userId'], async (req, res, next) => {
    const { userId, slug, articleId } = req.params;
    
    // Serve HTML with injected tags for these specific routes
    // We do this for everyone (not just bots) to support SEO and proper social sharing
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    
    // If it's a request for a sub-asset (contains a dot like .js, .png, .css), skip unless it's a known bot crawler
    const knownBotRegex = /bot|facebook|twitter|linkedin|slack|whatsapp|telegram|discord|crawler|spider|bluesky|index|preview|social|external|link|card|embed|whatsapp|signal/i;
    const isBot = knownBotRegex.test(ua);
    
    const isAsset = req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|json|map|txt|webmanifest)$|^\/assets\//i);
    if (isAsset && !isBot) return next();

    const host = req.get('host') || 'rsser.news';
    const proto = req.get('x-forwarded-proto') || 'https';
    const origin = `${proto}://${host}`;

    console.log(`[OG] Request: ${req.url} | Bot: ${isBot} | UA: ${ua} | Origin: ${origin}`);

    try {
      let title = "RSSer News";
      let description = "Deine Nachrichten, Podcasts & Videos an einem Ort.";
      let imageUrl = "https://rsser.news/RSSerLogo.png";
      const siteName = "RSSer News";
      let blogDoc: any = null;
      let userData: any = null;
      let found = false;
      const host = req.get('host') || 'rsser.news';
      const pageUrl = `${origin}${req.url}`;

      const db = getDbAdmin();
      const clientDb = getDbClient();

      if (slug || articleId) {
        const articleIdOrSlug = slug || articleId || req.url.split('/').pop()?.split('?')[0];

        // Try Admin SDK
        if (db) {
           try {
              if (slug) {
                const blogsRef = db.collection('users').doc(userId).collection('blogs');
                const q = blogsRef.where('slug', '==', slug).limit(1);
                const snap = await q.get();
                if (!snap.empty) blogDoc = snap.docs[0];
              } else if (articleIdOrSlug) {
                blogDoc = await db.collection('users').doc(userId).collection('blogs').doc(articleIdOrSlug).get();
              }
              const userDoc = await db.collection('users').doc(userId).get();
              userData = userDoc.exists ? userDoc.data() : null;
           } catch (e) {
              // Permission denied, will try client fallback
           }
        }

        // Try Client SDK fallback
        if (!blogDoc && clientDb) {
           try {
              if (slug) {
                const blogsRef = collection(clientDb, 'users', userId, 'blogs');
                const q = query(blogsRef, where('slug', '==', slug), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) blogDoc = snap.docs[0];
              } else if (articleIdOrSlug) {
                blogDoc = await getDoc(doc(clientDb, 'users', userId, articleIdOrSlug));
              }
              const userSnap = await getDoc(doc(clientDb, 'users', userId));
              userData = userSnap.exists() ? userSnap.data() : null;
           } catch (e) {}
        }

        const blogData = blogDoc && (typeof blogDoc.data === 'function' ? blogDoc.data() : blogDoc);
        if (blogData) {
          title = blogData.title || title;
          const $content = cheerio.load(blogData.content || "");
          const text = $content.text().trim();
          // Get first 200 chars for meta description
          description = text.length > 200 ? text.substring(0, 197) + "..." : text;
          if (!description || description.trim().length < 5) {
            description = "Lies diesen Blogbeitrag auf RSSer News.";
          }
          if (blogData.coverImage) imageUrl = blogData.coverImage;
          found = true;
        }
      } else {
        // User profile
        if (!userData) {
           if (db) {
              try {
                 const userDoc = await db.collection('users').doc(userId).get();
                 userData = userDoc.exists ? userDoc.data() : null;
              } catch (e) {}
           }
           if (!userData && clientDb) {
              try {
                 const userSnap = await getDoc(doc(clientDb, 'users', userId));
                 userData = userSnap.exists() ? userSnap.data() : null;
              } catch (e) {}
           }
        }
        
        if (userData) {
          title = `${userData.displayName || "Autor"}'s Blog - RSSer`;
          description = userData.bio || `Folge ${userData.displayName || "diesem Autor"} auf RSSer News.`;
          if (userData.avatarUrl) imageUrl = userData.avatarUrl;
          found = true;
        }
      }

      // Ensure imageUrl is absolute and secure
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `${origin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      } else if (imageUrl && imageUrl.startsWith('http:')) {
        imageUrl = imageUrl.replace('http:', 'https:');
      }

      // Read index.html template
      let templatePath = path.join(process.cwd(), 'dist/index.html');
      if (!existsSync(templatePath)) {
        templatePath = path.join(process.cwd(), 'index.html');
      }
      
      if (!existsSync(templatePath)) return next();

      let template = readFileSync(templatePath, 'utf-8');
      const $template = cheerio.load(template);

      // Clean up existing OG/Twitter tags before injecting new ones
      $template('title').text(title);
      $template('meta[name="description"]').attr('content', description);
      
      // Inject/Update OG tags
      const setMeta = (property: string, content: string, attr = 'property') => {
        const selector = `meta[${attr}="${property}"]`;
        if ($template(selector).length) {
          $template(selector).attr('content', content);
        } else {
          $template('head').append(`<meta ${attr}="${property}" content="${content}">`);
        }
      };

      setMeta('og:title', title);
      setMeta('og:description', description);
      setMeta('og:image', imageUrl);
      setMeta('og:url', pageUrl);
      setMeta('og:type', slug || articleId ? 'article' : 'profile');
      setMeta('og:site_name', siteName);
      
      setMeta('twitter:card', 'summary_large_image', 'name');
      setMeta('twitter:title', title, 'name');
      setMeta('twitter:description', description, 'name');
      setMeta('twitter:image', imageUrl, 'name');

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send($template.html());
      return;

    } catch (e: any) {
      if (!e.message?.includes('PERMISSION_DENIED')) {
        console.error("[OG] Error:", e.message);
      }
      next();
    }
  });

  // Intercept any unmatched /api routes so they return JSON 404 instead of reaching Vite/HTML
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicitly fallback to index.html for Vite dev server if middleware didn't catch it
    app.use('*', async (req, res, next) => {
      try {
        if (req.originalUrl.startsWith('/api/')) {
          return res.status(404).json({ error: `API endpoint not found: ${req.originalUrl}` });
        }
        const url = req.originalUrl;
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (existsSync(indexPath)) {
          const indexHtml = readFileSync(indexPath, 'utf-8');
          const template = await vite.transformIndexHtml(url, indexHtml);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          next();
        }
      } catch (e) {
        next(e);
      }
    });

  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Explicitly handle all SPA routes in production
    app.get('*', (req, res) => {
      try {
        if (req.originalUrl.startsWith('/api/')) {
          return res.status(404).json({ error: `API endpoint not found: ${req.originalUrl}` });
        }
        res.sendFile(path.join(distPath, 'index.html'));
      } catch (e) {
        res.status(500).send("Server Error: Missing index.html");
      }
    });
  }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);

      // Defer background cleanup and crawler so container startup TCP probes succeed instantly
      setTimeout(() => {
        cleanupOldArticles().catch(() => {});
        setInterval(() => {
          cleanupOldArticles().catch(() => {});
        }, 6 * 60 * 60 * 1000); // Every 6 hours

        startBackgroundCrawler();
      }, 15000);
    });
  } catch (error) {
    console.error("CRITICAL: Failed to start server:", error);
  }
}

startServer();
