import { createHash, createHmac } from "node:crypto";

import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from "./index";

const PREFIX = "s3:";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} تنظیم نشده است.`);
  return value;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function getConfig() {
  const endpoint = new URL(requiredEnv("S3_ENDPOINT"));
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") {
    throw new Error("S3_ENDPOINT باید HTTPS باشد.");
  }
  if (endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
    throw new Error("S3_ENDPOINT نامعتبر است.");
  }

  return {
    endpoint,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    bucket: requiredEnv("S3_BUCKET"),
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    publicBaseUrl: requiredEnv("S3_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  };
}

function objectUrl(endpoint: URL, bucket: string, key: string) {
  const url = new URL(endpoint.toString());
  const endpointPath = url.pathname.replace(/\/+$/, "");
  const encodedKey = key.split("/").map((part) => encodeURIComponent(part)).join("/");
  url.pathname = `${endpointPath}/${encodeURIComponent(bucket)}/${encodedKey}`;
  url.search = "";
  url.hash = "";
  return url;
}

function canonicalUri(url: URL) {
  return url.pathname
    .split("/")
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part)).replace(/[!'()*]/g, (char) =>
          `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
        );
      } catch {
        return part;
      }
    })
    .join("/");
}

function signedHeaders(method: "PUT" | "DELETE" | "HEAD", url: URL, body: Buffer) {
  const config = getConfig();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const host = url.host;
  const signedHeaderNames = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    method,
    canonicalUri(url),
    "",
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  };
}

function parseStorageKey(storageKey: string) {
  if (!storageKey.startsWith(PREFIX)) throw new Error("S3 storage key نامعتبر است.");
  const key = storageKey.slice(PREFIX.length);
  if (!key || key.startsWith("/") || key.split("/").some((part) => part === "..")) {
    throw new Error("S3 storage key نامعتبر است.");
  }
  return key;
}

async function requestObject(method: "PUT" | "DELETE" | "HEAD", key: string, body = Buffer.alloc(0), contentType?: string) {
  const config = getConfig();
  const url = objectUrl(config.endpoint, config.bucket, key);
  const signed = signedHeaders(method, url, body);
  const headers: Record<string, string> = { ...signed.headers };
  if (method === "PUT" && contentType) headers["Content-Type"] = contentType;

  return fetch(url, {
    method,
    headers,
    ...(method === "PUT" ? { body: new Uint8Array(body) } : {}),
    cache: "no-store",
  });
}

/**
 * S3-compatible provider for ParsPack or another S3-compatible service.
 * S3_PUBLIC_BASE_URL must be the public base URL for the bucket, without a trailing slash.
 */
export const s3CompatibleStorageProvider: StorageProvider = {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const config = getConfig();
    const key = input.key.replace(/^\/+/, "");
    if (!key || key.split("/").some((part) => part === "..")) {
      throw new Error("کلید فایل نامعتبر است.");
    }

    const response = await requestObject("PUT", key, input.body, input.contentType);
    if (!response.ok) {
      const details = (await response.text().catch(() => "")).slice(0, 500);
      throw new Error(`آپلود فایل در فضای S3 ناموفق بود (HTTP ${response.status}). ${details}`);
    }

    return {
      storageKey: `${PREFIX}${key}`,
      publicUrl: `${config.publicBaseUrl}/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`,
    };
  },

  async delete(storageKey: string) {
    const response = await requestObject("DELETE", parseStorageKey(storageKey));
    if (!response.ok && response.status !== 404) {
      throw new Error(`حذف فایل از فضای S3 ناموفق بود (HTTP ${response.status}).`);
    }
  },

  async exists(storageKey: string) {
    const response = await requestObject("HEAD", parseStorageKey(storageKey));
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`بررسی فایل در فضای S3 ناموفق بود (HTTP ${response.status}).`);
    return true;
  },
};
