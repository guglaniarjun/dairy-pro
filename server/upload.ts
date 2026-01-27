import multer from "multer";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import { storage } from "./storage";
import { SystemSettings } from "@shared/schema";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

interface StorageConfig {
  provider: "s3" | "supabase" | "none";
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

async function getStorageConfig(): Promise<StorageConfig> {
  const settings = await storage.getAllSystemSettings();
  const getValue = (key: string) => settings.find((s: SystemSettings) => s.key === key)?.value || null;
  
  const provider = getValue("storage_provider") as "s3" | "supabase" | "none" || "none";
  
  return {
    provider,
    endpoint: getValue("storage_endpoint") || undefined,
    bucket: getValue("storage_bucket") || undefined,
    region: getValue("storage_region") || undefined,
    accessKey: getValue("storage_access_key") || undefined,
    secretKey: getValue("storage_secret_key") || undefined,
  };
}

function createS3Client(config: StorageConfig): S3Client {
  const clientConfig: any = {
    region: config.region || "us-east-1",
    credentials: {
      accessKeyId: config.accessKey!,
      secretAccessKey: config.secretKey!,
    },
  };
  
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = true;
  }
  
  return new S3Client(clientConfig);
}

export async function uploadFile(
  file: Express.Multer.File,
  tenantId: string
): Promise<{ url: string; storageKey: string }> {
  const config = await getStorageConfig();
  
  if (config.provider === "none" || !config.bucket) {
    throw new Error("Storage not configured. Please configure S3 or Supabase in settings.");
  }
  
  const fileExtension = path.extname(file.originalname);
  const fileName = `${crypto.randomUUID()}${fileExtension}`;
  const storageKey = `${tenantId}/${fileName}`;
  
  const s3Client = createS3Client(config);
  
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    ContentLength: file.size,
  });
  
  await s3Client.send(command);
  
  let url: string;
  if (config.endpoint) {
    url = `${config.endpoint}/${config.bucket}/${storageKey}`;
  } else {
    url = `https://${config.bucket}.s3.${config.region || "us-east-1"}.amazonaws.com/${storageKey}`;
  }
  
  return { url, storageKey };
}

export async function deleteFile(storageKey: string): Promise<void> {
  const config = await getStorageConfig();
  
  if (config.provider === "none" || !config.bucket) {
    return;
  }
  
  const s3Client = createS3Client(config);
  
  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
  });
  
  await s3Client.send(command);
}

export function getFileType(mimeType: string): "image" | "document" | "audio" | "video" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("excel") || mimeType.includes("sheet")) return "document";
  return "other";
}
