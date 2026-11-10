# Employee Portal (separate from the Manager Portal)
Four streams: My Tasks, My Projects, My Schedule & Team, My Performance & Profile.
Shares the **same MongoDB** as the Manager Portal: set identical `MONGODB_URI`/`MONGODB_DB` and SMTP values in both.
Employee API: `npm run dev:api` (port 8001) · UI: `npm run dev:frontend` (port 5174). Manager routes return 404 here.
Task updates (status, %, blockers, hours, notes) are written to MongoDB; the Manager Portal's Live Monitor polls it every 8 s.
Invitation links (sent by the Manager Portal) open `<EMPLOYEE_PORTAL_URL>/activate#token=…` on this app.
