// frontend/components/auth/AuthScreen.tsx

"use client";

import { useState } from "react";

import { ApiError } from "@/services/apiClient";
import { useAuth } from "@/store/AuthContext";
import { useI18n } from "@/store/LanguageContext";

type Mode = "login" | "register";

export default function AuthScreen() {
  const { t } = useI18n();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ username, password });
      } else {
        await register({ username, password, registration_code: registrationCode });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_registration_code") {
        setError(t("auth.invalidCode"));
      } else {
        setError(err instanceof Error ? err.message : t("errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login" ? t("auth.signInTitle") : t("auth.registerTitle");
  const submitLabel = mode === "login" ? t("auth.signIn") : t("auth.register");
  const toggleLabel = mode === "login" ? t("auth.needAccount") : t("auth.haveAccount");

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-title">{title}</div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label" htmlFor="auth-username">
            {t("auth.username")}
          </label>
          <input
            id="auth-username"
            className="auth-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="auth-password">
            {t("auth.password")}
          </label>
          <input
            id="auth-password"
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </div>

        {mode === "register" && (
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-code">
              {t("auth.registrationCode")}
            </label>
            <input
              id="auth-code"
              className="auth-input"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
        )}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? t("common.loading") : submitLabel}
        </button>

        <button
          className="auth-toggle"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {toggleLabel}
        </button>
      </form>
    </div>
  );
}
