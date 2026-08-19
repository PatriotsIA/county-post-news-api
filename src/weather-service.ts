import { cached } from "./cache.js";
import { config } from "./config.js";
import { getCounty } from "./geo.js";
import type {
  CountyDroughtCondition,
  CountySite,
  CountyWeatherResponse,
  WeatherAlert,
  WeatherForecastPeriod,
  WeatherMeasurement,
  WeatherObservation,
  WeatherZone,
} from "./types.js";

type JsonObject = Record<string, unknown>;

type PointsMapping = {
  pointsLink: string;
  forecastLink?: string;
  hourlyLink?: string;
  observationStationsLink?: string;
  forecastZone?: WeatherZone;
  countyZone?: WeatherZone;
  city?: string;
  state?: string;
  gridOffice?: string;
  gridX?: number;
  gridY?: number;
  timeZone?: string;
};

type AlertLoadResult = {
  alerts: WeatherAlert[];
  warnings: string[];
  links: string[];
};

const nwsDocumentation = "https://www.weather.gov/documentation/services-web-api";
const nwsAlertsDocumentation = "https://www.weather.gov/documentation/services-web-alerts";
const severityRank = new Map([
  ["extreme", 0],
  ["severe", 1],
  ["moderate", 2],
  ["minor", 3],
  ["unknown", 4],
]);

export class WeatherServiceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getCountyWeather(stateSlug: string, countySlug: string): Promise<CountyWeatherResponse> {
  const county = getCounty(stateSlug, countySlug);
  if (!county) throw new WeatherServiceError(404, "Unknown county");
  if (county.latitude === undefined || county.longitude === undefined || !county.fips) {
    throw new WeatherServiceError(502, "County weather location is unavailable");
  }

  const latitude = county.latitude;
  const longitude = county.longitude;
  const coordinate = `${formatCoordinate(latitude)},${formatCoordinate(longitude)}`;
  const pointsLink = apiUrl(`/points/${coordinate}`);
  let points: PointsMapping;
  try {
    points = await cached(
      `weather:points:${coordinate}`,
      config.weatherPointsCacheTtlSeconds,
      async () => parsePoints(await fetchNwsJson(pointsLink), pointsLink),
    );
  } catch (error) {
    throw asWeatherError(error, "National Weather Service point lookup failed");
  }

  const tasks = {
    forecast: loadForecast(points.forecastLink, 14),
    hourly: loadForecast(points.hourlyLink, 24),
    observation: loadObservation(points.observationStationsLink),
    alerts: loadAlerts(latitude, longitude, points.forecastZone, points.countyZone),
    drought: loadDroughtCondition(county),
  };
  const [forecastResult, hourlyResult, observationResult, alertsResult, droughtResult] = await Promise.allSettled([
    tasks.forecast,
    tasks.hourly,
    tasks.observation,
    tasks.alerts,
    tasks.drought,
  ]);

  const results = [forecastResult, hourlyResult, observationResult, alertsResult, droughtResult];
  if (results.every((result) => result.status === "rejected")) {
    throw new WeatherServiceError(502, "National Weather Service weather resources are unavailable");
  }

  const warnings: string[] = [];
  if (forecastResult.status === "rejected") warnings.push("Forecast is temporarily unavailable.");
  if (hourlyResult.status === "rejected") warnings.push("Hourly forecast is temporarily unavailable.");
  if (observationResult.status === "rejected") warnings.push("Current observation is temporarily unavailable.");
  if (alertsResult.status === "rejected") warnings.push("Active alerts are temporarily unavailable.");
  if (droughtResult.status === "rejected") warnings.push("Current U.S. Drought Monitor conditions are temporarily unavailable.");
  if (alertsResult.status === "fulfilled") warnings.push(...alertsResult.value.warnings);

  const observation = observationResult.status === "fulfilled" ? observationResult.value : undefined;
  const alertLinks =
    alertsResult.status === "fulfilled"
      ? alertsResult.value.links
      : alertEndpointLinks(latitude, longitude, points.forecastZone, points.countyZone);

