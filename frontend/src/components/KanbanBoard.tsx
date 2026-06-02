"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

type LoadBoard = (username: string) => Promise<BoardData>;
type SaveBoard = (username: string, board: BoardData) => Promise<void>;
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
type SendChat = (
  username: string,
  message: string,
  history: ChatMessage[]
) => Promise<{
  assistant_message: string;
  board_update: BoardData | null;
}>;

type KanbanBoardProps = {
  username?: string;
  loadBoard?: LoadBoard;
  saveBoard?: SaveBoard;
  sendChat?: SendChat;
};

const loadBoardFromApi: LoadBoard = async (username: string) => {
  const response = await fetch(`/api/board/${encodeURIComponent(username)}`);
  if (!response.ok) {
    throw new Error("Unable to load board.");
  }
  return (await response.json()) as BoardData;
};

const saveBoardToApi: SaveBoard = async (username: string, board: BoardData) => {
  const response = await fetch(`/api/board/${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error("Unable to save board.");
  }
};

const sendChatToApi: SendChat = async (
  username: string,
  message: string,
  history: ChatMessage[]
) => {
  const response = await fetch(`/api/ai/chat/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error("Unable to send chat message.");
  }
  return (await response.json()) as {
    assistant_message: string;
    board_update: BoardData | null;
  };
};

export const KanbanBoard = ({
  username = "user",
  loadBoard = loadBoardFromApi,
  saveBoard = saveBoardToApi,
  sendChat = sendChatToApi,
}: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const loadedBoard = await loadBoard(username);
        if (!isCancelled) {
          setBoard(loadedBoard);
          setSaveError("");
        }
      } catch {
        if (!isCancelled) {
          setBoard(initialData);
          setLoadError("Unable to load board from the backend.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [username, loadBoard, reloadToken]);

  const persistBoard = useCallback(
    async (nextBoard: BoardData) => {
      try {
        await saveBoard(username, nextBoard);
        setSaveError("");
      } catch {
        setSaveError("Unable to save your latest board updates.");
      }
    },
    [username, saveBoard]
  );

  const updateBoard = useCallback(
    (updater: (previous: BoardData) => BoardData) => {
      setBoard((previous) => {
        if (!previous) {
          return previous;
        }
        const next = updater(previous);
        void persistBoard(next);
        return next;
      });
    },
    [persistBoard]
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    updateBoard((previous) => ({
      ...previous,
      columns: moveCard(previous.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    updateBoard((previous) => ({
      ...previous,
      columns: previous.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    updateBoard((previous) => ({
      ...previous,
      cards: {
        ...previous.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: previous.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    updateBoard((previous) => {
      return {
        ...previous,
        cards: Object.fromEntries(
          Object.entries(previous.cards).filter(([id]) => id !== cardId)
        ),
        columns: previous.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message || isSendingChat) {
      return;
    }

    const historySnapshot = chatHistory;
    setChatHistory((previous) => [...previous, { role: "user", content: message }]);
    setChatInput("");
    setChatError("");
    setIsSendingChat(true);

    try {
      const response = await sendChat(username, message, historySnapshot);
      setChatHistory((previous) => [
        ...previous,
        { role: "assistant", content: response.assistant_message },
      ]);
      if (response.board_update) {
        setBoard(response.board_update);
        setSaveError("");
      }
    } catch {
      setChatError("Unable to reach the AI assistant right now.");
    } finally {
      setIsSendingChat(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Loading board...
        </p>
      </main>
    );
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const safeBoard = board ?? initialData;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
            </div>
          </div>
          {loadError ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3">
              <p className="text-sm font-medium text-[var(--secondary-purple)]">{loadError}</p>
              <button
                type="button"
                onClick={() => setReloadToken((value) => value + 1)}
                className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
              >
                Retry loading board
              </button>
            </div>
          ) : null}
          {saveError ? (
            <p className="text-sm font-medium text-[var(--secondary-purple)]">{saveError}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            {safeBoard.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5" aria-label="Kanban columns">
              {safeBoard.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => safeBoard.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <aside className="sticky top-6 rounded-[28px] border border-[var(--stroke)] bg-white/90 p-5 shadow-[var(--shadow)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              AI Assistant
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
              Board Chat
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
              Ask for summaries or card moves. Valid updates apply to the board immediately.
            </p>

            <div
              data-testid="chat-history"
              className="mt-5 flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1"
            >
              {chatHistory.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-4 text-sm text-[var(--gray-text)]">
                  No messages yet.
                </p>
              ) : (
                chatHistory.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    data-testid={`chat-message-${message.role}`}
                    className={`rounded-2xl px-3 py-2 text-sm leading-6 ${
                      message.role === "user"
                        ? "ml-6 bg-[var(--primary-blue)] text-white"
                        : "mr-6 border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
                    }`}
                  >
                    {message.content}
                  </article>
                ))
              )}
              {isSendingChat ? (
                <p className="mr-6 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--gray-text)]">
                  Thinking...
                </p>
              ) : null}
            </div>

            <label
              htmlFor="chat-message"
              className="mt-5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Message
            </label>
            <textarea
              id="chat-message"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              className="mt-2 min-h-[88px] w-full resize-y rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              placeholder="Move card-4 to Review and summarize blockers."
            />
            {chatError ? (
              <p className="mt-2 text-sm font-medium text-[var(--secondary-purple)]">{chatError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSendChat()}
              disabled={isSendingChat || !chatInput.trim()}
              className="mt-3 w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSendingChat ? "Thinking..." : "Send"}
            </button>
          </aside>
        </section>
      </main>
    </div>
  );
};
