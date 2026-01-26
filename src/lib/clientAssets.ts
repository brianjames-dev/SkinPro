import fs from "fs";
import path from "path";
import { loadSkinproPaths } from "./skinproPaths";

type DeleteResult = {
  deleted: string[];
  missing: string[];
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
  const result: DeleteResult = { deleted: [], missing: [] };

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

  const deletePath = (target: string) => {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      result.deleted.push(target);
    } else {
      result.missing.push(target);
    }
  };

  if (profilePicturePath) {
    deletePath(profilePicturePath);
  }

  deletePath(imageFolder);
  deletePath(prescriptionsFolder);

  return result;
}