  return {
    county: countyPayload(county),
    location: {
      latitude,
      longitude,
      city: points.city,
      state: points.state,
      gridOffice: points.gridOffice,
      gridX: points.gridX,
      gridY: points.gridY,
      timeZone: points.timeZone,
    },
    zones: {
      forecast: points.forecastZone,
      county: points.countyZone,
    },
    currentObservation: observation?.observation,
    forecast: forecastResult.status === "fulfilled" ? forecastResult.value : [],
    hourly: hourlyResult.status === "fulfilled" ? hourlyResult.value : [],
    alerts: alertsResult.status === "fulfilled" ? alertsResult.value.alerts : [],
    droughtCondition: droughtResult.status === "fulfilled" ? droughtResult.value : undefined,
    warnings,
    meta: {
      fetchedAt: new Date().toISOString(),
      partial: warnings.length > 0,
      cacheTtlSeconds: config.weatherResponseCacheTtlSeconds,
      alertsCacheTtlSeconds: config.weatherAlertsCacheTtlSeconds,
      pointsCacheTtlSeconds: config.weatherPointsCacheTtlSeconds,
      units: {
        temperature: "F",
        windSpeed: "mph",
        precipitationProbability: "percent",
      },
      source: {
        name: "National Weather Service",
        documentation: nwsDocumentation,
        alertsDocumentation: nwsAlertsDocumentation,
        links: {
          points: points.pointsLink,
          forecast: points.forecastLink,
          hourly: points.hourlyLink,
          observationStations: points.observationStationsLink,
          latestObservation: observation?.latestObservationLink,
          alerts: alertLinks,
        },
      },
    },
  };
}

async function loadDroughtCondition(county: CountySite): Promise<CountyDroughtCondition | undefined> {
  if (!county.fips) return undefined;
  return cached(`weather:drought:${county.fips}`, config.droughtCacheTtlSeconds, async () => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 28);
    const url = new URL(
      "/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent",
      `${config.usdmApiBase.replace(/\/+$/u, "")}/`,
    );
    url.search = new URLSearchParams({
      aoi: county.fips!,
      startdate: isoDate(startDate),
      enddate: isoDate(endDate),
      statisticsType: "1",
    }).toString();

    const json = await fetchJson(url.toString(), "U.S. Drought Monitor");
    if (!Array.isArray(json)) throw new Error("U.S. Drought Monitor returned an invalid response");
    const latest = json
      .map(asObject)
      .filter((record): record is JsonObject => Boolean(record))
      .filter((record) => stringValue(record, "fips") === county.fips)
      .sort((left, right) => timestamp(stringValue(right, "mapDate")) - timestamp(stringValue(left, "mapDate")))[0];
    if (!latest) return undefined;

    const categories = {
      d0: percentageValue(latest, "d0"),
      d1: percentageValue(latest, "d1"),
      d2: percentageValue(latest, "d2"),
      d3: percentageValue(latest, "d3"),
      d4: percentageValue(latest, "d4"),
    };
    const category =
      categories.d4 > 0 ? "D4"
        : categories.d3 > 0 ? "D3"
          : categories.d2 > 0 ? "D2"
            : categories.d1 > 0 ? "D1"
              : undefined;
    if (!category) return undefined;

    const categoryDetails = {
      D1: { label: "Moderate Drought", areaPercent: categories.d1 },
      D2: { label: "Severe Drought", areaPercent: categories.d2 },
      D3: { label: "Extreme Drought", areaPercent: categories.d3 },
      D4: { label: "Exceptional Drought", areaPercent: categories.d4 },
    } as const;
    const details = categoryDetails[category];
    return {
      category,
      label: details.label,
      areaPercent: details.areaPercent,
      totalDroughtPercent: categories.d1,
      categories,
      mapDate: stringValue(latest, "mapDate") || endDate.toISOString(),
      validStart: stringValue(latest, "validStart"),
      validEnd: stringValue(latest, "validEnd"),
      source: {
        name: "U.S. Drought Monitor",
        agency: "National Drought Mitigation Center, NOAA, and USDA",
        url: url.toString(),
        countyUrl: droughtCountyUrl(county),
      },
    };
  });
}

async function loadForecast(link: string | undefined, limit: number) {
  if (!link) throw new Error("NWS point response omitted a forecast link");
  return cached(`weather:resource:${link}`, config.weatherResponseCacheTtlSeconds, async () => {
    const json = await fetchNwsJson(link);
    const periods = arrayValue(objectValue(json, "properties"), "periods");
    if (!periods) throw new Error("NWS forecast response omitted periods");
    return periods.slice(0, limit).map(parseForecastPeriod).filter((period): period is WeatherForecastPeriod => Boolean(period));
  });
}

