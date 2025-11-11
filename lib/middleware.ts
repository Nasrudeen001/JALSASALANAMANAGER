import { isAuthenticated } from "./auth"

export const checkAuth = (): boolean => {
  if (typeof window === "undefined") return false
  return isAuthenticated()
}
