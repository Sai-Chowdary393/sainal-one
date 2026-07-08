import { createClient } from "./supabaseServer";

export async function getOrganizationId() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}
