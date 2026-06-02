"use client";

import { FormEvent, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

const AUTH_STORAGE_KEY = "pm-authenticated";
const AUTH_USERNAME_STORAGE_KEY = "pm-auth-username";
const USERS_STORAGE_KEY = "pm-users";
const DUMMY_USERNAME = "user";
const DUMMY_PASSWORD = "password";

type AuthMode = "sign-in" | "sign-up";
type StoredUser = {
  username: string;
  password: string;
};

const readStoredUsers = (): StoredUser[] => {
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is StoredUser =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { username?: unknown }).username === "string" &&
        typeof (item as { password?: unknown }).password === "string"
    );
  } catch {
    return [];
  }
};

const writeStoredUsers = (users: StoredUser[]) => {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const LoginGate = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUsername, setAuthenticatedUsername] = useState(DUMMY_USERNAME);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuth === "true") {
      const savedUsername =
        window.localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) ?? DUMMY_USERNAME;
      setAuthenticatedUsername(savedUsername);
      setIsAuthenticated(true);
    }
  }, []);

  const signIn = (nextUsername: string) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    window.localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, nextUsername);
    setAuthenticatedUsername(nextUsername);
    setIsAuthenticated(true);
    setError("");
  };

  const handleAuthSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError("Username and password are required.");
      return;
    }

    const availableUsers: StoredUser[] = [
      { username: DUMMY_USERNAME, password: DUMMY_PASSWORD },
      ...readStoredUsers(),
    ];

    if (authMode === "sign-up") {
      const alreadyExists = availableUsers.some(
        (user) => user.username === normalizedUsername
      );
      if (alreadyExists) {
        setError("Username already exists.");
        return;
      }
      writeStoredUsers([
        ...readStoredUsers(),
        { username: normalizedUsername, password },
      ]);
      signIn(normalizedUsername);
      return;
    }

    const validUser = availableUsers.find(
      (user) => user.username === normalizedUsername && user.password === password
    );
    if (!validUser) {
      setError("Invalid username or password.");
      return;
    }
    signIn(validUser.username);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
    setIsAuthenticated(false);
    setAuthenticatedUsername(DUMMY_USERNAME);
    setAuthMode("sign-in");
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
            {authMode === "sign-in" ? "Sign in" : "Sign up"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
            {authMode === "sign-in" ? (
              <>
                Use username <strong>user</strong> and password <strong>password</strong>, or
                sign up for a new account.
              </>
            ) : (
              "Create a new account to save your own board state."
            )}
          </p>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              aria-label="Switch to sign in"
              onClick={() => {
                setAuthMode("sign-in");
                setError("");
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                authMode === "sign-in"
                  ? "bg-[var(--secondary-purple)] text-white"
                  : "border border-[var(--stroke)] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-label="Switch to sign up"
              onClick={() => {
                setAuthMode("sign-up");
                setError("");
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                authMode === "sign-up"
                  ? "bg-[var(--secondary-purple)] text-white"
                  : "border border-[var(--stroke)] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
              }`}
            >
              Sign up
            </button>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleAuthSubmit}>
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
              {authMode === "sign-in" ? "Sign in" : "Create account"}
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
      <KanbanBoard username={authenticatedUsername} />
    </div>
  );
};
