"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { saveTajneedMember, getRegions, getCurrentEventId } from "@/lib/storage"
import type { TajneedMember, Region, Tanzeem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isAuthenticated, hasAnyRole } from "@/lib/auth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export default function RegisterTajneedMemberPage() {
  const router = useRouter()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pageLoading, setPageLoading] = useState(true)
  const [successfulMember, setSuccessfulMember] = useState<TajneedMember | null>(null)

  const [formData, setFormData] = useState({
    fullName: "",
    tanzeem: "" as Tanzeem,
    region: "",
    jamaat: "",
  })

  const categories: Tanzeem[] = ["Under 7", "Atfal", "Khuddam", "Nasrat", "Lajna", "Ansar", "Guests"]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!hasAnyRole(["Admin"])) {
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
        setPageLoading(false)
      }
    }

    loadData()
  }, [router])

  const getJamaatForRegion = (regionName: string) => {
    const region = regions.find((r) => r.name === regionName)
    return region?.jamaat || []
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.fullName.trim()) {
      setError("Full name is required")
      return
    }
    if (!formData.region) {
      setError("Region is required")
      return
    }
    if (!formData.jamaat) {
      setError("Jamaat is required")
      return
    }

    setLoading(true)

    try {
      const eventId = getCurrentEventId()
      if (!eventId) {
        setError("No event selected")
        return
      }

      const savedMember = await saveTajneedMember({
        eventId,
        fullName: formData.fullName,
        tanzeem: formData.tanzeem,
        region: formData.region,
        jamaat: formData.jamaat,
      })

      if (savedMember) {
        setSuccessfulMember(savedMember)
        setFormData({
          fullName: "",
          tanzeem: "Khuddam",
          region: "",
          jamaat: "",
        })
      } else {
        setError("Failed to register member")
      }
    } catch (err) {
      setError("Failed to register member")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  if (successfulMember) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-2xl border border-border bg-card/90 p-10 shadow-xl backdrop-blur">
            <div className="flex flex-col items-center gap-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-foreground">Member Added to Tajneed</h1>
                <p className="text-muted-foreground max-w-xl">
                  The following details have been captured successfully. Keep adding members or jump back to manage your
                  records.
                </p>
              </div>

              <div className="w-full rounded-xl border border-border/70 bg-background/70 p-6 text-left shadow-sm">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Full Name</p>
                    <p className="text-base font-semibold text-foreground">{successfulMember.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tanzeem</p>
                    <p className="text-base font-semibold text-foreground">{successfulMember.tanzeem}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Region</p>
                    <p className="text-base font-semibold text-foreground">{successfulMember.region}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jamaat</p>
                    <p className="text-base font-semibold text-foreground">{successfulMember.jamaat}</p>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/attendance" className="w-full sm:w-auto">
                  <Button className="w-full bg-primary text-primary-foreground">Go to Attendance</Button>
                </Link>
                <Button onClick={() => setSuccessfulMember(null)} variant="outline" className="w-full sm:w-auto">
                  Add Another Member
                </Button>
                <Link href="/" className="w-full sm:w-auto">
                  <Button variant="ghost" className="w-full sm:w-auto">
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-primary mb-8">Add Tajneed Member</h1>

        <div className="bg-card border border-border rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
              <Input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full"
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
              >
                <option value="">Select Jamaat</option>
                {getJamaatForRegion(formData.region).map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

            <div className="flex gap-4">
              <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground">
                {loading ? "Saving..." : "Save Member"}
              </Button>
              <Button type="button" onClick={() => router.back()} variant="outline">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

