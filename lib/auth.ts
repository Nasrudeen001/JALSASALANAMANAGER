import { supabase, isSupabaseConfigured } from "./supabase"
import { getUserByUsername } from "./storage"
import type { User, UserRole } from "./types"

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email?: string
  username?: string
  role: UserRole
  fullName: string
}

export const loginUser = async (
  credentials: LoginCredentials,
): Promise<{ user: AuthUser | null; error: string | null }> => {
  try {
    // Clear any existing Supabase Auth session before attempting new login
    // This prevents conflicts when switching between accounts
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut()
      } catch (error) {
        // Ignore errors when clearing session (might not have an active session)
        console.log("No active session to clear or error clearing session:", error)
      }
    }

    // Step 1: First, try Supabase Authentication (for Main Admin Users)
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (!error && data.user) {
        // This is a Supabase Auth user (Main Admin)
        const user: AuthUser = {
          id: data.user.id,
          email: data.user.email || "",
          role: "Admin", // Default to Admin for Supabase auth users
          fullName: data.user.email || "Admin User",
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("auth_user", JSON.stringify(user))
          localStorage.setItem("auth_token", data.session?.access_token || "")
        }

        return {
          user,
          error: null,
        }
      }
    }

    // Step 2: If Supabase Auth fails, check users table in Supabase database
    // (for system-created users: Attendance Register, Security Check, Catering Service)
    const customUser = await getUserByUsername(credentials.email) // Using email field for username

    if (customUser && customUser.password === credentials.password) {
      // Simple password check (in production, use hashing)
      const user: AuthUser = {
        id: customUser.id,
        username: customUser.username,
        role: customUser.role,
        fullName: customUser.fullName,
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_user", JSON.stringify(user))
      }

      return {
        user,
        error: null,
      }
    }

    // If neither authentication method succeeds
    return {
      user: null,
      error: "Invalid username or password",
    }
  } catch (err) {
    console.error("Login error:", err)
    return {
      user: null,
      error: "An error occurred during login",
    }
  }
}

// Get current user
export const getCurrentUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null

  const userStr = localStorage.getItem("auth_user")
  return userStr ? JSON.parse(userStr) : null
}

// Logout function
export const logoutUser = async (): Promise<void> => {
  // Clear Supabase Auth session if configured
  if (isSupabaseConfigured && typeof window !== "undefined") {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Error signing out from Supabase:", error)
    }
  }

  // Clear local storage
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_user")
    localStorage.removeItem("auth_token")
  }
}

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null
}

// Check if user has specific role
export const hasRole = (role: UserRole): boolean => {
  const user = getCurrentUser()
  return user?.role === role || user?.role === "Admin"
}

// Check if user has any of the specified roles
export const hasAnyRole = (roles: UserRole[]): boolean => {
  const user = getCurrentUser()
  if (!user) return false
  if (user.role === "Admin") return true
  return roles.includes(user.role)
}

// Get user role
export const getUserRole = (): UserRole | null => {
  const user = getCurrentUser()
  return user?.role || null
}

// Check if user is admin
export const isAdmin = (): boolean => {
  return hasRole("Admin")
}

// Get redirect path based on user role
export const getRedirectPathForRole = (role: UserRole): string => {
  switch (role) {
    case "Admin":
      return "/" // Admin goes to home page
    case "Attendance Register":
      return "/" // Attendance Register goes to dashboard
    case "Security Check":
      return "/" // Security Check goes to dashboard
    case "Catering Service":
      return "/" // Catering Service goes to dashboard
    default:
      return "/" // Default to home page
  }
}
