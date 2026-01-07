"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

type PhotoDragState = {
  photo: Photo;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  isDragging: boolean;
};

type PhotoDragGhost = {
  photo: Photo;
  x: number;
  y: number;
  width: number;
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

type WorkspaceTab = "appointments" | "photos" | "prescriptions";
type OverviewTab = "info" | "health";
type OverviewMode = "compact" | "edit";

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
  { id: "appointments", label: "Appointments" },
  { id: "photos", label: "Photos" },
  { id: "prescriptions", label: "Prescriptions" }
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
const BIRTHDAY_WINDOW_BEFORE_DAYS = 14;
const BIRTHDAY_WINDOW_AFTER_DAYS = 7;
const CELEBRATION_DURATION_MS = 5600;
const CONFETTI_COUNT = 300;
const BALLOON_COUNT = 14;
const CONFETTI_COLORS = ["#f06b6b", "#ffd36b", "#7cc7ff", "#b8f28f", "#c78bff"];
const BALLOON_COLORS = ["#f7a2b6", "#f9d270", "#8fd2ff", "#b4ef9a", "#f2a2f5"];

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

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseMonthDay = (value: string): { month: number; day: number } | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/[-/]/).filter(Boolean);
  let month: number | null = null;
  let day: number | null = null;

  if (parts.length >= 3 && parts[0]?.length === 4) {
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 4) {
      month = Number(digits.slice(0, 2));
      day = Number(digits.slice(2, 4));
    } else if (parts.length >= 2) {
      month = Number(parts[0]);
      day = Number(parts[1]);
    }
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { month, day };
};

const diffDays = (target: Date, base: Date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const baseMid = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12);
  const targetMid = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    12
  );
  return Math.round((targetMid.getTime() - baseMid.getTime()) / msPerDay);
};

const isWithinBirthdayWindow = (value: string, now = new Date()) => {
  const parsed = parseMonthDay(value);
  if (!parsed) {
    return false;
  }

  const { month, day } = parsed;
  const year = now.getFullYear();
  const candidates = [year - 1, year, year + 1].map(
    (candidateYear) => new Date(candidateYear, month - 1, day)
  );

  return candidates.some((candidate) => {
    const delta = diffDays(candidate, now);
    return (
      delta >= -BIRTHDAY_WINDOW_AFTER_DAYS && delta <= BIRTHDAY_WINDOW_BEFORE_DAYS
    );
  });
};

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) {
    return "";
  }
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatCompactValue = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : "—";
};

const formatCompactAddress = (form: ClientForm) => {
  const address1 = form.address1.trim();
  const address2 = form.address2.trim();
  const cityState = [form.city.trim(), form.state.trim()]
    .filter(Boolean)
    .join(", ");
  const zip = form.zip.trim();

  return [address1, address2, cityState, zip].filter(Boolean).join("\n");
};

const formatCompactPhones = (primary: string, secondary: string) => {
  const primaryTrimmed = primary.trim();
  const secondaryTrimmed = secondary.trim();

  if (!primaryTrimmed && !secondaryTrimmed) {
    return "";
  }
  if (!primaryTrimmed) {
    return secondaryTrimmed;
  }
  if (!secondaryTrimmed) {
    return primaryTrimmed;
  }
  return `${primaryTrimmed}\n${secondaryTrimmed}`;
};

const REFERRED_BY_PREFIX = "client:";

const parseReferredById = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith(REFERRED_BY_PREFIX)) {
    return null;
  }
  const id = Number(trimmed.slice(REFERRED_BY_PREFIX.length));
  return Number.isFinite(id) ? id : null;
};

const resolveReferredByName = (value: string, clients: Client[]) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const id = parseReferredById(trimmed);
  if (id === null) {
    return trimmed;
  }
  const match = clients.find((client) => client.id === id);
  return match?.full_name ?? trimmed;
};

const CompactValue = ({
  value,
  multiline = false,
  allowTruncate = true
}: {
  value: string;
  multiline?: boolean;
  allowTruncate?: boolean;
}) => {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const displayValue = formatCompactValue(value);

  useEffect(() => {
    if (!allowTruncate) {
      setIsTruncated(false);
      return;
    }
    const element = textRef.current;
    if (!element) {
      return;
    }

    const checkTruncation = () => {
      if (multiline) {
        setIsTruncated(element.scrollHeight > element.clientHeight);
      } else {
        setIsTruncated(element.scrollWidth > element.clientWidth);
      }
    };

    checkTruncation();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(checkTruncation);
      observer.observe(element);
    } else {
      window.addEventListener("resize", checkTruncation);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", checkTruncation);
      }
    };
  }, [displayValue, multiline, allowTruncate]);

  const tooltipValue = value.trim();

  return (
    <span
      className={`${styles.readonlyValue} ${
        multiline ? styles.readonlyValueMultiline : ""
      } ${!allowTruncate ? styles.readonlyValueWrap : ""}`}
      data-tooltip={
        allowTruncate && isTruncated && tooltipValue ? tooltipValue : undefined
      }
    >
      <span
        ref={textRef}
        className={
          allowTruncate
            ? multiline
              ? styles.readonlyTextMultiline
              : styles.readonlyText
            : styles.readonlyTextWrap
        }
      >
        {displayValue}
      </span>
    </span>
  );
};

