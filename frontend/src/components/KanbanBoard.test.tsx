import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("loads and renders five columns from backend data", async () => {
    const loadBoard = vi.fn().mockResolvedValue(initialData);
    render(<KanbanBoard loadBoard={loadBoard} saveBoard={vi.fn()} />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(loadBoard).toHaveBeenCalledWith("user");
  });

  it("renames a column and persists updates", async () => {
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    render(<KanbanBoard loadBoard={vi.fn().mockResolvedValue(initialData)} saveBoard={saveBoard} />);

    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    expect(saveBoard).toHaveBeenCalled();
  });

  it("adds and removes a card", async () => {
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    render(<KanbanBoard loadBoard={vi.fn().mockResolvedValue(initialData)} saveBoard={saveBoard} />);

    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    expect(saveBoard).toHaveBeenCalled();
  });

  it("shows load error and retries successfully", async () => {
    const loadBoard = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(initialData);

    render(<KanbanBoard loadBoard={loadBoard} saveBoard={vi.fn()} />);

    expect(
      await screen.findByText(/unable to load board from the backend/i)
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry loading board/i }));
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(loadBoard).toHaveBeenCalledTimes(2);
  });
});
