"use client";

import DashboardClients from "./dashboard-clients";
import DashboardAlerts from "./dashboard-alerts";
import styles from "./clients/clients.module.css";
import Tabs from "./ui/Tabs";
import useQueryTabSync from "../lib/hooks/useQueryTabSync";
import Notice from "./ui/Notice";

type RootTab = "alerts" | "clients";

const ROOT_TAB_IDS: RootTab[] = ["alerts", "clients"];

const ROOT_TABS: { id: RootTab; label: string }[] = [
  { id: "alerts", label: "Alerts" },
  { id: "clients", label: "Clients" }
];

export default function Home() {
  const { value: rootTab, onChange: handleRootTabChange } = useQueryTabSync({
    key: "tab",
    defaultValue: "alerts",
    values: ROOT_TAB_IDS
  });

  return (
    <div className={styles.page}>
      <header className={styles.homeHeader}>
        <div>
          <h1 className={styles.homeTitle}>SkinPro Web</h1>
          <Notice>
            Local web UI backed by the existing SkinPro SQLite database and
            SkinProData folder.
          </Notice>
        </div>
      </header>

      <Tabs
        as="nav"
        className={`${styles.sectionTabs} ${styles.rootTabs}`}
        value={rootTab}
        onChange={handleRootTabChange}
        tabs={ROOT_TABS}
      />

      {rootTab === "alerts" ? <DashboardAlerts /> : <DashboardClients />}
    </div>
  );
}
