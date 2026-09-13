import fs from "node:fs";
import path from "node:path";

const schemaPath = path.resolve("prisma/schema.prisma");

if (!fs.existsSync(schemaPath)) {
  console.error(`schema.prisma پیدا نشد: ${schemaPath}`);
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, "utf8");

const originalSchema = schema;

// ======================================================
// 1. USER RELATION
// ======================================================

const userRelation = `  instagramPublishJobs InstagramPublishJob[]
`;

if (!schema.includes("instagramPublishJobs InstagramPublishJob[]")) {
  const marker = `  forms             Form[]
`;

  if (!schema.includes(marker)) {
    console.error("Marker مربوط به User پیدا نشد.");
    process.exit(1);
  }

  schema = schema.replace(
    marker,
    `${marker}\n${userRelation}`,
  );
}

// ======================================================
// 2. INSTAGRAM ACCOUNT RELATION
// ======================================================

const accountRelation = `  publishJobs InstagramPublishJob[]
`;

if (!schema.includes("publishJobs InstagramPublishJob[]")) {
  const marker = `  insightSnapshots InstagramInsightSnapshot[]
`;

  if (!schema.includes(marker)) {
    console.error("Marker مربوط به InstagramAccount پیدا نشد.");
    process.exit(1);
  }

  schema = schema.replace(
    marker,
    `${marker}\n\n  // ====================================================\n  // INSTAGRAM PUBLISHING\n  // ====================================================\n\n${accountRelation}`,
  );
}

// ======================================================
// 3. PUBLISHING MODELS
// ======================================================

if (!schema.includes("model InstagramPublishJob")) {
  const marker = `// ======================================================\n// AUTOMATION\n// ======================================================\n`;

  if (!schema.includes(marker)) {
    console.error("محل مناسب برای اضافه کردن Publishing Models پیدا نشد.");
    process.exit(1);
  }

  const publishingModels = `// ======================================================
// INSTAGRAM PUBLISH JOB
// ======================================================
//
// Represents one Instagram publishing operation.
//
// Supported:
// - Draft
// - Scheduled post
// - Immediate post
// - Reel
// - Carousel
//
// Media files are stored temporarily outside PostgreSQL.
// PostgreSQL only stores the metadata and temporary URL.
//
// ======================================================

model InstagramPublishJob {
  id String @id @default(cuid())

  // ====================================================
  // SMARTDIRECT USER
  // ====================================================

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // ====================================================
  // INSTAGRAM ACCOUNT
  // ====================================================

  instagramAccountId String

  instagramAccount InstagramAccount @relation(
    fields: [instagramAccountId],
    references: [id],
    onDelete: Cascade
  )

  // ====================================================
  // PUBLISH TYPE
  // ====================================================

  type InstagramPublishType

  // ====================================================
  // STATUS
  // ====================================================

  status InstagramPublishStatus @default(DRAFT)

  // ====================================================
  // CONTENT
  // ====================================================

  caption String?

  // ====================================================
  // SCHEDULING
  // ====================================================

  scheduledAt DateTime?

  publishedAt DateTime?

  // ====================================================
  // INSTAGRAM REFERENCES
  // ====================================================

  // Instagram media container ID
  instagramContainerId String?

  // Final published Instagram media ID
  instagramMediaId String?

  // ====================================================
  // ERROR
  // ====================================================

  errorMessage String?

  // ====================================================
  // IDEMPOTENCY
  // ====================================================
  //
  // Prevents duplicate publishing when a scheduler
  // runs more than once or a request is retried.

  idempotencyKey String? @unique

  // ====================================================
  // RETRY
  // ====================================================

  retryCount Int @default(0)

  lastAttemptAt DateTime?

  // ====================================================
  // TIMESTAMPS
  // ====================================================

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ====================================================
  // MEDIA
  // ====================================================

  media InstagramPublishMedia[]

  // ====================================================
  // INDEXES
  // ====================================================

  @@index([userId])
  @@index([instagramAccountId])
  @@index([status])
  @@index([scheduledAt])
  @@index([instagramAccountId, status])
  @@index([status, scheduledAt])
}

// ======================================================
// INSTAGRAM PUBLISH MEDIA
// ======================================================
//
// Temporary media belonging to a publish job.
//
// The actual file is NOT stored in PostgreSQL.
//
// storageKey:
//     Internal storage identifier.
//
// publicUrl:
//     Temporary public URL that Meta/Instagram can access.
//
// ======================================================

model InstagramPublishMedia {
  id String @id @default(cuid())

  // ====================================================
  // PUBLISH JOB
  // ====================================================

  publishJobId String

  publishJob InstagramPublishJob @relation(
    fields: [publishJobId],
    references: [id],
    onDelete: Cascade
  )

  // ====================================================
  // MEDIA TYPE
  // ====================================================

  type InstagramMediaType

  // ====================================================
  // TEMPORARY STORAGE
  // ====================================================

  storageKey String

  publicUrl String?

  // ====================================================
  // ORIGINAL FILE INFORMATION
  // ====================================================

  fileName String?

  mimeType String?

  fileSize Int?

  // ====================================================
  // CAROUSEL ORDER
  // ====================================================

  sortOrder Int @default(0)

  // ====================================================
  // CLEANUP
  // ====================================================

  deletedAt DateTime?

  // ====================================================
  // TIMESTAMPS
  // ====================================================

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ====================================================
  // INDEXES
  // ====================================================

  @@index([publishJobId])
  @@index([publishJobId, sortOrder])
}

// ======================================================
// INSTAGRAM PUBLISH TYPE
// ======================================================

enum InstagramPublishType {
  POST
  CAROUSEL
  REEL
}

// ======================================================
// INSTAGRAM PUBLISH STATUS
// ======================================================

enum InstagramPublishStatus {
  DRAFT
  UPLOADING
  SCHEDULED
  PROCESSING
  PUBLISHING
  PUBLISHED
  FAILED
  CANCELLED
}

// ======================================================
// INSTAGRAM MEDIA TYPE
// ======================================================

enum InstagramMediaType {
  IMAGE
  VIDEO
}

// ======================================================

`;

  schema = schema.replace(marker, `${publishingModels}${marker}`);
}

