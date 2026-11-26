import { redirect } from "next/navigation";

// Families arrive with a QR link to /track/[token]; everyone else is staff.
export default function Home() {
  redirect("/login");
}
