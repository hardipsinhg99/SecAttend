ALTER TABLE "Location"
ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Location_status_name_idx" ON "Location"("status", "name");
