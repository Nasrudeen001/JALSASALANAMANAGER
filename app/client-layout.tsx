"use client"

import type React from "react"
import { Analytics } from "@vercel/analytics/next"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Navigation from "@/components/navigation"
import Header from "@/components/header"
import { isAuthenticated } from "@/lib/auth"
import { Toaster } from "@/components/ui/sonner"

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [isAuth, setIsAuth] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // Check authentication status
    const authStatus = isAuthenticated()
    setIsAuth(authStatus)
    setIsLoading(false)
  }, [pathname]) // Re-check auth when pathname changes (e.g., after login)

  const isLoginPage = pathname === "/login"
  const shouldShowLayout = isAuth && !isLoginPage

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {shouldShowLayout && (
        <>
          <Header />
          <Navigation />
        </>
      )}
      {children}
      <Toaster />
      <Analytics />
    </>
  )
}
