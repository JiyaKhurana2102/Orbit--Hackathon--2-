import { projectId, publicAnonKey } from '/utils/supabase/info';
import { createClient } from '@supabase/supabase-js';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-45bdfe12`;

// Create Supabase client for auth
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// Get user access token from current session
const getAccessToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

// ── Header helpers ──────────────────────────────────────────────────────────
// Root cause of 401s: Supabase's Edge Function *gateway* validates whatever
// JWT is in the Authorization header. User access tokens can be rejected at
// the gateway level (expired, clock skew) with {"code":401,"message":"Invalid JWT"}
// before our Hono code even runs.
//
// Fix: Always send the publicAnonKey in Authorization (it always passes the
// gateway). Pass the user's JWT in the custom X-User-Token header, which our
// server's verifyUser() reads for identity — bypassing gateway validation.

const publicHeaders = (): Record<string, string> => ({
  'Authorization': `Bearer ${publicAnonKey}`,
});

// Throws if user is not signed in
const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-User-Token': token,
  };
};

// Returns headers without throwing — for optional-auth endpoints
const optionalAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAccessToken();
  return {
    'Authorization': `Bearer ${publicAnonKey}`,
    ...(token ? { 'X-User-Token': token } : {}),
  };
};

// ==================== AUTHENTICATION ====================

export const signUp = async (email: string, password: string, name: string) => {
  const response = await fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...publicHeaders() },
    body: JSON.stringify({ email, password, name }),
  });
  return response.json();
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};

// ==================== EVENTS ====================

export const getAllEvents = async () => {
  const response = await fetch(`${API_BASE}/events`, { headers: publicHeaders() });
  if (!response.ok) {
    const text = await response.text();
    console.error(`getAllEvents error (${response.status}):`, text);
    return { events: [] };
  }
  return response.json();
};

export const getEventById = async (id: string) => {
  const response = await fetch(`${API_BASE}/events/${encodeURIComponent(id)}`, {
    headers: publicHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`getEventById error (${response.status}):`, text);
    return { event: null };
  }
  return response.json();
};

export const getEventsByCategory = async (category: string) => {
  const response = await fetch(`${API_BASE}/events/category/${category}`, {
    headers: publicHeaders(),
  });
  return response.json();
};

export const createEvent = async (eventData: any) => {
  const response = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...publicHeaders() },
    body: JSON.stringify(eventData),
  });
  return response.json();
};

// ==================== USER PROFILE ====================

export const getProfile = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/profile`, { headers });
  if (!response.ok) {
    const text = await response.text();
    console.error(`getProfile error (${response.status}):`, text);
    return { profile: null };
  }
  return response.json();
};

export const updateProfile = async (updates: any) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(updates),
  });
  return response.json();
};

export const updateInterests = async (interests: string[]) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/profile/interests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ interests }),
  });
  return response.json();
};

// ==================== SAVED EVENTS ====================

export const getSavedEvents = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/saved-events`, { headers });
  if (!response.ok) {
    const text = await response.text();
    console.error(`getSavedEvents error (${response.status}):`, text);
    return { events: [] };
  }
  return response.json();
};

export const getSavedEventIds = async (): Promise<string[]> => {
  try {
    const headers = await optionalAuthHeaders();
    if (!headers['X-User-Token']) return [];
    const response = await fetch(`${API_BASE}/saved-events/ids`, { headers });
    if (!response.ok) {
      console.error(`getSavedEventIds error (${response.status})`);
      return [];
    }
    const data = await response.json();
    return data.ids || [];
  } catch (err) {
    console.error('getSavedEventIds fetch error:', err);
    return [];
  }
};

export const saveEvent = async (eventId: string) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/saved-events/${eventId}`, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`saveEvent error (${response.status}):`, text);
    throw new Error(`Save failed: ${response.status}`);
  }
  return response.json();
};

export const unsaveEvent = async (eventId: string) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/saved-events/${eventId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`unsaveEvent error (${response.status}):`, text);
    throw new Error(`Unsave failed: ${response.status}`);
  }
  return response.json();
};

// ==================== REMINDERS ====================

export const getReminderIds = async (): Promise<string[]> => {
  try {
    const headers = await optionalAuthHeaders();
    if (!headers['X-User-Token']) return [];
    const response = await fetch(`${API_BASE}/reminders`, { headers });
    if (!response.ok) return [];
    const data = await response.json();
    return data.ids || [];
  } catch {
    return [];
  }
};

export const setReminder = async (eventId: string) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/reminders/${eventId}`, {
    method: 'POST',
    headers,
  });
  return response.json();
};

export const removeReminder = async (eventId: string) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/reminders/${eventId}`, {
    method: 'DELETE',
    headers,
  });
  return response.json();
};

// ==================== AI ASSISTANT ====================

export const sendAIMessage = async (message: string, userId?: string) => {
  const response = await fetch(`${API_BASE}/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...publicHeaders() },
    body: JSON.stringify({ message, userId }),
  });
  return response.json();
};

// ==================== SEED DATA ====================

export const seedEvents = async () => {
  const response = await fetch(`${API_BASE}/seed-events`, {
    method: 'POST',
    headers: publicHeaders(),
  });
  return response.json();
};

export const forceReseed = async () => {
  const response = await fetch(`${API_BASE}/force-reseed`, {
    method: 'POST',
    headers: publicHeaders(),
  });
  return response.json();
};

export const syncNebulaEvents = async () => {
  const response = await fetch(`${API_BASE}/sync-nebula`, {
    method: 'POST',
    headers: publicHeaders(),
  });
  return response.json();
};

// ==================== CLUBS ====================

export const getAllClubs = async () => {
  const response = await fetch(`${API_BASE}/clubs`, { headers: publicHeaders() });
  if (!response.ok) {
    const text = await response.text();
    console.error(`getAllClubs error (${response.status}):`, text);
    return { clubs: [] };
  }
  return response.json();
};

export const getClubById = async (id: string) => {
  const response = await fetch(`${API_BASE}/clubs/${id}`, { headers: publicHeaders() });
  if (!response.ok) return { club: null };
  return response.json();
};

export const seedClubs = async () => {
  const response = await fetch(`${API_BASE}/seed-clubs`, {
    method: 'POST',
    headers: publicHeaders(),
  });
  return response.json();
};
