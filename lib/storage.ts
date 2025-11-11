import type {
  TajneedMember,
  AttendanceRecord,
  Region,
  EventSettings,
  SecurityMovement,
  CateringRecord,
  MovementStatus,
  MealType,
  DayOfWeek,
  User,
  UserRole,
} from "./types"
import { supabase, isSupabaseConfigured } from "./supabase"

let currentEventId: string | null = null
const LOCAL_CURRENT_EVENT_KEY = "current_event_id"

// Initialize currentEventId from localStorage when running in the browser so
// the selected event survives full page refreshes.
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(LOCAL_CURRENT_EVENT_KEY)
    if (stored) {
      currentEventId = stored
    }
  } catch (err) {
    // Ignore storage access errors (e.g., privacy mode)
    console.warn("Could not read current event id from localStorage:", err)
  }
}

const getCurrentEventId = (): string => {
  if (currentEventId) return currentEventId

  // Fallback to localStorage in case module state was reset (page refresh)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_CURRENT_EVENT_KEY)
      if (stored) {
        currentEventId = stored
        return stored
      }
    } catch (err) {
      // ignore
    }
  }

  return ""
}

const setCurrentEventId = (eventId: string): void => {
  currentEventId = eventId
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOCAL_CURRENT_EVENT_KEY, eventId)
    } catch (err) {
      console.warn("Could not persist current event id to localStorage:", err)
    }
  }
}

const getFromLocalStorage = (key: string, defaultValue: any = null) => {
  if (typeof window === "undefined") return defaultValue
  const item = localStorage.getItem(key)
  return item ? JSON.parse(item) : defaultValue
}

const saveToLocalStorage = (key: string, value: any) => {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

const LOCAL_TAJNEED_KEY = "tajneed_members"
const LOCAL_ATTENDANCE_KEY = "attendance_records"
const LOCAL_SECURITY_KEY = "security_movements"
const LOCAL_CATERING_KEY = "catering_records"
const LOCAL_USERS_KEY = "users"
const LOCAL_QR_CODE_MAPPING_KEY = "qr_code_member_mapping" // Maps QR code IDs to member IDs
const TAJNEED_TABLE = "tajneed_members"
const ATTENDANCE_TABLE = "attendance_records"
const SECURITY_TABLE = "security_movements"
const CATERED_TABLE = "catering_records"
const USERS_TABLE = "users"

// Events List Management
export const getEventsList = async (): Promise<EventSettings[]> => {
  if (!isSupabaseConfigured) {
    return getFromLocalStorage("events_list", [])
  }

  const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching events:", error)
    return []
  }

  return (
  data?.map((event: any) => ({
      id: event.id,
      eventName: event.event_name,
      startingDate: event.starting_date,
      duration: event.duration,
      location: event.location,
      theme: event.theme,
      createdAt: event.created_at,
    })) || []
  )
}

export const createEvent = async (event: EventSettings): Promise<EventSettings | null> => {
  if (!isSupabaseConfigured) {
    const events = getFromLocalStorage("events_list", [])
    const newEvent = {
      ...event,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    events.push(newEvent)
    saveToLocalStorage("events_list", events)
    setCurrentEventId(newEvent.id)
    return newEvent
  }

  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        event_name: event.eventName,
        starting_date: event.startingDate,
        duration: event.duration,
        location: event.location,
        theme: event.theme,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error("Error creating event:", error)
    return null
  }

  const newEvent: EventSettings = {
    id: data.id,
    eventName: data.event_name,
    startingDate: data.starting_date,
    duration: data.duration,
    location: data.location,
    theme: data.theme,
    createdAt: data.created_at,
  }

  setCurrentEventId(newEvent.id)
  return newEvent
}

export const switchEvent = (eventId: string): void => {
  setCurrentEventId(eventId)
}

export const deleteEvent = async (eventId: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const events = getFromLocalStorage("events_list", [])
    const filtered = events.filter((e: EventSettings) => e.id !== eventId)
    saveToLocalStorage("events_list", filtered)

    // Also delete associated tajneed members, attendance records, and regions
    const allMembers = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])
    const filteredMembers = allMembers.filter((member: TajneedMember) => member.eventId !== eventId)
    saveToLocalStorage("tajneed_members", filteredMembers)

    const allAttendanceRecords = getFromLocalStorage(LOCAL_ATTENDANCE_KEY, [])
    const filteredAttendance = allAttendanceRecords.filter((record: AttendanceRecord) => record.eventId !== eventId)
    saveToLocalStorage("attendance_records", filteredAttendance)

    const allRegions = getFromLocalStorage("regions", [])
    const filteredRegions = allRegions.filter((r: Region) => r.eventId !== eventId)
    saveToLocalStorage("regions", filteredRegions)

    return true
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId)

  if (error) {
    console.error("Error deleting event:", error)
    return false
  }

  return true
}

