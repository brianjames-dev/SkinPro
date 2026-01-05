"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./clients.module.css";

type Client = {
  id: number;
  full_name: string;
  gender?: string | null;
  birthdate?: string | null;
  primary_phone?: string | null;
  secondary_phone?: string | null;
  email?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  referred_by?: string | null;
  profile_picture?: string | null;
};

type HealthInfo = {
  allergies?: string | null;
  health_conditions?: string | null;
  health_risks?: string | null;
  medications?: string | null;
  treatment_areas?: string | null;
  current_products?: string | null;
  skin_conditions?: string | null;
  other_notes?: string | null;
  desired_improvement?: string | null;
};

type Appointment = {
  id: number;
  client_id: number;
  date: string;
  type: string;
  treatment?: string | null;
  price?: string | null;
  photos_taken?: string | null;
  treatment_notes?: string | null;
};

type Photo = {
  id: number;
  client_id: number;
  appointment_id: number;
  appt_date?: string | null;
  file_path?: string | null;
  type?: string | null;
  description?: string | null;
  file_url?: string;
};

type Prescription = {
  id: number;
  client_id: number;
  appointment_id?: number | null;
  start_date?: string | null;
  form_type?: string | null;
  file_path?: string | null;
};

type Alert = {
  id: number;
  client_id: number;
  full_name: string;
  primary_phone?: string | null;
  deadline: string;
  notes?: string | null;
};

type WorkspaceTab = "health" | "appointments" | "photos" | "prescriptions" | "alerts";

type PrescriptionTemplate = {
  id: string;
  name: string;
  column_count: number;
  steps: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PrescriptionStep = {
  product: string;
  directions: string;
};

type PrescriptionColumn = {
  header: string;
  rows: PrescriptionStep[];
};

type PrescriptionDraft = {
  start_date: string;
  columns: PrescriptionColumn[];
};

type ClientForm = {
  id?: number;
  full_name: string;
  gender: string;
  birthdate: string;
  primary_phone: string;
  secondary_phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  referred_by: string;
};

type HealthForm = {
  allergies: string;
  health_conditions: string;
  health_risks: string;
  medications: string;
  treatment_areas: string;
  current_products: string;
  skin_conditions: string;
  other_notes: string;
  desired_improvement: string;
};

type AppointmentForm = {
  id?: number;
  date: string;
  type: string;
  treatment: string;
  price: string;
  photos_taken: string;
  treatment_notes: string;
};

const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "appointments", label: "Appointments" },
  { id: "photos", label: "Photos" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "alerts", label: "Alerts" }
];

const EMPTY_CLIENT: ClientForm = {
  full_name: "",
  gender: "",
  birthdate: "",
  primary_phone: "",
  secondary_phone: "",
  email: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  referred_by: ""
};

const EMPTY_HEALTH: HealthForm = {
  allergies: "",
  health_conditions: "",
  health_risks: "",
  medications: "",
  treatment_areas: "",
  current_products: "",
  skin_conditions: "",
  other_notes: "",
  desired_improvement: ""
};

const EMPTY_APPOINTMENT: AppointmentForm = {
  date: "",
  type: "",
  treatment: "",
  price: "",
  photos_taken: "No",
  treatment_notes: ""
};

const MAX_PRESCRIPTION_ROWS = 10;

const createPrescriptionDraft = (columnCount: number): PrescriptionDraft => {
  const columns: PrescriptionColumn[] = Array.from({ length: columnCount }, (_, index) => ({
    header: `Column ${index + 1}`,
    rows: [{ product: "", directions: "" }]
  }));
  return {
    start_date: "",
    columns
  };
};

const normalizePrescriptionDraft = (
  draft: PrescriptionDraft,
  columnCount: number
): PrescriptionDraft => {
  const rowsCount = Math.max(
    1,
    ...draft.columns.map((column) => column.rows.length)
  );
  const columns: PrescriptionColumn[] = Array.from({ length: columnCount }, (_, index) => {
    const existing = draft.columns[index];
    const rows = Array.from({ length: rowsCount }, (_, rowIndex) => {
      const row = existing?.rows[rowIndex];
      return {
        product: row?.product ?? "",
        directions: row?.directions ?? ""
      };
    });
    return {
      header: existing?.header ?? `Column ${index + 1}`,
      rows
    };
  });

  return {
    start_date: draft.start_date,
    columns
  };
};

const draftToStepsDict = (draft: PrescriptionDraft) => {
  const steps: Record<string, unknown> = {};
  draft.columns.forEach((column, index) => {
    steps[`Col${index + 1}_Header`] = column.header.trim() || `Column ${index + 1}`;
    steps[`Col${index + 1}`] = column.rows.map((row) => ({
      product: row.product,
      directions: row.directions
    }));
  });
  steps.start_date = draft.start_date;
  return steps;
};

const stepsDictToDraft = (steps: Record<string, unknown>): PrescriptionDraft => {
  let maxCol = 0;
  for (let i = 1; i <= 4; i += 1) {
    if (steps[`Col${i}`] || steps[`Col${i}_Header`]) {
      maxCol = i;
    }
  }
  if (maxCol === 0) {
    maxCol = 2;
  }

  const columns: PrescriptionColumn[] = [];
  for (let i = 1; i <= maxCol; i += 1) {
    const headerRaw =
      typeof steps[`Col${i}_Header`] === "string"
        ? (steps[`Col${i}_Header`] as string)
        : "";
    const header = headerRaw.trim() || `Column ${i}`;
    const rowsRaw = Array.isArray(steps[`Col${i}`])
      ? (steps[`Col${i}`] as PrescriptionStep[])
      : [];
    columns.push({
      header,
      rows: rowsRaw.map((row) => ({
        product: row.product ?? "",
        directions: row.directions ?? ""
      }))
    });
  }

  const startDate =
    typeof steps["start_date"] === "string" ? (steps["start_date"] as string) : "";

  const draft: PrescriptionDraft = {
    start_date: startDate,
    columns
  };

  return normalizePrescriptionDraft(draft, maxCol);
};

