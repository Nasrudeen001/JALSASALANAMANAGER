"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getAttendanceRecords,
  getRegions,
  getSettings,
  getCurrentEventId,
  getEventsList,
  setCurrentEventId,
  getSecurityMovements,
  getCateringRecords,
} from "@/lib/storage"
import { isAuthenticated, getUserRole } from "@/lib/auth"
import type { AttendanceRecord, Region, Tanzeem, SecurityMovement, CateringRecord, DayOfWeek, MealType } from "@/lib/types"
import Link from "next/link"

export default function Dashboard() {
  const router = useRouter()
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [eventId, setEventId] = useState("")
  const [hasEvents, setHasEvents] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [securityMovements, setSecurityMovements] = useState<SecurityMovement[]>([])
  const [cateringRecords, setCateringRecords] = useState<CateringRecord[]>([])
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | "">("Friday")
  const [selectedMealType, setSelectedMealType] = useState<MealType | "">("Breakfast")
  
  const DAYS: DayOfWeek[] = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
  const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner"]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    // Get user role
    const role = getUserRole()
    setUserRole(role)

    const loadData = async () => {
      try {
        // First, check if there are any events
        const events = await getEventsList()
        setHasEvents(events.length > 0)

        if (events.length === 0) {
          setLoading(false)
          return
        }

        let currentEventId = getCurrentEventId()
        
        // If no event is selected, automatically select the first one (top of list)
        if (!currentEventId && events.length > 0) {
          currentEventId = events[0].id
          setCurrentEventId(currentEventId)
        }

        setEventId(currentEventId)

        if (!currentEventId) {
          setLoading(false)
          return
        }

        // Load data based on user role
        const role = getUserRole()
        const [attendanceData, regionsData, settingsData] = await Promise.all([
          getAttendanceRecords(),
          getRegions(),
          getSettings(),
        ])

        setAttendanceRecords(attendanceData)
        setRegions(regionsData)
        setSettings(settingsData)

        // Load security data for Security Check role
        if (role === "Security Check" || role === "Admin") {
          const securityData = await getSecurityMovements()
          setSecurityMovements(securityData)
        }

        // Load catering data for Catering Service role (will be reloaded when filters change)
        if (role === "Catering Service" || role === "Admin") {
          const day = selectedDay === "" ? undefined : (selectedDay as DayOfWeek)
          const meal = selectedMealType === "" ? undefined : (selectedMealType as MealType)
          const cateringData = await getCateringRecords(day, meal)
          setCateringRecords(cateringData)
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, selectedDay, selectedMealType])

  const categories: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

  // Helper functions for Attendance Registrar
  const getCategoryCount = (category: Tanzeem) => {
    return attendanceRecords.filter((record) => record.member?.tanzeem === category).length
  }

  const getRegionCount = (regionName: string) => {
    return attendanceRecords.filter((record) => record.member?.region === regionName).length
  }

  const getMajlisCount = (majlisName: string) => {
    return attendanceRecords.filter((record) => record.member?.jamaat === majlisName).length
  }

  const activeRegions = regions.filter((region) =>
    attendanceRecords.some((record) => record.member?.region === region.name),
  )

  const allMajlis = new Set<string>()
  attendanceRecords.forEach((record) => {
    if (record.member?.jamaat) {
      allMajlis.add(record.member.jamaat)
    }
  })

  // Helper functions for Security Check
  const getSecurityStatusCount = (status: "In" | "Out") => {
    // Get latest status for each attendance record
    const statusMap: Record<string, { status: "In" | "Out"; timestamp: string }> = {}
    
    // Initialize all attendance records as "In" by default
    attendanceRecords.forEach((record) => {
      statusMap[record.id] = { status: "In", timestamp: record.recordedAt }
    })
    
    // Update with actual movement records (latest status wins)
    securityMovements.forEach((movement) => {
      const recordId = movement.attendanceRecordId
      const existing = statusMap[recordId]
      if (!existing || new Date(movement.timestamp) > new Date(existing.timestamp)) {
        statusMap[recordId] = { status: movement.status, timestamp: movement.timestamp }
      }
    })
    
    return Object.values(statusMap).filter((s) => s.status === status).length
  }

  const getCurrentlyIn = () => {
    return getSecurityStatusCount("In")
  }

  const getCurrentlyOut = () => {
    return getSecurityStatusCount("Out")
  }

  // Helper functions for Catering Service
  const getTotalServed = () => {
    // Count unique attendance records that have been served
    const servedAttendanceIds = new Set(cateringRecords.map((record) => record.attendanceRecordId))
    return servedAttendanceIds.size
  }

  const getNotServed = () => {
    const servedCount = getTotalServed()
    return attendanceRecords.length - servedCount
  }

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>
  }

  if (!hasEvents) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <h1 className="text-3xl font-bold text-primary mb-4">No Events Available</h1>
          <p className="text-muted-foreground mb-6">Please create an event in Settings to get started.</p>
          <Link href="/settings" className="text-primary hover:underline">
            Go to Settings
          </Link>
        </div>
      </main>
    )
  }

  if (!eventId) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <h1 className="text-3xl font-bold text-primary mb-4">No Event Selected</h1>
          <p className="text-muted-foreground mb-6">Please go to Settings to create or select an event.</p>
          <Link href="/settings" className="text-primary hover:underline">
            Go to Settings
          </Link>
        </div>
      </main>
    )
  }

  // Render role-based dashboard
  const renderDashboard = () => {
    if (userRole === "Attendance Register") {
      return (
        <>
          <div className="mb-6 sm:mb-8 text-center px-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-2">{settings?.eventName || "Jalsa Salana"}</h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">{settings?.theme}</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-card border border-border rounded-lg p-4 sm:p-6 text-center">
              <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-2">Total Present</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">{attendanceRecords.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 sm:p-6 text-center">
              <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-2">Total Regions</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-secondary">{activeRegions.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 sm:p-6 text-center">
              <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-2">Total Jamaat</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-accent">{allMajlis.size}</p>
            </div>
          </div>

          {/* Tanzeem Breakdown */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 text-center">Attendance by Tanzeem</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
              {categories.map((category) => (
                <div key={category} className="bg-muted rounded-lg p-3 sm:p-4 text-center">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">{category}</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary">{getCategoryCount(category)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )
    }

    if (userRole === "Security Check") {
      const totalAttendees = attendanceRecords.length
      const currentlyIn = getCurrentlyIn()
      const currentlyOut = getCurrentlyOut()

      return (
        <>
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-primary mb-2">{settings?.eventName || "Jalsa Salana"}</h1>
            <p className="text-muted-foreground text-lg">{settings?.theme}</p>
          </div>

          {/* Security Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Attendees</p>
              <p className="text-4xl font-bold text-primary">{totalAttendees}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground text-sm font-medium mb-2">Currently In</p>
              <p className="text-4xl font-bold text-green-600">{currentlyIn}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground text-sm font-medium mb-2">Currently Out</p>
              <p className="text-4xl font-bold text-red-600">{currentlyOut}</p>
            </div>
          </div>
        </>
      )
    }

    if (userRole === "Catering Service") {
      const totalAttendance = attendanceRecords.length
      const served = getTotalServed()
      const notServed = getNotServed()

      return (
        <>
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-primary mb-2">{settings?.eventName || "Jalsa Salana"}</h1>
            <p className="text-muted-foreground text-lg">{settings?.theme}</p>
          </div>

          {/* Filter Controls */}
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 text-center">Filter by Day and Meal</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 text-center">Day</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value as DayOfWeek | "")}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 text-center">Meal Type</label>
                <select
                  value={selectedMealType}
                  onChange={(e) => setSelectedMealType(e.target.value as MealType | "")}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  {MEAL_TYPES.map((meal) => (
                    <option key={meal} value={meal}>
                      {meal}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Catering Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Attendance</p>
              <p className="text-4xl font-bold text-primary">{totalAttendance}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground text-sm font-medium mb-2">
                Served ({selectedDay} - {selectedMealType})
              </p>
              <p className="text-4xl font-bold text-green-600">{served}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground text-sm font-medium mb-2">
                Not Served ({selectedDay} - {selectedMealType})
              </p>
              <p className="text-4xl font-bold text-orange-600">{notServed}</p>
            </div>
          </div>
        </>
      )
    }

    // Admin or default dashboard
    return (
      <>
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">{settings?.eventName || "Jalsa Salana"}</h1>
          <p className="text-muted-foreground text-lg">{settings?.theme}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <p className="text-muted-foreground text-sm font-medium mb-2">Total Present</p>
            <p className="text-4xl font-bold text-primary">{attendanceRecords.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <p className="text-muted-foreground text-sm font-medium mb-2">Total Regions</p>
            <p className="text-4xl font-bold text-secondary">{activeRegions.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <p className="text-muted-foreground text-sm font-medium mb-2">Total Jamaat</p>
            <p className="text-4xl font-bold text-accent">{allMajlis.size}</p>
          </div>
        </div>

        {/* Tanzeem Breakdown */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4 text-center">Attendance by Tanzeem</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {categories.map((category) => (
              <div key={category} className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm font-medium text-muted-foreground mb-2">{category}</p>
                <p className="text-2xl font-bold text-primary">{getCategoryCount(category)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href="/attendance/add"
            className="bg-primary text-primary-foreground rounded-lg p-4 sm:p-6 hover:opacity-90 transition-opacity flex flex-col items-center justify-center text-center"
          >
            <div>
              <p className="font-bold text-sm sm:text-base">Mark Attendance</p>
              <p className="text-xs sm:text-sm opacity-90 mt-1">Add members from Tajneed</p>
            </div>
          </Link>
          <Link
            href="/regions"
            className="bg-secondary text-secondary-foreground rounded-lg p-4 sm:p-6 hover:opacity-90 transition-opacity flex flex-col items-center justify-center text-center"
          >
            <div>
              <p className="font-bold text-sm sm:text-base">Add Region/Jamaat</p>
              <p className="text-xs sm:text-sm opacity-90 mt-1">Manage locations</p>
            </div>
          </Link>
          <Link
            href="/tajneed/register"
            className="bg-accent text-accent-foreground rounded-lg p-4 sm:p-6 hover:opacity-90 transition-opacity flex flex-col items-center justify-center text-center"
          >
            <div>
              <p className="font-bold text-sm sm:text-base">Add Tajneed Member</p>
              <p className="text-xs sm:text-sm opacity-90 mt-1">Grow the base list</p>
            </div>
          </Link>
          <Link
            href="/settings"
            className="bg-muted text-foreground border border-border rounded-lg p-4 sm:p-6 hover:opacity-90 transition-opacity flex flex-col items-center justify-center text-center"
          >
            <div>
              <p className="font-bold text-sm sm:text-base">Settings</p>
              <p className="text-xs sm:text-sm opacity-90 mt-1">Configure event</p>
            </div>
          </Link>
        </div>
      </>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {renderDashboard()}
      </div>
    </main>
  )
}
