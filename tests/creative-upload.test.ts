import { afterEach, describe, expect, it, vi } from "vitest";

const createPresignedPost = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class S3Client {},
}));

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost,
}));

import { config } from "../src/config.js";
import { handleRequest } from "../src/http.js";

const defaultBucket = config.advertisingCreativeBucket;
const defaultMaxBytes = config.advertisingCreativeMaxBytes;

describe("advertising creative upload endpoint", () => {
  afterEach(() => {
    config.advertisingCreativeBucket = defaultBucket;
    config.advertisingCreativeMaxBytes = defaultMaxBytes;
    createPresignedPost.mockReset();
    vi.restoreAllMocks();
  });

  it("creates a private, size-limited upload form for an allowed creative", async () => {
    config.advertisingCreativeBucket = "county-post-ad-creatives";
    createPresignedPost.mockResolvedValue({
      url: "https://county-post-ad-creatives.s3.amazonaws.com/",
      fields: { key: "ad-creatives/2026-08-10/example.png", "Content-Type": "image/png" },
    });

    const response = await handleRequest({
      method: "POST",
      path: "/v1/advertising/creatives/upload",
      query: new URLSearchParams(),
      body: JSON.stringify({ fileName: "my-ad.png", contentType: "image/png", size: 400_000 }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(response.body)).toMatchObject({
      assetKey: expect.stringMatching(/^ad-creatives\/\d{4}-\d{2}-\d{2}\/.+\.png$/),
      upload: { url: "https://county-post-ad-creatives.s3.amazonaws.com/" },
    });
    expect(createPresignedPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Bucket: "county-post-ad-creatives",
        Conditions: expect.arrayContaining([["content-length-range", 1, config.advertisingCreativeMaxBytes]]),
      }),
    );
  });

  it("rejects an unsupported creative type before creating an upload form", async () => {
    config.advertisingCreativeBucket = "county-post-ad-creatives";

    const response = await handleRequest({
      method: "POST",
      path: "/v1/advertising/creatives/upload",
      query: new URLSearchParams(),
      body: JSON.stringify({ fileName: "my-ad.gif", contentType: "image/gif", size: 400_000 }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("Creative must be a JPG or PNG image.");
    expect(createPresignedPost).not.toHaveBeenCalled();
  });
});