async function loadObservation(link: string | undefined) {
  if (!link) throw new Error("NWS point response omitted observation stations");
  return cached(`weather:observation:${link}`, config.weatherResponseCacheTtlSeconds, async () => {
    const stations = await fetchNwsJson(link);
    const firstStation = arrayValue(stations, "features")?.map(asObject).find(Boolean);
    const stationLink = stringValue(firstStation, "@id") || stringValue(firstStation, "id");
    if (!firstStation || !stationLink) throw new Error("NWS returned no observation station");

    const stationProperties = objectValue(firstStation, "properties");
    const latestObservationLink = apiUrl(`${urlPath(stationLink).replace(/\/+$/u, "")}/observations/latest`);
    const latest = await fetchNwsJson(latestObservationLink);
    return {
      latestObservationLink,
      observation: parseObservation(
        latest,
        stringValue(stationProperties, "stationIdentifier") || urlPath(stationLink).split("/").filter(Boolean).at(-1) || "",
        stringValue(stationProperties, "name"),
      ),
    };
  });
}

async function loadAlerts(
  latitude: number,
  longitude: number,
  forecastZone?: WeatherZone,
  countyZone?: WeatherZone,
): Promise<AlertLoadResult> {
  const links = alertEndpointLinks(latitude, longitude, forecastZone, countyZone);
  return cached(`weather:alerts:${links.join("|")}`, config.weatherAlertsCacheTtlSeconds, async () => {
    const settled = await Promise.allSettled(links.map((link) => fetchNwsJson(link)));
    if (settled.every((result) => result.status === "rejected")) {
      throw new Error("All NWS alert resources failed");
    }

    const warnings = settled.flatMap((result, index) =>
      result.status === "rejected" ? [`Active alerts source failed: ${links[index]}`] : [],
    );
    const alerts = settled.flatMap((result) =>
      result.status === "fulfilled" ? parseAlerts(result.value) : [],
    );
    const deduped = new Map<string, WeatherAlert>();
    for (const alert of alerts) {
      if (!deduped.has(alert.id)) deduped.set(alert.id, alert);
    }

    return {
      alerts: [...deduped.values()].sort(compareAlerts),
      warnings,
      links,
    };
  });
}

function parsePoints(json: JsonObject, pointsLink: string): PointsMapping {
  const properties = objectValue(json, "properties");
  if (!properties) throw new Error("NWS point response omitted properties");
  const relativeLocation = objectValue(properties, "relativeLocation");
  const relativeProperties = objectValue(relativeLocation, "properties");
  return {
    pointsLink,
    forecastLink: linkedUrl(properties, "forecast"),
    hourlyLink: linkedUrl(properties, "forecastHourly"),
    observationStationsLink: linkedUrl(properties, "observationStations"),
    forecastZone: parseZone(stringValue(properties, "forecastZone")),
    countyZone: parseZone(stringValue(properties, "county")),
    city: stringValue(relativeProperties, "city"),
    state: stringValue(relativeProperties, "state"),
    gridOffice: stringValue(properties, "gridId"),
    gridX: numberValue(properties, "gridX"),
    gridY: numberValue(properties, "gridY"),
    timeZone: stringValue(properties, "timeZone"),
  };
}

function parseForecastPeriod(value: unknown): WeatherForecastPeriod | undefined {
  const period = asObject(value);
  const number = numberValue(period, "number");
  const startTime = stringValue(period, "startTime");
  const endTime = stringValue(period, "endTime");
  if (number === undefined || !startTime || !endTime) return undefined;
  const name = stringValue(period, "name")?.trim() || "Hourly forecast";

  const temperatureValue = numberValue(period, "temperature") ?? null;
  const temperatureUnit = stringValue(period, "temperatureUnit") || "F";
  return {
    number,
    name,
    startTime,
    endTime,
    isDaytime: Boolean(period?.isDaytime),
    temperature: temperatureMeasurement(temperatureValue, temperatureUnit),
    windSpeed: windTextMeasurement(stringValue(period, "windSpeed")),
    windDirection: stringValue(period, "windDirection"),
    precipitationProbability: quantityMeasurement(
      objectValue(period, "probabilityOfPrecipitation"),
      "percent",
    ),
    shortForecast: stringValue(period, "shortForecast"),
    detailedForecast: stringValue(period, "detailedForecast"),
    icon: stringValue(period, "icon"),
  };
}

