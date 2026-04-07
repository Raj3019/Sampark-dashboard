# Sabha Analytics Figma Redesign Brief

## Purpose

This document is a Figma-ready redesign brief for the current `sabha-analytics` app.
It is based on the existing Next.js screens and components in the repo, and is intended
to help recreate the full app UI in Figma with a cleaner product direction.

Use this brief in one of three ways:

1. Paste sections into your Figma AI/plugin workflow to generate frames faster.
2. Rebuild the app manually in Figma using the frame list and component system below.
3. Use it as the source of truth before implementing the redesign in code.

## Current Product Audit

### Product Areas

- Authentication
- Main dashboard
- AYC Sabha detail view
- Yuvak directory
- KK analysis
- KK personal dashboard
- Admin user management
- Admin login activity
- Admin sheet change history
- Shared shell: sidebar, top area widgets, stats cards, charts, tables, reminders
## Current Implementation Snapshot

This section captures the latest implemented product behavior so the redesign does not miss
recent work already present in the codebase.

### App Shell And Navigation

- Role-based navigation already exists.
- KK users are redirected away from leader views into their personal dashboard.
- The shell currently includes:
  - left sidebar on desktop
  - mobile drawer/header
  - compact reminder center at the top of the page
  - upcoming birthdays widget at the top of the page
- Theme toggle already exists with dark and light modes.

Relevant files:

- `components/AppShell.tsx`
- `components/Navbar.tsx`
- `components/ThemeProvider.tsx`

### Authentication

- Username/password login is already implemented.
- Password visibility toggle is already implemented.
- Success and error toasts are already implemented.
- The login page already has a split-layout marketing/auth composition.

Relevant files:

- `app/login/page.tsx`
- `components/auth/LoginForm.tsx`

### Main Dashboard

The current dashboard is more than a basic summary page. It already includes:

- upcoming Ekadashi card
- last updated time
- multi-sabha KPI cards
- last-4-sabha average attendance widgets
- per-sabha summary cards
- area segregation table
- status audit table
- highest and lowest attendance session cards
- KK performance by sabha
- KK follow-up summary
- vakta/topic snippets from session metadata

Relevant file:

- `app/page.tsx`

### Reminder And Birthday Modules

These are already implemented and should be preserved in the redesign:

- follow-up reminder center with moderate/high risk grouping
- leader/admin KK filter in reminders
- call CTA for reminders with phone numbers
- expandable reminder cards in full mode
- upcoming birthdays widget
- birthdays currently scoped to Kishor/AYC only
- call CTA from birthday cards

Relevant files:

- `components/ReminderCenter.tsx`
- `components/UpcomingBirthdays.tsx`

### AYC Sabha Implementation

The AYC page already has substantial product logic, not just UI:

- leader name in header
- expected next sabha attendance
- risk bucket grouping: low, moderate, and high
- recent sabha summaries
- standard-wise breakdown
- attendance trend chart
- vakta/topic performance chart
- most active KK card
- most deactive KK card
- best and lowest session lists
- tabbed sections for overview, all yuvaks, KK performance, and KK workload

Relevant file:

- `app/sabha/kishor/page.tsx`

### Directory Implementation

The directory is already feature-rich and should be redesigned, not simplified away.
It currently includes:

- risk counts across all yuvaks
- sabha counts
- attending filter
- searchable/filterable table
- filters for status, sabha, KK, and date window
- custom date range support
- pagination
- row-level attendance indicators: last N sabhas dots, last 3 badge, and last sabha presence badge

Relevant files:

- `app/yuvaks/page.tsx`
- `components/YuvakTable.tsx`

### KK Analysis Implementation

Already implemented features:

- sabha-level switching between CN, Kishor, and Bal
- attending-only scoped mode
- overloaded KK highlighting
- detailed workload chart/table
- follow-up risk counts per KK
- searchable and area-filtered KK report

Relevant files:

- `app/kk-analysis/page.tsx`
- `components/charts/KKWorkloadChart.tsx`

### KK Personal Dashboard Implementation

The KK dashboard already contains personalized logic:

- personalized greeting with KK name
- area label
- assigned yuvak counts
- active/deactive breakdown
- average attendance and efficiency score
- expandable stat cards with yuvak names
- personal attendance trend
- comparison toggle between personal group and full sabha
- vakta/topic performance comparison

Relevant files:

- `app/kk-home/KkHomeClient.tsx`
- `components/charts/AttendanceTrendChart.tsx`
- `components/charts/VaktaTopicTrendChart.tsx`

### Admin Implementation

Admin flows already implemented:

- user management with create user modal, role editing, assigned KK editing, delete user, search, and role filters
- login activity table
- sheet change history with filter chips and audit rows by change type

Relevant files:

- `app/admin/users/UsersClient.tsx`
- `app/admin/logs/LogsClient.tsx`
- `app/admin/sheet-changes/SheetChangesClient.tsx`

### Shared Components Already In Use

These are part of the current implementation and should either be visually upgraded
or replaced with stronger versions in the redesign:

- stats cards
- sabha meta panel
- status badges
- attendance trend chart
- vakta/topic trend chart
- KK workload chart
- reminder cards
- yuvak table

Relevant files:

- `components/StatsCard.tsx`
- `components/SabhaMetaPanel.tsx`
- `components/StatusBadge.tsx`
- `components/charts/AttendanceTrendChart.tsx`
- `components/charts/VaktaTopicTrendChart.tsx`
- `components/charts/KKWorkloadChart.tsx`
- `components/YuvakTable.tsx`


## Page-By-Page Current Content Inventory

This section lists what each current route actually shows today, including routes that exist in the codebase but are hidden from the current sidebar.

### Visible In Current Navigation

#### `/sabha/kishor` - AYC Sabha

Current structure:

- Header area
  - leader name
  - page title
  - sabha subtitle
  - expected next sabha attendance chip
  - attending filter
  - refresh action
- Risk legend row
- Tabs
  - Overview
  - All Yuvaks
  - KK Performance
  - KK Workload
- Overview tab content
  - collapsible follow-up risk buckets section
  - two recent sabha summary cards
  - KPI cards
    - Total Yuvaks
    - Active
    - At Risk
    - Last Sabha
  - STD breakdown chips
  - attendance trend chart
  - vakta/topic performance chart
  - most active KK card
  - most deactive KK card
  - lowest sessions card
  - best sessions card
  - topic planning tip card
- All Yuvaks tab
  - `YuvakTable`
- KK Performance tab
  - sortable KK ranking table
  - efficiency overview cards
- KK Workload tab
  - `KKWorkloadChart`

#### `/kk-analysis` - KK Analysis

Current structure:

- Header area
  - page title
  - CN/Kishor/Bal counts in subtitle
  - total unique KKs and total yuvaks summary
  - refresh action
- Filter row
  - sabha switcher
  - attending-only switcher
- Main content by selected sabha
  - section header with sabha chip
  - KPI cards
    - Total KKs
    - Avg Yuvaks/KK
    - Overloaded KKs
  - overloaded KK alert strip
  - KK workload chart/table
  - detailed KK report card grid

#### `/yuvaks` - Yuvak Directory

Current structure:

- Header area
  - page title
  - subtitle
  - attending filter
  - refresh action
- KPI card strip
  - Total Yuvaks
  - Chirag Nagar count
  - Kishor Sabha count
  - Bal Sabha count
  - Low Risk
  - Moderate Risk
  - High Risk
