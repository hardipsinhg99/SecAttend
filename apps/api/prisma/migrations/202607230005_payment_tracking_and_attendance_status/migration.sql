UPDATE "Attendance" SET "status" = 'ABSENT' WHERE "status" = 'ON_LEAVE';

ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');
ALTER TABLE "Attendance" ALTER COLUMN "status" TYPE "AttendanceStatus" USING ("status"::text::"AttendanceStatus");
DROP TYPE "AttendanceStatus_old";

CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

CREATE TABLE "PayrollPayment" (
  "id" TEXT NOT NULL,
  "guardId" TEXT NOT NULL,
  "monthYear" DATE NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "paidAt" TIMESTAMP(3),
  "note" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollPayment_guardId_monthYear_key" ON "PayrollPayment"("guardId", "monthYear");
CREATE INDEX "PayrollPayment_monthYear_status_idx" ON "PayrollPayment"("monthYear", "status");

ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
