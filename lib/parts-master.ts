import fs from 'fs';
import path from 'path';

const PARTS_FILE = path.join(process.cwd(), 'data', 'parts_master.json');

export interface AssemblyRecord {
  nha_pn: string;
  occurrences: number;
  units: string[];
}

export interface PartRecord {
  part_number: string;
  assemblies: AssemblyRecord[];
  total_occurrences: number;
  first_seen: string;
  last_seen: string;
  prices?: number[];  // Optional price history; average displayed in UI
}

export function readParts(): Record<string, PartRecord> {
  try {
    if (!fs.existsSync(PARTS_FILE)) {
      fs.mkdirSync(path.dirname(PARTS_FILE), { recursive: true });
      fs.writeFileSync(PARTS_FILE, '{}');
    }
    return JSON.parse(fs.readFileSync(PARTS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeParts(data: Record<string, PartRecord>) {
  fs.mkdirSync(path.dirname(PARTS_FILE), { recursive: true });
  fs.writeFileSync(PARTS_FILE, JSON.stringify(data, null, 2));
}

export function indexUnitsIntoParts(
  nha_pn: string,
  units: { serialNumber: string; subcomponents: { partNumber: string }[] }[]
) {
  const parts = readParts();
  const now = new Date().toISOString().split('T')[0];

  for (const unit of units) {
    if (!unit.subcomponents || !Array.isArray(unit.subcomponents)) continue;

    for (const subcomp of unit.subcomponents) {
      const partNumber = subcomp.partNumber?.toUpperCase().trim();
      if (!partNumber) continue;

      if (!parts[partNumber]) {
        parts[partNumber] = {
          part_number: partNumber,
          assemblies: [],
          total_occurrences: 0,
          first_seen: now,
          last_seen: now,
        };
      }

      const part = parts[partNumber];
      const assemblyRecord = part.assemblies.find(a => a.nha_pn === nha_pn);

      if (assemblyRecord) {
        if (!assemblyRecord.units.includes(unit.serialNumber)) {
          assemblyRecord.units.push(unit.serialNumber);
          assemblyRecord.occurrences = assemblyRecord.units.length;
        }
      } else {
        part.assemblies.push({
          nha_pn,
          occurrences: 1,
          units: [unit.serialNumber],
        });
      }

      part.total_occurrences = part.assemblies.reduce((sum, a) => sum + a.occurrences, 0);
      part.last_seen = now;
    }
  }

  writeParts(parts);
}