- Risk legend row
- Main table area
  - search
  - status filter
  - sabha filter
  - KK filter
  - date window filter
  - optional custom date range
  - count summary
  - paginated `YuvakTable`

#### `/kk-home` - My Dashboard

Current structure:

- Personalized hero banner
  - KK name
  - primary area chip
- KPI cards
  - Total Yuvaks
  - Active
  - Deactive
  - Avg Attendance
  - Efficiency Score
- Expandable stat lists inside some KPI cards
- Attendance trend chart
- comparison note
- vakta/topic trend chart with comparison toggle

#### `/admin/users` - User Management

Current structure:

- Header panel
  - title
  - subtitle
  - New User button
- KPI mini cards
  - Total Users
  - KK Users
  - Leaders
  - Admins
- Search and role filter toolbar
- User table
  - Name
  - Username
  - Email
  - Role
  - Assigned KK
  - Joined
  - Actions
- Create user modal

#### `/admin/logs` - Login Activity

Current structure:

- Header
  - title
  - total events subtitle
  - refresh action
- Login activity table
  - User
  - Role
  - Action
  - IP
  - Browser
  - Time

#### `/admin/sheet-changes` - Sheet Change History

Current structure:

- Header
  - title
  - subtitle with total changes
  - refresh action
- Filter chip row
  - All
  - Added
  - Removed
  - Present
  - Absent
  - Field Updates
- Change history table
  - Type
  - Sabha
  - Description
  - Detected

### Implemented But Hidden From Current Sidebar

#### `/` - Main Dashboard

This route exists and is fully implemented even though `Dashboard` is commented out in the sidebar.

Current structure:

- Page title row
  - Sabha Dashboard title
  - subtitle
  - upcoming Ekadashi card
  - updated time
  - refresh action
- Top KPI row
  - Total Yuvaks
  - Active
  - Needs Attention
  - Overall Yuvaks card with Attending/Non-attending chips
- Last 4 Sabha Average Attendance module
  - Overall card
  - Yuva card
  - AYC card
  - Bal card
- Sabha summary card row
  - Yuva Sabha card
  - AYC Sabha card
  - Bal Sabha card
  - each card shows total, avg attendance, expected next attendance, active/attention chips, last vakta/topic meta
- Area Segregation table
- Status Audit table
- Lowest Attendance Sessions list
- Highest Attendance Sessions list
- KK Performance by Sabha section
  - Most Active KK card per sabha
  - Most Deactive KK card per sabha
  - follow-up yuvak lists
- KK Follow-Up Summary list

#### `/sabha/chirag-nagar` - Yuva Sabha

This route exists and is implemented, but the Yuva Sabha sidebar item is currently commented out.

Current structure:

- Header area
  - page title
  - sabha subtitle
  - refresh action
- Risk legend row
- Tabs
  - Overview
  - All Yuvaks
  - KK Workload
- Overview tab content
  - two recent sabha summary cards
  - KPI cards
    - Total Yuvaks
    - Active
    - At Risk
    - Last Sabha
  - Sabha Breakdown donut card
  - attendance trend chart
  - collapsible Follow-Up Risk Buckets section
  - lowest sessions card
  - best sessions card
  - action suggestion cards
    - At Risk - Recoverable
    - Attending Regularly
- All Yuvaks tab
  - `YuvakTable`
- KK Workload tab
  - `KKWorkloadChart`

#### `/sabha/bal` - Bal Sabha

This route exists and is implemented, but the Bal Sabha sidebar item is currently commented out.

Current structure:

- Header area
  - page title
  - subtitle
  - expected next sabha attendance chip
  - attending filter
  - refresh action
- Risk legend row
- Tabs
  - Overview
  - All Yuvaks
  - KK Workload
- Overview tab content
  - two recent sabha summary cards
  - KPI cards
    - Total Yuvaks
    - Active
    - At Risk
    - Last Sabha
  - Sabha Breakdown donut card
  - attendance trend chart
  - collapsible Follow-Up Risk Buckets section
  - lowest sessions card
  - best sessions card
- All Yuvaks tab
  - `YuvakTable`
- KK Workload tab
  - `KKWorkloadChart`

#### `/ai` - Ask Akshar

Current state:

- visible implementation is a coming-soon hero card only
- there is also a larger chat assistant implementation commented out in the file
- the hidden commented implementation includes:
  - starter prompts
  - chat thread
  - chart cards in responses
  - streaming/loading state
  - input composer

### Shared Top-Level Content Outside Individual Pages

These appear above many routes through the app shell:

- `ReminderCenter` compact widget
- `UpcomingBirthdays` widget
- desktop sidebar or mobile header/drawer

### Access Rules Affecting Which Pages Users See

- KK users are redirected from sabha routes to `/kk-home`
- admin pages require admin session
- `/kk-home` requires KK role
- login redirects authenticated users back into the app
### Current UI Issues

- The interface is information-rich but visually dense.
- Most screens are card-on-card dark panels with similar visual weight.
- Tables, filters, stats, and charts compete for attention instead of forming a clear reading path.
- Color usage is functional but not systemized enough across product areas.
- Navigation feels like an internal tool, not a polished product.
- Mobile behavior exists, but the layouts are still designed mostly as compressed desktop screens.
- There are encoding artifacts in some labels/icons, which makes the UI feel less refined.

## New Design Direction

### Theme

Create a modern operations dashboard with a calm, premium, high-trust feel.
The product should feel less like a spreadsheet wrapper and more like a focused analytics workspace.

### Keywords

- Clear
- Layered
- Warm data product
- High-trust
- Calm urgency
- Mobile-aware

### Visual Personality

- Use a soft stone/slate base instead of pure black.
- Introduce saffron and sky as brand colors.
- Use sabha-specific accent colors sparingly:
  - Yuva: sky
  - AYC: indigo
  - Bal: amber
  - Risk: amber and red
- Rely on spacing, typography, and hierarchy before using more color.
- Make cards larger, cleaner, and more intentional.

## Design Tokens

### Color System

- `bg/base`: `#F6F3EE`
- `bg/canvas`: `#FCFAF6`
- `bg/elevated`: `#FFFFFF`
- `bg/tint`: `#F2EEE7`
- `text/strong`: `#1F2937`
- `text/body`: `#475569`
- `text/muted`: `#7C8798`
- `border/subtle`: `#E7E0D6`
- `border/strong`: `#D8CDBD`
- `brand/saffron`: `#D97706`
- `brand/saffron-soft`: `#F59E0B`
- `brand/sky`: `#0EA5E9`
- `brand/indigo`: `#6366F1`
- `brand/amber`: `#F59E0B`
- `state/success`: `#16A34A`
- `state/warning`: `#D97706`
- `state/danger`: `#DC2626`

### Typography

- Headline font: `Manrope`
- Body/UI font: `Plus Jakarta Sans`

Type scale:

- Display: 40/48 semibold
- H1: 32/40 semibold
- H2: 24/32 semibold
- H3: 18/28 semibold
- Body: 14/22 medium
- Small: 12/18 medium
- Data number XL: 36/40 bold
- Data number L: 28/32 bold

### Radius

- Page modules: 28
- Cards: 22
- Nested cards: 18
- Inputs/buttons: 14
- Pills/badges: 999

### Shadows

- Card: `0 12 40 rgba(31, 41, 55, 0.08)`
- Floating panel: `0 20 60 rgba(31, 41, 55, 0.14)`

### Spacing

