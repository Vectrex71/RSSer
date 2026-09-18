const baseCategories = [
  "Tech", "Games", "Coding", "AI News", 
  "Sport", "Kochen", "Gesundheit", "Natur", "Musik", 
  "Nachrichten", "Wissenschaft", "Kunst", "Politik", "Wirtschaft", "Finanzen",
  "Unterhaltung", "Interviews", "Tips & Tricks", "Tutorials"
].sort();

export const FEED_CATEGORIES = [
  "Allgemein",
  ...baseCategories
];

export const PLAN_LIMITS = {
  FREE: {
    rss: Infinity,
    radio: Infinity,
    podcast: Infinity,
    youtube: Infinity,
    webcam: Infinity,
    blogs: Infinity
  }
};