// ======================================================
// SAFETY CHECKS
// ======================================================

const requiredParts = [
  "instagramPublishJobs InstagramPublishJob[]",
  "publishJobs InstagramPublishJob[]",
  "model InstagramPublishJob",
  "model InstagramPublishMedia",
  "enum InstagramPublishType",
  "enum InstagramPublishStatus",
  "enum InstagramMediaType",
  "idempotencyKey String? @unique",
];

for (const part of requiredParts) {
  if (!schema.includes(part)) {
    console.error(`تغییر مورد انتظار پیدا نشد: ${part}`);
    console.error("فایل برای جلوگیری از خراب شدن ذخیره نشد.");
    process.exit(1);
  }
}

// ======================================================
// PREVENT DUPLICATE EXECUTION
// ======================================================

if (schema === originalSchema) {
  console.log("تغییر جدیدی انجام نشد.");
  console.log("احتمالاً Publishing schema قبلاً اضافه شده است.");
  process.exit(0);
}

// ======================================================
// WRITE
// ======================================================

fs.writeFileSync(schemaPath, schema, "utf8");

console.log("");
console.log("==============================================");
console.log("Instagram Publishing schema اضافه شد.");
console.log("==============================================");
console.log("");
console.log("فایل تغییر کرده:");
console.log("prisma/schema.prisma");
console.log("");
console.log("موارد اضافه شده:");
console.log("- InstagramPublishJob");
console.log("- InstagramPublishMedia");
console.log("- InstagramPublishType");
console.log("- InstagramPublishStatus");
console.log("- InstagramMediaType");
console.log("- User -> instagramPublishJobs");
console.log("- InstagramAccount -> publishJobs");
console.log("- Idempotency");
console.log("- Retry tracking");
console.log("");