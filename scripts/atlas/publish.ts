import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AtlasSnapshot } from "./types.js";

type PublishOptions = {
  outputDir?: string;
  bucket?: string;
  prefix?: string;
  region?: string;
  concurrency?: number;
  s3Client?: Pick<S3Client, "send">;
};

export async function publishSnapshot(snapshot: AtlasSnapshot, options: PublishOptions) {
  if (!options.outputDir && !options.bucket) throw new Error("Atlas publishing requires an output directory or S3 bucket.");
  if (options.outputDir) await publishToDirectory(snapshot, options.outputDir);
  if (options.bucket) await publishToS3(snapshot, options);
}

async function publishToDirectory(snapshot: AtlasSnapshot, outputDir: string) {
  for (const object of snapshot.objects) {
    await writeJsonAtomically(path.join(outputDir, object.key), object.body);
  }
  await writeJsonAtomically(path.join(outputDir, "manifest/current.json"), snapshot.manifest);
}

async function publishToS3(snapshot: AtlasSnapshot, options: PublishOptions) {
  const bucket = options.bucket!;
  const client = options.s3Client || new S3Client({ region: options.region });
  const immutableObjects = snapshot.objects.map((object) => ({
    Key: withPrefix(options.prefix, object.key),
    Body: `${JSON.stringify(object.body)}\n`,
    ContentType: "application/json; charset=utf-8",
    CacheControl: "public, max-age=31536000, immutable",
  }));

  await mapConcurrent(immutableObjects, options.concurrency || 16, (input) =>
    client.send(new PutObjectCommand({ Bucket: bucket, ...input })),
  );

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: withPrefix(options.prefix, "manifest/current.json"),
      Body: `${JSON.stringify(snapshot.manifest)}\n`,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-cache, max-age=0",
    }),
  );
}

async function writeJsonAtomically(filePath: string, body: unknown) {
  const normalized = path.resolve(filePath);
  await mkdir(path.dirname(normalized), { recursive: true });
  const temporaryPath = `${normalized}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await rename(temporaryPath, normalized);
}

function withPrefix(prefix: string | undefined, key: string) {
  const normalizedPrefix = (prefix || "").replace(/^\/+|\/+$/g, "");
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key;
}

async function mapConcurrent<T>(items: T[], concurrency: number, operation: (item: T) => Promise<unknown>) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Publish concurrency must be a positive integer.");
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await operation(item);
      }
    }),
  );
}
