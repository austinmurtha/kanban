import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginGate } from "@/components/LoginGate";

vi.mock("@/components/KanbanBoard", () => ({
  KanbanBoard: () => <div>Kanban Studio</div>,
}));

describe("LoginGate", () => {
  it("renders login form by default", () => {
    render(<LoginGate />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows an error on invalid credentials", async () => {
    render(<LoginGate />);
    await userEvent.type(screen.getByLabelText(/username/i), "wrong");
    await userEvent.type(screen.getByLabelText(/password/i), "creds");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("logs in with valid credentials and can log out", async () => {
    render(<LoginGate />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Kanban Studio")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("restores authenticated session from local storage", () => {
    window.localStorage.setItem("pm-authenticated", "true");
    render(<LoginGate />);
    expect(screen.getByText("Kanban Studio")).toBeInTheDocument();
  });
});
