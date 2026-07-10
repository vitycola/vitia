/**
 * BEDCA API client — calls bedca.net directly via their XML API.
 *
 * Endpoint: POST https://www.bedca.net/bdpub/procquery.php
 * Body: XML (text/xml), NOT JSON or form-encoded.
 * Response: XML parsed into structured objects.
 *
 * XML schema sourced from statickidz/bedca-api BedcaXMLRequests.php.
 * level="3" → food groups, level="1" → foods in group, level="2" → food detail.
 *
 * Results are cached in scripts/seed-bedca/.cache/ for idempotent re-runs.
 */

import { XMLParser } from "fast-xml-parser";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BEDCA_URL = "https://www.bedca.net/bdpub/procquery.php";

const _dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const CACHE_DIR = join(_dirname, ".cache");
const RATE_LIMIT_MS = 300;

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

// ── Types ────────────────────────────────────────────────────────────────────

export interface BedcaGroup {
  id: number;
  name_es: string;
  name_en: string;
}

export interface BedcaFoodSummary {
  id: number;
  name_es: string;
  name_en: string;
  group_id: number;
}

export interface BedcaComponent {
  c_id: string;
  name_es: string;
  name_en: string;
  value: number;       // sourced from best_location field (not moex, which is often "W")
  unit: string;
  component_group: string;
}

