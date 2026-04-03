import mongoose from "mongoose";
import { createReadStream } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN  = process.argv.includes("--dry-run");
const TEST_RUN = process.argv.includes("--test-run");

function pf(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function heightToInches(h) {
  if (!h) return null;
  const match = String(h).match(/(\d+)-(\d+)/);
  if (match) return parseInt(match[1]) * 12 + parseInt(match[2]);
  return null;
}

function yearLabel(val) {
  const map = { Fr: "Fr", So: "So", Jr: "Jr", Sr: "Sr" };
  const trimmed = String(val || "").trim();
  return map[trimmed] || trimmed;
}

// Verified column index mapping (no header row in CSV)
// 0:name  1:team  2:conf  3:G  4:Min  5:ORTG  6:Usg  7:eFG  8:TS
// 9:OR  10:DR  11:ARate  12:TO  13:FTM  14:FTA  15:FT(0-1)
// 16:2PM  17:2PA  18:2P(0-1)  19:3PM  20:3PA  21:3P(0-1)
// 22:Blk  23:Stl  24:FTRate  25:Class  26:Height
// 27:skip  28:skip  29:skip  30:FC40  31:skip  32:playerId
// 33:skip  34:skip  35:skip
// 36:Close2PM  37:Close2PA  38:Far2PM  39:Far2PA
// 40:Close2P(0-1)  41:Far2P(0-1)
// 42:DunksMade  43:DunksAtt  44:DunkPct(0-1)
// 45:skip  46:skip  47:DRTG  48:skip  49:skip
// 50:skip  51:skip  52:skip
// 53:BPM  54:skip  55:OBPM  56:DBPM
// 57-63:skip  64:position  65:3P100  66:DOB(skip)

function rowToDoc(cols) {
  const name = cols[0]?.trim();
  const team = cols[1]?.trim();
  const playerId = cols[32]?.trim();
  const height = cols[26]?.trim();

  const id = playerId || `${name}-${team}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const dunksMade = pf(cols[42]);
  const dunksAtt  = pf(cols[43]);
  const dunkPct   = cols[44] !== "" && cols[44] != null
    ? pf(cols[44]) * 100
    : dunksAtt > 0 ? (dunksMade / dunksAtt) * 100 : 0;

  return {
    id,
    name,
    team,
    year:         yearLabel(cols[25]),
    position:     cols[64]?.trim() || "",
    height,
    heightInches: heightToInches(height),
    stats: {
      G:         pf(cols[3]),
      Min:       pf(cols[4]),
      ORTG:      pf(cols[5]),
      Usg:       pf(cols[6]),
      eFG:       pf(cols[7]),
      TS:        pf(cols[8]),
      OR:        pf(cols[9]),
      DR:        pf(cols[10]),
      ARate:     pf(cols[11]),
      TO:        pf(cols[12]),
      FTM:       pf(cols[13]),
      FTA:       pf(cols[14]),
      FT:        pf(cols[15]) * 100,
      "2PM":     pf(cols[16]),
      "2PA":     pf(cols[17]),
      "2P":      pf(cols[18]) * 100,
      "3PM":     pf(cols[19]),
      "3PA":     pf(cols[20]),
      "3P":      pf(cols[21]) * 100,
      Blk:       pf(cols[22]),
      Stl:       pf(cols[23]),
      FTRate:    pf(cols[24]),
      FC40:      pf(cols[30]),
      Close2PM:  pf(cols[36]),
      Close2PA:  pf(cols[37]),
      Far2PM:    pf(cols[38]),
      Far2PA:    pf(cols[39]),
      Close2P:   pf(cols[40]) * 100,
      Far2P:     pf(cols[41]) * 100,
      DunksMade: dunksMade,
      DunksAtt:  dunksAtt,
      DunkPct:   dunkPct,
      DRTG:      pf(cols[47]),
      BPM:       pf(cols[53]),
      OBPM:      pf(cols[55]),
      DBPM:      pf(cols[56]),
      "3P100":   pf(cols[65]),
    },
  };
}

function parseCSVLine(line) {
  const cols = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

function printDoc(d) {
  const s = d.stats;
  console.log(`\n  ${d.name} | ${d.team} | ${d.year} | ${d.height} | ${d.position}`);
  console.log(`  G=${s.G} Min=${s.Min} ORTG=${s.ORTG} Usg=${s.Usg}`);
  console.log(`  eFG=${s.eFG} TS=${s.TS} OR=${s.OR} DR=${s.DR} ARate=${s.ARate} TO=${s.TO}`);
  console.log(`  Blk=${s.Blk} Stl=${s.Stl} FTRate=${s.FTRate} FC40=${s.FC40}`);
  console.log(`  DRTG=${s.DRTG} BPM=${s.BPM} OBPM=${s.OBPM} DBPM=${s.DBPM} 3P100=${s["3P100"]}`);
  console.log(`  FTM=${s.FTM} FTA=${s.FTA} FT=${s.FT.toFixed(1)}%`);
  console.log(`  2PM=${s["2PM"]} 2PA=${s["2PA"]} 2P=${s["2P"].toFixed(1)}%`);
  console.log(`  3PM=${s["3PM"]} 3PA=${s["3PA"]} 3P=${s["3P"].toFixed(1)}%`);
  console.log(`  Close2PM=${s.Close2PM} Close2PA=${s.Close2PA} Close2P=${s.Close2P.toFixed(1)}%`);
  console.log(`  Far2PM=${s.Far2PM} Far2PA=${s.Far2PA} Far2P=${s.Far2P.toFixed(1)}%`);
  console.log(`  DunksMade=${s.DunksMade} DunksAtt=${s.DunksAtt} DunkPct=${s.DunkPct.toFixed(1)}%`);
}

// Parse CSV into docs
const filePath = resolve(__dirname, "data/trank_data.csv");
const rl = createInterface({ input: createReadStream(filePath) });

const docs = [];
const seenIds = new Set();

for await (const line of rl) {
  if (!line.trim()) continue;
  const cols = parseCSVLine(line);
  if (cols.length < 10) continue;

  const doc = rowToDoc(cols);
  if (!doc.name || !doc.team) continue;

  let id = doc.id;
  if (seenIds.has(id)) {
    id = `${id}-${doc.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }
  seenIds.add(id);
  doc.id = id;

  docs.push(doc);
}

console.log(`Parsed ${docs.length} players`);

// --- DRY RUN: no DB, just print first 10 ---
if (DRY_RUN) {
  console.log("\n--- DRY RUN: first 10 players ---");
  docs.slice(0, 10).forEach((d, i) => {
    console.log(`\n${i + 1}.`);
    printDoc(d);
  });
  console.log(`\nTotal parsed: ${docs.length} players`);
  process.exit(0);
}

// Connect to DB for test-run or full seed
const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

// --- TEST RUN: upsert only Rienk Mast ---
if (TEST_RUN) {
  const mastDoc = docs.find(d => d.name === "Rienk Mast");
  if (!mastDoc) {
    console.log("Rienk Mast not found in CSV!");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("\nParsed data for Rienk Mast:");
  printDoc(mastDoc);

  await Player.findOneAndReplace(
    { name: "Rienk Mast" },
    mastDoc,
    { upsert: true, new: true }
  );

  console.log("\nRienk Mast upserted into database. Check his profile on the site to verify.");
  await mongoose.disconnect();
  process.exit(0);
}

// --- FULL SEED ---
await Player.deleteMany({});
console.log("Cleared existing players");

const batchSize = 500;
let inserted = 0;
for (let i = 0; i < docs.length; i += batchSize) {
  const batch = docs.slice(i, i + batchSize);
  try {
    await Player.insertMany(batch, { ordered: false });
  } catch {
    // ordered: false inserts what it can, duplicates are skipped
  }
  inserted += batch.length;
  console.log(`Processed ${inserted}/${docs.length}`);
}

await mongoose.disconnect();
console.log("Done");