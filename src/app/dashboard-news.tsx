"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./clients/clients.module.css";
import Button from "./ui/Button";
import Notice from "./ui/Notice";
import StatusMessage from "./ui/StatusMessage";
import TogglePill from "./ui/TogglePill";

type NewsStory = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  summary?: string;
  imageUrl?: string;
};

type NewsResponse = {
  stories?: NewsStory[];
  updatedAt?: string;
  stale?: boolean;
  error?: string;
};

type NewsProfile = "facials-electrolysis" | "facials" | "electrolysis";

const NEWS_PROFILES: { id: NewsProfile; label: string; topics: string[] }[] = [
  { id: "facials-electrolysis", label: "Facials + Electrolysis", topics: ["facials", "electrolysis"] },
  { id: "facials", label: "Facials", topics: ["facials"] },
  { id: "electrolysis", label: "Electrolysis", topics: ["electrolysis"] }
];

const NEWS_PROFILE_STORAGE_KEY = "skinpro-news-profile";
const NEWS_READ_STORAGE_KEY = "skinpro-news-read";
const PAYWALL_BASE_URL = "https://www.removepaywall.com/search?url=";

const formatRelativeTime = (value?: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const formatStoryDate = (value?: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
};

const buildWrappedUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith(PAYWALL_BASE_URL)) {
    return trimmed;
  }
  return `${PAYWALL_BASE_URL}${encodeURIComponent(trimmed)}`;
};

