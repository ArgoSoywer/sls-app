"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PathKey, Task, TaskCategory } from "@/types/game";

let supabaseClient: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient !== undefined) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !anonKey) {
    supabaseClient = null;
    return null;
  }
  if (!url || !anonKey) {
    throw new Error("Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  supabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return supabaseClient;
}

export async function ensureAnonymousSession(): Promise<string> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error(`Could not read the Supabase session: ${sessionError.message}`);
  if (sessionData.session?.user.id) return sessionData.session.user.id;
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    throw new Error(`Could not start a player session. Enable anonymous sign-in in Supabase: ${error.message}`);
  }
  if (!data.user?.id) throw new Error("Supabase did not return an authenticated player.");
  return data.user.id;
}

interface RemoteTask {
  id: string;
  user_id: string;
  path: PathKey;
  category: TaskCategory;
  title: string;
  description: string;
  xp_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function fromRemoteTask(row: RemoteTask): Task {
  return {
    id: row.id,
    userId: row.user_id,
    path: row.path,
    category: row.category,
    title: row.title,
    description: row.description,
    xpValue: row.xp_value,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
