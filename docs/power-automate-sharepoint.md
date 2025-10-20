Power Automate + SharePoint Backend

This app is already wired to call Power Automate flows via the API routes under `src/app/api/pa/*`. Follow these steps to back the app with SharePoint using Power Automate.

Overview
- SharePoint stores the data and photos.
- Power Automate exposes HTTP endpoints to receive app payloads, writes to SharePoint, and returns JSON responses.
- Next.js API routes proxy requests to the Flow URLs and can add a shared secret header for basic protection.

Environment Variables
- `PA_UPLOAD_PHOTO_URL` (+ optional `PA_UPLOAD_PHOTO_KEY`)
- `PA_CHECKIN_URL` (+ optional `PA_CHECKIN_KEY`)
- `PA_CHECKOUT_URL` (+ optional `PA_CHECKOUT_KEY`)
- `PA_LEAVE_URL` (+ optional `PA_LEAVE_KEY`)
- `PA_RESOLVE_USER_URL` (+ optional `PA_RESOLVE_USER_KEY`)
// Supervisor dashboards
- `PA_ACTIVITY_URL` (+ optional `PA_ACTIVITY_KEY`)
- `PA_REPORT_URL` (+ optional `PA_REPORT_KEY`)
- `PA_REPORT_SUMMARY_URL` (+ optional `PA_REPORT_SUMMARY_KEY`)
- `PA_TIME_ATTENDANCE_URL` (+ optional `PA_TIME_ATTENDANCE_KEY`)

Set these in `.env.local`. Keys are optional; if set, the API will send header `x-pa-key: <value>`, and your flows should validate this header.

SharePoint Setup
1) Document Library for photos (example: `AttendancePhotos`)
   - Site: choose your site (e.g., `https://<tenant>.sharepoint.com/sites/FieldOps`)
   - Library: create a folder (optional) like `checkin`.

2) List for attendance (example: `Attendance`)
   - Columns (in addition to Title):
     - `Type` (Choice): Checkin, Checkout
     - `EmployeeEmail` (Single line of text)
     - `EmployeeName` (Single line of text)
     - `EmployeeNo` (Single line of text)
     - `SupervisorEmail` (Single line of text)
     - `Province` (Single line of text)
     - `Channel` (Single line of text)
     - `When` (Date and Time)
     - `LocationName` (Single line of text)
     - `GPS` (Single line of text)
    - `PhotoUrl` (Hyperlink or Picture)
    - `TaskId` (Number or text, optional)
    - `JobTitle` (Single line of text)
    - `JobDetail` (Multiple lines of text)

3) List for leave requests (example: `LeaveRequests`)
   - Columns:
     - `EmployeeEmail`, `EmployeeName`, `EmployeeNo`, `SupervisorEmail`, `Province`, `Channel`
     - `When` (Date and Time)
     - `LeaveType` (Single line of text or Choice)
     - `Reason` (Multiple lines of text)
     - `Status` (Choice: Submitted, Approved, Rejected)

Flows (Power Automate)
Use trigger "When an HTTP request is received" for each flow.

Upload Photo Flow
- Trigger JSON schema:
```
{
  "type": "object",
  "properties": {
    "fileName": { "type": "string" },
    "contentBase64": { "type": "string" }
  },
  "required": ["fileName", "contentBase64"]
}
```
- (Optional security) Condition: `equals(triggerOutputs()['headers']['x-pa-key'], '<YOUR_SECRET>')` → if false, return 401.
- Initialize variable `Binary` (or use Compose) with expression: `base64ToBinary(triggerBody()?['contentBase64'])`.
- Action: SharePoint → Create file
  - Site Address: your site
  - Folder Path: `/Shared Documents/AttendancePhotos/checkin` (or your library/folder)
  - File Name: `@{triggerBody()?['fileName']}`
  - File Content: `@{variables('Binary')}` or the Compose output
- (Optional) Create share link → Link type: View, Scope: People in your organization
- Response (200):
```
{
  "ok": true,
  "url": "@{body('Create_share_link')?['link']?['webUrl']}"
}
```
If not creating a share link, you can return file `Path` or build a URL from file metadata.

Check-in Flow
- Trigger JSON schema:
```
{
  "type": "object",
  "properties": {
    "checkin": { "type": "string" },
    "locationName": { "type": "string" },
    "gps": { "type": "string" },
    "jobTitle": { "type": "string" },
    "jobDetail": { "type": "string" },
    "photoUrl": { "type": ["string", "null"] },
    "email": { "type": ["string", "null"] },
    "name": { "type": ["string", "null"] },
    "role": { "type": ["string", "null"] },
    "employeeNo": { "type": ["string", "null"] },
    "supervisorEmail": { "type": ["string", "null"] },
    "province": { "type": ["string", "null"] },
    "channel": { "type": ["string", "null"] }
  },
  "required": ["checkin"]
}
```
- (Optional security) same header check as above.
- Action: SharePoint → Create item in `Attendance` with mappings:
  - Title: `@{coalesce(triggerBody()?['email'], 'unknown')}`
  - Type: `Checkin`
  - EmployeeEmail/Name/EmployeeNo/... from the same-named trigger fields
  - When: `@{triggerBody()?['checkin']}`
  - LocationName: `@{triggerBody()?['locationName']}`
  - GPS: `@{triggerBody()?['gps']}`
  - PhotoUrl: `@{triggerBody()?['photoUrl']}`
