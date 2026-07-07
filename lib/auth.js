import { supabase } from "./supabase";


export async function getCurrentUser() {

  const {
    data: { user },
    error,

  } = await supabase.auth.getUser();


  if (error) {
    return null;
  }


  return user;
}



export async function logoutUser() {

  await supabase.auth.signOut();

}
