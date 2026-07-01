import fs from "fs";
import path from "path";
import { isPathWithin } from "./fileUtils";
import { loadSkinproPaths } from "./skinproPaths";

type DeleteResult = {
  deleted: string[];
  missing: string[];
  skipped: string[];
};

export function safeClientName(fullName: string): string {
  return fullName
    .split("")
    .map((char) => (/^[A-Za-z0-9 _-]$/.test(char) ? char : "_"))
    .join("")
    .replace(/ /g, "_");
}

export function deleteClientAssets(args: {
  clientId: number;
  fullName: string;
  profilePicturePath?: string | null;
}): DeleteResult {
  const { clientId, fullName, profilePicturePath } = args;
  const result: DeleteResult = { deleted: [], missing: [], skipped: [] };

  if (!fullName || !clientId) {
    return result;
  }

  const paths = loadSkinproPaths();
  const safeName = safeClientName(fullName);

  const imageFolder = path.join(paths.photosDir, `${safeName}_id_${clientId}`);
  const prescriptionsFolder = path.join(
    paths.prescriptionsDir,
    `${safeName}_${clientId}`
  );

  const deletePath = (target: string, label: string) => {
    let resolved = target;
    try {
      if (fs.existsSync(target)) {
        resolved = fs.realpathSync(target);
      }
    } catch {
      result.skipped.push(target);
      return;
    }

    if (!isPathWithin(paths.dataDir, resolved) && !isPathWithin(paths.dataDir, target)) {
      console.warn(`[clientAssets] refused to delete path outside data dir (${label}):`, target);
      result.skipped.push(target);
      return;
    }

    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      result.deleted.push(target);
    } else {
      result.missing.push(target);
    }
  };

  if (profilePicturePath) {
    deletePath(profilePicturePath, "profile_picture");
  }

  deletePath(imageFolder, "photos");
  deletePath(prescriptionsFolder, "prescriptions");

  return result;
}
