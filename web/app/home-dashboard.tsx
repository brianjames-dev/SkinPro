"use client";

import { useState } from "react";
import ClientsList from "./clients-list";
import HomeAlerts from "./home-alerts";
import styles from "./clients/clients.module.css";

type RootTab = "alerts" | "clients";

const ROOT_TABS: { id: RootTab; label: string }[] = [
  { id: "alerts", label: "Alerts" },
  { id: "clients", label: "Clients" }
];

export default function HomeDashboard() {
  const [rootTab, setRootTab] = useState<RootTab>("alerts");

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
            onClick={() => setRootTab(tab.id)}
            aria-pressed={rootTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {rootTab === "alerts" ? <HomeAlerts /> : <ClientsList />}
    </div>
  );
}
