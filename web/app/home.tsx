"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardClients from "./dashboard-clients";
import DashboardAlerts from "./dashboard-alerts";
import styles from "./clients/clients.module.css";

type RootTab = "alerts" | "clients";

const ROOT_TABS: { id: RootTab; label: string }[] = [
  { id: "alerts", label: "Alerts" },
  { id: "clients", label: "Clients" }
];

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolveRootTab = (value: string | null): RootTab => {
    if (value === "alerts" || value === "clients") {
      return value;
    }
    return "alerts";
  };
  const [rootTab, setRootTab] = useState<RootTab>(() =>
    resolveRootTab(searchParams.get("tab"))
  );
  const rootTabRef = useRef(rootTab);

  useEffect(() => {
    rootTabRef.current = rootTab;
  }, [rootTab]);

  const syncRootTabRoute = (nextTab: RootTab, mode: "push" | "replace") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) {
      return;
    }
    if (mode === "push") {
      router.push(nextUrl);
    } else {
      router.replace(nextUrl);
    }
  };

  const handleRootTabChange = (nextTab: RootTab) => {
    if (nextTab === rootTab) {
      return;
    }
    setRootTab(nextTab);
    syncRootTabRoute(nextTab, "push");
  };

  useEffect(() => {
    const urlTab = resolveRootTab(searchParams.get("tab"));
    if (urlTab !== rootTabRef.current) {
      setRootTab(urlTab);
      return;
    }
    if (!searchParams.get("tab")) {
      syncRootTabRoute(rootTabRef.current, "replace");
    }
  }, [searchParams]);

  return (
    <div className={styles.page}>
      <header className={styles.homeHeader}>
        <div>
          <h1 className={styles.homeTitle}>SkinPro Web</h1>
          <p className={styles.notice}>
            Local web UI backed by the existing SkinPro SQLite database and
            SkinProData folder.
          </p>
        </div>
      </header>

      <nav className={`${styles.sectionTabs} ${styles.rootTabs}`}>
        {ROOT_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${
              rootTab === tab.id ? styles.tabButtonActive : ""
            }`}
            type="button"
            onClick={() => handleRootTabChange(tab.id)}
            aria-pressed={rootTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {rootTab === "alerts" ? <DashboardAlerts /> : <DashboardClients />}
    </div>
  );
}