export interface BedcaFood {
  id: number;
  name_es: string;
  name_en: string;
  group_id: number;
  components: BedcaComponent[];
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function readCache<T>(name: string): T | null {
  const path = join(CACHE_DIR, `${name}.json`);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf8")) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function writeCache(name: string, data: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

// ── XML request helper ────────────────────────────────────────────────────────

async function postXml(body: string): Promise<string> {
  const res = await fetch(BEDCA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "Connection": "close",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`BEDCA HTTP ${res.status}: ${res.statusText}`);
  }
  const text = await res.text();
  if (!text.trim()) {
    throw new Error("BEDCA returned empty response — check XML body format");
  }
  return text;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Food groups (level=3) ─────────────────────────────────────────────────────

const FOOD_GROUPS_XML = `<?xml version="1.0" encoding="utf-8"?>
<foodquery>
	<type level="3"/>
	<selection>
		<atribute name="fg_id"/>
		<atribute name="fg_ori_name"/>
		<atribute name="fg_eng_name"/>
	</selection>
	<order ordtype="ASC">
		<atribute3 name="fg_id"/>
	</order>
</foodquery>`;

export async function getFoodGroups(): Promise<BedcaGroup[]> {
  const cached = readCache<BedcaGroup[]>("food_groups");
  if (cached) {
    console.log("  [cache] food_groups");
    return cached;
  }

  const xml = await postXml(FOOD_GROUPS_XML);
  const parsed = xmlParser.parse(xml);

  // Response shape: { foodresponse: { food: [...] | {...} } }
  const raw = parsed?.foodresponse?.food ?? [];
  const items = Array.isArray(raw) ? raw : [raw];

  const groups: BedcaGroup[] = items.map((g: Record<string, unknown>) => ({
    id: Number(g.fg_id),
    name_es: String(g.fg_ori_name ?? ""),
    name_en: String(g.fg_eng_name ?? ""),
  }));

  writeCache("food_groups", groups);
  return groups;
}

// ── Foods in group (level=1) ──────────────────────────────────────────────────

function makeFoodsInGroupXml(groupId: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<foodquery>
	<type level="1"/>
	<selection>
		<atribute name="f_id"/>
		<atribute name="f_ori_name"/>
		<atribute name="f_eng_name"/>
		<atribute name="f_origen"/>
	</selection>
	<condition>
		<cond1>
			<atribute1 name="foodgroup_id"/>
		</cond1>
		<relation type="EQUAL"/>
		<cond3>${groupId}</cond3>
	</condition>
	<condition>
		<cond1>
			<atribute1 name="f_origen"/>
		</cond1>
		<relation type="EQUAL"/>
		<cond3>BEDCA</cond3>
	</condition>
	<order ordtype="ASC">
		<atribute3 name="f_eng_name"/>
	</order>
</foodquery>`;
}

export async function getFoodsInGroup(groupId: number): Promise<BedcaFoodSummary[]> {
  const cacheKey = `group_${groupId}_foods`;
  const cached = readCache<BedcaFoodSummary[]>(cacheKey);
  if (cached) {
    console.log(`  [cache] group ${groupId} foods`);
    return cached;
  }

  await sleep(RATE_LIMIT_MS);
  const xml = await postXml(makeFoodsInGroupXml(groupId));
  const parsed = xmlParser.parse(xml);

  const raw = parsed?.foodresponse?.food ?? [];
  const items = Array.isArray(raw) ? raw : [raw];

  const foods: BedcaFoodSummary[] = items.map((f: Record<string, unknown>) => ({
    id: Number(f.f_id),
    name_es: String(f.f_ori_name ?? ""),
    name_en: String(f.f_eng_name ?? ""),
    group_id: groupId,
  }));

  writeCache(cacheKey, foods);
  return foods;
}

// ── Food detail (level=2) ─────────────────────────────────────────────────────

function makeFoodDetailXml(foodId: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<foodquery>
	<type level="2"/>
	<selection>
		<atribute name="f_id"/>
		<atribute name="f_ori_name"/>
		<atribute name="f_eng_name"/>
		<atribute name="c_id"/>
		<atribute name="c_ori_name"/>
		<atribute name="c_eng_name"/>
		<atribute name="cg_descripcion"/>
		<atribute name="v_unit"/>
		<atribute name="best_location"/>
	</selection>
	<condition>
		<cond1>
			<atribute1 name="f_id"/>
		</cond1>
		<relation type="EQUAL"/>
		<cond3>${foodId}</cond3>
	</condition>
	<condition>
		<cond1>
			<atribute1 name="publico"/>
		</cond1>
		<relation type="EQUAL"/>
		<cond3>1</cond3>
	</condition>
	<order ordtype="ASC">
		<atribute3 name="componentgroup_id"/>
	</order>
</foodquery>`;
}

export async function getFood(foodId: number): Promise<BedcaFood | null> {
  const cacheKey = `food_${foodId}`;
  const cached = readCache<BedcaFood>(cacheKey);
  if (cached) return cached;

  await sleep(RATE_LIMIT_MS);
  let xml: string;
  try {
    xml = await postXml(makeFoodDetailXml(foodId));
  } catch {
    return null;
  }

  const parsed = xmlParser.parse(xml);
  // Actual XML structure: foodresponse > food (single object with nested foodvalue[])
  const foodNode = parsed?.foodresponse?.food;
  if (!foodNode) return null;

  const rawValues = foodNode.foodvalue ?? [];
  const values = Array.isArray(rawValues) ? rawValues : [rawValues];

  const components: BedcaComponent[] = values
    .map((v: Record<string, unknown>) => ({
      c_id: String(v.c_id ?? ""),
      name_es: String(v.c_ori_name ?? ""),
      name_en: String(v.c_eng_name ?? ""),
      // best_location is the actual numeric value (moex is often "W"/withdrawn)
      value: typeof v.best_location === "number" ? v.best_location : Number.NaN,
      unit: String(v.v_unit ?? ""),
      component_group: String(v.cg_descripcion ?? ""),
    }))
    .filter((c: BedcaComponent) => !Number.isNaN(c.value));

  const food: BedcaFood = {
    id: Number(foodNode.f_id),
    name_es: String(foodNode.f_ori_name ?? ""),
    name_en: String(foodNode.f_eng_name ?? ""),
    group_id: 0,
    components,
  };

  writeCache(cacheKey, food);
  return food;
}