export default function DashboardNews({ rootTabs }: { rootTabs: React.ReactNode }) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [profile, setProfile] = useState<NewsProfile>("facials-electrolysis");
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [readStories, setReadStories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = window.localStorage.getItem(NEWS_PROFILE_STORAGE_KEY);
    if (stored && NEWS_PROFILES.some((profile) => profile.id === stored)) {
      setProfile(stored as NewsProfile);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(NEWS_READ_STORAGE_KEY);
    if (!stored) {
      return;
    }
    try {
      const ids = JSON.parse(stored) as string[];
      if (Array.isArray(ids)) {
        setReadStories(new Set(ids));
      }
    } catch {
      setReadStories(new Set());
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(NEWS_PROFILE_STORAGE_KEY, profile);
  }, [profile]);

  const activeProfile = useMemo(
    () => NEWS_PROFILES.find((item) => item.id === profile) ?? NEWS_PROFILES[0],
    [profile]
  );
  const visibleStories = useMemo(() => stories.slice(0, 10), [stories]);
  const activeStory = visibleStories[activeIndex];
  const activeStoryUrl = activeStory?.url ?? "";
  const activeStoryPaywallUrl = activeStory ? buildWrappedUrl(activeStory.url) : "";
  const activeStoryRead = activeStory ? readStories.has(activeStory.id) : false;
  const updatedLabel = updatedAt ? formatRelativeTime(updatedAt) : "";
  const topStoryLabel = activeIndex === 0 ? "Top Story" : "Featured";

  const loadStories = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("topics", activeProfile.topics.join(","));
      if (forceRefresh) {
        params.set("refresh", "1");
      }
      const response = await fetch(`/api/news?${params.toString()}`);
      const data = (await response.json()) as NewsResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load news");
      }
      setStories(data.stories ?? []);
      setUpdatedAt(data.updatedAt ?? null);
      setIsStale(Boolean(data.stale));
      setActiveIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStories();
  }, [activeProfile]);

  useEffect(() => {
    if (visibleStories.length && activeIndex >= visibleStories.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, visibleStories.length]);

  useEffect(() => {
    if (!autoRotate || visibleStories.length < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visibleStories.length);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [autoRotate, visibleStories.length]);

  const handlePrev = () => {
    if (!visibleStories.length) {
      return;
    }
    setActiveIndex(
      (current) => (current - 1 + visibleStories.length) % visibleStories.length
    );
  };

  const handleNext = () => {
    if (!visibleStories.length) {
      return;
    }
    setActiveIndex((current) => (current + 1) % visibleStories.length);
  };

  const persistReadStories = (next: Set<string>) => {
    window.localStorage.setItem(NEWS_READ_STORAGE_KEY, JSON.stringify([...next]));
  };

  const markStoryRead = (storyId: string) => {
    setReadStories((current) => {
      if (current.has(storyId)) {
        return current;
      }
      const next = new Set(current);
      next.add(storyId);
      persistReadStories(next);
      return next;
    });
  };

  const openStory = (story: NewsStory) => {
    if (!story.url) {
      return;
    }
    markStoryRead(story.id);
    window.open(story.url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className={`${styles.panel} ${styles.workspacePanel}`}>
      <div className={styles.section}>
        <div className={`${styles.sectionHeaderRow} ${styles.newsHeaderRow}`}>
          {rootTabs}
          <div className={styles.newsHeaderActions}>
            <TogglePill
              className={styles.newsProfileTabs}
              buttonClassName={styles.tabButton}
              buttonActiveClassName={styles.tabButtonActive}
              value={profile}
              onChange={(value) => setProfile(value as NewsProfile)}
              items={NEWS_PROFILES}
            />
            <Button variant="secondary" onClick={() => void loadStories(true)}>
              Refresh
            </Button>
          </div>
        </div>
        <Notice className={styles.newsHint}>
          Personalized highlights tuned for facial treatments and electrolysis.
          {updatedLabel && ` Updated ${updatedLabel}.`}
          {isStale && " Showing cached results."}
        </Notice>

        {loading && <StatusMessage>Loading news...</StatusMessage>}
        {error && <StatusMessage>{error}</StatusMessage>}

        {!loading && !error && !visibleStories.length && (
          <StatusMessage>No stories found yet.</StatusMessage>
        )}

        {!loading && !error && visibleStories.length > 0 && activeStory && (
          <div className={styles.newsLayout}>
            <article className={styles.newsHero}>
              <div className={styles.newsHeroMeta}>
                <span className={styles.newsBadge} title="Highest-ranked story in this feed.">
                  {topStoryLabel}
                </span>
                <span className={styles.newsReadBadge}>
                  {activeStoryRead ? "Read" : "New"}
                </span>
                <span className={styles.newsMetaText}>
                  {activeStory.source || "Industry news"}
                  {activeStory.publishedAt &&
                    ` • ${formatStoryDate(activeStory.publishedAt)}`}
                </span>
              </div>
              <h2 className={styles.newsHeroTitle}>
                <a
                  href={activeStoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.newsHeroLink}
                  onClick={() => markStoryRead(activeStory.id)}
                >
                  {activeStory.title}
                </a>
              </h2>
              {activeStory.summary && (
                <p className={styles.newsHeroSummary}>{activeStory.summary}</p>
              )}
              {activeStory.imageUrl && (
                <div className={styles.newsHeroImageWrap}>
                  <img
                    src={activeStory.imageUrl}
                    alt={activeStory.title}
                    className={styles.newsHeroImage}
                    loading="lazy"
                  />
                </div>
              )}
              <div className={styles.newsHeroActions}>
                <Button variant="secondary" onClick={handlePrev}>
                  Previous
                </Button>
                <Button variant="secondary" onClick={handleNext}>
                  Next
                </Button>
                <Button variant="secondary" onClick={() => setAutoRotate((value) => !value)}>
                  {autoRotate ? "Pause rotation" : "Resume rotation"}
                </Button>
                <a
                  href={activeStoryPaywallUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.newsPaywallButton}
                  onClick={() => markStoryRead(activeStory.id)}
                >
                  Remove Paywall
                </a>
                <a
                  href={activeStoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.newsLinkButton}
                  onClick={() => markStoryRead(activeStory.id)}
                >
                  Read full story
                </a>
              </div>
            </article>

            <div className={styles.newsList}>
              {visibleStories.map((story, index) => {
                const isRead = readStories.has(story.id);
                return (
                  <div
                    key={story.id}
                    className={`${styles.newsListItem} ${
                      index === activeIndex ? styles.newsListItemActive : ""
                    } ${isRead ? styles.newsListItemRead : ""}`.trim()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => openStory(story)}
                    role="link"
                    tabIndex={0}
                    aria-current={index === activeIndex ? "true" : undefined}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openStory(story);
                      }
                    }}
                  >
                    <span className={styles.newsListTitle}>{story.title}</span>
                    <div className={styles.newsListFooter}>
                      <span className={styles.newsListMeta}>
                        {story.source || "Industry news"}
                        {story.publishedAt && ` • ${formatStoryDate(story.publishedAt)}`}
                      </span>
                      <a
                        href={buildWrappedUrl(story.url)}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.newsPaywallButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          markStoryRead(story.id);
                        }}
                      >
                        Remove Paywall
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
