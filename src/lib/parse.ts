export const parseMmddyyyy = (value: string): number => {
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) {
    return 0;
  }
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const parseDateParts = (value: string) => {
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

export const parseCurrencyValue = (value?: string | null) => {
  if (!value) {
    return 0;
  }
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) {
    return 0;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseMonthDay = (value: string): { month: number; day: number } | null => {
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
