"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveRegion, getCurrentEventId } from "@/lib/storage"
import type { Region } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function AddRegionPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ regionName: "", jamaatList: [""] })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAddJamaat = () => {
    setFormData({
      ...formData,
      jamaatList: [...formData.jamaatList, ""],
    })
  }

  const handleRemoveJamaat = (index: number) => {
    const newList = formData.jamaatList.filter((_: string, i: number) => i !== index)
    setFormData({
      ...formData,
      jamaatList: newList.length === 0 ? [""] : newList,
    })
  }

  const handleJamaatChange = (index: number, value: string) => {
    const newList = [...formData.jamaatList]
    newList[index] = value
    setFormData({
      ...formData,
      jamaatList: newList,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.regionName.trim()) {
      setError("Region name is required")
      return
    }

    setLoading(true)

    try {
      const eventId = getCurrentEventId()
      if (!eventId) {
        setError("No event selected")
        setLoading(false)
        return
      }

      const jamaatList = formData.jamaatList.filter((m) => m.trim())

      const newRegion: Region = {
        id: "",
        eventId,
        name: formData.regionName,
        jamaat: jamaatList,
      }

      const savedRegion = await saveRegion(newRegion)
      if (savedRegion) {
        router.push("/regions/add-region/success")
      } else {
        setError("Failed to add region")
      }
    } catch (err) {
      setError("Error adding region. Please try again.")
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-primary mb-8 text-center">Add New Region</h1>

        <div className="bg-card border border-border rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 text-center">Region Name *</label>
              <Input
                type="text"
                value={formData.regionName}
                onChange={(e) => setFormData({ ...formData, regionName: e.target.value })}
                className="w-full"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 text-center">Jamaat</label>
              <div className="space-y-3">
                {formData.jamaatList.map((jamaat, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      value={jamaat}
                      onChange={(e) => handleJamaatChange(index, e.target.value)}
                      className="flex-1"
                      disabled={loading}
                    />
                    {formData.jamaatList.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => handleRemoveJamaat(index)}
                        variant="outline"
                        className="px-3"
                        disabled={loading}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                onClick={handleAddJamaat}
                variant="outline"
                className="w-full mt-3 bg-transparent"
                disabled={loading}
              >
                + Add Another Jamaat
              </Button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4 text-center">
                {error}
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={loading}>
                {loading ? "Adding..." : "Add Region"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
