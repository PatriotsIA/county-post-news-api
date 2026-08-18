import { cached } from "./cache.js";
import { config } from "./config.js";

const metalNames = ["gold", "silver", "platinum", "palladium"] as const;

type MetalName = (typeof metalNames)[number];

type MintedMetalResponse = {
  updatedAt?: string;
  metals?: Partial<Record<MetalName, {
    price?: number;
    currency?: string;
    unit?: string;
  }>>;
};

export type MetalsTickerResponse = {
  currency: string;
  unit: string;
  updatedAt?: string;
  provider: {
    name: string;
    url: string;
  };
  stale?: boolean;
  items: Array<{
    key: MetalName;
    label: string;
    price: number;
  }>;
};

let lastMetalsTicker: MetalsTickerResponse | undefined;

type MarsReportResponse = {
  results?: MarsReportRow[];
};

type MarsReportRow = {
  report_date?: string;
  published_date?: string;
  market_location_name?: string;
  commodity?: string;
  class?: string;
  price_unit?: string;
  head_count?: number | string;
  avg_price?: number | string;
  weight_break_low?: number | string;
  weight_break_high?: number | string;
};

type FeederCattleBreakdown = {
  label: string;
  price: number;
  unit: string;
};

type CattleTickerItem = {
  key: "feeder-cattle" | "slaughter-cattle";
  label: string;
  price: number;
  unit: string;
  market?: string;
  reportDate?: string;
  sampleSize: number;
  breakdown?: FeederCattleBreakdown[];
};

export type CattleTickerResponse = {
  updatedAt?: string;
  items: CattleTickerItem[];
};

export class MarketServiceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function getMetalsTicker() {
  return cached("markets:metals:usd:toz", config.metalsCacheTtlSeconds, async () => {
    try {
      const response = await fetch(config.metalsProviderUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });
      if (!response.ok) {
        throw new MarketServiceError(502, "Metals price provider is unavailable.");
      }

      const data = (await response.json()) as MintedMetalResponse;
      const items = metalNames.flatMap((key) => {
        const metal = data.metals?.[key];
        return typeof metal?.price === "number"
          ? [{ key, label: key[0].toUpperCase() + key.slice(1), price: metal.price }]
          : [];
      });
      if (items.length !== metalNames.length) {
        throw new MarketServiceError(502, "Metals price provider returned incomplete data.");
      }

      const firstMetal = data.metals?.gold;
      const ticker = {
        currency: firstMetal?.currency || "USD",
        unit: firstMetal?.unit || "troy oz",
        updatedAt: data.updatedAt,
        provider: {
          name: "Minted Metal",
          url: "https://mintedmetal.com",
        },
        items,
      };
      lastMetalsTicker = ticker;
      return ticker;
    } catch (error) {
      if (lastMetalsTicker) return { ...lastMetalsTicker, stale: true };
      if (error instanceof MarketServiceError) throw error;
      throw new MarketServiceError(502, "Metals price provider is unavailable.");
    }
  });
}

export function getCattleTicker() {
  if (!config.usdaMarsApiKey) {
    throw new MarketServiceError(503, "Cattle ticker is awaiting USDA MARS API configuration.");
  }

  return cached("markets:cattle:recent", config.metalsCacheTtlSeconds, async () => {
    const reports = await Promise.allSettled([
      fetchMarsCattleReport({ key: "feeder-cattle", label: "Feeder cattle", reportId: 1280, commodity: "Feeder Cattle" }),
      fetchMarsCattleReport({ key: "slaughter-cattle", label: "Slaughter cattle", reportId: 2154, commodity: "Slaughter Cattle" }),
    ]);
    const items = reports.flatMap((report) => (report.status === "fulfilled" ? [report.value] : []));
    if (!items.length) {
      throw new MarketServiceError(502, "USDA MARS cattle provider is unavailable.");
    }

    return {
      updatedAt: newestValue(items.map((item) => item.reportDate)),
      items,
    };
  });
}

async function fetchMarsCattleReport(report: {
  key: CattleTickerItem["key"];
  label: string;
  reportId: number;
  commodity: string;
}): Promise<CattleTickerItem> {
  const url = new URL(`https://marsapi.ams.usda.gov/services/v1.2/reports/${report.reportId}`);
  url.searchParams.set("q", `commodity=${report.commodity};report_begin_date=${recentMarsDateWindow(14)}`);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${config.usdaMarsApiKey}:`).toString("base64")}`,
      "user-agent": "county-post-news-api/1.0",
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (!response.ok) {
    throw new MarketServiceError(502, `USDA MARS report ${report.reportId} is unavailable.`);
  }

  const data = (await response.json()) as MarsReportResponse;
  const rows = latestRows((data.results || []).filter((row) => Number.isFinite(Number(row.avg_price))));
  if (!rows.length) {
    throw new MarketServiceError(502, `USDA MARS report ${report.reportId} returned no recent price rows.`);
  }

  return {
    key: report.key,
    label: report.label,
    price: weightedAverage(rows),
    unit: mostCommon(rows.map((row) => row.price_unit).filter(Boolean)) || "Per Cwt",
    market: mostCommon(rows.map((row) => row.market_location_name).filter(Boolean)),
    reportDate: newestValue(rows.map((row) => row.report_date)),
    sampleSize: rows.length,
    breakdown: report.key === "feeder-cattle" ? feederCattleBreakdown(rows) : undefined,
  };
}

function feederCattleBreakdown(rows: MarsReportRow[]): FeederCattleBreakdown[] {
  const featuredBreaks = [
    { className: "Steers", low: 500, high: 550 },
    { className: "Steers", low: 600, high: 650 },
    { className: "Heifers", low: 500, high: 550 },
  ];

  return featuredBreaks.flatMap(({ className, low, high }) => {
    const matchingRows = rows.filter(
      (row) => row.class === className && Number(row.weight_break_low) === low && Number(row.weight_break_high) === high,
    );
    if (!matchingRows.length) return [];
    return [{
      label: `${className} ${low}–${high - 1}`,
      price: weightedAverage(matchingRows),
      unit: mostCommon(matchingRows.map((row) => row.price_unit).filter(Boolean)) || "Per Cwt",
    }];
  });
}

function recentMarsDateWindow(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return `${formatMarsDate(start)}:${formatMarsDate(end)}`;
}

function formatMarsDate(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}/${day}/${date.getUTCFullYear()}`;
}

function latestRows(rows: MarsReportRow[]) {
  const latest = newestValue(rows.map((row) => row.report_date));
  return latest ? rows.filter((row) => row.report_date === latest) : rows;
}

function weightedAverage(rows: MarsReportRow[]) {
  const weighted = rows
    .map((row) => ({ price: Number(row.avg_price), weight: Number(row.head_count) }))
    .filter((row) => Number.isFinite(row.price) && Number.isFinite(row.weight) && row.weight > 0);
  if (weighted.length) {
    const totalWeight = weighted.reduce((total, row) => total + row.weight, 0);
    return roundMoney(weighted.reduce((total, row) => total + row.price * row.weight, 0) / totalWeight);
  }

  const prices = rows.map((row) => Number(row.avg_price)).filter(Number.isFinite);
  return roundMoney(prices.reduce((total, price) => total + price, 0) / prices.length);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function mostCommon(values: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function newestValue(values: (string | undefined)[]) {
  return values.filter(Boolean).sort((a, b) => Date.parse(b!) - Date.parse(a!))[0];
}
