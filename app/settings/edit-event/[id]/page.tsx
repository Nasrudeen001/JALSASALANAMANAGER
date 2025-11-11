"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { updateEvent, getEventsList } from "@/lib/storage"
import type { EventSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function EditEventPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [formData, setFormData] = useState<EventSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const events = await getEventsList()
        const event = events.find((e) => e.id === eventId)
        if (event) {
          setFormData(event)
        }
      } catch (error) {
        console.error("Error loading event:", error)
      } finally {
        setLoading(false)
      }
    }

    loadEvent()
  }, [eventId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => (prev ? { ...prev, [name]: value } : null))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return

    setSaving(true)
    try {
      await updateEvent(formData)
      setShowSuccess(true)
      setTimeout(() => {
        router.push("/settings")
      }, 2000)
    } catch (error) {
      console.error("Error updating event:", error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!formData) return <div className="p-8">Event not found</div>

  if (showSuccess) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Event Updated!</h2>
            <p className="text-muted-foreground mb-6">Your event has been successfully updated.</p>
            <div className="flex gap-4">
              <Button onClick={() => router.push("/settings")} className="flex-1 bg-primary">
                Return to Jalsa Settings
              </Button>
              <Button
                onClick={() => {
                  setShowSuccess(false)
                  setFormData(formData)
                }}
                variant="outline"
                className="flex-1"
              >
                Edit Another
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-primary mb-8">Edit Event</h1>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div>
            <Label htmlFor="eventName" className="text-foreground">
              Event Name
            </Label>
            <Input
              id="eventName"
              name="eventName"
              value={formData.eventName}
              onChange={handleChange}
              className="mt-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startingDate" className="text-foreground">
                Starting Date
              </Label>
              <Input
                id="startingDate"
                name="startingDate"
                type="date"
                value={formData.startingDate}
                onChange={handleChange}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="duration" className="text-foreground">
                Duration (days)
              </Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                value={formData.duration}
                onChange={handleChange}
                className="mt-2"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="theme" className="text-foreground">
              Theme
            </Label>
            <Input id="theme" name="theme" value={formData.theme} onChange={handleChange} className="mt-2" />
          </div>

          <div>
            <Label htmlFor="location" className="text-foreground">
              Location
            </Label>
            <Input id="location" name="location" value={formData.location} onChange={handleChange} className="mt-2" />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={saving} className="flex-1 bg-primary">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" onClick={() => router.back()} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
