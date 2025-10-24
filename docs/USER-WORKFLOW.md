# Check‑in / Check‑out – User Workflow (Low‑tech Guide)

This is a simple, practical guide for Sales Support and Supervisors to use and test the app.

## Who uses this app?

- Sales Support: creates a task, checks in (with GPS and a photo), and later checks out.
- Supervisor: reviews activity, time attendance, reports, and leaves.

## Sign‑in

- Username: your company e‑mail
- Password: your employee number (from HR/Users list)
- If you can’t sign in, confirm your employee number is correct in the Users list.

---

## Sales Support – Daily Flow

1) Start a task (Check‑in)
- Go to Check‑in Check‑out → tap “+ New”.
- Check‑in time is prefilled (you can adjust if needed).
- Type the Location Name (e.g., store name).
- Tap “Get GPS” → the app captures GPS and shows the address.
- Take a picture or attach one from your gallery.
- Tap “Submit Check‑in”.
  - After submitting, the Check‑in section locks (no edits). This prevents duplicates.

2) Continue Working
- If you return to the list, your task shows as “In Progress” (ongoing).
- Open the task from the list any time (the app remembers the task by date + location).

3) End the task (Check‑out)
- In the same task, pick Check‑out time.
- Tap “Get GPS” and optionally add a photo.
- Tap “Submit Checkout”.
  - The system allows checkout even if the GPS is not at the same place as check‑in.
  - If the distance is too far, reports will show a remark for supervisor review.

4) Status meanings
- Completed: both check‑in and check‑out were submitted.
- In Progress: check‑in exists, check‑out not yet submitted.
- Incomplete: check‑out exists without a matching check‑in (rare case).

Notes
- Photos are automatically resized to a small size before upload so it’s fast and saves data.
- After submit, the page returns to the list so you can see your progress.

---

## Sales Support – Leave Activity

Use this when you are not working (sick leave, vacation, personal business, etc.).

1) Open Leave page (`/leave`)
- Fill in: Date/Time, Leave Type, and Reason.
- Your name and e‑mail/employee number can be filled as needed.
- Tap “Submit” to record the leave.

2) What happens next
- The leave entry is saved in the Leave table.
- Time Attendance merges leave entries into its report for supervisors.
- You can submit more than one leave record if needed (different days or types).

Tip
- Keep “Reason” clear and short so supervisors understand at a glance.

---

## Supervisor – Review & Reporting

Home tiles
- Activity: live list of activities with GPS links and small maps.
- Time Attendance: shows activities with leave entries, downloadable CSV.
- Report: shows activities with separate Check‑in and Check‑out images and a “Remark” column.
- Summary: totals per Sales Support (Completed / Incomplete / Ongoing) for a date range.
- Leave: leave submissions overview.
- Calendar: company holidays and weekly‑off tools.

How to use each view
- Activity
  - Filter by date, name, or district.
  - Click GPS to open in Google Maps; mini map shows below when a key is set.
- Time Attendance
  - Combines activities with leaves for the period.
  - Shows distance (km) and highlights if above the threshold.
  - CSV export available.
- Report
  - Separate image columns: Image Check‑in and Image check‑out.
  - Remark column flags: “Checkout location differs from check‑in” when distance exceeds the configured limit.
  - CSV export includes the remark and both image URLs.
- Summary
  - Shows per‑person totals (Completed / Incomplete / Ongoing) with date range and district filters.
- Leave Manage
  - View leave submissions from Sales Support.
  - Filter by date range/district as needed.
  - If your process requires approval, ask admin to enable a simple approve/reject status (can be added to the Leave table and UI later).

Notes
- Tables scroll vertically if long (about 5 visible rows). Scroll to see more.

---

## Calendar & Leaves

- Company Holidays
  - Calendar shows holiday rows from the Holidays list. You’ll see date, name, and type.
- Weekly Off (optional)
  - Supervisors can load and save weekly off settings by employee number.
- Day‑off (optional)
  - A quick “day‑off” request can be submitted; entries appear in Time Attendance alongside activities.

---

## Testing Checklist (Quick)

Sales Support
- Login with email + employee number.
- Create a new task, get GPS, submit check‑in with a photo.
- Reopen the task from the list and submit check‑out with GPS and a photo.
- Try checking out from a different location; later check the Report → Remark column highlights it.

Supervisor
- Activity: confirm your entry appears with GPS and (if configured) a mini map.
- Report: confirm the two image columns and the remark when distance is too large.
- Time Attendance: confirm activities and any leave entries, and export CSV.
- Summary: confirm totals reflect submitted tasks for the date range.
- Calendar: confirm holidays appear and weekly‑off can be loaded/saved.
- Leave Manage: confirm leave submissions appear for the selected dates.

---

## FAQs & Tips

- Do I need to redeploy after adding table rows?
  - No. Data refreshes when you reload. Redeploy only if environment variables or required column names change.
- My holiday didn’t appear
  - Make sure the Holidays table has dates in a standard format; the app supports ISO, dd/mm/yyyy, mm/dd/yyyy, and Excel serial numbers.
- Photos don’t upload / GPS not showing
  - Check browser permissions for camera/location. Try again on a stable connection.
- Can I edit after submit?
  - No. The app locks fields after check‑in/checkout to prevent accidental edits.

---

If you need a one‑page PDF or screenshots, let us know and we’ll add them.
