import { login } from "./action";
export default function LoginPage() {
  return (
    <main>
      <h1>Nurse login</h1>
      <form action={login} >
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" required />
        </label>
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}