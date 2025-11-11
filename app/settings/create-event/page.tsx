"use client"

import type React from "react"

import { useState } from "react"
import { createEvent, setCurrentEventId } from "@/lib/storage"
import type { EventSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function CreateEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdEvent, setCreatedEvent] = useState<EventSettings | null>(null)

  const [formData, setFormData] = useState({
    eventName: "",
    startingDate: "0",
    duration: 0,
    location: "",
    theme: "",
  })

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.eventName.trim()) {
      setError("Event name is required")
      return
    }

    setLoading(true)

    try {
      const newEvent: EventSettings = {
        id: "",
        eventName: formData.eventName,
        startingDate: formData.startingDate,
        duration: formData.duration,
        location: formData.location,
        theme: formData.theme,
        createdAt: new Date().toISOString(),
      }

      const createdEventData = await createEvent(newEvent)
      if (createdEventData) {
        setCurrentEventId(createdEventData.id)
        setCreatedEvent(createdEventData)
      } else {
        setError("Failed to create event")
      }
    } catch (err) {
      setError("Failed to create event")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (createdEvent) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-primary mb-2">Event Created Successfully!</h1>
              <p className="text-muted-foreground mb-4">
                Your event "{createdEvent.eventName}" has been created and is now active.
              </p>
              <p className="text-sm text-muted-foreground">
                Starting Date: {new Date(createdEvent.startingDate).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/" className="flex-1">
                <Button className="w-full bg-primary text-primary-foreground">Return to Dashboard</Button>
              </Link>
              <Button
                onClick={() => {
                  setCreatedEvent(null)
                  setFormData({
                    eventName: "",
                    startingDate: "0",
                    duration: 0,
                    location: "",
                    theme: "",
                  })
                }}
                className="flex-1 bg-secondary text-secondary-foreground"
              >
                Create New Event
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
        <Link href="/settings" className="text-primary hover:underline mb-4 inline-block">
          ← Back to Jalsa Settings
        </Link>

        <h1 className="text-3xl font-bold text-primary mb-8">Create New Event</h1>

        <div className="bg-card border border-border rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Event Name</label>
              <Input
                type="text"
                value={formData.eventName}
                onChange={(e) => handleChange("eventName", e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Starting Date</label>
              <Input
                type="date"
                value={formData.startingDate}
                onChange={(e) => handleChange("startingDate", e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Duration (Days)</label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) => handleChange("duration", Number.parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Location</label>
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Theme</label>
              <Input
                type="text"
                value={formData.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
                className="w-full"
              />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

            <div className="flex gap-4">
              <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground">
                {loading ? "Creating..." : "Create Event"}
              </Button>
              <Link href="/settings" className="flex-1">
                <Button type="button" variant="outline" className="w-full bg-transparent">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
