# App Flow Guide

This document explains how the Check‑in / Check‑out application works end‑to‑end: pages, APIs, data model, and key behaviors.

## Overview

- Users sign in, create tasks, and submit Check‑in and Check‑out with GPS + photos.
- Data is written to an Excel workbook in SharePoint/OneDrive via Microsoft Graph.
- Supervisors review Activity, Time Attendance, and Report pages with GPS maps, photos, and distance/remark flags.

## Authentication

- Sign‑in uses e‑mail as username and employee number as the password.
  - API: `POST /api/auth/login`
  - Server resolves the user from the Users table (Graph). If an `employeeNo` exists, the password must match it.
  - On success, the server sets cookies for `session`, `role`, `email`, `name`, and user metadata.

## Data Model (Excel Tables)

- Check‑in table (`GRAPH_TBL_CHECKIN`):
  - Key columns used: `checkinISO`, `locationName`, `gps` (or `checkinLat/Lon`), `checkinAddress`, `photoUrl`, `email`, `name`, `district`, `checkinLat`, `checkinLon`.
- Check‑out table (`GRAPH_TBL_CHECKOUT`):
  - Key columns used: `checkoutISO`, `locationName`, `checkoutGps` (or `checkoutLat/Lon`), `checkoutAddress`, `checkoutPhotoUrl`, `email`, `name`, `district`, `checkoutLat`, `checkoutLon`.
- Leave table (`GRAPH_TBL_LEAVE`) used by Time Attendance.
- Users table (`GRAPH_TBL_USERS`) used for authentication and metadata (employeeNo, role, etc.).

## Core APIs

- Upload photo: `POST /api/pa/upload-photo`
  - Uploads a base64 image to SharePoint/OneDrive (via Graph) and returns a web URL.
  - Client resizes images to ~240p (longer side) JPEG before upload for efficiency.

- Check‑in: `POST /api/pa/checkin`
  - Enriches with user cookies (email, name, employeeNo, district, etc.).
  - Parses GPS, writes a row to the Check‑in table, and returns status `ongoing` or `completed` (if matching checkout exists).

- Check‑out: `POST /api/pa/checkout`
  - Enriches with user cookies, includes `locationName`, `checkoutGps/Address` and optional photo.
  - Writes a row to the Check‑out table, and returns status `completed` or `incomplete` (if no matching check‑in exists).

- Reverse geocode: `GET /api/maps/geocode?lat=..&lon=..`
  - Uses Google Geocoding to obtain human‑readable address.

- Activities: `POST /api/pa/activity`
  - Returns merged activity rows by date/name/district with computed status and distance (Haversine) when both lat/lon are available.

- Time Attendance: `POST /api/pa/time-attendance`
  - Merges activity rows with Leave rows for the requested period; includes GPS, address, distance, and image URLs.

- Report: `POST /api/pa/report`
  - Returns activity rows for the requested date range and district; client adds remarks for out‑of‑range distance.

## Pages & Flows

### 1) Check‑in / Check‑out List (`/checkin`)

- Shows the user’s tasks for the selected date.
- Each task link encodes a stable key: `btoa(email|date|location)` and navigates to `/checkin/[id]`.
- Status mapping:
  - `completed` → Completed
  - `ongoing` / `incomplete` → In Progress

### 2) New Task (`/checkin/new`)

- User sets Check‑in time, location, obtains GPS + address, and optionally attaches or takes a photo.
- Client‑side photo resize to ~240p → upload → receive URL.
- On Submit Check‑in:
  - Calls `/api/pa/checkin` → writes row → returns status.
  - UI shows “Saved (ongoing|completed)” and navigates back to `/checkin`.
  - Controls disable after submit; no re‑edit or re‑attach allowed.
- User can set Check‑out time later (GPS + photo optional) and Submit Checkout.
  - Submit allowed even if GPS is a different location; the discrepancy is reported (see Report).

### 3) Task Detail (`/checkin/[id]`)

- Loads existing task by stable key (email|date|location) from `/api/pa/activity`.
- Prefills fields and images; shows a status pill: Not started / Ongoing / Completed.
- Check‑in and Check‑out sections:
  - Buttons and inputs disable once submitted (or while submitting), blocking further edits or re‑attach.
  - After a successful submit, returns to `/checkin`.

