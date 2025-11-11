"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getTajneedMembers,
  deleteTajneedMember,
  getRegions,
  updateTajneedMember,
  getSettings,
} from "@/lib/storage"
import type { TajneedMember, Region, Tanzeem, EventSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { isAuthenticated, hasAnyRole } from "@/lib/auth"
import { useRouter } from "next/navigation"
import {
  exportTajneedToPDF,
  exportTajneedToExcel,
  generateTajneedIDCards,
  generateSingleTajneedIDCard,
  generateSurplusIDCards,
} from "@/lib/export"

export default function TajneedPage() {
  const router = useRouter()
  const [members, setMembers] = useState<TajneedMember[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTanzeem, setFilterTanzeem] = useState<Tanzeem | "">("")
  const [filterRegion, setFilterRegion] = useState("")
  const [filterJamaat, setFilterJamaat] = useState("")
  const [viewingMember, setViewingMember] = useState<TajneedMember | null>(null)
  const [editingMember, setEditingMember] = useState<TajneedMember | null>(null)
  const [editFormData, setEditFormData] = useState<Partial<TajneedMember>>({})
  const [loading, setLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState("")
  const [eventSettings, setEventSettings] = useState<EventSettings | undefined>(undefined)
  const [generatingIDs, setGeneratingIDs] = useState(false)
  const [generatingSurplusIDs, setGeneratingSurplusIDs] = useState(false)

  const tanzeems: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

  const loadData = async () => {
    try {
      const [membersData, regionsData, settings] = await Promise.all([
        getTajneedMembers(),
        getRegions(),
        getSettings(),
      ])
      setMembers(membersData)
      setRegions(regionsData)
      setEventTitle(settings?.eventName || "")
      setEventSettings(settings)
    } catch (error) {
      console.error("Error loading tajneed data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!hasAnyRole(["Admin"])) {
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

  const handleDeleteMember = async (id: string) => {
    if (confirm("Are you sure you want to delete this member?")) {
      try {
        const success = await deleteTajneedMember(id)
        if (success) {
          const updated = await getTajneedMembers()
          setMembers(updated)
          router.refresh() // Refresh router to ensure UI updates
        }
      } catch (error) {
        console.error("Error deleting member:", error)
      }
    }
  }

  const handleEditMember = (member: TajneedMember) => {
    setEditingMember(member)
    setEditFormData(member)
  }

  const handleSaveEdit = async () => {
    if (editingMember && editFormData.fullName && editFormData.region && editFormData.jamaat) {
      try {
        const success = await updateTajneedMember(editingMember.id, {
          fullName: editFormData.fullName,
          tanzeem: editFormData.tanzeem,
          region: editFormData.region,
          jamaat: editFormData.jamaat,
        })

        if (success) {
          const updated = await getTajneedMembers()
          setMembers(updated)
          router.refresh() // Refresh router to ensure UI updates
          setEditingMember(null)
          setEditFormData({})
        }
      } catch (error) {
        console.error("Error updating member:", error)
      }
    }
  }

  const filteredMembers = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return members.filter((member) => {
      const matchesSearch = member.fullName.toLowerCase().includes(term)
      const matchesTanzeem = !filterTanzeem || member.tanzeem === filterTanzeem
      const matchesRegion = !filterRegion || member.region === filterRegion
      const matchesJamaat = !filterJamaat || member.jamaat === filterJamaat

      return matchesSearch && matchesTanzeem && matchesRegion && matchesJamaat
    })
  }, [members, searchTerm, filterTanzeem, filterRegion, filterJamaat])

  const handleGenerateAllIDs = async () => {
    if (members.length === 0) {
      alert("No members to generate IDs for")
      return
    }
    setGeneratingIDs(true)
    try {
      await generateTajneedIDCards(members, `tajneed-ids-${Date.now()}.pdf`, eventTitle, eventSettings)
    } catch (error) {
      console.error("Error generating IDs:", error)
    } finally {
      setGeneratingIDs(false)
    }
  }

  const handleGenerateSingleID = async (member: TajneedMember) => {
    try {
      await generateSingleTajneedIDCard(member, `tajneed-id-${member.id}-${Date.now()}.pdf`, eventTitle, eventSettings)
    } catch (error) {
      console.error("Error generating ID:", error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading tajneed data...</div>
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 text-center px-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Tajneed</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">Manage all registered members</p>
          <Link href="/tajneed/register" className="w-full sm:w-auto mt-4">
            <Button className="bg-primary text-primary-foreground w-full sm:w-auto">+ Add Member</Button>
          </Link>
        </div>

        {/* Export and ID Generation Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-6 justify-center px-2">
          <Button
            onClick={() => {
              const parts: string[] = []
              if (filterTanzeem) parts.push(filterTanzeem)
              if (filterRegion) parts.push(filterRegion)
              if (filterJamaat) parts.push(filterJamaat)
              const recordLabel = parts.length ? `Tajneed Members (${parts.join(' - ')})` : 'All Tajneed Members'
              exportTajneedToPDF(filteredMembers, `tajneed-members-${Date.now()}.pdf`, eventTitle, eventSettings, recordLabel)
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
              if (filterJamaat) parts.push(filterJamaat)
              const recordLabel = parts.length ? `Tajneed Members (${parts.join(' - ')})` : 'All Tajneed Members'
              await exportTajneedToExcel(filteredMembers, `tajneed-members-${Date.now()}.xlsx`, eventTitle, eventSettings, recordLabel)
            }}
            className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto text-sm"
          >
            Download Excel
          </Button>
          <Button
            onClick={handleGenerateAllIDs}
            disabled={generatingIDs || members.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto text-sm"
          >
            {generatingIDs ? "Generating..." : "Generate ID"}
          </Button>
          <Button
            onClick={async () => {
              setGeneratingSurplusIDs(true)
              try {
                await generateSurplusIDCards(eventTitle, eventSettings)
              } catch (error) {
                console.error("Error generating surplus IDs:", error)
              } finally {
                setGeneratingSurplusIDs(false)
              }
            }}
            disabled={generatingSurplusIDs}
            className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto text-sm"
          >
            {generatingSurplusIDs ? "Generating..." : "Generate Surplus IDs"}
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
                {tanzeems.map((tanzeem) => (
                  <option key={tanzeem} value={tanzeem}>
                    {tanzeem}
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

        {/* Members Table - Desktop */}
        <div className="bg-card border border-border rounded-lg overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Full Name</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Tanzeem</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Region</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Jamaat</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No members found
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm font-medium text-primary">{member.fullName}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{member.tanzeem}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{member.region}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{member.jamaat}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <button
                            onClick={() => handleGenerateSingleID(member)}
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 whitespace-nowrap"
                            title="Generate ID Card"
                          >
                            ID
                          </button>
                          <button
                            onClick={() => setViewingMember(member)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 whitespace-nowrap"
                            title="View"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditMember(member)}
                            className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 whitespace-nowrap"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 whitespace-nowrap"
                            title="Delete"
                          >
                            Delete
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

        {/* Members Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {filteredMembers.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">No members found</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div key={member.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-primary truncate">{member.fullName}</h3>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Tanzeem: </span>
                    <span className="text-foreground font-medium">{member.tanzeem}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Region: </span>
                    <span className="text-foreground font-medium">{member.region}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Jamaat: </span>
                    <span className="text-foreground font-medium">{member.jamaat}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => handleGenerateSingleID(member)}
                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    title="Generate ID Card"
                  >
                    ID
                  </button>
                  <button
                    onClick={() => setViewingMember(member)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    title="View"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleEditMember(member)}
                    className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        <div className="mt-8 bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {filteredMembers.length} of {members.length} registered members
          </p>
        </div>

        {/* View Modal */}
        {viewingMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-card rounded-lg p-6 sm:p-8 max-w-md w-full my-4">
              <h2 className="text-2xl font-bold text-primary mb-4 text-center">Member Details</h2>
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="text-lg font-semibold text-foreground">{viewingMember.fullName}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Tanzeem</p>
                  <p className="text-lg font-semibold text-foreground">{viewingMember.tanzeem}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Region</p>
                  <p className="text-lg font-semibold text-foreground">{viewingMember.region}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Jamaat</p>
                  <p className="text-lg font-semibold text-foreground">{viewingMember.jamaat}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Registered At</p>
                  <p className="text-lg font-semibold text-foreground">
                    {new Date(viewingMember.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button onClick={() => setViewingMember(null)} className="w-full mt-6 bg-primary text-primary-foreground">
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-card rounded-lg p-6 sm:p-8 max-w-md w-full my-4">
              <h2 className="text-2xl font-bold text-primary mb-4 text-center">Edit Member</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 text-center">Full Name</label>
                  <Input
                    type="text"
                    value={editFormData.fullName || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 text-center">Tanzeem</label>
                  <select
                    value={editFormData.tanzeem || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, tanzeem: e.target.value as Tanzeem })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    {tanzeems.map((tanzeem) => (
                      <option key={tanzeem} value={tanzeem}>
                        {tanzeem}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 text-center">Region</label>
                  <select
                    value={editFormData.region || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, region: e.target.value, jamaat: "" })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Select Region</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 text-center">Jamaat</label>
                  <select
                    value={editFormData.jamaat || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, jamaat: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    disabled={!editFormData.region}
                  >
                    <option value="">Select Jamaat</option>
                    {getJamaatForRegion(editFormData.region || "").map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button onClick={handleSaveEdit} className="flex-1 bg-primary text-primary-foreground">
                  Save
                </Button>
                <Button onClick={() => setEditingMember(null)} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

