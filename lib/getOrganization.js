import { supabase } from "./supabase";

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
