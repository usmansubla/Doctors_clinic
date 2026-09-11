"""Backend API tests for ClinicFlow CRM."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://clinic-booking-dash.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@clinic.com", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == "admin@clinic.com"
    return data["token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@clinic.com", "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_auth_me(auth):
    r = requests.get(f"{API}/auth/me", headers=auth, timeout=30)
    assert r.status_code == 200
    assert r.json()["email"] == "admin@clinic.com"


def test_auth_me_missing_token():
    r = requests.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 401


# ---------- Bookings ----------
def test_list_bookings_seeded(auth):
    r = requests.get(f"{API}/bookings", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "bookings" in data and "count" in data
    assert data["count"] >= 14, f"Expected >=14 seeded, got {data['count']}"
    # verify status derivation
    for b in data["bookings"]:
        assert b["status"] in ("upcoming", "completed", "cancelled")
        assert "_id" not in b


def test_list_bookings_filter_upcoming(auth):
    r = requests.get(f"{API}/bookings?status_filter=upcoming", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    for b in data["bookings"]:
        assert b["status"] == "upcoming"


def test_list_bookings_search(auth):
    r = requests.get(f"{API}/bookings?search=John", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    for b in data["bookings"]:
        assert "john" in b["name"].lower() or "john" in b["phone"].lower()


def test_update_status_completed_then_cancelled(auth):
    # pick one
    r = requests.get(f"{API}/bookings", headers=auth, timeout=30)
    booking_id = r.json()["bookings"][0]["id"]

    r = requests.patch(f"{API}/bookings/{booking_id}/status", json={"status": "completed"}, headers=auth, timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "completed"

    r = requests.patch(f"{API}/bookings/{booking_id}/status", json={"status": "cancelled"}, headers=auth, timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    # verify via GET
    r = requests.get(f"{API}/bookings", headers=auth, timeout=30)
    match = [b for b in r.json()["bookings"] if b["id"] == booking_id][0]
    assert match["status"] == "cancelled"


def test_update_status_invalid(auth):
    r = requests.get(f"{API}/bookings", headers=auth, timeout=30)
    booking_id = r.json()["bookings"][0]["id"]
    r = requests.patch(f"{API}/bookings/{booking_id}/status", json={"status": "bogus"}, headers=auth, timeout=30)
    assert r.status_code == 400


def test_reschedule_updates_db_even_if_webhook_fails(auth):
    r = requests.get(f"{API}/bookings", headers=auth, timeout=30)
    b = r.json()["bookings"][-1]
    booking_id = b["id"]
    r = requests.post(
        f"{API}/bookings/{booking_id}/reschedule",
        json={"new_date": "2026-12-31", "new_time": "09:15"},
        headers=auth, timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["booking"]["date"] == "2026-12-31"
    assert body["booking"]["time"] == "09:15"

    # verify persisted
    r = requests.get(f"{API}/bookings", headers=auth, timeout=30)
    match = [x for x in r.json()["bookings"] if x["id"] == booking_id][0]
    assert match["date"] == "2026-12-31" and match["time"] == "09:15"


def test_reschedule_not_found(auth):
    r = requests.post(f"{API}/bookings/nonexistent-id/reschedule",
                     json={"new_date": "2026-12-31", "new_time": "09:00"},
                     headers=auth, timeout=30)
    assert r.status_code == 404


def test_sync_resilient(auth):
    r = requests.post(f"{API}/bookings/sync", headers=auth, timeout=60)
    assert r.status_code == 200
    body = r.json()
    assert "synced" in body and body["synced"] is True
    assert "added" in body and "updated" in body


# ---------- Dashboard / Analytics ----------
def test_dashboard_metrics(auth):
    r = requests.get(f"{API}/dashboard/metrics", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    for key in ("total_deals", "bookings_left_today", "completed", "cancelled"):
        assert key in data, f"missing {key}"
        assert isinstance(data[key], int)


def test_analytics_weekly(auth):
    r = requests.get(f"{API}/analytics/weekly", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "days" in data and len(data["days"]) == 7
    assert "completion_rate" in data and "cancellation_rate" in data
    for d in data["days"]:
        for k in ("date", "label", "total", "completed", "cancelled", "upcoming"):
            assert k in d


# ---------- Settings ----------
def test_get_and_update_webhooks(auth):
    r = requests.get(f"{API}/settings/webhooks", headers=auth, timeout=30)
    assert r.status_code == 200
    hooks = r.json()
    keys = ["check_availability", "book", "reschedule", "cancel", "find_appointments"]
    for k in keys:
        assert k in hooks

    original = {k: hooks[k] for k in keys}
    updated = {k: hooks[k] + "?t=test" for k in keys}
    r = requests.put(f"{API}/settings/webhooks", json=updated, headers=auth, timeout=30)
    assert r.status_code == 200
    body = r.json()
    for k in keys:
        assert body[k] == updated[k]

    # restore
    r = requests.put(f"{API}/settings/webhooks", json=original, headers=auth, timeout=30)
    assert r.status_code == 200
