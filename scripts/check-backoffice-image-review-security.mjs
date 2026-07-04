import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/api/src/routes/admin-listings.routes.ts",
  "apps/api/src/services/admin-listings.service.ts",
  "apps/api/src/schemas/admin-listings.schemas.ts",
  "apps/api/test/admin-listings.schemas.test.ts",
  "apps/backoffice/src/features/listings/api.ts",
  "apps/backoffice/src/features/listings/listing-image-review-panel.tsx",
  "apps/backoffice/e2e/listing-image-review.smoke.spec.ts",
  "docs/36-listing-admin-review-tools.md",
  "docs/37-marketplace-review-operations.md",
  "docs/25-validation-and-regression-checklist.md"
];

const problems = [];

function read(relativePath) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required backoffice image review file: ${file}`);
  }
}

if (problems.length === 0) {
  checkApiContract();
  checkBackofficeUiContract();
  checkBackofficeE2eContract();
  checkDocsContract();
}

function checkApiContract() {
  const routeFile = "apps/api/src/routes/admin-listings.routes.ts";
  const serviceFile = "apps/api/src/services/admin-listings.service.ts";
  const schemaFile = "apps/api/src/schemas/admin-listings.schemas.ts";
  const schemasTestFile = "apps/api/test/admin-listings.schemas.test.ts";

  const routeSource = read(routeFile);
  const serviceSource = read(serviceFile);
  const schemaSource = read(schemaFile);
  const schemasTestSource = read(schemasTestFile);

  mustContain(routeSource, routeFile, "/:listingId/images/:imageId/actions");
  if (
    !routeSource.includes("requireAdminUser") &&
    !routeSource.includes("requireAdminPermission") &&
    !routeSource.includes("requireBackofficeUser") &&
    !routeSource.includes("admin")
  ) {
    problems.push(`${routeFile} must protect image review actions with an admin/backoffice guard.`);
  }

  mustContain(serviceSource, serviceFile, "admin_listing_image_review_applied");
  mustContain(serviceSource, serviceFile, "previousReviewStatus");
  mustContain(serviceSource, serviceFile, "nextReviewStatus");
  mustContain(serviceSource, serviceFile, "reasonLength");
  mustContain(serviceSource, serviceFile, "reviewStatus");
  mustContain(serviceSource, serviceFile, "reviewedAt");
  mustContain(serviceSource, serviceFile, "reviewedByProfileId");

  mustContain(schemaSource, schemaFile, "approve");
  mustContain(schemaSource, schemaFile, "reject");
  mustContain(schemaSource, schemaFile, "reason");

  mustContain(schemasTestSource, schemasTestFile, "approve");
  mustContain(schemasTestSource, schemasTestFile, "reject");

  for (const [file, source] of [
    [routeFile, routeSource],
    [serviceFile, serviceSource],
    [schemaFile, schemaSource]
  ]) {
    mustNotContain(source, file, "secretAccessKey");
    mustNotContain(source, file, "accessKeyId");
    mustNotContain(source, file, "S3_SECRET_ACCESS_KEY");
    mustNotContain(source, file, "AWS_SECRET_ACCESS_KEY");
    mustNotContain(source, file, "image binary");
    mustNotContain(source, file, "/sensitive-access");
  }
}

function checkBackofficeUiContract() {
  const apiFile = "apps/backoffice/src/features/listings/api.ts";
  const panelFile = "apps/backoffice/src/features/listings/listing-image-review-panel.tsx";

  const apiSource = read(apiFile);
  const panelSource = read(panelFile);

  mustContain(apiSource, apiFile, "/api/v1/admin/listings");
  mustContain(apiSource, apiFile, "images");
  mustContain(apiSource, apiFile, "reviewStatus");
  mustContain(apiSource, apiFile, "reviewedAt");
  mustContain(apiSource, apiFile, "reviewedByProfileId");

  mustContain(panelSource, panelFile, "data-admin-image-review-status");
  mustContain(panelSource, panelFile, "data-admin-image-review-action");
  mustContain(panelSource, panelFile, "data-admin-image-review-reason");
  mustContain(panelSource, panelFile, "data-admin-image-review-submit");
  mustContain(panelSource, panelFile, "approve");
  mustContain(panelSource, panelFile, "reject");
  mustNotContain(panelSource, panelFile, "requestAdminSensitiveAccess");
  mustNotContain(panelSource, panelFile, "/sensitive-access");

  for (const [file, source] of [
    [apiFile, apiSource],
    [panelFile, panelSource]
  ]) {
    mustNotContain(source, file, "localStorage");
    mustNotContain(source, file, "sessionStorage");
    mustNotContain(source, file, "requestAdminSensitiveAccess");
    mustNotContain(source, file, "contentHash");
    mustNotContain(source, file, "secretAccessKey");
    mustNotContain(source, file, "accessKeyId");
    mustNotContain(source, file, "S3_SECRET_ACCESS_KEY");
    mustNotContain(source, file, "AWS_SECRET_ACCESS_KEY");
    mustNotContain(source, file, "RAW_ADMIN_IMAGE_REVIEW_PRIVATE");
  }
}

function checkBackofficeE2eContract() {
  const file = "apps/backoffice/e2e/listing-image-review.smoke.spec.ts";
  const source = read(file);

  mustContain(source, file, "admin can open review queue, approve a needs-review image, and see audit state");
  mustContain(source, file, "admin can reject a needs-review image and see rejected audit state without private leaks");
  mustContain(source, file, "admin cannot submit image review without a useful reason");
  mustContain(source, file, "admin sees safe image review API failure state without raw private data");
  mustContain(source, file, "admin sees safe listing detail not-found state without raw private data");
  mustContain(source, file, "Image review audited: audit-image-review-e2e-1");
  mustContain(source, file, "admin_listing_image_review_applied");
  mustContain(source, file, "data-admin-image-review-status");
  mustContain(source, file, "needs_review");
  mustContain(source, file, "approved");
  mustContain(source, file, "rejected");

  mustContain(source, file, "RAW_EMAIL_SENTINEL");
  mustContain(source, file, "RAW_TOKEN_SENTINEL");
  mustContain(source, file, "RAW_MESSAGE_SENTINEL");
  mustContain(source, file, "RAW_PROMPT_SENTINEL");
  mustContain(source, file, "toHaveCount(0)");

  mustNotContain(source, file, "sensitive-access");
  mustNotContain(source, file, "localStorage");
  mustNotContain(source, file, "sessionStorage");
}

function checkDocsContract() {
  const docs = [
    "docs/36-listing-admin-review-tools.md",
    "docs/37-marketplace-review-operations.md",
    "docs/25-validation-and-regression-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContain(source, file, "admin_listing_image_review_applied");
    mustContain(source, file, "sensitive-access");
    mustContain(source, file, "seller email");
    mustContain(source, file, "seller phone");
    mustContain(source, file, "tokens");
  }

  const marketplaceDoc = read("docs/37-marketplace-review-operations.md");
  mustContain(marketplaceDoc, "docs/37-marketplace-review-operations.md", "Image storage driver boundary");
  mustContain(marketplaceDoc, "docs/37-marketplace-review-operations.md", "must not expose object storage credentials or raw image binary data");

  const checklist = read("docs/25-validation-and-regression-checklist.md");
  mustContain(checklist, "docs/25-validation-and-regression-checklist.md", "admin can reject a listing image with a reason");
  mustContain(checklist, "docs/25-validation-and-regression-checklist.md", "rejected images disappear from public listing list/detail responses");
  mustContain(checklist, "docs/25-validation-and-regression-checklist.md", "admin can approve a rejected listing image");
  mustContain(checklist, "docs/25-validation-and-regression-checklist.md", "image review audit metadata does not include raw reason");
}

if (problems.length > 0) {
  console.error("Backoffice image review security guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Backoffice image review security guard passed.");
