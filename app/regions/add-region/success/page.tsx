"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"

export default function AddRegionSuccessPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Region Added Successfully!</h1>
          <p className="text-muted-foreground mb-8">Your new region has been created and is ready to use.</p>

          <div className="flex gap-4 justify-center">
            <Button onClick={() => router.push("/")} className="bg-primary text-primary-foreground">
              Return to Dashboard
            </Button>
            <Button onClick={() => router.push("/regions/add-region")} variant="outline">
              Add Region
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
