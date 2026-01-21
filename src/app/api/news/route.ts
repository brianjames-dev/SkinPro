import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { ensureDir, sanitizeFileName } from "@/lib/fileUtils";
import { loadSkinproPaths } from "@/lib/skinproPaths";

export const runtime = "nodejs";

type NewsStory = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  summary?: string;
  score: number;
};

type NewsCache = {
  updatedAt: string;
  topics: string[];
  stories: NewsStory[];
};

const DEFAULT_TOPICS = ["facials", "electrolysis"];
const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search?q=";

const TOPIC_KEYWORDS: Record<
  string,
  { primary: string[]; related: string[] }
> = {
  facials: {
    primary: [
      "facial",
      "facials",
      "facial treatment",
      "chemical peel",
      "microdermabrasion",
      "microneedling"
    ],
    related: [
      "skin care",
      "skin barrier",
      "acne",
      "hyperpigmentation",
      "led light therapy",
      "photoaging",
      "hydration"
    ]
  },
  electrolysis: {
    primary: [
      "electrolysis",
      "electrolysis hair removal",
      "permanent hair removal"
    ],
    related: [
      "hair removal",
      "hirsutism",
      "ingrown hair",
      "folliculitis",
      "laser hair removal"
    ]
  }
};

const SIGNAL_KEYWORDS = [
  "study",
  "trial",
  "review",
  "guideline",
  "fda",
  "clinical"
];

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const CACHE_TTL_MINUTES = parseNumber(process.env.SKINPRO_NEWS_CACHE_MINUTES, 360);
const MAX_STORIES = parseNumber(process.env.SKINPRO_NEWS_MAX, 18);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  trimValues: true
});

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const readText = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = [record.text, record["#text"], record._];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        return candidate.trim();
      }
    }
  }
  return "";
};

const stripTags = (value: string) =>
  value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

const splitTitle = (value: string) => {
  const parts = value.split(" - ");
  if (parts.length <= 1) {
    return { title: value.trim(), source: "" };
  }
  const source = parts.pop() ?? "";
  return { title: parts.join(" - ").trim(), source: source.trim() };
};

const extractLink = (item: Record<string, unknown>): string => {
  const linkValue = item.link;
  if (!linkValue) {
    return "";
  }
  if (typeof linkValue === "string") {
    return linkValue.trim();
  }
  if (Array.isArray(linkValue)) {
    for (const entry of linkValue) {
      if (entry && typeof entry === "object") {
        const found = extractLink({ link: entry });
        if (found) {
          return found;
        }
      }
    }
  }
  if (linkValue && typeof linkValue === "object") {
    const record = linkValue as Record<string, unknown>;
    const direct = readText(record.href ?? record.url ?? record.text ?? record["#text"]);
    if (direct) {
      return direct;
    }
  }
  return "";
};

const extractPublishedAt = (item: Record<string, unknown>): string => {
  const dateCandidate =
    item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? item.date;
  return readText(dateCandidate);
};

const extractSource = (item: Record<string, unknown>, fallback: string): string => {
  const sourceText = readText(item.source);
  if (sourceText) {
    return sourceText;
  }
  return fallback;
};

const parseTopics = (value: string | null): string[] => {
  if (!value) {
    return DEFAULT_TOPICS;
  }
  const topics = value
    .split(",")
    .map((topic) => topic.trim().toLowerCase())
    .filter(Boolean);
  const allowed = new Set(Object.keys(TOPIC_KEYWORDS));
  const normalized = topics.filter((topic) => allowed.has(topic));
  return normalized.length ? normalized : DEFAULT_TOPICS;
};

const buildQuery = (topics: string[]) => {
  const keywords = new Set<string>();
  topics.forEach((topic) => {
    const config = TOPIC_KEYWORDS[topic];
    if (!config) {
      return;
    }
    [...config.primary, ...config.related].forEach((keyword) => {
      keywords.add(keyword);
    });
  });
  const terms = keywords.size ? [...keywords] : DEFAULT_TOPICS;
  return terms
    .map((term) => (term.includes(" ") ? `"${term}"` : term))
    .join(" OR ");
};

