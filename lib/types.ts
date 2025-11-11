// Data types for the event registration system

export type Tanzeem = "Under 7" | "Atfal" | "Khuddam" | "Nasrat" | "Lajna" | "Ansar" | "Guests"

export interface TajneedMember {
  id: string
  eventId: string
  fullName: string
  tanzeem: Tanzeem
  region: string
  jamaat: string
  createdAt: string
}

export interface AttendanceRecord {
  id: string
  eventId: string
  memberId: string
  recordedAt: string
  member?: TajneedMember
}

export interface Region {
  id: string
  eventId: string
  name: string
  jamaat: string[]
}

export interface EventSettings {
  id: string
  eventName: string
  startingDate: string
  duration: number
  location: string
  theme: string
  createdAt: string
}

export interface CategoryCount {
  tanzeem: Tanzeem
  count: number
}

export type MovementStatus = "In" | "Out"

export interface SecurityMovement {
  id: string
  eventId: string
  attendanceRecordId: string
  status: MovementStatus
  timestamp: string
  attendanceRecord?: AttendanceRecord
}

export type MealType = "Breakfast" | "Lunch" | "Dinner"
export type DayOfWeek = "Friday" | "Saturday" | "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday"

export interface CateringRecord {
  id: string
  eventId: string
  attendanceRecordId: string
  day: DayOfWeek
  mealType: MealType
  servedAt: string
  attendanceRecord?: AttendanceRecord
}

export type UserRole = "Admin" | "Attendance Register" | "Security Check" | "Catering Service"

export interface User {
  id: string
  username: string
  password: string // Hashed in production
  role: UserRole
  fullName: string
  createdAt: string
  updatedAt: string
}
