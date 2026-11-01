import Papa from "papaparse";
import { z } from "zod";

import type {
  CsvImportKind,
  Facility,
  Lane,
  Sku,
  Storefront,
  WorkforceLocation,
} from "@/lib/types";

const criticalitySchema = z.enum(["core", "important", "monitor"]);

const facilitiesRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  country: z.string().min(1),
  state: z.string().min(1),
  city: z.string().min(1),
  timezone: z.string().min(1),
  criticality: criticalitySchema,
  notes: z.string().optional(),
});

const lanesRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  origin_country: z.string().min(1),
  origin_state: z.string().min(1),
  destination_country: z.string().min(1),
  destination_state: z.string().min(1),
  mode: z.string().min(1),
  lead_time_days: z.coerce.number().int().nonnegative(),
  fulfillment_sla_days: z.coerce.number().int().nonnegative(),
  criticality: criticalitySchema,
  notes: z.string().optional(),
});

const skusRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  origin_country: z.string().min(1),
  primary_market: z.string().min(1),
  channels: z.string().min(1),
  margin_band: z.string().min(1),
  criticality: criticalitySchema,
  hts_code: z.string().optional(),
  category: z.string().optional(),
  user_segments: z.string().optional(),
  alternate_origins: z.string().optional(),
  notes: z.string().optional(),
});

const storefrontsRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  platform: z.string().min(1),
  market: z.string().min(1),
  country: z.string().min(1),
  state: z.string().min(1),
  city: z.string().min(1),
  criticality: criticalitySchema,
  notes: z.string().optional(),
});

const workforceRowSchema = z.object({
  id: z.string().min(1),
  team_name: z.string().min(1),
  country: z.string().min(1),
  state: z.string().min(1),
  city: z.string().min(1),
  employees: z.coerce.number().int().nonnegative(),
  criticality: criticalitySchema,
  notes: z.string().optional(),
});

type ParsedCsvResult =
  | { key: "facilities"; rows: Facility[] }
  | { key: "lanes"; rows: Lane[] }
  | { key: "skus"; rows: Sku[] }
  | { key: "storefronts"; rows: Storefront[] }
  | { key: "workforceLocations"; rows: WorkforceLocation[] };

const assetCollectionKeyByKind: Record<CsvImportKind, string> = {
  facilities: "facilities",
  lanes: "lanes",
  skus: "skus",
  storefronts: "storefronts",
  workforce_locations: "workforceLocations",
};

function parseCsvRows(input: string) {
  const result = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? "CSV parse failed.");
  }

  return result.data;
}

function cleanNotes(value: string | undefined) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : undefined;
}

function parsePipeList(value: string | undefined) {
  return (value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFacilities(rows: Record<string, string>[]) {
  return rows.map((row) => {
    const parsed = facilitiesRowSchema.parse(row);
    return {
      id: parsed.id,
      name: parsed.name,
      type: parsed.type,
      country: parsed.country,
      state: parsed.state,
      city: parsed.city,
      timezone: parsed.timezone,
      criticality: parsed.criticality,
      notes: cleanNotes(parsed.notes),
    } satisfies Facility;
  });
}

function parseLanes(rows: Record<string, string>[]) {
  return rows.map((row) => {
    const parsed = lanesRowSchema.parse(row);
    return {
      id: parsed.id,
      name: parsed.name,
      originCountry: parsed.origin_country,
      originState: parsed.origin_state,
      destinationCountry: parsed.destination_country,
      destinationState: parsed.destination_state,
      mode: parsed.mode,
      leadTimeDays: parsed.lead_time_days,
      fulfillmentSlaDays: parsed.fulfillment_sla_days,
      criticality: parsed.criticality,
      notes: cleanNotes(parsed.notes),
    } satisfies Lane;
  });
}

function parseSkus(rows: Record<string, string>[]) {
  return rows.map((row) => {
    const parsed = skusRowSchema.parse(row);
    return {
      id: parsed.id,
      name: parsed.name,
      originCountry: parsed.origin_country,
      primaryMarket: parsed.primary_market,
      channels: parsePipeList(parsed.channels),
      marginBand: parsed.margin_band,
      criticality: parsed.criticality,
      htsCode: cleanNotes(parsed.hts_code),
      category: cleanNotes(parsed.category),
      userSegments: parsePipeList(parsed.user_segments),
      alternateOrigins: parsePipeList(parsed.alternate_origins),
      notes: cleanNotes(parsed.notes),
    } satisfies Sku;
  });
}

function parseStorefronts(rows: Record<string, string>[]) {
  return rows.map((row) => {
    const parsed = storefrontsRowSchema.parse(row);
    return {
      id: parsed.id,
      name: parsed.name,
      platform: parsed.platform,
      market: parsed.market,
      country: parsed.country,
      state: parsed.state,
      city: parsed.city,
      criticality: parsed.criticality,
      notes: cleanNotes(parsed.notes),
    } satisfies Storefront;
  });
}

function parseWorkforceLocations(rows: Record<string, string>[]) {
  return rows.map((row) => {
    const parsed = workforceRowSchema.parse(row);
    return {
      id: parsed.id,
      teamName: parsed.team_name,
      country: parsed.country,
      state: parsed.state,
      city: parsed.city,
      employees: parsed.employees,
      criticality: parsed.criticality,
      notes: cleanNotes(parsed.notes),
    } satisfies WorkforceLocation;
  });
}

export function parseCsvImport(kind: CsvImportKind, input: string): ParsedCsvResult {
  const rows = parseCsvRows(input);

  if (rows.length === 0) {
    throw new Error("The CSV file is empty.");
  }

  switch (kind) {
    case "facilities":
      return { key: "facilities", rows: parseFacilities(rows) };
    case "lanes":
      return { key: "lanes", rows: parseLanes(rows) };
    case "skus":
      return { key: "skus", rows: parseSkus(rows) };
    case "storefronts":
      return { key: "storefronts", rows: parseStorefronts(rows) };
    case "workforce_locations":
      return { key: "workforceLocations", rows: parseWorkforceLocations(rows) };
    default:
      throw new Error("Unsupported CSV import type.");
  }
}

export function isCsvImportKind(value: string | null): value is CsvImportKind {
  return value !== null && value in assetCollectionKeyByKind;
}