- Base unit: 8
- Page padding desktop: 32
- Page padding tablet: 24
- Page padding mobile: 16
- Grid gaps: 16 / 20 / 24

## Layout System

### Desktop

- Use a 12-column layout
- Max content width: 1440
- Left rail: 280 fixed
- Main canvas: flexible with 32px outer padding

### Tablet

- Collapse left rail into compact nav
- Use 8-column layout

### Mobile

- Use stacked cards
- Turn data-heavy tables into sections with segmented controls and expandable rows

## Component Library For Figma

Build these as reusable components first:

- App shell
- Sidebar item
- Top utility bar
- Section header
- Hero banner
- KPI card
- Trend stat card
- Filter bar
- Segmented control
- Search input
- Select field
- Data table shell
- Table row status badge
- Reminder card
- Activity list item
- Chart card container
- Empty state
- Error state
- Modal
- Drawer
- User profile chip

## Navigation Redesign

### Sidebar

Structure:

- Logo and product name
- Primary navigation
- Role-aware secondary navigation
- Theme toggle
- Current user profile
- Logout action

Style:

- Warm off-white shell, not dark black
- Active item uses saffron-tinted background with left indicator bar
- Icons should be line icons, not text abbreviations

Primary items:

- Dashboard
- AYC Sabha
- KK Analysis
- Yuvak Directory

Secondary admin items:

- User Management
- Login Activity
- Sheet History

Secondary KK items:

- My Dashboard
- My Yuvaks

## Screen-by-Screen Figma Frames

Create the following top-level Figma pages:

1. Foundations
2. Components
3. App Shell
4. Authentication
5. Dashboard
6. Sabha Detail
7. Directory
8. KK Workspace
9. Admin
10. Mobile

### 1. Authentication

#### Frame: Login Desktop

- Split layout with left brand story panel and right auth card
- Left side includes:
  - product badge
  - strong product headline
  - 3 feature bullets
  - subtle abstract background with saffron and sky gradients
- Right side includes:
  - login card
  - username field
  - password field
  - primary CTA
  - helper text

#### Frame: Login Mobile

- Stacked layout
- Smaller brand panel
- Single centered login card

### 2. Main Dashboard

#### Frame: Dashboard Desktop

Structure from top to bottom:

- Page title row
  - `Sabha Dashboard`
  - date/update chip
  - refresh button
  - upcoming Ekadashi widget
- Insight hero row
  - one large summary card spanning 5 columns
  - two stacked utility cards on the right
- KPI row
  - total yuvaks
  - active
  - needs attention
  - attending vs non-attending
- Performance strip
  - overall average attendance
  - Yuva average
  - AYC average
  - Bal average
- Sabha overview cards
  - one card per sabha
  - each includes total, avg attendance, predicted next attendance, vakta/topic snippet
- Data modules
  - area segregation table
  - status audit card
  - highest sessions
  - lowest sessions
  - KK performance highlights
  - reminder center
  - birthday widget

Design notes:

- Use stronger hierarchy so only one hero area dominates.
- Convert dense text blocks into grouped subcards.
- Make table modules visually calmer with sticky controls and lighter rows.

#### Frame: Dashboard Mobile

- Hero summary card
- Ekadashi card
- KPI cards in 2-column grid
- Sabha cards stacked
- Charts before tables
- Tables converted into accordion sections

### 3. AYC Sabha Detail

#### Frame: AYC Overview

Replace the current tabbed dense screen with a clearer workspace:

- Header with:
  - title
  - leader name
  - active sabha chip
  - predicted attendance card
- Row 1:
  - hero card: attendance trend and latest session summary
  - side card: follow-up risk summary
- Row 2:
  - low risk / moderate risk / high risk cards
- Row 3:
  - stat cards
  - standard breakdown chips
- Row 4:
  - attendance trend chart
  - vakta/topic impact chart
- Row 5:
  - most active KK
  - most deactive KK
- Row 6:
  - best sessions
  - lowest sessions
- Row 7:
  - topic planning insight card

#### Frame: AYC Yuvaks Tab

- Persistent filter bar
- Search
- risk filters
- date range filters
- cleaner table with:
  - avatar initials
  - name
  - std
  - KK
  - last sabha
  - last 3
  - status
- Use softer row separators and fixed header

#### Frame: AYC KK Performance

- Summary cards at top
- Ranking table
- Card grid below for per-KK summaries

#### Frame: AYC KK Workload

- One chart hero
- Below it, workload cards with clear risk split

### 4. Yuvak Directory

#### Frame: Directory Desktop

- Header with total counts and risk overview
- Left filter rail or sticky filter bar
- Main area contains one refined table
- Add quick stat chips above the table:
  - all yuvaks
  - Yuva
  - AYC
  - Bal
  - low risk
  - moderate risk
  - high risk

Design notes:

- This screen should feel like a command center table, not a generic data dump.
- Use a sticky toolbar and denser but polished rows.

### 5. KK Analysis

#### Frame: KK Analysis Desktop

- Page intro and sabha segment switcher
- KPI strip:
  - total KKs
  - total yuvaks
  - avg yuvaks per KK
  - overloaded KKs
- Main chart card
- Overloaded alert strip
- Detailed KK workload card grid

Design notes:

- Make sabha switcher prominent and segmented.
- Each KK card should have:
  - name
  - yuvak count
  - active vs attention mini bar
  - avg attendance
  - top follow-up names

### 6. KK Personal Dashboard

#### Frame: KK Home Desktop

- Personalized hero banner with name and primary area
- KPI strip:
  - assigned yuvaks
  - active
  - need follow-up
  - avg attendance
  - efficiency score
- Your attendance trend chart
- Compare your group vs full sabha toggle/chart
- Expandable yuvak list card

Design notes:

- This should feel more personal and action-driven than the leader dashboard.
- Give the page a warmer, more encouraging tone.

### 7. Admin User Management

#### Frame: Users Desktop

- Header with title and primary CTA
- KPI mini cards
- Search and role filter toolbar
- Main user table
- Create user modal

Design notes:

- Keep admin UI calm and structured.
- Emphasize form clarity and safe actions.

### 8. Admin Login Activity

#### Frame: Login Activity Desktop

- Header and refresh action
- Summary strip:
  - total events
  - today events
  - admin activity
  - KK activity
- Activity table

### 9. Admin Sheet Change History

#### Frame: Sheet History Desktop

- Header
- change type filter chips
- timeline/list hybrid view instead of only a raw table

Design notes:

- Convert this from a plain table to a more readable audit feed.
- Group by day with section headers like `Today`, `Yesterday`, `Earlier`.

## Recommended Charts

Use consistent chart shells with:

- title
- subtitle
- info icon
- segmented period control where relevant

Chart styles:

- Smooth line charts for trends
- stacked bars for attendance splits
- horizontal bars for KK workload
- donut charts only for small high-level summaries

## Figma Page Build Order

1. Foundations
2. Components
3. Sidebar + shell
4. Login
5. Dashboard desktop
6. Dashboard mobile
7. AYC detail set
8. Directory
9. KK analysis
10. KK personal dashboard
11. Admin screens

## Suggested Figma Auto Layout Rules

- Every page section should be an auto-layout frame
- Use 24px between major sections
- Use 16px inside dense cards
- Use component variants for:
  - card tone
  - badge tone
  - table row state
  - button priority
  - sidebar active/default

## Prompt To Paste Into A Figma AI Plugin

Use this as a starting prompt:

