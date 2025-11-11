"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Tanzeem, Region } from "@/lib/types"
import { getRegions } from "@/lib/storage"
import { X } from "lucide-react"

interface EditMemberDialogProps {
  qrCodeId: string
  onSave: (memberData: {
    id: string
    fullName: string
    tanzeem: Tanzeem
    region: string
  jamaat: string
  }) => Promise<void>
  onClose: () => void
  initialRegions?: Region[]
}

export function EditMemberDialog({ qrCodeId, onSave, onClose, initialRegions = [] }: EditMemberDialogProps) {
  const [regions, setRegions] = useState<Region[]>(initialRegions)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
  tanzeem: "" as Tanzeem,
    region: "",
  jamaat: "",
  })

  const categories: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

  useEffect(() => {
    // Only fetch regions if not provided
    if (initialRegions.length === 0) {
      const loadRegions = async () => {
        try {
          const regionsData = await getRegions()
          setRegions(regionsData)
        } catch (error) {
          console.error("Error loading regions:", error)
        }
      }
      loadRegions()
    }
  }, [initialRegions])

  const getJamaatForRegion = (regionName: string) => {
    const region = regions.find((r) => r.name === regionName)
    return region?.jamaat || []
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.fullName.trim()) {
      alert("Full name is required")
      return
    }
    if (!formData.region) {
      alert("Region is required")
      return
    }
    if (!formData.jamaat) {
      alert("Jamaat is required")
      return
    }

    setLoading(true)
    try {
      await onSave({
        id: qrCodeId,
        fullName: formData.fullName.trim(),
  tanzeem: formData.tanzeem,
        region: formData.region,
  jamaat: formData.jamaat,
      })
    } catch (error) {
      console.error("Error saving member:", error)
      alert("Failed to save member. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">Register Member from QR Code</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          <p className="font-semibold">QR Code ID: {qrCodeId}</p>
          <p className="text-xs mt-1">Please fill in the member details below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
            <Input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Tanzeem</label>
            <select
              value={formData.tanzeem}
              onChange={(e) => setFormData({ ...formData, tanzeem: e.target.value as Tanzeem })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="">Select Tanzeem</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Region</label>
            <select
              value={formData.region}
              onChange={(e) => {
                setFormData({ ...formData, region: e.target.value, jamaat: "" })
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              required
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
            <label className="block text-sm font-medium text-foreground mb-2">Jamaat</label>
            <select
              value={formData.jamaat}
              onChange={(e) => setFormData({ ...formData, jamaat: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              disabled={!formData.region}
              required
            >
              <option value="">Select Jamaat</option>
              {getJamaatForRegion(formData.region).map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 mt-6">
            <Button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground">
              {loading ? "Saving..." : "Save & Add"}
            </Button>
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

