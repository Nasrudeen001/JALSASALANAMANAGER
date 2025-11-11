"use client"

import { useState, useEffect, useMemo } from "react"
import { getCateringRecords, removeCateringRecord, getRegions, getSettings } from "@/lib/storage"
import type { CateringRecord, DayOfWeek, MealType, Region, Tanzeem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isAuthenticated, hasAnyRole } from "@/lib/auth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { exportCateringToPDF, exportCateringToExcel } from "@/lib/export"
import { toast } from "sonner"

const DAYS: DayOfWeek[] = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner"]

const TANZEEMS: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

export default function CateringPage() {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | "">("Friday")
  const [selectedMealType, setSelectedMealType] = useState<MealType | "">("Breakfast")
  const [records, setRecords] = useState<CateringRecord[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTanzeem, setFilterTanzeem] = useState<Tanzeem | "">("")
  const [filterRegion, setFilterRegion] = useState("")
  const [filterJamaat, setFilterJamaat] = useState("")
  const [loading, setLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState("")
  const [eventSettings, setEventSettings] = useState<any | undefined>(undefined)
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!hasAnyRole(["Admin", "Catering Service"])) {
      router.push("/")
      return
    }

    // load regions once and records when filters change
    const init = async () => {
      try {
        const [regs, settings] = await Promise.all([getRegions(), getSettings()])
        setRegions(regs)
        setEventTitle(settings?.eventName || "")
        setEventSettings(settings)
      } catch (error) {
        console.error("Error loading regions:", error)
      }
    }

    init()
    loadRecords()
  }, [router, selectedDay, selectedMealType])

  const loadRecords = async () => {
    try {
      setLoading(true)
      const day = selectedDay === "" ? undefined : (selectedDay as DayOfWeek)
      const meal = selectedMealType === "" ? undefined : (selectedMealType as MealType)
      const data = await getCateringRecords(day, meal)
      setRecords(data)
    } catch (error) {
      console.error("Error loading catering records:", error)
    } finally {
      setLoading(false)
    }
  }

  // Get all unique Jamaats from all regions
  const getAllJamaats = () => {
    const all = regions.flatMap((r) => r.jamaat || [])
    return Array.from(new Set(all))
  }

  // If a specific region is selected, filter by region, else show all
  const getJamaatForRegion = (regionName: string) => {
    if (!regionName || regionName === "All Regions") {
      return getAllJamaats()
    }
    const region = regions.find((r) => r.name === regionName)
    return region?.jamaat || []
  }

  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return records.filter((record) => {
      const member = record.attendanceRecord?.member
      if (!member) return false

      const matchesSearch = member.fullName.toLowerCase().includes(term)
      const matchesTanzeem = !filterTanzeem || member.tanzeem === filterTanzeem
      const matchesRegion = !filterRegion || member.region === filterRegion
      const matchesJamaat = !filterJamaat || member.jamaat === filterJamaat

      return matchesSearch && matchesTanzeem && matchesRegion && matchesJamaat
    })
  }, [records, searchTerm, filterTanzeem, filterRegion, filterJamaat])

  const handleRemoveRecord = async (recordId: string) => {
    if (confirm("Remove this record?")) {
      try {
        const success = await removeCateringRecord(recordId)
        if (success) {
          await loadRecords()
        }
      } catch (error) {
        console.error("Error removing catering record:", error)
      }
    }
  }

  if (loading && records.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p>Loading catering records...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 sm:mb-8 text-center px-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Catering - Meal Tracking</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">Track attendees served during meals</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
            <Button
              onClick={() => {
                try {
                  const parts: string[] = []
                  if (selectedDay) parts.push(selectedDay)
                  if (selectedMealType) parts.push(selectedMealType)
                  if (filterTanzeem) parts.push(filterTanzeem)
                  if (filterRegion) parts.push(filterRegion)
                  if (filterJamaat) parts.push(filterJamaat)
                  const recordLabel = parts.length ? `Catering Records (${parts.join(' - ')})` : 'All Catering Records'
                  exportCateringToPDF(filteredRecords, eventTitle, eventSettings, recordLabel)
                  toast.success("PDF exported successfully")
                } catch (error) {
                  toast.error("Failed to export PDF")
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-white w-full sm:w-auto"
            >
              Download PDF
            </Button>
            <Button
              onClick={() => {
                try {
                  const parts: string[] = []
                  if (selectedDay) parts.push(selectedDay)
                  if (selectedMealType) parts.push(selectedMealType)
                  if (filterTanzeem) parts.push(filterTanzeem)
                  if (filterRegion) parts.push(filterRegion)
                  if (filterJamaat) parts.push(filterJamaat)
                  const recordLabel = parts.length ? `Catering Records (${parts.join(' - ')})` : 'All Catering Records'
                  exportCateringToExcel(filteredRecords, `catering-records-${Date.now()}.xlsx`, eventTitle, eventSettings, recordLabel)
                  toast.success("Excel file exported successfully")
                } catch (error) {
                  toast.error("Failed to export Excel file")
                }
              }}
              className="bg-green-700 hover:bg-green-800 text-white w-full sm:w-auto"
            >
              Download Excel
            </Button>
          </div>
        </div>

        {/* Search and Filters (Tanzeem / Region / Jamaat) */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Search</label>
              <Input
                type="text"
                placeholder="Member name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Tanzeem</label>
              <select
                value={filterTanzeem}
                onChange={(e) => setFilterTanzeem(e.target.value as Tanzeem | "")}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
              >
                <option value="">All Tanzeems</option>
                {TANZEEMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Region</label>
              <select
                value={filterRegion}
                onChange={(e) => {
                  setFilterRegion(e.target.value)
                  setFilterJamaat("")
                }}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
              >
                <option value="">All Regions</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Jamaat</label>
              <select
                value={filterJamaat}
                onChange={(e) => setFilterJamaat(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
              >
                <option value="">All Jamaat</option>
                {getJamaatForRegion(filterRegion).map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Day / Meal filters (unchanged) */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Day</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value as DayOfWeek | "")}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
              >
                <option value="">All Days</option>
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Meal Type</label>
              <select
                value={selectedMealType}
                onChange={(e) => setSelectedMealType(e.target.value as MealType | "")}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
              >
                <option value="">All Meals</option>
                {MEAL_TYPES.map((meal) => (
                  <option key={meal} value={meal}>
                    {meal}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Link
                href={`/catering/check?day=${selectedDay || "Friday"}&meal=${selectedMealType || "Breakfast"}`}
                className="block"
              >
                <Button className="w-full bg-primary text-primary-foreground text-sm" disabled={!selectedDay || !selectedMealType}>
                  Check Attendees
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Records Table - Desktop */}
        <div className="bg-card border border-border rounded-lg overflow-hidden hidden md:block">
          <div className="p-4 border-b border-border">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              {selectedDay === "" ? "All Days" : selectedDay} - {selectedMealType === "" ? "All Meals" : selectedMealType} ({records.length} served)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Full Name</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Tanzeem</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Region</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Jamaat</th>
                  {(selectedDay === "" || selectedMealType === "") && (
                    <>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Day</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Meal</th>
                    </>
                  )}
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Served At</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={selectedDay === "" || selectedMealType === "" ? 8 : 6} className="px-6 py-8 text-center text-muted-foreground text-sm">
                      No records found{selectedDay && selectedMealType ? ` for ${selectedDay} - ${selectedMealType}` : ""}. {selectedDay && selectedMealType ? 'Click "Check Attendees" to add records.' : "Select a specific day and meal type to check attendees."}
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm font-medium text-primary">
                        {record.attendanceRecord?.member?.fullName || "Unknown"}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">
                        {record.attendanceRecord?.member?.tanzeem || "-"}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">
                        {record.attendanceRecord?.member?.region || "-"}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">
                        {record.attendanceRecord?.member?.jamaat || "-"}
                      </td>
                      {(selectedDay === "" || selectedMealType === "") && (
                        <>
                          <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.day}</td>
                          <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.mealType}</td>
                        </>
                      )}
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">
                        {new Date(record.servedAt).toLocaleString()}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm">
                        <button
                          onClick={() => handleRemoveRecord(record.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 whitespace-nowrap"
                          title="Remove"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Records Cards - Mobile */}
        <div className="md:hidden space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">
              {selectedDay === "" ? "All Days" : selectedDay} - {selectedMealType === "" ? "All Meals" : selectedMealType}
            </h2>
            <p className="text-xs text-muted-foreground">{records.length} served</p>
          </div>
          {records.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No records found{selectedDay && selectedMealType ? ` for ${selectedDay} - ${selectedMealType}` : ""}. {selectedDay && selectedMealType ? 'Click "Check Attendees" to add records.' : "Select a specific day and meal type to check attendees."}
              </p>
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-primary truncate">{record.attendanceRecord?.member?.fullName || "Unknown"}</h3>
                  </div>
                  <button
                    onClick={() => handleRemoveRecord(record.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 ml-2 flex-shrink-0"
                    title="Remove"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                    <span className="text-muted-foreground">Tanzeem: </span>
                    <span className="text-foreground font-medium">{record.attendanceRecord?.member?.tanzeem || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Region: </span>
                    <span className="text-foreground font-medium">{record.attendanceRecord?.member?.region || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Jamaat: </span>
                    <span className="text-foreground font-medium">{record.attendanceRecord?.member?.jamaat || "-"}</span>
                  </div>
                  {(selectedDay === "" || selectedMealType === "") && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Day: </span>
                        <span className="text-foreground font-medium">{record.day}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Meal: </span>
                        <span className="text-foreground font-medium">{record.mealType}</span>
                      </div>
                    </>
                  )}
                  <div className={selectedDay === "" || selectedMealType === "" ? "" : "col-span-2"}>
                    <span className="text-muted-foreground">Served: </span>
                    <span className="text-foreground font-medium text-[10px]">{new Date(record.servedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