```text
Redesign a web app called Sabha Analytics as a premium analytics dashboard for attendance and follow-up management.

Visual style:
- warm off-white canvas
- white elevated cards
- saffron primary accent
- sky blue for analytics
- indigo for AYC
- amber for Bal
- elegant and calm enterprise UI
- modern Indian community dashboard feel
- typography: Manrope for headings, Plus Jakarta Sans for UI
- rounded cards, strong spacing, clean hierarchy

Build desktop and mobile frames for:
- login
- main dashboard
- AYC sabha detail
- yuvak directory
- KK analysis
- KK personal dashboard
- admin user management
- admin login activity
- admin sheet history

Components to include:
- left sidebar
- top utility row
- KPI cards
- filter bar
- chart cards
- status badges
- data tables
- reminder cards
- modal dialogs

The UI should feel cleaner, more intentional, and less dense than a typical internal dashboard. Prioritize hierarchy, readability, and polished spacing.
```

## Implementation Notes

If we convert this redesign into code next, start with:

- `components/Navbar.tsx`
- `components/AppShell.tsx`
- `components/StatsCard.tsx`
- `components/YuvakTable.tsx`
- `components/ReminderCenter.tsx`
- `app/page.tsx`
- `app/sabha/kishor/page.tsx`
- `app/yuvaks/page.tsx`
- `app/kk-analysis/page.tsx`
- `app/kk-home/KkHomeClient.tsx`
- `app/admin/users/UsersClient.tsx`

## Important Limitation

This brief was generated from the repo and terminal environment.
It does not directly push frames into Figma or control your editor's Figma extension.
If you want, the next step can be either:

1. I redesign the actual Next.js UI in code to match this brief.
2. I create a more detailed per-screen wireframe spec.
3. I help you convert one screen at a time into Figma-ready prompts.

## Redesign Guardrails

Do not remove these already-implemented product capabilities during redesign:

- role-based navigation
- reminder center
- upcoming birthdays
- upcoming Ekadashi
- risk buckets
- per-KK performance and workload views
- vakta/topic metadata views
- directory filters and date windows
- admin user CRUD
- login activity history
- sheet change history


## Detailed UI Appendix

This appendix is intentionally exhaustive. It documents the current UI as implemented today so the redesign can preserve all existing functionality and screen content.

### Global Shell

#### Root layout

- Global layout wraps all authenticated pages in `AppShell`.
- Login page bypasses the shell and renders full-screen.
- `SpeedInsights` is mounted globally.
- `Toaster` is mounted globally.
- Theme is applied before first paint via inline script.
- Default theme is dark.

#### Theme behavior

- Two themes exist: `dark` and `light`.
- Theme is stored in `localStorage` under `theme`.
- `ThemeProvider` exposes `theme` and `toggle()`.
- Light theme overrides the slate token scale in CSS.

#### App shell content

On non-login pages the shell currently renders:

- Desktop sidebar
- Mobile top header
- Mobile drawer
- Main content area with left offset on desktop
- Top widget row above page content
  - `ReminderCenter` in compact mode
  - `UpcomingBirthdays`

#### Sidebar details

Desktop sidebar currently includes:

- Product block
  - Sampark logo image
  - product name `Sabha Analytics`
  - subtitle `Sampark Management`
  - `V1` badge
- Navigation items shown for leader/admin users
  - `AYC Sabha`
  - `KK Analysis`
  - `Yuvak Directory`
- Admin subsection for admin users
  - `User Management`
  - `Login Activity`
  - `Sheet History`
- Footer block
  - current user avatar initial
  - current user name
  - current user role pill
  - `Auto-refreshes every 60s` helper text
  - logout button
  - theme toggle button

Hidden nav items currently commented out in code:

- `Dashboard`
- `Yuva Sabha`
- `Bal Sabha`
- `Ask Akshar`

#### Mobile header details

- menu toggle button
- logo
- product title
- `Website V1` label
- theme toggle button

#### Access behavior

- `/login` redirects authenticated users to `/`.
- All sabha routes use `app/sabha/layout.tsx`.
- KK users hitting sabha routes are redirected to `/kk-home`.
- `/kk-home` requires KK role.
- admin routes require admin session.

### Shared Widgets Above Page Content

#### ReminderCenter compact widget

Current compact widget behavior:

- title `Follow-up reminders`
- total reminder count pill
- leader/admin subtitle or KK subtitle depending on role
- optional KK filter for leaders/admins
- two collapsible risk summary cards
  - High risk
  - Moderate risk
- each expanded reminder row can show
  - yuvak name
  - follow-up KK
  - missed sabha count
  - phone number
  - `Call` CTA if a phone number exists

Full mode behavior exists in the component and includes:

- expanded reminder cards
- status pill
- leader review pill
- escalation/takeover/resolution meta text
- `Call` CTA
- action buttons are currently commented out in the UI

#### UpcomingBirthdays widget

Current behavior:

- shows upcoming birthdays for next 30 days
- currently limited to Kishor/AYC yuvaks only
- card title `Upcoming birthdays`
- subtitle `Next 30 days`
- each birthday row shows
  - yuvak name
  - optional phone call CTA
  - display date
  - follow-up KK if present
  - day badge: `Today`, `Tomorrow`, or `Nd`
- initially shows 2 birthdays
- can expand/collapse to show more

### Route Inventory

#### `/login`

Current page blocks:

- full-page radial/linear gradient background
- left marketing column
  - `Sabha Analytics` badge
  - headline `Secure access for your Sabha dashboard.`
  - supporting text about analytics, KK insights, and Akshar assistant
- right auth card
  - title `Login`
  - helper text
  - `LoginForm`

`LoginForm` fields and behavior:

- Username input
- Password input
- show/hide password button
- inline error panel
- submit button `Login`
- success toast on login
- error toast on failure

#### `/`

This route is implemented but hidden from the current sidebar.

Current page header:

- title `Sabha Dashboard`
- subtitle `Overview of Yuva, AYC, and Bal sabha attendance`
- upcoming Ekadashi card
  - heading `Upcoming Ekadashi`
  - loading state
  - success state with display date, tithi, paksha, and days-until copy
  - error/help state with fallback hint text
- updated time text
- refresh button

Top KPI row:

- `Total Yuvaks`
- `Active`
- `Needs Attention`
- custom `Overall Yuvaks` card
  - total count
  - attending chip
  - non-attending chip

Average attendance module:

- section title `Last 4 Sabha Average Attendance`
- helper text about hover details
- cards for
  - Overall
  - Yuva
  - AYC
  - Bal
- hover tooltip content includes latest session and sessions used

Sabha summary card row:

For each sabha card:

- sabha full label
- sabha subtitle
- short label pill
- total yuvaks
- avg attendance last 4
- expected next attendance
- active chip
- attention chip
- `SabhaMetaPanel` with last vakta and last topic

Area Segregation section:

- title `Area Segregation`
- subtitle about attending/non-attending counts by area and sabha type
- `Auto updates from sheet` pill
- wide table with
  - sticky Area column
  - Yuva yes/no
  - AYC yes/no
  - Bal yes/no
  - total row

Status Audit section:

- title `Status Audit (Raw Parsed Values)`
- subtitle to compare sheet filter counts vs app counts
- table columns
  - Sabha
  - Total
  - Super Active Yes
  - Super Active No
  - Attending Yes
  - Attending No
  - Super Active Names

Attendance extreme sessions row:

- `Lowest Attendance Sessions`
- `Highest Attendance Sessions`
- each list item shows
  - date
  - vakta/topic notes from session metadata when available
  - progress bar
  - count and percentage

