ALTER TABLE "Guard"
ADD COLUMN "companyMonthlySalary" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Guard"
SET "companyMonthlySalary" = "monthlySalary"
WHERE "companyMonthlySalary" = 0;

ALTER TABLE "SalaryRecord"
ADD COLUMN "companyDailyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "companyGrossSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "companyDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "companyNetSalary" DECIMAL(12,2) NOT NULL DEFAULT 0;
