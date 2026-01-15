"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./clients/clients.module.css";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import ButtonRow from "./ui/ButtonRow";
import CloseButton from "./ui/CloseButton";
import ConfirmDialog from "./ui/ConfirmDialog";
import Field from "./ui/Field";
import HighlightTextarea from "./ui/HighlightTextarea";
import Notice from "./ui/Notice";
import SearchMenu from "./ui/SearchMenu";
import StatusMessage from "./ui/StatusMessage";
import UnsavedChangesPrompt from "./ui/UnsavedChangesPrompt";
import useUnsavedChangesGuard from "./ui/useUnsavedChangesGuard";
import { useUnsavedChangesRegistry } from "./ui/UnsavedChangesContext";
import { applyHighlightToRaw } from "@/lib/highlightText";
import { formatDateInput, normalizeDateInput } from "@/lib/format";
import { parseDateParts, parseMmddyyyy } from "@/lib/parse";
import useKeyboardListNavigation from "../lib/hooks/useKeyboardListNavigation";

type MaintenanceEntry = {
  id: number;
  client_id: number;
  full_name: string;
  primary_phone?: string | null;
  last_talked_date: string;
  notes?: string | null;
};

type ClientOption = {
  id: number;
  full_name: string;
  primary_phone?: string | null;
};

type MaintenanceResponse = {
  maintenance?: MaintenanceEntry[];
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
  const stripped = trimmed.replace(/\[h\]|\[\/h\]/g, "").trim();
  return stripped ? trimmed : "—";
};

