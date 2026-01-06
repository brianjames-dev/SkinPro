"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./clients/clients.module.css";

type Alert = {
  id: number;
  client_id: number;
  full_name: string;
  primary_phone?: string | null;
  deadline: string;
  notes?: string | null;
};

type ClientOption = {
  id: number;
  full_name: string;
  primary_phone?: string | null;
};

type AlertsResponse = {
  alerts?: Alert[];
  error?: string;
};

type ClientsResponse = {
  clients?: ClientOption[];
  error?: string;
};

const parseMmddyyyy = (value: string): number => {
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) {
    return 0;
  }
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const normalizeDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  const normalized = trimmed.replace(/[-.]/g, "/");
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
    return normalized;
  }
  return trimmed;
};

const parseDateParts = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) {
    return null;
  }
  return { month, day, year };
};

const calculateAlertStatus = (deadline: string) => {
  const parts = parseDateParts(deadline);
  if (!parts) {
    return "Invalid date";
  }
  const { month, day, year } = parts;
  const deadlineUtc = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const diffDays = Math.round((deadlineUtc - todayUtc) / 86400000);

  if (diffDays > 3) {
    return `${diffDays} days`;
  }
  if (diffDays === 3) {
    return "3 days - Upcoming";
  }
  if (diffDays === 2) {
    return "2 days - Upcoming";
  }
  if (diffDays === 1) {
    return "1 day - Due Tomorrow";
  }
  if (diffDays === 0) {
    return "Due Today";
  }
  const overdueDays = Math.abs(diffDays);
  return `${overdueDays} day${overdueDays === 1 ? "" : "s"} - Overdue`;
};

