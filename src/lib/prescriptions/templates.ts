import fs from "fs";
import path from "path";
import { ensureDir } from "@/lib/fileUtils";
import { loadSkinproPaths } from "@/lib/skinproPaths";

export type PrescriptionTemplate = {
  id: string;
  name: string;
  column_count: number;
  steps: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type TemplatesFile = {
  templates: PrescriptionTemplate[];
};

const FILE_NAME = "templates.json";

function getTemplatesPath(): string {
  const paths = loadSkinproPaths();
  ensureDir(paths.prescriptionsDir);
  return path.join(paths.prescriptionsDir, FILE_NAME);
}

function readTemplatesFile(): TemplatesFile {
  const templatesPath = getTemplatesPath();
  if (!fs.existsSync(templatesPath)) {
    return { templates: [] };
  }
  const raw = fs.readFileSync(templatesPath, "utf8");
  try {
    const parsed = JSON.parse(raw) as TemplatesFile;
    if (!Array.isArray(parsed.templates)) {
      return { templates: [] };
    }
    return parsed;
  } catch {
    return { templates: [] };
  }
}

function writeTemplatesFile(payload: TemplatesFile) {
  const templatesPath = getTemplatesPath();
  fs.writeFileSync(templatesPath, JSON.stringify(payload, null, 2));
}

export function loadPrescriptionTemplates(): PrescriptionTemplate[] {
  return readTemplatesFile().templates;
}

export function savePrescriptionTemplates(templates: PrescriptionTemplate[]) {
  writeTemplatesFile({ templates });
}
