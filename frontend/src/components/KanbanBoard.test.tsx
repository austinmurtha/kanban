import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { type BoardData, initialData } from "@/lib/kanban";

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
    await waitFor(() => expect(saveBoard).toHaveBeenCalled());
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
    await waitFor(() => expect(saveBoard).toHaveBeenCalled());
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

  it("sends chat messages and renders assistant replies", async () => {
    const sendChat = vi.fn().mockResolvedValue({
      assistant_message: "No board changes needed.",
      board_update: null,
    });
    render(
      <KanbanBoard
        loadBoard={vi.fn().mockResolvedValue(initialData)}
        saveBoard={vi.fn()}
        sendChat={sendChat}
      />
    );

    await screen.findAllByTestId(/column-/i);
    await userEvent.type(screen.getByLabelText("Message"), "Summarize this board");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(sendChat).toHaveBeenCalledWith("user", "Summarize this board", []);
    });
    expect(await screen.findByText("No board changes needed.")).toBeInTheDocument();
    expect(screen.getByTestId("chat-message-user")).toHaveTextContent("Summarize this board");
  });

  it("shows chat error when assistant call fails", async () => {
    const sendChat = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <KanbanBoard
        loadBoard={vi.fn().mockResolvedValue(initialData)}
        saveBoard={vi.fn()}
        sendChat={sendChat}
      />
    );

    await screen.findAllByTestId(/column-/i);
    await userEvent.type(screen.getByLabelText("Message"), "Move card-1");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(
      await screen.findByText(/unable to reach the ai assistant right now/i)
    ).toBeInTheDocument();
  });

  it("shows chat loading state while waiting for assistant", async () => {
    let resolveChat: ((value: { assistant_message: string; board_update: null }) => void) | null =
      null;
    const sendChat = vi.fn().mockImplementation(
      () =>
        new Promise<{ assistant_message: string; board_update: null }>((resolve) => {
          resolveChat = resolve;
        })
    );

    render(
      <KanbanBoard
        loadBoard={vi.fn().mockResolvedValue(initialData)}
        saveBoard={vi.fn()}
        sendChat={sendChat}
      />
    );

    await screen.findAllByTestId(/column-/i);
    await userEvent.type(screen.getByLabelText("Message"), "Any blockers?");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(screen.getByRole("button", { name: /thinking/i })).toBeDisabled();

    resolveChat?.({ assistant_message: "No blockers right now.", board_update: null });
    expect(await screen.findByText("No blockers right now.")).toBeInTheDocument();
  });

  it("applies AI board updates immediately in the UI", async () => {
    const nextBoard: BoardData = JSON.parse(JSON.stringify(initialData)) as BoardData;
    nextBoard.columns[0].title = "AI Backlog";
    const sendChat = vi.fn().mockResolvedValue({
      assistant_message: "Renamed first column.",
      board_update: nextBoard,
    });

    render(
      <KanbanBoard
        loadBoard={vi.fn().mockResolvedValue(initialData)}
        saveBoard={vi.fn()}
        sendChat={sendChat}
      />
    );

    await screen.findAllByTestId(/column-/i);
    await userEvent.type(screen.getByLabelText("Message"), "Rename first column");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    const firstColumn = screen.getAllByTestId(/column-/i)[0];
    expect(await within(firstColumn).findByDisplayValue("AI Backlog")).toBeInTheDocument();
  });
});
