"use client"

import { useEffect, useState } from "react"
import {
  getSettings,
  getEventsList,
  switchEvent,
  getCurrentEventId,
  setCurrentEventId,
  deleteEvent,
} from "@/lib/storage"
import type { EventSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { isAuthenticated, isAdmin } from "@/lib/auth"
import Link from "next/link"
import { Trash2, Eye, Pencil } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [eventsList, setEventsList] = useState<EventSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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
        const events = await getEventsList()
        setEventsList(events)

        const currentEventId = getCurrentEventId()
        if (currentEventId) {
          const currentSettings = await getSettings()
          setSettings(currentSettings)
        } else if (events.length > 0) {
          setCurrentEventId(events[0].id)
          const currentSettings = await getSettings()
          setSettings(currentSettings)
        }
      } catch (error) {
        console.error("Error loading settings:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSwitchEvent = async (eventId: string) => {
    try {
      switchEvent(eventId)
      const currentSettings = await getSettings()
      setSettings(currentSettings)
      router.refresh()
    } catch (error) {
      console.error("Error switching event:", error)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId)
      const events = await getEventsList()
      setEventsList(events)
      setDeleteConfirmId(null)

      if (settings?.id === eventId) {
        if (events.length > 0) {
          handleSwitchEvent(events[0].id)
        } else {
          setSettings(null)
        }
      }
    } catch (error) {
      console.error("Error deleting event:", error)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <h1 className="text-3xl font-bold text-primary mb-8">Jalsa Settings</h1>

        {/* Event Selection */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Select Event</h2>
          <div className="space-y-2 mb-4">
            {eventsList.map((event) => (
              <div
                key={event.id}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  settings?.id === event.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border hover:bg-muted/80"
                }`}
              >
                <button onClick={() => handleSwitchEvent(event.id)} className="flex-1 text-left">
                  <p className="font-semibold">{event.eventName}</p>
                  <p className="text-sm opacity-75">{event.startingDate}</p>
                </button>

                <div className="flex gap-2 ml-4">
                  <Link href={`/settings/view-event/${event.id}`}>
                    <button className="p-2 hover:bg-blue-500/20 rounded transition-colors" title="View event details">
                      <Eye className="w-4 h-4" />
                    </button>
                  </Link>
                  <Link href={`/settings/edit-event/${event.id}`}>
                    <button className="p-2 hover:bg-amber-500/20 rounded transition-colors" title="Edit event">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </Link>
                  <button
                    onClick={() => setDeleteConfirmId(event.id)}
                    className="p-2 hover:bg-red-500/20 rounded transition-colors"
                    title="Delete event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirmId === event.id && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-sm">
                      <h3 className="text-lg font-bold text-foreground mb-2">Delete Event?</h3>
                      <p className="text-muted-foreground mb-6">
                        Are you sure you want to delete "{event.eventName}"? This action cannot be undone.
                      </p>
                      <div className="flex gap-4">
                        <Button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="flex-1 bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </Button>
                        <Button onClick={() => setDeleteConfirmId(null)} variant="outline" className="flex-1">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Link href="/settings/create-event" className="block">
            <Button className="w-full bg-secondary text-secondary-foreground">Create New Event</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
