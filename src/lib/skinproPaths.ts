import fs from "fs";
import os from "os";
import path from "path";

type PointerConfig = {
  data_dir?: string;
};

type DataConfig = {
  data_dir?: string;
};

type PathsConfig = {
  database?: string;
  photos?: string;
  profile_pictures?: string;
};

export type SkinproPaths = {
  dataDir: string;
  dbPath: string;
  photosDir: string;
  profilePicturesDir: string;
  prescriptionsDir: string;
  backupsDir: string;
};

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function loadSkinproPaths(): SkinproPaths {
  const envDataDir = process.env.SKINPRO_DATA_DIR?.trim();
  const pointerPath = path.join(os.homedir(), ".skinpro_config_location.json");

  let dataDir = envDataDir || "";

  if (!dataDir) {
    if (!fs.existsSync(pointerPath)) {
      throw new Error(`SkinPro pointer file not found: ${pointerPath}`);
    }
    const pointer = readJson<PointerConfig>(pointerPath);
    if (!pointer.data_dir) {
      throw new Error("SkinPro pointer file is missing data_dir");
    }
    dataDir = pointer.data_dir;
  }

  if (!fs.existsSync(dataDir)) {
    throw new Error(`SkinPro data directory not found: ${dataDir}`);
  }

  const configPath = path.join(dataDir, "config.json");
  if (fs.existsSync(configPath)) {
    const config = readJson<DataConfig>(configPath);
    if (config.data_dir && config.data_dir !== dataDir) {
      dataDir = config.data_dir;
    }
  }

  const pathsPath = path.join(dataDir, "paths.json");
  let paths: PathsConfig;

  if (fs.existsSync(pathsPath)) {
    paths = readJson<PathsConfig>(pathsPath);
  } else {
    paths = {
      database: path.join(dataDir, "skinpro.db"),
      photos: path.join(dataDir, "images"),
      profile_pictures: path.join(dataDir, "profile_pictures")
    };
    fs.writeFileSync(pathsPath, JSON.stringify(paths, null, 2));
  }

  const dbPath = paths.database ?? path.join(dataDir, "skinpro.db");
  const photosDir = paths.photos ?? path.join(dataDir, "images");
  const profilePicturesDir =
    paths.profile_pictures ?? path.join(dataDir, "profile_pictures");

  return {
    dataDir,
    dbPath,
    photosDir,
    profilePicturesDir,
    prescriptionsDir: path.join(dataDir, "prescriptions"),
    backupsDir: path.join(dataDir, "backups")
  };
}

export function getDbPath(): string {
  return loadSkinproPaths().dbPath;
}
