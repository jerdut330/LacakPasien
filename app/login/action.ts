"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export type LoginState = { error: string } | null;

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();

  // 1. Check email + password
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Incorrect Email or Password" };

  // 2. Look up their role
  const { data: worker } = await supabase
    .from("workers")
    .select("role")
    .eq("id", data.user.id)
    .single();

  // 3. Send each role to its own page. Not a worker? Log them out and stop
  if (worker?.role === "management") redirect("/manage");
  if (worker?.role !== "nurse") {
    await supabase.auth.signOut();
    return { error: "This account doesn’t have staff access." };
  }

  redirect("/nurse");
}

export async function logout(){

    const supabase = await createClient();
    await supabase.auth.signOut();
  
  redirect("/login");
}