- Response (200): `{ "ok": true, "id": "@{outputs('Create_item')?['body/ID']}" }`

Checkout Flow
- Trigger JSON schema:
```
{
  "type": "object",
  "properties": {
    "checkout": { "type": "string" },
    "checkoutGps": { "type": "string" },
    "checkoutPhotoUrl": { "type": ["string", "null"] },
    "locationName": { "type": "string" },
    "email": { "type": ["string", "null"] },
    "name": { "type": ["string", "null"] },
    "role": { "type": ["string", "null"] },
    "employeeNo": { "type": ["string", "null"] },
    "supervisorEmail": { "type": ["string", "null"] },
    "province": { "type": ["string", "null"] },
    "channel": { "type": ["string", "null"] }
  },
  "required": ["checkout"]
}
```
- Create item in `Attendance` with Type=`Checkout` and map checkout fields, similar to check-in.
- Response: `{ "ok": true, "id": "..." }`

Leave Flow
- Trigger JSON schema:
```
{
  "type": "object",
  "properties": {
    "dt": { "type": "string" },
    "type": { "type": "string" },
    "reason": { "type": "string" },
    "email": { "type": ["string", "null"] },
    "name": { "type": ["string", "null"] },
    "employeeNo": { "type": ["string", "null"] },
    "supervisorEmail": { "type": ["string", "null"] },
    "province": { "type": ["string", "null"] },
    "channel": { "type": ["string", "null"] }
  },
  "required": ["dt", "type"]
}
```
- Create item in `LeaveRequests` mapping the fields. Optionally add an Approval step and update `Status` accordingly.
- Response: `{ "ok": true, "id": "..." }`

Login (Resolve User) Flow (optional)
- Trigger JSON schema:
```
{
  "type": "object",
  "properties": {
    "email": { "type": ["string", "null"] },
    "user": { "type": ["string", "null"] },
    "password": { "type": ["string", "null"] }
  }
}
```
- Lookup user in SharePoint list or Dataverse. Return JSON:
```
{
  "role": "SUPERVISOR" | "AGENT",
  "name": "...",
  "email": "...",
  "employeeNo": "...",
  "supervisorEmail": "...",
  "province": "...",
  "channel": "...",
  "stores": [ { "id": "...", "name": "...", "province": "...", "channel": "..." } ]
}
```
The app will set cookies from this response and use them in subsequent submissions.

Testing
- Update `.env.local` with your Flow URLs (and optional keys) and restart the dev server.
- Sign in (login uses fallback unless `PA_RESOLVE_USER_URL` is set).
- New Check-in: photo upload hits `PA_UPLOAD_PHOTO_URL`; Check-in submits to `PA_CHECKIN_URL`.
- Checkout: submits to `PA_CHECKOUT_URL`.
- Leave page UI currently shows a mock list; wire its submit to `/api/pa/leave` if/when needed.

Security Notes
- The Power Automate HTTP trigger URL is public by default. Using a secret header validated in Flow is a simple way to add protection while keeping a direct trigger. Alternatively, front flows with an Azure Function or API Management.

Supervisor Dashboards (Activity, Report, Summary, Time Attendance)

API endpoints
- Activity: `POST /api/pa/activity` → expects body `{ nameOrEmail?: string, date?: string }` and returns:
```
{
  "ok": true,
  "rows": [
    { "date": "2025-06-16", "checkin": "10.00", "checkout": "11.00", "location": "...", "detail": "...", "status": "completed", "name": "...", "email": "..." }
  ]
}
```
- Report: `POST /api/pa/report` → expects `{ from?: string, to?: string }`, returns detailed rows used by Report page with `image` field.
- Summary: `POST /api/pa/report/summary` → expects `{ from?: string, to?: string }`, returns
```
{
  "ok": true,
  "kpis": { "members": 10, "total": 123, "completed": 80, "incomplete": 20, "ongoing": 23 },
  "rows": [ { "name": "Alice", "total": 10, "completed": 8, "incomplete": 1, "ongoing": 1 } ]
}
```
- Time Attendance: `POST /api/pa/time-attendance` → expects `{ from?: string, to?: string, name?: string }`, returns rows with `imageIn`, `imageOut`, `status/leave`, and `remark`.

SharePoint queries
- Use the `Attendance` list for check-in/check-out records. Suggested filters:
  - For Activity: filter by `When` date equals and `EmployeeName`/`EmployeeEmail` contains.
  - For Report: filter by `When ge <from> and When le <to>` and project fields, compute `status`:
    - `completed` if both check-in and check-out exist
    - `ongoing` if check-in exists and no check-out
    - `incomplete` if data missing
  - For Time Attendance: similar range filter; include related leave records by joining with `LeaveRequests` on same date and person (or return leave rows separately for the UI to merge client-side).

Flow outputs should match the shapes above. Include file URLs for images if available.
