"""Pydantic request models."""
from typing import Optional
from pydantic import BaseModel


class BoardIn(BaseModel):
    workspace_id: str
    name: str
    board_type: str = "kanban"
    color: str = "#00D4FF"


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    board_type: Optional[str] = None


class ListIn(BaseModel):
    board_id: str
    name: str


class ListUpdate(BaseModel):
    name: Optional[str] = None


class MoveList(BaseModel):
    list_id: str
    position: int


class CardIn(BaseModel):
    list_id: str
    title: str
    description: str = ""
    priority: str = "normal"
    status: str = "open"


class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    list_id: Optional[str] = None
    position: Optional[int] = None
    due_date: Optional[float] = None
    assignee: Optional[str] = None
    labels: Optional[list] = None


class MoveCard(BaseModel):
    card_id: str
    list_id: str
    position: int


class StatusIn(BaseModel):
    label: str
    color: str = "#7A97C8"


class StatusUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None


class CommentIn(BaseModel):
    author: Optional[str] = None
    text: str


# ── auth / users ──
class RegisterIn(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None


class LoginIn(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    display_name: str
    password: Optional[str] = None      # temp password admin hands out
    global_role: str = "user"
    color: str = "#35D0F0"


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    color: Optional[str] = None
    global_role: Optional[str] = None
    password: Optional[str] = None


class BoardMemberIn(BaseModel):
    user_id: str
    role: str = "member"
