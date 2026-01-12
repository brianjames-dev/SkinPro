"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./clients/clients.module.css";
import Button from "./ui/Button";
import ButtonLink from "./ui/ButtonLink";
import Field from "./ui/Field";
import Notice from "./ui/Notice";
import { formatAddress } from "@/lib/format";

type Client = {
  id: number;
  full_name: string;
  gender?: string | null;
  birthdate?: string | null;
  primary_phone?: string | null;
  email?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type ClientsResponse = {
  clients: Client[];
  error?: string;
};

export default function DashboardClients() {
  const router = useRouter();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const loadClients = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: "10000" });
      const response = await fetch(`/api/clients?${params.toString()}`);
      const data = (await response.json()) as ClientsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load clients");
      }

      const nextClients = data.clients ?? [];
      setAllClients(nextClients);
      setSelectedClientId((prev) => {
        if (!prev) {
          return prev;
        }
        return nextClients.some((client) => client.id === prev) ? prev : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return allClients;
    }
    return allClients.filter((client) =>
      client.full_name.toLowerCase().includes(normalizedQuery)
    );
  }, [allClients, searchQuery]);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }
    const stillVisible = filteredClients.some(
      (client) => client.id === selectedClientId
    );
    if (!stillVisible) {
      setSelectedClientId(null);
    }
  }, [filteredClients, selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }
    const row = document.getElementById(`client-row-${selectedClientId}`);
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [selectedClientId]);

  const handleSearch = () => {
    setSearchQuery((prev) => prev.trim());
  };

  const handleSearchSelectClient = (clientId: number) => {
    setSelectedClientId(clientId);
    setSearchQuery("");
  };

  const handleSearchOpenWorkspace = (clientId: number) => {
    handleSearchSelectClient(clientId);
    openWorkspace(clientId);
  };

  const handleClear = () => {
    setSearchQuery("");
  };

  const openWorkspace = (clientId: number) => {
    router.push(`/clients?clientId=${clientId}`);
  };

  const handleOpenWorkspace = () => {
    if (selectedClientId) {
      openWorkspace(selectedClientId);
    }
  };

  const handleTableKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (filteredClients.length === 0) {
      return;
    }

    const currentIndex = filteredClients.findIndex(
      (client) => client.id === selectedClientId
    );

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex =
        currentIndex < 0
          ? 0
          : Math.min(currentIndex + 1, filteredClients.length - 1);
      setSelectedClientId(filteredClients[nextIndex].id);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        currentIndex < 0
          ? filteredClients.length - 1
          : Math.max(currentIndex - 1, 0);
      setSelectedClientId(filteredClients[nextIndex].id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setSelectedClientId(filteredClients[0].id);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setSelectedClientId(filteredClients[filteredClients.length - 1].id);
      return;
    }

    if (event.key === "Enter" && selectedClientId) {
      event.preventDefault();
      openWorkspace(selectedClientId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSelectedClientId(null);
    }
  };

  const renderRows = () => {
    if (loading) {
      return (
        <tr>
          <td className={styles.tableEmpty} colSpan={6}>
            Loading clients...
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td className={styles.tableEmpty} colSpan={6}>
            API error: {error}
          </td>
        </tr>
      );
    }

    if (filteredClients.length === 0) {
      return (
        <tr>
          <td className={styles.tableEmpty} colSpan={6}>
            No clients found.
          </td>
        </tr>
      );
    }

    return filteredClients.map((client) => (
      <tr
        key={client.id}
        id={`client-row-${client.id}`}
        className={
          selectedClientId === client.id ? styles.tableRowSelected : undefined
        }
        onClick={() => handleSearchSelectClient(client.id)}
        onDoubleClick={() => {
          handleSearchOpenWorkspace(client.id);
        }}
        role="option"
        aria-selected={selectedClientId === client.id}
      >
        <td>{client.full_name}</td>
        <td>{client.gender || "-"}</td>
        <td>{client.birthdate || "-"}</td>
        <td>{client.primary_phone || "-"}</td>
        <td>{client.email || "-"}</td>
        <td>{formatAddress(client) || "-"}</td>
      </tr>
    ));
  };

  const addClientName = searchQuery.trim();
  const addClientHref = addClientName
    ? `/clients?newClient=1&newClientName=${encodeURIComponent(addClientName)}`
    : "/clients?newClient=1";

  return (
    <section className={`${styles.panel} ${styles.clientsTablePanel}`}>
      <div className={styles.tableHeader}>
        <div>
          <h2 className={styles.tableTitle}>Clients Directory</h2>
          <Notice>
            Search by name or open the workspace to edit details.
          </Notice>
        </div>
        <div className={styles.tableActions}>
          <Button
            type="button"
            onClick={handleOpenWorkspace}
            disabled={!selectedClientId}
          >
            Open Workspace
          </Button>
        </div>
      </div>

      <div className={styles.searchBar}>
        <Field>
          <input
            className={styles.input}
            name="search"
            placeholder="Search client name"
            value={searchQuery}
            aria-label="Search client name"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && filteredClients.length > 0) {
                event.preventDefault();
                const currentIndex = filteredClients.findIndex(
                  (client) => client.id === selectedClientId
                );
                const nextIndex =
                  currentIndex < 0
                    ? 0
                    : Math.min(currentIndex + 1, filteredClients.length - 1);
                setSelectedClientId(filteredClients[nextIndex].id);
                return;
              }

              if (event.key === "ArrowUp" && filteredClients.length > 0) {
                event.preventDefault();
                const currentIndex = filteredClients.findIndex(
                  (client) => client.id === selectedClientId
                );
                const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
                setSelectedClientId(filteredClients[nextIndex].id);
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                if (selectedClientId) {
                  handleSearchOpenWorkspace(selectedClientId);
                  return;
                }
                handleSearch();
              }
            }}
          />
        </Field>
        <Button variant="secondary" type="button" onClick={handleSearch}>
          Search
        </Button>
        <Button variant="secondary" type="button" onClick={handleClear}>
          Clear
        </Button>
        <ButtonLink variant="secondary" href={addClientHref}>
          Add Client
        </ButtonLink>
      </div>

      <div
        className={styles.tableWrap}
        tabIndex={0}
        role="listbox"
        aria-label="Client directory"
        onKeyDown={handleTableKeyDown}
        onMouseDown={(event) => {
          event.currentTarget.focus();
        }}
      >
        <table className={styles.clientsTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Gender</th>
              <th>Birthdate</th>
              <th>Primary #</th>
              <th>Email</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>{renderRows()}</tbody>
        </table>
      </div>
    </section>
  );
}