const renderHighlightedValue = (value: string) => {
  const tokens = value.split(/(\[h\]|\[\/h\])/);
  const nodes: React.ReactNode[] = [];
  let isHighlighted = false;
  tokens.forEach((token, index) => {
    if (token === "[h]") {
      isHighlighted = true;
      return;
    }
    if (token === "[/h]") {
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

export default function DashboardMaintenance({
  rootTabs
}: {
  rootTabs: React.ReactNode;
}) {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [lastTalkedDate, setLastTalkedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editLastTalkedDate, setEditLastTalkedDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MaintenanceEntry | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<
    "create" | "edit" | null
  >(null);

  const setNotice = (message: string | null, isError = false) => {
    if (isError) {
      setError(message);
      setStatus(null);
    } else {
      setStatus(message);
      setError(null);
    }
  };

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
      setClientSearchActiveIndex(-1);
    }
  });

  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) =>
        parseMmddyyyy(a.last_talked_date) - parseMmddyyyy(b.last_talked_date)
    );
  }, [entries]);

  const getStatusClass = (statusText: string) => {
    if (statusText.includes("Overdue")) {
      return styles.alertStatusRed;
    }
    if (statusText.includes("Tomorrow") || statusText.includes("Upcoming")) {
      return styles.alertStatusOrange;
    }
    if (statusText.includes("days")) {
      return styles.alertStatusYellow;
    }
    if (statusText === "Invalid date") {
      return styles.alertStatusGray;
    }
    return styles.alertStatusGreen;
  };

  const loadEntries = async () => {
    setLoadingEntries(true);
    try {
      const response = await fetch("/api/maintenance");
      const data = (await response.json()) as MaintenanceResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load maintenance");
      }
      setEntries(data.maintenance ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load maintenance");
    } finally {
      setLoadingEntries(false);
    }
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const response = await fetch("/api/clients");
      const data = (await response.json()) as ClientsResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load clients");
      }
      setClients(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    void loadEntries();
    void loadClients();
  }, []);

  const getMaintenanceSnapshot = useCallback(
    () =>
      JSON.stringify({
        mode: isFormOpen ? "create" : editingEntryId ? "edit" : "idle",
        selectedClientId,
        clientSearchQuery,
        lastTalkedDate,
        notes,
        editingEntryId,
        editLastTalkedDate,
        editNotes
      }),
    [
      isFormOpen,
      editingEntryId,
      selectedClientId,
      clientSearchQuery,
      lastTalkedDate,
      notes,
      editLastTalkedDate,
      editNotes
    ]
  );

  const saveMaintenanceCreate = async () => {
    if (!selectedClient) {
      setNotice("Select a client before logging maintenance.", true);
      return false;
    }
    const date = normalizeDateInput(lastTalkedDate);
    if (!date) {
      setNotice("Date is required (MM/DD/YYYY).", true);
      return false;
    }

    try {
      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          last_talked_date: date,
          notes
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create maintenance entry");
      }
      resetForm();
      setIsFormOpen(false);
      await loadEntries();
      setNotice("Maintenance entry created.");
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to create entry",
        true
      );
      return false;
    }
  };

  const saveMaintenanceUpdate = async () => {
    if (!editingEntryId) {
      return false;
    }
    const date = normalizeDateInput(editLastTalkedDate);
    if (!date) {
      setNotice("Date is required (MM/DD/YYYY).", true);
      return false;
    }

    try {
      const response = await fetch(`/api/maintenance/${editingEntryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          last_talked_date: date,
          notes: editNotes
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update maintenance entry");
      }
      await loadEntries();
      handleEditCancel();
      setNotice("Maintenance entry updated.");
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to update entry",
        true
      );
      return false;
    }
  };

  const maintenanceGuard = useUnsavedChangesGuard({
    isEnabled: isFormOpen || editingEntryId !== null,
    getSnapshot: getMaintenanceSnapshot,
    onSave: async () =>
      editingEntryId
        ? saveMaintenanceUpdate()
        : isFormOpen
          ? saveMaintenanceCreate()
          : true,
    onDiscard: () => {
      if (editingEntryId) {
        handleEditCancel();
      }
      if (isFormOpen) {
        resetForm();
        setIsFormOpen(false);
      }
    }
  });

  useUnsavedChangesRegistry("maintenance", {
    isDirty: maintenanceGuard.isDirty,
    requestExit: maintenanceGuard.requestExit
  });

  useEffect(() => {
    if (isFormOpen || editingEntryId !== null) {
      maintenanceGuard.markSnapshot();
    }
  }, [isFormOpen, editingEntryId]);

  const resetForm = () => {
    setSelectedClientId("");
    setClientSearchQuery("");
    setClientSearchActiveIndex(-1);
    setLastTalkedDate("");
    setNotes("");
    setHighlightTarget(null);
  };

  const handleHighlight = () => {
    if (!highlightTarget) {
      setStatus("Select text to highlight.");
      return;
    }
    const textareaId =
      highlightTarget === "create"
        ? "maintenance-notes-create"
        : "maintenance-notes-edit";
    const textarea = document.getElementById(
      textareaId
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      setStatus("Select text to highlight.");
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    if (start === end) {
      setStatus("Select text to highlight.");
      textarea.focus();
      return;
    }
    if (highlightTarget === "create") {
      const nextRaw = applyHighlightToRaw(notes ?? "", start, end);
      setNotes(nextRaw);
    } else {
      const nextRaw = applyHighlightToRaw(editNotes ?? "", start, end);
      setEditNotes(nextRaw);
    }
    setTimeout(() => textarea.focus(), 0);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveMaintenanceCreate();
  };

  const handleEditStart = (entry: MaintenanceEntry) => {
    maintenanceGuard.requestExit(() => {
      setEditingEntryId(entry.id);
      setEditLastTalkedDate(entry.last_talked_date ?? "");
      setEditNotes(entry.notes ?? "");
    });
  };

  const handleEditCancel = () => {
    setEditingEntryId(null);
    setEditLastTalkedDate("");
    setEditNotes("");
    setHighlightTarget(null);
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveMaintenanceUpdate();
  };

  const handleDelete = async (entry: MaintenanceEntry) => {
    try {
      const response = await fetch(`/api/maintenance/${entry.id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete maintenance");
      }
      if (editingEntryId === entry.id) {
        handleEditCancel();
      }
      const refreshed = await fetch("/api/maintenance");
      const refreshedData = (await refreshed.json()) as MaintenanceResponse;
      setEntries(refreshedData.maintenance ?? []);
      setStatus("Maintenance entry deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete maintenance");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) {
      return;
    }
    const entry = pendingDelete;
    setPendingDelete(null);
    await handleDelete(entry);
  };

  return (
    <section className={`${styles.panel} ${styles.workspacePanel}`}>
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          {rootTabs}
          {!isFormOpen && (
            <Button
              type="button"
              onClick={() => maintenanceGuard.requestExit(() => setIsFormOpen(true))}
            >
              New Maintenance
            </Button>
          )}
        </div>
        {isFormOpen && (
          <form onSubmit={handleCreate} className={styles.alertForm}>
            <CloseButton
              className={styles.alertCloseButton}
              onClick={() =>
                maintenanceGuard.requestExit(() => {
                  resetForm();
                  setIsFormOpen(false);
                })
              }
              aria-label="Cancel maintenance"
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
            <Field label="Date last talked to">
              <input
                className={styles.input}
                placeholder="MM/DD/YYYY"
                inputMode="numeric"
                value={lastTalkedDate}
                onChange={(event) =>
                  setLastTalkedDate(formatDateInput(event.target.value))
                }
                disabled={!selectedClient}
              />
            </Field>
            <Field label="Notes">
              <HighlightTextarea
                value={notes}
                placeholder=""
                onChange={setNotes}
                onFocus={() => setHighlightTarget("create")}
                textareaProps={{ id: "maintenance-notes-create" }}
              />
            </Field>
            <ButtonRow className={styles.alertFormActions}>
              <Button type="submit" disabled={!selectedClient}>
                Save Maintenance
              </Button>
              <Button
                variant="secondary"
                type="button"
                className={styles.cancelButton}
                onClick={() =>
                  maintenanceGuard.requestExit(() => {
                    resetForm();
                    setIsFormOpen(false);
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
              >
                Highlight
              </Button>
              {selectedClient ? (
                <Notice as="span">
                  Logging maintenance for {selectedClient.full_name}.
                </Notice>
              ) : (
                <Notice as="span">Select a client to add maintenance.</Notice>
              )}
            </ButtonRow>
          </form>
        )}

        {loadingEntries && <Notice>Loading maintenance...</Notice>}
        {!loadingEntries && sortedEntries.length === 0 && (
          <Notice>No maintenance entries yet.</Notice>
        )}
        {!loadingEntries && sortedEntries.length > 0 && (
          <div className={styles.alertsTableWrap}>
            <table className={styles.alertsTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Timeline</th>
                  <th>Date Last Talked To</th>
                  <th>Number</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => {
                  const statusText = calculateAlertStatus(entry.last_talked_date);
                  return (
                    <tr key={entry.id}>
                      <td>{entry.full_name}</td>
                      <td>
                        <Badge
                          baseClassName={styles.alertStatus}
                          toneClassName={getStatusClass(statusText)}
                        >
                          {statusText}
                        </Badge>
                      </td>
                      <td>{entry.last_talked_date}</td>
                      <td>{entry.primary_phone ?? ""}</td>
                      <td>
                        {renderHighlightedValue(
                          formatCompactValue(entry.notes ?? "")
                        )}
                      </td>
                      <td>
                        <div className={styles.alertActions}>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => handleEditStart(entry)}
                          >
                            Edit
                          </Button>
                          <Button
                            danger
                            type="button"
                            onClick={() => setPendingDelete(entry)}
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

        {editingEntryId && (
          <form onSubmit={handleUpdate} className={styles.alertEditPanel}>
            <CloseButton
              className={styles.alertCloseButton}
              onClick={() => maintenanceGuard.requestExit(handleEditCancel)}
              aria-label="Cancel maintenance edit"
              title="Cancel"
            />
            <h3>Edit Maintenance</h3>
            <div className={styles.formGrid}>
              <Field label="Date last talked to">
                <input
                  className={styles.input}
                  placeholder="MM/DD/YYYY"
                  inputMode="numeric"
                  value={editLastTalkedDate}
                  onChange={(event) =>
                    setEditLastTalkedDate(formatDateInput(event.target.value))
                  }
                />
              </Field>
              <Field label="Notes">
                <HighlightTextarea
                  value={editNotes}
                  placeholder=""
                  onChange={setEditNotes}
                  onFocus={() => setHighlightTarget("edit")}
                  textareaProps={{ id: "maintenance-notes-edit" }}
                />
              </Field>
            </div>
            <ButtonRow>
              <Button type="submit">Save Changes</Button>
              <Button
                variant="secondary"
                type="button"
                className={styles.cancelButton}
                onClick={() => maintenanceGuard.requestExit(handleEditCancel)}
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
          open={Boolean(pendingDelete)}
          title="Delete Maintenance"
          message={
            pendingDelete
              ? `Delete the maintenance entry for ${pendingDelete.full_name}?`
              : "Delete this maintenance entry?"
          }
          confirmLabel="Delete"
          confirmDanger
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDeleteConfirm}
        />

        {status && <StatusMessage>{status}</StatusMessage>}
        {error && <StatusMessage>Error: {error}</StatusMessage>}
      </div>
      <UnsavedChangesPrompt
        open={maintenanceGuard.prompt.open}
        onDiscard={maintenanceGuard.prompt.onDiscard}
        onSave={maintenanceGuard.prompt.onSave}
        onStay={maintenanceGuard.prompt.onStay}
      />
    </section>
  );
}
