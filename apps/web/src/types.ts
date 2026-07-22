export type Role = 'ADMIN' | 'MANAGER';
export type Status = 'ACTIVE' | 'INACTIVE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'ON_LEAVE';
export type ShiftType = 'DAY' | 'NIGHT' | 'ROTATING';
export interface Location { id: string; name: string; address?: string; clientName?: string; status?: Status; createdAt?: string; _count?: { guards: number; managers: number } }
export interface User { id: string; name: string; email: string; phone?: string; role: Role; status?: Status; locations: Location[] }
export interface Guard { id: string; name: string; employeeId: string; provisionalEmployeeId?: boolean; phone?: string; email?: string; address?: string; photoUrl?: string; joiningDate?: string; project?: string; village?: string; shiftType?: ShiftType; postDetail?: string; designation?: 'SECURITY_GUARD' | 'SUPERVISOR'; guardMonthlySalary: string | number; companyMonthlySalary: string | number; status: Status; locationId: string; location: Location; attendance?: { id: string; status: AttendanceStatus; markedAt: string } | null }
export interface Manager { id: string; name: string; email: string; phone: string; status: Status; locations: Location[]; createdAt: string }
export interface DashboardData { stats: { totalGuards: number; activeManagers: number; markedToday: number; presentToday: number; absentToday: number; leaveToday: number; attendancePercent: number; unmarkedToday: number; monthlyGuardPayroll: number; monthlyCompanyBilling: number }; locationStats: Location[]; recentActivity: { id: string; action: string; entity: string; createdAt: string; actor?: { name: string } }[] }