// Tajneed Members
export const getTajneedMembers = async (): Promise<TajneedMember[]> => {
  try {
    const eventId = getCurrentEventId()
    if (!eventId) return []

    if (!isSupabaseConfigured) {
      const allMembers = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])
      return allMembers.filter((member: TajneedMember) => member.eventId === eventId)
    }

    const { data, error } = await supabase
      .from(TAJNEED_TABLE)
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching tajneed members:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error: error,
      })
      return []
    }

    return (
  data?.map((member: any) => ({
        id: member.id,
        eventId: member.event_id,
        fullName: member.full_name,
  tanzeem: member.tanzeem,
        region: member.region,
        jamaat: member.jamaat,
        createdAt: member.created_at ?? new Date().toISOString(),
      })) || []
    )
  } catch (err) {
    console.error("Unexpected error fetching tajneed members:", {
      error: err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return []
  }
}

export const saveTajneedMember = async (
  member: Omit<TajneedMember, "id" | "createdAt">,
): Promise<TajneedMember | null> => {
  if (!isSupabaseConfigured) {
    const allMembers = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])
    const newMember: TajneedMember = {
      ...member,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    allMembers.push(newMember)
    saveToLocalStorage(LOCAL_TAJNEED_KEY, allMembers)
    return newMember
  }

  const { data, error } = await supabase
    .from(TAJNEED_TABLE)
    .insert([
      {
        event_id: member.eventId,
        full_name: member.fullName,
        tanzeem: member.tanzeem,
        region: member.region,
        jamaat: member.jamaat,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error("Error saving tajneed member:", error)
    return null
  }

    return {
    id: data.id,
    eventId: data.event_id,
    fullName: data.full_name,
    tanzeem: data.tanzeem,
    region: data.region,
    jamaat: data.jamaat,
    createdAt: data.created_at ?? new Date().toISOString(),
  }
}

// Helper function to store QR code ID to member ID mapping
export const saveQRCodeMapping = async (qrCodeId: string, memberId: string): Promise<void> => {
  const mappings = getFromLocalStorage(LOCAL_QR_CODE_MAPPING_KEY, {})
  mappings[qrCodeId] = memberId
  saveToLocalStorage(LOCAL_QR_CODE_MAPPING_KEY, mappings)
  console.log("QR Code mapping saved to localStorage:", { qrCodeId, memberId })

  // If Supabase is configured, attempt to persist the mapping server-side so
  // it becomes available across devices. Use a dedicated `qr_mappings` table
  // if present. If the table doesn't exist or the request fails, we silently
  // fall back to localStorage (preserve existing behavior).
  if (isSupabaseConfigured) {
    // Wait for Supabase persistence to complete
    // This ensures the mapping is saved before returning
    try {
      const eventId = getCurrentEventId()
      await persistQRMappingToSupabase(qrCodeId, memberId, eventId)
    } catch (err) {
      // Log the error but don't throw — localStorage fallback is available
      console.warn("Failed to persist QR mapping to Supabase, but localStorage fallback is available:", err)
    }
  }
}

// Async helper to persist QR mapping to Supabase with retry logic
const persistQRMappingToSupabase = async (qrCodeId: string, memberId: string, eventId?: string, attempt: number = 1): Promise<void> => {
  const MAX_ATTEMPTS = 3
  const BASE_DELAY = 100 // Start with 100ms

  try {
    if (!supabase) {
      console.warn("Supabase client not configured")
      return
    }

    // Prepare payload with snake_case column names (Supabase convention)
    // Include event_id if available to scope mappings per event
    const payload = {
      qr_code_id: qrCodeId,
      member_id: memberId,
      event_id: eventId || null, // Include event_id if available, otherwise null
    }

    // Use upsert to insert or update. Supabase upsert syntax:
    // .upsert(data, options) where options.onConflict specifies the unique column
    console.log(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Attempting to upsert QR mapping to Supabase:`, { qrCodeId, memberId, eventId })
    
    const { error } = await supabase
      .from("qr_mappings")
      .upsert(payload, { onConflict: "qr_code_id" })

    if (error) {
      // Check if this is a retryable error
      const isRetryable = 
        error.code === "PGRST301" || // Table not found - might be eventual consistency
        error.code === "42P01" || // Undefined table (may be timing issue)
        error.message?.includes("connection") ||
        error.message?.includes("timeout") ||
        error.message?.includes("temporarily unavailable")

      if (isRetryable && attempt < MAX_ATTEMPTS) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = BASE_DELAY * Math.pow(2, attempt - 1)
        console.warn(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Retryable error encountered, retrying after ${delay}ms:`, {
          qrCodeId,
          memberId,
          eventId,
          errorMessage: error.message,
          errorCode: error.code,
        })
        
        await new Promise((resolve) => setTimeout(resolve, delay))
        return persistQRMappingToSupabase(qrCodeId, memberId, eventId, attempt + 1)
      }

      // Non-retryable error or max attempts reached
      console.error(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Supabase upsert error for QR mapping:`, {
        qrCodeId,
        memberId,
        eventId,
        errorMessage: error.message,
        errorDetails: error.details,
        errorCode: error.code,
        errorHint: error.hint,
        isRetryable,
        maxAttemptsReached: attempt >= MAX_ATTEMPTS,
      })
      
      // Throw error so caller knows it failed
      throw new Error(`Failed to persist QR mapping to Supabase after ${attempt} attempt(s): ${error.message}`)
    }

    console.log("✅ QR Code mapping successfully persisted to Supabase:", { qrCodeId, memberId, eventId })
  } catch (err) {
    console.error("Unexpected error while saving QR mapping to Supabase:", err)
    throw err
  }
}

// Helper function to get member ID from QR code ID
export const getMemberIdFromQRCode = async (qrCodeId: string): Promise<string | null> => {
  // Try Supabase first so mappings are available across devices
  if (isSupabaseConfigured && supabase) {
    try {
      const eventId = getCurrentEventId()
      console.log("Querying Supabase for QR mapping:", { qrCodeId, eventId })
      
      // Query with event_id filter to get event-specific mapping
      let query = supabase
        .from("qr_mappings")
        .select("member_id")
        .eq("qr_code_id", qrCodeId)

      // If we have an event ID, filter by it
      if (eventId) {
        query = query.eq("event_id", eventId)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        // If the table doesn't exist or another DB error occurs, log and fall
        // back to localStorage. Do not throw — keep user flow resilient.
        console.warn("Error querying qr_mappings from Supabase (falling back to local):", {
          qrCodeId,
          eventId,
          errorMessage: error.message,
          errorDetails: error.details,
          errorCode: error.code,
          errorHint: error.hint,
        })
      } else if (data && (data as any).member_id) {
        const mappedId = (data as any).member_id as string
        console.log("✅ QR Code mapping found in Supabase:", { qrCodeId, mappedId, eventId })
        return mappedId
      } else {
        console.log("No QR mapping found in Supabase, trying localStorage:", { qrCodeId, eventId })
      }
    } catch (err) {
      console.warn("Unexpected error when querying Supabase for QR mapping, falling back to localStorage:", err)
    }
  } else {
    console.log("Supabase not configured or unavailable, using localStorage for QR mapping:", { qrCodeId })
  }

  // Local fallback (existing behavior)
  const mappings = getFromLocalStorage(LOCAL_QR_CODE_MAPPING_KEY, {})
  const mappedId = mappings[qrCodeId] || null
  if (mappedId) {
    console.log("✅ QR Code mapping found in localStorage:", { qrCodeId, mappedId })
  } else {
    console.log("❌ QR Code mapping NOT found (neither Supabase nor localStorage):", { qrCodeId })
  }
  return mappedId
}

// Helper function to find member by QR code ID (checks both direct ID and mapping)
export const findMemberByQRCodeId = async (qrCodeId: string): Promise<TajneedMember | null> => {
  // Get fresh members list
  let members = await getTajneedMembers()
  
  // First, try direct lookup
  let member = members.find((m) => m.id === qrCodeId)
  if (member) {
    console.log("Member found by direct ID:", { qrCodeId, memberName: member.fullName })
    return member
  }
  
  // If not found, check QR code mapping (this may query Supabase)
  const mappedId = await getMemberIdFromQRCode(qrCodeId)
  if (mappedId) {
    console.log("QR code mapping found:", { qrCodeId, mappedId })
    // Try to find member with mapped ID (even if it's the same as qrCodeId)
    member = members.find((m) => m.id === mappedId)
    
    // If still not found, the member might have been just created
    // Try one more time with a fresh fetch
    if (!member) {
      // Small delay to ensure member is saved
      await new Promise((resolve) => setTimeout(resolve, 200))
      members = await getTajneedMembers()
      member = members.find((m) => m.id === mappedId)
      if (member) {
        console.log("Member found by mapped ID after refresh:", { qrCodeId, mappedId, memberName: member.fullName })
      } else {
        console.log("Member not found even with mapped ID:", { 
          qrCodeId, 
          mappedId, 
          totalMembers: members.length,
          memberIds: members.slice(0, 5).map(m => m.id) // Log first 5 IDs for debugging
        })
      }
    } else {
      console.log("Member found by mapped ID:", { qrCodeId, mappedId, memberName: member.fullName })
    }
  } else {
    console.log("No QR code mapping found for:", qrCodeId)
    // Try one more time with a fresh members list in case member was just added
    await new Promise((resolve) => setTimeout(resolve, 200))
    members = await getTajneedMembers()
    member = members.find((m) => m.id === qrCodeId)
    if (member) {
      console.log("Member found by direct ID after refresh (no mapping):", { qrCodeId, memberName: member.fullName })
    }
  }
  
  if (!member) {
    console.log("Member not found for QR code ID:", qrCodeId)
  }
  
  return member || null
}

// Helper function to find attendance record by QR code ID
export const findAttendanceRecordByQRCodeId = async (qrCodeId: string): Promise<AttendanceRecord | null> => {
  // First, try to find member by QR code ID
  const member = await findMemberByQRCodeId(qrCodeId)
  if (!member) {
    return null
  }
  
  // Then find attendance record by member ID
  const records = await getAttendanceRecords()
  return records.find((r) => r.memberId === member.id) || null
}

// Save tajneed member with a specific ID (for QR code registration)
export const saveTajneedMemberWithId = async (
  member: Omit<TajneedMember, "createdAt">,
): Promise<TajneedMember | null> => {
  const qrCodeId = member.id // Store the QR code ID before potentially changing it
  
  if (!isSupabaseConfigured) {
    const allMembers = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])
    // Check if member with this ID already exists
    const existingIndex = allMembers.findIndex((m: TajneedMember) => m.id === member.id)
    const newMember: TajneedMember = {
      ...member,
      id: member.id, // Use the QR code ID as the member ID for localStorage
      createdAt: new Date().toISOString(),
    }
    
     if (existingIndex !== -1) {
      // Update existing member
      allMembers[existingIndex] = newMember
    } else {
      // Add new member
      allMembers.push(newMember)
    }
    saveToLocalStorage(LOCAL_TAJNEED_KEY, allMembers)
    
    // Store QR code mapping (always store it, even if ID matches, for consistency)
    await saveQRCodeMapping(qrCodeId, newMember.id)
    
    console.log("Member saved to localStorage:", { 
      qrCodeId, 
      memberId: newMember.id, 
      memberName: newMember.fullName,
      totalMembers: allMembers.length 
    })
    
    return newMember
  }

  // For Supabase, use upsert to handle both insert and update
  // Note: If Supabase ID is auto-generated, we'll need to store the QR code ID in a separate field
  // For now, try to use the ID directly, but fall back to regular insert if it fails
  try {
    // First, try to check if member exists
    const { data: existing, error: checkError } = await supabase
      .from(TAJNEED_TABLE)
      .select("*")
      .eq("id", member.id)
      .maybeSingle()

    if (existing) {
      // Update existing member
      const { data, error } = await supabase
        .from(TAJNEED_TABLE)
        .update({
            event_id: member.eventId,
            full_name: member.fullName,
            tanzeem: member.tanzeem,
            region: member.region,
             jamaat: member.jamaat,
          })
        .eq("id", member.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating tajneed member:", error)
        return null
      }

      const savedMember = {
        id: data.id,
        eventId: data.event_id,
        fullName: data.full_name,
        tanzeem: data.tanzeem,
        region: data.region,
         jamaat: data.jamaat,
        createdAt: data.created_at ?? new Date().toISOString(),
      }
      
      // Store QR code mapping - await it to ensure it completes
      await saveQRCodeMapping(qrCodeId, savedMember.id)
      
      return savedMember
    } else {
      // Try to insert with specific ID first
      const { data, error } = await supabase
        .from(TAJNEED_TABLE)
        .insert([
          {
            id: member.id,
            event_id: member.eventId,
            full_name: member.fullName,
            tanzeem: member.tanzeem,
            region: member.region,
             jamaat: member.jamaat,
          },
        ])
        .select()
        .single()

      if (error) {
        // If insert with custom ID fails (e.g., ID is auto-generated), 
        // fall back to regular insert and store the QR code ID in a note or use it as a reference
        console.warn("Could not insert with custom ID, using regular insert:", {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        
        // Use regular insert (Supabase will generate the ID)
        const { data: newData, error: insertError } = await supabase
          .from(TAJNEED_TABLE)
          .insert([
            {
              event_id: member.eventId,
              full_name: member.fullName,
              tanzeem: member.tanzeem,
              region: member.region,
               jamaat: member.jamaat,
            },
          ])
          .select()
          .single()

        if (insertError) {
          console.error("Error saving tajneed member:", {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
          })
          return null
        }

        // Return with the generated ID and store QR code mapping
        const savedMember = {
          id: newData.id,
          eventId: newData.event_id,
          fullName: newData.full_name,
          tanzeem: newData.tanzeem,
          region: newData.region,
           jamaat: newData.jamaat,
          createdAt: newData.created_at ?? new Date().toISOString(),
        }
        
        // Store QR code mapping so we can find this member by QR code ID later - await it
        await saveQRCodeMapping(qrCodeId, savedMember.id)
        
        return savedMember
      }

      const savedMember = {
        id: data.id,
        eventId: data.event_id,
        fullName: data.full_name,
        tanzeem: data.tanzeem,
        region: data.region,
         jamaat: data.jamaat,
        createdAt: data.created_at ?? new Date().toISOString(),
      }
      
      // Store QR code mapping - await it to ensure it completes
      await saveQRCodeMapping(qrCodeId, savedMember.id)
      
      return savedMember
    }
  } catch (err: any) {
    console.error("Error in saveTajneedMemberWithId:", err)
    return null
  }
}

export const updateTajneedMember = async (
  id: string,
  updates: Partial<Omit<TajneedMember, "id" | "eventId" | "createdAt">>,
): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const allMembers = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])
    const index = allMembers.findIndex((member: TajneedMember) => member.id === id)
    if (index !== -1) {
      allMembers[index] = { ...allMembers[index], ...updates }
      saveToLocalStorage(LOCAL_TAJNEED_KEY, allMembers)
      return true
    }
    return false
  }

  const updateData: Record<string, any> = {}

  if (updates.fullName) updateData.full_name = updates.fullName
  if (updates.tanzeem) updateData.tanzeem = updates.tanzeem
  if (updates.region) updateData.region = updates.region
  if (updates.jamaat) updateData.jamaat = updates.jamaat

  const { error } = await supabase.from(TAJNEED_TABLE).update(updateData).eq("id", id)

  if (error) {
    console.error("Error updating tajneed member:", error)
    return false
  }

  return true
}

export const deleteTajneedMember = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const allMembers = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])
    const filtered = allMembers.filter((member: TajneedMember) => member.id !== id)
    saveToLocalStorage(LOCAL_TAJNEED_KEY, filtered)
    return true
  }

  const { error } = await supabase.from(TAJNEED_TABLE).delete().eq("id", id)

  if (error) {
    console.error("Error deleting tajneed member:", error)
    return false
  }

  return true
}

// Attendance Records
export const getAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  const eventId = getCurrentEventId()
  if (!eventId) return []

  if (!isSupabaseConfigured) {
    const records = getFromLocalStorage(LOCAL_ATTENDANCE_KEY, [])
    const members = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])
    return records
      .filter((record: AttendanceRecord) => record.eventId === eventId)
      .map((record: AttendanceRecord) => ({
        ...record,
        member: members.find((member: TajneedMember) => member.id === record.memberId),
      }))
  }

  const { data, error } = await supabase
    .from(ATTENDANCE_TABLE)
    .select(
      `
      id,
      event_id,
      member_id,
      recorded_at,
      member:${TAJNEED_TABLE}(
        id,
        event_id,
        full_name,
        tanzeem,
        region,
         jamaat,
        created_at
      )
    `,
    )
    .eq("event_id", eventId)
    .order("recorded_at", { ascending: false })

  if (error) {
    console.error("Error fetching attendance records:", error)
    return []
  }

  return (
  data?.map((record: any) => ({
      id: record.id,
      eventId: record.event_id,
      memberId: record.member_id,
      recordedAt: record.recorded_at,
        member: record.member
        ? {
            id: record.member.id,
            eventId: record.member.event_id,
            fullName: record.member.full_name,
            tanzeem: record.member.tanzeem,
            region: record.member.region,
           jamaat: record.member.jamaat,
            createdAt: record.member.created_at,
          }
        : undefined,
    })) || []
  )
}

export const addAttendanceRecord = async (memberId: string): Promise<AttendanceRecord | null> => {
  const eventId = getCurrentEventId()
  if (!eventId) return null

  if (!isSupabaseConfigured) {
    const records = getFromLocalStorage(LOCAL_ATTENDANCE_KEY, [])
    const members = getFromLocalStorage(LOCAL_TAJNEED_KEY, [])

    const exists = records.some(
      (record: AttendanceRecord) => record.eventId === eventId && record.memberId === memberId,
    )
    if (exists) {
      return null
    }

    const member = members.find((m: TajneedMember) => m.id === memberId)
    if (!member) return null

    const newRecord: AttendanceRecord = {
      id: Date.now().toString(),
      eventId,
      memberId,
      recordedAt: new Date().toISOString(),
      member,
    }

    records.push(newRecord)
    saveToLocalStorage(LOCAL_ATTENDANCE_KEY, records)
    return newRecord
  }

  // Check if member exists first
  const { data: memberExists, error: memberCheckError } = await supabase
    .from(TAJNEED_TABLE)
    .select("id")
    .eq("id", memberId)
    .maybeSingle()

  if (memberCheckError) {
    console.error("Error checking member existence:", {
      error: memberCheckError,
      message: memberCheckError.message,
      details: memberCheckError.details,
      hint: memberCheckError.hint,
      code: memberCheckError.code,
    })
  }

  if (!memberExists) {
    console.warn("Member not found in database:", memberId)
    return null
  }

  // Check if attendance record already exists
  const { data: existingRecord } = await supabase
    .from(ATTENDANCE_TABLE)
    .select("id")
    .eq("event_id", eventId)
    .eq("member_id", memberId)
    .maybeSingle()

  if (existingRecord) {
    console.warn("Attendance record already exists for member:", memberId)
    return null
  }

  const { data, error } = await supabase
    .from(ATTENDANCE_TABLE)
    .insert([
      {
        event_id: eventId,
        member_id: memberId,
      },
    ])
    .select(
      `
      id,
      event_id,
      member_id,
      recorded_at,
      member:${TAJNEED_TABLE}(
        id,
        event_id,
        full_name,
        tanzeem,
        region,
        jamaat,
        created_at
      )
    `,
    )
    .single()

  if (error) {
    console.error("Error adding attendance record:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      memberId,
      eventId,
    })
    return null
  }

  return {
    id: data.id,
    eventId: data.event_id,
    memberId: data.member_id,
    recordedAt: data.recorded_at,
      member: data.member
      ? {
          id: data.member.id,
          eventId: data.member.event_id,
          fullName: data.member.full_name,
          tanzeem: data.member.tanzeem,
          region: data.member.region,
          jamaat: data.member.jamaat,
          createdAt: data.member.created_at,
        }
      : undefined,
  }
}

export const removeAttendanceRecord = async (recordId: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const records = getFromLocalStorage(LOCAL_ATTENDANCE_KEY, [])
    const filtered = records.filter((record: AttendanceRecord) => record.id !== recordId)
    saveToLocalStorage(LOCAL_ATTENDANCE_KEY, filtered)
    return true
  }

  const { error } = await supabase.from(ATTENDANCE_TABLE).delete().eq("id", recordId)

  if (error) {
    console.error("Error removing attendance record:", error)
    return false
  }

  return true
}

// Regions
export const getRegions = async (): Promise<Region[]> => {
  const eventId = getCurrentEventId()
  if (!eventId) return []

  if (!isSupabaseConfigured) {
    const allRegions = getFromLocalStorage("regions", [])
    return allRegions.filter((r: Region) => r.eventId === eventId)
  }

  const { data, error } = await supabase
    .from("regions")
    .select(
      `
      id,
      event_id,
      name,
  jamaat(name)
    `,
    )
    .eq("event_id", eventId)
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching regions:", error)
    return []
  }

  return (
  data?.map((region: any) => ({
      id: region.id,
      eventId: region.event_id,
      name: region.name,
  jamaat: region.jamaat?.map((m: any) => m.name) || [],
    })) || []
  )
}

export const saveRegion = async (region: Region): Promise<Region | null> => {
  if (!isSupabaseConfigured) {
    const allRegions = getFromLocalStorage("regions", [])
    const newRegion = {
      ...region,
      id: Date.now().toString(),
    }
    allRegions.push(newRegion)
    saveToLocalStorage("regions", allRegions)
    return newRegion
  }

  const { data: regionData, error: regionError } = await supabase
    .from("regions")
    .insert([
      {
        event_id: region.eventId,
        name: region.name,
      },
    ])
    .select()
    .single()

  if (regionError) {
    console.error("Error saving region:", regionError)
    return null
  }

  // Insert jamaat
  if (region.jamaat && region.jamaat.length > 0) {
    const jamaatData = region.jamaat.map((m) => ({
      region_id: regionData.id,
      name: m,
    }))

    const { error: jamaatError } = await supabase.from("jamaat").insert(jamaatData)

    if (jamaatError) {
      console.error("Error saving jamaat:", jamaatError)
    }
  }

  return {
    id: regionData.id,
    eventId: regionData.event_id,
    name: regionData.name,
    jamaat: region.jamaat || [],
  }
}

export const updateRegion = async (id: string, updates: Partial<Region>): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const allRegions = getFromLocalStorage("regions", [])
    const index = allRegions.findIndex((r: Region) => r.id === id)
    if (index !== -1) {
      allRegions[index] = { ...allRegions[index], ...updates }
      saveToLocalStorage("regions", allRegions)
      return true
    }
    return false
  }

  const updateData: Record<string, any> = {}

  if (updates.name) updateData.name = updates.name

  const { error } = await supabase.from("regions").update(updateData).eq("id", id)

  if (error) {
    console.error("Error updating region:", error)
    return false
  }

  return true
}

export const deleteRegion = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const allRegions = getFromLocalStorage("regions", [])
    const filtered = allRegions.filter((r: Region) => r.id !== id)
    saveToLocalStorage("regions", filtered)
    return true
  }

  const { error } = await supabase.from("regions").delete().eq("id", id)

  if (error) {
    console.error("Error deleting region:", error)
    return false
  }

  return true
}

export const addJamaat = async (regionId: string, jamaatName: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const allRegions = getFromLocalStorage("regions", [])
    const region = allRegions.find((r: Region) => r.id === regionId)
    if (region) {
      if (!region.jamaat.includes(jamaatName)) {
        region.jamaat.push(jamaatName)
        saveToLocalStorage("regions", allRegions)
        return true
      }
    }
    return false
  }

  const { error } = await supabase.from("jamaat").insert([
    {
      region_id: regionId,
      name: jamaatName,
    },
  ])

  if (error) {
    console.error("Error adding jamaat:", error)
    return false
  }

  return true
}

export const deleteJamaat = async (regionId: string, jamaatName: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const allRegions = getFromLocalStorage("regions", [])
    const region = allRegions.find((r: Region) => r.id === regionId)
    if (region) {
      region.jamaat = region.jamaat.filter((m: string) => m !== jamaatName)
      saveToLocalStorage("regions", allRegions)
      return true
    }
    return false
  }

  const { error } = await supabase.from("jamaat").delete().eq("region_id", regionId).eq("name", jamaatName)

  if (error) {
    console.error("Error deleting jamaat:", error)
    return false
  }

  return true
}

// Settings
export const getSettings = async (): Promise<EventSettings> => {
  const eventId = getCurrentEventId()
  if (!eventId) return getDefaultSettings()

  if (!isSupabaseConfigured) {
    const events = getFromLocalStorage("events_list", [])
    const event = events.find((e: EventSettings) => e.id === eventId)
    return event || getDefaultSettings()
  }

  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single()

  if (error || !data) {
    console.error("Error fetching settings:", error)
    return getDefaultSettings()
  }

  return {
    id: data.id,
    eventName: data.event_name,
    startingDate: data.starting_date,
    duration: data.duration,
    location: data.location,
    theme: data.theme,
    createdAt: data.created_at,
  }
}

export const updateSettings = async (settings: EventSettings): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const events = getFromLocalStorage("events_list", [])
    const index = events.findIndex((e: EventSettings) => e.id === settings.id)
    if (index !== -1) {
      events[index] = settings
      saveToLocalStorage("events_list", events)
      return true
    }
    return false
  }

  const { error } = await supabase
    .from("events")
    .update({
      event_name: settings.eventName,
      starting_date: settings.startingDate,
      duration: settings.duration,
      location: settings.location,
      theme: settings.theme,
    })
    .eq("id", settings.id)

  if (error) {
    console.error("Error updating settings:", error)
    return false
  }

  return true
}

export const updateEvent = updateSettings

export const getDefaultSettings = (): EventSettings => ({
  id: "",
  eventName: "Jalsa Salana",
  startingDate: new Date().toISOString().split("T")[0],
  duration: 3,
  location: "Nairobi",
  theme: "Unity, Faith, and Service",
  createdAt: new Date().toISOString(),
})

// Tanzeem Counters
export const getTanzeemCounters = async (): Promise<Record<string, number>> => {
  const eventId = getCurrentEventId()
  if (!eventId) return {}

  if (!isSupabaseConfigured) {
    const counters = getFromLocalStorage(`counters_${eventId}`, {})
    return counters
  }

  const { data, error } = await supabase.from("tanzeem_counters").select("*").eq("event_id", eventId)

  if (error) {
    console.error("Error fetching tanzeem counters:", error)
    return {}
  }

  const counters: Record<string, number> = {}
  data?.forEach((item: any) => {
    counters[item.tanzeem] = item.counter
  })

  return counters
}
export const incrementTanzeemCounter = async (tanzeem: string): Promise<number> => {
  const eventId = getCurrentEventId()
  if (!eventId) return 0

  if (!isSupabaseConfigured) {
    const counters = getFromLocalStorage(`counters_${eventId}`, {})
    const newCounter = (counters[tanzeem] || 0) + 1
    counters[tanzeem] = newCounter
    saveToLocalStorage(`counters_${eventId}`, counters)
    return newCounter
  }

  // Get current counter
  const { data: existing } = await supabase
    .from("tanzeem_counters")
    .select("counter")
    .eq("event_id", eventId)
    .eq("tanzeem", tanzeem)
    .single()

  const newCounter = (existing?.counter || 0) + 1

  // Upsert the counter
  const { error } = await supabase.from("tanzeem_counters").upsert(
    {
      event_id: eventId,
      tanzeem,
      counter: newCounter,
    },
    { onConflict: "event_id,tanzeem" },
  )

  if (error) {
    console.error("Error incrementing counter:", error)
    return 0
  }

  return newCounter
}

export const resetTanzeemCounters = async (): Promise<boolean> => {
  const eventId = getCurrentEventId()
  if (!eventId) return false

  if (!isSupabaseConfigured) {
    localStorage.removeItem(`counters_${eventId}`)
    return true
  }

  const { error } = await supabase.from("tanzeem_counters").delete().eq("event_id", eventId)

  if (error) {
    console.error("Error resetting counters:", error)
    return false
  }

  return true
}

// Security Movements Management
export const getSecurityMovements = async (): Promise<SecurityMovement[]> => {
  const eventId = getCurrentEventId()
  if (!eventId) return []
  if (!isSupabaseConfigured) {
    const allMovements = getFromLocalStorage(LOCAL_SECURITY_KEY, [])
    const movements = allMovements.filter((movement: SecurityMovement) => movement.eventId === eventId)
    const attendanceRecords = await getAttendanceRecords()
    return movements.map((movement: SecurityMovement) => ({
      ...movement,
      attendanceRecord: attendanceRecords.find((record) => record.id === movement.attendanceRecordId),
    }))
  }

  const { data, error } = await supabase
    .from(SECURITY_TABLE)
    .select(
      `
      id,
      event_id,
      attendance_record_id,
      status,
      timestamp,
      attendance_record:${ATTENDANCE_TABLE}(
        id,
        event_id,
        member_id,
        recorded_at,
        member:${TAJNEED_TABLE}(
            id,
            event_id,
            full_name,
            tanzeem,
            region,
            jamaat,
            created_at
          )
      )
    `,
    )
    .eq("event_id", eventId)
    .order("timestamp", { ascending: false })

  if (error) {
    console.error("Error fetching security movements:", error)
    return []
  }

  return (
  data?.map((movement: any) => ({
      id: movement.id,
      eventId: movement.event_id,
      attendanceRecordId: movement.attendance_record_id,
      status: movement.status as MovementStatus,
      timestamp: movement.timestamp,
      attendanceRecord: movement.attendance_record
        ? {
            id: movement.attendance_record.id,
            eventId: movement.attendance_record.event_id,
            memberId: movement.attendance_record.member_id,
            recordedAt: movement.attendance_record.recorded_at,
            member: movement.attendance_record.member
              ? {
                  id: movement.attendance_record.member.id,
                  eventId: movement.attendance_record.member.event_id,
                  fullName: movement.attendance_record.member.full_name,
                  tanzeem: movement.attendance_record.member.tanzeem,
                  region: movement.attendance_record.member.region,
                  jamaat: movement.attendance_record.member.jamaat,
                  createdAt: movement.attendance_record.member.created_at,
                }
              : undefined,
          }
        : undefined,
    })) || []
  )
}

export const getSecurityStatusForAttendance = async (attendanceRecordId: string): Promise<MovementStatus | null> => {
  const eventId = getCurrentEventId()
  if (!eventId) return null

  if (!isSupabaseConfigured) {
    const allMovements = getFromLocalStorage(LOCAL_SECURITY_KEY, [])
    const latest = allMovements
      .filter(
        (movement: SecurityMovement) =>
          movement.eventId === eventId && movement.attendanceRecordId === attendanceRecordId,
      )
      .sort((a: SecurityMovement, b: SecurityMovement) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    return latest?.status || null
  }

  const { data, error } = await supabase
    .from(SECURITY_TABLE)
    .select("status")
    .eq("event_id", eventId)
    .eq("attendance_record_id", attendanceRecordId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data.status as MovementStatus
}

export const toggleSecurityMovement = async (
  attendanceRecordId: string,
  newStatus: MovementStatus,
): Promise<boolean> => {
  const eventId = getCurrentEventId()
  if (!eventId) return false

  const movement: SecurityMovement = {
    id: crypto.randomUUID(),
    eventId,
    attendanceRecordId,
    status: newStatus,
    timestamp: new Date().toISOString(),
  }

  if (!isSupabaseConfigured) {
    const allMovements = getFromLocalStorage(LOCAL_SECURITY_KEY, [])
    allMovements.push(movement)
    saveToLocalStorage(LOCAL_SECURITY_KEY, allMovements)
    return true
  }

  const { error } = await supabase.from(SECURITY_TABLE).insert({
    id: movement.id,
    event_id: eventId,
    attendance_record_id: attendanceRecordId,
    status: newStatus,
    timestamp: movement.timestamp,
  })

  if (error) {
    console.error("Error saving security movement:", error)
    return false
  }

  return true
}

// Catering Records Management
export const getCateringRecords = async (day?: DayOfWeek, mealType?: MealType): Promise<CateringRecord[]> => {
  const eventId = getCurrentEventId()
  if (!eventId) return []

  if (!isSupabaseConfigured) {
    let allRecords = getFromLocalStorage(LOCAL_CATERING_KEY, [])
    allRecords = allRecords.filter((record: CateringRecord) => record.eventId === eventId)
    if (day) allRecords = allRecords.filter((record: CateringRecord) => record.day === day)
    if (mealType) allRecords = allRecords.filter((record: CateringRecord) => record.mealType === mealType)

    const attendanceRecords = await getAttendanceRecords()
    return allRecords.map((record: CateringRecord) => ({
      ...record,
      attendanceRecord: attendanceRecords.find((r) => r.id === record.attendanceRecordId),
    }))
  }

  let query = supabase
    .from(CATERED_TABLE)
    .select(
      `
      id,
      event_id,
      attendance_record_id,
      day,
      meal_type,
      served_at,
      attendance_record:${ATTENDANCE_TABLE}(
        id,
        event_id,
        member_id,
        recorded_at,
        member:${TAJNEED_TABLE}(
          id,
          event_id,
          full_name,
          tanzeem,
          region,
          jamaat,
          created_at
        )
      )
    `,
    )
    .eq("event_id", eventId)

  if (day) query = query.eq("day", day)
  if (mealType) query = query.eq("meal_type", mealType)

  const { data, error } = await query.order("served_at", { ascending: false })

  if (error) {
    console.error("Error fetching catering records:", error)
    return []
  }

  return (
  data?.map((record: any) => ({
      id: record.id,
      eventId: record.event_id,
      attendanceRecordId: record.attendance_record_id,
      day: record.day as DayOfWeek,
      mealType: record.meal_type as MealType,
      servedAt: record.served_at,
      attendanceRecord: record.attendance_record
        ? {
            id: record.attendance_record.id,
            eventId: record.attendance_record.event_id,
            memberId: record.attendance_record.member_id,
            recordedAt: record.attendance_record.recorded_at,
            member: record.attendance_record.member
              ? {
                  id: record.attendance_record.member.id,
                  eventId: record.attendance_record.member.event_id,
                  fullName: record.attendance_record.member.full_name,
                  tanzeem: record.attendance_record.member.tanzeem,
                  region: record.attendance_record.member.region,
                  jamaat: record.attendance_record.member.jamaat,
                  createdAt: record.attendance_record.member.created_at,
                }
              : undefined,
          }
        : undefined,
    })) || []
  )
}

export const addCateringRecord = async (
  attendanceRecordId: string,
  day: DayOfWeek,
  mealType: MealType,
): Promise<boolean> => {
  const eventId = getCurrentEventId()
  if (!eventId) return false

  // Check if already served
  const existing = await getCateringRecords(day, mealType)
  if (existing.some((record) => record.attendanceRecordId === attendanceRecordId)) {
    return false // Already served
  }

  const record: CateringRecord = {
    id: crypto.randomUUID(),
    eventId,
    attendanceRecordId,
    day,
    mealType,
    servedAt: new Date().toISOString(),
  }

  if (!isSupabaseConfigured) {
    const allRecords = getFromLocalStorage(LOCAL_CATERING_KEY, [])
    allRecords.push(record)
    saveToLocalStorage(LOCAL_CATERING_KEY, allRecords)
    return true
  }

  const { error } = await supabase.from(CATERED_TABLE).insert({
    id: record.id,
    event_id: eventId,
    attendance_record_id: attendanceRecordId,
    day,
    meal_type: mealType,
    served_at: record.servedAt,
  })

  if (error) {
    console.error("Error saving catering record:", error)
    return false
  }

  return true
}

export const removeCateringRecord = async (recordId: string): Promise<boolean> => {
  const eventId = getCurrentEventId()
  if (!eventId) return false

  if (!isSupabaseConfigured) {
    const allRecords = getFromLocalStorage(LOCAL_CATERING_KEY, [])
    const filtered = allRecords.filter((record: CateringRecord) => record.id !== recordId)
    saveToLocalStorage(LOCAL_CATERING_KEY, filtered)
    return true
  }

  const { error } = await supabase.from(CATERED_TABLE).delete().eq("id", recordId).eq("event_id", eventId)

  if (error) {
    console.error("Error removing catering record:", error)
    return false
  }

  return true
}

// Users Management
export const getUsers = async (): Promise<User[]> => {
  if (!isSupabaseConfigured) {
    return getFromLocalStorage(LOCAL_USERS_KEY, [])
  }

  const { data, error } = await supabase.from(USERS_TABLE).select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching users:", error)
    return []
  }

  return (
  data?.map((user: any) => ({
      id: user.id,
      username: user.username,
      password: user.password,
      role: user.role as UserRole,
      fullName: user.full_name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })) || []
  )
}

export const getUserByUsername = async (username: string): Promise<User | null> => {
  if (!isSupabaseConfigured) {
    const users = getFromLocalStorage(LOCAL_USERS_KEY, [])
    return users.find((user: User) => user.username === username) || null
  }

  const { data, error } = await supabase.from(USERS_TABLE).select("*").eq("username", username).single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    username: data.username,
    password: data.password,
    role: data.role as UserRole,
    fullName: data.full_name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export const createUser = async (userData: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<boolean> => {
  const user: User = {
    id: crypto.randomUUID(),
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (!isSupabaseConfigured) {
    const users = getFromLocalStorage(LOCAL_USERS_KEY, [])
    // Check if username already exists
    if (users.some((u: User) => u.username === user.username)) {
      return false
    }
    users.push(user)
    saveToLocalStorage(LOCAL_USERS_KEY, users)
    return true
  }

  // Check if username already exists
  const existing = await getUserByUsername(user.username)
  if (existing) {
    return false
  }

  const { error } = await supabase.from(USERS_TABLE).insert({
    id: user.id,
    username: user.username,
    password: user.password,
    role: user.role,
    full_name: user.fullName,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  })

  if (error) {
    console.error("Error creating user:", error)
    return false
  }

  return true
}

export const updateUser = async (userId: string, userData: Partial<Omit<User, "id" | "createdAt">>): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const users = getFromLocalStorage(LOCAL_USERS_KEY, [])
    const index = users.findIndex((u: User) => u.id === userId)
    if (index === -1) return false

    // Check if username already exists (for other users)
    if (userData.username && users.some((u: User, i: number) => u.username === userData.username && i !== index)) {
      return false
    }

    users[index] = {
      ...users[index],
      ...userData,
      updatedAt: new Date().toISOString(),
    }
    saveToLocalStorage(LOCAL_USERS_KEY, users)
    return true
  }

  // Check if username already exists (for other users)
  if (userData.username) {
    const existing = await getUserByUsername(userData.username)
    if (existing && existing.id !== userId) {
      return false
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }
  if (userData.username) updateData.username = userData.username
  if (userData.password) updateData.password = userData.password
  if (userData.role) updateData.role = userData.role
  if (userData.fullName) updateData.full_name = userData.fullName

  const { error } = await supabase.from(USERS_TABLE).update(updateData).eq("id", userId)

  if (error) {
    console.error("Error updating user:", error)
    return false
  }

  return true
}

export const deleteUser = async (userId: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    const users = getFromLocalStorage(LOCAL_USERS_KEY, [])
    const filtered = users.filter((u: User) => u.id !== userId)
    saveToLocalStorage(LOCAL_USERS_KEY, filtered)
    return true
  }

  const { error } = await supabase.from(USERS_TABLE).delete().eq("id", userId)

  if (error) {
    console.error("Error deleting user:", error)
    return false
  }

  return true
}

export { getCurrentEventId, setCurrentEventId }
