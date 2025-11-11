"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { logoutUser, getUserRole, isAdmin, getCurrentUser } from "@/lib/auth"
import type { UserRole } from "@/lib/types"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [username, setUsername] = useState<string>("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setUserRole(getUserRole())
    const user = getCurrentUser()
    if (user) {
      setUsername(user.username || user.email || user.fullName || "User")
    }
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const allLinks = [
    { href: "/", label: "Dashboard", roles: ["Admin", "Attendance Register", "Security Check", "Catering Service"] },
  { href: "/settings", label: "Jalsa Settings", roles: ["Admin"] },
  { href: "/regions", label: "Region & Jamaat", roles: ["Admin"] },
    { href: "/users", label: "Users", roles: ["Admin"] },
    { href: "/tajneed", label: "Tajneed", roles: ["Admin"] },
    { href: "/attendance", label: "Attendance", roles: ["Admin", "Attendance Register"] },
    { href: "/security", label: "Security", roles: ["Admin", "Security Check"] },
    { href: "/catering", label: "Catering", roles: ["Admin", "Catering Service"] },
  ]

  // Filter links based on user role
  const links = allLinks.filter((link) => {
    if (!userRole) return false
    if (isAdmin()) return true // Admin can see all
    return link.roles.includes(userRole)
  })

  const handleLogout = async () => {
    await logoutUser()
    router.push("/login")
  }

  return (
    <nav className="border-b border-border bg-green-600 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* Username on the left */}
          <div className="flex items-center flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-foreground truncate">
              {username && (
                <>
                  <span className="text-muted-foreground hidden xs:inline">Welcome, </span>
                  <span className="text-primary font-semibold">{username}</span>
                </>
              )}
            </span>
          </div>

          {/* Desktop Navigation links */}
          <div className="hidden md:flex gap-1 flex-shrink-0">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === href ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Mobile menu button and logout */}
          <div className="flex items-center gap-2 md:gap-0 md:justify-end flex-1 min-w-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-foreground hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Logout button: show full text on mobile and align right on small screens */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors ml-auto md:ml-0"
              title="Logout"
            >
              <span className="text-right">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-green-600">
            <div className="px-2 py-2 space-y-1">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === href ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