const ExpandableValue = ({
  value,
  previewLines = 2
}: {
  value: string;
  previewLines?: number;
}) => {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const displayValue = formatCompactValue(value);

  useEffect(() => {
    setExpanded(false);
  }, [displayValue]);

  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) {
      return;
    }

    const checkOverflow = () => {
      setHasOverflow(element.scrollHeight > element.clientHeight + 1);
    };

    checkOverflow();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(checkOverflow);
      observer.observe(element);
    } else {
      window.addEventListener("resize", checkOverflow);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", checkOverflow);
      }
    };
  }, [displayValue, expanded, previewLines]);

  const showToggle = hasOverflow || expanded;

  return (
    <div className={styles.expandableValue}>
      <div
        ref={textRef}
        className={`${styles.expandableText} ${
          expanded ? "" : styles.expandableTextClamped
        }`}
        style={
          expanded
            ? undefined
            : ({ "--clamp-lines": String(previewLines) } as CSSProperties)
        }
      >
        {displayValue}
      </div>
      {showToggle && (
        <button
          className={`${styles.expandableToggle} ${
            expanded ? styles.expandableToggleExpanded : ""
          }`}
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </div>
  );
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialClientIdRef = useRef<number | null>(null);
  const selectedClientIdRef = useRef<number | null>(null);
  const clientDetailsRequestIdRef = useRef(0);
  const clientDetailsAbortRef = useRef<AbortController | null>(null);
  const clientFormMutationIdRef = useRef(0);
  const lastSavedClientFormRef = useRef<ClientForm>(EMPTY_CLIENT);
  const lastSavedHealthFormRef = useRef<HealthForm>(EMPTY_HEALTH);
  const lastSavedReferredByValueRef = useRef("");
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
  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);
  const [appointmentNotesMode, setAppointmentNotesMode] = useState<
    "selected" | "all"
  >("selected");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [comparePickMode, setComparePickMode] = useState<"before" | "after">(
    "before"
  );
  const [compareBeforeId, setCompareBeforeId] = useState<number | null>(null);
  const [compareAfterId, setCompareAfterId] = useState<number | null>(null);
  const [photoDragTarget, setPhotoDragTarget] = useState<"before" | "after" | null>(
    null
  );
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [photoDragGhost, setPhotoDragGhost] = useState<PhotoDragGhost | null>(
    null
  );
  const photoDragStateRef = useRef<PhotoDragState | null>(null);
  const photoBeforeSlotRef = useRef<HTMLDivElement | null>(null);
  const photoAfterSlotRef = useRef<HTMLDivElement | null>(null);
  const [isBeforeCommentEditing, setIsBeforeCommentEditing] = useState(false);
  const [isAfterCommentEditing, setIsAfterCommentEditing] = useState(false);
  const [beforeCommentDraft, setBeforeCommentDraft] = useState("");
  const [afterCommentDraft, setAfterCommentDraft] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    null
  );
  const [profileUploadFile, setProfileUploadFile] = useState<File | null>(null);
  const [profileUploadKey, setProfileUploadKey] = useState(0);
  const [isProfileUploadOpen, setIsProfileUploadOpen] = useState(false);
  const [profileUploadMode, setProfileUploadMode] = useState<"local" | "qr">(
    "qr"
  );
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUploadAppointmentId, setPhotoUploadAppointmentId] =
    useState<string>("");
  const [photoUploadFiles, setPhotoUploadFiles] = useState<FileList | null>(
    null
  );
  const [photoUploadKey, setPhotoUploadKey] = useState(0);
  const [isPhotoUploadOpen, setIsPhotoUploadOpen] = useState(false);
  const [photoUploadMode, setPhotoUploadMode] = useState<"local" | "qr">("qr");
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [isPrescriptionEditing, setIsPrescriptionEditing] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<{
    colIndex: number;
    rowIndex: number;
  } | null>(null);
  const [showBirthdayCelebration, setShowBirthdayCelebration] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const celebrationTimeoutRef = useRef<number | null>(null);
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
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [referredByQuery, setReferredByQuery] = useState("");
  const [referredByValue, setReferredByValue] = useState("");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingClientDetails, setLoadingClientDetails] = useState(false);
  const [overviewTab, setOverviewTab] = useState<OverviewTab>("info");
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("compact");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("appointments");

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, index) => ({
        id: `${celebrationKey}-${index}`,
        left: Math.round(Math.random() * 1000) / 10,
        delay: 0,
        duration: 1800 + Math.random() * 1400,
        size: 6 + Math.random() * 6,
        rotation: Math.random() * 360,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]
      })),
    [celebrationKey]
  );

  const balloons = useMemo(
    () =>
      Array.from({ length: BALLOON_COUNT }, (_, index) => ({
        id: `${celebrationKey}-${index}`,
        x: Math.round(Math.random() * 1000) / 10,
        delay: 0,
        duration: 2600 + Math.random() * 1800,
        size: 44 + Math.random() * 24,
        color: BALLOON_COLORS[index % BALLOON_COLORS.length]
      })),
    [celebrationKey]
  );

  const triggerBirthdayCelebration = useCallback(() => {
    setCelebrationKey((prev) => prev + 1);
    setShowBirthdayCelebration(true);
  }, []);

  useEffect(() => {
    if (!showBirthdayCelebration) {
      return;
    }

    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
    }

    celebrationTimeoutRef.current = window.setTimeout(() => {
      setShowBirthdayCelebration(false);
    }, CELEBRATION_DURATION_MS);

    return () => {
      if (celebrationTimeoutRef.current) {
        window.clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = null;
      }
    };
  }, [showBirthdayCelebration, celebrationKey]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      return parseMmddyyyy(b.date) - parseMmddyyyy(a.date);
    });
  }, [appointments]);

  const selectedAppointment = useMemo(() => {
    if (!selectedAppointmentId) {
      return null;
    }
    return (
      sortedAppointments.find(
        (appointment) => appointment.id === selectedAppointmentId
      ) ?? null
    );
  }, [sortedAppointments, selectedAppointmentId]);

  const appointmentsWithNotes = useMemo(() => {
    return sortedAppointments.filter(
      (appointment) => (appointment.treatment_notes ?? "").trim()
    );
  }, [sortedAppointments]);

  const isBirthdayWindow = useMemo(
    () => isWithinBirthdayWindow(clientForm.birthdate),
    [clientForm.birthdate]
  );

  const appointmentNotesMeta = useMemo(() => {
    if (appointmentNotesMode === "all") {
      if (appointmentsWithNotes.length === 0) {
        return "No notes yet";
      }
      return `${appointmentsWithNotes.length} note${
        appointmentsWithNotes.length === 1 ? "" : "s"
      }`;
    }
    return "";
  }, [appointmentNotesMode, appointmentsWithNotes.length, selectedAppointment]);

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

  const hasSearchQuery = searchQuery.trim().length > 0;

  const referredByMatches = useMemo(() => {
    const normalizedQuery = referredByQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }
    return allClients
      .filter((client) => {
        if (selectedClientId && client.id === selectedClientId) {
          return false;
        }
        return client.full_name.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 3);
  }, [allClients, referredByQuery, selectedClientId]);

  const referredBySelected = useMemo(() => {
    const trimmedForm = clientForm.referred_by.trim();
    if (trimmedForm) {
      return trimmedForm;
    }
    return referredByValue.trim();
  }, [clientForm.referred_by, referredByValue]);

  const referredByDisplay = useMemo(() => {
    return resolveReferredByName(referredBySelected, allClients);
  }, [referredBySelected, allClients]);

  const referralStats = useMemo(() => {
    if (!selectedClientId) {
      return { count: 0, latestName: "" };
    }
    const selected = allClients.find((client) => client.id === selectedClientId);
    if (!selected) {
      return { count: 0, latestName: "" };
    }
    const selectedName = selected.full_name.trim().toLowerCase();
    const idToken = `${REFERRED_BY_PREFIX}${selectedClientId}`;
    const matches = allClients.filter((client) => {
      if (client.id === selectedClientId) {
        return false;
      }
      const referredBy = client.referred_by?.trim();
      if (!referredBy) {
        return false;
      }
      if (referredBy === idToken) {
        return true;
      }
      if (selectedName && referredBy.toLowerCase() === selectedName) {
        return true;
      }
      return false;
    });

    let latestName = "";
    let latestId = -1;
    for (const client of matches) {
      if (client.id > latestId) {
        latestId = client.id;
        latestName = client.full_name;
      }
    }

    return { count: matches.length, latestName };
  }, [allClients, selectedClientId]);

  const compareBeforePhoto = useMemo(() => {
    return photos.find((photo) => photo.id === compareBeforeId) ?? null;
  }, [photos, compareBeforeId]);

  const compareAfterPhoto = useMemo(() => {
    return photos.find((photo) => photo.id === compareAfterId) ?? null;
  }, [photos, compareAfterId]);

  useEffect(() => {
    setBeforeCommentDraft(compareBeforePhoto?.description ?? "");
    setIsBeforeCommentEditing(false);
  }, [compareBeforePhoto?.id]);

  useEffect(() => {
    setAfterCommentDraft(compareAfterPhoto?.description ?? "");
    setIsAfterCommentEditing(false);
  }, [compareAfterPhoto?.id]);

  const selectedPrescription = useMemo(() => {
    return (
      prescriptions.find((prescription) => prescription.id === selectedPrescriptionId) ??
      null
    );
  }, [prescriptions, selectedPrescriptionId]);

  const activeSearchClientId = useMemo(() => {
    if (
      !hasSearchQuery ||
      searchActiveIndex < 0 ||
      searchActiveIndex >= filteredClients.length
    ) {
      return null;
    }
    return filteredClients[searchActiveIndex].id;
  }, [hasSearchQuery, searchActiveIndex, filteredClients]);

  useEffect(() => {
    void loadClients();
    void loadClientOptions();
    void loadPrescriptionTemplates();
    void loadAlerts();
  }, []);

  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    setPortalTarget(document.body ?? null);
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
    if (
      !isPhotoUploadOpen ||
      photoUploadMode !== "qr" ||
      !photoUploadAppointmentId ||
      photoQrDataUrl ||
      photoQrLoading
    ) {
      return;
    }
    void handlePhotoQrGenerate();
  }, [
    isPhotoUploadOpen,
    photoUploadMode,
    photoUploadAppointmentId,
    photoQrDataUrl,
    photoQrLoading
  ]);

  useEffect(() => {
    setProfileQrDataUrl(null);
    setProfileQrUrl(null);
  }, [selectedClientId]);

  useEffect(() => {
    setIsAppointmentFormOpen(false);
    setAppointmentNotesMode("selected");
  }, [selectedClientId]);

  useEffect(() => {
    setSearchActiveIndex(-1);
  }, [searchQuery]);

  useEffect(() => {
    if (!hasSearchQuery || filteredClients.length === 0) {
      if (searchActiveIndex !== -1) {
        setSearchActiveIndex(-1);
      }
      return;
    }
    if (searchActiveIndex >= filteredClients.length) {
      setSearchActiveIndex(filteredClients.length - 1);
    }
  }, [hasSearchQuery, filteredClients.length, searchActiveIndex]);

  useEffect(() => {
    if (!selectedClientId || overviewMode !== "compact") {
      return;
    }
    setReferredByQuery(resolveReferredByName(referredBySelected, allClients));
  }, [selectedClientId, overviewMode, referredBySelected, allClients]);

  useEffect(() => {
    if (overviewMode === "edit") {
      setReferredByQuery("");
    }
  }, [overviewMode, selectedClientId]);

  const setNotice = (message: string | null, isError = false) => {
    if (isError) {
      setError(message);
      setStatus(null);
    } else {
      setStatus(message);
      setError(null);
    }
  };

  const syncClientRoute = (clientId: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (clientId === null) {
      params.delete("clientId");
    } else {
      params.set("clientId", String(clientId));
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) {
      initialClientIdRef.current = clientId;
      return;
    }
    initialClientIdRef.current = clientId;
    router.replace(nextUrl);
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
    const requestId = clientDetailsRequestIdRef.current + 1;
    clientDetailsRequestIdRef.current = requestId;
    const mutationToken = clientFormMutationIdRef.current;

    clientDetailsAbortRef.current?.abort();
    const abortController = new AbortController();
    clientDetailsAbortRef.current = abortController;

    setLoadingClientDetails(true);

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        signal: abortController.signal
      });
      const data = (await response.json()) as {
        client?: Client;
        health?: HealthInfo | null;
        error?: string;
      };

      if (!response.ok || !data.client) {
        throw new Error(data.error ?? "Failed to load client details");
      }

      if (
        requestId !== clientDetailsRequestIdRef.current ||
        selectedClientIdRef.current !== clientId ||
        clientFormMutationIdRef.current !== mutationToken
      ) {
        return;
      }

      clientFormMutationIdRef.current = 0;

      const client = data.client;
      const referredByRaw = client.referred_by ?? "";
      const nextClientForm = {
        id: client.id,
        full_name: client.full_name ?? "",
        gender: client.gender ?? "",
        birthdate: formatDateInput(client.birthdate ?? ""),
        primary_phone: formatPhoneInput(client.primary_phone ?? ""),
        secondary_phone: formatPhoneInput(client.secondary_phone ?? ""),
        email: client.email ?? "",
        address1: client.address1 ?? "",
        address2: client.address2 ?? "",
        city: client.city ?? "",
        state: client.state ?? "",
        zip: client.zip ?? "",
        referred_by: referredByRaw
      };
      setClientForm(nextClientForm);
      lastSavedClientFormRef.current = nextClientForm;
      setReferredByValue(referredByRaw);
      lastSavedReferredByValueRef.current = referredByRaw;
      setReferredByQuery(resolveReferredByName(referredByRaw, allClients));
      setProfilePictureUrl(
        client.profile_picture
          ? `/api/clients/${client.id}/profile-picture?ts=${Date.now()}`
          : null
      );
      setProfileUploadFile(null);

      const health = data.health ?? {};
      const nextHealthForm = {
        allergies: health.allergies ?? "",
        health_conditions: health.health_conditions ?? "",
        health_risks: health.health_risks ?? "",
        medications: health.medications ?? "",
        treatment_areas: health.treatment_areas ?? "",
        current_products: health.current_products ?? "",
        skin_conditions: health.skin_conditions ?? "",
        other_notes: health.other_notes ?? "",
        desired_improvement: health.desired_improvement ?? ""
      };
      setHealthForm(nextHealthForm);
      lastSavedHealthFormRef.current = nextHealthForm;

      const shouldCelebrate = isWithinBirthdayWindow(client.birthdate ?? "");
      if (shouldCelebrate) {
        triggerBirthdayCelebration();
      } else {
        setShowBirthdayCelebration(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setNotice(
        err instanceof Error ? err.message : "Failed to load client details",
        true
      );
    } finally {
      if (clientDetailsRequestIdRef.current === requestId) {
        setLoadingClientDetails(false);
      }
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

      const nextPhotos = data.photos ?? [];
      setPhotos(nextPhotos);

      const nextSelected = selectedPhotoId
        ? nextPhotos.find((photo) => photo.id === selectedPhotoId)
        : null;
      setSelectedPhotoId(nextSelected ? nextSelected.id : null);

      if (compareBeforeId && !nextPhotos.some((photo) => photo.id === compareBeforeId)) {
        setCompareBeforeId(null);
      }
      if (compareAfterId && !nextPhotos.some((photo) => photo.id === compareAfterId)) {
        setCompareAfterId(null);
      }
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
    selectedClientIdRef.current = clientId;
    clientFormMutationIdRef.current = 0;
    setSelectedClientId(clientId);
    syncClientRoute(clientId);
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
    selectedClientIdRef.current = null;
    clientFormMutationIdRef.current = 0;
    clientDetailsAbortRef.current?.abort();
    clientDetailsRequestIdRef.current += 1;
    setLoadingClientDetails(false);
    setSelectedClientId(null);
    syncClientRoute(null);
    setOverviewMode("edit");
    setClientForm(EMPTY_CLIENT);
    setReferredByQuery("");
    setReferredByValue("");
    setHealthForm(EMPTY_HEALTH);
    lastSavedClientFormRef.current = EMPTY_CLIENT;
    lastSavedHealthFormRef.current = EMPTY_HEALTH;
    lastSavedReferredByValueRef.current = "";
    setAppointments([]);
    setAppointmentForm(EMPTY_APPOINTMENT);
    setSelectedAppointmentId(null);
    setPhotos([]);
    setSelectedPhotoId(null);
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
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = event.target;
    const field = name as keyof ClientForm;
    let nextValue = value;
    if (field === "primary_phone" || field === "secondary_phone") {
      nextValue = formatPhoneInput(value);
    }
    if (field === "birthdate") {
      nextValue = formatDateInput(value);
    }
    clientFormMutationIdRef.current += 1;
    setClientForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleReferredByChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setReferredByQuery(value);
  };

  const handleReferredBySelect = (client: Client) => {
    const nextValue = `${REFERRED_BY_PREFIX}${client.id}`;
    clientFormMutationIdRef.current += 1;
    setClientForm((prev) => ({
      ...prev,
      referred_by: nextValue
    }));
    setReferredByValue(nextValue);
    setReferredByQuery("");
  };

  const handleReferredByCommit = () => {
    const trimmed = referredByQuery.trim();
    if (!trimmed) {
      return;
    }
    clientFormMutationIdRef.current += 1;
    setClientForm((prev) => ({
      ...prev,
      referred_by: trimmed
    }));
    setReferredByValue(trimmed);
    setReferredByQuery("");
  };

  const handleReferredByClear = () => {
    clientFormMutationIdRef.current += 1;
    setClientForm((prev) => ({
      ...prev,
      referred_by: ""
    }));
    setReferredByValue("");
    setReferredByQuery("");
  };

  const handleOverviewEditCancel = () => {
    const savedClient = lastSavedClientFormRef.current;
    const savedHealth = lastSavedHealthFormRef.current;
    const savedReferred = lastSavedReferredByValueRef.current;
    setClientForm({ ...savedClient });
    setHealthForm({ ...savedHealth });
    setReferredByValue(savedReferred);
    setReferredByQuery(resolveReferredByName(savedReferred, allClients));
    setOverviewMode("compact");
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
      const payload = {
        ...clientForm,
        referred_by: referredBySelected
      };
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
          setOverviewMode("compact");
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
        setOverviewMode("compact");
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
      lastSavedHealthFormRef.current = { ...healthForm };
      setOverviewMode("compact");
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

  const uploadProfileFile = async (file: File) => {
    if (!selectedClientId) {
      setNotice("Select a client before uploading a profile picture.", true);
      return false;
    }

    try {
      const formData = new FormData();
      formData.append("photo", file);

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
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Profile upload failed",
        true
      );
      return false;
    }
  };

  const handleProfileUploadClick = async () => {
    if (!profileUploadFile) {
      setNotice("Choose a profile image first.", true);
      return;
    }
    const success = await uploadProfileFile(profileUploadFile);
    if (success) {
      setIsProfileUploadOpen(false);
    }
  };

  const openProfileLocalPicker = async () => {
    const showOpenFilePicker = (
      window as Window & {
        showOpenFilePicker?: (options?: unknown) => Promise<
          {
            getFile: () => Promise<File>;
          }[]
        >;
      }
    ).showOpenFilePicker;

    if (showOpenFilePicker) {
      try {
        const [handle] = await showOpenFilePicker({
          multiple: false,
          startIn: "pictures",
          types: [
            {
              description: "Images",
              accept: {
                "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]
              }
            }
          ]
        });
        const file = await handle.getFile();
        setProfileUploadFile(file);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setNotice(
          err instanceof Error ? err.message : "Failed to open file picker",
          true
        );
      }
    } else {
      profileFileInputRef.current?.click();
    }
  };

  const handleProfileModeChange = (mode: "local" | "qr") => {
    setProfileUploadMode(mode);
    if (mode === "qr" && !profileQrDataUrl && !profileQrLoading) {
      void handleProfileQrGenerate();
    }
  };

  const openProfileUploadModal = () => {
    setProfileUploadMode("qr");
    setIsProfileUploadOpen(true);
    if (!profileQrDataUrl && !profileQrLoading) {
      void handleProfileQrGenerate();
    }
  };

  const closeProfileUploadModal = () => {
    setIsProfileUploadOpen(false);
  };

  const openPhotoUploadModal = () => {
    setPhotoUploadMode("qr");
    setIsPhotoUploadOpen(true);
    if (photoUploadAppointmentId && !photoQrDataUrl && !photoQrLoading) {
      void handlePhotoQrGenerate();
    }
  };

  const closePhotoUploadModal = () => {
    setIsPhotoUploadOpen(false);
  };

  const handlePhotoModeChange = (mode: "local" | "qr") => {
    setPhotoUploadMode(mode);
    if (mode === "qr" && photoUploadAppointmentId && !photoQrDataUrl && !photoQrLoading) {
      void handlePhotoQrGenerate();
    }
  };

  const openPhotoLocalPicker = async () => {
    const showOpenFilePicker = (
      window as Window & {
        showOpenFilePicker?: (options?: unknown) => Promise<
          {
            getFile: () => Promise<File>;
          }[]
        >;
      }
    ).showOpenFilePicker;

    if (showOpenFilePicker) {
      try {
        const handles = await showOpenFilePicker({
          multiple: true,
          startIn: "pictures",
          types: [
            {
              description: "Images",
              accept: {
                "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]
              }
            }
          ]
        });
        const dataTransfer = new DataTransfer();
        for (const handle of handles) {
          const file = await handle.getFile();
          dataTransfer.items.add(file);
        }
        setPhotoUploadFiles(dataTransfer.files);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setNotice(
          err instanceof Error ? err.message : "Failed to open file picker",
          true
        );
      }
    } else {
      photoFileInputRef.current?.click();
    }
  };

  const handlePhotoUpload = async (event?: React.FormEvent) => {
    event?.preventDefault();
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
      setIsPhotoUploadOpen(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Photo upload failed", true);
    }
  };

  const handlePhotoSelect = (photo: Photo) => {
    setSelectedPhotoId(photo.id);
    if (comparePickMode === "before") {
      setCompareBeforeId(photo.id);
    } else {
      setCompareAfterId(photo.id);
    }
  };

  const getPhotoDropTarget = useCallback((x: number, y: number) => {
    const beforeRect = photoBeforeSlotRef.current?.getBoundingClientRect();
    if (
      beforeRect &&
      x >= beforeRect.left &&
      x <= beforeRect.right &&
      y >= beforeRect.top &&
      y <= beforeRect.bottom
    ) {
      return "before" as const;
    }
    const afterRect = photoAfterSlotRef.current?.getBoundingClientRect();
    if (
      afterRect &&
      x >= afterRect.left &&
      x <= afterRect.right &&
      y >= afterRect.top &&
      y <= afterRect.bottom
    ) {
      return "after" as const;
    }
    return null;
  }, []);

  const handlePhotoPointerMove = useCallback(
    (event: PointerEvent) => {
      const dragState = photoDragStateRef.current;
      if (!dragState) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY
      );
      if (!dragState.isDragging) {
        if (distance < 6) {
          return;
        }
        dragState.isDragging = true;
        setIsPhotoDragging(true);
      }

      setPhotoDragGhost({
        photo: dragState.photo,
        x: event.clientX - dragState.offsetX,
        y: event.clientY - dragState.offsetY,
        width: dragState.width
      });

      setPhotoDragTarget(getPhotoDropTarget(event.clientX, event.clientY));
    },
    [getPhotoDropTarget]
  );

  const handlePhotoPointerUp = useCallback(
    (event: PointerEvent) => {
      const dragState = photoDragStateRef.current;
      if (!dragState) {
        return;
      }

      window.removeEventListener("pointermove", handlePhotoPointerMove);
      window.removeEventListener("pointerup", handlePhotoPointerUp);

      if (dragState.isDragging) {
        const target = getPhotoDropTarget(event.clientX, event.clientY);
        if (target === "before") {
          setCompareBeforeId(dragState.photo.id);
        } else if (target === "after") {
          setCompareAfterId(dragState.photo.id);
        }
        if (target) {
          setSelectedPhotoId(dragState.photo.id);
        }
      }

      setPhotoDragTarget(null);
      setPhotoDragGhost(null);
      setIsPhotoDragging(false);
      photoDragStateRef.current = null;
    },
    [getPhotoDropTarget, handlePhotoPointerMove]
  );

  const handlePhotoPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    photo: Photo
  ) => {
    if (event.button !== 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    photoDragStateRef.current = {
      photo,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      isDragging: false
    };

    setSelectedPhotoId(photo.id);
    window.removeEventListener("pointermove", handlePhotoPointerMove);
    window.removeEventListener("pointerup", handlePhotoPointerUp);
    window.addEventListener("pointermove", handlePhotoPointerMove);
    window.addEventListener("pointerup", handlePhotoPointerUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePhotoPointerMove);
      window.removeEventListener("pointerup", handlePhotoPointerUp);
    };
  }, [handlePhotoPointerMove, handlePhotoPointerUp]);

  const handlePhotoCommentSave = async (
    photoId: number,
    comment: string,
    target: "before" | "after"
  ) => {
    const trimmed = comment.trim();
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update photo");
      }

      if (selectedClientId) {
        await loadPhotos(selectedClientId);
      }
      setNotice("Comment saved.");
      if (target === "before") {
        setIsBeforeCommentEditing(false);
        setBeforeCommentDraft(trimmed);
      } else {
        setIsAfterCommentEditing(false);
        setAfterCommentDraft(trimmed);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Photo update failed", true);
    }
  };

  const handlePhotoCommentEdit = (target: "before" | "after") => {
    if (target === "before") {
      setIsBeforeCommentEditing(true);
    } else {
      setIsAfterCommentEditing(true);
    }
  };

  const handlePhotoCommentCancel = (target: "before" | "after") => {
    if (target === "before") {
      setIsBeforeCommentEditing(false);
      setBeforeCommentDraft(compareBeforePhoto?.description ?? "");
    } else {
      setIsAfterCommentEditing(false);
      setAfterCommentDraft(compareAfterPhoto?.description ?? "");
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
      if (selectedPhotoId === photo.id) {
        setSelectedPhotoId(null);
      }
      if (compareBeforeId === photo.id) {
        setCompareBeforeId(null);
      }
      if (compareAfterId === photo.id) {
        setCompareAfterId(null);
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

  const handlePrescriptionHighlight = () => {
    if (!highlightTarget) {
      setNotice("Select text to highlight.", true);
      return;
    }

    const { colIndex, rowIndex } = highlightTarget;
    const textarea = document.getElementById(
      `dir-${colIndex}-${rowIndex}`
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      setNotice("Select text to highlight.", true);
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    if (start === end) {
      setNotice("Select text to highlight.", true);
      textarea.focus();
      return;
    }
    const value = textarea.value;
    const nextValue =
      value.slice(0, start) +
      `[h]${value.slice(start, end)}[/h]` +
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
    setIsPrescriptionEditing(false);

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

  const clearPrescriptionSelection = () => {
    setSelectedPrescriptionId(null);
    setPrescriptionPreviewUrl(null);
    setIsPrescriptionEditing(false);
  };

  const handlePrescriptionCancel = () => {
    if (selectedPrescriptionId) {
      const selected = prescriptions.find(
        (prescription) => prescription.id === selectedPrescriptionId
      );
      if (selected) {
        void handlePrescriptionSelect(selected);
        return;
      }
    }
    setIsPrescriptionEditing(false);
  };

  const handlePrescriptionNew = () => {
    setSelectedPrescriptionId(null);
    const draft = createPrescriptionDraft(prescriptionColumnCount);
    draft.start_date = getTodayDateString();
    setPrescriptionDraft(draft);
    setPrescriptionPreviewUrl(null);
    setIsPrescriptionEditing(true);
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
        setIsPrescriptionEditing(false);
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
        setIsPrescriptionEditing(false);
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
      clearPrescriptionSelection();
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
        setIsPrescriptionEditing(false);
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
    setIsPrescriptionEditing(true);
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
    setAppointmentNotesMode("selected");
    setPhotoUploadAppointmentId(String(appointment.id));
  };

  const handleAppointmentEdit = (appointment: Appointment) => {
    handleAppointmentSelect(appointment);
    setIsAppointmentFormOpen(true);
  };

  const handleAppointmentNew = () => {
    setSelectedAppointmentId(null);
    setAppointmentForm(EMPTY_APPOINTMENT);
    setIsAppointmentFormOpen(true);
  };

  const handleAppointmentFormClose = () => {
    setIsAppointmentFormOpen(false);
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
        setIsAppointmentFormOpen(false);
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
        setIsAppointmentFormOpen(false);
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
    setSearchActiveIndex(-1);
  };

  const handleSearch = () => {
    setSearchQuery((prev) => prev.trim());
  };

  const handleSelectClientFromSearch = async (clientId: number) => {
    setSearchQuery("");
    setSearchActiveIndex(-1);
    await handleSelectClient(clientId);
  };

  return (
    <div
      className={`${styles.page} ${isPhotoDragging ? styles.photoDragActive : ""}`}
    >
      {showBirthdayCelebration && (
        <div className={styles.birthdayOverlay} aria-hidden="true">
          <div className={styles.confettiBurst}>
            {confettiPieces.map((piece) => (
              <span
                key={piece.id}
                className={styles.confettiPiece}
                style={
                  {
                    "--left": `${piece.left}%`,
                    "--delay": `${piece.delay}ms`,
                    "--duration": `${piece.duration}ms`,
                    "--size": `${piece.size}px`,
                    "--rotation": `${piece.rotation}deg`,
                    "--color": piece.color
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className={styles.balloonField}>
            {balloons.map((balloon) => (
              <div
                key={balloon.id}
                className={styles.balloon}
                style={
                  {
                    "--x": `${balloon.x}%`,
                    "--delay": `${balloon.delay}ms`,
                    "--duration": `${balloon.duration}ms`,
                    "--size": `${balloon.size}px`,
                    "--color": balloon.color
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      )}
      <div className={styles.topGrid}>
        <section className={`${styles.panel} ${styles.clientsPanel}`}>
          <div className={styles.clientSearchPanel}>
            <div className={styles.clientSearchRow}>
              <label className={styles.field}>
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
                    if (event.key === "ArrowDown" && hasSearchQuery) {
                      event.preventDefault();
                      if (filteredClients.length > 0) {
                        setSearchActiveIndex((prev) =>
                          Math.min(prev + 1, filteredClients.length - 1)
                        );
                      }
                      return;
                    }
                    if (event.key === "ArrowUp" && hasSearchQuery) {
                      event.preventDefault();
                      if (filteredClients.length > 0) {
                        setSearchActiveIndex((prev) =>
                          prev <= 0 ? 0 : prev - 1
                        );
                      }
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (hasSearchQuery && filteredClients.length > 0) {
                        const nextIndex =
                          searchActiveIndex >= 0 ? searchActiveIndex : 0;
                        const nextClient = filteredClients[nextIndex];
                        if (nextClient) {
                          void handleSelectClientFromSearch(nextClient.id);
                          return;
                        }
                      }
                      handleSearch();
                    }
                  }}
                />
              </label>
              <div className={styles.clientSearchActions}>
                <button
                  className={styles.buttonSecondary}
                  type="button"
                  onClick={handleSearch}
                >
                  Search
                </button>
                <button
                  className={styles.buttonSecondary}
                  type="button"
                  onClick={handleSearchClear}
                >
                  Clear
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
            {hasSearchQuery && (
              <div className={styles.clientSearchResults}>
                {loadingClients && (
                  <p className={styles.notice}>Loading clients...</p>
                )}
                {!loadingClients && filteredClients.length === 0 && (
                  <p className={styles.notice}>No clients found.</p>
                )}
                {!loadingClients && filteredClients.length > 0 && (
                  <ul className={styles.clientSearchList}>
                    {filteredClients.map((client) => (
                      <li
                        key={client.id}
                        className={`${styles.clientItem} ${
                          activeSearchClientId === client.id
                            ? styles.clientItemSelected
                            : ""
                        }`}
                        onClick={() => void handleSelectClientFromSearch(client.id)}
                        role="button"
                        tabIndex={0}
                        aria-selected={activeSearchClientId === client.id}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleSelectClientFromSearch(client.id);
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
          </div>
        </section>
        <section className={`${styles.panel} ${styles.overviewPanel}`}>
          <div className={styles.overviewHeader}>
            <div>
              <h2 className={styles.overviewTitle}>
                {clientForm.full_name ? clientForm.full_name : "Client Overview"}
              </h2>
            </div>
            {selectedClientId && (
              <div className={styles.overviewMetaRow}>
                {referralStats.count > 0 && (
                  <span
                    className={`${styles.overviewMeta} ${styles.overviewMetaReferral}`}
                  >
                    +{referralStats.count} Referral
                    {referralStats.count === 1 ? "" : "s"}
                    {referralStats.latestName
                      ? ` -> ${referralStats.latestName}`
                      : ""}
                  </span>
                )}
                <span className={styles.overviewMeta}>ID #{selectedClientId}</span>
              </div>
            )}
          </div>

          <div
            className={`${styles.overviewGrid} ${
              overviewMode === "compact" ? styles.overviewGridCompact : ""
            }`}
          >
            <div
              className={`${styles.profileCard} ${
                overviewMode === "compact" ? styles.compactCard : ""
              }`}
            >
              {!selectedClientId && (
                <p className={styles.notice}>
                  Select a client to manage profile photos.
                </p>
              )}
              {selectedClientId && (
                <>
                  <div
                    className={`${styles.profileStack} ${
                      overviewMode === "compact" ? styles.profileStackCompact : ""
                    }`}
                  >
                    {profilePictureUrl ? (
                      <img
                        className={`${styles.profileImage} ${
                          overviewMode === "compact"
                            ? styles.profileImageCompact
                            : ""
                        }`}
                        src={profilePictureUrl}
                        alt="Profile"
                        onError={() => setProfilePictureUrl(null)}
                      />
                    ) : (
                      <div
                        className={`${styles.profilePlaceholder} ${
                          overviewMode === "compact"
                            ? styles.profilePlaceholderCompact
                            : ""
                        }`}
                      >
                        No profile picture yet.
                      </div>
                    )}
                    {overviewMode === "edit" && (
                      <div className={styles.buttonRow}>
                        <button
                          className={styles.button}
                          type="button"
                          onClick={openProfileUploadModal}
                        >
                          Upload
                        </button>
                      </div>
                    )}
                  </div>

                  {isProfileUploadOpen && portalTarget
                    ? createPortal(
                        <div
                          className={styles.modalBackdrop}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="profile-upload-title"
                          onClick={closeProfileUploadModal}
                        >
                          <div
                            className={styles.modal}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className={styles.modalHeader}>
                              <div>
                                <h3
                                  id="profile-upload-title"
                                  className={styles.modalTitle}
                                >
                                  Upload Profile Photo
                                </h3>
                                <p className={styles.notice}>
                                  {clientForm.full_name
                                    ? `For ${clientForm.full_name}`
                                    : "Select a client to upload."}
                                </p>
                              </div>
                              <button
                                className={styles.iconButton}
                                type="button"
                                onClick={closeProfileUploadModal}
                                aria-label="Close"
                                title="Close"
                              >
                                X
                              </button>
                            </div>

                            <div className={styles.overviewTabs}>
                              <button
                                className={`${styles.tabButton} ${
                                  profileUploadMode === "qr"
                                    ? styles.tabButtonActive
                                    : ""
                                }`}
                                type="button"
                                onClick={() => handleProfileModeChange("qr")}
                              >
                                QR
                              </button>
                              <button
                                className={`${styles.tabButton} ${
                                  profileUploadMode === "local"
                                    ? styles.tabButtonActive
                                    : ""
                                }`}
                                type="button"
                                onClick={() => handleProfileModeChange("local")}
                              >
                                Local
                              </button>
                            </div>

                            {profileUploadMode === "local" && (
                              <div className={styles.modalSection}>
                                <input
                                  ref={profileFileInputRef}
                                  key={profileUploadKey}
                                  className={styles.hiddenInput}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleProfileFileChange}
                                />
                                <div className={styles.uploadPanel}>
                                  <div className={styles.modalRow}>
                                    <button
                                      className={styles.buttonSecondary}
                                      type="button"
                                      onClick={openProfileLocalPicker}
                                    >
                                      Choose File
                                    </button>
                                    <span className={styles.notice}>
                                      {profileUploadFile
                                        ? profileUploadFile.name
                                        : "No file selected."}
                                    </span>
                                  </div>
                                  <div className={styles.buttonRow}>
                                    <button
                                      className={styles.button}
                                      type="button"
                                      onClick={handleProfileUploadClick}
                                      disabled={!profileUploadFile}
                                    >
                                      Upload
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {profileUploadMode === "qr" && (
                              <div className={styles.modalSection}>
                                <div className={styles.qrPanel}>
                                <div className={styles.qrHeader}>
                                  <h3>Profile QR Upload</h3>
                                  {profileQrLoading && (
                                    <span className={styles.notice}>
                                      Generating...
                                    </span>
                                  )}
                                </div>
                                  {profileQrDataUrl && (
                                    <div className={styles.qrContent}>
                                      <img
                                        className={styles.qrImage}
                                        src={profileQrDataUrl}
                                        alt="Profile upload QR code"
                                      />
                                      {profileQrUrl && (
                                        <div className={styles.qrUrl}>
                                          {profileQrUrl}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>,
                        portalTarget
                      )
                    : null}
                </>
              )}
            </div>

            <div className={styles.detailsPanel}>
              <div className={styles.detailsHeader}>
                <div className={styles.overviewTabs}>
                  <button
                    className={`${styles.tabButton} ${
                      overviewTab === "info" ? styles.tabButtonActive : ""
                    }`}
                    type="button"
                    onClick={() => setOverviewTab("info")}
                    aria-pressed={overviewTab === "info"}
                  >
                    Info
                  </button>
                  <button
                    className={`${styles.tabButton} ${
                      overviewTab === "health" ? styles.tabButtonActive : ""
                    }`}
                    type="button"
                    onClick={() => setOverviewTab("health")}
                    aria-pressed={overviewTab === "health"}
                  >
                    Health
                  </button>
                </div>
                {overviewMode === "compact" && (
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    disabled={loadingClientDetails}
                    onClick={() =>
                      setOverviewMode("edit")
                    }
                    aria-label="Edit client"
                    title="Edit"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div
                className={`${styles.detailsCard} ${
                  overviewMode === "compact" ? styles.compactCard : ""
                }`}
              >
              {overviewMode === "edit" && (
                <button
                  className={`${styles.buttonSecondary} ${styles.editToggleIcon} ${styles.editToggleFloatingCard}`}
                  type="button"
                  disabled={loadingClientDetails}
                  onClick={handleOverviewEditCancel}
                  aria-label="Exit edit mode"
                  title="Close edit"
                >
                  X
                </button>
              )}
              {overviewTab === "info" && (
                <>
                  {overviewMode === "compact" ? (
                    <>
                      {!selectedClientId && (
                        <p className={styles.notice}>
                          Select a client to view info.
                        </p>
                      )}
                      {selectedClientId && (
                        <div
                          className={`${styles.formGrid} ${styles.compactGrid} ${styles.infoGrid}`}
                        >
                          <div className={styles.field}>
                            <span className={styles.label}>Gender</span>
                            <CompactValue value={clientForm.gender} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Phone</span>
                            <CompactValue
                              value={formatCompactPhones(
                                clientForm.primary_phone,
                                clientForm.secondary_phone
                              )}
                              multiline
                            />
                          </div>
                          <div
                            className={`${styles.field} ${
                              isBirthdayWindow ? styles.birthdayField : ""
                            }`}
                          >
                            <span className={styles.label}>Birthdate</span>
                            <CompactValue value={clientForm.birthdate} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Address</span>
                            <CompactValue
                              value={formatCompactAddress(clientForm)}
                              multiline
                            />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Email</span>
                            <CompactValue value={clientForm.email} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Referred By</span>
                            <CompactValue value={referredByDisplay} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handleClientSave}>
                      <div className={`${styles.formGrid} ${styles.infoGrid}`}>
                        <label className={styles.field}>
                          <span className={styles.label}>Full Name</span>
                          <input
                            className={styles.input}
                            name="full_name"
                            value={clientForm.full_name}
                            onChange={handleClientChange}
                            required
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Gender</span>
                          <select
                            className={styles.select}
                            name="gender"
                            value={clientForm.gender}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Primary Phone</span>
                          <input
                            className={styles.input}
                            name="primary_phone"
                            placeholder="(###) ###-####"
                            inputMode="numeric"
                            value={clientForm.primary_phone}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label
                          className={`${styles.field} ${
                            isBirthdayWindow ? styles.birthdayField : ""
                          }`}
                        >
                          <span className={styles.label}>Birthdate</span>
                          <div
                            className={`${styles.birthdayInputWrap} ${
                              isBirthdayWindow ? styles.birthdayInputWrapActive : ""
                            }`}
                          >
                            <input
                              className={styles.input}
                              name="birthdate"
                              placeholder="MM/DD/YYYY"
                              inputMode="numeric"
                              value={clientForm.birthdate}
                              onChange={handleClientChange}
                              disabled={loadingClientDetails}
                            />
                          </div>
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Email</span>
                          <input
                            className={styles.input}
                            name="email"
                            value={clientForm.email}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Secondary Phone</span>
                          <input
                            className={styles.input}
                            name="secondary_phone"
                            placeholder="(###) ###-####"
                            inputMode="numeric"
                            value={clientForm.secondary_phone}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Address 1</span>
                          <input
                            className={styles.input}
                            name="address1"
                            value={clientForm.address1}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Address 2</span>
                          <input
                            className={styles.input}
                            name="address2"
                            value={clientForm.address2}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>City</span>
                          <input
                            className={styles.input}
                            name="city"
                            value={clientForm.city}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>State</span>
                          <input
                            className={styles.input}
                            name="state"
                            value={clientForm.state}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Zip</span>
                          <input
                            className={styles.input}
                            name="zip"
                            value={clientForm.zip}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Referred By</span>
                          <div className={styles.referredByField}>
                            {referredBySelected.trim() && (
                              <div className={styles.referredByTags}>
                                <span className={styles.referredByTag}>
                                  <span className={styles.referredByTagLabel}>
                                    {referredByDisplay}
                                  </span>
                                  <button
                                    className={styles.referredByTagRemove}
                                    type="button"
                                    onClick={handleReferredByClear}
                                    aria-label="Remove referral"
                                    title="Remove referral"
                                  >
                                    X
                                  </button>
                                </span>
                              </div>
                            )}
                            <input
                              className={styles.input}
                              name="referred_by"
                              value={referredByQuery}
                              onChange={handleReferredByChange}
                              placeholder="Search client name"
                              autoComplete="off"
                              disabled={loadingClientDetails}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  if (referredByMatches.length > 0) {
                                    handleReferredBySelect(referredByMatches[0]);
                                    return;
                                  }
                                  handleReferredByCommit();
                                }
                              }}
                            />
                            {referredByQuery.trim() !== "" && (
                              <div className={styles.referredByResults}>
                                {referredByMatches.length > 0 ? (
                                  <ul className={styles.referredByList}>
                                    {referredByMatches.map((client) => {
                                      const isSelected =
                                        parseReferredById(referredBySelected) ===
                                        client.id;
                                      return (
                                        <li key={client.id}>
                                          <button
                                            className={`${styles.referredByItem} ${
                                              isSelected
                                                ? styles.referredByItemSelected
                                                : ""
                                            }`}
                                            type="button"
                                            onMouseDown={(event) => {
                                              event.preventDefault();
                                              handleReferredBySelect(client);
                                            }}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                handleReferredBySelect(client);
                                              }
                                            }}
                                          >
                                            <span className={styles.referredByName}>
                                              {client.full_name}
                                            </span>
                                            {client.primary_phone && (
                                              <span className={styles.referredByMeta}>
                                                {client.primary_phone}
                                              </span>
                                            )}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <div className={styles.referredByEmpty}>
                                    No results
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                      <div className={styles.buttonRow}>
                        <button
                          className={styles.button}
                          type="submit"
                          disabled={loadingClientDetails}
                        >
                          {selectedClientId ? "Save Changes" : "Create Client"}
                        </button>
                        {selectedClientId && (
                          <button
                            className={`${styles.button} ${styles.buttonDanger} ${styles.buttonRowEnd}`}
                            type="button"
                            onClick={handleClientDelete}
                            disabled={loadingClientDetails}
                          >
                            Delete Client
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </>
              )}

              {overviewTab === "health" && (
                <>
                  {overviewMode === "compact" ? (
                    <>
                      {!selectedClientId && (
                        <p className={styles.notice}>
                          Select a client to view health info.
                        </p>
                      )}
                      {selectedClientId && (
                        <div className={`${styles.formGrid} ${styles.compactGrid}`}>
                          <div className={styles.field}>
                            <span className={styles.label}>Allergies</span>
                            <ExpandableValue value={healthForm.allergies} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Health Conditions</span>
                            <ExpandableValue value={healthForm.health_conditions} />
                          </div>
                          <div
                            className={`${styles.field} ${styles.healthRiskField}`}
                          >
                            <span className={styles.label}>Health Risks</span>
                            <ExpandableValue value={healthForm.health_risks} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Medications</span>
                            <ExpandableValue value={healthForm.medications} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Treatment Areas</span>
                            <ExpandableValue value={healthForm.treatment_areas} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Current Products</span>
                            <ExpandableValue value={healthForm.current_products} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Skin Conditions</span>
                            <ExpandableValue value={healthForm.skin_conditions} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Other Notes</span>
                            <ExpandableValue value={healthForm.other_notes} />
                          </div>
                          <div className={styles.field}>
                            <span className={styles.label}>Desired Improvement</span>
                            <ExpandableValue value={healthForm.desired_improvement} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handleHealthSave}>
                      <fieldset
                        className={styles.fieldset}
                        disabled={!selectedClientId}
                      >
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
                  )}
                </>
              )}
              </div>
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
        {activeTab === "appointments" && (
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <h2 className={styles.sectionTitle}>Appointments</h2>
              <button
                className={styles.button}
                type="button"
                onClick={handleAppointmentNew}
                disabled={!selectedClientId}
              >
                Add Appointment
              </button>
            </div>
            {!selectedClientId && (
              <p className={styles.notice}>Select a client to manage appointments.</p>
            )}
            {selectedClientId && (
              <div className={styles.appointmentsLayout}>
                <div className={styles.appointmentsMain}>
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
                            onDoubleClick={() => handleAppointmentEdit(appointment)}
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
                  {!isAppointmentFormOpen && (
                    <div className={styles.appointmentFormPlaceholder}>
                      <p className={styles.notice}>
                        Double-click an appointment to edit or click Add Appointment
                        to create a new one.
                      </p>
                    </div>
                  )}
                  {isAppointmentFormOpen && (
                    <div className={styles.appointmentFormCard}>
                      <form onSubmit={handleAppointmentSave}>
                      <button
                        className={`${styles.iconButton} ${styles.appointmentFormClose}`}
                        type="button"
                        onClick={handleAppointmentFormClose}
                        aria-label="Close appointment form"
                        title="Close"
                      >
                        X
                      </button>
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
                        {selectedAppointmentId && (
                          <button
                            className={`${styles.button} ${styles.buttonDanger} ${styles.buttonRowEnd}`}
                            type="button"
                            onClick={handleAppointmentDelete}
                          >
                            Delete
                          </button>
                          )}
                      </div>
                      </form>
                    </div>
                  )}
                </div>
                <aside className={styles.appointmentNotesPanel}>
                  <div className={styles.appointmentNotesHeader}>
                    <div className={styles.appointmentNotesHeading}>
                      <h3 className={styles.appointmentNotesTitle}>
                        Treatment Notes
                      </h3>
                      {appointmentNotesMeta && (
                        <span className={styles.appointmentNotesMeta}>
                          {appointmentNotesMeta}
                        </span>
                      )}
                    </div>
                    <div className={styles.notesToggle}>
                      <button
                        className={`${styles.notesToggleButton} ${
                          appointmentNotesMode === "selected"
                            ? styles.notesToggleButtonActive
                            : ""
                        }`}
                        type="button"
                        onClick={() => setAppointmentNotesMode("selected")}
                        aria-pressed={appointmentNotesMode === "selected"}
                      >
                        Selected
                      </button>
                      <button
                        className={`${styles.notesToggleButton} ${
                          appointmentNotesMode === "all"
                            ? styles.notesToggleButtonActive
                            : ""
                        }`}
                        type="button"
                        onClick={() => setAppointmentNotesMode("all")}
                        aria-pressed={appointmentNotesMode === "all"}
                      >
                        All
                      </button>
                    </div>
                  </div>
                  <div className={styles.appointmentNotesBody}>
                    {appointmentNotesMode === "selected" && (
                      <>
                        {!selectedAppointment && (
                          <p className={styles.appointmentNotesHint}>
                            Select an appointment to view treatment notes.
                          </p>
                        )}
                        {selectedAppointment && (
                          <div className={styles.appointmentNoteDetail}>
                            <div className={styles.appointmentNoteHeader}>
                              <span className={styles.appointmentNoteTitle}>
                                {selectedAppointment.date || "Appointment"}
                              </span>
                              <span className={styles.appointmentNoteMeta}>
                                {selectedAppointment.type || "Appointment"}
                              </span>
                            </div>
                            {selectedAppointment.treatment && (
                              <div className={styles.appointmentNoteSub}>
                                {selectedAppointment.treatment}
                              </div>
                            )}
                            <div className={styles.appointmentNoteBodyFull}>
                              {selectedAppointment.treatment_notes?.trim() ||
                                "No treatment notes yet."}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {appointmentNotesMode === "all" && (
                      <>
                        {appointmentsWithNotes.length === 0 && (
                          <p className={styles.appointmentNotesHint}>
                            No treatment notes yet.
                          </p>
                        )}
                        {appointmentsWithNotes.length > 0 && (
                          <div className={styles.appointmentNotesList}>
                            {appointmentsWithNotes.map((appointment) => (
                              <button
                                key={appointment.id}
                                className={`${styles.appointmentNoteCard} ${
                                  selectedAppointmentId === appointment.id
                                    ? styles.appointmentNoteCardSelected
                                    : ""
                                }`}
                                type="button"
                                onClick={() => handleAppointmentSelect(appointment)}
                              >
                                <div className={styles.appointmentNoteHeader}>
                                  <span className={styles.appointmentNoteTitle}>
                                    {appointment.date || "Appointment"}
                                  </span>
                                  <span className={styles.appointmentNoteMeta}>
                                    {appointment.type || "Appointment"}
                                  </span>
                                </div>
                                {appointment.treatment && (
                                  <div className={styles.appointmentNoteSub}>
                                    {appointment.treatment}
                                  </div>
                                )}
                                <div className={styles.appointmentNoteBody}>
                                  {appointment.treatment_notes?.trim() ||
                                    "No treatment notes yet."}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <h2 className={styles.sectionTitle}>Client Photos</h2>
              <div className={styles.photoCompareToggle}>
                <button
                  className={`${styles.photoCompareToggleButton} ${
                    comparePickMode === "before"
                      ? styles.photoCompareToggleButtonActive
                      : ""
                  }`}
                  type="button"
                  onClick={() => setComparePickMode("before")}
                  aria-pressed={comparePickMode === "before"}
                >
                  Before
                </button>
                <button
                  className={`${styles.photoCompareToggleButton} ${
                    comparePickMode === "after"
                      ? styles.photoCompareToggleButtonActive
                      : ""
                  }`}
                  type="button"
                  onClick={() => setComparePickMode("after")}
                  aria-pressed={comparePickMode === "after"}
                >
                  After
                </button>
              </div>
            </div>
            {!selectedClientId && (
              <p className={styles.notice}>Select a client to view photos.</p>
            )}
            {selectedClientId && (
              <>
                {isPhotoUploadOpen && portalTarget
                  ? createPortal(
                      <div
                        className={styles.modalBackdrop}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="photo-upload-title"
                        onClick={closePhotoUploadModal}
                      >
                        <div
                          className={styles.modal}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className={styles.modalHeader}>
                            <div>
                              <h3
                                id="photo-upload-title"
                                className={styles.modalTitle}
                              >
                                Upload Photos
                              </h3>
                              <p className={styles.notice}>
                                {clientForm.full_name
                                  ? `For ${clientForm.full_name}`
                                  : "Select a client to upload."}
                              </p>
                            </div>
                            <button
                              className={styles.iconButton}
                              type="button"
                              onClick={closePhotoUploadModal}
                              aria-label="Close"
                              title="Close"
                            >
                              X
                            </button>
                          </div>

                          <div className={styles.modalSection}>
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
                          </div>

                          <div className={styles.overviewTabs}>
                            <button
                              className={`${styles.tabButton} ${
                                photoUploadMode === "qr"
                                  ? styles.tabButtonActive
                                  : ""
                              }`}
                              type="button"
                              onClick={() => handlePhotoModeChange("qr")}
                            >
                              QR
                            </button>
                            <button
                              className={`${styles.tabButton} ${
                                photoUploadMode === "local"
                                  ? styles.tabButtonActive
                                  : ""
                              }`}
                              type="button"
                              onClick={() => handlePhotoModeChange("local")}
                            >
                              Local
                            </button>
                          </div>

                          {photoUploadMode === "local" && (
                            <div className={styles.modalSection}>
                              <input
                                ref={photoFileInputRef}
                                key={photoUploadKey}
                                className={styles.hiddenInput}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(event) =>
                                  setPhotoUploadFiles(event.target.files)
                                }
                              />
                              <div className={styles.uploadPanel}>
                                <div className={styles.modalRow}>
                                  <button
                                    className={styles.buttonSecondary}
                                    type="button"
                                    onClick={openPhotoLocalPicker}
                                  >
                                    Choose Files
                                  </button>
                                  <span className={styles.notice}>
                                    {photoUploadFiles?.length
                                      ? `${photoUploadFiles.length} file${
                                          photoUploadFiles.length === 1 ? "" : "s"
                                        } selected`
                                      : "No files selected."}
                                  </span>
                                </div>
                                <div className={styles.buttonRow}>
                                  <button
                                    className={styles.button}
                                    type="button"
                                    onClick={() => void handlePhotoUpload()}
                                    disabled={
                                      !photoUploadFiles?.length ||
                                      !photoUploadAppointmentId
                                    }
                                  >
                                    Upload Photos
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {photoUploadMode === "qr" && (
                            <div className={styles.modalSection}>
                              <div className={styles.qrPanel}>
                                <div className={styles.qrHeader}>
                                  <h3>Photo QR Upload</h3>
                                  {photoQrLoading && (
                                    <span className={styles.notice}>
                                      Generating...
                                    </span>
                                  )}
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
                                      alt="Photo upload QR code"
                                    />
                                    {photoQrUrl && (
                                      <div className={styles.qrUrl}>
                                        {photoQrUrl}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>,
                      portalTarget
                    )
                  : null}

                <div className={styles.photoCompareArea}>
                  <div className={styles.photoCompareGrid}>
                    <div
                      ref={photoBeforeSlotRef}
                      className={`${styles.photoCompareSlot} ${
                        compareBeforePhoto ? styles.photoCompareSlotFilled : ""
                      } ${
                        photoDragTarget === "before"
                          ? styles.photoCompareSlotDrag
                          : ""
                      }`}
                    >
                      <div className={styles.photoCompareLabelRow}>
                        <span className={styles.photoCompareLabel}>Before</span>
                        {compareBeforePhoto && (
                          <span className={styles.photoCompareMeta}>
                            {compareBeforePhoto.appt_date ?? "Unknown date"}
                            {compareBeforePhoto.type
                              ? ` · ${compareBeforePhoto.type}`
                              : ""}
                          </span>
                        )}
                      </div>
                      {compareBeforePhoto ? (
                        <img
                          className={styles.photoCompareImage}
                          src={
                            compareBeforePhoto.file_url ??
                            `/api/photos/${compareBeforePhoto.id}/file`
                          }
                          alt="Before comparison"
                        />
                      ) : (
                        <div className={styles.photoCompareEmpty}>
                          Select a photo for Before.
                        </div>
                      )}
                      {compareBeforePhoto && (
                        <div className={styles.photoCompareComment}>
                          <div className={styles.photoCompareCommentHeader}>
                            <span className={styles.photoCompareCommentLabel}>
                              Comments
                            </span>
                            {!isBeforeCommentEditing && (
                              <button
                                className={styles.buttonSecondary}
                                type="button"
                                onClick={() => handlePhotoCommentEdit("before")}
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          {!isBeforeCommentEditing && (
                            <div className={styles.photoCompareCommentText}>
                              {compareBeforePhoto.description?.trim() ||
                                "No comments yet."}
                            </div>
                          )}
                          {isBeforeCommentEditing && (
                            <>
                              <textarea
                                className={styles.textarea}
                                value={beforeCommentDraft}
                                onChange={(event) =>
                                  setBeforeCommentDraft(event.target.value)
                                }
                              />
                              <div className={styles.buttonRow}>
                                <button
                                  className={styles.button}
                                  type="button"
                                  onClick={() =>
                                    void handlePhotoCommentSave(
                                      compareBeforePhoto.id,
                                      beforeCommentDraft,
                                      "before"
                                    )
                                  }
                                >
                                  Save Comment
                                </button>
                                <button
                                  className={styles.buttonSecondary}
                                  type="button"
                                  onClick={() => handlePhotoCommentCancel("before")}
                                >
                                  Cancel
                                </button>
                                <button
                                  className={`${styles.button} ${styles.buttonDanger} ${styles.buttonRowEnd}`}
                                  type="button"
                                  onClick={() =>
                                    handlePhotoDelete(compareBeforePhoto)
                                  }
                                >
                                  Delete Photo
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      ref={photoAfterSlotRef}
                      className={`${styles.photoCompareSlot} ${
                        compareAfterPhoto ? styles.photoCompareSlotFilled : ""
                      } ${
                        photoDragTarget === "after"
                          ? styles.photoCompareSlotDrag
                          : ""
                      }`}
                    >
                      <div className={styles.photoCompareLabelRow}>
                        <span className={styles.photoCompareLabel}>After</span>
                        {compareAfterPhoto && (
                          <span className={styles.photoCompareMeta}>
                            {compareAfterPhoto.appt_date ?? "Unknown date"}
                            {compareAfterPhoto.type
                              ? ` · ${compareAfterPhoto.type}`
                              : ""}
                          </span>
                        )}
                      </div>
                      {compareAfterPhoto ? (
                        <img
                          className={styles.photoCompareImage}
                          src={
                            compareAfterPhoto.file_url ??
                            `/api/photos/${compareAfterPhoto.id}/file`
                          }
                          alt="After comparison"
                        />
                      ) : (
                        <div className={styles.photoCompareEmpty}>
                          Select a photo for After.
                        </div>
                      )}
                      {compareAfterPhoto && (
                        <div className={styles.photoCompareComment}>
                          <div className={styles.photoCompareCommentHeader}>
                            <span className={styles.photoCompareCommentLabel}>
                              Comments
                            </span>
                            {!isAfterCommentEditing && (
                              <button
                                className={styles.buttonSecondary}
                                type="button"
                                onClick={() => handlePhotoCommentEdit("after")}
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          {!isAfterCommentEditing && (
                            <div className={styles.photoCompareCommentText}>
                              {compareAfterPhoto.description?.trim() ||
                                "No comments yet."}
                            </div>
                          )}
                          {isAfterCommentEditing && (
                            <>
                              <textarea
                                className={styles.textarea}
                                value={afterCommentDraft}
                                onChange={(event) =>
                                  setAfterCommentDraft(event.target.value)
                                }
                              />
                              <div className={styles.buttonRow}>
                                <button
                                  className={styles.button}
                                  type="button"
                                  onClick={() =>
                                    void handlePhotoCommentSave(
                                      compareAfterPhoto.id,
                                      afterCommentDraft,
                                      "after"
                                    )
                                  }
                                >
                                  Save Comment
                                </button>
                                <button
                                  className={styles.buttonSecondary}
                                  type="button"
                                  onClick={() => handlePhotoCommentCancel("after")}
                                >
                                  Cancel
                                </button>
                                <button
                                  className={`${styles.button} ${styles.buttonDanger} ${styles.buttonRowEnd}`}
                                  type="button"
                                  onClick={() => handlePhotoDelete(compareAfterPhoto)}
                                >
                                  Delete Photo
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {loadingPhotos && (
                  <p className={styles.notice}>Loading photos...</p>
                )}
                {!loadingPhotos && photos.length === 0 && (
                  <p className={styles.notice}>No photos yet.</p>
                )}

                {photos.length > 0 && (
                  <div className={styles.photosGrid}>
                    {photos.map((photo) => {
                      const isBefore = compareBeforeId === photo.id;
                      const isAfter = compareAfterId === photo.id;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          className={`${styles.photoCard} ${
                            selectedPhotoId === photo.id
                              ? styles.photoCardSelected
                              : ""
                          } ${isBefore ? styles.photoCardBefore : ""} ${
                            isAfter ? styles.photoCardAfter : ""
                          }`}
                          onClick={() => handlePhotoSelect(photo)}
                          onPointerDown={(event) =>
                            handlePhotoPointerDown(event, photo)
                          }
                        >
                          {(isBefore || isAfter) && (
                            <div className={styles.photoBadgeRow}>
                              {isBefore && (
                                <span
                                  className={`${styles.photoBadge} ${styles.photoBadgeBefore}`}
                                >
                                  Before
                                </span>
                              )}
                              {isAfter && (
                                <span
                                  className={`${styles.photoBadge} ${styles.photoBadgeAfter}`}
                                >
                                  After
                                </span>
                              )}
                            </div>
                          )}
                          <img
                            className={styles.photoThumb}
                            src={photo.file_url ?? `/api/photos/${photo.id}/file`}
                            alt={`Photo ${photo.id}`}
                            draggable={false}
                          />
                          <div className={styles.photoMeta}>
                            <div>{photo.appt_date ?? "Unknown date"}</div>
                            <div className={styles.photoMetaType}>
                              {photo.type ?? "Unknown type"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className={styles.photoUploadFooter}>
                  <button
                    className={styles.button}
                    type="button"
                    onClick={openPhotoUploadModal}
                    disabled={!selectedClientId}
                  >
                    Upload Photos
                  </button>
                </div>

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
                        onDoubleClick={() => setIsPrescriptionEditing(true)}
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
                          Open
                        </a>
                        <button
                          className={styles.buttonSecondary}
                          type="button"
                          onClick={() => setIsPrescriptionEditing(true)}
                        >
                          Edit
                        </button>
                        <button
                          className={`${styles.buttonSecondary} ${styles.buttonDanger} ${styles.buttonRowEnd}`}
                          type="button"
                          onClick={handlePrescriptionDelete}
                        >
                          Delete
                        </button>
                      </div>
                      <div className={styles.copyPanel}>
                        <span className={styles.label}>Copy To Client</span>
                      <div className={styles.copyRow}>
                          <div className={styles.copyColumn}>
                            <select
                              className={styles.select}
                              value={copyTargetClientId}
                              onChange={(event) =>
                                setCopyTargetClientId(event.target.value)
                              }
                            >
                              <option value="">Select client</option>
                              {clientOptions.map((client) => (
                                <option
                                  key={client.id}
                                  value={String(client.id)}
                                >
                                  {client.full_name}
                                </option>
                              ))}
                            </select>
                            <button
                              className={styles.buttonSecondary}
                              type="button"
                              onClick={handlePrescriptionCopy}
                            >
                              Copy
                            </button>
                          </div>
                          <input
                            className={styles.input}
                            placeholder="MM/DD/YYYY"
                            value={copyStartDate}
                            onChange={(event) => setCopyStartDate(event.target.value)}
                          />
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
                  {isPrescriptionEditing ? (
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
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={handlePrescriptionHighlight}
                      >
                        Highlight
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
                                onFocus={() =>
                                  setHighlightTarget({ colIndex, rowIndex })
                                }
                              />
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
                        <button
                          className={styles.buttonSecondary}
                          type="button"
                          onClick={handlePrescriptionCancel}
                        >
                          Cancel
                        </button>
                        {selectedPrescriptionId && (
                          <button
                            className={`${styles.button} ${styles.buttonDanger} ${styles.buttonRowEnd}`}
                            type="button"
                            onClick={handlePrescriptionDelete}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </form>
                  ) : prescriptionPreviewUrl ? (
                    <div className={styles.prescriptionPreview}>
                      <iframe
                        title="Prescription Preview"
                        src={prescriptionPreviewUrl}
                      />
                    </div>
                  ) : (
                    <p className={styles.notice}>
                      Select a prescription to preview.
                    </p>
                  )}
                </div>
              </div>
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

      {photoDragGhost && portalTarget
        ? createPortal(
            <div
              className={styles.photoDragGhost}
              style={{
                transform: `translate(${photoDragGhost.x}px, ${photoDragGhost.y}px)`
              }}
            >
              <div
                className={`${styles.photoCard} ${styles.photoDragGhostCard}`}
                style={{ width: `${photoDragGhost.width}px` }}
              >
                <img
                  className={styles.photoThumb}
                  src={
                    photoDragGhost.photo.file_url ??
                    `/api/photos/${photoDragGhost.photo.id}/file`
                  }
                  alt={`Dragging photo ${photoDragGhost.photo.id}`}
                  draggable={false}
                />
                <div className={styles.photoMeta}>
                  {photoDragGhost.photo.appt_date ?? "Unknown date"}
                </div>
              </div>
            </div>,
            portalTarget
          )
        : null}

      {status && <p className={styles.status}>{status}</p>}
      {error && <p className={styles.status}>Error: {error}</p>}
    </div>
  );
}