KK Performance by Sabha section:

For each sabha:

- section header with sabha label and short pill
- `Most Active KK` card
- `Most Deactive KK` card
- each card includes
  - KK name
  - follow-up yuvak count
  - avg attendance last 4
  - active chip
  - attention chip
  - follow-up yuvak list with last-4 attendance percentage

KK Follow-Up Summary section:

- title `KK Follow-Up Summary`
- subtitle `Top KKs by yuvak count`
- top 10 KK rows with
  - KK name
  - yuvak count
  - average attendance
  - active count chip
  - attention count chip

States:

- loading spinner state
- error state with retry button
- empty dataset state

#### `/sabha/chirag-nagar`

This route is implemented but hidden from the current sidebar.

Header:

- blue left accent bar
- title `Chirag Nagar Sabha`
- subtitle `Std 13 & Above � Chirag Nagar`
- refresh button

Risk legend row:

- Low Risk = missed last 1 sabha
- Moderate Risk = missed last 2 sabhas
- High Risk = missed last 4 sabhas

Tabs:

- Overview
- All Yuvaks
- KK Workload

Overview tab blocks:

- Recent Sabha Summary cards
  - Most Recent Sabha
  - 2nd Most Recent Sabha
  - each shows date, attendance count/total, attendance percent, vakta
- KPI cards
  - Total Yuvaks
  - Active
  - At Risk
  - Last Sabha
- Sabha Breakdown card
  - doughnut chart for Low/Moderate/High risk
  - centered total count
  - risk legend rows with count and percentage
- `AttendanceTrendChart`
- collapsible `Follow-Up Risk Buckets`
  - Low Risk bucket list
  - Moderate Risk bucket list
  - High Risk bucket list
- Lowest Sessions card
- Best Sessions card
- Action suggestion cards
  - `At Risk - Recoverable`
  - `Attending Regularly`
- one more urgent action card exists in commented code and is currently hidden

All Yuvaks tab:

- `YuvakTable` scoped to Chirag Nagar yuvaks

KK Workload tab:

- card header `KK Workload - Chirag Nagar Sabha`
- helper text
- `KKWorkloadChart`

Behavior notes:

- page always attempts an attending-only filtered view first
- if no attending rows exist, it falls back to all rows

#### `/sabha/kishor`

Header:

- purple left accent bar
- leader display name
- title `AYC Sabha`
- subtitle `STD 9 to 12 � Kishor Sabha`
- expected next sabha attendance chip with info hint
- attending filter
- refresh button

Risk legend row:

- Low Risk
- Moderate Risk
- High Risk

Tabs:

- Overview
- All Yuvaks
- KK Performance
- KK Workload

Overview tab blocks:

- collapsible `Follow-Up Risk Buckets` section
  - Low Risk bucket card
  - Moderate Risk bucket card
  - High Risk bucket card
- Recent Sabha Summary cards
  - Most Recent Sabha
  - 2nd Most Recent Sabha
- KPI cards
  - Total Yuvaks
  - Active
  - At Risk
  - Last Sabha
- STD breakdown chips
- `AttendanceTrendChart`
- `VaktaTopicTrendChart`
- `Most Active KK` expandable card
- `Most Deactive KK` expandable card
- `Lowest Sessions` card
- `Best Sessions` card
- Topic planning tip card

All Yuvaks tab:

- `YuvakTable` scoped to AYC yuvaks

KK Performance tab:

- title `KK Performance Ranking`
- helper text about sorting
- sortable ranking table columns
  - Rank
  - KK Name
  - Total
  - Active
  - Deactive
  - Deactive %
  - Avg Attendance
  - Efficiency
- `Per KK Efficiency Overview` card grid

KK Workload tab:

- title `KK Workload - Kishor Sabha`
- helper text
- `KKWorkloadChart`

Behavior notes:

- currently only `yes` attending filter button is rendered in the UI
- sort arrows and efficiency logic are implemented
- most active/deactive KK cards can expand to list yuvak names

#### `/sabha/bal`

This route is implemented but hidden from the current sidebar.

Header:

- orange left accent bar
- title `Bal Sabha`
- subtitle `Attendance overview for Bal Sabha`
- expected next sabha attendance chip
- attending filter
- refresh button

Risk legend row:

- Low Risk
- Moderate Risk
- High Risk

Tabs:

- Overview
- All Yuvaks
- KK Workload

Overview tab blocks:

- Recent Sabha Summary cards
  - Most Recent Sabha
  - 2nd Most Recent Sabha
- KPI cards
  - Total Yuvaks
  - Active
  - At Risk
  - Last Sabha
- Sabha Breakdown doughnut card
- `AttendanceTrendChart`
- collapsible `Follow-Up Risk Buckets`
  - Low Risk bucket card
  - Moderate Risk bucket card
  - High Risk bucket card
- `Lowest Sessions` card
- `Best Sessions` card

All Yuvaks tab:

- `YuvakTable` scoped to Bal yuvaks

KK Workload tab:

- title `KK Workload - Bal Sabha`
- helper text
- `KKWorkloadChart`

Behavior notes:

- expected next sabha uses prediction logic
- currently only `yes` attending filter button is rendered in the UI

#### `/yuvaks`

Header:

- title `Yuvak Directory`
- subtitle `All yuvaks across all sabhas with attendance status`
- attending filter
- refresh button

KPI cards:

- Total Yuvaks
- Chirag Nagar
- Kishor Sabha
- Bal Sabha
- Low Risk
- Moderate Risk
- High Risk

Legend row:

- Low Risk explanation
- Moderate Risk explanation
- High Risk explanation

Main table component is `YuvakTable`.

`YuvakTable` controls:

- search input
- All Status filter
- optional sabha filter when `showSabhaType` is true
- KK filter
- date window filter
  - Last 6 Sabhas
  - Last 1 Month
  - Last 3 Months
  - Custom Range
- custom from date
- custom to date
- filtered count summary

`YuvakTable` columns when dates are available:

- Status
- Name
- STD
- KK (Follow-Up Person)
- Sabha when enabled
- Last N Sabhas attendance dots
- Last 3 badge
- Last Sabha badge

`YuvakTable` columns when dates are not available:

- same leading columns
- attendance progress bar fallback

`YuvakTable` row content:

- Inline risk badge
- name text
- STD pill
- KK name
- sabha pill when enabled
- attendance dot strip
- last 3 summary badge
- last sabha present/absent badge

Pagination:

- page label
- Prev button
- Next button

#### `/kk-analysis`

Header:

- title `KK Analysis`
- subtitle showing CN, Kishor, Bal counts plus total unique KKs and yuvaks
- refresh button

Filter row:

- sabha switcher
  - CN
  - Kishor
  - Bal
- attending filter
  - currently only `Attending`

Per-sabha section content uses `KKSection` and includes:

- section header with accent bar
- badge with KK count and yuvak count
- KPI cards
  - Total KKs
  - Avg Yuvaks/KK
  - Overloaded KKs
- overloaded KKs alert strip if any KK has more than 6 yuvaks
- chart/table card containing `KKWorkloadChart`
- `Detailed KK Report` grid

Each detailed KK card shows:

- KK name
- total yuvaks
- horizontal active/attention bar
- active count
- attention count
- average attendance
- follow-up list for urgent yuvaks
  - yuvak name
  - attendance percentage
  - `StatusBadge`

#### `/kk-home`

Page access:

