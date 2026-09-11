"""Dental Clinic CRM Backend - FastAPI + MongoDB."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date as date_type

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "clinicflow-dev-secret-change-in-prod")
JWT_ALG = "HS256"
JWT_TTL_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="ClinicFlow CRM")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ---------- Default Webhooks ----------
DEFAULT_WEBHOOKS = {
    "check_availability": "https://depraved-compacted-giggling.ngrok-free.dev/webhook-test/2422b41c-c0e0-430e-b160-b282d0d85358",
    "book": "https://depraved-compacted-giggling.ngrok-free.dev/webhook-test/e446d283-7726-4b9c-b211-aa55f3fa333c",
    "reschedule": "https://depraved-compacted-giggling.ngrok-free.dev/webhook-test/1ddb7b13-df0c-4ceb-9737-7eb012b2b9af",
    "cancel": "https://depraved-compacted-giggling.ngrok-free.dev/webhook-test/a0b77d4c-196e-41cc-90f4-cc8755326079",
    "find_appointments": "https://depraved-compacted-giggling.ngrok-free.dev/webhook-test/65dd8640-4d74-4c82-86ed-f5fce62b1980",
    "reminder": "",
}

# ---------- Models ----------
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RegisterIn(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: User


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    event_id: Optional[str] = None
    manual_status: Optional[str] = None  # "completed" | "cancelled" | "no_show" | None
    notes: str = ""
    price: float = 0.0
    paid: bool = False
    service_type: str = "General"
    reminder_sent: bool = False
    status: str = "upcoming"  # derived
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BookingCreate(BaseModel):
    name: str
    phone: str
    date: str
    time: str
    event_id: Optional[str] = None
    price: float = 0.0
    notes: str = ""
    service_type: str = "General"


class BookingPatch(BaseModel):
    notes: Optional[str] = None
    price: Optional[float] = None
    paid: Optional[bool] = None
    service_type: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str  # "completed" | "cancelled" | "no_show" | "upcoming"


class RescheduleIn(BaseModel):
    new_date: str
    new_time: str


class WebhookSettings(BaseModel):
    check_availability: str = ""
    book: str = ""
    reschedule: str = ""
    cancel: str = ""
    find_appointments: str = ""
    reminder: str = ""


# ---------- Helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_TTL_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**doc)


def derive_status(b: dict) -> str:
    """Derive booking status. Past & un-marked bookings are flagged as no_show (grace: 1h)."""
    if b.get("manual_status") in ("cancelled", "completed", "no_show"):
        return b["manual_status"]
    try:
        dt = datetime.fromisoformat(f"{b['date']}T{b['time']}:00")
        if dt < datetime.now() - timedelta(hours=1):
            return "no_show"
    except Exception:
        pass
    return "upcoming"


def normalize_booking(doc: dict) -> dict:
    doc.pop("_id", None)
    doc["status"] = derive_status(doc)
    return doc


async def get_webhooks() -> dict:
    doc = await db.settings.find_one({"key": "webhooks"}, {"_id": 0})
    if not doc:
        return DEFAULT_WEBHOOKS.copy()
    return {k: doc.get(k) or DEFAULT_WEBHOOKS.get(k, "") for k in DEFAULT_WEBHOOKS}


async def call_webhook(url: str, payload: dict) -> Dict[str, Any]:
    if not url:
        return {"ok": False, "error": "webhook_not_configured"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.post(url, json=payload)
            try:
                data = r.json()
            except Exception:
                data = {"text": r.text}
            return {"ok": r.status_code < 400, "status": r.status_code, "data": data}
    except Exception as e:
        logging.exception("webhook_failed")
        return {"ok": False, "error": str(e)}


# ---------- Auth Endpoints ----------
@api.post("/auth/register", response_model=TokenOut)
async def register(inp: RegisterIn):
    existing = await db.users.find_one({"email": inp.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=inp.email.lower(), name=inp.name)
    doc = user.model_dump()
    doc["password"] = hash_pw(inp.password)
    await db.users.insert_one(doc)
    return TokenOut(token=make_token(user.id), user=user)


@api.post("/auth/login", response_model=TokenOut)
async def login(inp: LoginIn):
    doc = await db.users.find_one({"email": inp.email.lower()})
    if not doc or not verify_pw(inp.password, doc.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    doc.pop("_id", None)
    doc.pop("password", None)
    user = User(**doc)
    return TokenOut(token=make_token(user.id), user=user)


@api.get("/auth/me", response_model=User)
async def me(u: User = Depends(current_user)):
    return u


# ---------- Bookings ----------
@api.get("/bookings")
async def list_bookings(
    status_filter: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    u: User = Depends(current_user),
):
    q: dict = {}
    if start_date:
        q.setdefault("date", {})["$gte"] = start_date
    if end_date:
        q.setdefault("date", {})["$lte"] = end_date
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.bookings.find(q, {"_id": 0}).to_list(2000)
    for d in docs:
        d["status"] = derive_status(d)
    if status_filter and status_filter != "all":
        docs = [d for d in docs if d["status"] == status_filter]
    # sort by date+time desc
    docs.sort(key=lambda x: (x.get("date", ""), x.get("time", "")), reverse=True)
    return {"bookings": docs, "count": len(docs)}


@api.post("/bookings")
async def create_booking(inp: BookingCreate, u: User = Depends(current_user)):
    # Validate not in the past
    try:
        dt = datetime.fromisoformat(f"{inp.date}T{inp.time}:00")
        if dt < datetime.now() - timedelta(minutes=5):
            raise HTTPException(status_code=400, detail="Cannot create a booking in the past")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date or time format")
    b = Booking(**inp.model_dump())
    doc = b.model_dump()
    await db.bookings.insert_one(doc.copy())
    hooks = await get_webhooks()
    _ = await call_webhook(hooks["book"], {
        "name": b.name, "phone": b.phone, "date": b.date, "time": b.time,
        "service_type": b.service_type, "price": b.price, "notes": b.notes,
    })
    return normalize_booking(doc)


@api.patch("/bookings/{booking_id}/status")
async def update_status(booking_id: str, inp: StatusUpdate, u: User = Depends(current_user)):
    if inp.status not in ("completed", "cancelled", "upcoming", "no_show"):
        raise HTTPException(status_code=400, detail="Invalid status")
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    manual = None if inp.status == "upcoming" else inp.status
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"manual_status": manual, "updated_at": datetime.now(timezone.utc)}},
    )
    hooks = await get_webhooks()
    if inp.status == "cancelled":
        await call_webhook(hooks["cancel"], {
            "name": b["name"], "phone": b["phone"], "date": b["date"],
            "time": b["time"], "event_id": b.get("event_id"),
        })
    b["manual_status"] = manual
    return normalize_booking(b)


@api.patch("/bookings/{booking_id}")
async def patch_booking(booking_id: str, inp: BookingPatch, u: User = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    update: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if inp.notes is not None:
        update["notes"] = inp.notes
    if inp.price is not None:
        update["price"] = float(inp.price)
    if inp.paid is not None:
        update["paid"] = bool(inp.paid)
    if inp.service_type is not None:
        update["service_type"] = inp.service_type
    await db.bookings.update_one({"id": booking_id}, {"$set": update})
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return normalize_booking(updated)


@api.post("/bookings/{booking_id}/reschedule")
async def reschedule(booking_id: str, inp: RescheduleIn, u: User = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    hooks = await get_webhooks()
    result = await call_webhook(hooks["reschedule"], {
        "name": b["name"], "phone": b["phone"],
        "old_date": b["date"], "old_time": b["time"],
        "new_date": inp.new_date, "new_time": inp.new_time,
        "event_id": b.get("event_id"),
    })
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "date": inp.new_date, "time": inp.new_time,
            "manual_status": None,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return {"booking": normalize_booking(updated), "webhook": result}


@api.post("/bookings/sync")
async def sync_bookings(u: User = Depends(current_user)):
    """Fetch bookings from n8n find_appointments webhook and upsert."""
    hooks = await get_webhooks()
    result = await call_webhook(hooks["find_appointments"], {"action": "list_all"})
    added = 0
    updated = 0
    if result.get("ok"):
        data = result.get("data")
        rows: list = []
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            for key in ("data", "rows", "appointments", "bookings"):
                if isinstance(data.get(key), list):
                    rows = data[key]
                    break
        for r in rows:
            if not isinstance(r, dict):
                continue
            name = r.get("name") or r.get("Name")
            phone = str(r.get("phone number") or r.get("phone") or r.get("Phone") or "")
            bdate = r.get("date") or r.get("Date")
            btime = r.get("time") or r.get("Time")
            event_id = r.get("event_id") or r.get("eventId")
            if not (name and bdate and btime):
                continue
            match = {"name": name, "phone": phone, "date": str(bdate), "time": str(btime)}
            existing = await db.bookings.find_one(match)
            if existing:
                if event_id and existing.get("event_id") != event_id:
                    await db.bookings.update_one({"id": existing["id"]}, {"$set": {"event_id": event_id}})
                    updated += 1
            else:
                b = Booking(name=name, phone=phone, date=str(bdate), time=str(btime), event_id=event_id)
                await db.bookings.insert_one(b.model_dump())
                added += 1
    return {"synced": True, "added": added, "updated": updated, "webhook": result}


# ---------- Dashboard & Analytics ----------
def _week_range() -> tuple:
    today = datetime.now().date()
    start = today - timedelta(days=6)
    return start.isoformat(), today.isoformat()


@api.get("/dashboard/metrics")
async def dashboard_metrics(u: User = Depends(current_user)):
    week_start, week_end = _week_range()
    today_str = datetime.now().date().isoformat()

    week_docs = await db.bookings.find(
        {"date": {"$gte": week_start, "$lte": week_end}}, {"_id": 0}
    ).to_list(5000)
    for d in week_docs:
        d["status"] = derive_status(d)

    total_deals = len(week_docs)
    completed = sum(1 for d in week_docs if d["status"] == "completed")
    cancelled = sum(1 for d in week_docs if d["status"] == "cancelled")
    no_shows = sum(1 for d in week_docs if d["status"] == "no_show")

    today_docs = [d for d in week_docs if d["date"] == today_str]
    bookings_left_today = sum(1 for d in today_docs if d["status"] == "upcoming")

    # Revenue metrics
    revenue_total = sum(float(d.get("price") or 0) for d in week_docs if d["status"] == "completed")
    revenue_paid = sum(float(d.get("price") or 0) for d in week_docs if d["status"] == "completed" and d.get("paid"))
    revenue_unpaid = revenue_total - revenue_paid
    revenue_pipeline = sum(float(d.get("price") or 0) for d in week_docs if d["status"] == "upcoming")

    return {
        "total_deals": total_deals,
        "bookings_left_today": bookings_left_today,
        "completed": completed,
        "cancelled": cancelled,
        "no_shows": no_shows,
        "revenue_total": round(revenue_total, 2),
        "revenue_paid": round(revenue_paid, 2),
        "revenue_unpaid": round(revenue_unpaid, 2),
        "revenue_pipeline": round(revenue_pipeline, 2),
        "week_start": week_start,
        "week_end": week_end,
    }


@api.get("/analytics/weekly")
async def analytics_weekly(u: User = Depends(current_user)):
    week_start, week_end = _week_range()
    docs = await db.bookings.find(
        {"date": {"$gte": week_start, "$lte": week_end}}, {"_id": 0}
    ).to_list(5000)
    for d in docs:
        d["status"] = derive_status(d)

    days: List[Dict[str, Any]] = []
    start_date = datetime.fromisoformat(week_start).date()
    for i in range(7):
        d = start_date + timedelta(days=i)
        ds = d.isoformat()
        day_docs = [b for b in docs if b["date"] == ds]
        day_revenue = sum(float(b.get("price") or 0) for b in day_docs if b["status"] == "completed")
        days.append({
            "date": ds,
            "label": d.strftime("%a"),
            "total": len(day_docs),
            "completed": sum(1 for b in day_docs if b["status"] == "completed"),
            "cancelled": sum(1 for b in day_docs if b["status"] == "cancelled"),
            "no_show": sum(1 for b in day_docs if b["status"] == "no_show"),
            "upcoming": sum(1 for b in day_docs if b["status"] == "upcoming"),
            "revenue": round(day_revenue, 2),
        })

    total = len(docs)
    completed_ct = sum(1 for d in docs if d["status"] == "completed")
    cancelled_ct = sum(1 for d in docs if d["status"] == "cancelled")
    no_show_ct = sum(1 for d in docs if d["status"] == "no_show")
    completion_rate = round((completed_ct / total) * 100, 1) if total else 0.0
    cancellation_rate = round((cancelled_ct / total) * 100, 1) if total else 0.0
    no_show_rate = round((no_show_ct / total) * 100, 1) if total else 0.0

    return {
        "days": days,
        "total_week": total,
        "completion_rate": completion_rate,
        "cancellation_rate": cancellation_rate,
        "no_show_rate": no_show_rate,
    }


@api.get("/bookings/no-shows")
async def no_shows(u: User = Depends(current_user)):
    """Past bookings that were never marked completed — need follow-up."""
    docs = await db.bookings.find({}, {"_id": 0}).to_list(5000)
    result = []
    for d in docs:
        d["status"] = derive_status(d)
        if d["status"] == "no_show":
            result.append(d)
    result.sort(key=lambda x: (x.get("date", ""), x.get("time", "")), reverse=True)
    return {"bookings": result[:50], "count": len(result)}


# ---------- Clients ----------
def _client_key(name: str, phone: str) -> str:
    """Stable key for grouping bookings into a client."""
    ph = "".join(ch for ch in (phone or "") if ch.isdigit())
    if ph:
        return f"ph:{ph}"
    return f"nm:{(name or '').strip().lower()}"


@api.get("/clients")
async def list_clients(u: User = Depends(current_user)):
    docs = await db.bookings.find({}, {"_id": 0}).to_list(5000)
    groups: Dict[str, Dict[str, Any]] = {}
    for d in docs:
        d["status"] = derive_status(d)
        key = _client_key(d.get("name", ""), d.get("phone", ""))
        g = groups.setdefault(key, {
            "key": key,
            "name": d.get("name", ""),
            "phone": d.get("phone", ""),
            "total_bookings": 0,
            "completed": 0,
            "no_shows": 0,
            "cancelled": 0,
            "upcoming": 0,
            "total_spent": 0.0,
            "last_visit": None,
            "next_visit": None,
        })
        g["total_bookings"] += 1
        st = d["status"]
        if st == "completed":
            g["completed"] += 1
            g["total_spent"] += float(d.get("price") or 0)
        elif st == "no_show":
            g["no_shows"] += 1
        elif st == "cancelled":
            g["cancelled"] += 1
        elif st == "upcoming":
            g["upcoming"] += 1
        # last / next visit
        today = datetime.now().date().isoformat()
        if d["date"] <= today:
            if not g["last_visit"] or d["date"] > g["last_visit"]:
                g["last_visit"] = d["date"]
        else:
            if not g["next_visit"] or d["date"] < g["next_visit"]:
                g["next_visit"] = d["date"]

    clients = list(groups.values())
    for c in clients:
        c["total_spent"] = round(c["total_spent"], 2)
    clients.sort(key=lambda c: (-c["total_bookings"], c["name"].lower()))
    return {"clients": clients, "count": len(clients)}


@api.get("/clients/{client_key}")
async def get_client(client_key: str, u: User = Depends(current_user)):
    docs = await db.bookings.find({}, {"_id": 0}).to_list(5000)
    matched = []
    for d in docs:
        d["status"] = derive_status(d)
        if _client_key(d.get("name", ""), d.get("phone", "")) == client_key:
            matched.append(d)
    if not matched:
        raise HTTPException(status_code=404, detail="Client not found")

    matched.sort(key=lambda x: (x.get("date", ""), x.get("time", "")), reverse=True)
    today = datetime.now().date().isoformat()
    total_spent = sum(float(b.get("price") or 0) for b in matched if b["status"] == "completed")
    unpaid = sum(float(b.get("price") or 0) for b in matched if b["status"] == "completed" and not b.get("paid"))

    # notes timeline
    notes = [
        {"date": b["date"], "time": b["time"], "note": b["notes"], "service_type": b.get("service_type", "General")}
        for b in matched if (b.get("notes") or "").strip()
    ]
    services: Dict[str, int] = {}
    for b in matched:
        s = b.get("service_type") or "General"
        services[s] = services.get(s, 0) + 1

    return {
        "key": client_key,
        "name": matched[0]["name"],
        "phone": matched[0]["phone"],
        "total_bookings": len(matched),
        "total_spent": round(total_spent, 2),
        "unpaid_amount": round(unpaid, 2),
        "completed": sum(1 for b in matched if b["status"] == "completed"),
        "no_shows": sum(1 for b in matched if b["status"] == "no_show"),
        "cancelled": sum(1 for b in matched if b["status"] == "cancelled"),
        "upcoming": sum(1 for b in matched if b["status"] == "upcoming"),
        "last_visit": next((b["date"] for b in matched if b["date"] <= today), None),
        "next_visit": next((b["date"] for b in reversed(matched) if b["date"] > today), None),
        "bookings": matched,
        "notes_timeline": notes,
        "services": services,
    }


# ---------- Revenue by Service ----------
@api.get("/analytics/services")
async def analytics_services(u: User = Depends(current_user)):
    week_start, week_end = _week_range()
    docs = await db.bookings.find({"date": {"$gte": week_start, "$lte": week_end}}, {"_id": 0}).to_list(5000)
    breakdown: Dict[str, Dict[str, Any]] = {}
    for d in docs:
        d["status"] = derive_status(d)
        s = d.get("service_type") or "General"
        b = breakdown.setdefault(s, {"service_type": s, "count": 0, "revenue": 0.0})
        b["count"] += 1
        if d["status"] == "completed":
            b["revenue"] += float(d.get("price") or 0)
    items = list(breakdown.values())
    for it in items:
        it["revenue"] = round(it["revenue"], 2)
    items.sort(key=lambda x: -x["revenue"])
    return {"services": items}


# ---------- Reminders ----------
@api.post("/bookings/{booking_id}/send-reminder")
async def send_reminder_manual(booking_id: str, u: User = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    hooks = await get_webhooks()
    result = await call_webhook(hooks.get("reminder", ""), {
        "name": b["name"], "phone": b["phone"],
        "date": b["date"], "time": b["time"],
        "service_type": b.get("service_type", "General"),
        "event_id": b.get("event_id"),
        "trigger": "manual",
    })
    if result.get("ok"):
        await db.bookings.update_one({"id": booking_id}, {"$set": {"reminder_sent": True, "updated_at": datetime.now(timezone.utc)}})
    return {"webhook": result}


# ---------- Settings ----------
@api.get("/settings/webhooks", response_model=WebhookSettings)
async def get_webhook_settings(u: User = Depends(current_user)):
    hooks = await get_webhooks()
    return WebhookSettings(**hooks)


@api.put("/settings/webhooks", response_model=WebhookSettings)
async def update_webhook_settings(inp: WebhookSettings, u: User = Depends(current_user)):
    data = inp.model_dump()
    data["key"] = "webhooks"
    await db.settings.update_one({"key": "webhooks"}, {"$set": data}, upsert=True)
    hooks = await get_webhooks()
    return WebhookSettings(**hooks)


# ---------- Health ----------
@api.get("/")
async def root():
    return {"ok": True, "service": "clinicflow-crm"}


# ---------- Seed ----------
SEED_BOOKINGS = [
    ("mohammad usman subla", "917889774101", "2026-07-20", "10:30", "5e1jgde8av8rg022t48njcghag"),
    ("mohammad usman", "917889774101", "2026-07-23", "12:00", None),
    ("mohammad usman", "917889774101", "2026-07-23", "12:30", None),
    ("areeba", "7889774101", "2026-07-22", "13:00", "ocsnfpudbtvm483ldq0glhe2bc"),
    ("John. Morrison", "9419420501", "2026-07-25", "15:00", "47c7k51bhp3rfg6ilm1eb31610"),
    ("Usman", "7889774101", "2026-07-21", "17:00", "h2dclb7jkisniq3cd0a2h4kj1g"),
    ("Shakir", "788-977-4102", "2026-07-22", "13:00", "ivu0bhgehri9vq32rqkb7r9oes"),
    ("Sam", "9419420501", "2026-07-23", "13:00", "vkuelee8ebjh8ipi7dpp3jmgo5"),
    ("F. Abraham", "94194", "2026-07-23", "12:00", "vkuelee8ebjh8ipi7dpp3jmgo4"),
    ("Osman", "7889774101", "2026-07-23", "14:00", "ocsnfpudbtvm483ldq0glhe2bc"),
    ("Faizan", "9419419901", "2026-07-23", "12:00", "om7l65hv6mrgd60m7qfaqgbh88"),
    ("Rahul", "988788205", "2026-07-25", "13:00", "1umlqjqbf1tdtk4jc1n0dg5r90"),
    ("John", "123456", "2026-07-24", "13:00", "at9ff14npcirq7o4on34hvirvs"),
    ("John", "12345", "2026-07-24", "15:00", "0ui01aiorgeca1m20peegpqc90"),
]


async def seed_data():
    # Seed admin
    if not await db.users.find_one({"email": "admin@clinic.com"}):
        user = User(email="admin@clinic.com", name="Clinic Admin")
        doc = user.model_dump()
        doc["password"] = hash_pw("admin123")
        await db.users.insert_one(doc)
        logging.info("Seeded admin user")

    # Seed sample bookings (only if empty) - dates shifted so some are 'today' relative
    count = await db.bookings.count_documents({})
    if count == 0:
        today = datetime.now().date()
        seed_rows = []
        # offsets: mix past/today/future days so metrics are meaningful
        offsets = [-2, -1, 0, 0, 0, 1, 2, 3, -3, -5, 4, 5, -6, 6]
        # manual statuses: past = completed / no_show / cancelled mix; future = None (upcoming)
        manual = [
            "completed", "completed", None, None, "cancelled",
            None, None, None, "completed", "no_show",
            None, None, "cancelled", None,
        ]
        prices = [120, 240, 90, 180, 300, 150, 220, 200, 450, 175, 130, 260, 300, 210]
        paid_flags = [True, True, False, False, False, False, False, False, True, False, False, False, False, False]
        services = ["Cleaning", "Filling", "Consultation", "Root Canal", "Extraction", "Whitening", "Cleaning", "Filling", "Crown", "Consultation", "Cleaning", "Filling", "Extraction", "Whitening"]
        for i, (name, phone, _d, t, evt) in enumerate(SEED_BOOKINGS):
            off = offsets[i % len(offsets)]
            m = manual[i % len(manual)]
            new_date = (today + timedelta(days=off)).isoformat()
            b = Booking(
                name=name, phone=phone, date=new_date, time=t, event_id=evt,
                manual_status=m,
                price=float(prices[i % len(prices)]),
                paid=bool(paid_flags[i % len(paid_flags)]),
                notes="",
                service_type=services[i % len(services)],
            )
            seed_rows.append(b.model_dump())
        if seed_rows:
            await db.bookings.insert_many(seed_rows)
            logging.info(f"Seeded {len(seed_rows)} sample bookings")

    # Ensure all existing bookings have the new fields (migration for old data)
    await db.bookings.update_many({"notes": {"$exists": False}}, {"$set": {"notes": ""}})
    await db.bookings.update_many({"price": {"$exists": False}}, {"$set": {"price": 0.0}})
    await db.bookings.update_many({"paid": {"$exists": False}}, {"$set": {"paid": False}})
    await db.bookings.update_many({"service_type": {"$exists": False}}, {"$set": {"service_type": "General"}})
    await db.bookings.update_many({"reminder_sent": {"$exists": False}}, {"$set": {"reminder_sent": False}})

    # Seed webhook settings
    if not await db.settings.find_one({"key": "webhooks"}):
        payload = {"key": "webhooks", **DEFAULT_WEBHOOKS}
        await db.settings.insert_one(payload)
        logging.info("Seeded webhook settings")


# ---------- Background auto-sync ----------
async def _auto_sync_loop():
    """Background task: pulls fresh bookings from n8n every 2 minutes."""
    import asyncio
    await asyncio.sleep(15)  # small delay after startup
    while True:
        try:
            hooks = await get_webhooks()
            result = await call_webhook(hooks.get("find_appointments", ""), {"action": "list_all", "source": "auto_sync"})
            added = 0
            updated = 0
            if result.get("ok"):
                data = result.get("data")
                rows = []
                if isinstance(data, list):
                    rows = data
                elif isinstance(data, dict):
                    for key in ("data", "rows", "appointments", "bookings"):
                        if isinstance(data.get(key), list):
                            rows = data[key]
                            break
                for r in rows:
                    if not isinstance(r, dict):
                        continue
                    name = r.get("name") or r.get("Name")
                    phone = str(r.get("phone number") or r.get("phone") or r.get("Phone") or "")
                    bdate = r.get("date") or r.get("Date")
                    btime = r.get("time") or r.get("Time")
                    event_id = r.get("event_id") or r.get("eventId")
                    if not (name and bdate and btime):
                        continue
                    match = {"name": name, "phone": phone, "date": str(bdate), "time": str(btime)}
                    existing = await db.bookings.find_one(match)
                    if existing:
                        if event_id and existing.get("event_id") != event_id:
                            await db.bookings.update_one({"id": existing["id"]}, {"$set": {"event_id": event_id}})
                            updated += 1
                    else:
                        b = Booking(name=name, phone=phone, date=str(bdate), time=str(btime), event_id=event_id)
                        await db.bookings.insert_one(b.model_dump())
                        added += 1
                if added or updated:
                    logging.info(f"[auto-sync] +{added} new, {updated} updated")

            # ---- Reminder check ----
            reminder_url = hooks.get("reminder", "")
            if reminder_url:
                now = datetime.now()
                # Window: 23-25 hours from now
                lower = now + timedelta(hours=23)
                upper = now + timedelta(hours=25)
                # Find upcoming bookings within that window that haven't been reminded
                candidates = await db.bookings.find({
                    "manual_status": None,
                    "reminder_sent": {"$ne": True},
                    "date": {"$gte": lower.date().isoformat(), "$lte": upper.date().isoformat()},
                }, {"_id": 0}).to_list(200)
                sent = 0
                for b in candidates:
                    try:
                        dt = datetime.fromisoformat(f"{b['date']}T{b['time']}:00")
                        if lower <= dt <= upper:
                            r = await call_webhook(reminder_url, {
                                "name": b["name"], "phone": b["phone"],
                                "date": b["date"], "time": b["time"],
                                "service_type": b.get("service_type", "General"),
                                "event_id": b.get("event_id"),
                                "trigger": "auto",
                            })
                            if r.get("ok"):
                                await db.bookings.update_one({"id": b["id"]}, {"$set": {"reminder_sent": True}})
                                sent += 1
                    except Exception:
                        pass
                if sent:
                    logging.info(f"[reminders] sent {sent} 24h reminders")
        except Exception as e:
            logging.warning(f"[auto-sync] failed: {e}")
        await asyncio.sleep(120)  # every 2 minutes


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    import asyncio
    await seed_data()
    # kick off background auto-sync
    asyncio.create_task(_auto_sync_loop())
    logging.info("Auto-sync task started (every 2 min)")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
