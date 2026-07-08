import { supabase } from "./supabase";
import { createClient } from "./supabaseServer";

export async function getCurrentOrganization() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", user.id)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
}

export async function getOrganizationId() {
  const supabaseServer = await createClient();

  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabaseServer
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}