const buildFeedUrl = (topics: string[]) => {
  const query = buildQuery(topics);
  return `${GOOGLE_NEWS_BASE}${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
};

const scoreStory = (story: NewsStory, topics: string[]) => {
  const text = `${story.title} ${story.summary ?? ""}`.toLowerCase();
  let score = 0;

  topics.forEach((topic) => {
    const config = TOPIC_KEYWORDS[topic];
    if (!config) {
      return;
    }
    config.primary.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += 3;
      }
    });
    config.related.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += 1;
      }
    });
  });

  SIGNAL_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 1;
    }
  });

  if (story.publishedAt) {
    const published = new Date(story.publishedAt);
    if (!Number.isNaN(published.getTime())) {
      const ageMs = Date.now() - published.getTime();
      const ageDays = ageMs / 86400000;
      if (ageDays <= 3) {
        score += 3;
      } else if (ageDays <= 7) {
        score += 2;
      } else if (ageDays <= 14) {
        score += 1;
      }
    }
  }

  return score;
};

const normalizeStories = (
  items: Record<string, unknown>[],
  topics: string[]
): NewsStory[] => {
  const stories: NewsStory[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const rawTitle = readText(item.title);
    if (!rawTitle) {
      continue;
    }
    const { title, source: sourceFromTitle } = splitTitle(rawTitle);
    const url = extractLink(item);
    if (!url) {
      continue;
    }
    const source = extractSource(item, sourceFromTitle);
    const publishedAt = extractPublishedAt(item);
    const summary = stripTags(
      readText(item.description ?? item.summary ?? item.content)
    );

    const baseId = url || `${title}:${source}`;
    const id = crypto.createHash("sha1").update(baseId).digest("hex");
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const story: NewsStory = {
      id,
      title,
      url,
      source,
      publishedAt,
      summary,
      score: 0
    };
    story.score = scoreStory(story, topics);
    stories.push(story);
  }

  return stories;
};

const parseFeedItems = (xml: string): Record<string, unknown>[] => {
  const data = parser.parse(xml) as Record<string, unknown>;
  const rssChannel = data.rss as Record<string, unknown> | undefined;
  const channel = rssChannel?.channel as Record<string, unknown> | undefined;
  const rssItems = toArray(channel?.item as Record<string, unknown>[]);

  if (rssItems.length) {
    return rssItems;
  }

  const feed = data.feed as Record<string, unknown> | undefined;
  const entries = toArray(feed?.entry as Record<string, unknown>[]);
  return entries;
};

const loadCache = (filePath: string): NewsCache | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as NewsCache;
  } catch {
    return null;
  }
};

const saveCache = (filePath: string, payload: NewsCache) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const isCacheFresh = (cache: NewsCache) => {
  if (!cache.updatedAt) {
    return false;
  }
  const updated = new Date(cache.updatedAt);
  if (Number.isNaN(updated.getTime())) {
    return false;
  }
  const ageMinutes = (Date.now() - updated.getTime()) / 60000;
  return ageMinutes <= CACHE_TTL_MINUTES;
};

const getCachePath = (topics: string[]) => {
  const paths = loadSkinproPaths();
  const cacheDir = path.join(paths.dataDir, "news");
  ensureDir(cacheDir);
  const key = sanitizeFileName(topics.slice().sort().join("-") || "default");
  return path.join(cacheDir, `news-cache-${key}.json`);
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topics = parseTopics(url.searchParams.get("topics"));
  const refresh = url.searchParams.get("refresh") === "1";
  const cachePath = getCachePath(topics);
  const cached = loadCache(cachePath);

  if (!refresh && cached && isCacheFresh(cached)) {
    return NextResponse.json({
      stories: cached.stories,
      updatedAt: cached.updatedAt,
      topics,
      stale: false
    });
  }

  try {
    const feedUrl = buildFeedUrl(topics);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response: Response | null = null;

    try {
      response = await fetch(feedUrl, {
        headers: {
          "User-Agent": "SkinPro News"
        },
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response) {
      throw new Error("News fetch failed (no response)");
    }

    if (!response.ok) {
      throw new Error(`News fetch failed (${response.status})`);
    }

    const xml = await response.text();
    const items = parseFeedItems(xml);
    const stories = normalizeStories(items, topics)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const aTime = Date.parse(a.publishedAt ?? "");
        const bTime = Date.parse(b.publishedAt ?? "");
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      })
      .slice(0, Math.max(5, MAX_STORIES));

    const payload: NewsCache = {
      updatedAt: new Date().toISOString(),
      topics,
      stories
    };
    saveCache(cachePath, payload);

    return NextResponse.json({
      stories: payload.stories,
      updatedAt: payload.updatedAt,
      topics,
      stale: false
    });
  } catch (error) {
    if (cached?.stories?.length) {
      return NextResponse.json({
        stories: cached.stories,
        updatedAt: cached.updatedAt,
        topics,
        stale: true,
        error: error instanceof Error ? error.message : "News fetch failed"
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "News fetch failed" },
      { status: 500 }
    );
  }
}
