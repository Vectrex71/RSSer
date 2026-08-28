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
    rss: 3,
    radio: 1,
    podcast: 1,
    youtube: 1,
    webcam: 1,
    blogs: 1
  }
};

