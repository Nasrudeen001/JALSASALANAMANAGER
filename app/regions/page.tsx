"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getRegions, updateRegion, deleteRegion, addJamaat, deleteJamaat } from "@/lib/storage"
import type { Region } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isAuthenticated, isAdmin } from "@/lib/auth"
import { Trash2, Plus, Edit2, X } from "lucide-react"

export default function RegionsPage() {
  const router = useRouter()
  const [regions, setRegions] = useState<Region[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ regionName: "", jamaatName: "" })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!isAdmin()) {
      router.push("/")
      return
    }

    const loadData = async () => {
      try {
        const regionsData = await getRegions()
        setRegions(regionsData)
      } catch (error) {
        console.error("Error loading regions:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleUpdateRegion = async () => {
    if (!formData.regionName.trim()) return

    try {
      if (editingId) {
        const success = await updateRegion(editingId, { name: formData.regionName })
        if (success) {
          const updatedRegions = await getRegions()
          setRegions(updatedRegions)
          setEditingId(null)
        }
      }

  setFormData({ regionName: "", jamaatName: "" })
    } catch (error) {
      console.error("Error updating region:", error)
    }
  }

  const handleAddJamaat = async (regionId: string) => {
    if (!formData.jamaatName.trim()) return

    try {
      const region = regions.find((r) => r.id === regionId)
      if (region && !region.jamaat.includes(formData.jamaatName)) {
        const success = await addJamaat(regionId, formData.jamaatName)
        if (success) {
          const updatedRegions = await getRegions()
          setRegions(updatedRegions)
          setFormData({ regionName: "", jamaatName: "" })
        }
      }
    } catch (error) {
      console.error("Error adding jamaat:", error)
    }
  }

  const handleRemoveJamaat = async (regionId: string, jamaat: string) => {
    try {
      const success = await deleteJamaat(regionId, jamaat)
      if (success) {
        const updatedRegions = await getRegions()
        setRegions(updatedRegions)
      }
    } catch (error) {
      console.error("Error removing jamaat:", error)
    }
  }

  const handleDeleteRegion = async (id: string) => {
    try {
      const success = await deleteRegion(id)
      if (success) {
        const updatedRegions = await getRegions()
        setRegions(updatedRegions)
      }
    } catch (error) {
      console.error("Error deleting region:", error)
    }
  }

  const handleEdit = (region: Region) => {
    setEditingId(region.id)
    setFormData({ regionName: region.name, jamaatName: "" })
  }

  if (loading) {
    return <div className="p-8 text-center">Loading regions...</div>
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Regions & Jamaat</h1>
          <Button onClick={() => router.push("/regions/add-region")} className="bg-primary text-primary-foreground w-full sm:w-auto text-sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Region
          </Button>
        </div>

        {/* Regions List */}
        <div className="space-y-4">
          {regions.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">No regions added yet. Create one to get started.</p>
            </div>
          ) : (
            regions.map((region) => (
              <div key={region.id} className="bg-card border border-border rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">{region.name}</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {editingId === region.id ? (
                      <>
                        <Button onClick={handleUpdateRegion} className="bg-primary text-primary-foreground" size="sm">
                          Save
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingId(null)
                            setFormData({ regionName: "", jamaatName: "" })
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleEdit(region)}
                          variant="outline"
                          size="sm"
                          className="text-secondary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteRegion(region.id)}
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {editingId === region.id && (
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <Input
                      type="text"
                      value={formData.regionName}
                      onChange={(e) => setFormData({ ...formData, regionName: e.target.value })}
                      placeholder="Edit region name..."
                      className="w-full"
                    />
                  </div>
                )}

                {/* Jamaat List */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Jamaat ({region.jamaat.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {region.jamaat.map((jamaat) => (
                      <div key={jamaat} className="bg-muted rounded-full px-3 py-1 text-sm flex items-center gap-2">
                        {jamaat}
                        <button
                          onClick={() => handleRemoveJamaat(region.id, jamaat)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Jamaat to Region */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="text"
                    placeholder="Add new jamaat..."
                    value={editingId === region.id ? formData.jamaatName : ""}
                    onChange={(e) => {
                      if (editingId === region.id) {
                        setFormData({ ...formData, jamaatName: e.target.value })
                      }
                    }}
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => {
                      setEditingId(region.id)
                      handleAddJamaat(region.id)
                    }}
                    className="bg-secondary text-secondary-foreground w-full sm:w-auto text-sm"
                  >
                    Add Jamaat
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
