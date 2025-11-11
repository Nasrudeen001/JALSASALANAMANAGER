"use client"

import { useState, useEffect } from "react"
import { getUsers, createUser, updateUser, deleteUser } from "@/lib/storage"
import type { User, UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isAuthenticated, isAdmin } from "@/lib/auth"
import { useRouter } from "next/navigation"

const ROLES: UserRole[] = ["Attendance Register", "Security Check", "Catering Service"]

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "Attendance Register" as UserRole,
  })
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }

    if (!isAdmin()) {
      router.push("/")
      return
    }

    loadUsers()
  }, [router])

  const loadUsers = async () => {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (error) {
      console.error("Error loading users:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.username || !formData.password || !formData.fullName) {
      setError("All fields are required")
      return
    }

    try {
      const success = await createUser({
        username: formData.username,
        password: formData.password,
        role: formData.role,
        fullName: formData.fullName,
      })

      if (success) {
        setShowCreateForm(false)
        setFormData({ username: "", password: "", fullName: "", role: "Attendance Register" })
        await loadUsers()
      } else {
        setError("Username already exists")
      }
    } catch (error) {
      console.error("Error creating user:", error)
      setError("Failed to create user")
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      password: "", // Don't pre-fill password
      fullName: user.fullName,
      role: user.role,
    })
    setShowCreateForm(true)
    setError("")
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!editingUser || !formData.username || !formData.fullName) {
      setError("Username and Full Name are required")
      return
    }

    try {
      const updateData: Partial<User> = {
        username: formData.username,
        fullName: formData.fullName,
        role: formData.role,
      }

      // Only update password if provided
      if (formData.password) {
        updateData.password = formData.password
      }

      const success = await updateUser(editingUser.id, updateData)

      if (success) {
        setEditingUser(null)
        setShowCreateForm(false)
        setFormData({ username: "", password: "", fullName: "", role: "Attendance Register" })
        await loadUsers()
      } else {
        setError("Username already exists or update failed")
      }
    } catch (error) {
      console.error("Error updating user:", error)
      setError("Failed to update user")
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) {
      return
    }

    try {
      const success = await deleteUser(userId)
      if (success) {
        await loadUsers()
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Failed to delete user")
    }
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingUser(null)
    setFormData({ username: "", password: "", fullName: "", role: "Attendance Register" })
    setError("")
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p>Loading users...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 sm:mb-8 text-center md:text-left gap-4 px-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">User Management</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Manage system users and their roles</p>
          </div>
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)} className="bg-primary text-primary-foreground w-full sm:w-auto">
              + Create User
            </Button>
          )}
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
              {editingUser ? "Edit User" : "Create New User"}
            </h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs sm:text-sm">{error}</div>
            )}
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Username</label>
                  <Input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">
                    Password {editingUser && "(leave blank to keep current)"}
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Full Name</label>
                  <Input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" className="bg-primary text-primary-foreground w-full sm:w-auto text-sm">
                  {editingUser ? "Update User" : "Create User"}
                </Button>
                <Button type="button" onClick={handleCancel} variant="outline" className="w-full sm:w-auto text-sm">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table - Desktop */}
        <div className="bg-card border border-border rounded-lg overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Username</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Full Name</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Role</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Created At</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No users found. Create a user to get started.
                    </td>
                  </tr>
                ) : (
                  users.filter((user) => user.role !== "Admin").map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm font-medium text-primary">{user.username}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">{user.fullName}</td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">
                        <span
                          className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                            user.role === "Admin"
                              ? "bg-purple-100 text-purple-800"
                              : user.role === "Attendance Register"
                                ? "bg-blue-100 text-blue-800"
                                : user.role === "Security Check"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-green-100 text-green-800"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm text-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 whitespace-nowrap"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 whitespace-nowrap"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {users.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">No users found. Create a user to get started.</p>
            </div>
          ) : (
            users.filter((user) => user.role !== "Admin").map((user) => (
              <div key={user.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-primary truncate">{user.username}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{user.fullName}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ml-2 flex-shrink-0 ${
                      user.role === "Admin"
                        ? "bg-purple-100 text-purple-800"
                        : user.role === "Attendance Register"
                          ? "bg-blue-100 text-blue-800"
                          : user.role === "Security Check"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-green-100 text-green-800"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(user.createdAt).toLocaleDateString()}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