### 4) Activity (`/activity`)

- Filterable table of activities (date/name/district), showing GPS links and mini static maps.
- Useful for supervisors to browse daily activity with distance info.

### 5) Time Attendance (`/time-attendance`)

- Filterable report combining activities + leaves for a date range.
- Columns include GPS, addresses, distance, and separate image thumbnails.
- Supports CSV export.

### 6) Report (`/report`)

- Filterable summary for a date range + district.
- Columns:
  - Date/Time, Check‑in, Check‑out, Location, Detail, District
  - In GPS (with address + map), Out GPS (with address + map)
  - Distance (km)
  - Image Check‑in, Image check‑out (separate columns)
  - Remark (see “Distance Remark Logic”)
  - Status
- CSV export includes separate image columns and the remark.

### 7) Leave (Sales Support) (`/leave`)

- Sales Support submits leave requests from the Leave page.
- Fields captured (stored in the Leave table):
  - `dtISO` (date/time of leave), `leaveType` (e.g., sick, vacation), `reason` (free text)
  - User metadata: `email`, `name`, `employeeNo`, `supervisorEmail`, `province`, `channel`, `district`
- API: `POST /api/pa/leave` → writes a row to `GRAPH_TBL_LEAVE` via Graph.
- These records are later merged into the Time Attendance report for the selected period.

### 8) Leave (Supervisor) (`/leave/manage`)

- Supervisors can review leave submissions with filters (date range, district, etc.).
- The page lists the same Leave table columns (date/type/reason/name/email/employeeNo/district).
- Current implementation is view‑only; no approve/reject state is persisted in the workbook.
  - If you want an approval step, add a `status` column to the Leave table and a small approve/reject API to update it. Time Attendance can then render the status.

### 9) Calendar & Weekly Off (optional)

- Day‑off submission endpoints exist to support calendar workflows:
  - `POST /api/pa/calendar/dayoff` → writes to a DayOffs table with `{ employeeNo/email, dateISO, leaveType, remark }`.
  - `GET /api/pa/calendar/holidays` and `GET /api/pa/calendar/weekly` provide company holidays and weekly‑off views.
- Weekly off configuration can be written with `setWeeklyOffConfig` and read with `getWeeklyOffConfig` (see `src/lib/graph.ts`).

## Distance Remark Logic

- `NEXT_PUBLIC_MAX_DISTANCE_KM` defines the threshold (e.g., `0.5`).
- When a Check‑out is more than this distance from the Check‑in point for the same task/date:
  - The Report UI adds a remark: “Checkout location differs from check‑in”.
  - The value also highlights in red with an exclamation mark.
- Submissions are not blocked; the remark is informational for supervisors.

## Environment Variables (key subset)

- Microsoft Graph/Azure AD:
  - `GRAPH_SITE_ID`, `GRAPH_WORKBOOK_PATH`
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
  - Table names: `GRAPH_TBL_CHECKIN`, `GRAPH_TBL_CHECKOUT`, `GRAPH_TBL_LEAVE`, `GRAPH_TBL_USERS`, etc.
- Uploads:
  - `GRAPH_UPLOAD_FOLDER` (optional, default `Shared Documents/Uploads`)
- Google Maps:
  - `GOOGLE_MAPS_GEOCODING_KEY` (or `NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY`) for reverse geocode
  - `NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY` for static map thumbnails
- UI/Validation:
  - `NEXT_PUBLIC_MAX_DISTANCE_KM` distance threshold for remark/highlight

## Implementation Notes

- Stable Task Key: all linking uses `btoa(email|date|location)` so reopening a task loads the exact pair.
- Photo Handling: images are resized on the client (~240p) before upload to reduce size and speed up uploads.
- Address Handling: after GPS capture, the client calls `/api/maps/geocode` to display a readable address and stores it with the submission.
- Status Computation: server returns a status after each submit by checking for a matching counterpart row on the same date/location/email; the list/report recompute from workbook data as well.
- Edit Locking: after submit, the UI disables inputs (and file pickers) to prevent re‑editing or duplicate check‑ins.

---

If you need a visual diagram or a PDF version, let me know and I’ll add one.
