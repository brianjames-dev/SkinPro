import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const resolveDbPath = () => {
  const envDataDir = process.env.SKINPRO_DATA_DIR?.trim();
  const pointerPath = path.join(os.homedir(), ".skinpro_config_location.json");
  let dataDir = envDataDir || "";

  if (!dataDir) {
    if (!fs.existsSync(pointerPath)) {
      throw new Error(`SkinPro pointer file not found: ${pointerPath}`);
    }
    const pointer = readJson(pointerPath);
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
    const config = readJson(configPath);
    if (config.data_dir && config.data_dir !== dataDir) {
      dataDir = config.data_dir;
    }
  }

  const pathsPath = path.join(dataDir, "paths.json");
  if (fs.existsSync(pathsPath)) {
    const paths = readJson(pathsPath);
    if (paths.database) {
      return paths.database;
    }
  }

  return path.join(dataDir, "skinpro.db");
};

const splitAddress = (raw) => {
  const trimmed = raw.trim();
  const match = trimmed.match(/\s+(Apt|Unit)\s+(.+)$/);
  if (!match) {
    return { address1: trimmed, address2: "" };
  }
  const address1 = trimmed.slice(0, match.index).trim();
  return { address1, address2: `${match[1]} ${match[2].trim()}` };
};

const mockClients = [
  {
    full_name: "Ava Martinez",
    gender: "Female",
    birthdate: "05/17/1986",
    primary_phone: "(707) 555-1290",
    email: "ava.martinez86@gmail.com",
    address: "842 Maple Grove Rd Apt 2C"
  },
  {
    full_name: "Michael Thompson",
    gender: "Male",
    birthdate: "11/03/1979",
    primary_phone: "707-555-8710",
    email: "mike.t.thompson79@yahoo.com",
    address: "3920 Lakeview Ave"
  },
  {
    full_name: "Emma Collins",
    gender: "Female",
    birthdate: "08/22/1985",
    primary_phone: "(707) 555-3399",
    email: "emma.c85@gmail.com",
    address: "215 Westview Ct Apt 5B"
  },
  {
    full_name: "Liam Foster",
    gender: "Male",
    birthdate: "01/14/1990",
    primary_phone: "(707) 555-7711",
    email: "liam.foster90@outlook.com",
    address: "1440 Creekside Dr"
  },
  {
    full_name: "Sophia Turner",
    gender: "Female",
    birthdate: "03/03/1993",
    primary_phone: "(707) 555-0056",
    email: "sophia.t@email.com",
    address: "18 Redwood Cir"
  },
  {
    full_name: "Ethan Brooks",
    gender: "Male",
    birthdate: "06/27/1982",
    primary_phone: "(707) 555-6868",
    email: "ethan.b82@yahoo.com",
    address: "900 Forest Lane"
  },
  {
    full_name: "Isabella Ruiz",
    gender: "Female",
    birthdate: "10/19/1996",
    primary_phone: "(707) 555-2432",
    email: "isaruiz96@gmail.com",
    address: "72 Sunrise Blvd Unit A"
  },
  {
    full_name: "Noah Bennett",
    gender: "Male",
    birthdate: "12/05/1975",
    primary_phone: "(707) 555-1920",
    email: "nbennett75@mail.com",
    address: "320 Orchard Ave"
  },
  {
    full_name: "Mia Sanders",
    gender: "Female",
    birthdate: "04/30/1988",
    primary_phone: "(707) 555-9982",
    email: "mia.sanders88@gmail.com",
    address: "51 Windsor Way Apt 10"
  },
  {
    full_name: "Logan Price",
    gender: "Male",
    birthdate: "07/12/1991",
    primary_phone: "(707) 555-3450",
    email: "logan.p91@aol.com",
    address: "709 Eastside St"
  },
  {
    full_name: "Olivia Chen",
    gender: "Female",
    birthdate: "11/29/1999",
    primary_phone: "(707) 555-7283",
    email: "o.chen99@live.com",
    address: "67 Sonoma Dr Apt 3C"
  },
  {
    full_name: "Caleb Morgan",
    gender: "Male",
    birthdate: "02/18/1984",
    primary_phone: "(707) 555-1478",
    email: "caleb.m84@yahoo.com",
    address: "832 Benton Ave"
  },
  {
    full_name: "Lucas Rivera",
    gender: "Male",
    birthdate: "02/26/1980",
    primary_phone: "(707) 555-1166",
    email: "lucas.rivera80@mail.com",
    address: "125 Hilltop Dr"
  },
  {
    full_name: "Grace Murphy",
    gender: "Female",
    birthdate: "06/14/1992",
    primary_phone: "(707) 555-5523",
    email: "grace.m92@yahoo.com",
    address: "220 Willow Way"
  },
  {
    full_name: "Elijah Kim",
    gender: "Male",
    birthdate: "01/30/1989",
    primary_phone: "(707) 555-8800",
    email: "e.kim89@outlook.com",
    address: "321 Highland Ave Unit B"
  },
  {
    full_name: "Harper Nguyen",
    gender: "Female",
    birthdate: "07/06/1995",
    primary_phone: "(707) 555-6149",
    email: "harper.n95@gmail.com",
    address: "410 Springbrook Ct"
  },
  {
    full_name: "Benjamin Scott",
    gender: "Male",
    birthdate: "03/08/1983",
    primary_phone: "(707) 555-4021",
    email: "ben.scott83@live.com",
    address: "1370 Maple Hill Rd"
  },
  {
    full_name: "Lily Anderson",
    gender: "Female",
    birthdate: "10/25/1990",
    primary_phone: "(707) 555-7392",
    email: "lily.anderson90@mail.com",
    address: "289 Riverbend Dr Apt 2A"
  },
  {
    full_name: "Mason Carter",
    gender: "Male",
    birthdate: "05/05/1986",
    primary_phone: "(707) 555-7777",
    email: "mason.carter86@gmail.com",
    address: "753 Country Club Blvd"
  },
  {
    full_name: "Ella Brooks",
    gender: "Female",
    birthdate: "12/02/1998",
    primary_phone: "(707) 555-9132",
    email: "ella.brooks98@gmail.com",
    address: "623 Valley View Ln"
  },
  {
    full_name: "Jack Lewis",
    gender: "Male",
    birthdate: "04/17/1994",
    primary_phone: "(707) 555-3608",
    email: "jack.lewis94@mail.com",
    address: "92 Pinecone Ct Apt C"
  },
  {
    full_name: "Natalie Simmons",
    gender: "Female",
    birthdate: "08/08/1991",
    primary_phone: "(707) 555-6411",
    email: "natalie.simmons91@gmail.com",
    address: "1842 Bay Laurel Dr"
  }
];

