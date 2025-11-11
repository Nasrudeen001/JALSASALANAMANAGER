"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getAttendanceRecords, addCateringRecord, getCateringRecords, findMemberByQRCodeId, findAttendanceRecordByQRCodeId } from "@/lib/storage"
import type { AttendanceRecord, DayOfWeek, MealType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { isAuthenticated, hasAnyRole } from "@/lib/auth"
import { QRScanner } from "@/components/qr-scanner"
import { toast } from "sonner"

export default function CateringCheckPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const day = (searchParams.get("day") || "Friday") as DayOfWeek
  const meal = (searchParams.get("meal") || "Breakfast") as MealType

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<Record<string, boolean>>({})
  const [showScanner, setShowScanner] = useState(false)

  const loadData = async () => {
    try {
      const [records, existingRecords] = await Promise.all([
        getAttendanceRecords(),
        getCateringRecords(day, meal),
      ])
      setAttendanceRecords(records)
      // Mark already checked records
      const checkedSet = new Set(existingRecords.map((r) => r.attendanceRecordId))
      setCheckedIds(checkedSet)
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

    if (!hasAnyRole(["Admin", "Catering Service"])) {
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
  }, [router, day, meal])

  const handleCheck = async (recordId: string) => {
    if (checkedIds.has(recordId)) {
      return // Already checked
    }

    setChecking((prev) => ({ ...prev, [recordId]: true }))

    try {
      const success = await addCateringRecord(recordId, day, meal)
      if (success) {
        setCheckedIds((prev) => new Set([...prev, recordId]))
        const record = attendanceRecords.find((r) => r.id === recordId)
        toast.success("Member marked as served", {
          description: `${record?.member?.fullName || "Member"} has been checked for ${day} - ${meal}.`,
        })
      } else {
        toast.warning("Already checked", {
          description: "This attendee has already been checked for this meal.",
        })
      }
    } catch (error) {
      console.error("Error checking attendee:", error)
      toast.error("Failed to check attendee", {
        description: "An error occurred. Please try again.",
      })
    } finally {
      setChecking((prev) => ({ ...prev, [recordId]: false }))
    }
  }

  const handleQRScan = async (scannedText: string) => {
    try {
      // Find attendance record by QR code ID (this handles both direct ID and QR code mapping)
      // Refresh attendance records first to ensure we have the latest data
      const latestRecords = await getAttendanceRecords()
      setAttendanceRecords(latestRecords)
      
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

      // Check if already served
      if (checkedIds.has(record.id)) {
        toast.warning("Already served", {
          description: `${record.member?.fullName || "Member"} has already been marked as served for ${day} - ${meal}.`,
        })
        setShowScanner(false)
        return
      }

      // Mark as served
      await handleCheck(record.id)
      setShowScanner(false)
    } catch (error) {
      console.error("Error processing QR scan:", error)
      toast.error("Error processing scan", {
        description: "An error occurred while processing the QR code. Please try again.",
      })
    }
  }

  const handleDone = () => {
    router.push(`/catering?day=${day}&meal=${meal}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p>Loading attendees...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Check Attendees</h1>
          <p className="text-muted-foreground mt-2">
            {day} - {meal}
          </p>
          <Button
            onClick={() => setShowScanner(true)}
            className="bg-green-600 hover:bg-green-700 text-white mt-4"
          >
            📷 Scan QR Code
          </Button>
        </div>

        {/* Summary */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Attendees</p>
              <p className="text-2xl font-bold text-primary">{attendanceRecords.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Checked</p>
              <p className="text-2xl font-bold text-green-600">{checkedIds.size}</p>
            </div>
            <Button onClick={handleDone} className="bg-primary text-primary-foreground">
              Done
            </Button>
          </div>
        </div>

        {/* Attendees Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Full Name</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Tanzeem</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Region</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Jamaat</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No attendees found. Please add attendees in the Attendance page first.
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((record) => {
                    const isChecked = checkedIds.has(record.id)
                    const isChecking = checking[record.id] || false

                    return (
                      <tr
                        key={record.id}
                        className={`border-b border-border hover:bg-muted transition-colors ${
                          isChecked ? "bg-green-50" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-primary text-center">
                          {record.member?.fullName || "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground text-center">
                          {record.member?.tanzeem || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground text-center">
                          {record.member?.region || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground text-center">
                          {record.member?.jamaat || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-center">
                          {isChecked ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Checked
                            </span>
                          ) : (
                            <Button
                              onClick={() => handleCheck(record.id)}
                              disabled={isChecking}
                              className="bg-primary text-primary-foreground"
                            >
                              {isChecking ? "Checking..." : "Check"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showScanner && (
          <QRScanner
            title={`Scan Member ID for ${day} - ${meal}`}
            onScanSuccess={handleQRScan}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
    </main>
  )
}