const parseMmddyyyy = (value: string): number => {
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) {
    return 0;
  }
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const getTodayDateString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${month}/${day}/${year}`;
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

export default function ClientsDashboard() {
  const searchParams = useSearchParams();
  const initialClientIdRef = useRef<number | null>(null);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [clientOptions, setClientOptions] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>(EMPTY_CLIENT);
  const [healthForm, setHealthForm] = useState<HealthForm>(EMPTY_HEALTH);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentForm, setAppointmentForm] =
    useState<AppointmentForm>(EMPTY_APPOINTMENT);
  const [selectedAppointmentId, setSelectedAppointmentId] =
    useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [photoDescription, setPhotoDescription] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    null
  );
  const [profileUploadFile, setProfileUploadFile] = useState<File | null>(null);
  const [profileUploadKey, setProfileUploadKey] = useState(0);
  const [photoUploadAppointmentId, setPhotoUploadAppointmentId] =
    useState<string>("");
  const [photoUploadFiles, setPhotoUploadFiles] = useState<FileList | null>(
    null
  );
  const [photoUploadKey, setPhotoUploadKey] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoQrDataUrl, setPhotoQrDataUrl] = useState<string | null>(null);
  const [photoQrUrl, setPhotoQrUrl] = useState<string | null>(null);
  const [photoQrLoading, setPhotoQrLoading] = useState(false);
  const [profileQrDataUrl, setProfileQrDataUrl] = useState<string | null>(null);
  const [profileQrUrl, setProfileQrUrl] = useState<string | null>(null);
  const [profileQrLoading, setProfileQrLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<number | null>(null);
  const [prescriptionDraft, setPrescriptionDraft] = useState<PrescriptionDraft>(
    () => {
      const draft = createPrescriptionDraft(2);
      draft.start_date = getTodayDateString();
      return draft;
    }
  );
  const [prescriptionColumnCount, setPrescriptionColumnCount] = useState(2);
  const [prescriptionPreviewUrl, setPrescriptionPreviewUrl] = useState<string | null>(null);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertDeadline, setAlertDeadline] = useState("");
  const [alertNotes, setAlertNotes] = useState("");
  const [editingAlertId, setEditingAlertId] = useState<number | null>(null);
  const [editAlertDeadline, setEditAlertDeadline] = useState("");
  const [editAlertNotes, setEditAlertNotes] = useState("");
  const [prescriptionTemplates, setPrescriptionTemplates] = useState<
    PrescriptionTemplate[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [copyTargetClientId, setCopyTargetClientId] = useState("");
  const [copyStartDate, setCopyStartDate] = useState(getTodayDateString());
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("appointments");
  const [isClientFinderHidden, setIsClientFinderHidden] = useState(false);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      return parseMmddyyyy(b.date) - parseMmddyyyy(a.date);
    });
  }, [appointments]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      return parseMmddyyyy(a.deadline) - parseMmddyyyy(b.deadline);
    });
  }, [alerts]);

  const filteredClients = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return allClients;
    }
    return allClients.filter((client) =>
      client.full_name.toLowerCase().includes(normalizedQuery)
    );
  }, [allClients, searchQuery]);

  const selectedPhoto = useMemo(() => {
    return photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  }, [photos, selectedPhotoId]);

  const selectedPrescription = useMemo(() => {
    return (
      prescriptions.find((prescription) => prescription.id === selectedPrescriptionId) ??
      null
    );
  }, [prescriptions, selectedPrescriptionId]);

  useEffect(() => {
    void loadClients();
    void loadClientOptions();
    void loadPrescriptionTemplates();
    void loadAlerts();
  }, []);

  useEffect(() => {
    const rawClientId = searchParams.get("clientId");
    if (!rawClientId) {
      return;
    }
    const parsedId = Number(rawClientId);
    if (!Number.isFinite(parsedId)) {
      return;
    }
    if (initialClientIdRef.current === parsedId) {
      return;
    }
    initialClientIdRef.current = parsedId;
    void handleSelectClient(parsedId);
  }, [searchParams]);

  useEffect(() => {
    setPhotoQrDataUrl(null);
    setPhotoQrUrl(null);
  }, [selectedClientId, photoUploadAppointmentId]);

  useEffect(() => {
    setProfileQrDataUrl(null);
    setProfileQrUrl(null);
  }, [selectedClientId]);

  const setNotice = (message: string | null, isError = false) => {
    if (isError) {
      setError(message);
      setStatus(null);
    } else {
      setStatus(message);
      setError(null);
    }
  };

  const getAlertStatusClass = (status: string) => {
    if (status.includes("Overdue")) {
      return styles.alertStatusRed;
    }
    if (status.includes("Due Today")) {
      return styles.alertStatusOrange;
    }
    if (status.includes("Due Tomorrow") || status.includes("Upcoming")) {
      return styles.alertStatusYellow;
    }
    if (status.includes("Invalid")) {
      return styles.alertStatusGray;
    }
    return styles.alertStatusGreen;
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const params = new URLSearchParams({ limit: "10000" });
      const response = await fetch(`/api/clients?${params.toString()}`);
      const data = (await response.json()) as { clients: Client[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load clients");
      }
      setAllClients(data.clients ?? []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to load clients", true);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadClientOptions = async () => {
    try {
      const response = await fetch("/api/clients?limit=10000");
      const data = (await response.json()) as { clients: Client[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load client options");
      }
      setClientOptions(data.clients ?? []);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to load client options",
        true
      );
    }
  };

  const loadPrescriptionTemplates = async () => {
    try {
      const response = await fetch("/api/prescriptions/templates");
      const data = (await response.json()) as {
        templates?: PrescriptionTemplate[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load templates");
      }
      setPrescriptionTemplates(data.templates ?? []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to load templates", true);
    }
  };

  const loadClientDetails = async (clientId: number) => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      const data = (await response.json()) as {
        client?: Client;
        health?: HealthInfo | null;
        error?: string;
      };

      if (!response.ok || !data.client) {
        throw new Error(data.error ?? "Failed to load client details");
      }

      const client = data.client;
      setClientForm({
        id: client.id,
        full_name: client.full_name ?? "",
        gender: client.gender ?? "",
        birthdate: client.birthdate ?? "",
        primary_phone: client.primary_phone ?? "",
        secondary_phone: client.secondary_phone ?? "",
        email: client.email ?? "",
        address1: client.address1 ?? "",
        address2: client.address2 ?? "",
        city: client.city ?? "",
        state: client.state ?? "",
        zip: client.zip ?? "",
        referred_by: client.referred_by ?? ""
      });
      setProfilePictureUrl(
        client.profile_picture
          ? `/api/clients/${client.id}/profile-picture?ts=${Date.now()}`
          : null
      );
      setProfileUploadFile(null);

      const health = data.health ?? {};
      setHealthForm({
        allergies: health.allergies ?? "",
        health_conditions: health.health_conditions ?? "",
        health_risks: health.health_risks ?? "",
        medications: health.medications ?? "",
        treatment_areas: health.treatment_areas ?? "",
        current_products: health.current_products ?? "",
        skin_conditions: health.skin_conditions ?? "",
        other_notes: health.other_notes ?? "",
        desired_improvement: health.desired_improvement ?? ""
      });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to load client", true);
    }
  };

  const loadAppointments = async (clientId: number) => {
    try {
      const response = await fetch(`/api/appointments?client_id=${clientId}`);
      const data = (await response.json()) as {
        appointments?: Appointment[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load appointments");
      }

      const rows = data.appointments ?? [];
      setAppointments(rows);
      setPhotoUploadAppointmentId(rows[0] ? String(rows[0].id) : "");
      setSelectedAppointmentId(null);
      setAppointmentForm(EMPTY_APPOINTMENT);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to load appointments",
        true
      );
    }
  };

  const loadPhotos = async (clientId: number) => {
    setLoadingPhotos(true);
    try {
      const response = await fetch(`/api/photos?client_id=${clientId}`);
      const data = (await response.json()) as {
        photos?: Photo[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load photos");
      }

      setPhotos(data.photos ?? []);
      setSelectedPhotoId(null);
      setPhotoDescription("");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to load photos",
        true
      );
    } finally {
      setLoadingPhotos(false);
    }
  };

  const loadPrescriptions = async (clientId: number) => {
    setLoadingPrescriptions(true);
    try {
      const response = await fetch(`/api/prescriptions?client_id=${clientId}`);
      const data = (await response.json()) as {
        prescriptions?: Prescription[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load prescriptions");
      }

      setPrescriptions(data.prescriptions ?? []);
      setSelectedPrescriptionId(null);
      setPrescriptionPreviewUrl(null);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to load prescriptions",
        true
      );
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const response = await fetch("/api/alerts");
      const data = (await response.json()) as { alerts?: Alert[]; error?: string };
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

  const handleSelectClient = async (clientId: number) => {
    setSelectedClientId(clientId);
    setNotice(null);
    setCopyTargetClientId("");
    setCopyStartDate(getTodayDateString());
    setAlertDeadline("");
    setAlertNotes("");
    handleAlertEditCancel();
    await loadClientDetails(clientId);
    await loadAppointments(clientId);
    await loadPhotos(clientId);
    await loadPrescriptions(clientId);
  };

  const handleNewClient = () => {
    setSelectedClientId(null);
    setClientForm(EMPTY_CLIENT);
    setHealthForm(EMPTY_HEALTH);
    setAppointments([]);
    setAppointmentForm(EMPTY_APPOINTMENT);
    setSelectedAppointmentId(null);
    setPhotos([]);
    setSelectedPhotoId(null);
    setPhotoDescription("");
    setProfilePictureUrl(null);
    setProfileUploadFile(null);
    setProfileUploadKey((prev) => prev + 1);
    setPhotoUploadAppointmentId("");
    setPhotoUploadFiles(null);
    setPhotoUploadKey((prev) => prev + 1);
    setPrescriptions([]);
    setSelectedPrescriptionId(null);
    setCopyTargetClientId("");
    setCopyStartDate(getTodayDateString());
    setAlertDeadline("");
    setAlertNotes("");
    handleAlertEditCancel();
    const draft = createPrescriptionDraft(2);
    draft.start_date = getTodayDateString();
    setPrescriptionDraft(draft);
    setPrescriptionColumnCount(2);
    setPrescriptionPreviewUrl(null);
    setNotice("Creating a new client.");
  };

  const handleClientChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    const field = name as keyof ClientForm;
    setClientForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHealthChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    const field = name as keyof HealthForm;
    setHealthForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAppointmentChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    const field = name as keyof AppointmentForm;
    setAppointmentForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClientSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (!clientForm.full_name.trim()) {
      setNotice("Client name is required.", true);
      return;
    }

    try {
      const payload = { ...clientForm };
      delete payload.id;

      if (selectedClientId) {
        const response = await fetch(`/api/clients/${selectedClientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = (await response.json()) as { client?: Client; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to update client");
        }

        if (data.client) {
          await loadClients();
          await loadClientOptions();
          await handleSelectClient(data.client.id);
          await loadAlerts();
          setNotice("Client updated.");
        }
      } else {
        const response = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = (await response.json()) as { client?: Client; error?: string };
        if (!response.ok || !data.client) {
          throw new Error(data.error ?? "Failed to create client");
        }

        await loadClients();
        await loadClientOptions();
        await handleSelectClient(data.client.id);
        setNotice("Client created.");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Save failed", true);
    }
  };

  const handleClientDelete = async () => {
    if (!selectedClientId) {
      return;
    }

    const confirmDelete = window.confirm(
      "Delete this client and all associated data?"
    );
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(`/api/clients/${selectedClientId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete client");
      }

      await loadClients();
      await loadClientOptions();
      await loadAlerts();
      handleNewClient();
      setNotice("Client deleted.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Delete failed", true);
    }
  };

  const handleHealthSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClientId) {
      setNotice("Select a client before saving health info.", true);
      return;
    }

    try {
      const response = await fetch(`/api/clients/${selectedClientId}/health`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(healthForm)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save health info");
      }
      setNotice("Health info saved.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save health info",
        true
      );
    }
  };

  const handleProfileFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    setProfileUploadFile(file);
  };

  const handleProfileUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClientId) {
      setNotice("Select a client before uploading a profile picture.", true);
      return;
    }
    if (!profileUploadFile) {
      setNotice("Choose a profile image first.", true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("photo", profileUploadFile);

      const response = await fetch(
        `/api/clients/${selectedClientId}/profile-picture`,
        {
          method: "POST",
          body: formData
        }
      );
      const data = (await response.json()) as {
        profile_picture?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to upload profile picture");
      }

      setProfilePictureUrl(
        data.profile_picture
          ? `/api/clients/${selectedClientId}/profile-picture?ts=${Date.now()}`
          : null
      );
      setProfileUploadFile(null);
      setProfileUploadKey((prev) => prev + 1);
      setNotice("Profile picture updated.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Profile upload failed",
        true
      );
    }
  };

  const handlePhotoUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClientId) {
      setNotice("Select a client before uploading photos.", true);
      return;
    }
    if (!photoUploadAppointmentId) {
      setNotice("Choose an appointment for these photos.", true);
      return;
    }
    if (!photoUploadFiles || photoUploadFiles.length === 0) {
      setNotice("Choose one or more photo files.", true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("client_id", String(selectedClientId));
      formData.append("appointment_id", photoUploadAppointmentId);
      for (const file of Array.from(photoUploadFiles)) {
        formData.append("photos", file);
      }

      const response = await fetch("/api/photos", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Photo upload failed");
      }

      setPhotoUploadFiles(null);
      setPhotoUploadKey((prev) => prev + 1);
      await loadPhotos(selectedClientId);
      await loadAppointments(selectedClientId);
      setNotice("Photos uploaded.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Photo upload failed", true);
    }
  };

  const handlePhotoSelect = (photo: Photo) => {
    setSelectedPhotoId(photo.id);
    setPhotoDescription(photo.description ?? "");
  };

  const handlePhotoDescriptionSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPhotoId) {
      setNotice("Select a photo first.", true);
      return;
    }

    try {
      const response = await fetch(`/api/photos/${selectedPhotoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: photoDescription })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update photo");
      }

      if (selectedClientId) {
        await loadPhotos(selectedClientId);
      }
      setNotice("Photo updated.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Photo update failed", true);
    }
  };

  const handlePhotoDelete = async (photo: Photo) => {
    const confirmDelete = window.confirm("Delete this photo?");
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete photo");
      }

      if (selectedClientId) {
        await loadPhotos(selectedClientId);
        await loadAppointments(selectedClientId);
      }
      setNotice("Photo deleted.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Delete failed", true);
    }
  };

  const handlePhotoQrGenerate = async () => {
    if (!selectedClientId) {
      setNotice("Select a client before generating a QR code.", true);
      return;
    }
    if (!photoUploadAppointmentId) {
      setNotice("Choose an appointment for QR uploads.", true);
      return;
    }

    setPhotoQrLoading(true);
    try {
      const response = await fetch(
        `/api/uploads/qr-code?mode=photo&client_id=${selectedClientId}&appointment_id=${photoUploadAppointmentId}`
      );
      const data = (await response.json()) as {
        upload_url?: string;
        qr_data_url?: string;
        error?: string;
      };
      if (!response.ok || !data.upload_url || !data.qr_data_url) {
        throw new Error(data.error ?? "Failed to generate QR code");
      }
      setPhotoQrUrl(data.upload_url);
      setPhotoQrDataUrl(data.qr_data_url);
      setNotice("QR code ready.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to generate QR", true);
    } finally {
      setPhotoQrLoading(false);
    }
  };

  const handleProfileQrGenerate = async () => {
    if (!selectedClientId) {
      setNotice("Select a client before generating a QR code.", true);
      return;
    }

    setProfileQrLoading(true);
    try {
      const response = await fetch(
        `/api/uploads/qr-code?mode=profile&client_id=${selectedClientId}`
      );
      const data = (await response.json()) as {
        upload_url?: string;
        qr_data_url?: string;
        error?: string;
      };
      if (!response.ok || !data.upload_url || !data.qr_data_url) {
        throw new Error(data.error ?? "Failed to generate QR code");
      }
      setProfileQrUrl(data.upload_url);
      setProfileQrDataUrl(data.qr_data_url);
      setNotice("QR code ready.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to generate QR", true);
    } finally {
      setProfileQrLoading(false);
    }
  };

  const handleCopyQrLink = async (url: string | null) => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice("QR link copied to clipboard.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to copy QR link",
        true
      );
    }
  };

  const handleAlertDeadlineBlur = () => {
    setAlertDeadline((prev) => normalizeDateInput(prev));
  };

  const handleAlertCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClientId) {
      setNotice("Select a client before setting an alert.", true);
      return;
    }

    if (!clientForm.primary_phone.trim()) {
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
          client_id: selectedClientId,
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

  const handleAlertEditDeadlineBlur = () => {
    setEditAlertDeadline((prev) => normalizeDateInput(prev));
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

  const handlePrescriptionColumnCountChange = (value: number) => {
    setPrescriptionColumnCount(value);
    setPrescriptionDraft((prev) => normalizePrescriptionDraft(prev, value));
    setSelectedPrescriptionId(null);
    setPrescriptionPreviewUrl(null);
  };

  const handlePrescriptionStartDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setPrescriptionDraft((prev) => ({ ...prev, start_date: value }));
  };

  const handlePrescriptionHeaderChange = (
    index: number,
    value: string
  ) => {
    setPrescriptionDraft((prev) => {
      const next = normalizePrescriptionDraft(prev, prescriptionColumnCount);
      const columns = next.columns.map((column, colIndex) =>
        colIndex === index ? { ...column, header: value } : column
      );
      return { ...next, columns };
    });
  };

  const handlePrescriptionRowChange = (
    colIndex: number,
    rowIndex: number,
    field: "product" | "directions",
    value: string
  ) => {
    setPrescriptionDraft((prev) => {
      const next = normalizePrescriptionDraft(prev, prescriptionColumnCount);
      const columns = next.columns.map((column, columnIndex) => {
        if (columnIndex !== colIndex) {
          return column;
        }
        const rows = column.rows.map((row, index) =>
          index === rowIndex ? { ...row, [field]: value } : row
        );
        return { ...column, rows };
      });
      return { ...next, columns };
    });
  };

  const handlePrescriptionAddRow = () => {
    setPrescriptionDraft((prev) => {
      const next = normalizePrescriptionDraft(prev, prescriptionColumnCount);
      if (next.columns[0]?.rows.length >= MAX_PRESCRIPTION_ROWS) {
        setNotice(`Maximum ${MAX_PRESCRIPTION_ROWS} rows reached.`, true);
        return prev;
      }
      const columns = next.columns.map((column) => ({
        ...column,
        rows: [...column.rows, { product: "", directions: "" }]
      }));
      return { ...next, columns };
    });
  };

  const handlePrescriptionRemoveRow = () => {
    setPrescriptionDraft((prev) => {
      const next = normalizePrescriptionDraft(prev, prescriptionColumnCount);
      if (next.columns[0]?.rows.length <= 1) {
        return prev;
      }
      const columns = next.columns.map((column) => ({
        ...column,
        rows: column.rows.slice(0, -1)
      }));
      return { ...next, columns };
    });
  };

  const handlePrescriptionHighlight = (colIndex: number, rowIndex: number) => {
    const textarea = document.getElementById(
      `dir-${colIndex}-${rowIndex}`
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const value = textarea.value;
    const nextValue =
      value.slice(0, start) +
      `[[highlight]]${value.slice(start, end)}[[/highlight]]` +
      value.slice(end);

    handlePrescriptionRowChange(colIndex, rowIndex, "directions", nextValue);
    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  const handlePrescriptionSelect = async (prescription: Prescription) => {
    setSelectedPrescriptionId(prescription.id);
    setPrescriptionPreviewUrl(
      `/api/prescriptions/${prescription.id}/file?ts=${Date.now()}`
    );

    try {
      const response = await fetch(`/api/prescriptions/${prescription.id}`);
      const data = (await response.json()) as {
        prescription?: { data?: Record<string, unknown> };
        error?: string;
      };

      if (!response.ok || !data.prescription) {
        throw new Error(data.error ?? "Failed to load prescription");
      }

      const steps = data.prescription.data ?? {};
      const draft = stepsDictToDraft(steps);
      setPrescriptionColumnCount(draft.columns.length);
      setPrescriptionDraft(draft);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to load prescription",
        true
      );
    }
  };

  const handlePrescriptionNew = () => {
    setSelectedPrescriptionId(null);
    const draft = createPrescriptionDraft(prescriptionColumnCount);
    draft.start_date = getTodayDateString();
    setPrescriptionDraft(draft);
    setPrescriptionPreviewUrl(null);
  };

  const handlePrescriptionSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClientId) {
      setNotice("Select a client before saving a prescription.", true);
      return;
    }

    const draft = normalizePrescriptionDraft(
      prescriptionDraft,
      prescriptionColumnCount
    );
    const steps = draftToStepsDict(draft);
    const startDate =
      typeof steps.start_date === "string" && steps.start_date
        ? steps.start_date
        : getTodayDateString();
    steps.start_date = startDate;

    try {
      if (selectedPrescriptionId) {
        const response = await fetch(
          `/api/prescriptions/${selectedPrescriptionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start_date: startDate, data: steps })
          }
        );
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to update prescription");
        }
        if (selectedClientId) {
          await loadPrescriptions(selectedClientId);
        }
        setPrescriptionPreviewUrl(
          `/api/prescriptions/${selectedPrescriptionId}/file?ts=${Date.now()}`
        );
        setNotice("Prescription updated.");
      } else {
        const response = await fetch("/api/prescriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: selectedClientId,
            start_date: startDate,
            data: steps
          })
        });
        const data = (await response.json()) as {
          prescription?: Prescription;
          error?: string;
        };
        if (!response.ok || !data.prescription) {
          throw new Error(data.error ?? "Failed to create prescription");
        }
        await loadPrescriptions(selectedClientId);
        setSelectedPrescriptionId(data.prescription.id);
        setPrescriptionPreviewUrl(
          `/api/prescriptions/${data.prescription.id}/file?ts=${Date.now()}`
        );
        setNotice("Prescription created.");
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save prescription",
        true
      );
    }
  };

  const handlePrescriptionDelete = async () => {
    if (!selectedPrescriptionId || !selectedClientId) {
      return;
    }
    const confirmDelete = window.confirm("Delete this prescription?");
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `/api/prescriptions/${selectedPrescriptionId}`,
        {
          method: "DELETE"
        }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete prescription");
      }

      await loadPrescriptions(selectedClientId);
      handlePrescriptionNew();
      setNotice("Prescription deleted.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to delete prescription",
        true
      );
    }
  };

  const handlePrescriptionPrint = () => {
    if (!selectedPrescriptionId) {
      setNotice("Select a prescription to print.", true);
      return;
    }
    setPrintUrl(`/api/prescriptions/${selectedPrescriptionId}/file?ts=${Date.now()}`);
  };

  const handlePrintFrameLoad = () => {
    if (!printUrl) {
      return;
    }
    const frame = printFrameRef.current;
    try {
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
      setNotice("Print dialog opened.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to print", true);
    } finally {
      setTimeout(() => setPrintUrl(null), 800);
    }
  };

  const handlePrescriptionCopy = async () => {
    if (!selectedPrescriptionId) {
      setNotice("Select a prescription to copy.", true);
      return;
    }
    if (!copyTargetClientId) {
      setNotice("Select a client to copy to.", true);
      return;
    }

    const targetId = Number(copyTargetClientId);
    if (!Number.isFinite(targetId)) {
      setNotice("Invalid target client.", true);
      return;
    }

    const startDate = copyStartDate.trim() || getTodayDateString();

    try {
      const response = await fetch(
        `/api/prescriptions/${selectedPrescriptionId}/copy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_client_id: targetId,
            start_date: startDate
          })
        }
      );
      const data = (await response.json()) as {
        prescription?: Prescription;
        error?: string;
      };
      if (!response.ok || !data.prescription) {
        throw new Error(data.error ?? "Failed to copy prescription");
      }

      if (selectedClientId && targetId === selectedClientId) {
        await loadPrescriptions(selectedClientId);
        setSelectedPrescriptionId(data.prescription.id);
        setPrescriptionPreviewUrl(
          `/api/prescriptions/${data.prescription.id}/file?ts=${Date.now()}`
        );
      }

      setNotice("Prescription copied.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to copy prescription",
        true
      );
    }
  };

  const handleTemplateApply = () => {
    if (!selectedTemplateId) {
      setNotice("Select a template to apply.", true);
      return;
    }

    const template = prescriptionTemplates.find(
      (item) => item.id === selectedTemplateId
    );
    if (!template) {
      setNotice("Template not found.", true);
      return;
    }

    const draft = stepsDictToDraft(template.steps);
    draft.start_date = getTodayDateString();
    setPrescriptionColumnCount(draft.columns.length);
    setPrescriptionDraft(draft);
    setSelectedPrescriptionId(null);
    setPrescriptionPreviewUrl(null);
    setNotice(`Template "${template.name}" loaded.`);
  };

  const handleTemplateSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateName.trim()) {
      setNotice("Template name is required.", true);
      return;
    }

    const draft = normalizePrescriptionDraft(
      prescriptionDraft,
      prescriptionColumnCount
    );
    const steps = draftToStepsDict(draft);

    try {
      const response = await fetch("/api/prescriptions/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), steps })
      });
      const data = (await response.json()) as {
        template?: PrescriptionTemplate;
        error?: string;
      };
      if (!response.ok || !data.template) {
        throw new Error(data.error ?? "Failed to save template");
      }
      setTemplateName("");
      await loadPrescriptionTemplates();
      setSelectedTemplateId(data.template.id);
      setNotice("Template saved.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save template",
        true
      );
    }
  };

  const handleTemplateDelete = async () => {
    if (!selectedTemplateId) {
      setNotice("Select a template to delete.", true);
      return;
    }

    const confirmDelete = window.confirm("Delete this template?");
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `/api/prescriptions/templates/${selectedTemplateId}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete template");
      }
      await loadPrescriptionTemplates();
      setSelectedTemplateId("");
      setNotice("Template deleted.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to delete template",
        true
      );
    }
  };

  const handleAppointmentSelect = (appointment: Appointment) => {
    setSelectedAppointmentId(appointment.id);
    setAppointmentForm({
      id: appointment.id,
      date: appointment.date ?? "",
      type: appointment.type ?? "",
      treatment: appointment.treatment ?? "",
      price: appointment.price ?? "",
      photos_taken: appointment.photos_taken ?? "No",
      treatment_notes: appointment.treatment_notes ?? ""
    });
    setPhotoUploadAppointmentId(String(appointment.id));
  };

  const handleAppointmentNew = () => {
    setSelectedAppointmentId(null);
    setAppointmentForm(EMPTY_APPOINTMENT);
  };

  const handleAppointmentSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedClientId) {
      setNotice("Select a client before saving an appointment.", true);
      return;
    }

    if (!appointmentForm.date.trim() || !appointmentForm.type.trim()) {
      setNotice("Date and type are required for appointments.", true);
      return;
    }

    try {
      const payload = {
        date: appointmentForm.date.trim(),
        type: appointmentForm.type.trim(),
        treatment: appointmentForm.treatment,
        price: appointmentForm.price,
        photos_taken: appointmentForm.photos_taken || "No",
        treatment_notes: appointmentForm.treatment_notes
      };

      if (selectedAppointmentId) {
        const response = await fetch(
          `/api/appointments/${selectedAppointmentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to update appointment");
        }
        await loadAppointments(selectedClientId);
        setNotice("Appointment updated.");
      } else {
        const response = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: selectedClientId,
            ...payload
          })
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to create appointment");
        }
        await loadAppointments(selectedClientId);
        setNotice("Appointment created.");
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save appointment",
        true
      );
    }
  };

  const handleAppointmentDelete = async () => {
    if (!selectedAppointmentId || !selectedClientId) {
      return;
    }

    const confirmDelete = window.confirm("Delete this appointment?");
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `/api/appointments/${selectedAppointmentId}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete appointment");
      }
      await loadAppointments(selectedClientId);
      await loadPhotos(selectedClientId);
      setNotice("Appointment deleted.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to delete appointment",
        true
      );
    }
  };

  const handleSearchClear = () => {
    setSearchQuery("");
  };

  return (
    <div className={styles.page}>
      {isClientFinderHidden && (
        <button
          className={styles.clientRailButton}
          type="button"
          onClick={() => setIsClientFinderHidden(false)}
          aria-label="Show client finder"
        >
          Clients
        </button>
      )}
      <div className={styles.topGrid}>
        <section className={`${styles.panel} ${styles.overviewPanel}`}>
          {!isClientFinderHidden && (
            <div className={styles.collapsedClientPanel}>
              <div className={styles.collapsedClientHeader}>
                <div>
                  <h3 className={styles.panelTitle}>Clients</h3>
                  <p className={styles.notice}>
                    Search and select a client, or start a new one.
                  </p>
                </div>
                <div className={styles.headerActions}>
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    onClick={() => setIsClientFinderHidden(true)}
                  >
                    Hide
                  </button>
                  <button
                    className={styles.button}
                    type="button"
                    onClick={handleNewClient}
                  >
                    New
                  </button>
                </div>
              </div>
              <div className={styles.collapsedSearchRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Search clients</span>
                  <input
                    className={styles.input}
                    name="search"
                    placeholder="Enter client name"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
                <button
                  className={styles.buttonSecondary}
                  type="button"
                  onClick={handleSearchClear}
                >
                  Clear
                </button>
              </div>
              {loadingClients && (
                <p className={styles.notice}>Loading clients...</p>
              )}
              {!loadingClients && filteredClients.length === 0 && (
                <p className={styles.notice}>No clients found.</p>
              )}
              {!loadingClients && filteredClients.length > 0 && (
                <ul className={styles.collapsedClientList}>
                  {filteredClients.map((client) => (
                    <li
                      key={client.id}
                      className={`${styles.clientItem} ${
                        selectedClientId === client.id
                          ? styles.clientItemSelected
                          : ""
                      }`}
                      onClick={() => void handleSelectClient(client.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleSelectClient(client.id);
                        }
                      }}
                    >
                      <div className={styles.clientItemName}>
                        {client.full_name}
                      </div>
                      <div className={styles.notice}>
                        {client.primary_phone || "No phone"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className={styles.overviewHeader}>
            <div>
              <h2 className={styles.overviewTitle}>Client Overview</h2>
              <p className={styles.notice}>
                {selectedClientId
                  ? `Editing ${clientForm.full_name || "selected client"}.`
                  : "Select a client to view details."}
              </p>
            </div>
            {selectedClientId && (
              <span className={styles.overviewMeta}>ID #{selectedClientId}</span>
            )}
          </div>

          <div className={styles.overviewGrid}>
            <div className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <h3 className={styles.panelTitle}>Profile Photo</h3>
              </div>
              {!selectedClientId && (
                <p className={styles.notice}>
                  Select a client to manage profile photos.
                </p>
              )}
              {selectedClientId && (
                <>
                  <div className={styles.profileStack}>
                    {profilePictureUrl ? (
                      <img
                        className={styles.profileImage}
                        src={profilePictureUrl}
                        alt="Profile"
                        onError={() => setProfilePictureUrl(null)}
                      />
                    ) : (
                      <div className={styles.profilePlaceholder}>
                        No profile picture yet.
                      </div>
                    )}
                    <form onSubmit={handleProfileUpload}>
                      <div className={styles.field}>
                        <span className={styles.label}>Upload Profile Photo</span>
                        <input
                          key={profileUploadKey}
                          className={styles.input}
                          type="file"
                          accept="image/*"
                          onChange={handleProfileFileChange}
                        />
                      </div>
                      <div className={styles.buttonRow}>
                        <button className={styles.button} type="submit">
                          Upload
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className={styles.qrPanel}>
                    <div className={styles.qrHeader}>
                      <h3>Profile QR Upload</h3>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={handleProfileQrGenerate}
                        disabled={profileQrLoading}
                      >
                        {profileQrLoading ? "Generating..." : "Generate QR"}
                      </button>
                    </div>
                    {profileQrDataUrl && (
                      <div className={styles.qrContent}>
                        <img
                          className={styles.qrImage}
                          src={profileQrDataUrl}
                          alt="Profile upload QR code"
                        />
                        <div className={styles.qrActions}>
                          {profileQrUrl && (
                            <>
                              <a
                                className={styles.buttonSecondary}
                                href={profileQrUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open Upload
                              </a>
                              <button
                                className={styles.buttonSecondary}
                                type="button"
                                onClick={() => handleCopyQrLink(profileQrUrl)}
                              >
                                Copy Link
                              </button>
                            </>
                          )}
                        </div>
                        {profileQrUrl && (
                          <div className={styles.qrUrl}>{profileQrUrl}</div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className={styles.detailsCard}>
              <div className={styles.detailsHeader}>
                <h3 className={styles.panelTitle}>Client Details</h3>
                {selectedClientId && (
                  <span className={styles.detailsMeta}>
                    {clientForm.email || "No email on file"}
                  </span>
                )}
              </div>
              <form onSubmit={handleClientSave}>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span className={styles.label}>Full Name</span>
                    <input
                      className={styles.input}
                      name="full_name"
                      value={clientForm.full_name}
                      onChange={handleClientChange}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Gender</span>
                    <input
                      className={styles.input}
                      name="gender"
                      value={clientForm.gender}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Birthdate</span>
                    <input
                      className={styles.input}
                      name="birthdate"
                      placeholder="MM/DD/YYYY"
                      value={clientForm.birthdate}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Primary Phone</span>
                    <input
                      className={styles.input}
                      name="primary_phone"
                      value={clientForm.primary_phone}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Secondary Phone</span>
                    <input
                      className={styles.input}
                      name="secondary_phone"
                      value={clientForm.secondary_phone}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Email</span>
                    <input
                      className={styles.input}
                      name="email"
                      value={clientForm.email}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Address 1</span>
                    <input
                      className={styles.input}
                      name="address1"
                      value={clientForm.address1}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Address 2</span>
                    <input
                      className={styles.input}
                      name="address2"
                      value={clientForm.address2}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>City</span>
                    <input
                      className={styles.input}
                      name="city"
                      value={clientForm.city}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>State</span>
                    <input
                      className={styles.input}
                      name="state"
                      value={clientForm.state}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Zip</span>
                    <input
                      className={styles.input}
                      name="zip"
                      value={clientForm.zip}
                      onChange={handleClientChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Referred By</span>
                    <input
                      className={styles.input}
                      name="referred_by"
                      value={clientForm.referred_by}
                      onChange={handleClientChange}
                    />
                  </label>
                </div>
                <div className={styles.buttonRow}>
                  <button className={styles.button} type="submit">
                    {selectedClientId ? "Save Changes" : "Create Client"}
                  </button>
                  {selectedClientId && (
                    <button
                      className={`${styles.button} ${styles.buttonDanger}`}
                      type="button"
                      onClick={handleClientDelete}
                    >
                      Delete Client
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>

      <nav className={styles.sectionTabs}>
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${
              activeTab === tab.id ? styles.tabButtonActive : ""
            }`}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className={`${styles.panel} ${styles.workspacePanel}`}>
        {activeTab === "health" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Health Info</h2>
            {!selectedClientId && (
              <p className={styles.notice}>Select a client to manage health info.</p>
            )}
            <form onSubmit={handleHealthSave}>
              <fieldset className={styles.fieldset} disabled={!selectedClientId}>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span className={styles.label}>Allergies</span>
                    <textarea
                      className={styles.textarea}
                      name="allergies"
                      value={healthForm.allergies}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Health Conditions</span>
                    <textarea
                      className={styles.textarea}
                      name="health_conditions"
                      value={healthForm.health_conditions}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Health Risks</span>
                    <textarea
                      className={styles.textarea}
                      name="health_risks"
                      value={healthForm.health_risks}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Medications</span>
                    <textarea
                      className={styles.textarea}
                      name="medications"
                      value={healthForm.medications}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Treatment Areas</span>
                    <textarea
                      className={styles.textarea}
                      name="treatment_areas"
                      value={healthForm.treatment_areas}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Current Products</span>
                    <textarea
                      className={styles.textarea}
                      name="current_products"
                      value={healthForm.current_products}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Skin Conditions</span>
                    <textarea
                      className={styles.textarea}
                      name="skin_conditions"
                      value={healthForm.skin_conditions}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Other Notes</span>
                    <textarea
                      className={styles.textarea}
                      name="other_notes"
                      value={healthForm.other_notes}
                      onChange={handleHealthChange}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Desired Improvement</span>
                    <textarea
                      className={styles.textarea}
                      name="desired_improvement"
                      value={healthForm.desired_improvement}
                      onChange={handleHealthChange}
                    />
                  </label>
                </div>
              </fieldset>
              <div className={styles.buttonRow}>
                <button
                  className={styles.button}
                  type="submit"
                  disabled={!selectedClientId}
                >
                  Save Health Info
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "appointments" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Appointments</h2>
            {!selectedClientId && (
              <p className={styles.notice}>Select a client to manage appointments.</p>
            )}
            {selectedClientId && (
              <div className={styles.appointmentsLayout}>
                <div>
                  {sortedAppointments.length === 0 && (
                    <p className={styles.notice}>No appointments yet.</p>
                  )}
                  {sortedAppointments.length > 0 && (
                    <table className={styles.appointmentsTable}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Treatment</th>
                          <th>Price</th>
                          <th>Photos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAppointments.map((appointment) => (
                          <tr
                            key={appointment.id}
                            className={
                              selectedAppointmentId === appointment.id
                                ? styles.appointmentRowSelected
                                : undefined
                            }
                            onClick={() => handleAppointmentSelect(appointment)}
                          >
                            <td>{appointment.date}</td>
                            <td>{appointment.type}</td>
                            <td>{appointment.treatment ?? ""}</td>
                            <td>{appointment.price ?? ""}</td>
                            <td>{appointment.photos_taken ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <form onSubmit={handleAppointmentSave}>
                    <div className={styles.field}>
                      <span className={styles.label}>Date</span>
                      <input
                        className={styles.input}
                        name="date"
                        placeholder="MM/DD/YYYY"
                        value={appointmentForm.date}
                        onChange={handleAppointmentChange}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.label}>Type</span>
                      <input
                        className={styles.input}
                        name="type"
                        value={appointmentForm.type}
                        onChange={handleAppointmentChange}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.label}>Treatment</span>
                      <input
                        className={styles.input}
                        name="treatment"
                        value={appointmentForm.treatment}
                        onChange={handleAppointmentChange}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.label}>Price</span>
                      <input
                        className={styles.input}
                        name="price"
                        value={appointmentForm.price}
                        onChange={handleAppointmentChange}
                      />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.label}>Photos Taken</span>
                      <select
                        className={styles.select}
                        name="photos_taken"
                        value={appointmentForm.photos_taken}
                        onChange={handleAppointmentChange}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <span className={styles.label}>Treatment Notes</span>
                      <textarea
                        className={styles.textarea}
                        name="treatment_notes"
                        value={appointmentForm.treatment_notes}
                        onChange={handleAppointmentChange}
                      />
                    </div>
                    <div className={styles.buttonRow}>
                      <button className={styles.button} type="submit">
                        {selectedAppointmentId ? "Save Appointment" : "Add Appointment"}
                      </button>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={handleAppointmentNew}
                      >
                        New
                      </button>
                      {selectedAppointmentId && (
                        <button
                          className={`${styles.button} ${styles.buttonDanger}`}
                          type="button"
                          onClick={handleAppointmentDelete}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Client Photos</h2>
            {!selectedClientId && (
              <p className={styles.notice}>Select a client to view photos.</p>
            )}
            {selectedClientId && (
              <>
                <form onSubmit={handlePhotoUpload}>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span className={styles.label}>Appointment</span>
                      <select
                        className={styles.select}
                        value={photoUploadAppointmentId}
                        onChange={(event) =>
                          setPhotoUploadAppointmentId(event.target.value)
                        }
                      >
                        <option value="">Select appointment</option>
                        {sortedAppointments.map((appt) => (
                          <option key={appt.id} value={String(appt.id)}>
                            {appt.date} - {appt.type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Upload Photos</span>
                      <input
                        key={photoUploadKey}
                        className={styles.input}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          setPhotoUploadFiles(event.target.files)
                        }
                      />
                    </label>
                  </div>
                  <div className={styles.buttonRow}>
                    <button className={styles.button} type="submit">
                      Upload Photos
                    </button>
                  </div>
                </form>

                <div className={styles.qrPanel}>
                  <div className={styles.qrHeader}>
                    <h3>Appointment QR Upload</h3>
                    <button
                      className={styles.buttonSecondary}
                      type="button"
                      onClick={handlePhotoQrGenerate}
                      disabled={photoQrLoading || !photoUploadAppointmentId}
                    >
                      {photoQrLoading ? "Generating..." : "Generate QR"}
                    </button>
                  </div>
                  {!photoUploadAppointmentId && (
                    <p className={styles.notice}>
                      Select an appointment to generate a QR code.
                    </p>
                  )}
                  {photoQrDataUrl && (
                    <div className={styles.qrContent}>
                      <img
                        className={styles.qrImage}
                        src={photoQrDataUrl}
                        alt="Appointment upload QR code"
                      />
                      <div className={styles.qrActions}>
                        {photoQrUrl && (
                          <>
                            <a
                              className={styles.buttonSecondary}
                              href={photoQrUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Upload
                            </a>
                            <button
                              className={styles.buttonSecondary}
                              type="button"
                              onClick={() => handleCopyQrLink(photoQrUrl)}
                            >
                              Copy Link
                            </button>
                          </>
                        )}
                      </div>
                      {photoQrUrl && <div className={styles.qrUrl}>{photoQrUrl}</div>}
                    </div>
                  )}
                </div>

                {loadingPhotos && (
                  <p className={styles.notice}>Loading photos...</p>
                )}
                {!loadingPhotos && photos.length === 0 && (
                  <p className={styles.notice}>No photos yet.</p>
                )}

                {photos.length > 0 && (
                  <div className={styles.photosGrid}>
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        className={`${styles.photoCard} ${
                          selectedPhotoId === photo.id ? styles.photoCardSelected : ""
                        }`}
                        onClick={() => handlePhotoSelect(photo)}
                      >
                        <img
                          className={styles.photoThumb}
                          src={photo.file_url ?? `/api/photos/${photo.id}/file`}
                          alt={`Photo ${photo.id}`}
                        />
                        <div className={styles.photoMeta}>
                          {photo.appt_date ?? "Unknown date"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPhoto && (
                  <div className={styles.photoDetail}>
                    <h3>Photo Details</h3>
                    <p className={styles.notice}>
                      Appointment: {selectedPhoto.appt_date ?? "Unknown"}{" "}
                      {selectedPhoto.type ? `· ${selectedPhoto.type}` : ""}
                    </p>
                    <form onSubmit={handlePhotoDescriptionSave}>
                      <label className={styles.field}>
                        <span className={styles.label}>Description</span>
                        <textarea
                          className={styles.textarea}
                          value={photoDescription}
                          onChange={(event) =>
                            setPhotoDescription(event.target.value)
                          }
                        />
                      </label>
                      <div className={styles.buttonRow}>
                        <button className={styles.button} type="submit">
                          Save Description
                        </button>
                        <button
                          className={`${styles.button} ${styles.buttonDanger}`}
                          type="button"
                          onClick={() => handlePhotoDelete(selectedPhoto)}
                        >
                          Delete Photo
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "prescriptions" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Prescriptions</h2>
            {!selectedClientId && (
              <p className={styles.notice}>
                Select a client to manage prescriptions.
              </p>
            )}
            {selectedClientId && (
              <div className={styles.prescriptionsLayout}>
                <div className={styles.prescriptionsList}>
                  <div className={styles.headerRow}>
                    <h3>Saved Prescriptions</h3>
                    <button
                      className={styles.buttonSecondary}
                      type="button"
                      onClick={handlePrescriptionNew}
                    >
                      New
                    </button>
                  </div>
                  {loadingPrescriptions && (
                    <p className={styles.notice}>Loading prescriptions...</p>
                  )}
                  {!loadingPrescriptions && prescriptions.length === 0 && (
                    <p className={styles.notice}>No prescriptions yet.</p>
                  )}
                  <ul className={styles.prescriptionList}>
                    {prescriptions.map((prescription) => (
                      <li
                        key={prescription.id}
                        className={`${styles.prescriptionItem} ${
                          selectedPrescriptionId === prescription.id
                            ? styles.prescriptionItemSelected
                            : ""
                        }`}
                        onClick={() => handlePrescriptionSelect(prescription)}
                      >
                        <div className={styles.clientItemName}>
                          {prescription.start_date ?? "Unknown"}
                        </div>
                        <div className={styles.notice}>
                          {prescription.form_type ?? "Unknown"}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {selectedPrescription && (
                    <>
                      <div className={styles.buttonRow}>
                        <a
                          className={styles.buttonSecondary}
                          href={`/api/prescriptions/${selectedPrescription.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open PDF
                        </a>
                        <button
                          className={styles.buttonSecondary}
                          type="button"
                          onClick={handlePrescriptionPrint}
                        >
                          Print
                        </button>
                      </div>
                      <div className={styles.copyPanel}>
                        <span className={styles.label}>Copy To Client</span>
                        <div className={styles.copyRow}>
                          <select
                            className={styles.select}
                            value={copyTargetClientId}
                            onChange={(event) =>
                              setCopyTargetClientId(event.target.value)
                            }
                          >
                            <option value="">Select client</option>
                            {clientOptions.map((client) => (
                              <option key={client.id} value={String(client.id)}>
                                {client.full_name}
                              </option>
                            ))}
                          </select>
                          <input
                            className={styles.input}
                            placeholder="MM/DD/YYYY"
                            value={copyStartDate}
                            onChange={(event) => setCopyStartDate(event.target.value)}
                          />
                          <button
                            className={styles.buttonSecondary}
                            type="button"
                            onClick={handlePrescriptionCopy}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  <div className={styles.templatePanel}>
                    <div className={styles.qrHeader}>
                      <h3>Templates</h3>
                    </div>
                    <div className={styles.templateRow}>
                      <select
                        className={styles.select}
                        value={selectedTemplateId}
                        onChange={(event) =>
                          setSelectedTemplateId(event.target.value)
                        }
                      >
                        <option value="">Select template</option>
                        {prescriptionTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.column_count} col)
                          </option>
                        ))}
                      </select>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={handleTemplateApply}
                      >
                        Apply
                      </button>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={handleTemplateDelete}
                      >
                        Delete
                      </button>
                    </div>
                    <form
                      className={styles.templateRow}
                      onSubmit={handleTemplateSave}
                    >
                      <input
                        className={styles.input}
                        placeholder="Template name"
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                      />
                      <button className={styles.buttonSecondary} type="submit">
                        Save Template
                      </button>
                    </form>
                  </div>
                </div>

                <div className={styles.prescriptionsEditor}>
                  <form onSubmit={handlePrescriptionSave}>
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span className={styles.label}>Start Date</span>
                        <input
                          className={styles.input}
                          name="start_date"
                          placeholder="MM/DD/YYYY"
                          value={prescriptionDraft.start_date}
                          onChange={handlePrescriptionStartDateChange}
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Columns</span>
                        <select
                          className={styles.select}
                          value={prescriptionColumnCount}
                          onChange={(event) =>
                            handlePrescriptionColumnCountChange(
                              Number(event.target.value)
                            )
                          }
                        >
                          <option value={2}>2 Columns</option>
                          <option value={3}>3 Columns</option>
                          <option value={4}>4 Columns</option>
                        </select>
                      </label>
                    </div>

                    <div className={styles.buttonRow}>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={handlePrescriptionAddRow}
                      >
                        Add Row
                      </button>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={handlePrescriptionRemoveRow}
                      >
                        Remove Row
                      </button>
                    </div>

                    <div
                      className={styles.prescriptionGrid}
                      style={{
                        gridTemplateColumns: `repeat(${prescriptionColumnCount}, minmax(0, 1fr))`
                      }}
                    >
                      {prescriptionDraft.columns.map((column, colIndex) => (
                        <div
                          className={styles.prescriptionColumn}
                          key={`col-${colIndex}`}
                        >
                          <label className={styles.field}>
                            <span className={styles.label}>Header</span>
                            <input
                              className={styles.input}
                              value={column.header}
                              onChange={(event) =>
                                handlePrescriptionHeaderChange(
                                  colIndex,
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          {column.rows.map((row, rowIndex) => (
                            <div
                              className={styles.prescriptionRow}
                              key={`row-${rowIndex}`}
                            >
                              <input
                                className={styles.input}
                                placeholder={`Step ${rowIndex + 1} Product`}
                                value={row.product}
                                onChange={(event) =>
                                  handlePrescriptionRowChange(
                                    colIndex,
                                    rowIndex,
                                    "product",
                                    event.target.value
                                  )
                                }
                              />
                              <textarea
                                id={`dir-${colIndex}-${rowIndex}`}
                                className={styles.textarea}
                                placeholder="Directions"
                                value={row.directions}
                                onChange={(event) =>
                                  handlePrescriptionRowChange(
                                    colIndex,
                                    rowIndex,
                                    "directions",
                                    event.target.value
                                  )
                                }
                              />
                              <button
                                className={styles.buttonSecondary}
                                type="button"
                                onClick={() =>
                                  handlePrescriptionHighlight(colIndex, rowIndex)
                                }
                              >
                                Highlight
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className={styles.buttonRow}>
                      <button className={styles.button} type="submit">
                        {selectedPrescriptionId
                          ? "Save Prescription"
                          : "Create Prescription"}
                      </button>
                      {selectedPrescriptionId && (
                        <button
                          className={`${styles.button} ${styles.buttonDanger}`}
                          type="button"
                          onClick={handlePrescriptionDelete}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </form>

                  {prescriptionPreviewUrl && (
                    <div className={styles.prescriptionPreview}>
                      <iframe
                        title="Prescription Preview"
                        src={prescriptionPreviewUrl}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "alerts" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Alerts</h2>
            <form onSubmit={handleAlertCreate} className={styles.alertForm}>
              <label className={styles.field}>
                <span className={styles.label}>Deadline</span>
                <input
                  className={styles.input}
                  placeholder="MM/DD/YYYY"
                  value={alertDeadline}
                  onChange={(event) => setAlertDeadline(event.target.value)}
                  onBlur={handleAlertDeadlineBlur}
                  disabled={!selectedClientId}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Notes</span>
                <textarea
                  className={styles.textarea}
                  value={alertNotes}
                  onChange={(event) => setAlertNotes(event.target.value)}
                  disabled={!selectedClientId}
                />
              </label>
              <div className={styles.buttonRow}>
                <button
                  className={styles.button}
                  type="submit"
                  disabled={!selectedClientId}
                >
                  Set Alert
                </button>
                {selectedClientId ? (
                  <span className={styles.notice}>
                    Setting alert for {clientForm.full_name || "selected client"}.
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
                      const status = calculateAlertStatus(alert.deadline);
                      return (
                        <tr key={alert.id}>
                          <td>{alert.full_name}</td>
                          <td>
                            <span
                              className={`${styles.alertStatus} ${getAlertStatusClass(
                                status
                              )}`}
                            >
                              {status}
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
          </div>
        )}
      </section>

      {printUrl && (
        <iframe
          ref={printFrameRef}
          className={styles.printFrame}
          title="Print Prescription"
          src={printUrl}
          onLoad={handlePrintFrameLoad}
        />
      )}

      {status && <p className={styles.status}>{status}</p>}
      {error && <p className={styles.status}>Error: {error}</p>}
    </div>
  );
}