const dbPath = resolveDbPath();
const db = new Database(dbPath);

const findExisting = db.prepare(
  "SELECT id FROM clients WHERE lower(email) = ? OR lower(full_name) = ?"
);
const insertClient = db.prepare(
  "INSERT INTO clients (full_name, gender, birthdate, primary_phone, " +
    "secondary_phone, email, address1, address2, city, state, zip, " +
    "referred_by, profile_picture) " +
    "VALUES (@full_name, @gender, @birthdate, @primary_phone, " +
    "@secondary_phone, @email, @address1, @address2, @city, @state, @zip, " +
    "@referred_by, @profile_picture)"
);

const inserted = [];
const skipped = [];

for (const client of mockClients) {
  const emailLower = client.email.toLowerCase();
  const nameLower = client.full_name.toLowerCase();
  const existing = findExisting.get(emailLower, nameLower);

  if (existing) {
    skipped.push(client.full_name);
    continue;
  }

  const { address1, address2 } = splitAddress(client.address);
  insertClient.run({
    full_name: client.full_name,
    gender: client.gender,
    birthdate: client.birthdate,
    primary_phone: client.primary_phone,
    secondary_phone: null,
    email: client.email,
    address1,
    address2: address2 || null,
    city: null,
    state: null,
    zip: null,
    referred_by: null,
    profile_picture: null
  });
  inserted.push(client.full_name);
}

console.log(`[seed] Database: ${dbPath}`);
console.log(`[seed] Inserted: ${inserted.length}`);
if (inserted.length) {
  console.log(`[seed] Added: ${inserted.join(", ")}`);
}
console.log(`[seed] Skipped (already present): ${skipped.length}`);
if (skipped.length) {
  console.log(`[seed] Skipped: ${skipped.join(", ")}`);
}
