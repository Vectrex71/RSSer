# RSSer News — Your Feed. Your Rules. ⚡

> **Reclaim your news diet from opaque algorithms, clickbait traps, and data tracking.**  
> RSSer combines RSS feeds, podcasts, YouTube channels, live web radio, and an interactive community blog into a fast, privacy-focused modern web application.

<img width="1919" height="1030" alt="Screenshot 2026-08-28 12 21 15" src="https://github.com/user-attachments/assets/a383eb8a-7c79-45ed-81c1-791f7b2a98cc" />

Bright & Dark Mode

<img width="1919" height="1030" alt="Screenshot 2026-08-28 12 21 58" src="https://github.com/user-attachments/assets/dc3c96e3-708b-47fb-a56c-615e51f9a3df" />

## 🎯 Why RSSer? (The Philosophy)

In today's digital landscape, algorithmic feeds decide what you read, see, and listen to — optimized for outrage, endless scrolling, and ad impressions rather than knowledge.

**RSSer puts you back in the driver's seat:**
* 🚫 **Zero Algorithms, Zero Filter Bubbles**: Receive content in clean chronological order from the exact creators and publishers you choose.
* 🛡️ **Privacy by Design**: No tracking scripts, no behavioral profiling, and no selling of your reading habits.
* ⚡ **All-In-One Hub**: News, specialized blogs, audio podcasts, YouTube videos, and global web radio in a unified, clutter-free workspace.
* 🤖 **Ethical AI Assistance**: Optional on-demand Google Gemini AI summaries and translations that condense long articles when you need them.

<img width="1919" height="1030" alt="Screenshot 2026-08-28 12 22 15" src="https://github.com/user-attachments/assets/7031a69b-da45-47e7-a752-5a95016a4651" />

## ✨ Key Features

### 📰 Modern RSS & News Reader
* **Universal Feed Engine**: Seamlessly parses RSS 0.9/1.0/2.0, Atom, and JSON feeds.
* **Curated Discover Directory**: Explore curated top sources by topic (Tech, Politics, Economy, Science, Gaming, Culture, etc.) or add any custom RSS link.
* **OPML Import & Export**: Effortlessly migrate your existing feed collections or back up your subscriptions anytime.
* **Smart Organization**: Create custom folders/categories, mark favorites, and filter by full-text search or source.
* **High-Speed Offline Caching**: Optimized local caching for instant load times and distraction-free reading.

### 🎙️ Integrated Podcast & Audio Player
* Stream audio podcasts directly in your browser with advanced audio controls.
* Background playback, adjustable speeds (0.75x to 2x), and persistent playback position memory.

<img width="1919" height="1030" alt="Screenshot 2026-08-28 12 22 35" src="https://github.com/user-attachments/assets/6b61c27a-646f-4726-9487-7a1c201e078b" />
  
### 📻 Live Web Radio
* Tune into worldwide live radio streams sorted by countries, regions, and music genres.
* Persistent mini-player keeps streaming seamlessly while you browse your news feeds.

### 📺 YouTubeFeeds
* Follow your favorite YouTube creators directly via RSS video feeds.
* Enjoy clean, distraction-free video playback without autoplay rabbit holes.

<img width="1919" height="1030" alt="Screenshot 2026-08-28 12 22 52" src="https://github.com/user-attachments/assets/174cd276-9a44-4c18-bca9-b4a9ce412340" />

<img width="1919" height="1030" alt="Screenshot 2026-08-28 12 23 02" src="https://github.com/user-attachments/assets/a84d51c7-d28d-447a-881b-f7965c3977f2" />

### 🎨 UI, Themes & Customization
* **Modern Themes**: Switch effortlessly between Dark Mode, clean Light Mode, or system default.
* **Multiple Layout Views**: Choose your preferred style — Magazine Grid, Compact List, Card Feed, or News Ticker.
* **Fully Responsive & PWA-Ready**: Crafted for desktop, tablet, and mobile browsers.

Go to http://www.RSSer.news to use it RIGHT NOW !



---

## 🚀 Quickstart & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/rsser.git
cd rsser
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the `.env.example` template to create your `.env` file:
```bash
cp .env.example .env
```

Populate the required values in `.env` (such as Gemini API key, Firebase configuration, and optional Stripe keys).

### 4. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

---

## 🔒 Configuration & Administration

* **Set Admin Email**:  
  Add your email address in `.env` under `ADMIN_EMAIL=your.email@example.com` (and `VITE_ADMIN_EMAIL=...`). Supports comma-separated emails for multiple administrators.
* **Security**:  
  All sensitive credentials (Gemini API keys, Stripe secrets, service tokens) are strictly kept on the server-side proxy routes and never leaked to the client browser.

---

## 📜 License

Distributed under the MIT License (or custom license). See `LICENSE` for more information.

---

*Built with ❤️ for a cleaner, freer, and algorithm-free web.*
