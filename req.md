# SecurityGuard Attendance & Payroll Management System

## 1. Introduction

### 1.1 Purpose
This document outlines the requirements for a **SecurityGuard Attendance & Payroll Management System** designed for a security agency that deploys security guards. The application will streamline attendance tracking, leave management, salary calculation, and reporting for guards and managers.

### 1.2 Scope
- **Users**: Two roles – **Admin** and **Manager**.
- **Core Features**:
  - Guard and Manager management (CRUD).
  - Daily attendance marking with calendar view.
  - Automatic salary calculation based on attendance (deductions for leaves).
  - Excel bulk import for guards.
  - Dashboard and reporting for Admin.
- **Out of Scope**: Advanced biometric integration, mobile app (web-first), payment gateway integration.

### 1.3 Technologies (Recommended)
- **Frontend**: React.js / Next.js (or Vue.js)
- **Backend**: Node.js (Express) / Python (FastAPI/Django)
- **Database**: PostgreSQL / MySQL
- **Authentication**: JWT + Role-based access
- **Calendar**: FullCalendar or React-Calendar
- **Excel Handling**: SheetJS (xlsx) or pandas (Python)

---

## 2. User Roles and Permissions

### 2.1 Admin
- Full system access.
- Manage Guards (Add/Edit/Delete/View).
- Manage Managers (Add/Edit/Delete/View).
- Set/Update Monthly Salary for each guard.
- View all attendance records and salary reports.
- Bulk import guards via Excel.
- Monitor manager compliance (calendar coloring).

### 2.2 Manager
- View assigned guards (by location).
- Mark daily attendance via calendar.
- Mark guards as **Present** or **On Leave**.
- View basic guard information (Name, Photo, Location, Contact).
- Cannot modify salaries or user accounts.

---

## 3. Functional Requirements

### 3.1 Authentication & Dashboard
- Login page with role-based redirect.
- Dashboard:
  - Admin: Total Guards, Active Managers, Today’s Attendance %, Pending Salaries.
  - Manager: Today’s Attendance summary, Quick calendar link.

### 3.2 Guard & Manager Management (Admin Only)
- **Add Guard**:
  - Fields: Full Name, Employee ID, Phone, Email, Address, Assigned Location, Photo (optional), Monthly Salary.
- **Add Manager**:
  - Fields: Name, Phone, Email, Assigned Locations (multiple possible).
- List view with search and filters (by location, status).
- Edit / Deactivate / Delete.

### 3.3 Bulk Import (Admin Only)
- Upload Excel (.xlsx) file.
- Expected columns:
  - `Name`, `EmployeeID`, `Phone`, `Email`, `Address`, `Location`, `MonthlySalary`
- System validates data and imports valid rows with error report for invalid ones.

### 3.4 Calendar & Attendance (Manager)
- **Calendar View**:
  - Monthly view (default to current month).
  - Color coding:
    - **Green**: Full attendance marked.
    - **Yellow/Orange**: Partial attendance.
    - **Red**: No attendance marked or invalid.
    - **Blue**: Today (default open).
- Click on any date → Open attendance sheet for that date.
- **Attendance Sheet**:
  - List of guards assigned to manager’s location(s).
  - Display: Photo (small), Name, Employee ID, Location.
  - Two buttons per guard: **Present** / **On Leave**.
  - Option to mark all as Present (bulk).
  - Save attendance (with timestamp).
- Attendance can be edited on the same day (configurable window).

### 3.5 Salary Calculation
- **Logic**:
  - Monthly Salary ÷ Number of days in the month = Daily Rate.
  - For each leave day: Deduct 1 × Daily Rate.
  - Example: Monthly Salary = ₹30,000, 31 days → Daily = ₹967.74.
  - 2 leave days → Deduction = ₹1,935.48.
- Salary report generated monthly (end of month or on-demand).
- Admin can view / export salary slip summary per guard.

### 3.6 Reports & Analytics (Admin)
- Attendance Report (filter by date range, guard, location).
- Salary Report (monthly).
- Manager Compliance Report (days attendance was not marked properly).
- Export to Excel/PDF.

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Support up to 500 guards and 50 managers.
- Page load < 2 seconds.
- Attendance save < 1 second.

### 4.2 Security
- Role-based access control (RBAC).
- Password hashing + JWT.
- Rate limiting on login.
- Data encryption at rest (sensitive fields).

### 4.3 Usability
- Mobile responsive (tablet-friendly for managers on site).
- Simple, large buttons for attendance marking.
- Intuitive calendar interface.

### 4.4 Reliability
- Attendance data should be immutable after a grace period (e.g., 48 hours).
- Audit log for all changes.

---

## 5. Data Model (High-Level)

### Entities
1. **User** (Admin + Manager)
   - id, name, email, phone, role, password_hash

2. **Guard**
   - id, name, employee_id, phone, email, address, location, photo_url, monthly_salary, status

3. **Attendance**
   - id, guard_id, date, status (Present/OnLeave), marked_by (manager_id), marked_at

4. **SalaryRecord**
   - id, guard_id, month_year, total_days, leave_days, daily_rate, total_salary, deductions

---

## 6. Frontend Requirements

- Responsive UI (Tailwind CSS recommended).
- Calendar component with color indicators.
- Modal for attendance marking.
- Data tables with sorting, filtering, pagination.
- Excel upload with progress and validation preview.
- Charts (optional: attendance trend using Chart.js).

## 7. Backend Requirements

- RESTful APIs or GraphQL.
- Key Endpoints:
  - `/auth/login`
  - `/guards` (CRUD + import)
  - `/managers` (CRUD)
  - `/attendance/:date` (GET/POST)
  - `/calendar/summary`
  - `/salary/calculate/:month`
  - `/reports/...`

- Background jobs for monthly salary generation.
- Input validation and error handling.

---

## 8. Assumptions & Future Enhancements

**Assumptions**:
- One location per guard initially (can be extended).
- Managers are assigned to one or more locations.
- Leaves are only "On Leave" (no half-day or other types initially).

**Future Enhancements**:
- Guard mobile self-check-in (with GPS).
- Notification system (SMS/Email for low attendance).
- Payroll export to accounting software.
- Leave application workflow.

---

**Document Version**: 1.0  
**Date**: July 2026  
**Prepared for**: Security Agency Development Team