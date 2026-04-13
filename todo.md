# Wired Works Scheduler — Project TODO

## Phase 1: Database Schema & Migrations
- [x] Extend drizzle/schema.ts with clients, jobs, crewMembers, jobAssignments, crewNotes, smsLog, googleTokens, clientAddresses tables
- [x] Generate and apply database migrations

## Phase 2: Backend API (tRPC Routers)
- [x] clients router: list, getById, create, update, delete
- [x] clientAddresses router: getByClient, create, update, delete
- [x] jobs router: list, getById, create, update, delete, listByDateRange, listForCrew
- [x] crew router: list, getById, create, update, delete (admin only)
- [x] jobAssignments router: assign/unassign crew to jobs, replaceAssignments
- [x] crewNotes router: create, update, delete, getByJob
- [x] SMS notifications: booking confirmation, 1-hour reminder, review request via OpenPhone
- [x] googleCalendar router: OAuth connect/disconnect, create/update/delete events
- [x] users router: list, updateRole (admin only)
- [x] dashboard router: today's jobs, upcoming, recent activity, stats
- [x] Role-based access: admin manages all; crew views assigned jobs only

## Phase 3: Frontend UI
- [x] Global design system: dark elegant theme, typography, color tokens in index.css
- [x] DashboardLayout with sidebar navigation (desktop) and bottom nav (mobile)
- [x] Dashboard page: today's jobs, upcoming schedule, stats cards
- [x] Calendar page: day/week/month views with FullCalendar, create/edit jobs from calendar
- [x] Clients page: list, add, edit, delete clients with search
- [x] Client detail page: contact info, multiple addresses with CRUD, directions buttons, job history
- [x] Job detail page: job info, owner instructions, crew notes section, SMS controls, Google Calendar status
- [x] Job create/edit modal with client address selector, directions button, crew assignment
- [x] Crew management page (admin only): list, add, edit, deactivate crew members
- [x] Users page (admin only): role management for all signed-in users
- [x] Settings page: Google Calendar OAuth, OpenPhone SMS info
- [x] Role-based UI: crew sees only their assigned jobs
- [x] Responsive mobile layout: bottom nav, touch-friendly cards, full mobile optimization

## Phase 4: SMS Notifications (OpenPhone/Quo)
- [x] Replaced Twilio with OpenPhone (Quo) API
- [x] OPENPHONE_API_KEY and OPENPHONE_FROM_NUMBER stored as environment secrets
- [x] sms.ts uses OpenPhone REST API with E.164 phone normalization
- [x] Booking confirmation SMS sent when job is created (toggle in job form)
- [x] 1-hour reminder SMS sent manually from job detail page
- [x] Review request SMS sent when job is marked completed
- [x] SMS log stored in database per job, visible on job detail page

## Phase 5: Google Calendar Integration
- [x] googleCalendarEventId column added to jobs table
- [x] Google OAuth refresh tokens stored per user in googleTokens table
- [x] Backend: create/update/delete Google Calendar events on job changes
- [x] Frontend: Connect/disconnect Google Calendar in Settings page
- [x] Frontend: Google Calendar sync status on job detail page

## Phase 6: Multiple Client Addresses & Directions
- [x] clientAddresses table created and migrated (label, addressLine1-2, city, state, zip, isPrimary)
- [x] clientAddresses router: getByClient, create, update, delete
- [x] Client detail page: full address management UI with add/edit/delete
- [x] Address labels: Home, Business, Vacation, Other
- [x] Job form: address dropdown from client's saved addresses (auto-selects primary)
- [x] Get Directions button on job form (opens Google Maps)
- [x] Get Directions button on each address in client detail page
- [x] Primary address badge and toggle

## Phase 7: Tests
- [x] Vitest tests for SMS message templates (sms.test.ts) — 6 tests passing
- [x] Vitest test for auth.logout (auth.logout.test.ts) — 1 test passing
- [x] All 7 tests passing

## Import Features
- [x] CSV import backend: parse CSV, validate rows, bulk-insert clients
- [x] CSV import backend: bulk-insert crew members from CSV
- [x] CSV import frontend: ImportPage with file upload, column mapping UI, preview table, confirm
- [x] Support Jobber CSV export format (auto-detect column names)
- [x] Support QuickBooks CSV export format (auto-detect column names)
- [x] Download sample CSV template for clients
- [x] Download sample CSV template for crew
- [x] Import results summary (success count, skipped rows, errors)
- [x] Add "Import" nav item in sidebar (admin only)
- [x] QuickBooks / Jobber integration guidance panel in Import page (Export Guides tab)

## UX Improvements
- [x] Remove login wall — make app accessible without requiring authentication
- [x] Add dark/light mode toggle in sidebar and mobile header
- [x] Make ThemeProvider switchable so toggle persists across sessions

## Login Removal & Theme Toggle
- [x] Remove global auth redirect from main.tsx
- [x] Remove login wall from DashboardLayout (show app without requiring sign-in)
- [x] Make all backend tRPC procedures public (no UNAUTHORIZED errors for unauthenticated users)
- [x] Add dark/light mode toggle button in sidebar footer and mobile header dropdown

## Projects Feature
- [x] DB: projects table (title, description, clientId, status, startDate, dueDate, createdAt)
- [x] DB: projectMilestones table (projectId, title, isComplete, dueDate, sortOrder)
- [x] DB: projectReminders table (projectId, message, remindAt, isDismissed)
- [x] Backend: CRUD routes for projects, milestones, reminders
- [x] Backend: milestone toggle (mark complete/incomplete)
- [x] Frontend: Projects page with client-linked project cards
- [x] Frontend: Project detail with milestone checklist, progress bar, deadlines
- [x] Frontend: Add/edit reminder with date picker on each project
- [x] Frontend: Reminder badge/alert when a reminder is due
- [x] Nav: Add Projects to sidebar navigation

