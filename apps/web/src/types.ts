export type Role = 'ADMIN' | 'MANAGER';
export type Status = 'ACTIVE' | 'INACTIVE';
export type AttendanceStatus = 'PRESENT' | 'ON_LEAVE';
export interface Location { id: string; name: string; address?: string; _count?: { guards: number; managers: number } }
export interface User { id: string; name: string; email: string; phone?: string; role: Role; status?: Status; locations: Location[] }
export interface Guard { id: string; name: string; employeeId: string; phone: string; email?: string; address: string; photoUrl?: string; monthlySalary: string | number; status: Status; locationId: string; location: Location; attendance?: { id: string; status: AttendanceStatus; markedAt: string } | null }
export interface Manager { id: string; name: string; email: string; phone: string; status: Status; locations: Location[]; createdAt: string }
export interface DashboardData { stats: { totalGuards: number; activeManagers: number; markedToday: number; presentToday: number; leaveToday: number; attendancePercent: number; pendingSalaries: number }; locationStats: Location[]; recentActivity: { id: string; action: string; entity: string; createdAt: string; actor?: { name: string } }[] }
