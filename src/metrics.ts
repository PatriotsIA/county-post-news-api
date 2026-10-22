/**
 * CloudWatch metrics written as Embedded Metric Format log lines.
 *
 * Lines go straight to stdout because the Lambda runtime prefixes console
 * output with a timestamp and request id, and CloudWatch only extracts metrics
 * from lines that are pure JSON. Outside Lambda nothing is written.
 */
const NAMESPACE = "CountyNewsApi";

export type Provider = "fred" | "weather" | "markets";

/**
 * An outside data provider failed. `reader` counts error responses sent to
 * readers; `refresh` counts scheduled refreshes that kept an older copy or
 * could not build one. The reader HTTP alarm subtracts the reader count, and
 * the provider outage alarm adds both.
 */
export function recordProviderFailures(provider: Provider, source: "reader" | "refresh", count = 1) {
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME || count <= 0) return;
  process.stdout.write(`${JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{ Namespace: NAMESPACE, Dimensions: [["Provider", "Source"]], Metrics: [{ Name: "ProviderFailures", Unit: "Count" }] }],
    },
    Provider: provider,
    Source: source,
    ProviderFailures: count,
  })}\n`);
}