function parseObservation(
  json: JsonObject,
  stationId: string,
  stationName?: string,
): WeatherObservation {
  const properties = objectValue(json, "properties");
  if (!properties) throw new Error("NWS observation response omitted properties");
  return {
    stationId,
    stationName,
    observedAt: stringValue(properties, "timestamp"),
    textDescription: stringValue(properties, "textDescription"),
    icon: stringValue(properties, "icon"),
    temperature: quantityMeasurement(objectValue(properties, "temperature"), "F"),
    relativeHumidity: quantityMeasurement(objectValue(properties, "relativeHumidity"), "percent"),
    windSpeed: quantityMeasurement(objectValue(properties, "windSpeed"), "mph"),
    windGust: quantityMeasurement(objectValue(properties, "windGust"), "mph"),
    windDirection: quantityMeasurement(objectValue(properties, "windDirection"), "degrees"),
    barometricPressure: quantityMeasurement(objectValue(properties, "barometricPressure"), "Pa"),
  };
}

function parseAlerts(json: JsonObject): WeatherAlert[] {
  return (arrayValue(json, "features") || []).flatMap((value) => {
    const feature = asObject(value);
    const properties = objectValue(feature, "properties");
    if (!feature || !properties) return [];
    const event = stringValue(properties, "event") || "Weather alert";
    const effective = stringValue(properties, "effective");
    const headline = stringValue(properties, "headline");
    const id =
      stringValue(feature, "id") ||
      stringValue(properties, "@id") ||
      stringValue(properties, "id") ||
      stringValue(properties, "identifier") ||
      `${event}|${effective || ""}|${headline || ""}`;
    return [{
      id,
      event,
      headline,
      description: stringValue(properties, "description"),
      instruction: stringValue(properties, "instruction"),
      severity: stringValue(properties, "severity"),
      urgency: stringValue(properties, "urgency"),
      certainty: stringValue(properties, "certainty"),
      effective,
      expires: stringValue(properties, "expires"),
      link: linkedUrl(properties, "@id") || (id.startsWith("http://") || id.startsWith("https://") ? apiUrl(id) : undefined),
    }];
  });
}

function quantityMeasurement(
  quantity: JsonObject | undefined,
  targetUnit: WeatherMeasurement["unit"],
): WeatherMeasurement | undefined {
  if (!quantity) return undefined;
  const sourceValue = numberValue(quantity, "value") ?? null;
  const sourceUnit = stringValue(quantity, "unitCode");
  return {
    value: convertValue(sourceValue, sourceUnit, targetUnit),
    unit: targetUnit,
    source: {
      value: sourceValue,
      unitCode: sourceUnit,
    },
  };
}

function temperatureMeasurement(value: number | null, unit: string): WeatherMeasurement {
  const sourceUnit = unit.toUpperCase() === "C" ? "wmoUnit:degC" : "wmoUnit:degF";
  return {
    value: convertValue(value, sourceUnit, "F"),
    unit: "F",
    source: { value, unitCode: sourceUnit },
  };
}

function windTextMeasurement(value?: string): WeatherMeasurement {
  const numbers = value?.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) || [];
  const sourceValue = numbers.length ? numbers.reduce((sum, item) => sum + item, 0) / numbers.length : null;
  const sourceUnit = value?.toLowerCase().includes("km/h") ? "wmoUnit:km_h-1" : "wmoUnit:mi_h-1";
  return {
    value: convertValue(sourceValue, sourceUnit, "mph"),
    unit: "mph",
    source: { value: sourceValue, unitCode: sourceUnit, rawValue: value || null },
  };
}

