# ClinicFlow CRM - PRD

## Overview
Web-first CRM for a dental clinic that manages bookings created via an AI voice agent (Vapi + n8n). Bookings live in Google Sheets and are synced into the CRM via n8n webhooks. Staff can view KPIs, browse bookings, mark completed/cancelled/no-show, reschedule (WhatsApp via n8n), track client notes and revenue, tag services, view lifetime client profiles, and auto-send 24h reminders.

## Target Platform
- Desktop web browser (primary) — served via Expo web
- Responsive: works on tablets and mobile too

## Auth
- Email/password JWT auth (bcrypt hashed)
- Seeded admin: admin@clinic.com / admin123

## Screens

### Dashboard
- Revenue banner (this week + paid/unpaid + collection % + pipeline)
- No-Show Alerts card
- 5 KPI cards with sparklines (Total Deals, Left Today, Completed, No-Shows, Cancelled)
- Revenue Trend line chart, Status Split donut
- Recent Bookings table + Today's Schedule

### Bookings
- Filter chips (All / Upcoming / Completed / No-Show / Cancelled)
- Sortable table (Client + service pill, Phone, Date & Time, Status)
- Row click → modal:
  - Date/time header + status badge
  - Revenue (price + Paid/Unpaid toggle)
  - **Service Type** (10-chip picker: General, Consultation, Cleaning, Filling, Root Canal, Extraction, Whitening, Crown, Braces, Other)
  - Client Notes textarea
  - Action chips: Save details / View client profile / Send WhatsApp reminder
  - Status buttons: Complete / No-Show / Cancel / Reschedule

### Clients
- 4 summary cards (Total, Repeat, Lifetime Revenue, Upcoming)
- Search + sort chips (Bookings / Spend / Name)
- Table: Client, Contact, Bookings (with completed/no-show icons), Total Spent, Last/Next visit
- Repeat badge on returning clients

### Client Profile (`/client/[key]`)
- Big header (avatar, name, phone, repeat badge, total spent, unpaid)
- 5-stat grid (Total Visits, Completed, No-Shows, Cancelled, Upcoming)
- Visit History table with service pills, price + paid status, and outcome badges
- Services Used breakdown card
- Notes Timeline card

### Analytics
- 4 summary cards (Total, Revenue, Completion, No-Show Rate)
- Revenue Trend line chart
- Status Distribution donut (4 segments)
- Completed vs Cancelled bar chart
- Performance Rates bars
- **Revenue by Service** horizontal bar chart

### Settings
- Account card + logout
- 6 n8n webhook URL fields (Check Availability, Book, Reschedule, Cancel, Find Appointments, 24h Reminder)

## Auto-Sync & Reminders (Backend Background Loop, every 2 min)
- Calls `find_appointments` webhook and upserts rows matched by name+phone+date+time
- Scans upcoming bookings within a 23–25h window; if `reminder_sent` is false and reminder URL is configured, calls the `reminder` webhook and marks `reminder_sent=true`

## Status Derivation
- If manual_status set → use it (completed / cancelled / no_show)
- Else if booking datetime is past by > 1h → **no_show** (needs follow-up)
- Else → upcoming

## Backend Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET /api/bookings, POST /api/bookings
- PATCH /api/bookings/{id}/status (completed / cancelled / no_show / upcoming)
- PATCH /api/bookings/{id} (partial: notes, price, paid, service_type)
- POST /api/bookings/{id}/reschedule
- POST /api/bookings/{id}/send-reminder
- POST /api/bookings/sync
- GET /api/bookings/no-shows
- GET /api/clients, GET /api/clients/{key}
- GET /api/dashboard/metrics (incl. revenue_total, revenue_paid, revenue_unpaid, no_shows)
- GET /api/analytics/weekly, GET /api/analytics/services
- GET/PUT /api/settings/webhooks

## Data Model
- **users**: id, email, name, password (bcrypt), created_at
- **bookings**: id, name, phone, date, time, event_id, manual_status, notes, price, paid, service_type, reminder_sent, created_at, updated_at
- **settings**: key='webhooks', 6 URL fields
- Client key = "ph:" + digits(phone) if phone else "nm:" + lowercase(name)

## Design
- Sage Green #3C5A44 primary, warm off-white canvas #F4F5F1
- Custom react-native-svg charts (LineChart, BarChart, DonutChart, Sparkline)
