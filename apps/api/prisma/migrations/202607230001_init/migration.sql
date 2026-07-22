CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ON_LEAVE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "role" "Role" NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Location" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Guard" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "address" TEXT NOT NULL,
  "photoUrl" TEXT,
  "monthlySalary" DECIMAL(12,2) NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "locationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Guard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "guardId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "markedById" TEXT NOT NULL,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalaryRecord" (
  "id" TEXT NOT NULL,
  "guardId" TEXT NOT NULL,
  "monthYear" DATE NOT NULL,
  "totalDays" INTEGER NOT NULL,
  "leaveDays" INTEGER NOT NULL,
  "dailyRate" DECIMAL(12,2) NOT NULL,
  "grossSalary" DECIMAL(12,2) NOT NULL,
  "deductions" DECIMAL(12,2) NOT NULL,
  "netSalary" DECIMAL(12,2) NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalaryRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_ManagerLocations" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");
CREATE UNIQUE INDEX "Guard_employeeId_key" ON "Guard"("employeeId");
CREATE INDEX "Guard_locationId_status_idx" ON "Guard"("locationId", "status");
CREATE INDEX "Guard_name_idx" ON "Guard"("name");
CREATE INDEX "Attendance_date_status_idx" ON "Attendance"("date", "status");
CREATE INDEX "Attendance_markedById_date_idx" ON "Attendance"("markedById", "date");
CREATE UNIQUE INDEX "Attendance_guardId_date_key" ON "Attendance"("guardId", "date");
CREATE INDEX "SalaryRecord_monthYear_idx" ON "SalaryRecord"("monthYear");
CREATE UNIQUE INDEX "SalaryRecord_guardId_monthYear_key" ON "SalaryRecord"("guardId", "monthYear");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE UNIQUE INDEX "_ManagerLocations_AB_unique" ON "_ManagerLocations"("A", "B");
CREATE INDEX "_ManagerLocations_B_index" ON "_ManagerLocations"("B");

ALTER TABLE "Guard" ADD CONSTRAINT "Guard_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_ManagerLocations" ADD CONSTRAINT "_ManagerLocations_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ManagerLocations" ADD CONSTRAINT "_ManagerLocations_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
