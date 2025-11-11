"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getTajneedMembers,
  getAttendanceRecords,
  addAttendanceRecord,
} from "@/lib/storage"
import type { TajneedMember, AttendanceRecord, Tanzeem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isAuthenticated, hasAnyRole } from "@/lib/auth"
import { useRouter } from "next/navigation"

export default function AttendanceAddPage() {
  const router = useRouter()
  const [members, setMembers] = useState<TajneedMember[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<Tanzeem | "">("")
  const [regionFilter, setRegionFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<string[]>([])

  const categories: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!hasAnyRole(["Admin", "Attendance Register"])) {
      router.push("/")
      return
    }

    const loadData = async () => {
      try {
        const [membersData, attendanceData] = await Promise.all([getTajneedMembers(), getAttendanceRecords()])
        setMembers(membersData)
        setAttendance(attendanceData)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const attendanceIds = useMemo(() => new Set(attendance.map((record) => record.memberId)), [attendance])

  const filteredMembers = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return members.filter((member) => {
      const matchesSearch = member.fullName.toLowerCase().includes(term)
  const matchesCategory = !categoryFilter || member.tanzeem === categoryFilter
      const matchesRegion = !regionFilter || member.region === regionFilter
      return matchesSearch && matchesCategory && matchesRegion
    })
  }, [members, searchTerm, categoryFilter, regionFilter])

  const handleAddToAttendance = async (memberId: string) => {
    if (attendanceIds.has(memberId)) return
    setSavingIds((prev) => [...prev, memberId])

    try {
      const newRecord = await addAttendanceRecord(memberId)
      if (newRecord) {
        setAttendance((prev) => [newRecord, ...prev])
      }
    } catch (error) {
      console.error("Error adding attendance record:", error)
    } finally {
      setSavingIds((prev) => prev.filter((id) => id !== memberId))
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading members...</div>
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Add Attendance</h1>
            <p className="text-muted-foreground">Select members from Tajneed to mark them present.</p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            Back to Attendance
          </Button>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="text"
              placeholder="Search members"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Tanzeem | "")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="">All Tanzeem</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="">All Regions</option>
              {Array.from(new Set(members.map((member) => member.region))).map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Full Name</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Tanzeem</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Region</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Jamaat</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No members match the current filters
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const alreadyAdded = attendanceIds.has(member.id)
                    const saving = savingIds.includes(member.id)
                    return (
                      <tr key={member.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-primary text-center">{member.fullName}</td>
                        <td className="px-6 py-4 text-sm text-foreground text-center">{member.tanzeem}</td>
                        <td className="px-6 py-4 text-sm text-foreground text-center">{member.region}</td>
                        <td className="px-6 py-4 text-sm text-foreground text-center">{member.jamaat}</td>
                        <td className="px-6 py-4 text-sm text-center">
                          <Button
                            disabled={alreadyAdded || saving}
                            onClick={() => handleAddToAttendance(member.id)}
                            className="bg-primary text-primary-foreground"
                          >
                            {alreadyAdded ? "Added" : saving ? "Adding..." : "Add"}
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
      </div>
    </main>
  )
}

