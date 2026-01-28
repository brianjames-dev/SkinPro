"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./clients.module.css";
import { PRODUCT_CATALOG } from "@/lib/productCatalog";
import {
  formatCurrencyInput,
  formatDateInput,
  formatPhoneInput,
  getTodayDateString,
  normalizeDateInput
} from "@/lib/format";
import {
  parseCurrencyValue,
  parseDateParts,
  parseMmddyyyy,
  parseMonthDay
} from "@/lib/parse";
import useQueryTabSync from "@/lib/hooks/useQueryTabSync";
import { toggleHighlightInRaw } from "@/lib/highlightText";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import ButtonRow from "../ui/ButtonRow";
import SelectMenu from "../ui/SelectMenu";
import ConfirmDialog from "../ui/ConfirmDialog";
import Field from "../ui/Field";
import HighlightTextarea from "../ui/HighlightTextarea";
import CloseButton from "../ui/CloseButton";
import List from "../ui/List";
import ListRow from "../ui/ListRow";
import ListRowButton from "../ui/ListRowButton";
import LockableCheckbox from "../ui/LockableCheckbox";
import Modal from "../ui/Modal";
import Notice from "../ui/Notice";
import Receipt from "../ui/Receipt";
import SearchMenu from "../ui/SearchMenu";
import StatusMessage from "../ui/StatusMessage";
import UnsavedChangesPrompt from "../ui/UnsavedChangesPrompt";
import { useUnsavedChangesRegistry } from "../ui/UnsavedChangesContext";
import useUnsavedChangesGuard from "../ui/useUnsavedChangesGuard";
import TreeToggle from "../ui/TreeToggle";
import TogglePill from "../ui/TogglePill";
import Tabs from "../ui/Tabs";
import TreeList from "../ui/TreeList";
import useKeyboardListNavigation from "@/lib/hooks/useKeyboardListNavigation";

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

type ClientProduct = {
  id: number;
  client_id: number;
  date: string;
  product: string;
  size?: string | null;
  cost?: string | null;
  brand?: string | null;
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
  is_current?: number | null;
};

type ClientNote = {
  id: number;
  client_id: number;
  date_seen: string;
  notes: string;
  done_at?: string | null;
  created_at?: string | null;
};

type Alert = {
  id: number;
  client_id: number;
  full_name: string;
  primary_phone?: string | null;
  deadline: string;
  notes?: string | null;
};

type WorkspaceTab =
  | "appointments"
  | "products"
  | "photos"
  | "prescriptions"
  | "notes";
type OverviewTab = "info" | "health";
type OverviewMode = "compact" | "collapsed" | "edit";

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
  header2: string;
  rows: PrescriptionStep[];
};

type PrescriptionDraft = {
  start_date: string;
  columns: PrescriptionColumn[];
};

type UploadSuccessState = {
  kind: "photo" | "profile";
  count: number;
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

type ProductForm = {
  id?: number;
  date: string;
  product: string;
  size: string;
  cost: string;
  brand: string;
};

type ProductGroup = {
  id: string;
  date: string;
  items: ClientProduct[];
};

const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "appointments", label: "Appointments" },
  { id: "products", label: "Products" },
  { id: "photos", label: "Photos" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "notes", label: "Notes" }
];

const WORKSPACE_TAB_IDS = WORKSPACE_TABS.map((tab) => tab.id);

const OVERVIEW_TABS: { id: OverviewTab; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "info", label: "Info" }
];

const OVERVIEW_TAB_IDS = OVERVIEW_TABS.map((tab) => tab.id);

const UPLOAD_TABS = [
  { id: "qr", label: "QR" },
  { id: "local", label: "Local" }
] as const;

const NOTES_TOGGLE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "selected", label: "Selected" }
] as const;

const PHOTO_COMPARE_OPTIONS = [
  { id: "before", label: "Before" },
  { id: "after", label: "After" }
] as const;

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

const EMPTY_PRODUCT: ProductForm = {
  date: "",
  product: "",
  size: "",
  cost: "",
  brand: ""
};

const MAX_PRESCRIPTION_ROWS = 10;
const PRESCRIPTION_PRODUCT_MAX_LENGTH_BY_COLUMN: Record<number, number> = {
  2: 107,
  3: 69,
  4: 49
};
const getPrescriptionProductMaxLength = (columnCount: number) =>
  PRESCRIPTION_PRODUCT_MAX_LENGTH_BY_COLUMN[columnCount] ?? 49;
const getPrescriptionProductWrapThreshold = (columnCount: number) =>
  Math.ceil(getPrescriptionProductMaxLength(columnCount) / 2);
const PRESCRIPTION_HEADER_MAX_LENGTH = 18;
const PHOTO_PAGE_SIZE = 14;
const BIRTHDAY_WINDOW_BEFORE_DAYS = 14;
const BIRTHDAY_WINDOW_AFTER_DAYS = 7;
const CELEBRATION_DURATION_MS = 5600;
const CONFETTI_COUNT = 300;
const BALLOON_COUNT = 14;
const CONFETTI_COLORS = ["#f06b6b", "#ffd36b", "#7cc7ff", "#b8f28f", "#c78bff"];
const BALLOON_COLORS = ["#f7a2b6", "#f9d270", "#8fd2ff", "#b4ef9a", "#f2a2f5"];

  const stackLabel = (label: string) =>
    label
      .toUpperCase()
      .replace(/\s+/g, "")
      .split("")
      .join("\n");

  const stackStepLabel = (step: number) =>
    ["S", "T", "E", "P", "", ...String(step).split("")].join("\n");