function convertValue(
  value: number | null,
  sourceUnit: string | undefined,
  targetUnit: WeatherMeasurement["unit"],
) {
  if (value === null) return null;
  const unit = (sourceUnit || "").toLowerCase();
  if (targetUnit === "F" && unit.includes("degc")) return round((value * 9) / 5 + 32, 1);
  if (targetUnit === "mph" && (unit.includes("km_h") || unit.includes("km/h"))) return round(value * 0.621371, 1);
  if (targetUnit === "mph" && unit.includes("m_s")) return round(value * 2.23694, 1);
  if (targetUnit === "Pa" && unit.includes("pa")) return round(value, 1);
  return round(value, 1);
}

async function fetchNwsJson(url: string): Promise<JsonObject> {
  const json = await fetchJson(
    apiUrl(url),
    "NWS",
    "application/geo+json, application/json",
  );
  const object = asObject(json);
  if (!object) throw new Error("NWS returned an invalid JSON response");
  return object;
}

async function fetchJson(url: string, sourceName: string, accept = "application/json"): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.weatherTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept,
        "user-agent": config.nwsUserAgent,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${sourceName} request failed (${response.status})`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function alertEndpointLinks(
  latitude: number,
  longitude: number,
  forecastZone?: WeatherZone,
  countyZone?: WeatherZone,
) {
  const coordinate = `${formatCoordinate(latitude)},${formatCoordinate(longitude)}`;
  return Array.from(
    new Set([
      apiUrl(`/alerts/active?point=${coordinate}`),
      ...(forecastZone ? [apiUrl(`/alerts/active?zone=${encodeURIComponent(forecastZone.id)}`)] : []),
      ...(countyZone ? [apiUrl(`/alerts/active?zone=${encodeURIComponent(countyZone.id)}`)] : []),
    ]),
  );
}

function parseZone(value?: string): WeatherZone | undefined {
  if (!value) return undefined;
  const link = apiUrl(value);
  const id = urlPath(link).split("/").filter(Boolean).at(-1);
  return id ? { id, link } : undefined;
}

function linkedUrl(object: JsonObject | undefined, key: string) {
  const value = stringValue(object, key);
  return value ? apiUrl(value) : undefined;
}

function apiUrl(value: string) {
  const base = `${config.nwsApiBase.replace(/\/+$/u, "")}/`;
  const parsed = new URL(value, base);
  return new URL(`${parsed.pathname}${parsed.search}`, base).toString();
}

function urlPath(value: string) {
  try {
    const parsed = new URL(value, config.nwsApiBase);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

function compareAlerts(left: WeatherAlert, right: WeatherAlert) {
  const severity =
    (severityRank.get((left.severity || "unknown").toLowerCase()) ?? 5) -
    (severityRank.get((right.severity || "unknown").toLowerCase()) ?? 5);
  if (severity) return severity;
  return timestamp(left.effective) - timestamp(right.effective) || left.id.localeCompare(right.id);
}

function countyPayload(county: CountySite) {
  return {
    name: county.name,
    displayName: county.displayName,
    slug: county.slug,
    fips: county.fips!,
    stateName: county.state.name,
    stateSlug: county.state.slug,
    stateAbbr: county.state.abbr,
  };
}

function asWeatherError(error: unknown, message: string) {
  if (error instanceof WeatherServiceError) return error;
  return new WeatherServiceError(502, message);
}

function objectValue(object: JsonObject | undefined, key: string) {
  return asObject(object?.[key]);
}

function arrayValue(object: JsonObject | undefined, key: string) {
  return Array.isArray(object?.[key]) ? object[key] as unknown[] : undefined;
}

function stringValue(object: JsonObject | undefined, key: string) {
  return typeof object?.[key] === "string" ? object[key] as string : undefined;
}

function numberValue(object: JsonObject | undefined, key: string) {
  return typeof object?.[key] === "number" && Number.isFinite(object[key]) ? object[key] as number : undefined;
}

function percentageValue(object: JsonObject, key: string) {
  return round(Math.min(100, Math.max(0, numberValue(object, key) || 0)), 2);
}

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function formatCoordinate(value: number) {
  return Number(value.toFixed(4)).toString();
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function droughtCountyUrl(county: CountySite) {
  const statePath = encodeURIComponent(county.state.name.replace(/\s+/gu, "-"));
  const countyPath = encodeURIComponent(county.name.replace(/\s+/gu, "-"));
  return `https://www.drought.gov/states/${statePath}/county/${countyPath}`;
}

function timestamp(value?: string) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}
