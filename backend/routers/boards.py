"""Board endpoints (create, read, update, list templates by type)."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
import database as db
from models import BoardIn, BoardUpdate
from realtime import manager
import auth
from typing import Optional
from fastapi import Header

router = APIRouter()

BOARD_TEMPLATES = {
    "kanban": ["Бэклог", "В работе", "Готово"],
    "scrum": ["Бэклог", "К выполнению", "В работе", "На проверке", "Готово"],
    "simple": ["Сделать", "Готово"],
    "blank": [],
}


def get_board_full(board_id: str):
    with db.get_conn() as conn:
        board = conn.execute("SELECT * FROM boards WHERE id=?", (board_id,)).fetchone()
        if not board:
            return {"error": "not found"}
        board = db.dict_from_row(board)
        lists = [db.dict_from_row(l) for l in conn.execute(
            "SELECT * FROM lists WHERE board_id=? ORDER BY position", (board_id,)).fetchall()]
        # all cards of the board in one query
        cards = [db.dict_from_row(c) for c in conn.execute(
            """SELECT c.* FROM cards c JOIN lists l ON l.id=c.list_id
               WHERE l.board_id=? ORDER BY c.position""", (board_id,)).fetchall()]
        # counts in two aggregate queries (no per-card round-trips)
        att = {r["card_id"]: r["n"] for r in conn.execute(
            """SELECT a.card_id, COUNT(*) AS n FROM attachments a
               JOIN cards c ON c.id=a.card_id JOIN lists l ON l.id=c.list_id
               WHERE l.board_id=? GROUP BY a.card_id""", (board_id,)).fetchall()}
        polls = {r["card_id"] for r in conn.execute(
            """SELECT DISTINCT po.card_id FROM poll_options po
               JOIN cards c ON c.id=po.card_id JOIN lists l ON l.id=c.list_id
               WHERE l.board_id=?""", (board_id,)).fetchall()}
        com = {r["card_id"]: r["n"] for r in conn.execute(
            """SELECT cm.card_id, COUNT(*) AS n FROM comments cm
               JOIN cards c ON c.id=cm.card_id JOIN lists l ON l.id=c.list_id
               WHERE l.board_id=? GROUP BY cm.card_id""", (board_id,)).fetchall()}
        by_list = {l["id"]: [] for l in lists}
        for c in cards:
            c["attachment_count"] = att.get(c["id"], 0)
            c["comment_count"] = com.get(c["id"], 0)
            c["is_poll"] = c["id"] in polls
            by_list.setdefault(c["list_id"], []).append(c)
        for l in lists:
            l["cards"] = by_list.get(l["id"], [])
        swimlanes = [db.dict_from_row(r) for r in conn.execute(
            "SELECT * FROM swimlanes WHERE board_id=? ORDER BY position", (board_id,)).fetchall()]
        board["lists"] = lists
        board["swimlanes"] = swimlanes
        return board


@router.get("/api/workspaces")
def get_workspaces():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM workspaces ORDER BY created_at").fetchall()
        return [db.dict_from_row(r) for r in rows]


@router.get("/api/members")
def get_members():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM members").fetchall()
        return [db.dict_from_row(r) for r in rows]


@router.get("/api/boards")
def get_boards(workspace_id: Optional[str] = None, user: dict = Depends(auth.require_user)):
    is_owner = user.get("global_role") == "owner"
    with db.get_conn() as conn:
        params = []
        sql = "SELECT b.* FROM boards b WHERE b.archived=0"
        if not is_owner:
            # non-owners see only boards they are a member of
            sql += " AND b.id IN (SELECT board_id FROM board_members WHERE user_id=?)"
            params.append(user["id"])
        if workspace_id:
            sql += " AND b.workspace_id=?"
            params.append(workspace_id)
        sql += " ORDER BY b.position"
        rows = conn.execute(sql, params).fetchall()
        return [db.dict_from_row(r) for r in rows]


@router.get("/api/boards/{board_id}")
def get_board(board_id: str, authorization: Optional[str] = Header(None)):
    user = auth.optional_user(authorization)
    role = auth.board_role(user, board_id) if user else None
    if role is None:
        raise HTTPException(status_code=403, detail="Нет доступа к этой доске")
    data = get_board_full(board_id)
    if isinstance(data, dict) and "error" not in data:
        data["my_role"] = role
        data["my_perms"] = auth.get_permissions(user, board_id)
    return data


@router.post("/api/boards")
async def create_board(data: BoardIn, user: dict = Depends(auth.require_user)):
    bid = db.new_id()
    lists = BOARD_TEMPLATES.get(data.board_type, BOARD_TEMPLATES["kanban"])
    with db.get_conn() as conn:
        pos = conn.execute(
            "SELECT COALESCE(MAX(position),-1)+1 AS p FROM boards WHERE workspace_id=?",
            (data.workspace_id,),
        ).fetchone()["p"]
        conn.execute(
            "INSERT INTO boards (id, workspace_id, name, position, board_type, color, created_at) VALUES (?,?,?,?,?,?,?)",
            (bid, data.workspace_id, data.name, pos, data.board_type, data.color, db.now()),
        )
        for i, ln in enumerate(lists):
            conn.execute("INSERT INTO lists (id, board_id, name, position) VALUES (?,?,?,?)",
                         (db.new_id(), bid, ln, i))
        conn.execute("INSERT OR IGNORE INTO board_members (board_id, user_id, role) VALUES (?,?,?)",
                     (bid, user["id"], "admin"))
    await manager.broadcast({"type": "board_created", "board_id": bid})
    return get_board_full(bid)


@router.patch("/api/boards/{board_id}")
async def update_board(board_id: str, data: BoardUpdate, user: dict = Depends(auth.require_user)):
    if not auth.is_board_admin(user, board_id):
        raise HTTPException(403, "Только админ доски может менять её")
    fields = data.dict(exclude_unset=True)
    if not fields:
        return {"error": "nothing to update"}
    sets = ", ".join(f"{k}=?" for k in fields)
    with db.get_conn() as conn:
        conn.execute(f"UPDATE boards SET {sets} WHERE id=?", list(fields.values()) + [board_id])
    await manager.broadcast({"type": "board_updated", "board_id": board_id})
    return get_board_full(board_id)


@router.delete("/api/boards/{board_id}")
async def delete_board(board_id: str, user: dict = Depends(auth.require_user)):
    if not auth.is_board_admin(user, board_id):
        raise HTTPException(403, "Только админ доски может её удалить")
    with db.get_conn() as conn:
        # remove cards -> lists -> memberships/requests -> board
        conn.execute("DELETE FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id=?)", (board_id,))
        conn.execute("DELETE FROM lists WHERE board_id=?", (board_id,))
        conn.execute("DELETE FROM board_members WHERE board_id=?", (board_id,))
        conn.execute("DELETE FROM board_join_requests WHERE board_id=?", (board_id,))
        conn.execute("DELETE FROM boards WHERE id=?", (board_id,))
    await manager.broadcast({"type": "board_deleted", "board_id": board_id})
    return {"ok": True}
