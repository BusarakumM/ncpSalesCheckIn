Microsoft Graph + SharePoint Excel Integration
=============================================

This app now writes data directly to a SharePoint-hosted Excel workbook and uploads photos to a SharePoint document library using Microsoft Graph.

Prerequisites
- Azure AD App Registration (server-to-server)
  - Application permissions: Files.ReadWrite.All, Sites.ReadWrite.All
  - Grant admin consent
- SharePoint Site and a target document library
  - An Excel workbook with tables for each feature
  - Optional: a folder for photo uploads

Environment Variables
Add these to `.env.local` (no quotes):

AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-app-client-id
AZURE_CLIENT_SECRET=your-app-client-secret

# SharePoint site + workbook
GRAPH_SITE_ID=your-site-id
GRAPH_WORKBOOK_PATH=Shared Documents/Attendance.xlsx

# Target tables inside the workbook
GRAPH_TBL_CHECKIN=CheckinTable
GRAPH_TBL_CHECKOUT=CheckoutTable
GRAPH_TBL_LEAVE=LeaveTable
GRAPH_TBL_USERS=Users
GRAPH_TBL_HOLIDAYS=Holidays
GRAPH_TBL_WEEKLY_OFF=WeeklyOff
GRAPH_TBL_DAYOFFS=DayOffs

# Optional: where images are uploaded
GRAPH_UPLOAD_FOLDER=Shared Documents/Photos

Notes
- GRAPH_SITE_ID should be the full siteId string (e.g., contoso.sharepoint.com,abc123-...)
- GRAPH_WORKBOOK_PATH is the path from the site drive root to your file
  (e.g., `Shared Documents/Attendance.xlsx`). Do not prefix with `/`.

Workbook Tables
Create tables in the workbook that match the column order used by each API route:

- Check-in (GRAPH_TBL_CHECKIN):
  [checkinISO, locationName, gps, checkinAddress, jobTitle, jobDetail, photoUrl, email, name, employeeNo, supervisorEmail, province, channel, district, checkinLat, checkinLon]

- Check-out (GRAPH_TBL_CHECKOUT):
  [checkoutISO, locationName, checkoutGps, checkoutAddress, checkoutPhotoUrl, email, name, employeeNo, supervisorEmail, province, channel, district, checkoutLat, checkoutLon]

- Leave (GRAPH_TBL_LEAVE):
  [dtISO, leaveType, reason, email, name, employeeNo, supervisorEmail, province, channel, district]

- Users (GRAPH_TBL_USERS):
  [email, role, name, employeeNo, supervisorEmail, province, channel, district]
  - role must be either SUPERVISOR or AGENT
  - email match is case-insensitive

- Holidays (GRAPH_TBL_HOLIDAYS):
  [dateISO, name, type, description]

- WeeklyOff (GRAPH_TBL_WEEKLY_OFF):
  [employeeNo, monOff, tueOff, wedOff, thuOff, friOff, satOff, sunOff, effectiveFrom]

- DayOffs (GRAPH_TBL_DAYOFFS):
  [employeeNo, email, dateISO, leaveType, remark, by, createdAt]

Where the `*ISO` columns are ISO8601 strings (UTC). Adjust column order in code or in your workbook as needed.

Endpoints Updated
- POST src/app/api/pa/upload-photo/route.ts → uploads image to SharePoint and returns `{ ok, url }`.
- POST src/app/api/pa/checkin/route.ts → appends a row to the check-in table.
- POST src/app/api/pa/checkout/route.ts → appends a row to the check-out table.
- POST src/app/api/pa/leave/route.ts → appends a row to the leave table.

Permissions Checklist
- App registration has Files.ReadWrite.All, Sites.ReadWrite.All (Application)
- Admin consent granted
- The target site and paths exist and are accessible by the app

Troubleshooting
- 401/403 on Graph: verify tenant/client credentials and admin consent
- 404 on upload: verify GRAPH_SITE_ID and folder path
- Add row failed: verify table name exists in the workbook and column order matches the values

Role Resolution
- On login, the app first looks up the user in GRAPH_TBL_USERS to determine role and metadata.
- If not found, it optionally falls back to the legacy PA backend (if configured), then to a keyword heuristic.

GPS Handling
- Check-in and Check-out pages collect GPS as a single string "lat, lon" and write it to the workbook.
- Backend reads and normalizes GPS:
  - Parses into `checkinLat/checkinLon` and `checkoutLat/checkoutLon`
  - Computes `distanceKm` between check-in/out using the Haversine formula
  - Exposes `checkinGps`/`checkoutGps` strings plus the parsed numbers and distance via API
- UI updates:
  - Activity, Report, Time Attendance show clickable map links and distance (km)
  - CSV exports include GPS fields and distance

Static Maps + Distance Alert (optional)
- NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY: API key for Google Static Maps (optional). When present, UI renders small map thumbnails next to GPS.
- NEXT_PUBLIC_MAX_DISTANCE_KM: If set (e.g., 5), distance cells are highlighted/used for alerts when exceeding the threshold.
