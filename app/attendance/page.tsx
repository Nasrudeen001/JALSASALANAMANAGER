"use client"

import { useEffect, useState, useMemo } from "react"
import { getAttendanceRecords, removeAttendanceRecord, getSettings, getRegions, addAttendanceRecord, getTajneedMembers, saveTajneedMemberWithId, getCurrentEventId, findMemberByQRCodeId } from "@/lib/storage"
import type { AttendanceRecord, Region, EventSettings, Tanzeem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { isAuthenticated, hasAnyRole } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { exportAttendanceToPDF, exportAttendanceToExcel } from "@/lib/export"
import { QRScanner } from "@/components/qr-scanner"
import { EditMemberDialog } from "@/components/edit-member-dialog"
import { toast } from "sonner"

export default function AttendancePage() {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTanzeem, setFilterTanzeem] = useState<Tanzeem | "">("")
  const [filterRegion, setFilterRegion] = useState("")
  const [filterMajlis, setFilterMajlis] = useState("")
  const [loading, setLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState("")
  const [eventSettings, setEventSettings] = useState<EventSettings | undefined>(undefined)
  const [showScanner, setShowScanner] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [scannedQrId, setScannedQrId] = useState<string | null>(null)

  const categories: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

  const loadData = async () => {
    try {
      const [attendanceData, regionsData, settings] = await Promise.all([
        getAttendanceRecords(),
        getRegions(),
        getSettings(),
      ])
      setRecords(attendanceData)
      setRegions(regionsData)
      setEventTitle(settings?.eventName || "")
      setEventSettings(settings)
    } catch (error) {
      console.error("Error loading attendance records:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!hasAnyRole(["Admin", "Attendance Register"])) {
      router.push("/")
      return
    }

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
  const getAllMajlis = () => {
    const all = regions.flatMap((r) => r.jamaat || [])
    return Array.from(new Set(all))
  }

  // If a specific region is selected, filter by region, else show all
  const getMajlisForRegion = (regionName: string) => {
    if (!regionName || regionName === "All Regions") {
      return getAllMajlis()
    }
    const region = regions.find((r) => r.name === regionName)
    return region?.jamaat || []
  }

  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return records.filter((record) => {
      const member = record.member
      if (!member) return false

  const matchesSearch = member.fullName.toLowerCase().includes(term)
  const matchesCategory = !filterTanzeem || member.tanzeem === filterTanzeem
      const matchesRegion = !filterRegion || member.region === filterRegion
  const matchesMajlis = !filterMajlis || member.jamaat === filterMajlis

      return matchesSearch && matchesCategory && matchesRegion && matchesMajlis
    })
  }, [records, searchTerm, filterTanzeem, filterRegion, filterMajlis])

  const handleRemoveRecord = async (recordId: string) => {
    if (confirm("Remove this member from attendance?")) {
      try {
        const success = await removeAttendanceRecord(recordId)
        if (success) {
          const updated = await getAttendanceRecords()
          setRecords(updated)
          router.refresh() // Refresh router to ensure UI updates
        }
      } catch (error) {
        console.error("Error removing attendance record:", error)
      }
    }
  }

  const handleQRScan = async (scannedText: string) => {
    try {
      // First, refresh records to ensure we have latest data
      const freshRecords = await getAttendanceRecords()
      setRecords(freshRecords)
      
      // Find member by QR code ID (checks both direct ID and QR code mapping)
      // This function handles all the lookup logic including mapping
      let member = await findMemberByQRCodeId(scannedText)

      // If not found, wait a bit and try again (member might have just been saved)
      // This is important because the member might have been just registered
      if (!member) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        member = await findMemberByQRCodeId(scannedText)
      }

      // If still not found, try one more time with a longer delay
      if (!member) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        member = await findMemberByQRCodeId(scannedText)
      }

      if (!member) {
        // Member not found - show edit dialog
        setScannedQrId(scannedText)
        setShowEditDialog(true)
        setShowScanner(false)
        return
      }

      // Member found - check if already in attendance
      const existingRecord = freshRecords.find((r) => r.memberId === member.id)
      if (existingRecord) {
        toast.warning("Already in attendance", {
          description: `${member.fullName} is already marked as present.`,
        })
        setShowScanner(false)
        return
      }

      // Member exists but not in attendance - add them
      const newRecord = await addAttendanceRecord(member.id)
      if (newRecord) {
        // Force refresh to ensure data is displayed
        const updated = await getAttendanceRecords()
        setRecords(updated)
        router.refresh() // Refresh router to ensure UI updates
        setShowScanner(false)
        toast.success("Member added to attendance", {
          description: `${member.fullName} has been successfully added to the attendance list.`,
        })
      } else {
        toast.error("Failed to add member", {
          description: "Could not add member to attendance. Please try again.",
        })
      }
    } catch (error) {
      console.error("Error processing QR scan:", error)
      toast.error("Error processing scan", {
        description: "An error occurred while processing the QR code. Please try again.",
      })
    }
  }

  const handleSaveMember = async (memberData: {
    id: string
    fullName: string
    tanzeem: Tanzeem
    region: string
    jamaat: string
  }) => {
    try {
      const eventId = getCurrentEventId()
      if (!eventId) {
        toast.error("No event selected", {
          description: "Please select an event first.",
        })
        return
      }

      // Save member to Tajneed with the QR code ID
      // This now properly awaits the QR mapping persistence
      const savedMember = await saveTajneedMemberWithId({
        id: memberData.id,
        eventId,
        fullName: memberData.fullName,
        tanzeem: memberData.tanzeem,
        region: memberData.region,
        jamaat: memberData.jamaat,
      })

      if (!savedMember) {
        toast.error("Failed to save member", {
          description: "Could not save member details. Please try again.",
        })
        return
      }

      // Log successful save with mapping confirmation
      console.log("Member saved successfully:", { 
        qrCodeId: memberData.id, 
        savedMemberId: savedMember.id,
        memberName: savedMember.fullName 
      })
      
      // Wait a bit to ensure member is fully saved and indexed in the database
      await new Promise((resolve) => setTimeout(resolve, 300))
      
      // Verify we can find the member by QR code ID
      const verifyMember = await findMemberByQRCodeId(memberData.id)
      if (!verifyMember) {
        console.warn("Warning: Member not found immediately after saving. Retrying...")
        // Try one more time after a longer delay
        await new Promise((resolve) => setTimeout(resolve, 500))
        const retryVerify = await findMemberByQRCodeId(memberData.id)
        if (!retryVerify) {
          console.error("Error: Member still not found after retry. QR mapping may not have been saved.")
        } else {
          console.log("Member verified on retry:", memberData.id)
        }
      } else {
        console.log("Member verified and can be found by QR code ID:", memberData.id)
      }

      // Refresh records before checking to ensure we have the latest data
      const currentRecords = await getAttendanceRecords()
      setRecords(currentRecords)
      
      // Check if already in attendance (in case it was added somehow)
      const existingRecord = currentRecords.find((r) => r.memberId === savedMember.id)
      if (existingRecord) {
        // Already in attendance - just close dialog
        setShowEditDialog(false)
        setScannedQrId(null)
        toast.warning("Already in attendance", {
          description: `${memberData.fullName} is already in the attendance list.`,
        })
        return
      }
      
      const newRecord = await addAttendanceRecord(savedMember.id)
      if (newRecord) {
        // Refresh attendance records to update the list
        const updatedRecords = await getAttendanceRecords()
        setRecords(updatedRecords)
        router.refresh() // Refresh router to ensure UI updates
        
        // Close dialog immediately on success
        setShowEditDialog(false)
        setScannedQrId(null)
        
        // Show success toast
        toast.success("Member registered and added to attendance", {
          description: `${memberData.fullName} has been registered and added to the attendance list.`,
        })
        return // Exit early on success
      }
      
      // If adding to attendance failed, try again with a longer delay
      // This handles cases where the member was just created and needs time to propagate
      setTimeout(async () => {
        const retryRecord = await addAttendanceRecord(savedMember.id)
        if (retryRecord) {
          const updatedRecords = await getAttendanceRecords()
          setRecords(updatedRecords)
          router.refresh() // Refresh router to ensure UI updates
          
          // Close dialog on successful retry
          setShowEditDialog(false)
          setScannedQrId(null)
          
          toast.success("Member added to attendance", {
            description: `${memberData.fullName} has been added to the attendance list.`,
          })
          return
        }
        
        // Final attempt - try one more time
        setTimeout(async () => {
          const finalRetry = await addAttendanceRecord(savedMember.id)
          if (finalRetry) {
            const updatedRecords = await getAttendanceRecords()
            setRecords(updatedRecords)
            router.refresh() // Refresh router to ensure UI updates
            
            // Close dialog on successful final retry
            setShowEditDialog(false)
            setScannedQrId(null)
            
            toast.success("Member added to attendance", {
              description: `${memberData.fullName} has been added to the attendance list.`,
            })
          } else {
            // Only show warning if all attempts failed - dialog stays open so user can try again
            toast.warning("Member registered but not added to attendance", {
              description: `${memberData.fullName} has been registered, but could not be added to attendance. Please add manually from the attendance page.`,
            })
          }
        }, 1000)
      }, 500)
    } catch (error) {
      console.error("Error saving member:", error)
      toast.error("Error saving member", {
        description: "An error occurred while saving the member. Please try again.",
      })
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading attendance records...</div>
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 sm:mb-8 text-center px-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Attendance</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">Track members marked present</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center mt-4">
            <Link href="/attendance/add" className="w-full sm:w-auto">
              <Button className="bg-primary text-primary-foreground w-full sm:w-auto">+ Add Attendee</Button>
            </Link>
            <Button
              onClick={() => setShowScanner(true)}
              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
            >
              📷 Scan QR Code
            </Button>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-6 justify-center px-2">
          <Button
            onClick={() => {
              const parts: string[] = []
              if (filterTanzeem) parts.push(filterTanzeem)
              if (filterRegion) parts.push(filterRegion)
              if (filterMajlis) parts.push(filterMajlis)
              const recordLabel = parts.length ? `Attendance Records (${parts.join(' - ')})` : 'All Attendance Records'
              exportAttendanceToPDF(filteredRecords, `attendance-records-${Date.now()}.pdf`, eventTitle, eventSettings, recordLabel)
            }}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto text-sm"
          >
            Download PDF
          </Button>
          <Button
            onClick={async () => {
              const parts: string[] = []
              if (filterTanzeem) parts.push(filterTanzeem)
              if (filterRegion) parts.push(filterRegion)
              if (filterMajlis) parts.push(filterMajlis)
              const recordLabel = parts.length ? `Attendance Records (${parts.join(' - ')})` : 'All Attendance Records'
              await exportAttendanceToExcel(filteredRecords, `attendance-records-${Date.now()}.xlsx`, eventTitle, eventSettings, recordLabel)
            }}
            className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto text-sm"
          >
            Download Excel
          </Button>
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
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
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
                  setFilterMajlis("")
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
                value={filterMajlis}
                onChange={(e) => setFilterMajlis(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
              >
                <option value="">All Jamaat</option>
                {getMajlisForRegion(filterRegion).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Attendance Table - Desktop */}
        <div className="bg-card border border-border rounded-lg overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Full Name</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Tanzeem</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Region</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Jamaat</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Recorded At</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      {records.length === 0
                        ? "No attendance recorded yet"
                        : "No records match the current filters"}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm font-medium text-primary">
                        {record.member?.fullName || "Unknown"}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.member?.tanzeem || "-"}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.member?.region || "-"}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{record.member?.jamaat || "-"}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">
                        {new Date(record.recordedAt).toLocaleString()}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveRecord(record.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 whitespace-nowrap"
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attendance Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {filteredRecords.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">
                {records.length === 0
                  ? "No attendance recorded yet"
                  : "No records match the current filters"}
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <div key={record.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-primary truncate">{record.member?.fullName || "Unknown"}</h3>
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
                  <div>
                    <span className="text-muted-foreground">Recorded: </span>
                    <span className="text-foreground font-medium text-[10px]">{new Date(record.recordedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {records.length > 0 && (
          <div className="mt-8 bg-card border border-border rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Showing {filteredRecords.length} of {records.length} attendance records
            </p>
          </div>
        )}
      </div>

      {showScanner && (
        <QRScanner
          title="Scan Member ID for Attendance"
          onScanSuccess={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showEditDialog && scannedQrId && (
        <EditMemberDialog
          qrCodeId={scannedQrId}
          onSave={handleSaveMember}
          onClose={() => {
            setShowEditDialog(false)
            setScannedQrId(null)
          }}
          initialRegions={regions}
        />
      )}
    </main>
  )
}