- only KK users can access
- non-KK users are redirected to `/`

Hero section:

- title `{KK Name} Bhai's Dashboard`
- area chip
- decorative gradient background and blurred accents

KPI strip:

- Total Yuvaks
- Active
- Deactive
- Avg Attendance
- Efficiency Score

Expandable KPI card behavior:

- Total/Active/Deactive cards can expand
- expanded list rows show
  - yuvak name
  - sabha label pill (`Kishor` or `Yuva`)
  - attendance percentage line

Charts and data blocks:

- `AttendanceTrendChart`
  - scoped to shared Kishor sabha sessions when full data is available
- note `Showing only {KK name} yuvaks`
- `VaktaTopicTrendChart`
  - supports comparison between personal yuvaks and overall sabha performance
  - scope toggle buttons are shown when comparison data exists

#### `/admin/users`

Header panel:

- title `User Management`
- subtitle `Create and manage user accounts and roles`
- `+ New User` button

KPI mini cards:

- Total Users
- KK Users
- Leaders
- Admins

Toolbar:

- search input for name/username/email/KK
- role filter select
- showing filtered count summary

Table columns:

- Name
- Username
- Email
- Role
- Assigned KK
- Joined
- Actions

Per-row behavior:

- role can be changed via select
- assigned KK can be edited for KK users
- assigned KK has Save button
- Delete action exists

Create user modal fields:

- Full Name
- Email
- Username
- Password
- Role
- Assigned KK when role is KK
- Cancel button
- Create User button

#### `/admin/logs`

Header:

- title `Login Activity`
- total events subtitle
- refresh button

Table columns:

- User
- Role
- Action
- IP
- Browser
- Time

Per-row content:

- user name
- user email
- colored role text
- action pill
- formatted IP
- browser derived from user agent
- formatted date/time

#### `/admin/sheet-changes`

Header:

- title `Sheet Change History`
- subtitle with total changes
- refresh button

Filter chips:

- All
- Added
- Removed
- Present
- Absent
- Field Updates

Table columns:

- Type
- Sabha
- Description
- Detected

Row content:

- change type pill with icon and tone
- sabha name with sabha-specific color
- description text
- detected timestamp

#### `/ai`

This route is implemented but hidden from the current sidebar.

Visible live UI:

- centered coming-soon card
- badge `Coming Soon`
- title `Ask Akshar is coming soon.`
- short description about future release

Commented hidden implementation inside the file includes:

- `Akshar` chat header
- starter prompt chips
- chat thread
- chart cards in assistant responses
- loading bubble
- input box and send button
- error banner

### Shared Component Details

#### `StatsCard`

Current visuals and content:

- title line
- optional icon badge on the right
- large value
- optional subtitle
- accent variants
  - orange
  - green
  - yellow
  - red
  - blue

#### `SabhaMetaPanel`

Current content:

- Vakta label and value
- Topic label and value
- compact and regular modes
- fallback text `Not added yet`

#### `StatusBadge`

Current behavior:

- renders label from status
- renders dot + pill styling
- supports `sm` and `md`

#### `AttendanceTrendChart`

Current controls:

- attendance mode selector
  - currently only `Attending` visible
  - non-attending and all modes exist in logic
- view selector
  - Total
  - Area Split
- range selector
  - 1M
  - 3M
  - 6M
  - All

Current chart metadata:

- title `{Sabha Label} - Attendance Trend`
- session count text
- average percentage pill
- tooltip can show
  - date
  - attendance numbers
  - vakta
  - topic
  - area split detail

#### `VaktaTopicTrendChart`

Current controls:

- range toggle
  - 1M
  - 3M
- optional scope toggle
  - primary data
  - comparison data

Current content below chart:

- highest attendance summary card
- lowest attendance summary card
- single-session fallback card when only one point exists

#### `KKWorkloadChart`

Current controls:

- KK search
- Area filter
- result count summary

Current table columns:

- KK Name
- Areas
- Total
- Active
- Moderate Risk
- At Risk
- Active %
- Absent Last Sabha

Sorting behavior:

- sorted by risk-heavy KKs first

### Current Loading, Error, And Empty States

Patterns currently used across the app:

- centered spinner for loading
- centered retry cards on fetch error
- empty cards/messages when no data is available
- many pages fall back to `null` if no data object exists
- tables show empty rows/messages when filters return no results

## Data And Chart Specification Appendix

This appendix captures the exact data fields, chart types, and date behavior used by the current implementation.

### Core Data Objects

#### `Yuvak`

Current fields in use across the UI:

- `name`
- `area`
- `phoneNumber`
- `dob`
- `followUpKK`
- `sabhaType`
- `std`
- `attendingSabha`
- `sabhasAttended`
- `attendancePercent`
- `superActive`
- `dateAttendance` as `Record<string, boolean>`
- `totalSabhas`

#### `ParsedSheetData`

Main API payload used by `useSheetData`:

- `yuvaks`
- `dates`
- `lastUpdated`
- `sabhaMeta`
- `sabhaSessionMeta`

#### `ReminderItem`

Fields used in reminders UI:

- `id`
- `reminderKey`
- `yuvakName`
- `phoneNumber`
- `followUpKK`
- `sabhaType`
- `riskLevel`
- `missedSabhaCount`
- `missedSabhaDates`
- `status`
- `requiresLeaderReview`
- `escalatedByName`
- `escalatedAt`
- `takenOverByName`
- `takenOverAt`
- `createdAt`
- `updatedAt`

#### `UpcomingEkadashi`

Fields used in the dashboard widget:

- `dateIso`
- `displayDate`
- `tithiName`
- `paksha`
- `daysUntil`
- `location`
- `timezone`
- `nextTen`

#### `KKStats`

Derived object used in KK views:

- `name`
- `yuvaks`
- `sabhaTypes`
- `greenCount`
- `yellowCount`
- `redCount`
- `avgAttendance`

#### `SabhaSessionStat`

Derived object used in trend charts:

- `date`
- `count`
- `percentage`
- `areaBreakdown`

### Date Logic Used In The App

#### Sheet date format

Dates in attendance data are treated as sheet-style strings such as:

- `4-Mar-26`
- `25-Feb-26`
- `4-Mar-2026`

#### `getPastDates(dates)`

Current behavior:

- filters the raw `dates` array to dates less than or equal to today
- supports both `DD-Mon-YY` and `DD-Mon-YYYY`
- used on dashboard and sabha pages to avoid future/unrecorded columns

#### `dateAttendance`

Attendance is stored per yuvak as a map:

- key = date string from sheet
- value = `true` or `false`

#### Recent risk windows used in the UI

The app uses these slices repeatedly:

- last 1 sabha
- last 2 sabhas
- last 4 sabhas
- last 6 sabhas in the directory table
- last 20 sessions in trend chart displays on some pages
- last 52 sessions in parts of the AYC screen logic
- last 30 days and 90 days in `VaktaTopicTrendChart`

### Status And Risk Logic

#### Sheet-driven status

`getAttendanceStatus(yuvak, dates)` currently behaves as:

- `green` when `superActive` is `true`
- `yellow` otherwise
- `red` is not currently returned by this helper in the live implementation

Displayed labels via `StatusBadge`:

- `green` -> `Active`
- `yellow` -> `Needs Attention`
- `red` -> `Not Attending`

#### Directory risk logic

`getDirectoryRiskStatus(yuvak, sortedDates)` behaves as:

