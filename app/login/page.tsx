"use client";

import { useActionState } from "react";
import { login } from "./action";


export default function LoginPage() {
    const [state, formAction, pending] = useActionState(login, null);   
  return (
    <main>
      <h1>Nurse login</h1>
      <form action={formAction} >
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" required />
        </label>

        {state?.error && <p>{state.error}</p>}

        <button type="submit" disabled={pending}>
            {pending ? "Logging in..." : "Log in"}
        </button>
         
      </form>
    </main>
  );
}