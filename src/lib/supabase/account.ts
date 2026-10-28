import { getSupabaseClient } from "@/lib/supabase/client";

function requireSupabaseClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Configure Supabase to enable account sync across browsers.");
  return client;
}

export async function loadAccountEmail(): Promise<string> {
  const client = getSupabaseClient();
  if (!client) return "";

  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(`Could not read account status: ${error.message}`);
  return data.session?.user.email ?? "";
}

export async function linkOrCreateAccount(
  email: string,
  password: string,
): Promise<{ email: string; message: string }> {
  const client = requireSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error(`Could not read the current player session: ${sessionError.message}`);

  const normalizedEmail = email.trim();
  if (sessionData.session?.user.is_anonymous) {
    const { data, error } = await client.auth.updateUser({ email: normalizedEmail, password });
    if (error) throw new Error(`Could not link this local profile: ${error.message}`);
    return {
      email: data.user.email ?? normalizedEmail,
      message: "Profile linked. Confirm the email if prompted, then sign in with this account on your other browsers.",
    };
  }

  const { error } = await client.auth.signUp({ email: normalizedEmail, password });
  if (error) throw new Error(`Could not create the account: ${error.message}`);
  return {
    email: "",
    message: "Account created. Confirm your email, then sign in with this account on your other browsers.",
  };
}

export async function signInToAccount(email: string, password: string): Promise<string> {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(`Could not sign in: ${error.message}`);
  return data.user.email ?? email.trim();
}
