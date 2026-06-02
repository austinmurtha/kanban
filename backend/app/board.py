from pydantic import BaseModel, Field, model_validator


class Card(BaseModel):
  id: str
  title: str
  details: str


class Column(BaseModel):
  id: str
  title: str
  cardIds: list[str] = Field(default_factory=list)


class BoardState(BaseModel):
  columns: list[Column]
  cards: dict[str, Card]

  @model_validator(mode="after")
  def validate_card_references(self) -> "BoardState":
    card_ids = set(self.cards.keys())
    for column in self.columns:
      for card_id in column.cardIds:
        if card_id not in card_ids:
          raise ValueError(f"Unknown card id in column cardIds: {card_id}")
    return self


INITIAL_BOARD_STATE = BoardState(
  columns=[
    Column(id="col-backlog", title="Backlog", cardIds=["card-1", "card-2"]),
    Column(id="col-discovery", title="Discovery", cardIds=["card-3"]),
    Column(id="col-progress", title="In Progress", cardIds=["card-4", "card-5"]),
    Column(id="col-review", title="Review", cardIds=["card-6"]),
    Column(id="col-done", title="Done", cardIds=["card-7", "card-8"]),
  ],
  cards={
    "card-1": Card(
      id="card-1",
      title="Align roadmap themes",
      details="Draft quarterly themes with impact statements and metrics.",
    ),
    "card-2": Card(
      id="card-2",
      title="Gather customer signals",
      details="Review support tags, sales notes, and churn feedback.",
    ),
    "card-3": Card(
      id="card-3",
      title="Prototype analytics view",
      details="Sketch initial dashboard layout and key drill-downs.",
    ),
    "card-4": Card(
      id="card-4",
      title="Refine status language",
      details="Standardize column labels and tone across the board.",
    ),
    "card-5": Card(
      id="card-5",
      title="Design card layout",
      details="Add hierarchy and spacing for scanning dense lists.",
    ),
    "card-6": Card(
      id="card-6",
      title="QA micro-interactions",
      details="Verify hover, focus, and loading states.",
    ),
    "card-7": Card(
      id="card-7",
      title="Ship marketing page",
      details="Final copy approved and asset pack delivered.",
    ),
    "card-8": Card(
      id="card-8",
      title="Close onboarding sprint",
      details="Document release notes and share internally.",
    ),
  },
)