- `red` if the yuvak missed the last 4 sabhas
- `yellow` if the yuvak missed the last 2 sabhas
- `green` otherwise

#### Page-level risk bucket logic

The Yuva, AYC, and Bal sabha pages build separate bucket lists based on:

- Low Risk = missed last 1 sabha
- Moderate Risk = missed last 2 sabhas
- High Risk = missed last 4 sabhas

### Polling And Refresh Behavior

#### `useSheetData`

- endpoint: `/api/sabha-data`
- full-scope endpoint: `/api/sabha-data?scope=full`
- auto-polls every `60,000 ms`
- request timeout around `55s`
- redirects to `/login` on `401`

#### `useReminders`

- endpoint: `/api/reminders`
- auto-polls every `60,000 ms`
- request timeout around `120s`
- redirects to `/login` on `401`

#### `useUpcomingEkadashi`

- endpoint: `/api/calendar/ekadashi`
- auto-polls every `6 hours`
- request timeout around `20s`

### Exact Table Columns And Their Data Sources

#### Dashboard `Area Segregation` table

Columns:

- `Area`
- `Yuva Sabha` -> `Yes`
- `Yuva Sabha` -> `No`
- `AYC Sabha` -> `Yes`
- `AYC Sabha` -> `No`
- `Bal Sabha` -> `Yes`
- `Bal Sabha` -> `No`

Cell data source:

- grouped from `yuvaks`
- grouped by `area`
- split by `sabhaType`
- each cell count is derived from `attendingSabha`

#### Dashboard `Status Audit` table

Columns:

- `Sabha`
- `Total`
- `Super Active Yes`
- `Super Active No`
- `Attending Yes`
- `Attending No`
- `Super Active Names`

Cell data source:

- per-sabha filtered `yuvaks`
- `superActive`
- `attendingSabha`
- sorted yuvak names

#### `YuvakTable`

Columns when `showSabhaType = true` and dates exist:

- `Status`
- `Name`
- `STD`
- `KK (Follow-Up Person)`
- `Sabha`
- `Last {N} Sabhas`
- `Last 3`
- `Last Sabha`

Columns when `showSabhaType = false` and dates exist:

- `Status`
- `Name`
- `STD`
- `KK (Follow-Up Person)`
- `Last {N} Sabhas`
- `Last 3`
- `Last Sabha`

Columns when there are no effective dates:

- leading columns above
- final `Attendance` progress column

Per-row data source:

- `Status` from `getDirectoryRiskStatus`
- `Name` from `yuvak.name`
- `STD` from `yuvak.std`
- `KK` from `yuvak.followUpKK`
- `Sabha` from `yuvak.sabhaType`
- dot strip from `yuvak.dateAttendance[date]`
- `Last 3` from last 3 effective dates
- `Last Sabha` from most recent active effective date
- `Attendance` fallback from `yuvak.attendancePercent`

#### `KKWorkloadChart` table

Columns:

- `KK Name`
- `Areas`
- `Total`
- `Active`
- `Moderate Risk`
- `At Risk`
- `Active %`
- `Absent Last Sabha`

Per-row data source:

- KK name from `kk.name`
- areas from unique `y.area`
- total from `kk.yuvaks.length`
- active from `kk.greenCount`
- moderate risk from missed-last-2 logic on `kk.yuvaks`
- at risk from missed-last-4 logic on `kk.yuvaks`
- active % from `greenCount / total`
- absent last sabha from `dateAttendance[lastDate]`

#### `/admin/users` table

Columns:

- `Name`
- `Username`
- `Email`
- `Role`
- `Assigned KK`
- `Joined`
- `Actions`

Per-row data source:

- `name`
- `username`
- `email`
- `role`
- `assignedKK`
- `createdAt`
- delete/update actions

#### `/admin/logs` table

Columns:

- `User`
- `Role`
- `Action`
- `IP`
- `Browser`
- `Time`

Per-row data source:

- `userName`
- `userEmail`
- `userRole`
- `action`
- `ipAddress`
- `userAgent`
- `createdAt`

#### `/admin/sheet-changes` table

Columns:

- `Type`
- `Sabha`
- `Description`
- `Detected`

Per-row data source:

- `changeType`
- `sabhaType`
- `description`
- `detectedAt`

### Exact Chart Types And Data Sources

#### Dashboard average attendance cards

Type:

- numeric summary cards, not charts

Data source:

- percentage average over the last 4 active sessions
- computed from `yuvaks` + `dateAttendance`

#### Dashboard session lists

Type:

- list rows with inline progress bars

Data source:

- `getLowestSessions(sessionTrend, n)`
- `getHighestSessions(sessionTrend, n)`
- session notes from `sabhaSessionMeta`

#### Sabha Breakdown chart on Yuva and Bal pages

Type:

- `Doughnut` chart from `react-chartjs-2`

Labels:

- `Low Risk`
- `Moderate Risk`
- `High Risk`

Dataset values:

- count of yuvaks in each risk bucket

Center label:

- total yuvak count for the current filtered sabha view

#### `AttendanceTrendChart`

Library/type:

- `Bar` chart from `react-chartjs-2`
- uses Chart.js `BarElement`

Base dataset:

- built from `SabhaSessionStat[]`
- each point has:
  - `date`
  - `count`
  - `percentage`
  - optional `areaBreakdown`

Supported visual modes in code:

- Attending total bars
- Non-attending bars
- Stacked Attending + Not Attending bars
- Area Split stacked bars

Current visible UI controls:

- only `Attending` mode button is rendered
- `Total` and `Area Split` view buttons are rendered
- range buttons `1M`, `3M`, `6M`, `All` are rendered

Date filtering behavior:

- 1M = now minus 1 month
- 3M = now minus 3 months
- 6M = now minus 6 months
- All = all supplied points

Tooltip data can include:

- session date
- attendance count
- attendance percentage
- non-attending count if that mode is used
- area count and percentage when in area split mode
- vakta from `sessionMetaByDate`
- topic from `sessionMetaByDate`

#### `VaktaTopicTrendChart`

Library/type:

- `Line` chart from `react-chartjs-2`
- uses Chart.js `LineElement` and `PointElement`

Point data per session:

- `date`
- `vakta`
- `topic`
- `attendanceCount`
- `attendancePct`

Rendered controls:

- range toggle `1M` and `3M`
- optional scope toggle when comparison data exists

Date filtering behavior:

- 1M = rolling last 30 days
- 3M = rolling last 90 days

Tooltip data includes:

- date
- attendance count over total
- attendance percentage
- vakta text
- topic text

Below-chart summary cards use:

- highest `attendancePct`
- lowest `attendancePct`
- single-session fallback when only one point exists

#### Dashboard and sabha session micro-bars

Type:

- inline width-based div bars

Data source:

- session `percentage`
- session `count`

### Date Display And Formatting Details

Current formats used in the app include:

- dashboard updated time: locale time in `en-IN` with hour and minute
- birthdays: `DD Mon`
- admin/log timestamps: `DD Mon YYYY, HH:MM`
- sheet history timestamps: `DD Mon YYYY, HH:MM`
- Ekadashi display date: server-provided `displayDate`
- attendance/session dates: sheet string values such as `4-Mar-26`

### Data Groupings Used By Current Screens

Current grouping strategies include:

- by `sabhaType`
- by `area`
- by `followUpKK`
- by recent date windows
- by `superActive`
- by `attendingSabha`
- by risk bucket from missed-sabha logic

### What Is Still Not Fully Enumerated In This MD

