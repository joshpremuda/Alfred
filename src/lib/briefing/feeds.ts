export interface FeedSource {
  name: string;
  rss?: string;
  homepage: string;
  selectors?: string[]; // CSS selectors to try for headline extraction
}

export const BRIEFING_FEEDS: FeedSource[] = [
  {
    name: 'New York Times',
    rss: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    homepage: 'https://nytimes.com',
  },
  {
    name: 'BBC News',
    rss: 'http://feeds.bbci.co.uk/news/rss.xml',
    homepage: 'https://bbc.com/news',
  },
  {
    name: 'The Economist',
    rss: 'https://www.economist.com/the-world-this-week/rss.xml',
    homepage: 'https://economist.com',
  },
  {
    name: 'Financial Times',
    rss: 'https://www.ft.com/rss/home',
    homepage: 'https://ft.com',
  },
  {
    name: 'Wall Street Journal',
    rss: 'https://feeds.a.wsj.com/rss/RSSWorldNews.xml',
    homepage: 'https://wsj.com',
  },
  {
    name: 'Washington Post',
    rss: 'https://feeds.washingtonpost.com/rss/homepage',
    homepage: 'https://washingtonpost.com',
  },
  {
    name: 'Semafor',
    rss: 'https://www.semafor.com/feed',
    homepage: 'https://semafor.com',
  },
  {
    name: 'The Free Press',
    rss: 'https://www.thefp.com/feed',
    homepage: 'https://thefp.com',
  },
  {
    name: 'Monocle',
    homepage: 'https://monocle.com',
    selectors: ['h1', 'h2', 'h3', '.article-title', '.headline'],
  },
  {
    name: 'The Week',
    rss: 'https://theweek.com/rss',
    homepage: 'https://theweek.com',
  },
  {
    name: 'Works in Progress',
    rss: 'https://worksinprogress.co/feed',
    homepage: 'https://worksinprogress.co',
  },
  {
    name: "Harper's Magazine",
    rss: 'https://harpers.org/feed/',
    homepage: 'https://harpers.org',
  },
  {
    name: 'The Paris Review',
    rss: 'https://www.theparisreview.org/feed/',
    homepage: 'https://theparisreview.org',
  },
  {
    name: 'Puck',
    homepage: 'https://puck.news',
    selectors: ['h1', 'h2', '.article-title'],
  },
  {
    name: 'Air Mail',
    homepage: 'https://airmail.news',
    selectors: ['h1', 'h2', 'h3', '.headline'],
  },
  {
    name: 'Drudge Report',
    homepage: 'https://drudgereport.com',
    selectors: ['a', 'b'],
  },
  {
    name: 'The Information',
    homepage: 'https://theinformation.com',
    selectors: ['h1', 'h2', 'h3'],
  },
  {
    name: 'Paperstack',
    homepage: 'https://walzr.com/papers',
    selectors: ['h1', 'h2', 'h3', 'a'],
  },
];
