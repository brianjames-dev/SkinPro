"use client";

import DashboardClients from "./dashboard-clients";
import DashboardAlerts from "./dashboard-alerts";
import DashboardMaintenance from "./dashboard-maintenance";
import DashboardNews from "./dashboard-news";
import styles from "./clients/clients.module.css";
import TogglePill from "./ui/TogglePill";
import useQueryTabSync from "../lib/hooks/useQueryTabSync";
import Notice from "./ui/Notice";
import {
  UnsavedChangesProvider,
  useUnsavedChangesContext
} from "./ui/UnsavedChangesContext";

type RootTab = "alerts" | "maintenance" | "clients" | "news";

const ROOT_TAB_IDS: RootTab[] = ["alerts", "maintenance", "news", "clients"];

const ROOT_TABS: { id: RootTab; label: string }[] = [
  { id: "alerts", label: "Alerts" },
  { id: "maintenance", label: "Maintenance" },
  { id: "news", label: "News" },
  { id: "clients", label: "Clients" }
];

function HomeContent() {
  const unsaved = useUnsavedChangesContext();
  const { value: rootTab, onChange: handleRootTabChange } = useQueryTabSync({
    key: "tab",
    defaultValue: "alerts",
    values: ROOT_TAB_IDS
  });

  const handleRootTabSelect = (tab: RootTab) => {
    if (tab === rootTab) {
      return;
    }
    const entry = unsaved?.getEntry(rootTab);
    if (entry && entry.isDirty()) {
      entry.requestExit(() => handleRootTabChange(tab));
      return;
    }
    handleRootTabChange(tab);
  };

  return (
    <div className={styles.page}>
      <header className={styles.homeHeader}>
        <div>
          <h1 className={styles.homeTitle}>SkinPro Web</h1>
          <Notice>
            Local web UI backed by the existing SkinPro database and
            SkinProData folder.
          </Notice>
        </div>
      </header>

      {rootTab === "alerts" && (
        <DashboardAlerts
          rootTabs={
            <TogglePill
              className={`${styles.sectionTabs} ${styles.rootTabs}`}
              buttonClassName={styles.tabButton}
              buttonActiveClassName={styles.tabButtonActive}
              value={rootTab}
              onChange={handleRootTabSelect}
              items={ROOT_TABS}
            />
          }
        />
      )}
      {rootTab === "maintenance" && (
        <DashboardMaintenance
          rootTabs={
            <TogglePill
              className={`${styles.sectionTabs} ${styles.rootTabs}`}
              buttonClassName={styles.tabButton}
              buttonActiveClassName={styles.tabButtonActive}
              value={rootTab}
              onChange={handleRootTabSelect}
              items={ROOT_TABS}
            />
          }
        />
      )}
      {rootTab === "clients" && (
        <DashboardClients
          rootTabs={
            <TogglePill
              className={`${styles.sectionTabs} ${styles.rootTabs}`}
              buttonClassName={styles.tabButton}
              buttonActiveClassName={styles.tabButtonActive}
              value={rootTab}
              onChange={handleRootTabSelect}
              items={ROOT_TABS}
            />
          }
        />
      )}
      {rootTab === "news" && (
        <DashboardNews
          rootTabs={
            <TogglePill
              className={`${styles.sectionTabs} ${styles.rootTabs}`}
              buttonClassName={styles.tabButton}
              buttonActiveClassName={styles.tabButtonActive}
              value={rootTab}
              onChange={handleRootTabSelect}
              items={ROOT_TABS}
            />
          }
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <UnsavedChangesProvider>
      <HomeContent />
    </UnsavedChangesProvider>
  );
}
