"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./clients/clients.module.css";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import ButtonRow from "./ui/ButtonRow";
import ConfirmDialog from "./ui/ConfirmDialog";
import Field from "./ui/Field";
import HighlightTextarea from "./ui/HighlightTextarea";
import Notice from "./ui/Notice";
import SearchMenu from "./ui/SearchMenu";
import StatusMessage from "./ui/StatusMessage";
import CloseButton from "./ui/CloseButton";
import UnsavedChangesPrompt from "./ui/UnsavedChangesPrompt";
import useUnsavedChangesGuard from "./ui/useUnsavedChangesGuard";
import { useUnsavedChangesRegistry } from "./ui/UnsavedChangesContext";
import { toggleHighlightInRaw } from "@/lib/highlightText";
import { formatDateInput, normalizeDateInput } from "@/lib/format";
import { parseDateParts, parseMmddyyyy } from "@/lib/parse";
import useKeyboardListNavigation from "../lib/hooks/useKeyboardListNavigation";

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
    return "1 day - Tomorrow";
  }
  if (diffDays === 0) {
    return "Due Today";
  }
  const overdueDays = Math.abs(diffDays);
  return `${overdueDays} day${overdueDays === 1 ? "" : "s"} - Overdue`;
};

const formatCompactValue = (value: string) => {
  const trimmed = value.trim();
  const stripped = trimmed
    .replace(/\[\[highlight\]\]|\[\[\/highlight\]\]/g, "")
    .trim();
  return stripped ? trimmed : "-";
};

const renderHighlightedValue = (value: string) => {
  const tokens = value.split(/(\[\[highlight\]\]|\[\[\/highlight\]\])/);
  const nodes: React.ReactNode[] = [];
  let isHighlighted = false;
  tokens.forEach((token, index) => {
    if (token === "[[highlight]]") {
      isHighlighted = true;
      return;
    }
    if (token === "[[/highlight]]") {
      isHighlighted = false;
      return;
    }
    if (!token) {
      return;
    }
    nodes.push(
      <span className={isHighlighted ? styles.highlightText : undefined} key={index}>
        {token}
      </span>
    );
  });
  return nodes;
};