## Follow-Up Feature
- [x] DB: followUps table (contactName, phone, type: call/text/manual, note, isFollowedUp, contactedAt, createdAt)
- [x] Backend: CRUD routes for follow-ups (list by date, create, toggle followedUp)
- [x] Backend: OpenPhone webhook endpoint to auto-log incoming calls/texts
- [x] Frontend: Follow-Up tab on Dashboard home page
- [x] Frontend: Daily follow-up list with check-off toggle
- [x] Frontend: Manual add follow-up entry (name, phone, note, type)
- [x] Frontend: Filter by date (today / this week / all)

## Completed (this session)
- [x] Remove global auth redirect from main.tsx
- [x] Remove login wall from DashboardLayout (app accessible without sign-in)
- [x] Make all backend tRPC procedures public (no UNAUTHORIZED errors)
- [x] Add dark/light mode toggle in sidebar footer and mobile header dropdown
- [x] Make ThemeProvider switchable so toggle persists
- [x] DB: projects, projectMilestones, projectReminders, followUps tables created and migrated
- [x] Backend: CRUD routes for projects, milestones, reminders (projectsFollowups.ts)
- [x] Backend: milestone toggle (mark complete/incomplete)
- [x] Backend: getDueReminders query
- [x] Frontend: Projects page with client-linked project cards, milestone checklist, progress bar
- [x] Frontend: Project detail panel with reminders, add/dismiss/delete
- [x] Frontend: Reminder due banner on Projects page and Dashboard Projects tab
- [x] Nav: Projects added to sidebar and mobile bottom nav
- [x] Frontend: Follow-Up tab on Dashboard with pending/done sections
- [x] Frontend: Daily follow-up list with check-off toggle (optimistic update)
- [x] Frontend: Manual add follow-up entry (name, phone, note, type)
- [x] Frontend: Filter by Today / This Week / All Time
- [x] Frontend: Dashboard tabs — Schedule, Follow-Up, Projects
- [x] Tests: 24 tests passing across 4 test files (0 TypeScript errors)

## Dashboard Layout Redesign
- [x] Remove tabs from Dashboard — show Schedule, Follow-Up, and Projects as always-visible panels
- [x] Schedule panel: today's jobs + upcoming (left/main column)
- [x] Follow-Up panel: today's pending follow-ups with check-off (right column)
- [x] Projects panel: active projects with progress bars (bottom or right column)

## Bug Fixes & New Features
- [x] Fix client add form — manually adding a client does not work
- [x] Add new user creation to Users page (create user with name, email, phone, role without requiring OAuth)

## Crew View & Fixes
- [x] Fix client add form — remove isAdmin gate so Add Client button always shows
- [x] Fix ClientDetailPage — remove isAdmin gates on New Job, Add Address, edit/delete address buttons
- [x] Add user creation to UsersPage (name, email, role, delete)
- [x] Crew-specific navigation: hide Follow-Up, Projects, Crew, Users, Import nav items for crew role
- [x] CrewJobsPage: show only assigned jobs, close-out job button, field notes submission
- [x] CrewClientsPage: all clients with addresses and all job-related notes per client
- [x] In-app SMS from job detail: "On My Way" quick-send and custom message to client
- [x] Add sendMessage tRPC procedure using OpenPhone API

## Photo Upload & Crew View
- [x] jobPhotos table in schema (jobId, s3Key, s3Url, uploadedBy, createdAt)
- [x] S3 photo upload tRPC route (multipart, max 10 per job, stored in S3)
- [x] sendMessage SMS procedure via OpenPhone API
- [x] DashboardLayout: crew role sees only "My Jobs" and "Clients" nav items
- [x] CrewJobsPage: assigned jobs list, close-out button, field notes + up to 10 photos
- [x] Photo grid display in job notes/close-out section
- [x] CrewClientsPage: all clients, addresses, job notes per client
- [x] In-app SMS panel on JobDetailPage: On My Way, ETA, custom message

## Completed (crew view + photo upload session)
- [x] Fix client add form — removed isAdmin gate so Add Client button always shows
- [x] Fix ClientDetailPage — removed isAdmin gates on all address/job buttons
- [x] Add user creation to UsersPage (name, email, role, delete)
- [x] Crew-specific navigation: crew role sees only My Jobs and Clients
- [x] CrewJobsPage: assigned jobs list with expand/collapse, directions, call/text client
- [x] CrewJobsPage: close-out dialog with field notes, credentials, up to 10 photo uploads
- [x] CrewJobsPage: quick SMS buttons (On My Way x2, Arrived, Done) + custom message
- [x] CrewClientsPage: all clients with addresses (accordion), job history, directions per address
- [x] jobPhotos table in schema + migration applied
- [x] S3 photo upload backend route (base64 → S3 → DB)
- [x] messaging.sendToClient tRPC procedure (OpenPhone API)
- [x] listJobs now joins with clients to return clientName and clientPhone
- [x] 29 tests passing across 5 test files (0 TypeScript errors)

## Bug Fix — Add Client Button Missing
- [ ] ClientsPage: Add Client button not visible — remove all remaining isAdmin/auth gates

## Login & Auth Fix
- [ ] Add Login button to sidebar footer when user is not signed in
- [ ] Make all CRUD buttons unconditional (no isAdmin check) across ClientsPage, JobDetailPage, CrewPage, etc.
- [ ] Audit all pages for isAdmin gates hiding buttons and remove them
