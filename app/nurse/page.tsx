import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/action";

export default function NursePage() {
  return (
    <main>
      <h1>Nurse dashboard</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <Greeting />
      </Suspense>

      <form action={logout}>
        <button type="submit">Log out</button>
        </form>
    </main>
  );
}

async function Greeting() {
    await connection();
  const supabase = await createClient();

  // 1. Who is logged in?
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  // 2. Get their name
  const { data: worker } = await supabase
    .from("workers")
    .select("name")
    .eq("id", data.user.id)
    .single();

  return <p>Hello, {worker?.name}</p>;
}