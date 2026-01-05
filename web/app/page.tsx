import ClientsList from "./clients-list";
import styles from "./clients/clients.module.css";

export default function Home() {
  return (
    <main>
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
        <ClientsList />
      </div>
    </main>
  );
}