const createPrescriptionDraft = (columnCount: number): PrescriptionDraft => {
  const columns: PrescriptionColumn[] = Array.from({ length: columnCount }, (_, index) => ({
    header: "",
    header2: "",
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
      header: existing?.header ?? "",
      header2: existing?.header2 ?? "",
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
    steps[`Col${index + 1}_Header`] = column.header.trim();
    steps[`Col${index + 1}_Header2`] = column.header2.trim();
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
    const header2Raw =
      typeof steps[`Col${i}_Header2`] === "string"
        ? (steps[`Col${i}_Header2`] as string)
        : "";
    const header = headerRaw.trim() || "";
    const rowsRaw = Array.isArray(steps[`Col${i}`])
      ? (steps[`Col${i}`] as { product?: string; product2?: string; directions?: string }[])
      : [];
    columns.push({
      header,
      header2: header2Raw.trim(),
      rows: rowsRaw.map((row) => ({
        product: row.product ?? row.product2 ?? "",
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

const APPOINTMENT_TYPES = ["Facial", "Electrolysis"] as const;
const APPOINTMENT_TREATMENTS: Record<string, string[]> = {
  Facial: ["Signature Facial", "Hydrating Facial", "Brightening Facial"],
  Electrolysis: ["15 min Electrolysis", "30 min Electrolysis", "60 min Electrolysis"]
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

const formatCompactValue = (value: string) => {
  const trimmed = value.trim();
  const stripped = trimmed
    .replace(/\[\[highlight\]\]|\[\[\/highlight\]\]/g, "")
    .trim();
  return stripped ? trimmed : "—";
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

const extractHighlightedSegments = (value: string) => {
  const tokens = value.split(/(\[\[highlight\]\]|\[\[\/highlight\]\])/);
  const results: string[] = [];
  let isHighlighted = false;
  tokens.forEach((token) => {
    if (token === "[[highlight]]") {
      isHighlighted = true;
      return;
    }
    if (token === "[[/highlight]]") {
      isHighlighted = false;
      return;
    }
    if (!isHighlighted) {
      return;
    }
    const cleaned = token.replace(/\s+/g, " ").trim();
    if (cleaned) {
      results.push(cleaned);
    }
  });
  return results;
};

const ExpandableValue = ({ value }: { value: string }) => {
  const displayValue = formatCompactValue(value);
  const nodes = renderHighlightedValue(displayValue);

  return (
    <div className={styles.expandableValue}>
      <div className={styles.expandableText}>{nodes}</div>
    </div>
  );
};

const UploadSuccessModal = ({
  portalTarget,
  open,
  title,
  message,
  onConfirm
}: {
  portalTarget: HTMLElement | null;
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}) => {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onConfirm}
      portalTarget={portalTarget}
    >
      <Notice>{message}</Notice>
      <ButtonRow>
        <Button type="button" onClick={onConfirm}>
          OK
        </Button>
      </ButtonRow>
    </Modal>
  );
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
  const initialNewClientRef = useRef<string | null>(null);
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
  >("all");
  const appointmentNotesBodyRef = useRef<HTMLDivElement | null>(null);
  const appointmentNoteItemRefs = useRef(new Map<number, HTMLDivElement | null>());
  const appointmentNotesScrollRef = useRef<number | null>(null);
  const appointmentNotesScrollStartRef = useRef<number | null>(null);
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductGroupDate, setSelectedProductGroupDate] = useState<string | null>(
    null
  );
  const [collapsedProductDates, setCollapsedProductDates] = useState<
    Record<string, boolean>
  >({});
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
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
  const [uploadSuccess, setUploadSuccess] = useState<UploadSuccessState | null>(
    null
  );
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoVisibleCount, setPhotoVisibleCount] = useState(PHOTO_PAGE_SIZE);
  const lastPhotosClientIdRef = useRef<number | null>(null);
  const [photoQrDataUrl, setPhotoQrDataUrl] = useState<string | null>(null);
  const [photoQrUrl, setPhotoQrUrl] = useState<string | null>(null);
  const [photoQrLoading, setPhotoQrLoading] = useState(false);
  const qrPhotoPollTimerRef = useRef<number | null>(null);
  const qrPhotoBaselineRef = useRef<number | null>(null);
  const qrPhotoLastCountRef = useRef<number | null>(null);
  const qrPhotoStableCountRef = useRef(0);
  const qrProfilePollTimerRef = useRef<number | null>(null);
  const qrProfileBaselineRef = useRef<number | null>(null);
  const qrProfileLastStampRef = useRef<number | null>(null);
  const qrProfileStableCountRef = useRef(0);
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
  const [isPrescriptionExitPromptOpen, setIsPrescriptionExitPromptOpen] =
    useState(false);
  const [highlightTarget, setHighlightTarget] = useState<{
    colIndex: number;
    rowIndex: number;
  } | null>(null);
  const prescriptionEditorRef = useRef<HTMLDivElement | null>(null);
  const [healthHighlightField, setHealthHighlightField] =
    useState<keyof HealthForm | null>(null);
  const copyPanelRef = useRef<HTMLDivElement | null>(null);
  const copyInputRef = useRef<HTMLInputElement | null>(null);
  const [isCopyPanelOpen, setIsCopyPanelOpen] = useState(false);
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
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [noteDraft, setNoteDraft] = useState({ date_seen: "", notes: "" });
  const [notesHighlightTarget, setNotesHighlightTarget] = useState<
    { kind: "draft" } | { kind: "note"; noteId: number } | null
  >(null);
  const noteEditSnapshotRef = useRef<Record<number, ClientNote>>({});
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<
    Record<number, boolean>
  >({});
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [copyTargetClientId, setCopyTargetClientId] = useState("");
  const [copyClientQuery, setCopyClientQuery] = useState("");
  const [copyStartDate, setCopyStartDate] = useState(getTodayDateString());
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const prescriptionEditSnapshotRef = useRef<string | null>(null);
  const pendingPrescriptionExitRef = useRef<null | (() => void)>(null);
  const [isPrescriptionShareOpen, setIsPrescriptionShareOpen] = useState(false);
  const [prescriptionShareQrDataUrl, setPrescriptionShareQrDataUrl] =
    useState<string | null>(null);
  const [prescriptionShareUrl, setPrescriptionShareUrl] = useState<string | null>(
    null
  );
  const [prescriptionShareLoading, setPrescriptionShareLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [referredByQuery, setReferredByQuery] = useState("");
  const [referredByValue, setReferredByValue] = useState("");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingClientDetails, setLoadingClientDetails] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    confirmDanger?: boolean;
  } | null>(null);
  const confirmActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const {
    value: overviewTab,
    onChange: handleOverviewTabChange,
    replaceValue: replaceOverviewTab
  } = useQueryTabSync<OverviewTab>({
    key: "overview",
    defaultValue: "health",
    values: OVERVIEW_TAB_IDS
  });
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("collapsed");
  const { value: activeTab, onChange: handleWorkspaceTabChange } =
    useQueryTabSync<WorkspaceTab>({
      key: "tab",
      defaultValue: "appointments",
      values: WORKSPACE_TAB_IDS
    });
  const primaryPhoneInputRef = useRef<HTMLInputElement | null>(null);
  const canSaveTemplate = isPrescriptionEditing || Boolean(selectedPrescriptionId);
  const hasSelectedTemplate = Boolean(selectedTemplateId);

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

  const photosByAppointment = useMemo(() => {
    const map = new Set<number>();
    for (const photo of photos) {
      if (Number.isFinite(photo.appointment_id)) {
        map.add(photo.appointment_id);
      }
    }
    return map;
  }, [photos]);

  const appointmentsWithPhotoStatus = useMemo(() => {
    return appointments.map((appointment) => {
      const hasPhotos = photosByAppointment.has(appointment.id);
      const nextStatus = hasPhotos ? "Yes" : "No";
      if ((appointment.photos_taken ?? "No") === nextStatus) {
        return appointment;
      }
      return { ...appointment, photos_taken: nextStatus };
    });
  }, [appointments, photosByAppointment]);

  const sortedAppointments = useMemo(() => {
    return [...appointmentsWithPhotoStatus].sort((a, b) => {
      return parseMmddyyyy(b.date) - parseMmddyyyy(a.date);
    });
  }, [appointmentsWithPhotoStatus]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      return parseMmddyyyy(b.date) - parseMmddyyyy(a.date);
    });
  }, [products]);

  const productGroups = useMemo<ProductGroup[]>(() => {
    const groups: ProductGroup[] = [];
    const indexByDate = new Map<string, number>();

    for (const entry of sortedProducts) {
      const dateKey = entry.date?.trim() || "No date";
      const existingIndex = indexByDate.get(dateKey);
      if (existingIndex === undefined) {
        indexByDate.set(dateKey, groups.length);
        groups.push({ id: dateKey, date: dateKey, items: [entry] });
      } else {
        groups[existingIndex]?.items.push(entry);
      }
    }

    return groups;
  }, [sortedProducts]);

  const selectedProductGroup = useMemo(() => {
    if (!selectedProductGroupDate) {
      return null;
    }
    return (
      productGroups.find((group) => group.date === selectedProductGroupDate) ??
      null
    );
  }, [productGroups, selectedProductGroupDate]);

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

  const selectedProductEntry = useMemo(() => {
    if (!selectedProductId) {
      return null;
    }
    return sortedProducts.find((entry) => entry.id === selectedProductId) ?? null;
  }, [sortedProducts, selectedProductId]);

  const selectedProductReceipt = useMemo(() => {
    if (selectedProductEntry) {
      const brandKey = selectedProductEntry.brand?.trim() || "Unbranded";
      return {
        date: selectedProductEntry.date ?? "No date",
        brands: [
          {
            brand: brandKey,
            items: [selectedProductEntry]
          }
        ],
        total: parseCurrencyValue(selectedProductEntry.cost)
      };
    }

    if (!selectedProductGroup) {
      return null;
    }
    const brandMap = new Map<string, ClientProduct[]>();
    let total = 0;

    for (const entry of selectedProductGroup.items) {
      const brandKey = entry.brand?.trim() || "Unbranded";
      total += parseCurrencyValue(entry.cost);
      if (!brandMap.has(brandKey)) {
        brandMap.set(brandKey, []);
      }
      brandMap.get(brandKey)?.push(entry);
    }

    const brands = Array.from(brandMap.entries()).map(([brand, items]) => ({
      brand,
      items
    }));

    return {
      date: selectedProductGroup.date,
      brands,
      total
    };
  }, [selectedProductEntry, selectedProductGroup]);

  const appointmentsWithNotes = useMemo(() => {
    return sortedAppointments.filter(
      (appointment) => (appointment.treatment_notes ?? "").trim()
    );
  }, [sortedAppointments]);

  const isBirthdayWindow = useMemo(
    () => isWithinBirthdayWindow(clientForm.birthdate),
    [clientForm.birthdate]
  );

  const uploadSuccessMessage = useMemo(() => {
    if (!uploadSuccess) {
      return "";
    }
    if (uploadSuccess.kind === "profile") {
      return "Profile picture uploaded successfully.";
    }
    return `${uploadSuccess.count} photo(s) uploaded successfully.`;
  }, [uploadSuccess]);

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

  const visiblePhotos = useMemo(() => {
    return photos.slice(0, photoVisibleCount);
  }, [photos, photoVisibleCount]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const {
    activeIndex: searchActiveIndex,
    setActiveIndex: setSearchActiveIndex,
    onKeyDown: handleSearchKeyDown
  } = useKeyboardListNavigation<Client>({
    items: filteredClients,
    isOpen: hasSearchQuery,
    onSelect: (client) => {
      void handleSelectClientFromSearch(client.id);
    }
  });

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
  const hasReferredByQuery = referredByQuery.trim() !== "";
  const {
    activeIndex: referredByActiveIndex,
    setActiveIndex: setReferredByActiveIndex,
    onKeyDown: handleReferredByKeyDown
  } = useKeyboardListNavigation<Client>({
    items: referredByMatches,
    isOpen: hasReferredByQuery && referredByMatches.length > 0,
    onSelect: handleReferredBySelect
  });

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
  const collapsedHighlightNodes = useMemo(() => {
    const sections = [
      healthForm.allergies,
      healthForm.health_conditions,
      healthForm.health_risks,
      healthForm.medications,
      healthForm.treatment_areas,
      healthForm.current_products,
      healthForm.skin_conditions,
      healthForm.other_notes,
      healthForm.desired_improvement
    ];
    const nodes: React.ReactNode[] = [];
    let sectionIndex = 0;
    sections.forEach((value) => {
      const items = extractHighlightedSegments(value);
      if (!items.length) {
        return;
      }
      if (sectionIndex > 0) {
        nodes.push(" | ");
      }
      items.forEach((item, itemIndex) => {
        if (itemIndex > 0) {
          nodes.push(", ");
        }
        nodes.push(
          <span className={styles.highlightText} key={`${sectionIndex}-${itemIndex}`}>
            {item}
          </span>
        );
      });
      sectionIndex += 1;
    });
    return nodes;
  }, [
    healthForm.allergies,
    healthForm.health_conditions,
    healthForm.health_risks,
    healthForm.medications,
    healthForm.treatment_areas,
    healthForm.current_products,
    healthForm.skin_conditions,
    healthForm.other_notes,
    healthForm.desired_improvement
  ]);

  const selectedCopyClient = useMemo(() => {
    if (!copyTargetClientId) {
      return null;
    }
    return (
      clientOptions.find(
        (client) => String(client.id) === copyTargetClientId
      ) ?? null
    );
  }, [clientOptions, copyTargetClientId]);

  const copyClientMatches = useMemo(() => {
    const normalizedQuery = copyClientQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }
    return clientOptions
      .filter((client) =>
        client.full_name.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 3);
  }, [clientOptions, copyClientQuery]);

  const hasCopyClientQuery = copyClientQuery.trim() !== "";
  const {
    activeIndex: copyClientActiveIndex,
    setActiveIndex: setCopyClientActiveIndex,
    onKeyDown: handleCopyClientKeyDown
  } = useKeyboardListNavigation<Client>({
    items: copyClientMatches,
    isOpen: hasCopyClientQuery && copyClientMatches.length > 0,
    onSelect: handleCopyClientSelect
  });

  const referralStats = useMemo(() => {
    if (!selectedClientId) {
      return { count: 0, names: [] as string[] };
    }
    const selected = allClients.find((client) => client.id === selectedClientId);
    if (!selected) {
      return { count: 0, names: [] as string[] };
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

    const names = matches
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((client) => client.full_name);

    return { count: matches.length, names };
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
  const serializePrescriptionDraft = useCallback(
    (draft: PrescriptionDraft, columnCount: number) =>
      JSON.stringify({
        columnCount,
        draft: normalizePrescriptionDraft(draft, columnCount)
      }),
    []
  );

  const isPrescriptionDirty = useCallback(() => {
    if (!isPrescriptionEditing || !prescriptionEditSnapshotRef.current) {
      return false;
    }
    return (
      prescriptionEditSnapshotRef.current !==
      serializePrescriptionDraft(prescriptionDraft, prescriptionColumnCount)
    );
  }, [
    isPrescriptionEditing,
    prescriptionDraft,
    prescriptionColumnCount,
    serializePrescriptionDraft
  ]);
  const isCurrentPrescription = Boolean(selectedPrescription?.is_current);
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const aDone = a.done_at ? 1 : 0;
      const bDone = b.done_at ? 1 : 0;
      if (aDone !== bDone) {
        return aDone - bDone;
      }
      const dateDiff =
        parseMmddyyyy(b.date_seen ?? "") - parseMmddyyyy(a.date_seen ?? "");
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, [notes]);

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
    const newClientFlag = searchParams.get("newClient");
    if (!newClientFlag) {
      initialNewClientRef.current = null;
      return;
    }
    const rawName = searchParams.get("newClientName") ?? "";
    const trimmedName = rawName.trim();
    const key = `${newClientFlag}:${trimmedName}`;
    if (initialNewClientRef.current === key) {
      return;
    }
    initialNewClientRef.current = key;

    handleNewClient(trimmedName);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("newClient");
    params.delete("newClientName");
    params.set("overview", "info");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl);
  }, [pathname, router, searchParams]);

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
    setAppointmentNotesMode("all");
    setIsProductFormOpen(false);
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClientId || overviewMode !== "compact") {
      return;
    }
    setReferredByQuery(resolveReferredByName(referredBySelected, allClients));
  }, [selectedClientId, overviewMode, referredBySelected, allClients]);

  useEffect(() => {
    if (overviewMode !== "edit" || overviewTab !== "info") {
      return;
    }
    const focusTimer = window.requestAnimationFrame(() => {
      primaryPhoneInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusTimer);
  }, [overviewMode, overviewTab]);

  useEffect(() => {
    if (overviewMode === "edit") {
      setReferredByQuery("");
    }
  }, [overviewMode, selectedClientId]);

  useEffect(() => {
    if (!appointmentForm.id) {
      return;
    }
    const nextStatus = photosByAppointment.has(appointmentForm.id) ? "Yes" : "No";
    setAppointmentForm((prev) => {
      if (prev.photos_taken === nextStatus) {
        return prev;
      }
      return { ...prev, photos_taken: nextStatus };
    });
  }, [appointmentForm.id, photosByAppointment]);

  const setNotice = (message: string | null, isError = false) => {
    if (isError) {
      setError(message);
      setStatus(null);
    } else {
      setStatus(message);
      setError(null);
    }
  };

  const openConfirmDialog = useCallback(
    (options: {
      title: string;
      message: string;
      confirmLabel?: string;
      confirmDanger?: boolean;
      onConfirm: () => void | Promise<void>;
    }) => {
      confirmActionRef.current = options.onConfirm;
      setConfirmDialog({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel,
        confirmDanger: options.confirmDanger
      });
    },
    []
  );

  const handleConfirmDialogCancel = () => {
    setConfirmDialog(null);
    confirmActionRef.current = null;
  };

  const handleConfirmDialogConfirm = async () => {
    const action = confirmActionRef.current;
    handleConfirmDialogCancel();
    if (action) {
      await action();
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

  const loadProducts = async (clientId: number) => {
    setLoadingProducts(true);
    try {
      const response = await fetch(`/api/products?client_id=${clientId}`);
      const data = (await response.json()) as {
        products?: ClientProduct[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load products");
      }

      const rows = data.products ?? [];
      setProducts(rows);
      setSelectedProductId(null);
      setSelectedProductGroupDate(null);
      setCollapsedProductDates({});
      setProductForm(EMPTY_PRODUCT);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to load products",
        true
      );
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadPhotos = async (clientId: number) => {
    setLoadingPhotos(true);
    try {
      const isNewClient = lastPhotosClientIdRef.current !== clientId;
      lastPhotosClientIdRef.current = clientId;
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
      setPhotoVisibleCount((prev) => {
        if (isNewClient) {
          return Math.min(PHOTO_PAGE_SIZE, nextPhotos.length);
        }
        const nextBase = Math.max(prev, PHOTO_PAGE_SIZE);
        return Math.min(nextBase, nextPhotos.length || PHOTO_PAGE_SIZE);
      });

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

  const loadPrescriptions = async (
    clientId: number,
    options?: { selectId?: number | null }
  ) => {
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

      const nextPrescriptions = data.prescriptions ?? [];
      setPrescriptions(nextPrescriptions);

      const requestedId = options?.selectId ?? null;
      const requestedExists =
        requestedId != null &&
        nextPrescriptions.some((prescription) => prescription.id === requestedId);
      const currentPrescription = nextPrescriptions.find(
        (prescription) => prescription.is_current
      );
      const nextSelectedId = requestedExists
        ? requestedId
        : currentPrescription?.id ?? null;
      const shouldHydrateCurrent =
        !requestedExists && currentPrescription?.id != null && !isPrescriptionEditing;

      if (nextSelectedId != null) {
        setSelectedPrescriptionId(nextSelectedId);
        setPrescriptionPreviewUrl(
          `/api/prescriptions/${nextSelectedId}/file?ts=${Date.now()}`
        );
      } else {
        setSelectedPrescriptionId(null);
        setPrescriptionPreviewUrl(null);
      }

      if (shouldHydrateCurrent && currentPrescription) {
        void handlePrescriptionSelect(currentPrescription, true, true);
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to load prescriptions",
        true
      );
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const loadNotes = async (clientId: number) => {
    setLoadingNotes(true);
    try {
      const response = await fetch(`/api/notes?client_id=${clientId}`);
      const data = (await response.json()) as {
        notes?: ClientNote[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load notes");
      }

      setNotes(data.notes ?? []);
      setNoteDraft({ date_seen: "", notes: "" });
      setIsNoteFormOpen(false);
      setEditingNoteId(null);
      noteEditSnapshotRef.current = {};
      setUnlockedNoteIds({});
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to load notes", true);
    } finally {
      setLoadingNotes(false);
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

  const handleSelectClient = async (clientId: number, skipPrompt = false) => {
    if (!skipPrompt && isPrescriptionEditing && isPrescriptionDirty()) {
      requestPrescriptionExit(() => handleSelectClient(clientId, true));
      return;
    }
    if (isPrescriptionEditing && !isPrescriptionDirty()) {
      setIsPrescriptionEditing(false);
      prescriptionEditSnapshotRef.current = null;
      setSelectedPrescriptionId(null);
      setPrescriptionPreviewUrl(null);
    }
    selectedClientIdRef.current = clientId;
    clientFormMutationIdRef.current = 0;
    setSelectedClientId(clientId);
    setOverviewMode("collapsed");
    syncClientRoute(clientId);
    setNotice(null);
    setCopyTargetClientId("");
    setCopyClientQuery("");
    setCopyStartDate(getTodayDateString());
    setAlertDeadline("");
    setAlertNotes("");
    handleAlertEditCancel();
    await loadClientDetails(clientId);
    await loadAppointments(clientId);
    await loadProducts(clientId);
    await loadPhotos(clientId);
    await loadPrescriptions(clientId);
    await loadNotes(clientId);
  };

  const handleNewClient = (initialName = "") => {
    selectedClientIdRef.current = null;
    clientFormMutationIdRef.current = 0;
    clientDetailsAbortRef.current?.abort();
    clientDetailsRequestIdRef.current += 1;
    setLoadingClientDetails(false);
    setSelectedClientId(null);
    setOverviewMode("collapsed");
    syncClientRoute(null);
    replaceOverviewTab("info");
    const nextClientForm = initialName
      ? { ...EMPTY_CLIENT, full_name: initialName }
      : EMPTY_CLIENT;
    setClientForm(nextClientForm);
    setReferredByQuery("");
    setReferredByValue("");
    setHealthForm(EMPTY_HEALTH);
    lastSavedClientFormRef.current = nextClientForm;
    lastSavedHealthFormRef.current = EMPTY_HEALTH;
    lastSavedReferredByValueRef.current = "";
    setAppointments([]);
    setAppointmentForm(EMPTY_APPOINTMENT);
    setSelectedAppointmentId(null);
    setProducts([]);
    setProductForm(EMPTY_PRODUCT);
    setSelectedProductId(null);
    setSelectedProductGroupDate(null);
    setCollapsedProductDates({});
    setIsProductFormOpen(false);
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
    setNotes([]);
    setNoteDraft({ date_seen: "", notes: "" });
    setIsNoteFormOpen(false);
    setEditingNoteId(null);
    setUnlockedNoteIds({});
    setCopyTargetClientId("");
    setCopyClientQuery("");
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
    enterOverviewEdit();
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

  const handleClientSelectChange = (field: keyof ClientForm, value: string) => {
    clientFormMutationIdRef.current += 1;
    setClientForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleReferredByChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setReferredByQuery(value);
    setReferredByActiveIndex(-1);
  };

  function handleReferredBySelect(client: Client) {
    const nextValue = `${REFERRED_BY_PREFIX}${client.id}`;
    clientFormMutationIdRef.current += 1;
    setClientForm((prev) => ({
      ...prev,
      referred_by: nextValue
    }));
    setReferredByValue(nextValue);
    setReferredByQuery("");
    setReferredByActiveIndex(-1);
  }

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
    setReferredByActiveIndex(-1);
  };

  const handleReferredByClear = () => {
    clientFormMutationIdRef.current += 1;
    setClientForm((prev) => ({
      ...prev,
      referred_by: ""
    }));
    setReferredByValue("");
    setReferredByQuery("");
    setReferredByActiveIndex(-1);
  };

  const handleCopyClientChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    const normalizedValue = value.trim().toLowerCase();
    const selectedName = selectedCopyClient?.full_name ?? "";
    const normalizedSelected = selectedName.trim().toLowerCase();
    if (copyTargetClientId && normalizedSelected !== normalizedValue) {
      setCopyTargetClientId("");
    }
    setCopyClientQuery(value);
    setCopyClientActiveIndex(-1);
  };

  function handleCopyClientSelect(client: Client) {
    setCopyTargetClientId(String(client.id));
    setCopyClientQuery("");
    setCopyClientActiveIndex(-1);
  }

  const handleCopyClientClear = () => {
    setCopyTargetClientId("");
    setCopyClientQuery("");
    setCopyClientActiveIndex(-1);
  };

  useEffect(() => {
    if (!isCopyPanelOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      copyInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isCopyPanelOpen]);

  useEffect(() => {
    if (!selectedPrescriptionId) {
      setIsCopyPanelOpen(false);
    }
  }, [selectedPrescriptionId]);

  const handleCopyPanelBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (copyPanelRef.current?.contains(active)) {
        return;
      }
      if (!copyClientQuery.trim() && !selectedCopyClient) {
        setIsCopyPanelOpen(false);
      }
    }, 0);
  };

  const handleOverviewEditCancel = () => {
    if (!selectedClientId) {
      setClientForm({ ...EMPTY_CLIENT });
      setHealthForm({ ...EMPTY_HEALTH });
      setReferredByValue("");
      setReferredByQuery("");
      lastSavedClientFormRef.current = EMPTY_CLIENT;
      lastSavedHealthFormRef.current = EMPTY_HEALTH;
      lastSavedReferredByValueRef.current = "";
      setOverviewMode("compact");
      return;
    }
    const savedClient = lastSavedClientFormRef.current;
    const savedHealth = lastSavedHealthFormRef.current;
    const savedReferred = lastSavedReferredByValueRef.current;
    setClientForm({ ...savedClient });
    setHealthForm({ ...savedHealth });
    setReferredByValue(savedReferred);
    setReferredByQuery(resolveReferredByName(savedReferred, allClients));
    setOverviewMode("compact");
  };


  const handleHealthFieldChange = (field: keyof HealthForm, value: string) => {
    setHealthForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHealthHighlight = () => {
    if (!healthHighlightField) {
      setNotice("Select text to highlight.", true);
      return;
    }
    const textarea = document.getElementById(
      `health-${healthHighlightField}`
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
    const raw = healthForm[healthHighlightField] ?? "";
      const nextRaw = toggleHighlightInRaw(raw, start, end);
      if (nextRaw === raw) {
        return;
      }
      handleHealthFieldChange(healthHighlightField, nextRaw);
      setTimeout(() => {
        textarea.focus();
      }, 0);
    };


  const handleAppointmentChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    const field = name as keyof AppointmentForm;
    let nextValue = value;
    if (field === "date") {
      nextValue = formatDateInput(value);
    }
    if (field === "price") {
      nextValue = formatCurrencyInput(value);
    }
    setAppointmentForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleAppointmentTypeChange = (value: string) => {
    setAppointmentForm((prev) => {
      const next = { ...prev, type: value };
      const options = APPOINTMENT_TREATMENTS[value] ?? [];
      if (next.treatment && !options.includes(next.treatment)) {
        next.treatment = "";
      }
      return next;
    });
  };

  const handleAppointmentTreatmentChange = (value: string) => {
    setAppointmentForm((prev) => ({ ...prev, treatment: value }));
  };

  const saveClientInfo = async () => {
    setNotice(null);

    if (!clientForm.full_name.trim()) {
      setNotice("Client name is required.", true);
      return false;
    }
    if (!selectedClientId && !clientForm.primary_phone.trim()) {
      setNotice("Primary phone is required for new clients.", true);
      return false;
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
          return true;
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
        return true;
      }
      return false;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Save failed", true);
      return false;
    }
  };

  const handleClientSave = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveClientInfo();
  };

  const handleClientDelete = async () => {
    if (!selectedClientId) {
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

  const saveHealthInfo = async () => {
    if (!selectedClientId) {
      setNotice("Select a client before saving health info.", true);
      return false;
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
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save health info",
        true
      );
      return false;
    }
  };

  const handleHealthSave = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveHealthInfo();
  };

  const overviewGuard = useUnsavedChangesGuard({
    isEnabled: overviewMode === "edit",
    getSnapshot: () =>
      JSON.stringify({
        overviewTab,
        clientForm,
        healthForm,
        referredByValue
      }),
    onSave: async () =>
      overviewTab === "health" ? saveHealthInfo() : saveClientInfo(),
    onDiscard: handleOverviewEditCancel
  });

  const appointmentGuard = useUnsavedChangesGuard({
    isEnabled: isAppointmentFormOpen,
    getSnapshot: () =>
      JSON.stringify({
        selectedAppointmentId,
        appointmentForm
      }),
    onSave: saveAppointment,
    onDiscard: handleAppointmentFormClose
  });

  const productGuard = useUnsavedChangesGuard({
    isEnabled: isProductFormOpen,
    getSnapshot: () =>
      JSON.stringify({
        selectedProductId,
        productForm
      }),
    onSave: saveProduct,
    onDiscard: handleProductFormClose
  });

  const notesGuard = useUnsavedChangesGuard({
    isEnabled: isNoteFormOpen || editingNoteId !== null,
    getSnapshot: () =>
      JSON.stringify({
        mode: isNoteFormOpen ? "create" : editingNoteId ? "edit" : "idle",
        noteDraft,
        editingNoteId,
        editingNote:
          editingNoteId !== null
            ? notes.find((note) => note.id === editingNoteId) ?? null
            : null
      }),
    onSave: async () => {
      if (isNoteFormOpen) {
        return saveNoteCreate();
      }
      if (editingNoteId !== null) {
        const note = notes.find((item) => item.id === editingNoteId);
        if (!note) {
          return false;
        }
        return saveNoteEdit(note);
      }
      return true;
    },
    onDiscard: () => {
      if (isNoteFormOpen) {
        handleNoteFormCancel();
      }
      if (editingNoteId !== null) {
        handleNoteEditCancel(editingNoteId);
      }
    }
  });

  const enterOverviewEdit = () => {
    setOverviewMode("edit");
    window.setTimeout(() => overviewGuard.markSnapshot(), 0);
  };

  const toggleOverviewCollapsed = () => {
    if (overviewMode === "edit") {
      return;
    }
    setOverviewMode((prev) => (prev === "collapsed" ? "compact" : "collapsed"));
  };

  useEffect(() => {
    if (isAppointmentFormOpen) {
      appointmentGuard.markSnapshot();
    }
  }, [isAppointmentFormOpen, selectedAppointmentId]);

  useEffect(() => {
    if (!isAppointmentFormOpen) {
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
  }, [isAppointmentFormOpen]);

  useEffect(() => {
    if (isProductFormOpen) {
      productGuard.markSnapshot();
    }
  }, [isProductFormOpen, selectedProductId]);

  useEffect(() => {
    if (!isProductFormOpen) {
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
  }, [isProductFormOpen]);

  useEffect(() => {
    if (isNoteFormOpen || editingNoteId !== null) {
      notesGuard.markSnapshot();
    }
  }, [isNoteFormOpen, editingNoteId]);

  const handleOverviewTabSelect = (tab: OverviewTab) => {
    if (overviewMode === "edit") {
      if (overviewGuard.isDirty()) {
        overviewGuard.requestExit(() => handleOverviewTabChange(tab));
        return;
      }
      handleOverviewEditCancel();
    }
    handleOverviewTabChange(tab);
  };

  const cancelPrescriptionEdit = () => {
    if (selectedPrescriptionId) {
      const selected = prescriptions.find(
        (prescription) => prescription.id === selectedPrescriptionId
      );
      if (selected) {
        void handlePrescriptionSelect(selected, true, true);
        prescriptionEditSnapshotRef.current = null;
        return;
      }
    }
    setIsPrescriptionEditing(false);
    prescriptionEditSnapshotRef.current = null;
  };

  const requestPrescriptionExit = useCallback(
    (action: () => void) => {
      if (!isPrescriptionEditing || !isPrescriptionDirty()) {
        action();
        return;
      }
      pendingPrescriptionExitRef.current = action;
      setIsPrescriptionExitPromptOpen(true);
    },
    [isPrescriptionEditing, isPrescriptionDirty]
  );

  const isClientsDirty = useCallback(() => {
    if (overviewMode === "edit" && overviewGuard.isDirty()) {
      return true;
    }
    if (isPrescriptionEditing && isPrescriptionDirty()) {
      return true;
    }
    if (isAppointmentFormOpen && appointmentGuard.isDirty()) {
      return true;
    }
    if (isProductFormOpen && productGuard.isDirty()) {
      return true;
    }
    if (
      (isNoteFormOpen || editingNoteId !== null) &&
      notesGuard.isDirty()
    ) {
      return true;
    }
    return false;
  }, [
    overviewMode,
    overviewGuard,
    isPrescriptionEditing,
    isPrescriptionDirty,
    isAppointmentFormOpen,
    appointmentGuard,
    isProductFormOpen,
    productGuard,
    isNoteFormOpen,
    editingNoteId,
    notesGuard
  ]);

  const requestClientsExit = useCallback(
    (action: () => void) => {
      if (overviewMode === "edit" && overviewGuard.isDirty()) {
        overviewGuard.requestExit(action);
        return;
      }
      if (isPrescriptionEditing && isPrescriptionDirty()) {
        requestPrescriptionExit(action);
        return;
      }
      if (isAppointmentFormOpen && appointmentGuard.isDirty()) {
        appointmentGuard.requestExit(action);
        return;
      }
      if (isProductFormOpen && productGuard.isDirty()) {
        productGuard.requestExit(action);
        return;
      }
      if (
        (isNoteFormOpen || editingNoteId !== null) &&
        notesGuard.isDirty()
      ) {
        notesGuard.requestExit(action);
        return;
      }
      action();
    },
    [
      overviewMode,
      overviewGuard,
      isPrescriptionEditing,
      isPrescriptionDirty,
      requestPrescriptionExit,
      isAppointmentFormOpen,
      appointmentGuard,
      isProductFormOpen,
      productGuard,
      isNoteFormOpen,
      editingNoteId,
      notesGuard
    ]
  );

  useUnsavedChangesRegistry("clients", {
    isDirty: isClientsDirty,
    requestExit: requestClientsExit
  });

  const runWorkspaceTabChange = (tab: WorkspaceTab) => {
    if (tab !== activeTab) {
      if (isAppointmentFormOpen) {
        handleAppointmentFormClose();
      }
      if (isProductFormOpen) {
        handleProductFormClose();
      }
      if (isPhotoUploadOpen) {
        closePhotoUploadModal();
      }
      if (isPrescriptionEditing) {
        cancelPrescriptionEdit();
      }
      if (isPrescriptionShareOpen) {
        closePrescriptionShareModal();
      }
      if (isNoteFormOpen) {
        handleNoteFormCancel();
      }
      if (editingNoteId !== null) {
        handleNoteEditCancel(editingNoteId);
      }
    }
    handleWorkspaceTabChange(tab);
  };

  const handleWorkspaceTabSelect = (tab: WorkspaceTab) => {
    if (tab !== activeTab) {
      if (overviewMode === "edit" && overviewGuard.isDirty()) {
        overviewGuard.requestExit(() => runWorkspaceTabChange(tab));
        return;
      }
      if (isPrescriptionEditing && isPrescriptionDirty()) {
        requestPrescriptionExit(() => runWorkspaceTabChange(tab));
        return;
      }
      if (isAppointmentFormOpen && appointmentGuard.isDirty()) {
        appointmentGuard.requestExit(() => runWorkspaceTabChange(tab));
        return;
      }
      if (isProductFormOpen && productGuard.isDirty()) {
        productGuard.requestExit(() => runWorkspaceTabChange(tab));
        return;
      }
      if (
        (isNoteFormOpen || editingNoteId !== null) &&
        notesGuard.isDirty()
      ) {
        notesGuard.requestExit(() => runWorkspaceTabChange(tab));
        return;
      }
    }
    runWorkspaceTabChange(tab);
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
      setUploadSuccess({ kind: "profile", count: 1 });
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
    setProfileQrDataUrl(null);
    setProfileQrUrl(null);
    if (!profileQrLoading) {
      void handleProfileQrGenerate();
    }
  };

  const closeProfileUploadModal = () => {
    clearQrProfilePolling();
    setIsProfileUploadOpen(false);
  };

  const openPhotoUploadModal = () => {
    setPhotoUploadMode("qr");
    setIsPhotoUploadOpen(true);
    setPhotoQrDataUrl(null);
    setPhotoQrUrl(null);
    if (photoUploadAppointmentId && !photoQrLoading) {
      void handlePhotoQrGenerate();
    }
  };

  const closePhotoUploadModal = () => {
    clearQrPhotoPolling();
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
      const data = (await response.json()) as { error?: string; uploaded?: number };

      if (!response.ok) {
        throw new Error(data.error ?? "Photo upload failed");
      }

      const uploadedCount = data.uploaded ?? photoUploadFiles.length;
      setPhotoUploadFiles(null);
      setPhotoUploadKey((prev) => prev + 1);
      setUploadSuccess({ kind: "photo", count: uploadedCount });
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
    field: "header" | "header2",
    value: string
  ) => {
    const nextValue = value.slice(0, PRESCRIPTION_HEADER_MAX_LENGTH);
    setPrescriptionDraft((prev) => {
      const next = normalizePrescriptionDraft(prev, prescriptionColumnCount);
      const columns = next.columns.map((column, colIndex) =>
        colIndex === index ? { ...column, [field]: nextValue } : column
      );
      return { ...next, columns };
    });
  };

  const handlePrescriptionRowChange = (
    colIndex: number,
    rowIndex: number,
    field: "product",
    value: string
  ) => {
    const maxLength = getPrescriptionProductMaxLength(prescriptionColumnCount);
    const nextValue = value.slice(0, maxLength);
    setPrescriptionDraft((prev) => {
      const next = normalizePrescriptionDraft(prev, prescriptionColumnCount);
      const columns = next.columns.map((column, columnIndex) => {
        if (columnIndex !== colIndex) {
          return column;
        }
        const rows = column.rows.map((row, index) =>
          index === rowIndex ? { ...row, [field]: nextValue } : row
        );
        return { ...column, rows };
      });
      return { ...next, columns };
    });
  };

  const handlePrescriptionDirectionsChange = (
    colIndex: number,
    rowIndex: number,
    value: string
  ) => {
    setPrescriptionDraft((prev) => {
      const next = normalizePrescriptionDraft(prev, prescriptionColumnCount);
      const columns = next.columns.map((column, columnIndex) => {
        if (columnIndex !== colIndex) {
          return column;
        }
        const rows = column.rows.map((row, index) =>
          index === rowIndex ? { ...row, directions: value } : row
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

  const handlePrescriptionOpenFile = (prescription: Prescription) => {
    window.open(
      `/api/prescriptions/${prescription.id}/file`,
      "_blank",
      "noopener,noreferrer"
    );
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
    const raw =
      prescriptionDraft.columns[colIndex]?.rows[rowIndex]?.directions ?? "";
      const nextRaw = toggleHighlightInRaw(raw, start, end);
      if (nextRaw === raw) {
        return;
      }
      handlePrescriptionDirectionsChange(colIndex, rowIndex, nextRaw);
      setTimeout(() => {
        textarea.focus();
      }, 0);
    };


  const syncPrescriptionDirectionHeights = useCallback(() => {
    const root = prescriptionEditorRef.current;
    if (!root) {
      return;
    }
    const productAreas = Array.from(
      root.querySelectorAll<HTMLTextAreaElement>("[data-prescription-row='product']")
    );
    const directionAreas = Array.from(
      root.querySelectorAll<HTMLTextAreaElement>("[data-prescription-row='direction']")
    );
    const rows = new Map<
      string,
      Map<string, { product?: HTMLTextAreaElement; direction?: HTMLTextAreaElement }>
    >();

    const registerArea = (
      area: HTMLTextAreaElement,
      kind: "product" | "direction"
    ) => {
      const rowIndex = area.dataset.rowIndex ?? "0";
      const colIndex = area.dataset.colIndex ?? "0";
      if (!rows.has(rowIndex)) {
        rows.set(rowIndex, new Map());
      }
      const cols = rows.get(rowIndex);
      if (!cols) {
        return;
      }
      if (!cols.has(colIndex)) {
        cols.set(colIndex, {});
      }
      const entry = cols.get(colIndex);
      if (!entry) {
        return;
      }
      entry[kind] = area;
    };

    productAreas.forEach((area) => registerArea(area, "product"));
    directionAreas.forEach((area) => registerArea(area, "direction"));

    rows.forEach((cols) => {
      let maxTotal = 0;
      const heights = new Map<
        string,
        { productHeight: number; directionHeight: number }
      >();

      cols.forEach((areas, colIndex) => {
        const product = areas.product;
        const direction = areas.direction;
        let productHeight = 0;
        let directionHeight = 0;
        if (product) {
          product.style.height = "auto";
          product.style.overflowY = "hidden";
          productHeight = product.scrollHeight;
        }
        if (direction) {
          direction.style.height = "auto";
          direction.style.overflowY = "hidden";
          directionHeight = direction.scrollHeight;
        }
        heights.set(colIndex, { productHeight, directionHeight });
        maxTotal = Math.max(maxTotal, productHeight + directionHeight);
      });

      cols.forEach((areas, colIndex) => {
        const entry = heights.get(colIndex);
        if (!entry) {
          return;
        }
        const { productHeight, directionHeight } = entry;
        if (areas.product) {
          areas.product.style.height = `${productHeight}px`;
        }
        if (areas.direction) {
          const target = Math.max(directionHeight, maxTotal - productHeight);
          areas.direction.style.height = `${target}px`;
        }
      });
    });
  }, []);

  useEffect(() => {
    if (!isPrescriptionEditing) {
      return;
    }
    const frame = window.requestAnimationFrame(syncPrescriptionDirectionHeights);
    return () => window.cancelAnimationFrame(frame);
  }, [isPrescriptionEditing, prescriptionDraft, syncPrescriptionDirectionHeights]);

  const handlePrescriptionSelect = async (
    prescription: Prescription,
    forceReload = false,
    skipPrompt = false
  ) => {
    if (!skipPrompt && isPrescriptionEditing && isPrescriptionDirty()) {
      requestPrescriptionExit(() =>
        handlePrescriptionSelect(prescription, forceReload, true)
      );
      return;
    }
    if (selectedPrescriptionId === prescription.id && !forceReload) {
      return;
    }
    setSelectedPrescriptionId(prescription.id);
    setPrescriptionPreviewUrl(`/api/prescriptions/${prescription.id}/file`);
    setIsPrescriptionEditing(false);
    closePrescriptionShareModal();

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
    prescriptionEditSnapshotRef.current = null;
  };

  const handlePrescriptionCancel = () => {
    requestPrescriptionExit(cancelPrescriptionEdit);
  };

  const handlePrescriptionNew = (skipPrompt = false) => {
    if (!skipPrompt && isPrescriptionEditing && isPrescriptionDirty()) {
      requestPrescriptionExit(() => handlePrescriptionNew(true));
      return;
    }
    setSelectedPrescriptionId(null);
    const draft = createPrescriptionDraft(prescriptionColumnCount);
    draft.start_date = getTodayDateString();
    setPrescriptionDraft(draft);
    setPrescriptionPreviewUrl(null);
    prescriptionEditSnapshotRef.current = serializePrescriptionDraft(
      draft,
      prescriptionColumnCount
    );
    setIsPrescriptionEditing(true);
  };

  const savePrescription = async () => {
    if (!selectedClientId) {
      setNotice("Select a client before saving a prescription.", true);
      return false;
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
          await loadPrescriptions(selectedClientId, {
            selectId: selectedPrescriptionId
          });
        }
        setIsPrescriptionEditing(false);
        prescriptionEditSnapshotRef.current = null;
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
        prescriptionEditSnapshotRef.current = null;
        setNotice("Prescription created.");
      }
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save prescription",
        true
      );
      return false;
    }
  };

  const handlePrescriptionSave = async (event: React.FormEvent) => {
    event.preventDefault();
    await savePrescription();
  };

  const handlePrescriptionExitStay = () => {
    pendingPrescriptionExitRef.current = null;
    setIsPrescriptionExitPromptOpen(false);
  };

  const handlePrescriptionExitDiscard = () => {
    const action = pendingPrescriptionExitRef.current;
    pendingPrescriptionExitRef.current = null;
    setIsPrescriptionExitPromptOpen(false);
    cancelPrescriptionEdit();
    action?.();
  };

  const handlePrescriptionExitSave = async () => {
    const action = pendingPrescriptionExitRef.current;
    pendingPrescriptionExitRef.current = null;
    setIsPrescriptionExitPromptOpen(false);
    const saved = await savePrescription();
    if (!saved) {
      return;
    }
    action?.();
  };

  const handlePrescriptionDelete = async () => {
    if (!selectedPrescriptionId || !selectedClientId) {
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

  const handlePrescriptionMarkCurrent = async () => {
    if (!selectedPrescriptionId || !selectedClientId) {
      setNotice("Select a prescription to mark as current.", true);
      return;
    }

    try {
      const response = await fetch(
        `/api/prescriptions/${selectedPrescriptionId}/current`,
        { method: "PATCH" }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to mark prescription as current");
      }

      setPrescriptions((prev) =>
        prev.map((item) => ({
          ...item,
          is_current: item.id === selectedPrescriptionId ? 1 : 0
        }))
      );
      setNotice("Marked as current prescription.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to mark prescription",
        true
      );
    }
  };

  const handleNoteDraftChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    const nextValue = name === "date_seen" ? formatDateInput(value) : value;
    setNoteDraft((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleNoteDraftNotesChange = (value: string) => {
    setNoteDraft((prev) => ({ ...prev, notes: value }));
  };

  const handleNoteFormToggle = () => {
    notesGuard.requestExit(() => {
      setIsNoteFormOpen(true);
    });
  };

  const handleNoteFormCancel = () => {
    setNoteDraft({ date_seen: "", notes: "" });
    setIsNoteFormOpen(false);
    setNotesHighlightTarget(null);
  };

  const handleNotesHighlight = () => {
    if (!notesHighlightTarget) {
      setNotice("Select text to highlight.", true);
      return;
    }

    const textareaId =
      notesHighlightTarget.kind === "draft"
        ? "note-draft"
        : `note-${notesHighlightTarget.noteId}`;
    const textarea = document.getElementById(
      textareaId
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

    if (notesHighlightTarget.kind === "draft") {
      const raw = noteDraft.notes ?? "";
        const nextRaw = toggleHighlightInRaw(raw, start, end);
        if (nextRaw !== raw) {
          handleNoteDraftNotesChange(nextRaw);
        }
      setTimeout(() => textarea.focus(), 0);
      return;
    }

    const note = notes.find((item) => item.id === notesHighlightTarget.noteId);
    if (!note) {
      setNotice("Select text to highlight.", true);
      return;
    }
    const raw = note.notes ?? "";
      const nextRaw = toggleHighlightInRaw(raw, start, end);
      if (nextRaw !== raw) {
        handleNoteFieldChange(note.id, "notes", nextRaw);
      }
      setTimeout(() => textarea.focus(), 0);
    };

  async function saveNoteCreate() {
    if (!selectedClientId) {
      setNotice("Select a client before adding a note.", true);
      return false;
    }

    const trimmedDate = noteDraft.date_seen.trim();
    const trimmedNotes = noteDraft.notes.trim();
    if (!trimmedDate || !trimmedNotes) {
      setNotice("Date last seen and notes are required.", true);
      return false;
    }

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          date_seen: trimmedDate,
          notes: trimmedNotes
        })
      });
      const data = (await response.json()) as {
        note?: ClientNote;
        error?: string;
      };
      if (!response.ok || !data.note) {
        throw new Error(data.error ?? "Failed to create note");
      }
      setNotes((prev) => [data.note as ClientNote, ...prev]);
      setNoteDraft({ date_seen: "", notes: "" });
      setIsNoteFormOpen(false);
      setNotice("Note added.");
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to add note", true);
      return false;
    }
  }

  const handleNoteCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveNoteCreate();
  };

  const handleNoteFieldChange = (
    noteId: number,
    field: "date_seen" | "notes",
    value: string
  ) => {
    const nextValue = field === "date_seen" ? formatDateInput(value) : value;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, [field]: nextValue } : note
      )
    );
  };

  const handleNoteEdit = (noteId: number) => {
    notesGuard.requestExit(() => {
      if (!noteEditSnapshotRef.current[noteId]) {
        const note = notes.find((item) => item.id === noteId);
        if (note) {
          noteEditSnapshotRef.current[noteId] = { ...note };
        }
      }
      setEditingNoteId(noteId);
    });
  };

  const handleNoteEditCancel = (noteId: number) => {
    const snapshot = noteEditSnapshotRef.current[noteId];
    if (snapshot) {
      setNotes((prev) =>
        prev.map((note) => (note.id === noteId ? snapshot : note))
      );
      delete noteEditSnapshotRef.current[noteId];
    }
    setEditingNoteId(null);
    setNotesHighlightTarget(null);
  };

  async function saveNoteEdit(note: ClientNote) {
    const trimmedDate = note.date_seen.trim();
    const trimmedNotes = note.notes.trim();
    if (!trimmedDate || !trimmedNotes) {
      setNotice("Date last seen and notes are required.", true);
      return false;
    }

    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_seen: trimmedDate,
          notes: trimmedNotes
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save note");
      }
      delete noteEditSnapshotRef.current[note.id];
      setEditingNoteId(null);
      setNotice("Note updated.");
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to save note", true);
      return false;
    }
  }

  const handleNoteSave = async (note: ClientNote) => {
    await saveNoteEdit(note);
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
        throw new Error(data.error ?? "Failed to update note status");
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
      setNotice(checked ? "Marked as done." : "Done status cleared.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to update note",
        true
      );
    }
  };

  const toggleNoteLock = (noteId: number) => {
    setUnlockedNoteIds((prev) => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  const handleNoteDelete = async (note: ClientNote) => {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete note");
      }
      setNotes((prev) => prev.filter((item) => item.id !== note.id));
      setEditingNoteId((prev) => (prev === note.id ? null : prev));
      delete noteEditSnapshotRef.current[note.id];
      setUnlockedNoteIds((prev) => {
        if (!prev[note.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
      setNotice("Note deleted.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to delete note", true);
    }
  };
  const handlePrescriptionPrint = () => {
    if (!selectedPrescriptionId) {
      setNotice("Select a prescription to print.", true);
      return;
    }
    setPrintUrl(`/api/prescriptions/${selectedPrescriptionId}/file?ts=${Date.now()}`);
  };

  const openPrescriptionShareModal = async () => {
    if (!selectedPrescriptionId) {
      setNotice("Select a prescription to share.", true);
      return;
    }
    setIsPrescriptionShareOpen(true);
    setPrescriptionShareLoading(true);
    setPrescriptionShareQrDataUrl(null);
    setPrescriptionShareUrl(null);
    try {
      const response = await fetch(
        `/api/prescriptions/${selectedPrescriptionId}/share-qr`
      );
      const data = (await response.json()) as {
        share_url?: string;
        qr_data_url?: string;
        error?: string;
      };
      if (!response.ok || !data.share_url || !data.qr_data_url) {
        throw new Error(data.error ?? "Failed to generate share QR");
      }
      setPrescriptionShareUrl(data.share_url);
      setPrescriptionShareQrDataUrl(data.qr_data_url);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to generate share QR",
        true
      );
      setIsPrescriptionShareOpen(false);
    } finally {
      setPrescriptionShareLoading(false);
    }
  };

  const closePrescriptionShareModal = () => {
    setIsPrescriptionShareOpen(false);
    setPrescriptionShareQrDataUrl(null);
    setPrescriptionShareUrl(null);
    setPrescriptionShareLoading(false);
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

      setIsCopyPanelOpen(false);
      setCopyClientQuery("");
      setCopyTargetClientId("");
      setCopyClientActiveIndex(-1);
      setNotice("Prescription copied.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to copy prescription",
        true
      );
    }
  };

  const handleTemplateApply = (skipPrompt = false) => {
    if (!skipPrompt && isPrescriptionEditing && isPrescriptionDirty()) {
      requestPrescriptionExit(() => handleTemplateApply(true));
      return;
    }
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
    prescriptionEditSnapshotRef.current = serializePrescriptionDraft(
      draft,
      draft.columns.length
    );
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
    const hasPhotos = photosByAppointment.has(appointment.id);
    if (appointmentNotesMode === "all") {
      const container = appointmentNotesBodyRef.current;
      if (container) {
        appointmentNotesScrollStartRef.current = container.scrollTop;
      }
    }
    setSelectedAppointmentId(appointment.id);
    setAppointmentForm({
      id: appointment.id,
      date: appointment.date ?? "",
      type: appointment.type ?? "",
      treatment: appointment.treatment ?? "",
      price: formatCurrencyInput(appointment.price ?? ""),
      photos_taken: hasPhotos ? "Yes" : "No",
      treatment_notes: appointment.treatment_notes ?? ""
    });
    setPhotoUploadAppointmentId(String(appointment.id));
  };

  useLayoutEffect(() => {
    if (appointmentNotesMode !== "all" || !selectedAppointmentId) {
      return;
    }
    const container = appointmentNotesBodyRef.current;
    const item = appointmentNoteItemRefs.current.get(selectedAppointmentId);
    if (!container || !item) {
      return;
    }
    const DEBUG_APPT_SCROLL = false;
    if (appointmentNotesScrollRef.current !== null) {
      cancelAnimationFrame(appointmentNotesScrollRef.current);
      appointmentNotesScrollRef.current = null;
    }
    const startTop =
      appointmentNotesScrollStartRef.current ?? container.scrollTop;
    appointmentNotesScrollStartRef.current = null;
    const lockedTop = startTop;
    container.scrollTop = lockedTop;
    const raf = requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const containerTop = container.scrollTop;
      const itemTop = itemRect.top - containerRect.top + containerTop;
      const rawTargetTop =
        itemTop - (container.clientHeight / 2 - itemRect.height / 2);
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const targetTop = Math.min(Math.max(rawTargetTop, 0), maxScroll);

      const delta = targetTop - startTop;
      if (Math.abs(delta) < 1) {
        return;
      }
      const duration = 500;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        container.scrollTop = startTop + delta * eased;
        if (t < 1) {
          appointmentNotesScrollRef.current = requestAnimationFrame(step);
        } else {
          appointmentNotesScrollRef.current = null;
        }
      };

      appointmentNotesScrollRef.current = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [appointmentNotesMode, selectedAppointmentId, appointmentsWithNotes.length]);

  const handleAppointmentEdit = (appointment: Appointment) => {
    appointmentGuard.requestExit(() => {
      handleAppointmentSelect(appointment);
      setIsAppointmentFormOpen(true);
    });
  };

  const handleAppointmentNew = () => {
    appointmentGuard.requestExit(() => {
      setSelectedAppointmentId(null);
      setAppointmentForm(EMPTY_APPOINTMENT);
      setIsAppointmentFormOpen(true);
    });
  };

  function handleAppointmentFormClose() {
    setIsAppointmentFormOpen(false);
  }

  async function saveAppointment() {
    if (!selectedClientId) {
      setNotice("Select a client before saving an appointment.", true);
      return false;
    }

    if (!appointmentForm.date.trim() || !appointmentForm.type.trim()) {
      setNotice("Date and type are required for appointments.", true);
      return false;
    }

    try {
      const payload = {
        date: appointmentForm.date.trim(),
        type: appointmentForm.type.trim(),
        treatment: appointmentForm.treatment,
        price: appointmentForm.price,
        photos_taken:
          appointmentForm.id && photosByAppointment.has(appointmentForm.id)
            ? "Yes"
            : "No",
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
        return true;
      }
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
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save appointment",
        true
      );
      return false;
    }
  }

  const handleAppointmentSave = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveAppointment();
  };

  const handleAppointmentDelete = async () => {
    if (!selectedAppointmentId || !selectedClientId) {
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

  const handleProductChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = event.target;
    const field = name as keyof ProductForm;
    let nextValue = value;
    if (field === "date") {
      nextValue = formatDateInput(value);
    }
    if (field === "cost") {
      nextValue = formatCurrencyInput(value);
    }
    setProductForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleProductSelectChange = (value: string) => {
    if (!value) {
      setProductForm((prev) => ({
        ...prev,
        product: "",
        size: "",
        cost: ""
      }));
      return;
    }
    const selected = PRODUCT_CATALOG.find((item) => item.name === value);
    if (!selected) {
      setProductForm((prev) => ({ ...prev, product: value }));
      return;
    }
    setProductForm((prev) => ({
      ...prev,
      product: selected.name,
      size: selected.size,
      cost: formatCurrencyInput(String(selected.price)),
      brand: selected.brand
    }));
  };

  const handleProductBrandChange = (nextBrand: string) => {
    setProductForm((prev) => {
      if (!nextBrand) {
        return { ...prev, brand: "", product: "", size: "", cost: "" };
      }
      const matchesBrand = PRODUCT_CATALOG.some(
        (item) => item.name === prev.product && item.brand === nextBrand
      );
      if (!matchesBrand) {
        return { ...prev, brand: nextBrand, product: "", size: "", cost: "" };
      }
      return { ...prev, brand: nextBrand };
    });
  };

  const handleProductGroupSelect = (groupDate: string) => {
    setSelectedProductGroupDate(groupDate);
    setSelectedProductId(null);
    setIsProductFormOpen(false);
  };

  const toggleProductGroupCollapsed = (groupDate: string) => {
    setCollapsedProductDates((prev) => ({
      ...prev,
      [groupDate]: !prev[groupDate]
    }));
  };

  const handleProductSelect = (entry: ClientProduct) => {
    const dateKey = entry.date?.trim() || "No date";
    setSelectedProductGroupDate(dateKey);
    setSelectedProductId(entry.id);
    setProductForm({
      id: entry.id,
      date: entry.date ?? "",
      product: entry.product ?? "",
      size: entry.size ?? "",
      cost: formatCurrencyInput(entry.cost ?? ""),
      brand: entry.brand ?? ""
    });
  };

  const handleProductEdit = (entry: ClientProduct) => {
    productGuard.requestExit(() => {
      handleProductSelect(entry);
      setIsProductFormOpen(true);
    });
  };

  const handleProductNew = () => {
    productGuard.requestExit(() => {
      setSelectedProductId(null);
      setSelectedProductGroupDate(null);
      setProductForm(EMPTY_PRODUCT);
      setIsProductFormOpen(true);
    });
  };

  function handleProductFormClose() {
    setIsProductFormOpen(false);
  }

  async function saveProduct() {
    if (!selectedClientId) {
      setNotice("Select a client before saving a product.", true);
      return false;
    }

    if (
      !productForm.date.trim() ||
      !productForm.brand.trim() ||
      !productForm.product.trim()
    ) {
      setNotice("Date, brand, and product are required.", true);
      return false;
    }

    try {
      const payload = {
        date: productForm.date.trim(),
        product: productForm.product.trim(),
        size: productForm.size,
        cost: productForm.cost,
        brand: productForm.brand
      };

      if (selectedProductId) {
        const response = await fetch(`/api/products/${selectedProductId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to update product");
        }
        await loadProducts(selectedClientId);
        setNotice("Product updated.");
        setIsProductFormOpen(false);
        return true;
      }
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          ...payload
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create product");
      }
      await loadProducts(selectedClientId);
      setNotice("Product saved.");
      setIsProductFormOpen(false);
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to save product",
        true
      );
      return false;
    }
  }

  const handleProductSave = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveProduct();
  };

  const handleProductDelete = async () => {
    if (!selectedProductId || !selectedClientId) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${selectedProductId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete product");
      }
      await loadProducts(selectedClientId);
      setNotice("Product deleted.");
      setIsProductFormOpen(false);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to delete product",
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

  const handleAddClientFromSearch = () => {
    const trimmedName = searchQuery.trim();
    handleNewClient(trimmedName);
    setSearchQuery("");
    setSearchActiveIndex(-1);
    window.requestAnimationFrame(() => {
      primaryPhoneInputRef.current?.focus();
    });
  };

  const handleLoadMorePhotos = () => {
    setPhotoVisibleCount((prev) => Math.min(prev + PHOTO_PAGE_SIZE, photos.length));
  };

  const clearQrPhotoPolling = useCallback(() => {
    if (qrPhotoPollTimerRef.current) {
      window.clearTimeout(qrPhotoPollTimerRef.current);
      qrPhotoPollTimerRef.current = null;
    }
    qrPhotoBaselineRef.current = null;
    qrPhotoLastCountRef.current = null;
    qrPhotoStableCountRef.current = 0;
  }, []);

  const clearQrProfilePolling = useCallback(() => {
    if (qrProfilePollTimerRef.current) {
      window.clearTimeout(qrProfilePollTimerRef.current);
      qrProfilePollTimerRef.current = null;
    }
    qrProfileBaselineRef.current = null;
    qrProfileLastStampRef.current = null;
    qrProfileStableCountRef.current = 0;
  }, []);

  const handleUploadSuccessAcknowledge = async () => {
    const success = uploadSuccess;
    if (!success) {
      return;
    }

    setUploadSuccess(null);

    if (success.kind === "photo") {
      clearQrPhotoPolling();
      setIsPhotoUploadOpen(false);
      if (selectedClientId) {
        await loadPhotos(selectedClientId);
        await loadAppointments(selectedClientId);
      }
    } else {
      clearQrProfilePolling();
      setIsProfileUploadOpen(false);
    }
  };

  const handleSelectClientFromSearch = async (clientId: number) => {
    setSearchActiveIndex(-1);
    setSearchQuery("");
    await handleSelectClient(clientId);
  };

  useEffect(() => {
    if (
      !isPhotoUploadOpen ||
      photoUploadMode !== "qr" ||
      !selectedClientId ||
      !photoUploadAppointmentId
    ) {
      clearQrPhotoPolling();
      return;
    }

    const appointmentId = Number(photoUploadAppointmentId);
    if (!Number.isFinite(appointmentId)) {
      clearQrPhotoPolling();
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) {
        return;
      }

      try {
        const response = await fetch(
          `/api/photos?client_id=${selectedClientId}&appointment_id=${appointmentId}`
        );
        const data = (await response.json()) as {
          photos?: unknown[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to check uploaded photos");
        }

        const count = data.photos?.length ?? 0;
        if (qrPhotoBaselineRef.current === null) {
          qrPhotoBaselineRef.current = count;
          qrPhotoLastCountRef.current = count;
          qrPhotoStableCountRef.current = 0;
        } else if (count > qrPhotoBaselineRef.current) {
          if (count === qrPhotoLastCountRef.current) {
            qrPhotoStableCountRef.current += 1;
          } else {
            qrPhotoStableCountRef.current = 1;
          }
          qrPhotoLastCountRef.current = count;

          if (qrPhotoStableCountRef.current >= 2) {
            setUploadSuccess({
              kind: "photo",
              count: count - qrPhotoBaselineRef.current
            });
            clearQrPhotoPolling();
            return;
          }
        } else {
          qrPhotoLastCountRef.current = count;
          qrPhotoStableCountRef.current = 0;
        }
      } catch {
        // Ignore polling errors and retry.
      }

      qrPhotoPollTimerRef.current = window.setTimeout(poll, 2000);
    };

    qrPhotoPollTimerRef.current = window.setTimeout(poll, 1200);

    return () => {
      cancelled = true;
      clearQrPhotoPolling();
    };
  }, [
    clearQrPhotoPolling,
    isPhotoUploadOpen,
    photoUploadAppointmentId,
    photoUploadMode,
    selectedClientId
  ]);

  useEffect(() => {
    if (!isProfileUploadOpen || profileUploadMode !== "qr" || !selectedClientId) {
      clearQrProfilePolling();
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) {
        return;
      }

      try {
        const response = await fetch(
          `/api/clients/${selectedClientId}/profile-picture?ts=${Date.now()}`,
          { method: "HEAD", cache: "no-store" }
        );

        let stamp = 0;
        if (response.ok) {
          const mtimeHeader = response.headers.get("x-file-mtime");
          const lastModified = response.headers.get("last-modified");
          if (mtimeHeader) {
            const parsed = Number(mtimeHeader);
            stamp = Number.isFinite(parsed) ? parsed : 0;
          } else if (lastModified) {
            const parsed = Date.parse(lastModified);
            stamp = Number.isFinite(parsed) ? parsed : 0;
          }
        }

        if (qrProfileBaselineRef.current === null) {
          qrProfileBaselineRef.current = stamp;
          qrProfileLastStampRef.current = stamp;
          qrProfileStableCountRef.current = 0;
        } else if (stamp > qrProfileBaselineRef.current) {
          if (stamp === qrProfileLastStampRef.current) {
            qrProfileStableCountRef.current += 1;
          } else {
            qrProfileStableCountRef.current = 1;
          }
          qrProfileLastStampRef.current = stamp;

          if (qrProfileStableCountRef.current >= 2) {
            setProfilePictureUrl(
              `/api/clients/${selectedClientId}/profile-picture?ts=${Date.now()}`
            );
            setUploadSuccess({ kind: "profile", count: 1 });
            clearQrProfilePolling();
            return;
          }
        } else {
          qrProfileLastStampRef.current = stamp;
          qrProfileStableCountRef.current = 0;
        }
      } catch {
        // Ignore polling errors and retry.
      }

      qrProfilePollTimerRef.current = window.setTimeout(poll, 2000);
    };

    qrProfilePollTimerRef.current = window.setTimeout(poll, 1200);

    return () => {
      cancelled = true;
      clearQrProfilePolling();
    };
  }, [
    clearQrProfilePolling,
    isProfileUploadOpen,
    profileUploadMode,
    selectedClientId
  ]);

  const treatmentOptions = APPOINTMENT_TREATMENTS[appointmentForm.type] ?? [];
  const hasCustomTreatment =
    appointmentForm.treatment &&
    !treatmentOptions.includes(appointmentForm.treatment);
  const productBrands = useMemo(() => {
    return Array.from(
      new Set(PRODUCT_CATALOG.map((item) => item.brand))
    ).sort();
  }, []);
  const selectedCatalogProduct =
    PRODUCT_CATALOG.find((item) => item.name === productForm.product) ?? null;
  const filteredCatalogProducts = useMemo(() => {
    if (!productForm.brand) {
      return [];
    }
    return PRODUCT_CATALOG.filter((item) => item.brand === productForm.brand);
  }, [productForm.brand]);
  const hasCustomBrand =
    productForm.brand && !productBrands.includes(productForm.brand);
  const hasCustomProduct = productForm.product && !selectedCatalogProduct;

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
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchActiveIndex(-1);
                  }}
                  onKeyDown={(event) => {
                    if (handleSearchKeyDown(event)) {
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </Field>
            <div className={styles.clientSearchActions}>
              <Button variant="secondary" type="button" onClick={handleSearch}>
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
              <Button type="button" onClick={handleAddClientFromSearch}>
                Add Client
              </Button>
            </div>
            </div>
            {hasSearchQuery && (
              <SearchMenu
                show
                loading={loadingClients}
                loadingMessage="Loading clients..."
                emptyMessage="No clients found."
                items={filteredClients}
                activeIndex={searchActiveIndex}
                onActiveIndexChange={setSearchActiveIndex}
                getKey={(client) => client.id}
                getLabel={(client) => client.full_name}
                getMeta={(client) => client.primary_phone || "No phone"}
                onSelect={(client) => {
                  void handleSelectClientFromSearch(client.id);
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
          </div>
        </section>
        <section
          className={`${styles.panel} ${styles.overviewPanel} ${
            overviewMode === "collapsed" ? styles.overviewPanelCollapsed : ""
          }`}
        >
          <div
            className={`${styles.overviewHeader} ${
              overviewMode === "collapsed" ? styles.overviewHeaderCollapsed : ""
            }`}
          >
            <div className={styles.overviewHeaderTitle}>
              {overviewMode !== "collapsed" && (
                <h2 className={styles.overviewTitle}>
                  {clientForm.full_name ? clientForm.full_name : "Client Overview"}
                </h2>
              )}
            </div>
            <div
              className={`${styles.overviewHeaderActions} ${
                overviewMode === "collapsed" ? styles.overviewHeaderActionsCollapsed : ""
              }`}
            >
              {overviewMode === "collapsed" && (
                <div className={styles.overviewCollapsed}>
                  {selectedClientId ? (
                    profilePictureUrl ? (
                      <button
                        type="button"
                        className={styles.overviewCollapsedAvatarButton}
                        onClick={openProfileUploadModal}
                      >
                        <img
                          className={styles.overviewCollapsedAvatar}
                          src={profilePictureUrl}
                          alt="Profile"
                          onError={() => setProfilePictureUrl(null)}
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.overviewCollapsedAvatarButton}
                        onClick={openProfileUploadModal}
                      >
                        <span className={styles.overviewCollapsedAvatarPlaceholder}>
                          No photo
                        </span>
                      </button>
                    )
                  ) : (
                    <div className={styles.overviewCollapsedAvatarPlaceholder}>
                      No photo
                    </div>
                  )}
                  <div className={styles.overviewCollapsedText}>
                    <div className={`${styles.overviewCollapsedName} ${styles.overviewTitle}`}>
                      {clientForm.full_name
                        ? clientForm.full_name
                        : "Select a client"}
                    </div>
                    <span className={styles.overviewCollapsedHighlights}>
                      {collapsedHighlightNodes.length > 0
                        ? collapsedHighlightNodes
                        : null}
                    </span>
                  </div>
                </div>
              )}
              <div className={styles.overviewHeaderMetaGroup}>
                {selectedClientId && (
                  <div className={styles.overviewMetaRow}>
                    {referralStats.count > 0 && (
                      <span
                        className={`${styles.overviewMeta} ${styles.overviewMetaReferral}`}
                      >
                        +{referralStats.count} Referral
                        {referralStats.count === 1 ? "" : "s"}
                        {referralStats.names.length > 0
                          ? ` -> ${referralStats.names.join(", ")}`
                          : ""}
                      </span>
                    )}
                    <span className={styles.overviewMeta}>ID #{selectedClientId}</span>
                  </div>
                )}
                {overviewMode !== "edit" && (
                  <button
                    type="button"
                    className={`${styles.overviewCollapseToggle} ${
                      overviewMode === "collapsed"
                        ? styles.overviewCollapseToggleCollapsed
                        : styles.overviewCollapseToggleExpanded
                    }`}
                    onClick={toggleOverviewCollapsed}
                    aria-expanded={overviewMode !== "collapsed"}
                    aria-label={
                      overviewMode === "collapsed"
                        ? "Expand client overview"
                        : "Collapse client overview"
                    }
                  >
                    <svg
                      className={styles.overviewCollapseIcon}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {overviewMode === "collapsed" ? null : (
            <div
              className={[
                styles.overviewGrid,
                overviewMode === "compact" ? styles.overviewGridCompact : "",
                overviewMode === "edit" ? styles.overviewGridEdit : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={`${styles.profileCard} ${
                  overviewMode === "compact" ? styles.compactCard : ""
                }`}
              >
                {!selectedClientId && (
                  <div
                    className={`${styles.profileStack} ${styles.profileStackCompact}`}
                  >
                    <div
                      className={`${styles.profilePlaceholder} ${styles.profilePlaceholderCompact}`}
                    >
                      No profile picture yet.
                    </div>
                  </div>
                )}
                {selectedClientId && (
                  <>
                    <div
                      className={[
                        styles.profileStack,
                        overviewMode === "compact" ? styles.profileStackCompact : "",
                        overviewMode === "edit" ? styles.profileStackEdit : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {profilePictureUrl ? (
                        <button
                          type="button"
                          className={styles.profileImageButton}
                          onClick={openProfileUploadModal}
                        >
                          <img
                            className={`${styles.profileImage} ${
                              styles.profileImageCompact
                            }`}
                            src={profilePictureUrl}
                            alt="Profile"
                            onError={() => setProfilePictureUrl(null)}
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.profilePlaceholderButton} ${styles.profilePlaceholderCompact}`}
                          onClick={openProfileUploadModal}
                        >
                          <span
                            className={`${styles.profilePlaceholder} ${
                              styles.profilePlaceholderCompact
                            }`}
                          >
                            No profile picture yet.
                          </span>
                        </button>
                      )}
                      {overviewMode === "edit" && (
                        <div className={styles.profileUploadActions}>
                          <Button type="button" onClick={openProfileUploadModal}>
                            Upload Picture
                          </Button>
                        </div>
                      )}
                    </div>

                  </>
                )}
              </div>

            <div className={styles.detailsPanel}>
              <div className={styles.detailsHeader}>
                <Tabs
                  className={styles.overviewTabs}
                  value={overviewTab}
                  onChange={handleOverviewTabSelect}
                  tabs={OVERVIEW_TABS}
                />
                {overviewMode === "compact" && selectedClientId && (
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={loadingClientDetails}
                    onClick={enterOverviewEdit}
                    aria-label="Edit client"
                    title="Edit"
                  >
                    Edit
                  </Button>
                )}
              </div>

              <div
                className={`${styles.detailsCard} ${
                  overviewMode === "compact" ? styles.compactCard : ""
                }`}
              >
              {overviewMode === "edit" && (
                <CloseButton
                  className={`${styles.editToggleIcon} ${styles.editToggleFloatingCard}`}
                  disabled={loadingClientDetails}
                  onClick={() => overviewGuard.requestExit(handleOverviewEditCancel)}
                  aria-label="Exit edit mode"
                  title="Close edit"
                />
              )}
              {overviewTab === "info" && (
                <>
                  {overviewMode === "compact" ? (
                    <>
                      {!selectedClientId && (
                        <Notice>Select a client to view info.</Notice>
                      )}
                      {selectedClientId && (
                        <div
                          className={`${styles.formGrid} ${styles.compactGrid} ${styles.infoGrid}`}
                        >
                          <Field as="div" label="Gender">
                            <CompactValue value={clientForm.gender} />
                          </Field>
                          <Field as="div" label="Phone">
                            <CompactValue
                              value={formatCompactPhones(
                                clientForm.primary_phone,
                                clientForm.secondary_phone
                              )}
                              multiline
                            />
                          </Field>
                          <Field
                            as="div"
                            label="Birthdate"
                            className={isBirthdayWindow ? styles.birthdayField : ""}
                          >
                            <CompactValue value={clientForm.birthdate} />
                          </Field>
                          <Field as="div" label="Address">
                            <CompactValue
                              value={formatCompactAddress(clientForm)}
                              multiline
                            />
                          </Field>
                          <Field as="div" label="Email">
                            <CompactValue value={clientForm.email} />
                          </Field>
                          <Field as="div" label="Referred By">
                            <CompactValue value={referredByDisplay} />
                          </Field>
                        </div>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handleClientSave}>
                      <div className={`${styles.formGrid} ${styles.infoGrid}`}>
                        <Field label="Full Name">
                          <input
                            className={styles.input}
                            name="full_name"
                            value={clientForm.full_name}
                            onChange={handleClientChange}
                            required
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="Gender">
                          <SelectMenu
                            value={clientForm.gender}
                            placeholder="Select"
                            options={[
                              { value: "Male", label: "Male" },
                              { value: "Female", label: "Female" }
                            ]}
                            onChange={(value) =>
                              handleClientSelectChange("gender", value)
                            }
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="Primary Phone">
                          <input
                            className={styles.input}
                            name="primary_phone"
                            ref={primaryPhoneInputRef}
                            placeholder="(###) ###-####"
                            inputMode="numeric"
                            value={clientForm.primary_phone}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field
                          label="Birthdate"
                          className={isBirthdayWindow ? styles.birthdayField : ""}
                        >
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
                        </Field>
                        <Field label="Email">
                          <input
                            className={styles.input}
                            name="email"
                            value={clientForm.email}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="Secondary Phone">
                          <input
                            className={styles.input}
                            name="secondary_phone"
                            placeholder="(###) ###-####"
                            inputMode="numeric"
                            value={clientForm.secondary_phone}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="Address 1">
                          <input
                            className={styles.input}
                            name="address1"
                            value={clientForm.address1}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="Address 2">
                          <input
                            className={styles.input}
                            name="address2"
                            value={clientForm.address2}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="City">
                          <input
                            className={styles.input}
                            name="city"
                            value={clientForm.city}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="State">
                          <input
                            className={styles.input}
                            name="state"
                            value={clientForm.state}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="Zip">
                          <input
                            className={styles.input}
                            name="zip"
                            value={clientForm.zip}
                            onChange={handleClientChange}
                            disabled={loadingClientDetails}
                          />
                        </Field>
                        <Field label="Referred By">
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
                                if (handleReferredByKeyDown(event)) {
                                  return;
                                }
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleReferredByCommit();
                                }
                              }}
                            />
                            <SearchMenu
                              show={hasReferredByQuery}
                              items={referredByMatches}
                              emptyMessage="No results"
                              activeIndex={referredByActiveIndex}
                              onActiveIndexChange={setReferredByActiveIndex}
                              selectedId={parseReferredById(referredBySelected)}
                              getKey={(client) => client.id}
                              getLabel={(client) => client.full_name}
                              getMeta={(client) => client.primary_phone ?? ""}
                              onSelect={handleReferredBySelect}
                              containerClassName={styles.referredByResults}
                              listClassName={styles.referredByList}
                              itemClassName={styles.referredByItem}
                              itemSelectedClassName={styles.referredByItemSelected}
                              itemActiveClassName={styles.referredByItemActive}
                              labelClassName={styles.referredByName}
                              metaClassName={styles.referredByMeta}
                              emptyClassName={styles.referredByEmpty}
                              labelElement="span"
                              metaElement="span"
                            />
                          </div>
                        </Field>
                      </div>
                      <ButtonRow>
                        <Button
                          type="submit"
                          disabled={loadingClientDetails}
                        >
                          {selectedClientId ? "Save Changes" : "Create Client"}
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => overviewGuard.requestExit(handleOverviewEditCancel)}
                          disabled={loadingClientDetails}
                          className={styles.cancelButton}
                        >
                          Cancel
                        </Button>
                        {selectedClientId && (
                          <Button
                            className={styles.buttonRowEnd}
                            danger
                            type="button"
                            onClick={() =>
                              openConfirmDialog({
                                title: "Delete Client",
                                message: "Delete this client and all associated data?",
                                confirmLabel: "Delete",
                                confirmDanger: true,
                                onConfirm: handleClientDelete
                              })
                            }
                            disabled={loadingClientDetails}
                          >
                            Delete Client
                          </Button>
                        )}
                      </ButtonRow>
                    </form>
                  )}
                </>
              )}

              {overviewTab === "health" && (
                <>
                  {overviewMode === "compact" ? (
                    <>
                      {!selectedClientId && (
                        <Notice>Select a client to view health info.</Notice>
                      )}
                      {selectedClientId && (
                        <div className={`${styles.formGrid} ${styles.compactGrid}`}>
                          <Field as="div" label="Allergies">
                            <ExpandableValue value={healthForm.allergies} />
                          </Field>
                          <Field as="div" label="Health Conditions">
                            <ExpandableValue
                              value={healthForm.health_conditions}
                            />
                          </Field>
                          <Field
                            as="div"
                            label="Health Risks"
                            className={styles.healthRiskField}
                          >
                            <ExpandableValue
                              value={healthForm.health_risks}
                            />
                          </Field>
                          <Field as="div" label="Medications">
                            <ExpandableValue value={healthForm.medications} />
                          </Field>
                          <Field as="div" label="Treatment Areas">
                            <ExpandableValue
                              value={healthForm.treatment_areas}
                            />
                          </Field>
                          <Field as="div" label="Current Products">
                            <ExpandableValue
                              value={healthForm.current_products}
                            />
                          </Field>
                          <Field as="div" label="Skin Conditions">
                            <ExpandableValue
                              value={healthForm.skin_conditions}
                            />
                          </Field>
                          <Field as="div" label="Other Notes">
                            <ExpandableValue
                              value={healthForm.other_notes}
                            />
                          </Field>
                          <Field as="div" label="Desired Improvement">
                            <ExpandableValue
                              value={healthForm.desired_improvement}
                            />
                          </Field>
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
                          <Field label="Allergies">
                            <HighlightTextarea
                              value={healthForm.allergies}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("allergies", value)
                              }
                              onFocus={() => setHealthHighlightField("allergies")}
                              textareaProps={{ id: "health-allergies" }}
                            />
                          </Field>
                          <Field label="Health Conditions">
                            <HighlightTextarea
                              value={healthForm.health_conditions}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("health_conditions", value)
                              }
                              onFocus={() =>
                                setHealthHighlightField("health_conditions")
                              }
                              textareaProps={{ id: "health-health_conditions" }}
                            />
                          </Field>
                          <Field label="Health Risks">
                            <HighlightTextarea
                              value={healthForm.health_risks}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("health_risks", value)
                              }
                              onFocus={() => setHealthHighlightField("health_risks")}
                              textareaProps={{ id: "health-health_risks" }}
                            />
                          </Field>
                          <Field label="Medications">
                            <HighlightTextarea
                              value={healthForm.medications}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("medications", value)
                              }
                              onFocus={() => setHealthHighlightField("medications")}
                              textareaProps={{ id: "health-medications" }}
                            />
                          </Field>
                          <Field label="Treatment Areas">
                            <HighlightTextarea
                              value={healthForm.treatment_areas}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("treatment_areas", value)
                              }
                              onFocus={() =>
                                setHealthHighlightField("treatment_areas")
                              }
                              textareaProps={{ id: "health-treatment_areas" }}
                            />
                          </Field>
                          <Field label="Current Products">
                            <HighlightTextarea
                              value={healthForm.current_products}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("current_products", value)
                              }
                              onFocus={() =>
                                setHealthHighlightField("current_products")
                              }
                              textareaProps={{ id: "health-current_products" }}
                            />
                          </Field>
                          <Field label="Skin Conditions">
                            <HighlightTextarea
                              value={healthForm.skin_conditions}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("skin_conditions", value)
                              }
                              onFocus={() =>
                                setHealthHighlightField("skin_conditions")
                              }
                              textareaProps={{ id: "health-skin_conditions" }}
                            />
                          </Field>
                          <Field label="Other Notes">
                            <HighlightTextarea
                              value={healthForm.other_notes}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("other_notes", value)
                              }
                              onFocus={() => setHealthHighlightField("other_notes")}
                              textareaProps={{ id: "health-other_notes" }}
                            />
                          </Field>
                          <Field label="Desired Improvement">
                            <HighlightTextarea
                              value={healthForm.desired_improvement}
                              placeholder=""
                              onChange={(value) =>
                                handleHealthFieldChange("desired_improvement", value)
                              }
                              onFocus={() =>
                                setHealthHighlightField("desired_improvement")
                              }
                              textareaProps={{ id: "health-desired_improvement" }}
                            />
                          </Field>
                        </div>
                      </fieldset>
                      <ButtonRow>
                        <Button
                          type="submit"
                          disabled={!selectedClientId}
                        >
                          Save Health Info
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!selectedClientId}
                          onClick={() => overviewGuard.requestExit(handleOverviewEditCancel)}
                          className={styles.cancelButton}
                        >
                          Cancel
                        </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            disabled={!selectedClientId}
                            onClick={handleHealthHighlight}
                            className={styles.highlightButton}
                          >
                            Highlight
                          </Button>
                        </ButtonRow>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
            </div>
          )}

          <Modal
            open={isProfileUploadOpen}
            title="Upload Profile Photo"
            onClose={closeProfileUploadModal}
            portalTarget={portalTarget}
            className={styles.uploadModal}
          >
            <div className={styles.modalSection}>
              <Notice>
                {clientForm.full_name
                  ? `For ${clientForm.full_name}`
                  : "Select a client to upload."}
              </Notice>
            </div>

            <Tabs
              className={styles.overviewTabs}
              value={profileUploadMode}
              onChange={handleProfileModeChange}
              tabs={UPLOAD_TABS}
            />

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
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={openProfileLocalPicker}
                    >
                      Choose File
                    </Button>
                    <Notice as="span">
                      {profileUploadFile
                        ? profileUploadFile.name
                        : "No file selected."}
                    </Notice>
                  </div>
                  <ButtonRow>
                    <Button
                      type="button"
                      onClick={handleProfileUploadClick}
                      disabled={!profileUploadFile}
                    >
                      Upload
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={closeProfileUploadModal}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </Button>
                  </ButtonRow>
                </div>
              </div>
            )}

            {profileUploadMode === "qr" && (
              <div className={styles.modalSection}>
                <div className={styles.qrPanel}>
                  <div className={styles.qrHeader}>
                    <h3>Profile QR Upload</h3>
                    {profileQrLoading && (
                      <Notice as="span">Generating...</Notice>
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
                        <div className={styles.qrUrl}>{profileQrUrl}</div>
                      )}
                    </div>
                  )}
                </div>
                <ButtonRow>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={closeProfileUploadModal}
                    className={styles.cancelButton}
                  >
                    Cancel
                  </Button>
                </ButtonRow>
              </div>
            )}
          </Modal>
        </section>
      </div>

      <section className={`${styles.panel} ${styles.workspacePanel}`}>
        {activeTab === "appointments" && (
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <Tabs
                as="nav"
                className={styles.sectionTabs}
                value={activeTab}
                onChange={handleWorkspaceTabSelect}
                tabs={WORKSPACE_TABS}
              />
              {selectedClientId && (
                <div className={styles.sectionHeaderActions}>
                  {selectedAppointment && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleAppointmentEdit(selectedAppointment)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleAppointmentNew}
                    disabled={!selectedClientId}
                  >
                    Add Appointment
                  </Button>
                </div>
              )}
            </div>
            {!selectedClientId && (
              <Notice>Select a client to manage appointments.</Notice>
            )}
            {selectedClientId && (
              <div className={styles.appointmentsLayout}>
                <div className={styles.appointmentsMain}>
                  {sortedAppointments.length === 0 && (
                    <Notice>No appointments yet.</Notice>
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
                      <Notice>
                        Double-click an appointment to edit or click Add Appointment
                        to create a new one.
                      </Notice>
                    </div>
                  )}
                  {isAppointmentFormOpen && (
                    <div className={styles.appointmentFormCard}>
                      <form
                        className={styles.appointmentForm}
                        onSubmit={handleAppointmentSave}
                      >
                      <CloseButton
                        className={styles.appointmentFormClose}
                        onClick={() =>
                          appointmentGuard.requestExit(handleAppointmentFormClose)
                        }
                        aria-label="Close appointment form"
                        title="Close"
                      />
                      <Field label="Date">
                        <input
                          className={styles.input}
                          name="date"
                          placeholder="MM/DD/YYYY"
                          inputMode="numeric"
                          value={appointmentForm.date}
                          onChange={handleAppointmentChange}
                        />
                      </Field>
                      <Field label="Type">
                        <SelectMenu
                          value={appointmentForm.type}
                          placeholder="Select type"
                          options={[
                            ...APPOINTMENT_TYPES.map((typeOption) => ({
                              value: typeOption,
                              label: typeOption
                            }))
                          ]}
                          onChange={handleAppointmentTypeChange}
                        />
                      </Field>
                      <Field label="Treatment">
                        <SelectMenu
                          value={appointmentForm.treatment}
                          placeholder="Select treatment"
                          options={[
                            ...(hasCustomTreatment
                              ? [
                                  {
                                    value: appointmentForm.treatment,
                                    label: appointmentForm.treatment
                                  }
                                ]
                              : []),
                            ...treatmentOptions.map((treatmentOption) => ({
                              value: treatmentOption,
                              label: treatmentOption
                            }))
                          ]}
                          onChange={handleAppointmentTreatmentChange}
                          disabled={!appointmentForm.type}
                        />
                      </Field>
                      <Field label="Price">
                        <input
                          className={styles.input}
                          name="price"
                          value={appointmentForm.price}
                          onChange={handleAppointmentChange}
                        />
                      </Field>
                      <Field label="Treatment Notes">
                        <textarea
                          className={styles.textarea}
                          name="treatment_notes"
                          value={appointmentForm.treatment_notes}
                          onChange={handleAppointmentChange}
                        />
                      </Field>
                      <ButtonRow>
                        <Button type="submit">
                          {selectedAppointmentId ? "Save Appointment" : "Add Appointment"}
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() =>
                            appointmentGuard.requestExit(handleAppointmentFormClose)
                          }
                          className={styles.cancelButton}
                        >
                          Cancel
                        </Button>
                        {selectedAppointmentId && (
                          <Button
                            className={styles.buttonRowEnd}
                            danger
                            type="button"
                            onClick={() =>
                              openConfirmDialog({
                                title: "Delete Appointment",
                                message: "Delete this appointment?",
                                confirmLabel: "Delete",
                                confirmDanger: true,
                                onConfirm: handleAppointmentDelete
                              })
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </ButtonRow>
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
                    <TogglePill
                      className={styles.notesToggle}
                      buttonClassName={styles.notesToggleButton}
                      buttonActiveClassName={styles.notesToggleButtonActive}
                      items={NOTES_TOGGLE_OPTIONS}
                      value={appointmentNotesMode}
                      onChange={setAppointmentNotesMode}
                    />
                  </div>
                    <div
                      className={styles.appointmentNotesBody}
                      ref={appointmentNotesBodyRef}
                    >
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
                              {appointmentsWithNotes.map((appointment) => {
                                const isSelected =
                                  selectedAppointmentId === appointment.id;
                                return (
                                  <div
                                    key={appointment.id}
                                    className={`${styles.appointmentNoteCard} ${
                                      isSelected ? styles.appointmentNoteCardSelected : ""
                                    }`}
                                    role="button"
                                    tabIndex={-1}
                                    onClick={() =>
                                      handleAppointmentSelect(appointment)
                                    }
                                    onMouseDown={(event) => event.preventDefault()}
                                    ref={(node) => {
                                      if (node) {
                                        appointmentNoteItemRefs.current.set(
                                          appointment.id,
                                          node
                                        );
                                      } else {
                                        appointmentNoteItemRefs.current.delete(
                                          appointment.id
                                        );
                                      }
                                    }}
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
                                  </div>
                                );
                              })}
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

        {activeTab === "products" && (
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <Tabs
                as="nav"
                className={styles.sectionTabs}
                value={activeTab}
                onChange={handleWorkspaceTabSelect}
                tabs={WORKSPACE_TABS}
              />
              {selectedClientId && (
                <div className={styles.sectionHeaderActions}>
                  {selectedProductEntry && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleProductEdit(selectedProductEntry)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleProductNew}
                    disabled={!selectedClientId}
                  >
                    Add Product
                  </Button>
                </div>
              )}
            </div>
            {!selectedClientId && (
              <Notice>Select a client to manage products.</Notice>
            )}
            {selectedClientId && (
              <div className={styles.appointmentsLayout}>
                <div className={styles.appointmentsMain}>
                  {loadingProducts && (
                    <Notice>Loading products...</Notice>
                  )}
                  {!loadingProducts && productGroups.length === 0 && (
                    <Notice>No products yet.</Notice>
                  )}
                  {!loadingProducts && productGroups.length > 0 && (
                    <table className={styles.appointmentsTable}>
                      <thead>
                        <tr>
                          <th className={styles.productToggleHeader} />
                          <th>Date</th>
                          <th>Product</th>
                          <th>Size</th>
                          <th>Cost</th>
                          <th>Brand</th>
                        </tr>
                      </thead>
                      <tbody>
                        <TreeList<ClientProduct, ProductGroup>
                          groups={productGroups}
                          isCollapsed={(group) =>
                            collapsedProductDates[group.date] ?? false
                          }
                          renderSingleRow={(group, entry) => {
                            const isSelected = selectedProductId === entry.id;
                            return (
                              <tr
                                key={entry.id}
                                className={
                                  isSelected ? styles.appointmentRowSelected : undefined
                                }
                                onClick={() => handleProductSelect(entry)}
                                onDoubleClick={() => handleProductEdit(entry)}
                              >
                                <td className={styles.productToggleCell} />
                                <td>{entry.date}</td>
                                <td>{entry.product}</td>
                                <td>{entry.size ?? ""}</td>
                                <td>{entry.cost ?? ""}</td>
                                <td>{entry.brand ?? ""}</td>
                              </tr>
                            );
                          }}
                          renderGroupRow={(group, isCollapsed) => {
                            const isSelected =
                              selectedProductGroupDate === group.date &&
                              selectedProductId === null;
                            return (
                              <tr
                                key={`group-${group.id}`}
                                className={`${styles.productGroupRow} ${
                                  isSelected ? styles.appointmentRowSelected : ""
                                }`}
                                onClick={() => handleProductGroupSelect(group.date)}
                              >
                                <td className={styles.productToggleCell}>
                                  <div
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <TreeToggle
                                      className={styles.productGroupToggle}
                                      collapsed={isCollapsed}
                                      onToggle={() => {
                                        handleProductGroupSelect(group.date);
                                        toggleProductGroupCollapsed(group.date);
                                      }}
                                      collapsedLabel="Expand product group"
                                      expandedLabel="Collapse product group"
                                    />
                                  </div>
                                </td>
                                <td className={styles.productGroupDate}>
                                  {group.date}
                                </td>
                                <td colSpan={4} className={styles.productGroupSummary}>
                                  {group.items.length} products
                                </td>
                              </tr>
                            );
                          }}
                          renderItemRow={(group, entry) => {
                            const isSelected = selectedProductId === entry.id;
                            return (
                              <tr
                                key={entry.id}
                                className={
                                  isSelected ? styles.appointmentRowSelected : undefined
                                }
                                onClick={() => handleProductSelect(entry)}
                                onDoubleClick={() => handleProductEdit(entry)}
                              >
                                <td className={styles.productToggleCell} />
                                <td
                                  className={styles.productTreeDateCell}
                                  aria-hidden="true"
                                />
                                <td>{entry.product}</td>
                                <td>{entry.size ?? ""}</td>
                                <td>{entry.cost ?? ""}</td>
                                <td>{entry.brand ?? ""}</td>
                              </tr>
                            );
                          }}
                        />
                      </tbody>
                    </table>
                  )}
                  {!isProductFormOpen && (
                    <div className={styles.appointmentFormPlaceholder}>
                      <Notice>
                        Double-click a product to edit or click Add Product to
                        create a new one.
                      </Notice>
                    </div>
                  )}
                  {isProductFormOpen && (
                    <div className={styles.appointmentFormCard}>
                      <form
                        className={styles.appointmentForm}
                        onSubmit={handleProductSave}
                      >
                        <CloseButton
                          className={styles.appointmentFormClose}
                          onClick={() =>
                            productGuard.requestExit(handleProductFormClose)
                          }
                          aria-label="Close product form"
                          title="Close"
                        />
                        <Field label="Date">
                          <input
                            className={styles.input}
                            name="date"
                            placeholder="MM/DD/YYYY"
                            inputMode="numeric"
                            value={productForm.date}
                            onChange={handleProductChange}
                          />
                        </Field>
                        <Field label="Brand">
                        <SelectMenu
                          value={productForm.brand}
                          placeholder="Select brand"
                          options={[
                            ...(hasCustomBrand
                              ? [{ value: productForm.brand, label: productForm.brand }]
                              : []),
                            ...productBrands.map((brand) => ({
                              value: brand,
                                label: brand
                              }))
                            ]}
                            onChange={handleProductBrandChange}
                          />
                        </Field>
                        <Field label="Product">
                        <SelectMenu
                          value={productForm.product}
                          placeholder={
                            productForm.brand
                              ? "Select product"
                              : "Select brand first"
                          }
                          options={[
                            ...(hasCustomProduct
                              ? [
                                  {
                                    value: productForm.product,
                                    label: productForm.product
                                    }
                                  ]
                                : []),
                              ...filteredCatalogProducts.map((item) => ({
                                value: item.name,
                                label: `${item.name} (${item.size}, ${formatCurrencyInput(
                                  String(item.price)
                                )})`
                              }))
                            ]}
                            onChange={handleProductSelectChange}
                            disabled={!productForm.brand}
                          />
                        </Field>
                        <Field label="Size">
                          <input
                            className={styles.input}
                            name="size"
                            value={productForm.size}
                            onChange={handleProductChange}
                          />
                        </Field>
                        <Field label="Cost">
                          <input
                            className={styles.input}
                            name="cost"
                            value={productForm.cost}
                            onChange={handleProductChange}
                          />
                        </Field>
                        <ButtonRow>
                          <Button type="submit">
                            {selectedProductId ? "Save Product" : "Add Product"}
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() =>
                              productGuard.requestExit(handleProductFormClose)
                            }
                            className={styles.cancelButton}
                          >
                            Cancel
                          </Button>
                          {selectedProductId && (
                            <Button
                              className={styles.buttonRowEnd}
                              danger
                              type="button"
                              onClick={() =>
                                openConfirmDialog({
                                  title: "Delete Product",
                                  message: "Delete this product entry?",
                                  confirmLabel: "Delete",
                                  confirmDanger: true,
                                  onConfirm: handleProductDelete
                                })
                              }
                            >
                              Delete
                            </Button>
                          )}
                        </ButtonRow>
                      </form>
                    </div>
                  )}
                </div>
                <aside className={styles.appointmentNotesPanel}>
                  <div className={styles.appointmentNotesHeader}>
                    <div className={styles.appointmentNotesHeading}>
                      <h3 className={styles.appointmentNotesTitle}>
                        Product Details
                      </h3>
                    </div>
                  </div>
                  <div className={styles.appointmentNotesBody}>
                    {!selectedProductReceipt && (
                      <p className={styles.appointmentNotesHint}>
                        Select a product to view details.
                      </p>
                    )}
                    {selectedProductReceipt && (
                      <Receipt
                        title="Receipt"
                        date={selectedProductReceipt.date}
                        groups={selectedProductReceipt.brands.map((group) => ({
                          id: group.brand,
                          label: group.brand,
                          items: group.items.map((entry) => ({
                            id: entry.id,
                            name: entry.product || "Product",
                            meta: entry.size ? `Size: ${entry.size}` : "Size: —",
                            cost: entry.cost
                              ? formatCurrencyInput(entry.cost)
                              : "—"
                          }))
                        }))}
                        totalValue={formatCurrencyInput(
                          selectedProductReceipt.total.toFixed(2)
                        )}
                        classes={{
                          root: styles.productReceipt,
                          header: styles.productReceiptHeader,
                          title: styles.productReceiptTitle,
                          date: styles.productReceiptDate,
                          group: styles.productReceiptGroup,
                          groupLabel: styles.productReceiptBrand,
                          items: styles.productReceiptItems,
                          item: styles.productReceiptItem,
                          itemName: styles.productReceiptName,
                          itemMeta: styles.productReceiptMeta,
                          itemCost: styles.productReceiptCost,
                          total: styles.productReceiptTotal
                        }}
                      />
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
              <Tabs
                as="nav"
                className={styles.sectionTabs}
                value={activeTab}
                onChange={handleWorkspaceTabSelect}
                tabs={WORKSPACE_TABS}
              />
              <div className={styles.sectionHeaderActions}>
                <Button
                  type="button"
                  onClick={openPhotoUploadModal}
                  disabled={!selectedClientId}
                >
                  Upload Photos
                </Button>
              </div>
            </div>
            <div className={styles.photoCompareHeader}>
              <TogglePill
                className={styles.photoCompareToggle}
                buttonClassName={styles.photoCompareToggleButton}
                buttonActiveClassName={styles.photoCompareToggleButtonActive}
                items={PHOTO_COMPARE_OPTIONS}
                value={comparePickMode}
                onChange={setComparePickMode}
              />
            </div>
            {!selectedClientId && (
              <Notice>Select a client to view photos.</Notice>
            )}
            {selectedClientId && (
              <>
                <Modal
                  open={isPhotoUploadOpen}
                  title="Upload Photos"
                  onClose={closePhotoUploadModal}
                  portalTarget={portalTarget}
                  className={styles.uploadModal}
                >
                  <div className={styles.modalSection}>
                    <Notice>
                      {clientForm.full_name
                        ? `For ${clientForm.full_name}`
                        : "Select a client to upload."}
                    </Notice>
                  </div>

                  <div className={styles.modalSection}>
                    <Field label="Appointment">
                      <SelectMenu
                        value={photoUploadAppointmentId}
                        placeholder="Select appointment"
                        options={[
                          ...sortedAppointments.map((appt) => ({
                            value: String(appt.id),
                            label: `${appt.date} - ${appt.type}`
                          }))
                        ]}
                        onChange={setPhotoUploadAppointmentId}
                      />
                    </Field>
                  </div>

                  <Tabs
                    className={styles.overviewTabs}
                    value={photoUploadMode}
                    onChange={handlePhotoModeChange}
                    tabs={UPLOAD_TABS}
                  />

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
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={openPhotoLocalPicker}
                          >
                            Choose Files
                          </Button>
                          <Notice as="span">
                            {photoUploadFiles?.length
                              ? `${photoUploadFiles.length} file${
                                  photoUploadFiles.length === 1 ? "" : "s"
                                } selected`
                              : "No files selected."}
                          </Notice>
                        </div>
                        <ButtonRow>
                          <Button
                            type="button"
                            onClick={() => void handlePhotoUpload()}
                            disabled={
                              !photoUploadFiles?.length ||
                              !photoUploadAppointmentId
                            }
                          >
                            Upload Photos
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={closePhotoUploadModal}
                            className={styles.cancelButton}
                          >
                            Cancel
                          </Button>
                        </ButtonRow>
                      </div>
                    </div>
                  )}

                  {photoUploadMode === "qr" && (
                    <div className={styles.modalSection}>
                      <div className={styles.qrPanel}>
                        <div className={styles.qrHeader}>
                          <h3>Photo QR Upload</h3>
                          {photoQrLoading && (
                            <Notice as="span">Generating...</Notice>
                          )}
                        </div>
                        {!photoUploadAppointmentId && (
                          <Notice>
                            Select an appointment to generate a QR code.
                          </Notice>
                        )}
                        {photoQrDataUrl && (
                          <div className={styles.qrContent}>
                            <img
                              className={styles.qrImage}
                              src={photoQrDataUrl}
                              alt="Photo upload QR code"
                            />
                            {photoQrUrl && (
                              <div className={styles.qrUrl}>{photoQrUrl}</div>
                            )}
                          </div>
                        )}
                      </div>
                      <ButtonRow>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={closePhotoUploadModal}
                          className={styles.cancelButton}
                        >
                          Cancel
                        </Button>
                      </ButtonRow>
                    </div>
                  )}
                </Modal>

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
                              <Button
                                variant="secondary"
                                type="button"
                                onClick={() => handlePhotoCommentEdit("before")}
                              >
                                Edit
                              </Button>
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
                              <ButtonRow>
                                <Button
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
                                </Button>
                                <Button
                                  variant="secondary"
                                  type="button"
                                  onClick={() => handlePhotoCommentCancel("before")}
                                  className={styles.cancelButton}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  className={styles.buttonRowEnd}
                                  danger
                                  type="button"
                                  onClick={() =>
                                    openConfirmDialog({
                                      title: "Delete Photo",
                                      message: "Delete this photo?",
                                      confirmLabel: "Delete",
                                      confirmDanger: true,
                                      onConfirm: () =>
                                        handlePhotoDelete(compareBeforePhoto)
                                    })
                                  }
                                >
                                  Delete Photo
                                </Button>
                              </ButtonRow>
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
                              <Button
                                variant="secondary"
                                type="button"
                                onClick={() => handlePhotoCommentEdit("after")}
                              >
                                Edit
                              </Button>
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
                              <ButtonRow>
                                <Button
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
                                </Button>
                                <Button
                                  variant="secondary"
                                  type="button"
                                  onClick={() => handlePhotoCommentCancel("after")}
                                  className={styles.cancelButton}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  className={styles.buttonRowEnd}
                                  danger
                                  type="button"
                                  onClick={() =>
                                    openConfirmDialog({
                                      title: "Delete Photo",
                                      message: "Delete this photo?",
                                      confirmLabel: "Delete",
                                      confirmDanger: true,
                                      onConfirm: () =>
                                        handlePhotoDelete(compareAfterPhoto)
                                    })
                                  }
                                >
                                  Delete Photo
                                </Button>
                              </ButtonRow>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {loadingPhotos && <Notice>Loading photos...</Notice>}
                {!loadingPhotos && photos.length === 0 && (
                  <Notice>No photos yet.</Notice>
                )}

                {photos.length > 0 && (
                  <div className={styles.photosGrid}>
                    {visiblePhotos.map((photo) => {
                      const isBefore = compareBeforeId === photo.id;
                      const isAfter = compareAfterId === photo.id;
                      return (
                        <ListRowButton
                          key={photo.id}
                          type="button"
                          baseClassName={styles.photoCard}
                          selected={selectedPhotoId === photo.id}
                          selectedClassName={styles.photoCardSelected}
                          className={[
                            isBefore ? styles.photoCardBefore : "",
                            isAfter ? styles.photoCardAfter : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
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
                        </ListRowButton>
                      );
                    })}
                  </div>
                )}

                {photos.length > photoVisibleCount && (
                  <div
                    className={`${styles.photoUploadFooter} ${styles.photoLoadMoreFooter}`}
                  >
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={handleLoadMorePhotos}
                    >
                      Load More
                    </Button>
                  </div>
                )}

              </>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <Tabs
                as="nav"
                className={styles.sectionTabs}
                value={activeTab}
                onChange={handleWorkspaceTabSelect}
                tabs={WORKSPACE_TABS}
              />
              {selectedClientId && (
                <div className={styles.headerActions}>
                    {(isNoteFormOpen || editingNoteId !== null) && (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={handleNotesHighlight}
                        className={styles.highlightButton}
                      >
                        Highlight
                      </Button>
                    )}
                  <Button
                    type={isNoteFormOpen ? "submit" : "button"}
                    form={isNoteFormOpen ? "note-create-form" : undefined}
                    disabled={editingNoteId !== null}
                    onClick={() => {
                      if (!isNoteFormOpen) {
                        handleNoteFormToggle();
                      }
                    }}
                  >
                    {isNoteFormOpen ? "Save Note" : "Add Note"}
                  </Button>
                  {isNoteFormOpen && (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => notesGuard.requestExit(handleNoteFormCancel)}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
            {!selectedClientId && (
              <Notice>Select a client to add notes.</Notice>
            )}
            {selectedClientId && (
              <div className={styles.notesLayout}>
                {isNoteFormOpen && (
                  <form
                    id="note-create-form"
                    className={styles.notesForm}
                    onSubmit={handleNoteCreate}
                  >
                    <CloseButton
                      className={styles.notesCreateClose}
                      onClick={() => notesGuard.requestExit(handleNoteFormCancel)}
                      aria-label="Cancel new note"
                      title="Cancel"
                    />
                    <div className={styles.notesRow}>
                      <Field label="Date last seen">
                        <input
                          className={styles.input}
                          name="date_seen"
                          placeholder="MM/DD/YYYY"
                          inputMode="numeric"
                          value={noteDraft.date_seen}
                          onChange={handleNoteDraftChange}
                        />
                      </Field>
                      <Field label="Notes">
                        <HighlightTextarea
                          value={noteDraft.notes}
                          placeholder="Add appointment notes..."
                          onChange={handleNoteDraftNotesChange}
                          onFocus={() => setNotesHighlightTarget({ kind: "draft" })}
                          textareaClassName={styles.notesTextarea}
                          textareaProps={{ id: "note-draft", name: "notes" }}
                        />
                      </Field>
                      <Field as="div" className={styles.notesDoneField} label="Done">
                        <label className={styles.notesDoneToggle}>
                          <input type="checkbox" disabled />
                        </label>
                      </Field>
                    </div>
                  </form>
                )}

                {loadingNotes && <Notice>Loading notes...</Notice>}
                {!loadingNotes && sortedNotes.length === 0 && (
                  <Notice>No notes yet.</Notice>
                )}
                {!loadingNotes && sortedNotes.length > 0 && (
                  <List as="div" className={styles.notesList}>
                    {sortedNotes.map((note) => {
                      const isDone = Boolean(note.done_at);
                      const isEditing = editingNoteId === note.id;
                      const isUnlocked = unlockedNoteIds[note.id] ?? false;
                      const doneLocked = isDone && !isUnlocked;
                      return (
                        <ListRow
                          key={note.id}
                          as="div"
                          className={`${styles.notesItem} ${
                            isEditing ? styles.notesItemEditing : ""
                          }`}
                        >
                          {isEditing ? (
                            <div className={`${styles.notesRow} ${styles.notesRowEditing}`}>
                              <CloseButton
                                className={styles.notesEditClose}
                                onClick={() =>
                                  notesGuard.requestExit(() =>
                                    handleNoteEditCancel(note.id)
                                  )
                                }
                                aria-label="Cancel note edit"
                                title="Cancel"
                              />
                              <Field label="Date last seen">
                                <input
                                  className={styles.input}
                                  name="date_seen"
                                  placeholder="MM/DD/YYYY"
                                  inputMode="numeric"
                                  value={note.date_seen}
                                  onChange={(event) =>
                                    handleNoteFieldChange(
                                      note.id,
                                      "date_seen",
                                      event.target.value
                                    )
                                  }
                                />
                              </Field>
                              <Field label="Notes">
                                <HighlightTextarea
                                  value={note.notes}
                                  placeholder="Add appointment notes..."
                                  onChange={(value) =>
                                    handleNoteFieldChange(note.id, "notes", value)
                                  }
                                  onFocus={() =>
                                    setNotesHighlightTarget({
                                      kind: "note",
                                      noteId: note.id
                                    })
                                  }
                                  textareaClassName={styles.notesTextarea}
                                  textareaProps={{
                                    id: `note-${note.id}`,
                                    name: "notes"
                                  }}
                                />
                              </Field>
                              <Field as="div" className={styles.notesDoneField} label="Done">
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
                              </Field>
                            </div>
                          ) : (
                            <div className={styles.notesView}>
                              <div className={styles.notesViewRow}>
                                <div className={styles.notesViewBlock}>
                                  <div className={styles.notesViewLabel}>
                                    Date last seen
                                  </div>
                                  <div className={styles.notesViewValue}>
                                    {note.date_seen || "—"}
                                  </div>
                                </div>
                                <div className={styles.notesViewBlock}>
                                  <div className={styles.notesViewLabel}>Notes</div>
                                  <div className={styles.notesViewText}>
                                    {renderHighlightedValue(
                                      formatCompactValue(note.notes ?? "")
                                    )}
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
                          )}
                          {!isNoteFormOpen && (
                            <div className={styles.notesActions}>
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() => handleNoteSave(note)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() =>
                                      notesGuard.requestExit(() =>
                                        handleNoteEditCancel(note.id)
                                      )
                                    }
                                    className={styles.cancelButton}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="secondary"
                                  type="button"
                                  onClick={() => handleNoteEdit(note.id)}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                danger
                                type="button"
                                onClick={() =>
                                  openConfirmDialog({
                                    title: "Delete Note",
                                    message: "Delete this note?",
                                    confirmLabel: "Delete",
                                    confirmDanger: true,
                                    onConfirm: () => handleNoteDelete(note)
                                  })
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </ListRow>
                      );
                    })}
                  </List>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "prescriptions" && (
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <Tabs
                as="nav"
                className={styles.sectionTabs}
                value={activeTab}
                onChange={handleWorkspaceTabSelect}
                tabs={WORKSPACE_TABS}
              />
            </div>
            {!selectedClientId && (
              <Notice>Select a client to manage prescriptions.</Notice>
            )}
            {selectedClientId && (
              <div
                className={[
                  styles.prescriptionsLayout,
                  isPrescriptionEditing ? styles.prescriptionsLayoutEditing : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {!isPrescriptionEditing && (
                  <div className={styles.prescriptionsList}>
                  <div className={styles.headerRow}>
                    <h3>Saved Prescriptions</h3>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => handlePrescriptionNew()}
                    >
                      New
                    </Button>
                  </div>
                  {loadingPrescriptions && (
                    <Notice>Loading prescriptions...</Notice>
                  )}
                  {!loadingPrescriptions && prescriptions.length === 0 && (
                    <Notice>No prescriptions yet.</Notice>
                  )}
                  <List className={styles.prescriptionList}>
                    {prescriptions.map((prescription) => (
                      <ListRow
                        key={prescription.id}
                        className={styles.prescriptionItem}
                        selected={selectedPrescriptionId === prescription.id}
                        selectedClassName={styles.prescriptionItemSelected}
                        active={Boolean(prescription.is_current)}
                        activeClassName={styles.prescriptionItemCurrent}
                        onClick={() => handlePrescriptionSelect(prescription)}
                        onDoubleClick={() => handlePrescriptionOpenFile(prescription)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handlePrescriptionSelect(prescription);
                          }
                        }}
                      >
                        <div className={styles.prescriptionItemHeader}>
                          <div className={styles.clientItemName}>
                            {prescription.start_date ?? "Unknown"}
                          </div>
                          {prescription.is_current ? (
                            <Badge baseClassName={styles.prescriptionCurrentBadge}>
                              Current
                            </Badge>
                          ) : null}
                        </div>
                        <Notice as="div">
                          {prescription.form_type ?? "Unknown"}
                        </Notice>
                      </ListRow>
                    ))}
                  </List>
                  {selectedPrescription && (
                    <>
                      <ButtonRow>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => {
                            prescriptionEditSnapshotRef.current =
                              serializePrescriptionDraft(
                                prescriptionDraft,
                                prescriptionColumnCount
                              );
                            setIsPrescriptionEditing(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => setIsCopyPanelOpen(true)}
                        >
                          Copy
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={openPrescriptionShareModal}
                        >
                          Send
                        </Button>
                        {!isCurrentPrescription && (
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={handlePrescriptionMarkCurrent}
                          >
                            Mark
                          </Button>
                        )}
                      </ButtonRow>
                    </>
                  )}
                  <div className={`${styles.templatePanel} ${styles.templatePanelSeparated}`}>
                    <span className={styles.label}>Templates</span>
                    <form
                      className={styles.templateRow}
                      onSubmit={handleTemplateSave}
                    >
                      <input
                        className={`${styles.input} ${styles.templateNameInput}`}
                        placeholder="Template name"
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                        disabled={!canSaveTemplate}
                      />
                      <Button
                        variant="secondary"
                        type="submit"
                        disabled={!canSaveTemplate}
                      >
                        Save Template
                      </Button>
                    </form>
                    <div className={styles.templateSelectRow}>
                      <SelectMenu
                        value={selectedTemplateId}
                        placeholder="Select template"
                        options={prescriptionTemplates.map((template) => ({
                          value: template.id,
                          label: `${template.name} (${template.column_count} col)`
                        }))}
                        onChange={setSelectedTemplateId}
                      />
                      {hasSelectedTemplate && (
                        <ButtonRow className={styles.templateActionsRow}>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => handleTemplateApply()}
                          >
                            New From Template
                          </Button>
                          <Button
                            variant="secondary"
                            danger
                            type="button"
                            onClick={() => {
                              openConfirmDialog({
                                title: "Delete Template",
                                message: "Delete this template?",
                                confirmLabel: "Delete",
                                confirmDanger: true,
                                onConfirm: handleTemplateDelete
                              });
                            }}
                          >
                            Delete
                          </Button>
                        </ButtonRow>
                      )}
                    </div>
                  </div>
                  {selectedPrescription && isCopyPanelOpen && (
                    <div
                      ref={copyPanelRef}
                      className={`${styles.copyPanel} ${styles.templatePanelSeparated}`}
                      onBlurCapture={handleCopyPanelBlur}
                    >
                      <span className={styles.label}>Copy To Client</span>
                      <div className={styles.copyRow}>
                        <div className={styles.copyColumn}>
                          <div className={styles.referredByField}>
                            {selectedCopyClient ? (
                              <div className={styles.referredByTags}>
                                <span className={styles.referredByTag}>
                                  <span className={styles.referredByTagLabel}>
                                    {selectedCopyClient.full_name}
                                  </span>
                                  <button
                                    className={styles.referredByTagRemove}
                                    type="button"
                                    onClick={handleCopyClientClear}
                                    aria-label="Remove client"
                                    title="Remove client"
                                  >
                                    X
                                  </button>
                                </span>
                              </div>
                            ) : null}
                            {!selectedCopyClient && (
                              <>
                                <input
                                  ref={copyInputRef}
                                  className={styles.input}
                                  placeholder="Search client name"
                                  value={copyClientQuery}
                                  onChange={handleCopyClientChange}
                                  autoComplete="off"
                                  onKeyDown={(event) => {
                                    if (handleCopyClientKeyDown(event)) {
                                      return;
                                    }
                                  }}
                                />
                                <SearchMenu
                                  show={hasCopyClientQuery}
                                  items={copyClientMatches}
                                  emptyMessage="No results"
                                  activeIndex={copyClientActiveIndex}
                                  onActiveIndexChange={setCopyClientActiveIndex}
                                  selectedId={null}
                                  getKey={(client) => client.id}
                                  getLabel={(client) => client.full_name}
                                  getMeta={(client) => client.primary_phone ?? ""}
                                  onSelect={handleCopyClientSelect}
                                  containerClassName={styles.referredByResults}
                                  listClassName={styles.referredByList}
                                  itemClassName={styles.referredByItem}
                                  itemSelectedClassName={styles.referredByItemSelected}
                                  itemActiveClassName={styles.referredByItemActive}
                                  labelClassName={styles.referredByName}
                                  metaClassName={styles.referredByMeta}
                                  emptyClassName={styles.referredByEmpty}
                                  labelElement="span"
                                  metaElement="span"
                                />
                              </>
                            )}
                          </div>
                        </div>
                        {copyTargetClientId && (
                          <>
                            <input
                              className={styles.input}
                              placeholder="MM/DD/YYYY"
                              value={copyStartDate}
                              onChange={(event) => setCopyStartDate(event.target.value)}
                            />
                            <Button
                              className={styles.copyActionButton}
                              variant="secondary"
                              type="button"
                              onClick={handlePrescriptionCopy}
                            >
                              Copy
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                )}

                <div
                  ref={prescriptionEditorRef}
                  className={[
                    styles.prescriptionsEditor,
                    isPrescriptionEditing ? styles.prescriptionsEditorFull : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {isPrescriptionEditing ? (
                    <form
                      className={styles.prescriptionEditForm}
                      onSubmit={handlePrescriptionSave}
                    >
                      <CloseButton
                        className={styles.prescriptionEditClose}
                        onClick={handlePrescriptionCancel}
                        aria-label="Cancel prescription edit"
                        title="Cancel"
                      />
                      <div className={styles.formGrid}>
                        <Field label="Start Date">
                          <input
                            className={styles.input}
                            name="start_date"
                            placeholder="MM/DD/YYYY"
                            value={prescriptionDraft.start_date}
                            onChange={handlePrescriptionStartDateChange}
                          />
                        </Field>
                        <Field label="Columns">
                          <SelectMenu
                            value={String(prescriptionColumnCount)}
                            options={[
                              { value: "2", label: "2 Columns" },
                              { value: "3", label: "3 Columns" },
                              { value: "4", label: "4 Columns" }
                            ]}
                            onChange={(value) =>
                              handlePrescriptionColumnCountChange(Number(value))
                            }
                          />
                        </Field>
                      </div>

                    <ButtonRow>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={handlePrescriptionAddRow}
                      >
                        Add Row
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={handlePrescriptionRemoveRow}
                      >
                        Remove Row
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={handlePrescriptionHighlight}
                        className={styles.highlightButton}
                      >
                        Highlight
                      </Button>
                    </ButtonRow>

                      <div className={styles.prescriptionFinalLayout}>
                        <div
                          className={styles.prescriptionFinalHeaderRow}
                          style={{
                            gridTemplateColumns: `24px repeat(${prescriptionColumnCount}, minmax(0, 1fr))`
                          }}
                        >
                          <div className={styles.prescriptionFinalHeaderLabel}>
                            <span
                              className={styles.prescriptionFinalStackedLabel}
                              aria-label="Header"
                            >
                              {stackLabel("HEADER")}
                            </span>
                          </div>
                          {prescriptionDraft.columns.map((column, colIndex) => (
                            <div
                              className={styles.prescriptionFinalHeaderCell}
                              key={`header-${colIndex}`}
                            >
                              <input
                                className={styles.input}
                                value={column.header}
                                placeholder="Header line 1"
                                maxLength={PRESCRIPTION_HEADER_MAX_LENGTH}
                                onChange={(event) =>
                                  handlePrescriptionHeaderChange(
                                    colIndex,
                                    "header",
                                    event.target.value
                                  )
                                }
                              />
                              <input
                                className={styles.input}
                                value={column.header2}
                                placeholder="Header line 2"
                                maxLength={PRESCRIPTION_HEADER_MAX_LENGTH}
                                onChange={(event) =>
                                  handlePrescriptionHeaderChange(
                                    colIndex,
                                    "header2",
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          ))}
                        </div>

                        {Array.from(
                          {
                            length: Math.max(
                              1,
                              ...prescriptionDraft.columns.map(
                                (column) => column.rows.length
                              )
                            )
                          },
                          (_, rowIndex) => rowIndex
                        ).map((rowIndex) => (
                          <div
                            className={styles.prescriptionFinalRow}
                            key={`row-${rowIndex}`}
                            style={{
                              gridTemplateColumns: `24px repeat(${prescriptionColumnCount}, minmax(0, 1fr))`
                            }}
                          >
                            <div className={styles.prescriptionFinalStepLabel}>
                              <span
                                className={styles.prescriptionFinalStackedLabel}
                                aria-label={`Step ${rowIndex + 1}`}
                              >
                                {stackStepLabel(rowIndex + 1)}
                              </span>
                            </div>
                            {prescriptionDraft.columns.map((column, colIndex) => {
                              const row = column.rows[rowIndex] ?? {
                                product: "",
                                directions: ""
                              };
                              return (
                                <div
                                  className={styles.prescriptionFinalCell}
                                  key={`cell-${colIndex}-${rowIndex}`}
                                >
                                  <textarea
                                    className={`${styles.textarea} ${styles.prescriptionProductTextarea}`}
                                    data-prescription-row="product"
                                    data-row-index={rowIndex}
                                    data-col-index={colIndex}
                                    placeholder="Product"
                                    maxLength={getPrescriptionProductMaxLength(
                                      prescriptionColumnCount
                                    )}
                                    value={row.product}
                                    onChange={(event) =>
                                      handlePrescriptionRowChange(
                                        colIndex,
                                        rowIndex,
                                        "product",
                                        event.target.value
                                      )
                                    }
                                    rows={
                                      (row.product ?? "").length >
                                      getPrescriptionProductWrapThreshold(
                                        prescriptionColumnCount
                                      )
                                        ? 2
                                        : 1
                                    }
                                  />
                                  <HighlightTextarea
                                    value={row.directions ?? ""}
                                    placeholder="Directions"
                                    onChange={(nextValue) =>
                                      handlePrescriptionDirectionsChange(
                                        colIndex,
                                        rowIndex,
                                        nextValue
                                      )
                                    }
                                    onFocus={() =>
                                      setHighlightTarget({ colIndex, rowIndex })
                                    }
                                    textareaProps={{
                                      id: `dir-${colIndex}-${rowIndex}`,
                                      "data-prescription-row": "direction",
                                      "data-row-index": rowIndex,
                                      "data-col-index": colIndex
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      <ButtonRow>
                        <Button type="submit">
                          {selectedPrescriptionId
                            ? "Save Prescription"
                            : "Create Prescription"}
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={handlePrescriptionCancel}
                          className={styles.cancelButton}
                        >
                          Cancel
                        </Button>
                        {selectedPrescriptionId && (
                          <Button
                            className={styles.buttonRowEnd}
                            danger
                            type="button"
                            onClick={() =>
                              openConfirmDialog({
                                title: "Delete Prescription",
                                message: "Delete this prescription?",
                                confirmLabel: "Delete",
                                confirmDanger: true,
                                onConfirm: handlePrescriptionDelete
                              })
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </ButtonRow>
                    </form>
                  ) : prescriptionPreviewUrl ? (
                    <div className={styles.prescriptionPreview}>
                      <iframe
                        title="Prescription Preview"
                        src={prescriptionPreviewUrl}
                      />
                    </div>
                  ) : (
                    <Notice>Select a prescription to preview.</Notice>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel}
        confirmDanger={confirmDialog?.confirmDanger}
        onCancel={handleConfirmDialogCancel}
        onConfirm={handleConfirmDialogConfirm}
        portalTarget={portalTarget}
      />

      <Modal
        open={isPrescriptionExitPromptOpen}
        title="Unsaved Prescription"
        onClose={handlePrescriptionExitStay}
        portalTarget={portalTarget}
        className={styles.confirmModal}
      >
        <Notice>Would you like to save before exiting?</Notice>
        <ButtonRow>
          <Button type="button" onClick={handlePrescriptionExitSave}>
            Save and Exit
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={handlePrescriptionExitDiscard}
            className={styles.cancelButton}
          >
            Exit without Saving
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={handlePrescriptionExitStay}
          >
            Keep Editing
          </Button>
        </ButtonRow>
      </Modal>

      <UnsavedChangesPrompt
        open={overviewGuard.prompt.open}
        onDiscard={overviewGuard.prompt.onDiscard}
        onSave={overviewGuard.prompt.onSave}
        onStay={overviewGuard.prompt.onStay}
      />
      <UnsavedChangesPrompt
        open={appointmentGuard.prompt.open}
        onDiscard={appointmentGuard.prompt.onDiscard}
        onSave={appointmentGuard.prompt.onSave}
        onStay={appointmentGuard.prompt.onStay}
      />
      <UnsavedChangesPrompt
        open={productGuard.prompt.open}
        onDiscard={productGuard.prompt.onDiscard}
        onSave={productGuard.prompt.onSave}
        onStay={productGuard.prompt.onStay}
      />
      <UnsavedChangesPrompt
        open={notesGuard.prompt.open}
        onDiscard={notesGuard.prompt.onDiscard}
        onSave={notesGuard.prompt.onSave}
        onStay={notesGuard.prompt.onStay}
      />

      <UploadSuccessModal
        portalTarget={portalTarget}
        open={Boolean(uploadSuccess)}
        title="Upload Complete"
        message={uploadSuccessMessage}
        onConfirm={handleUploadSuccessAcknowledge}
      />

      {printUrl && (
        <iframe
          ref={printFrameRef}
          className={styles.printFrame}
          title="Print Prescription"
          src={printUrl}
          onLoad={handlePrintFrameLoad}
        />
      )}

      <Modal
        open={isPrescriptionShareOpen}
        title="Send Prescription to Phone"
        onClose={closePrescriptionShareModal}
        portalTarget={portalTarget}
        className={styles.uploadModal}
      >
        <div className={styles.modalSection}>
          {prescriptionShareLoading && <Notice>Generating QR code...</Notice>}
          {!prescriptionShareLoading && prescriptionShareQrDataUrl && (
            <div className={styles.qrPanel}>
              <div className={styles.qrHeader}>
                <h3>Prescription Download</h3>
              </div>
              <div className={styles.qrContent}>
                <img
                  className={styles.qrImage}
                  src={prescriptionShareQrDataUrl}
                  alt="Prescription download QR code"
                />
                {prescriptionShareUrl && (
                  <div className={styles.qrUrl}>{prescriptionShareUrl}</div>
                )}
              </div>
              <Notice>
                Link expires in 10 minutes and can only be used once.
              </Notice>
            </div>
          )}
        </div>
        <ButtonRow>
          <Button
            variant="secondary"
            type="button"
            className={styles.cancelButton}
            onClick={closePrescriptionShareModal}
          >
            Cancel
          </Button>
        </ButtonRow>
      </Modal>

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

      {status && <StatusMessage>{status}</StatusMessage>}
      {error && <StatusMessage>Error: {error}</StatusMessage>}
    </div>
  );
}
