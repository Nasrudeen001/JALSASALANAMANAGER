"use client"

import { useEffect, useState } from "react"
import { getEventsList } from "@/lib/storage"
import type { EventSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ViewEventPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.id as string
  const [event, setEvent] = useState<EventSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const events = await getEventsList()
        const foundEvent = events.find((e) => e.id === eventId)
        if (foundEvent) {
          setEvent(foundEvent)
        }
      } catch (error) {
        console.error("Error loading event:", error)
      } finally {
        setLoading(false)
      }
    }

    loadEvent()
  }, [eventId])

  if (loading) return <div className="p-8">Loading...</div>

  if (!event) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Event Not Found</h1>
            <Link href="/settings">
              <Button className="bg-primary text-primary-foreground">Back to Jalsa Settings</Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const endDate = new Date(event.startingDate)
  endDate.setDate(endDate.getDate() + event.duration - 1)

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="flex items-center text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jalsa Settings
        </Link>

        <div className="bg-card border border-border rounded-lg p-8">
          <h1 className="text-3xl font-bold text-primary mb-8">{event.eventName}</h1>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Starting Date</label>
                <p className="text-lg font-semibold text-foreground">
                  {new Date(event.startingDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Ending Date</label>
                <p className="text-lg font-semibold text-foreground">
                  {endDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Duration</label>
                <p className="text-lg font-semibold text-foreground">{event.duration} days</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Location</label>
                <p className="text-lg font-semibold text-foreground">{event.location}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Theme</label>
              <p className="text-lg font-semibold text-foreground">{event.theme}</p>
            </div>

            <div className="pt-6 border-t border-border">
              <label className="block text-sm font-medium text-muted-foreground mb-2">Created</label>
              <p className="text-sm text-muted-foreground">
                {new Date(event.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <Link href="/settings" className="flex-1">
              <Button className="w-full bg-primary text-primary-foreground">Back to Jalsa Settings</Button>
            </Link>
            <Link href="/settings" className="flex-1">
              <Button variant="outline" className="w-full bg-transparent">
                Close
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
