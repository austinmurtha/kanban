import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginGate } from "@/components/LoginGate";

vi.mock("@/components/KanbanBoard", () => ({
  KanbanBoard: ({ username }: { username?: string }) => (
    <div>Kanban Studio ({username})</div>
  ),
}));

describe("LoginGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders login form by default", () => {
    render(<LoginGate />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/Kanban Studio/i)).not.toBeInTheDocument();
  });

  it("shows an error on invalid credentials", async () => {
    render(<LoginGate />);
    await userEvent.type(screen.getByLabelText(/username/i), "wrong");
    await userEvent.type(screen.getByLabelText(/password/i), "creds");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kanban Studio/i)).not.toBeInTheDocument();
  });

  it("logs in with valid credentials and can log out", async () => {
    render(<LoginGate />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(screen.getByText("Kanban Studio (user)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("restores authenticated session from local storage", () => {
    window.localStorage.setItem("pm-authenticated", "true");
    window.localStorage.setItem("pm-auth-username", "sam");
    render(<LoginGate />);
    expect(screen.getByText("Kanban Studio (sam)")).toBeInTheDocument();
  });

  it("supports sign up and sign in with new credentials", async () => {
    render(<LoginGate />);

    await userEvent.click(screen.getByRole("button", { name: /switch to sign up/i }));
    await userEvent.type(screen.getByLabelText(/username/i), "alex");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText("Kanban Studio (alex)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    await userEvent.type(screen.getByLabelText(/username/i), "alex");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(screen.getByText("Kanban Studio (alex)")).toBeInTheDocument();
  });

  it("shows an error when signing up with an existing username", async () => {
    render(<LoginGate />);

    await userEvent.click(screen.getByRole("button", { name: /switch to sign up/i }));
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "anything");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
  });
});
