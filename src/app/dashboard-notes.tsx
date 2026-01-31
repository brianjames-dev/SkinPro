"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./clients/clients.module.css";
import Button from "./ui/Button";
import Field from "./ui/Field";
import LockableCheckbox from "./ui/LockableCheckbox";
import Notice from "./ui/Notice";
import SearchMenu from "./ui/SearchMenu";
import useKeyboardListNavigation from "../lib/hooks/useKeyboardListNavigation";
import { getTodayDateString } from "@/lib/format";

type ClientOption = {
  id: number;
  full_name: string;
  primary_phone?: string | null;
};

type ClientNote = {
  id: number;
  client_id: number;
  date_seen: string;
  notes?: string | null;
  done_at?: string | null;
  created_at?: string | null;
};

type ClientsResponse = {
  clients?: ClientOption[];
  error?: string;
};

type NotesResponse = {
  notes?: ClientNote[];
  error?: string;
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

const hasNoteText = (value: string) => {
  const stripped = value.replace(/\[\[highlight\]\]|\[\[\/highlight\]\]/g, "").trim();
  return Boolean(stripped);
};

export default function DashboardNotes({
  rootTabs
}: {
  rootTabs: React.ReactNode;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<Record<number, boolean>>(
    {}
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
      .slice(0, 8);
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

  const loadClients = async () => {
    setLoadingClients(true);
    setClientError(null);

    try {
      const response = await fetch("/api/clients?limit=10000");
      const data = (await response.json()) as ClientsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load clients");
      }

      setClients(data.clients ?? []);
    } catch (err) {
      setClientError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setNotes([]);
      setUnlockedNoteIds({});
      setNotesError(null);
      setLoadingNotes(false);
      return;
    }

    const controller = new AbortController();

    const loadNotes = async () => {
      setLoadingNotes(true);
      setNotesError(null);

      try {
        const response = await fetch(
          `/api/notes?client_id=${encodeURIComponent(selectedClientId)}`,
          { signal: controller.signal }
        );
        const data = (await response.json()) as NotesResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load notes");
        }

        setNotes(data.notes ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setNotesError(err instanceof Error ? err.message : "Failed to load notes");
      } finally {
        setLoadingNotes(false);
      }
    };

    void loadNotes();

    return () => controller.abort();
  }, [selectedClientId]);

  const handleSearchClear = () => {
    setClientSearchQuery("");
    setSelectedClientId("");
    setNotes([]);
    setUnlockedNoteIds({});
    setNotesError(null);
    setClientSearchActiveIndex(-1);
  };

  const handleNoteToggleDone = async (note: ClientNote, checked: boolean) => {
    const doneDate = checked ? getTodayDateString() : null;
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done_at: doneDate })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update note");
      }
      setNotes((prev) =>
        prev.map((item) =>
          item.id === note.id ? { ...item, done_at: doneDate } : item
        )
      );
      setUnlockedNoteIds((prev) => {
        if (!prev[note.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
      setNotesError(null);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Failed to update note");
    }
  };

  const toggleNoteLock = (noteId: number) => {
    setUnlockedNoteIds((prev) => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  return (
    <section className={`${styles.panel} ${styles.workspacePanel}`}>
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          {rootTabs}
        </div>

        <div className={styles.clientSearchPanel}>
          <div className={styles.clientSearchRow}>
            <Field>
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
                  setSelectedClientId("");
                  setClientSearchActiveIndex(-1);
                }}
                onKeyDown={(event) => {
                  if (handleClientSearchKeyDown(event)) {
                    return;
                  }
                }}
                disabled={loadingClients}
              />
            </Field>
            <div className={styles.clientSearchActions}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setClientSearchQuery((prev) => prev.trim())}
              >
                Search
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={handleSearchClear}
                className={styles.cancelButton}
              >
                Clear
              </Button>
            </div>
          </div>
          {canShowClientResults && (
            <SearchMenu
              show
              loading={loadingClients}
              loadingMessage="Loading clients..."
              emptyMessage="No clients found."
              items={clientMatches}
              activeIndex={clientSearchActiveIndex}
              onActiveIndexChange={setClientSearchActiveIndex}
              getKey={(client) => client.id}
              getLabel={(client) => client.full_name}
              getMeta={(client) => client.primary_phone || "No phone"}
              onSelect={(client) => {
                setSelectedClientId(String(client.id));
                setClientSearchQuery(client.full_name);
                setClientSearchActiveIndex(-1);
              }}
              containerClassName={styles.clientSearchResults}
              listClassName={styles.clientSearchList}
              itemClassName={styles.clientItem}
              itemActiveClassName={styles.clientItemSelected}
              labelClassName={styles.clientItemName}
              metaClassName={styles.notice}
              labelElement="div"
              metaElement="div"
            />
          )}
          {clientError && <Notice>API error: {clientError}</Notice>}
        </div>

        {!selectedClient && (
          <Notice>Select a client to view their notes.</Notice>
        )}

        {selectedClient && (
          <div className={styles.notesLayout}>
            {loadingNotes && <Notice>Loading notes...</Notice>}
            {notesError && <Notice>API error: {notesError}</Notice>}
            {!loadingNotes && !notesError && notes.length === 0 && (
              <Notice>No notes yet.</Notice>
            )}
            {!loadingNotes && !notesError && notes.length > 0 && (
              <div className={styles.notesList}>
                {notes.map((note) => {
                  const noteText = note.notes ?? "";
                  const isDone = Boolean(note.done_at);
                  const isUnlocked = unlockedNoteIds[note.id] ?? false;
                  const doneLocked = isDone && !isUnlocked;
                  return (
                    <div className={styles.notesItem} key={note.id}>
                      <div className={styles.notesView}>
                        <div className={styles.notesViewRow}>
                          <div className={styles.notesViewBlock}>
                            <div className={styles.notesViewLabel}>Date Seen</div>
                            <div className={styles.notesViewValue}>
                              {note.date_seen || "—"}
                            </div>
                          </div>
                          <div className={styles.notesViewBlock}>
                            <div className={styles.notesViewLabel}>Notes</div>
                            <div className={styles.notesViewText}>
                              {hasNoteText(noteText)
                                ? renderHighlightedValue(noteText)
                                : "No notes yet."}
                            </div>
                          </div>
                          <div className={styles.notesDoneField}>
                            <div className={styles.notesViewLabel}>Done</div>
                            <LockableCheckbox
                              checked={isDone}
                              disabled={doneLocked}
                              label={note.done_at ?? ""}
                              onChange={(checked) =>
                                handleNoteToggleDone(note, checked)
                              }
                              lockVisible={Boolean(note.done_at)}
                              lockActive={isUnlocked}
                              onToggleLock={() => toggleNoteLock(note.id)}
                              lockAriaLabel={
                                isUnlocked
                                  ? "Lock done status"
                                  : "Unlock done status"
                              }
                              className={styles.notesDoneToggle}
                              labelClassName={styles.notesDoneLabel}
                              lockButtonClassName={styles.notesLockButton}
                              lockButtonActiveClassName={
                                styles.notesLockButtonUnlocked
                              }
                              lockIconClassName={styles.notesLockIcon}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
