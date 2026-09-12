import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@streaming/api-client";
import { useAuthStore } from "../store/useAuthStore";
import { Focusable } from "../tv-navigation/Focusable";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/profiles", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in. Check the API is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>PrivateFlix</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error-text">{error}</p>}
        <Focusable type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Focusable>
      </form>
    </div>
  );
}