export default function HomeAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [alertDeadline, setAlertDeadline] = useState("");
  const [alertNotes, setAlertNotes] = useState("");
  const [editingAlertId, setEditingAlertId] = useState<number | null>(null);
  const [editAlertDeadline, setEditAlertDeadline] = useState("");
  const [editAlertNotes, setEditAlertNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = useMemo(() => {
    const id = Number(selectedClientId);
    if (!Number.isFinite(id)) {
      return null;
    }
    return clients.find((client) => client.id === id) ?? null;
  }, [clients, selectedClientId]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => parseMmddyyyy(a.deadline) - parseMmddyyyy(b.deadline));
  }, [alerts]);

  const getAlertStatusClass = (statusText: string) => {
    if (statusText.includes("Overdue")) {
      return styles.alertStatusRed;
    }
    if (statusText.includes("Due Today")) {
      return styles.alertStatusOrange;
    }
    if (statusText.includes("Due Tomorrow") || statusText.includes("Upcoming")) {
      return styles.alertStatusYellow;
    }
    if (statusText.includes("days")) {
      return styles.alertStatusGreen;
    }
    return styles.alertStatusGray;
  };

  const setNotice = (message: string | null, isError = false) => {
    if (isError) {
      setError(message);
      setStatus(null);
    } else {
      setStatus(message);
      setError(null);
    }
  };

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const response = await fetch("/api/alerts");
      const data = (await response.json()) as AlertsResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load alerts");
      }
      setAlerts(data.alerts ?? []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to load alerts", true);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const params = new URLSearchParams({ limit: "10000" });
      const response = await fetch(`/api/clients?${params.toString()}`);
      const data = (await response.json()) as ClientsResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load clients");
      }
      setClients(data.clients ?? []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to load clients", true);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
    void loadClients();
  }, []);

  const handleAlertDeadlineBlur = () => {
    setAlertDeadline((prev) => normalizeDateInput(prev));
  };

  const handleAlertEditDeadlineBlur = () => {
    setEditAlertDeadline((prev) => normalizeDateInput(prev));
  };

  const handleAlertCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient) {
      setNotice("Select a client before setting an alert.", true);
      return;
    }
    if (!selectedClient.primary_phone) {
      setNotice("Client needs a primary phone number before alerts.", true);
      return;
    }
    const deadline = normalizeDateInput(alertDeadline);
    if (!deadline) {
      setNotice("Deadline is required (MM/DD/YYYY).", true);
      return;
    }

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          deadline,
          notes: alertNotes
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create alert");
      }
      setAlertDeadline("");
      setAlertNotes("");
      await loadAlerts();
      setNotice("Alert created.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to create alert", true);
    }
  };

  const handleAlertEditStart = (alert: Alert) => {
    setEditingAlertId(alert.id);
    setEditAlertDeadline(alert.deadline ?? "");
    setEditAlertNotes(alert.notes ?? "");
  };

  const handleAlertEditCancel = () => {
    setEditingAlertId(null);
    setEditAlertDeadline("");
    setEditAlertNotes("");
  };

  const handleAlertUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAlertId) {
      return;
    }
    const deadline = normalizeDateInput(editAlertDeadline);
    if (!deadline) {
      setNotice("Deadline is required (MM/DD/YYYY).", true);
      return;
    }

    try {
      const response = await fetch(`/api/alerts/${editingAlertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadline,
          notes: editAlertNotes
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update alert");
      }
      await loadAlerts();
      handleAlertEditCancel();
      setNotice("Alert updated.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to update alert", true);
    }
  };

  const handleAlertDelete = async (alert: Alert) => {
    const confirmDelete = window.confirm("Delete this alert?");
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete alert");
      }
      if (editingAlertId === alert.id) {
        handleAlertEditCancel();
      }
      await loadAlerts();
      setNotice("Alert deleted.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to delete alert", true);
    }
  };

  return (
    <section className={`${styles.panel} ${styles.workspacePanel}`}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Alerts</h2>
        <form onSubmit={handleAlertCreate} className={styles.alertForm}>
          <label className={styles.field}>
            <span className={styles.label}>Client</span>
            <select
              className={styles.select}
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              disabled={loadingClients}
            >
              <option value="">
                {loadingClients ? "Loading clients..." : "Select a client"}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={String(client.id)}>
                  {client.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Deadline</span>
            <input
              className={styles.input}
              placeholder="MM/DD/YYYY"
              value={alertDeadline}
              onChange={(event) => setAlertDeadline(event.target.value)}
              onBlur={handleAlertDeadlineBlur}
              disabled={!selectedClient}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Notes</span>
            <textarea
              className={styles.textarea}
              value={alertNotes}
              onChange={(event) => setAlertNotes(event.target.value)}
              disabled={!selectedClient}
            />
          </label>
          <div className={styles.buttonRow}>
            <button
              className={styles.button}
              type="submit"
              disabled={!selectedClient}
            >
              Set Alert
            </button>
            {selectedClient ? (
              <span className={styles.notice}>
                Setting alert for {selectedClient.full_name}.
              </span>
            ) : (
              <span className={styles.notice}>
                Select a client to set a new alert.
              </span>
            )}
          </div>
        </form>

        {loadingAlerts && <p className={styles.notice}>Loading alerts...</p>}
        {!loadingAlerts && sortedAlerts.length === 0 && (
          <p className={styles.notice}>No alerts yet.</p>
        )}
        {!loadingAlerts && sortedAlerts.length > 0 && (
          <div className={styles.alertsTableWrap}>
            <table className={styles.alertsTable}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Phone</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAlerts.map((alert) => {
                  const statusText = calculateAlertStatus(alert.deadline);
                  return (
                    <tr key={alert.id}>
                      <td>{alert.full_name}</td>
                      <td>
                        <span
                          className={`${styles.alertStatus} ${getAlertStatusClass(
                            statusText
                          )}`}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td>{alert.deadline}</td>
                      <td>{alert.primary_phone ?? ""}</td>
                      <td>{alert.notes ?? ""}</td>
                      <td>
                        <div className={styles.alertActions}>
                          <button
                            className={styles.buttonSecondary}
                            type="button"
                            onClick={() => handleAlertEditStart(alert)}
                          >
                            Edit
                          </button>
                          <button
                            className={`${styles.button} ${styles.buttonDanger}`}
                            type="button"
                            onClick={() => handleAlertDelete(alert)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {editingAlertId && (
          <form onSubmit={handleAlertUpdate} className={styles.alertEditPanel}>
            <h3>Edit Alert</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Deadline</span>
                <input
                  className={styles.input}
                  placeholder="MM/DD/YYYY"
                  value={editAlertDeadline}
                  onChange={(event) => setEditAlertDeadline(event.target.value)}
                  onBlur={handleAlertEditDeadlineBlur}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Notes</span>
                <textarea
                  className={styles.textarea}
                  value={editAlertNotes}
                  onChange={(event) => setEditAlertNotes(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.buttonRow}>
              <button className={styles.button} type="submit">
                Save Changes
              </button>
              <button
                className={styles.buttonSecondary}
                type="button"
                onClick={handleAlertEditCancel}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {status && <p className={styles.status}>{status}</p>}
        {error && <p className={styles.status}>Error: {error}</p>}
      </div>
    </section>
  );
}