The document now covers current UI structure, table columns, chart types, date behavior, and data sources.
What it still does not list exhaustively line-by-line is:

- every single literal string in the UI
- every class name/style token in the implementation
- every toast message and fallback text on every branch
- every conditional render branch in every component

If needed, the next pass can turn this into a full implementation manifest with component-by-component prop maps and literal copy inventory.

## Tab View Manifest

This section rewrites tabbed pages in a stricter implementation-spec format.

### `/sabha/kishor` Tab Manifest

#### Tab: `Overview`

Purpose:

- Give leaders a high-level operational summary of AYC attendance, recent sessions, risk buckets, and KK performance.

Modules inside:

- `Follow-Up Risk Buckets` collapsible section
- `Recent Sabha Summary` cards
- KPI cards
- `STD breakdown` chips
- `AttendanceTrendChart`
- `VaktaTopicTrendChart`
- `Most Active KK` expandable card
- `Most Deactive KK` expandable card
- `Lowest Sessions` card
- `Best Sessions` card
- `Topic Planning Tip` card

Filters and controls used:

- attending filter (`yes` only currently rendered)
- refresh button
- risk bucket collapse toggle
- most active/deactive KK expand toggles

Primary data used:

- `kishorYuvaks`
- `activePastDates`
- `sabhaSessionMeta['Chirag Nagar(Kishor)']`
- `kkStats`
- derived risk buckets
- derived `predicted` attendance

#### Tab: `All Yuvaks`

Purpose:

- Show a searchable, filterable roster of all AYC yuvaks with attendance-risk context.

Modules inside:

- `YuvakTable`

Filters and controls used:

- inherited page attending filter
- internal `YuvakTable` search, status, KK, and date controls

Primary data used:

- `kishorYuvaks`
- `activePastDates`

#### Tab: `KK Performance`

Purpose:

- Rank KKs by active/deactive mix, attendance, and efficiency.

Modules inside:

- sortable KK ranking table
- `Per KK Efficiency Overview` card grid

Filters and controls used:

- sortable columns
  - name
  - total
  - active
  - deactive
  - deactivePct
  - avgAttendance
  - efficiencyScore

Primary data used:

- `kkPerformanceSorted`
- `kkByEfficiency`
- values derived from `kkStats`

#### Tab: `KK Workload`

Purpose:

- Show operational follow-up load distribution across KKs for AYC.

Modules inside:

- `KKWorkloadChart`

Filters and controls used:

- internal `KKWorkloadChart` search and area filter

Primary data used:

- `kkStats`
- `activePastDates`

### `/sabha/chirag-nagar` Tab Manifest

#### Tab: `Overview`

Purpose:

- Show Yuva Sabha health, session quality, risk segmentation, and action-oriented follow-up suggestions.

Modules inside:

- `Recent Sabha Summary` cards
- KPI cards
- `Sabha Breakdown` doughnut card
- `AttendanceTrendChart`
- `Follow-Up Risk Buckets` collapsible section
- `Lowest Sessions` card
- `Best Sessions` card
- action suggestion cards

Filters and controls used:

- refresh button
- risk bucket collapse toggle

Primary data used:

- `filteredYuvaks`
- `activePastDates`
- `riskBuckets`
- `stats.sessionTrend`
- `lowest`
- `highest`

#### Tab: `All Yuvaks`

Purpose:

- Show Chirag Nagar yuvak list with risk and recent attendance indicators.

Modules inside:

- `YuvakTable`

Primary data used:

- `filteredYuvaks`
- `activePastDates`

#### Tab: `KK Workload`

Purpose:

- Show Chirag Nagar KK-level workload and risk distribution.

Modules inside:

- `KKWorkloadChart`

Primary data used:

- `kkStats`
- `activePastDates`

### `/sabha/bal` Tab Manifest

#### Tab: `Overview`

Purpose:

- Show Bal Sabha attendance health, risk segmentation, and recent/best/worst sessions.

Modules inside:

- `Recent Sabha Summary` cards
- KPI cards
- `Sabha Breakdown` doughnut card
- `AttendanceTrendChart`
- `Follow-Up Risk Buckets` collapsible section
- `Lowest Sessions` card
- `Best Sessions` card

Filters and controls used:

- attending filter (`yes` only currently rendered)
- refresh button
- risk bucket collapse toggle

Primary data used:

- `balYuvaks`
- `activePastDates`
- `riskBuckets`
- `predicted`
- `lowest`
- `highest`

#### Tab: `All Yuvaks`

Purpose:

- Show Bal yuvak roster with attendance risk context.

Modules inside:

- `YuvakTable`

Primary data used:

- `balYuvaks`
- `activePastDates`

#### Tab: `KK Workload`

Purpose:

- Show Bal KK follow-up load and risk distribution.

Modules inside:

- `KKWorkloadChart`

Primary data used:

- `kkStats`
- `activePastDates`

### `/kk-analysis` View Manifest

This page is not tabbed, but behaves like a segmented multi-view workspace.

#### View: `CN`

Purpose:

- Show KK workload for Chirag Nagar Sabha.

Modules inside:

- `KKSection`
  - KPI cards
  - overloaded KK strip
  - `KKWorkloadChart`
  - detailed KK report grid

Primary data used:

- `cnKKStats`
- `cnActiveDates`

#### View: `Kishor`

Purpose:

- Show KK workload for Kishor Sabha.

Modules inside:

- `KKSection`
  - KPI cards
  - overloaded KK strip
  - `KKWorkloadChart`
  - detailed KK report grid

Primary data used:

- `kishorKKStats`
- `kishorActiveDates`

#### View: `Bal`

Purpose:

- Show KK workload for Bal Sabha.

Modules inside:

- `KKSection`
  - KPI cards
  - overloaded KK strip
  - `KKWorkloadChart`
  - detailed KK report grid

Primary data used:

- `balKKStats`
- `balActiveDates`

### `/yuvaks` View Manifest

This page is not tabbed, but the table behaves like a view-switching workspace through filters.

#### View controls available inside `YuvakTable`

Purpose:

- Let users pivot the roster by risk, sabha, KK, and time window without leaving the page.

Control groups:

- search by yuvak name
- status filter
- sabha filter
- KK filter
- date window selector
- custom date range selector
- table sorting
- pagination

Primary data used:

- `filteredYuvaks`
- `activePastDates`
- derived `effectiveDates`

### `/kk-home` View Manifest

This page is not tabbed, but it includes internal expandable and comparison views.

#### View: KPI expansion panels

Purpose:

- Let the KK inspect which yuvaks belong to total, active, and deactive groups.

Modules inside:

- expandable list in `Total Yuvaks`
- expandable list in `Active`
- expandable list in `Deactive`

Primary data used:

- `yuvaks`
- `activeYuvaks`
- `deactiveYuvaks`

#### View: Vakta/topic comparison toggle

Purpose:

- Compare the KK's yuvak performance against the full sabha performance.

Modules inside:

- `VaktaTopicTrendChart`
  - primary view
  - comparison view

Primary data used:

- `vaktaTopicTrend3m`
- `fullVaktaTopicTrend3m`

### `/ai` View Manifest

#### Live view: `Coming Soon`

Purpose:

- Placeholder for future assistant feature.

Modules inside:

- coming-soon hero card

#### Hidden commented view: `Akshar Chat`

Purpose:

- Conversational data assistant with chart-capable answers.

Modules inside:

- header
- starter prompts
- message thread
- chart cards
- loading state
- composer
