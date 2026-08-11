import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { config } from "./config.js";

const supportedCreativeTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export class AdCreativeError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function createAdCreativeUpload(payload: unknown) {
  if (!config.advertisingCreativeBucket) throw new AdCreativeError(503, "Creative upload is not configured.");
  if (!isRecord(payload)) throw new AdCreativeError(400, "Creative upload details must be a JSON object.");

  const fileName = requiredText(payload.fileName, "A creative file name is required.", 160);
  const contentType = payload.contentType;
  const size = payload.size;
  if (typeof contentType !== "string" || !(contentType in supportedCreativeTypes)) {
    throw new AdCreativeError(400, "Creative must be a JPG or PNG image.");
  }
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1 || size > config.advertisingCreativeMaxBytes) {
    throw new AdCreativeError(400, `Creative files must be smaller than ${Math.floor(config.advertisingCreativeMaxBytes / 1024 / 1024)} MB.`);
  }

  const extension = supportedCreativeTypes[contentType as keyof typeof supportedCreativeTypes];
  const assetKey = `ad-creatives/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const post = await createPresignedPost(new S3Client({}), {
    Bucket: config.advertisingCreativeBucket,
    Key: assetKey,
    Expires: 15 * 60,
    Fields: {
      "Content-Type": contentType,
      "x-amz-meta-original-name": encodeURIComponent(fileName),
    },
    Conditions: [
      ["content-length-range", 1, config.advertisingCreativeMaxBytes],
      ["eq", "$Content-Type", contentType],
    ],
  });

  return {
    assetKey,
    upload: {
      url: post.url,
      fields: post.fields,
    },
  };
}

export function isAdCreativeAssetKey(value: unknown): value is string {
  return typeof value === "string" && /^ad-creatives\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(jpg|png)$/.test(value);
}

function requiredText(value: unknown, message: string, maxLength: number) {
  if (typeof value !== "string") throw new AdCreativeError(400, message);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new AdCreativeError(400, message);
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
