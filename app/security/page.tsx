"use client"

import { useState, useEffect, useMemo } from "react"
import { getAttendanceRecords, findMemberByQRCodeId, findAttendanceRecordByQRCodeId, getRegions, getSettings } from "@/lib/storage"
import { getSecurityStatusForAttendance, toggleSecurityMovement } from "@/lib/storage"
import type { AttendanceRecord, MovementStatus, Region, Tanzeem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isAuthenticated, hasAnyRole, isAdmin } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { QRScanner } from "@/components/qr-scanner"
import { toast } from "sonner"
import { exportSecurityToPDF, exportSecurityToExcel } from "@/lib/export"

export default function SecurityPage() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTanzeem, setFilterTanzeem] = useState<Tanzeem | "">("")
  const [filterRegion, setFilterRegion] = useState("")
  const [filterJamaat, setFilterJamaat] = useState("")
  const [statusMap, setStatusMap] = useState<Record<string, MovementStatus>>({})
  const [loading, setLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState("")
  const [eventSettings, setEventSettings] = useState<any | undefined>(undefined)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [showScanner, setShowScanner] = useState(false)
  const router = useRouter()

  const TANZEEMS: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

  const loadData = async () => {
    try {
      const [records, settings] = await Promise.all([getAttendanceRecords(), getSettings()])
      setAttendanceRecords(records)
      setEventTitle(settings?.eventName || "")
      setEventSettings(settings)

      // Load status for each record
      const statuses: Record<string, MovementStatus> = {}
      for (const record of records) {
        const status = await getSecurityStatusForAttendance(record.id)
        statuses[record.id] = status || "In" // Default to "In" if no status
      }
      setStatusMap(statuses)
    } catch (error) {
      console.error("Error loading security data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!hasAnyRole(["Admin", "Security Check"])) {
      router.push("/")
      return
    }

    // load regions once
    const init = async () => {
      try {
        const regs = await getRegions()
        setRegions(regs)
      } catch (error) {
        console.error("Error loading regions:", error)
      }
    }

    init()
    loadData()

    // Refresh data when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData()
      }
    }

    // Refresh data when window gains focus
    const handleFocus = () => {
      loadData()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [router])

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
    return attendanceRecords.filter((record) => {
      const member = record.member
      if (!member) return false

      const matchesSearch = member.fullName.toLowerCase().includes(term)
      const matchesTanzeem = !filterTanzeem || member.tanzeem === filterTanzeem
      const matchesRegion = !filterRegion || member.region === filterRegion
      const matchesJamaat = !filterJamaat || member.jamaat === filterJamaat

      return matchesSearch && matchesTanzeem && matchesRegion && matchesJamaat
    })
  }, [attendanceRecords, searchTerm, filterTanzeem, filterRegion, filterJamaat])

  const handleToggleStatus = async (recordId: string) => {
    const currentStatus = statusMap[recordId] || "In"
    const newStatus: MovementStatus = currentStatus === "In" ? "Out" : "In"

    setUpdating((prev) => ({ ...prev, [recordId]: true }))

    try {
      const success = await toggleSecurityMovement(recordId, newStatus)
      if (success) {
        setStatusMap((prev) => ({ ...prev, [recordId]: newStatus }))
        const record = attendanceRecords.find((r) => r.id === recordId)
        toast.success(`Status updated to ${newStatus}`, {
          description: `${record?.member?.fullName || "Member"} is now ${newStatus}.`,
        })
      } else {
        toast.error("Failed to update status", {
          description: "Could not update member status. Please try again.",
        })
      }
    } catch (error) {
      console.error("Error toggling status:", error)
      toast.error("Failed to update status", {
        description: "An error occurred. Please try again.",
      })
    } finally {
      setUpdating((prev) => ({ ...prev, [recordId]: false }))
    }
  }

  const handleQRScan = async (scannedText: string) => {
    try {
      // Refresh attendance records first to ensure we have the latest data
      const latestRecords = await getAttendanceRecords()
      setAttendanceRecords(latestRecords)
      
      // Find attendance record by QR code ID (this handles both direct ID and QR code mapping)
      const record = await findAttendanceRecordByQRCodeId(scannedText)

      if (!record) {
        // Check if member exists but not in attendance
        const member = await findMemberByQRCodeId(scannedText)
        if (member) {
          toast.error("Member not found in attendance", {
            description: `${member.fullName} is not in the attendance list. Please add them to attendance first.`,
          })
        } else {
          toast.error("Member not found", {
            description: "This QR code does not match any registered member. Please register the member first.",
          })
        }
        setShowScanner(false)
        return
      }

      // Toggle the status
      await handleToggleStatus(record.id)
      setShowScanner(false)
    } catch (error) {
      console.error("Error processing QR scan:", error)
      toast.error("Error processing scan", {
        description: "An error occurred while processing the QR code. Please try again.",
      })
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p>Loading security data...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 sm:mb-8 text-center px-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Security - Movement Tracking</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">Track attendees entering and leaving the venue</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
            <Button
              onClick={() => setShowScanner(true)}
              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
            >
              📷 Scan QR Code
            </Button>
            <Button
              onClick={() => {
                try {
                  const parts: string[] = []
                  if (filterTanzeem) parts.push(filterTanzeem)
                  if (filterRegion) parts.push(filterRegion)
                  if (filterJamaat) parts.push(filterJamaat)
                  const recordLabel = parts.length ? `Security Records (${parts.join(' - ')})` : 'All Security Records'
                  exportSecurityToPDF(filteredRecords, statusMap, eventTitle, eventSettings, recordLabel)
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
                  if (filterTanzeem) parts.push(filterTanzeem)
                  if (filterRegion) parts.push(filterRegion)
                  if (filterJamaat) parts.push(filterJamaat)
                  const recordLabel = parts.length ? `Security Records (${parts.join(' - ')})` : 'All Security Records'
                  exportSecurityToExcel(filteredRecords, statusMap, `security-records-${Date.now()}.xlsx`, eventTitle, eventSettings, recordLabel)
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

        {/* Search and Filters */}
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

        {/* Security Table - Desktop */}
        <div className="bg-card border border-border rounded-lg overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Full Name</th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Tanzeem</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Region</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Jamaat</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Status</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                        {attendanceRecords.length === 0
                          ? "No attendees found. Please add attendees in the Attendance page first."
                          : "No records match the current filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => {
                    const status = statusMap[record.id] || "In"
                    const isUpdating = updating[record.id] || false

                    return (
                      <tr key={record.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm font-medium text-primary">
                          {record.member?.fullName || "Unknown"}
                        </td>
                    <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.member?.tanzeem || "-"}</td>
                        <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.member?.region || "-"}</td>
                        <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.member?.jamaat || "-"}</td>
                        <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              status === "In"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm">
                          <Button
                            onClick={() => handleToggleStatus(record.id)}
                            disabled={isUpdating}
                            variant={status === "In" ? "destructive" : "default"}
                            className="min-w-[80px] text-xs"
                          >
                            {isUpdating ? "Updating..." : status === "In" ? "Mark Out" : "Mark In"}
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {filteredRecords.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">
                {attendanceRecords.length === 0
                  ? "No attendees found. Please add attendees in the Attendance page first."
                  : "No records match the current filters."}
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => {
              const status = statusMap[record.id] || "In"
              const isUpdating = updating[record.id] || false

              return (
                <div key={record.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-primary truncate">{record.member?.fullName || "Unknown"}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ml-2 flex-shrink-0 ${
                        status === "In"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Tanzeem: </span>
                      <span className="text-foreground font-medium">{record.member?.tanzeem || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Region: </span>
                      <span className="text-foreground font-medium">{record.member?.region || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Jamaat: </span>
                      <span className="text-foreground font-medium">{record.member?.jamaat || "-"}</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={() => handleToggleStatus(record.id)}
                      disabled={isUpdating}
                      variant={status === "In" ? "destructive" : "default"}
                      className="w-full text-xs"
                    >
                      {isUpdating ? "Updating..." : status === "In" ? "Mark Out" : "Mark In"}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Summary - Only show for Admin users */}
        {isAdmin() && attendanceRecords.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Attendees</p>
              <p className="text-2xl font-bold text-primary">{attendanceRecords.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Currently In</p>
              <p className="text-2xl font-bold text-green-600">
                {Object.values(statusMap).filter((status) => status === "In").length}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Currently Out</p>
              <p className="text-2xl font-bold text-red-600">
                {Object.values(statusMap).filter((status) => status === "Out").length}
              </p>
            </div>
          </div>
        )}

        {showScanner && (
          <QRScanner
            title="Scan Member ID for Security Check"
            onScanSuccess={handleQRScan}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
    </main>
  )
}