export default function DashboardAlerts({
  rootTabs
}: {
  rootTabs: React.ReactNode;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [alertDeadline, setAlertDeadline] = useState("");
  const [alertNotes, setAlertNotes] = useState("");
  const [editingAlertId, setEditingAlertId] = useState<number | null>(null);
  const [editAlertDeadline, setEditAlertDeadline] = useState("");
  const [editAlertNotes, setEditAlertNotes] = useState("");
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false);
  const [alertPendingDelete, setAlertPendingDelete] = useState<Alert | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [isMovingAlert, setIsMovingAlert] = useState(false);
  const editPanelRef = useRef<HTMLFormElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<"create" | "edit" | null>(
    null
  );

  const selectedClient = useMemo(() => {
    const id = Number(selectedClientId);
    if (!Number.isFinite(id)) {
      return null;
    }
    return clients.find((client) => client.id === id) ?? null;
  }, [clients, selectedClientId]);

  const clientMatches = useMemo(() => {
    const query = clientSearchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return clients
      .filter((client) => client.full_name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [clients, clientSearchQuery]);

  const hasClientSearchQuery = clientSearchQuery.trim().length > 0;
  const canShowClientResults = hasClientSearchQuery && !selectedClientId;
  const {
    activeIndex: clientSearchActiveIndex,
    setActiveIndex: setClientSearchActiveIndex,
    onKeyDown: handleClientSearchKeyDown
  } = useKeyboardListNavigation<ClientOption>({
    items: clientMatches,
    isOpen: canShowClientResults,
    onSelect: (client) => {
      setSelectedClientId(String(client.id));
      setClientSearchQuery(client.full_name);
    }
  });

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => parseMmddyyyy(a.deadline) - parseMmddyyyy(b.deadline));
  }, [alerts]);

  const selectedAlert = useMemo(
    () => alerts.find((alert) => alert.id === selectedAlertId) ?? null,
    [alerts, selectedAlertId]
  );

  useEffect(() => {
    if (selectedAlertId && !alerts.some((alert) => alert.id === selectedAlertId)) {
      setSelectedAlertId(null);
    }
  }, [alerts, selectedAlertId]);

  const getAlertStatusClass = (statusText: string) => {
    if (statusText.includes("Overdue")) {
      return styles.alertStatusRed;
    }
    if (statusText.includes("Due Today")) {
      return styles.alertStatusOrange;
    }
    if (statusText.includes("Tomorrow") || statusText.includes("Upcoming")) {
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

  const getAlertSnapshot = useCallback(
    () =>
      JSON.stringify({
        mode: isAlertFormOpen ? "create" : editingAlertId ? "edit" : "idle",
        selectedClientId,
        clientSearchQuery,
        alertDeadline,
        alertNotes,
        editingAlertId,
        editAlertDeadline,
        editAlertNotes
      }),
    [
      isAlertFormOpen,
      editingAlertId,
      selectedClientId,
      clientSearchQuery,
      alertDeadline,
      alertNotes,
      editAlertDeadline,
      editAlertNotes
    ]
  );

  const saveAlertCreate = async () => {
    if (!selectedClient) {
      setNotice("Select a client before setting an alert.", true);
      return false;
    }
    if (!selectedClient.primary_phone) {
      setNotice("Client needs a primary phone number before alerts.", true);
      return false;
    }
    const deadline = normalizeDateInput(alertDeadline);
    if (!deadline) {
      setNotice("Deadline is required (MM/DD/YYYY).", true);
      return false;
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
      resetAlertForm();
      setIsAlertFormOpen(false);
      await loadAlerts();
      setNotice("Alert created.");
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to create alert", true);
      return false;
    }
  };

  const saveAlertUpdate = async () => {
    if (!editingAlertId) {
      return false;
    }
    const deadline = normalizeDateInput(editAlertDeadline);
    if (!deadline) {
      setNotice("Deadline is required (MM/DD/YYYY).", true);
      return false;
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
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to update alert", true);
      return false;
    }
  };

  const alertGuard = useUnsavedChangesGuard({
    isEnabled: isAlertFormOpen || editingAlertId !== null,
    getSnapshot: getAlertSnapshot,
    onSave: async () =>
      editingAlertId ? saveAlertUpdate() : isAlertFormOpen ? saveAlertCreate() : true,
    onDiscard: () => {
      if (editingAlertId) {
        handleAlertEditCancel();
      }
      if (isAlertFormOpen) {
        resetAlertForm();
        setIsAlertFormOpen(false);
      }
    }
  });

  useUnsavedChangesRegistry("alerts", {
    isDirty: alertGuard.isDirty,
    requestExit: alertGuard.requestExit
  });

  useEffect(() => {
    if (isAlertFormOpen || editingAlertId !== null) {
      alertGuard.markSnapshot();
    }
  }, [isAlertFormOpen, editingAlertId]);

  const resetAlertForm = () => {
    setSelectedClientId("");
    setClientSearchQuery("");
    setClientSearchActiveIndex(-1);
    setAlertDeadline("");
    setAlertNotes("");
    setHighlightTarget(null);
  };

  const handleAlertCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveAlertCreate();
  };

  const handleAlertEditStart = (alert: Alert) => {
    alertGuard.requestExit(() => {
      setEditingAlertId(alert.id);
      setEditAlertDeadline(alert.deadline ?? "");
      setEditAlertNotes(alert.notes ?? "");
    });
  };

  useEffect(() => {
    if (!editingAlertId) {
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let observer: ResizeObserver | null = null;

    const scrollToBottom = () => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth"
      });
    };

    const run = () => {
      scrollToBottom();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(scrollToBottom, 140);
    };

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(run);
      observer.observe(document.body);
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (observer) {
        observer.disconnect();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [editingAlertId]);

  const handleAlertEditCancel = () => {
    setEditingAlertId(null);
    setEditAlertDeadline("");
    setEditAlertNotes("");
    setHighlightTarget(null);
  };

  const handleAlertUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveAlertUpdate();
  };

  const handleAlertDelete = async (alert: Alert) => {
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

  const handleAlertDeleteConfirm = async () => {
    if (!alertPendingDelete) {
      return;
    }
    const alert = alertPendingDelete;
    setAlertPendingDelete(null);
    await handleAlertDelete(alert);
  };

  const handleHighlight = () => {
    if (!highlightTarget) {
      setNotice("Select text to highlight.");
      return;
    }
    const textareaId =
      highlightTarget === "create" ? "alert-notes-create" : "alert-notes-edit";
    const textarea = document.getElementById(
      textareaId
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      setNotice("Select text to highlight.");
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    if (start === end) {
      setNotice("Select text to highlight.");
      textarea.focus();
      return;
    }
    if (highlightTarget === "create") {
      const nextRaw = toggleHighlightInRaw(alertNotes ?? "", start, end);
      setAlertNotes(nextRaw);
    } else {
      const nextRaw = toggleHighlightInRaw(editAlertNotes ?? "", start, end);
      setEditAlertNotes(nextRaw);
    }
    setTimeout(() => textarea.focus(), 0);
  };

  const moveAlertToMaintenance = async (alert: Alert) => {
    setIsMovingAlert(true);
    try {
      const createResponse = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: alert.client_id,
          last_talked_date: alert.deadline,
          notes: alert.notes ?? ""
        })
      });
      const createData = (await createResponse.json()) as { error?: string };
      if (!createResponse.ok) {
        throw new Error(createData.error ?? "Failed to create maintenance entry");
      }

      const deleteResponse = await fetch(`/api/alerts/${alert.id}`, {
        method: "DELETE"
      });
      const deleteData = (await deleteResponse.json()) as { error?: string };
      if (!deleteResponse.ok) {
        throw new Error(deleteData.error ?? "Failed to delete alert");
      }

      setSelectedAlertId(null);
      await loadAlerts();
      setNotice("Moved alert to maintenance.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to move alert",
        true
      );
    } finally {
      setIsMovingAlert(false);
    }
  };

  const handleMoveAlert = () => {
    if (!selectedAlert) {
      return;
    }
    alertGuard.requestExit(() => {
      void moveAlertToMaintenance(selectedAlert);
    });
  };

  return (
    <section className={`${styles.panel} ${styles.workspacePanel}`}>
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          {rootTabs}
          <div className={styles.sectionHeaderActions}>
            {selectedAlert && !isAlertFormOpen && (
              <Button
                variant="secondary"
                type="button"
                onClick={handleMoveAlert}
                disabled={isMovingAlert}
              >
                {isMovingAlert ? "Moving..." : "Move to Maintenance"}
              </Button>
            )}
            {!isAlertFormOpen && (
              <Button
                type="button"
                onClick={() =>
                  alertGuard.requestExit(() => setIsAlertFormOpen(true))
                }
                disabled={isMovingAlert}
              >
                New Alert
              </Button>
            )}
          </div>
        </div>
        {isAlertFormOpen && (
          <form onSubmit={handleAlertCreate} className={styles.alertForm}>
            <CloseButton
              className={styles.alertCloseButton}
              onClick={() =>
                alertGuard.requestExit(() => {
                  resetAlertForm();
                  setIsAlertFormOpen(false);
                })
              }
              aria-label="Cancel alert"
              title="Cancel"
            />
            <Field label="Client">
              <div className={styles.referredByField}>
                <input
                  className={styles.input}
                  name="client-search"
                  placeholder="Search client name"
                  value={clientSearchQuery}
                  aria-label="Search client name"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setClientSearchQuery(event.target.value);
                    if (selectedClientId) {
                      setSelectedClientId("");
                    }
                    setClientSearchActiveIndex(-1);
                  }}
                  onKeyDown={(event) => {
                    if (handleClientSearchKeyDown(event)) {
                      return;
                    }
                  }}
                  disabled={loadingClients}
                />
                {canShowClientResults && (
                  <SearchMenu
                    show
                    loading={loadingClients}
                    loadingMessage="Loading clients..."
                    emptyMessage="No results"
                    items={clientMatches}
                    activeIndex={clientSearchActiveIndex}
                    onActiveIndexChange={setClientSearchActiveIndex}
                    getKey={(client) => client.id}
                    getLabel={(client) => client.full_name}
                    getMeta={(client) => client.primary_phone ?? ""}
                    onSelect={(client) => {
                      setSelectedClientId(String(client.id));
                      setClientSearchQuery(client.full_name);
                      setClientSearchActiveIndex(-1);
                    }}
                    containerClassName={styles.referredByResults}
                    listClassName={styles.referredByList}
                    itemClassName={styles.referredByItem}
                    itemSelectedClassName={styles.referredByItemSelected}
                    itemActiveClassName={styles.referredByItemSelected}
                    labelClassName={styles.referredByName}
                    metaClassName={styles.referredByMeta}
                    emptyClassName={styles.referredByEmpty}
                    labelElement="span"
                    metaElement="span"
                  />
                )}
              </div>
            </Field>
            <Field label="Deadline">
              <input
                className={styles.input}
                placeholder="MM/DD/YYYY"
                inputMode="numeric"
                value={alertDeadline}
                onChange={(event) =>
                  setAlertDeadline(formatDateInput(event.target.value))
                }
                disabled={!selectedClient}
              />
            </Field>
            <Field label="Notes">
              <HighlightTextarea
                value={alertNotes}
                placeholder=""
                onChange={setAlertNotes}
                onFocus={() => setHighlightTarget("create")}
                textareaProps={{
                  id: "alert-notes-create",
                  disabled: !selectedClient
                }}
              />
            </Field>
            <ButtonRow className={styles.alertFormActions}>
              <Button type="submit" disabled={!selectedClient}>
                Set Alert
              </Button>
              <Button
                variant="secondary"
                type="button"
                className={styles.cancelButton}
                onClick={() =>
                  alertGuard.requestExit(() => {
                    resetAlertForm();
                    setIsAlertFormOpen(false);
                  })
                }
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                type="button"
                className={styles.highlightButton}
                onClick={handleHighlight}
                disabled={!selectedClient}
              >
                Highlight
              </Button>
              {selectedClient ? (
                <Notice as="span">
                  Setting alert for {selectedClient.full_name}.
                </Notice>
              ) : (
                <Notice as="span">Select a client to set a new alert.</Notice>
              )}
            </ButtonRow>
          </form>
        )}

        {loadingAlerts && <Notice>Loading alerts...</Notice>}
        {!loadingAlerts && sortedAlerts.length === 0 && (
          <Notice>No alerts yet.</Notice>
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
                  const isSelected = alert.id === selectedAlertId;
                  return (
                    <tr
                      key={alert.id}
                      className={isSelected ? styles.tableRowSelected : undefined}
                      onClick={() =>
                        setSelectedAlertId(isSelected ? null : alert.id)
                      }
                      aria-selected={isSelected}
                    >
                      <td>{alert.full_name}</td>
                      <td>
                        <Badge
                          baseClassName={styles.alertStatus}
                          toneClassName={getAlertStatusClass(statusText)}
                        >
                          {statusText}
                        </Badge>
                      </td>
                      <td>{alert.deadline}</td>
                      <td>{alert.primary_phone ?? ""}</td>
                      <td>
                        {renderHighlightedValue(
                          formatCompactValue(alert.notes ?? "")
                        )}
                      </td>
                      <td>
                        <div className={styles.alertActions}>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAlertEditStart(alert);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            danger
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAlertPendingDelete(alert);
                            }}
                          >
                            Delete
                          </Button>
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
          <form
            ref={editPanelRef}
            onSubmit={handleAlertUpdate}
            className={styles.alertEditPanel}
          >
            <CloseButton
              className={styles.alertCloseButton}
              onClick={() => alertGuard.requestExit(handleAlertEditCancel)}
              aria-label="Cancel alert edit"
              title="Cancel"
            />
            <h3>Edit Alert</h3>
            <div className={styles.formGrid}>
              <Field label="Deadline">
                <input
                  className={styles.input}
                  placeholder="MM/DD/YYYY"
                  inputMode="numeric"
                  value={editAlertDeadline}
                  onChange={(event) =>
                    setEditAlertDeadline(formatDateInput(event.target.value))
                  }
                />
              </Field>
              <Field label="Notes">
                <HighlightTextarea
                  value={editAlertNotes}
                  placeholder=""
                  onChange={setEditAlertNotes}
                  onFocus={() => setHighlightTarget("edit")}
                  textareaProps={{ id: "alert-notes-edit" }}
                />
              </Field>
            </div>
            <ButtonRow>
              <Button type="submit">Save Changes</Button>
              <Button
                variant="secondary"
                type="button"
                className={styles.cancelButton}
                onClick={() => alertGuard.requestExit(handleAlertEditCancel)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                type="button"
                className={styles.highlightButton}
                onClick={handleHighlight}
              >
                Highlight
              </Button>
            </ButtonRow>
          </form>
        )}

        <ConfirmDialog
          open={Boolean(alertPendingDelete)}
          title="Delete Alert"
          message={
            alertPendingDelete
              ? `Delete the alert for ${alertPendingDelete.full_name}?`
              : "Delete this alert?"
          }
          confirmLabel="Delete"
          confirmDanger
          onCancel={() => setAlertPendingDelete(null)}
          onConfirm={handleAlertDeleteConfirm}
        />

        {status && <StatusMessage>{status}</StatusMessage>}
        {error && <StatusMessage>Error: {error}</StatusMessage>}
      </div>
      <UnsavedChangesPrompt
        open={alertGuard.prompt.open}
        onDiscard={alertGuard.prompt.onDiscard}
        onSave={alertGuard.prompt.onSave}
        onStay={alertGuard.prompt.onStay}
      />
    </section>
  );
}
