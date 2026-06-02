"use client";

import { FormEvent, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

const AUTH_STORAGE_KEY = "pm-authenticated";
const DUMMY_USERNAME = "user";
const DUMMY_PASSWORD = "password";

export const LoginGate = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (username === DUMMY_USERNAME && password === DUMMY_PASSWORD) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setIsAuthenticated(true);
      setError("");
      return;
    }

    setError("Invalid username or password.");
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setError("");
  };

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6 py-16">
        <section className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Project Management MVP
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
            Use username <strong>user</strong> and password <strong>password</strong>.
          </p>
          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
                htmlFor="username"
              >
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete="current-password"
                required
              />
            </div>
            {error ? (
              <p className="text-sm font-medium text-[var(--secondary-purple)]">{error}</p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleLogout}
        className="absolute right-6 top-6 z-10 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy-dark)] shadow-[var(--shadow)] transition hover:border-[var(--primary-blue)]"
      >
        Log out
      </button>
      <KanbanBoard />
    </div>
  );
};
