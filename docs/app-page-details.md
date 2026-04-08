# Sabha Analytics Page Details

## What This App Is About

Sabha Analytics is a role-based attendance and follow-up dashboard for Sampark management. It helps admins, leaders, and KKs track Yuva, AYC, and Bal sabha participation, review attendance trends, identify yuvaks who need follow-up, monitor KK workload, check reminders and birthdays, and manage access through admin tools.

This file documents the content shown on each page in the app.

It intentionally focuses on page details, labels, data shown, tables, charts, filters, and dynamic values.
It does not document styling, spacing, or layout treatment.

## Data Notes

- Most analytics pages load Sabha data from `/api/sabha-data`.
- Data auto-refreshes every 60 seconds.
- Upcoming Ekadashi data loads from `/api/calendar/ekadashi` and refreshes every 6 hours.
- Reminder data loads from `/api/reminders` and refreshes every 60 seconds.
- Most counts and chart values are dynamic and come from the parsed Google Sheet data.

## App-Wide Elements

These elements appear on most authenticated pages because they are part of the shared app shell.

### Shared Sidebar / Navigation

- Desktop app title: `Sabha Analytics`
- Desktop subtitle: `Sampark Management`
- Version badge: `V1`
- Mobile header title: `Sabha Analytics`
- Mobile header version text: `Website V1`
- Footer text in sidebar: `Auto-refreshes every 60s`
- Theme toggle is available in desktop and mobile navigation.
- Logout button appears in sidebar footer.

### Navigation by Role

#### Leader navigation

- `AYC Sabha` -> `/sabha/kishor`
- `KK Analysis` -> `/kk-analysis`
- `Yuvak Directory` -> `/yuvaks`

#### Admin visible navigation

- `Dashboard` -> `/`
- `Yuva Sabha` -> `/sabha/chirag-nagar`
- `AYC Sabha` -> `/sabha/kishor`
- `Bal Sabha` -> `/sabha/bal`
- `KK Analysis` -> `/kk-analysis`
- `Yuvak Directory` -> `/yuvaks`
- `Ask Akshar` -> `/ai`

#### KK navigation

- `My Dashboard` -> `/kk-home`
- `My Yuvaks` -> `/yuvaks`

#### Admin-only extra navigation section

- `User Management` -> `/admin/users`
- `Login Activity` -> `/admin/logs`
- `Sheet History` -> `/admin/sheet-changes`

### Sidebar User Block

- Logged-in user name
- Role badge:
  - `Admin`
  - `Leader`
  - `KK`

### Shared Top Widgets

#### Follow-up reminders

- Section title: `Follow-up reminders`
- Count badge: shows total visible reminders
- Subtitle for admin/leader: `Leaders see every moderate and high risk follow-up item.`
- Subtitle for KK: `Your assigned follow-up reminders appear here first.`
- Leader/admin can filter by KK using a dropdown.
- Risk summary cards:
  - `High risk`
  - `Moderate risk`
- Each expanded reminder item shows:
  - yuvak name
  - KK name
  - missed sabha count
  - phone number
  - `Call` action if phone exists
- In full variant, each reminder can also show:
  - risk badge
  - fixed sabha chip currently labeled `Kishor`
  - missed sabha dates
  - escalation info
  - takeover info
  - status badge
  - `Leader review` badge when required

#### Upcoming birthdays

- Section title: `Upcoming birthdays`
- Subtitle: `Next 30 days`
- Currently limited to Kishor yuvaks only
- Each birthday item shows:
  - yuvak name
  - birthday date in `DD Mon` format
  - KK name if present
  - call icon if phone exists
  - day badge:
    - `Today`
    - `Tomorrow`
    - or `<Nd>`
- If more than 2 birthdays exist:
  - collapsed button: `Show <N> more`
  - expanded button: `Show less`

## `/login`

### Access / behavior

- Redirects to `/` if user session already exists.
- Reads optional `next` query param and uses it as callback URL if it starts with `/`.

### Page content

- Eyebrow text: `Sabha Analytics`
- Main heading: `Secure access for your Sabha dashboard.`
- Supporting text: `Sign in with your admin username to view attendance analytics, KK insights, and the Akshar assistant across desktop and mobile.`
- Card heading: `Login`
- Card text: `Use your username and password to continue.`

### Login form fields and actions

- `Username`
- `Password`
- Password visibility toggle:
  - `Show password`
  - `Hide password`
- Validation error:
  - `Username and password are required.`
- Submit button:
  - `Login`
  - `Signing in...`
- Error box shows auth error message when login fails.

## `/`

### Page title block

- Title: `Sabha Dashboard`
- Subtitle: `Overview of Yuva, AYC, and Bal sabha attendance`

### Header right-side content

- `Upcoming Ekadashi` card
- `Updated: <time>`
- `Refresh` button

### Upcoming Ekadashi card content

- Label: `Upcoming Ekadashi`
- Shows:
  - `displayDate`
  - `tithiName`
  - `paksha`
  - relative text:
    - `Today`
    - or `In <N> day` / `In <N> days`
- Loading state text: `Loading...`
- Fallback/error text may show:
  - `Prokerala is in test mode (Jan 1 only). Add Live credentials to enable upcoming Ekadashi.`
  - `Upcoming Ekadashi is temporarily unavailable. Please refresh in a minute.`
  - other returned error text
  - `Unavailable right now`

### Top stat cards

- `Total Yuvaks`
  - value: total yuvak count across all sabhas
  - subtitle: `All three sabhas combined`
- `Active`
  - value: count of yuvaks where `superActive = true`
  - subtitle: `<percentage>% of total`
- `Needs Attention`
  - value: count of yuvaks where `superActive = false`
  - subtitle: `Absent last 4 sabhas`
- `Overall Yuvaks`
  - value: total yuvaks
  - badges:
    - `Attending: <count>`
    - `Non-attending: <count>`

### Last 4 Sabha Average Attendance

- Section title: `Last 4 Sabha Average Attendance`
- Section note: `Hover on a card for latest session, sessions used, and yuvak coverage.`
- Cards shown:
  - `Overall`
  - `CN`
  - `AYC`
  - `Bal`
- Each card shows:
  - average attendance percentage across the last 4 recorded sessions
  - text: `Based on last <N> recorded sessions`
- Hover details for overall card:
  - `Overall Last-4 Snapshot`
  - latest session date
  - sessions used
- Hover details for sabha cards:
  - `<ShortLabel> Last-4 Snapshot`
  - latest session date
  - sessions used
  - `Yuvaks considered: <count>`

### Per-sabha summary cards

One card each for:

- `Chirag Nagar Sabha`
- `AYC Sabha`
- `Bal Sabha`

Each card shows:

- sabha subtitle from config:
  - `STD 13+ · Senior gathering`
  - `STD 9-12 · Youth gathering`
  - `Bal karyakar and attendance`
- short chip:
  - `CN`
  - `AYC`
  - `Bal`
- three numbers:
  - `Total`
  - `Avg Att. (Last 4)`
  - `Expected`
- two mini badges:
  - `<count> active`
  - `<count> attention`
- Sabha meta panel:
  - `Last Sabha Vakta`
  - `Last Sabha Topic`
  - default value if missing: `Not added yet`

### Area Segregation

- Section title: `Area Segregation`
- Subtitle: `Attending and non-attending counts by area and sabha type`
- Badge: `Auto updates from sheet`

#### Table columns

- `Area`
- `Yuva Sabha`
  - `Yes`
  - `No`
- `AYC Sabha`
  - `Yes`
  - `No`
- `Bal Sabha`
  - `Yes`
  - `No`

#### Table rows

- one row per area
- final `Total` row sums all areas

### Status Audit (Raw Parsed Values)

- Section title: `Status Audit (Raw Parsed Values)`
- Subtitle: `Use this to verify sheet filter counts vs app counts.`

#### Table columns

- `Sabha`
- `Total`
- `Super Active Yes`
- `Super Active No`
- `Attending Yes`
- `Attending No`
- `Super Active Names`

#### Table rows

- one row each for:
  - `Yuva Sabha`
  - `AYC Sabha`
  - `Bal Sabha`

### Highest / Lowest Attendance Sessions

Two sections:

- `Lowest Attendance Sessions`
  - subtitle: `Overall across Yuva, AYC, and Bal`
- `Highest Attendance Sessions`
  - subtitle: `Overall across Yuva, AYC, and Bal`

Each row shows:

- session date
- session note if available:
  - `<sabha short label> • Vakta: <name> • Topic: <topic>`
- fallback note: `Vakta/Topic not available for this session date`
- count and percentage: `<count> (<percentage>%)`

### KK Performance by Sabha

Section title: `KK Performance by Sabha`

For each sabha (`Yuva Sabha`, `AYC Sabha`, `Bal Sabha`) there is one block with:

- sabha label
- short chip (`CN`, `AYC`, `Bal`)

Each block contains two cards:

#### Most Active KK

- title: `Most Active KK`
- subtitle: `Best follow-up attendance performance (Last 4 Sabha)`
- shows:
  - KK name
  - `Follow-up yuvaks: <count>`
  - `<avgAttendanceLast4>%`
  - `Avg attendance (Last 4 Sabha)`
  - `<greenCount> active`
  - `<yellowCount> attention`
  - note: `Follow-up yuvak list (with attendance)`
  - note: `% is based on last 4 sabha: <date1>, <date2>, ...`
  - list of yuvak names with last-4 percentage
- empty state: `No KK data available.`

#### Most Deactive KK

- title: `Most Deactive KK`
- subtitle: `Lowest follow-up attendance performance (Last 4 Sabha)`
- shows the same fields as above, but sorted by lowest last-4 attendance

### KK Follow-Up Summary

- Section title: `KK Follow-Up Summary`
- Subtitle: `Top KKs by yuvak count`
- Shows top 10 KKs by yuvak count

Each row shows:

- KK name
- `<count> yuvaks · avg <attendance>%`
- active count badge
- attention count badge

## `/yuvaks`

### Page title block

- Title: `Yuvak Directory`
- Subtitle: `All yuvaks across all sabhas with attendance status`

### Page-level controls

- Attending filter currently only exposes:
  - `Attending`
- `Refresh` button

### Stat cards

- `Total Yuvaks`
- `Chirag Nagar`
- `Kishor Sabha`
- `Bal Sabha`
- `Low Risk`
- `Moderate Risk`
- `High Risk`

### Risk legend text

- `Low Risk (Green) — Attended the last sabha, or did not miss the last 2 sabhas`
- `Moderate Risk (Yellow) — Missed the last 2 sabhas`
- `High Risk (Red) — Missed the last 4 sabhas`

### Yuvak table shared behavior

This same table component is reused on multiple pages.

#### Filters

- Search input placeholder: `Search yuvak name...`
- Status dropdown:
  - `All Status`
  - `Low Risk`
  - `Moderate Risk`
  - `High Risk`
- Sabha dropdown when enabled:
  - `All Sabhas`
  - `Chirag Nagar`
  - `AYC`
  - `Bal`
- KK dropdown:
  - `All KKs`
  - plus one option per KK name
- Date window dropdown:
  - `Last 6 Sabhas`
  - `Last 1 Month`
  - `Last 3 Months`
  - `Custom Range...`
- Custom range fields:
  - from date
  - to date
- Filter summary: `<filtered> of <total> yuvaks`

#### Table columns when date data exists

- `Status`
- `Name`
- `STD`
- `KK (Follow-Up Person)`
- `Sabha` when enabled on that page
- `Last <N> Sabhas`
- `Last 3`
- `Last Sabha`

#### Table columns when date data does not exist

- `Status`
- `Name`
- `STD`
- `KK (Follow-Up Person)`
- `Sabha` when enabled
- `Attendance`

#### Cell details

- Status badge values:
  - `Low Risk`
  - `Moderate Risk`
  - `High Risk`
- STD cell:
  - `Std <value>`
  - or `—`
- Sabha chip values:
  - `CN`
  - `AYC`
  - `Bal`
- Last sabha status:
  - `Present`
  - `Absent`
- Last 3 badge format:
  - `<count>/<3>`
- Last N sabhas display:
  - colored attendance dots
  - summary `<count>/<N>`

#### Sorting

- sortable columns:
  - `Status`
  - `Name`
  - `KK (Follow-Up Person)`
  - `Attendance` fallback mode

#### Pagination

- page size: 20
- buttons:
  - `Prev`
  - `Next`
- label: `Page <current> of <total>`

#### Empty state

- `No yuvaks found matching the current filters.`

## `/kk-analysis`

### Page title block

- Title: `KK Analysis`
- Subtitle includes:
  - `Follow-up KK workload across all sabhas`
  - `<CN count> CN KKs`
  - `<Kishor count> Kishor KKs`
  - `<Bal count> Bal KKs`
  - `<unique KK count> unique KKs`
  - `<yuvak count> yuvaks`

### Controls

- `Refresh` button
- Sabha filter buttons:
  - `CN`
  - `Kishor`
  - `Bal`
- attending filter currently only:
  - `? Attending`

### Selected sabha section

Depending on selected tab, title is one of:

- `Chirag Nagar Sabha — KK Workload`
- `Kishor Sabha — KK Workload`
- `Bal Sabha — KK Workload`

### Section stat cards

- `Total KKs`
  - subtitle: `in this sabha`
- `Avg Yuvaks/KK`
  - subtitle: `per KK on average`
- `Overloaded KKs`
  - subtitle: `more than 6 yuvaks`

### Heavy follow-up load alert

- Appears only when overloaded KKs exist
- Title: `KKs with Heavy Follow-Up Load`
- Each chip: `<KK name> (<count> yuvaks)`

### KK workload table

This uses the shared `KKWorkloadChart` component.

#### Intro text

- `Each row below is one KK (follow-up coordinator) with summary counts. Risk buckets use the last 2 / last 4 sabhas.`

#### Filters

- KK search placeholder: `Search KK name...`
- area filter:
  - `All Areas`
  - plus one option per area
- result label: `<filtered> of <total> KKs`

#### Table columns

- `KK Name`
- `Areas`
- `Total`
- `Active`
- `Moderate Risk`
- `At Risk`
- `Active %`
- `Absent Last Sabha`

### Detailed KK Report

- Section title: `Detailed KK Report`
- right-side summary: `<KK count> KKs · <total yuvaks> yuvaks`

Each KK card shows:

- KK name
- total yuvaks
- active/attention bar
- `<greenCount> active`
- `<yellowCount> attention`
- `avg <avgAttendance>%`
- optional follow-up sub-list:
  - title: `Needs follow-up (<count>):`
  - rows with yuvak name
  - attendance percentage
  - status badge
  - `+<N> more` when more than 6 rows exist

## `/sabha/chirag-nagar`

### Page title block

- Title: `Chirag Nagar Sabha`
- Subtitle: `Std 13 & Above · Chirag Nagar`
- `Refresh` button

### Risk legend

- `Low Risk = missed last 1 sabha`
- `Moderate Risk = missed last 2 sabhas`
- `High Risk = missed last 4 sabhas`

### Tabs

- `Overview`
- `All Yuvaks`
- `KK Workload`

### Overview tab

#### Recent sabha summary cards

- up to 2 cards:
  - `Most Recent Sabha`
  - `2nd Most Recent Sabha`
- each card shows:
  - date
  - attendance count as `<count>/<total>`
  - `Attendance`
  - `Vakta`
- empty state:
  - `Recent Sabha Summary`
  - `No recent sabha attendance data is available yet.`

#### Stat cards

- `Total Yuvaks`
  - subtitle: `in this sabha`
- `Active`
  - subtitle: `last 4 sabha yes (sheet)`
- `At Risk`
  - subtitle: `last 4 sabha no (sheet)`
- `Last Sabha ?`
  - value format: `<lastSabhaCount>/<totalCount>`
  - subtitle: `<date> · <percentage>% showed up`

#### Sabha Breakdown donut

- Title: `Sabha Breakdown`
- datasets:
  - `Low Risk`
  - `Moderate Risk`
  - `High Risk`
- center label:
  - total count
  - `Total`
- legend rows show count and percentage for each risk bucket

#### Attendance Trend chart

- Title format: `Chirag Nagar - Attendance Trend`
- Average badge: `Avg <N>%`
- mode control currently only:
  - `Attending`
- view toggle:
  - `Total`
  - `Area Split`
- range toggle:
  - `1M`
  - `3M`
  - `6M`
  - `All`
- subtitle: `<N> sessions shown`
- tooltip data includes:
  - date
  - attendance count and percentage
  - vakta
  - topic
  - area split rows when in area split view

#### Follow-Up Risk Buckets

- collapsible section title: `Follow-Up Risk Buckets`
- note: `Grouped by consecutive missed sabhas. Each yuvak appears in only one bucket.`
- button toggles:
  - `Show list`
  - `Hide list`

Three buckets:

- `Low Risk`
  - subtitle: `Missed the last 1 sabha`
- `Moderate Risk`
  - subtitle: `Missed the last 2 sabhas`
- `High Risk`
  - subtitle: `Missed the last 4 sabhas`

Each item shows:

- yuvak name
- `Follow-up: <KK>`

Empty bucket message:

- `No yuvaks in this bucket`

#### Lowest / Best Sessions

- `Lowest Sessions`
  - subtitle: `Check for exams, festivals, or other conflicts`
- `Best Sessions`
  - subtitle: `Highest attendance sessions`

Each row shows:

- date
- `Vakta: <value or Not added>`
- `Topic: <value or Not added>`
- `<count> (<percentage>%)`

#### Action suggestion cards

- `At Risk — Recoverable`
  - explains at-risk yuvaks
  - badge: `High`
  - button: `View <count> yuvaks ?`
- `Attending Regularly`
  - explains active yuvaks
  - retention badge with percentage
  - button: `View <count> yuvaks ?`

### All Yuvaks tab

- Uses shared yuvak table without sabha column

### KK Workload tab

- Title: `KK Workload — Chirag Nagar Sabha`
- Subtitle: `Active / At Risk based on sheet (last 4 sabha)`
- Uses shared KK workload table

## `/sabha/kishor`

### Page title block

- Leader greeting line: `<LeaderName> Bhai`
- Title: `AYC Sabha`
- Subtitle: `STD 9 to 12 · Kishor Sabha`
- Expected badge: `<predicted>% expected next sabha`
- Info tooltip title text: `Calculates based on last 4 sessions.`
- attending filter currently only:
  - `? Attending`
- `Refresh` button

### Risk legend

- same three risk labels as Chirag Nagar page

### Tabs

- `Overview`
- `All Yuvaks`
- `KK Performance`
- `KK Workload`

### Overview tab

#### Follow-Up Risk Buckets

- same structure as Chirag Nagar page

#### Recent sabha summary

- same 2-card structure:
  - `Most Recent Sabha`
  - `2nd Most Recent Sabha`

#### Stat cards

- `Total Yuvaks`
  - subtitle: `in AYC sabha`
- `Active`
  - subtitle: `last 4 sabha yes (sheet)`
- `At Risk`
  - subtitle: `last 4 sabha no (sheet)`
- `Last Sabha ?`
  - subtitle: `<date> · <percentage>%`

#### STD breakdown

- label: `By STD:`
- chips format: `STD <std>: <count> yuvaks`

#### Attendance Trend chart

- same chart controls as other sabha pages
- title format: `AYC Sabha - Attendance Trend`
- receives session meta so tooltip includes vakta and topic

#### Vakta & Topic Performance chart

- section title:
  - `Vakta & Topic Performance (Last 1 Month)`
  - or `Vakta & Topic Performance (Last 3 Months)`
- subtitle: `Attendance trend by each sabha session`
- range buttons:
  - `1M`
  - `3M`
- average badge: `Avg <N>%`
- tooltip shows:
  - date
  - attendance count / total
  - attendance percentage
  - vakta
  - topic
- summary cards:
  - `Highest Attendance`
  - `Lowest Attendance`
- if only one point exists:
  - `Only Session In Selected Range`

#### Most Active KK / Most Deactive KK summary cards

- `Most Active KK`
  - shows KK name
  - `Active: <count> / <total>`
  - toggle badge:
    - `Show list`
    - `Hide list`
  - expanded content heading: `Yuvaks`
- `Most Deactive KK`
  - shows KK name
  - `Deactive: <count> / <total> (<percentage>%)`
  - same toggle behavior and yuvak list

#### Lowest / Best Sessions

- `Lowest Sessions`
  - subtitle: `From last 52 sabhas · check for exams, festivals, or other conflicts`
- `Best Sessions`
  - subtitle: `From last 52 sabhas · highest attendance sessions`

#### Topic Planning Tip

- Title: `Topic Planning Tip for AYC Sabha`
- Describes suggested topic focus for STD 9-12 and exam season impact
- Ends with current average attendance if available

### All Yuvaks tab

- Uses shared yuvak table without sabha column

### KK Performance tab

- Title: `KK Performance Ranking`
- Subtitle: `Click any column header to sort. Click again to reverse order.`

#### Ranking table columns

- `Rank`
- `KK Name`
- `Total`
- `Active`
- `Deactive`
- `Deactive %`
- `Avg Attendance`
- `Efficiency`

#### Row details

- rank format: `#<index>`
- deactive % badge thresholds:
  - red at 60% and above
  - yellow at 35% and above
  - green below 35%
- efficiency badge thresholds:
  - green at 70 and above
  - yellow at 45 and above
  - red below 45

#### Per KK Efficiency Overview

- title: `Per KK Efficiency Overview`
- subtitle: `Efficiency score = 70% active rate + 30% average attendance.`
- each card shows:
  - KK name
  - efficiency score badge
  - progress bar
  - `Active`
  - `Deactive`
  - `Attendance`

### KK Workload tab

- Title: `KK Workload — Kishor Sabha`
- Subtitle: `Active / At Risk based on sheet (last 4 sabha)`
- Uses shared KK workload table

## `/sabha/bal`

### Page title block

- Title: `Bal Sabha`
- Subtitle: `Attendance overview for Bal Sabha`
- expected badge: `<predicted>% expected next sabha`
- attending filter currently only:
  - `? Attending`
- `Refresh` button

### Risk legend

- same three risk labels as other sabha pages

### Tabs

- `Overview`
- `All Yuvaks`
- `KK Workload`

### Overview tab

#### Recent sabha summary cards

- `Most Recent Sabha`
- `2nd Most Recent Sabha`

#### Stat cards

- `Total Yuvaks`
  - subtitle: `in Bal sabha`
- `Active`
  - subtitle: `last 4 sabha yes (sheet)`
- `At Risk`
  - subtitle: `last 4 sabha no (sheet)`
- `Last Sabha ?`
  - subtitle: `<date> · <percentage>%`

#### Sabha Breakdown donut

- same structure as Chirag Nagar page

#### Attendance Trend chart

- title format: `Bal Sabha - Attendance Trend`
- same controls:
  - `Attending`
  - `Total`
  - `Area Split`
  - `1M`
  - `3M`
  - `6M`
  - `All`

#### Follow-Up Risk Buckets

- same 3-bucket structure as Chirag Nagar and Kishor pages

#### Lowest / Best Sessions

- `Lowest Sessions`
  - subtitle: `Lowest tracked Bal attendance`
- `Best Sessions`
  - subtitle: `Highest tracked Bal attendance`

### All Yuvaks tab

- Uses shared yuvak table without sabha column

### KK Workload tab

- Title: `KK Workload — Bal Sabha`
- Subtitle: `Active / At Risk based on sheet (last 4 sabha)`
- Uses shared KK workload table

## `/kk-home`

### Access / behavior

- Only for role `kk`
- Non-KK users are redirected away

### Header card

- Title: `<KK Name> Bhai's Dashboard`
- area badge: primary area name for this KK

### Stat section

Cards:

- `Total Yuvaks`
  - subtitle: `assigned to you`
  - expandable list of assigned yuvaks
- `Active`
  - subtitle: `super active`
  - expandable list of active yuvaks
- `Deactive`
  - subtitle: `need follow-up`
  - expandable list of deactive yuvaks
- `Avg Attendance`
  - subtitle: `overall`
- `Efficiency Score`
  - subtitle: `70% active + 30% attendance`

### Expanded stat card list item content

Each yuvak row shows:

- yuvak name
- sabha chip:
  - `Kishor`
  - or `Yuva`
- text: `<SheetLabel> - <attendancePercent>% attendance`

### Attendance Trend chart

- Uses shared attendance trend chart
- Currently aligned to full sabha sessions for Kishor/AYC comparison view consistency

### Scope note

- Text below chart: `Showing only <KK Name> yuvaks`

### Vakta & Topic Performance chart

- Supports comparison mode
- scope toggle buttons:
  - `Your Yuvak Performance`
  - `Sabha Performance`
- scope note: `Use toggle to compare your yuvaks vs overall sabha.`
- same 1M / 3M controls and tooltip details as Kishor page chart

## `/ai`

### Current live page

- Badge: `Coming Soon`
- Title: `Ask Akshar is coming soon.`
- Supporting text: `This feature will be introduced in a future update after the website release.`

### Commented future chat UI in source

The source also contains a commented future implementation for a chat assistant.
Planned visible elements in that code include:

- page title: `Akshar`
- subtitle: `Your in-app Sabha data assistant for full dataset queries, trends, summaries, and charts.`
- badge: `Data-only mode`
- starter prompts:
  - `Summarize last 3 months Chirag Nagar data.`
  - `Show monthly attendance trend chart for Chirag Nagar for 3 months.`
  - `Give status breakdown for Chirag Nagar and Kishor for last 3 months.`
- initial assistant greeting
- chat bubbles for user and assistant
- chart cards rendered inside assistant replies
- input placeholder: `Ask anything across the full Sabha dataset (both sabhas, yuvaks, KKs, trends) ...`
- send button:
  - `Send`
  - `Working...`

## `/admin/users`

### Access / behavior

- Admin only

### Header

- Title: `User Management`
- Subtitle: `Create and manage user accounts and roles`
- action button: `+ New User`

### Summary cards

- `Total Users`
- `KK Users`
- `Leaders`
- `Admins`

### Search and filters

- search placeholder: `Search by name, username, email, KK...`
- role filter:
  - `All Roles`
  - `KK`
  - `Leader`
  - `Admin`
- result label: `Showing <filtered> of <total>`

### User table columns

- `Name`
- `Username`
- `Email`
- `Role`
- `Assigned KK`
- `Joined`
- `Actions`

### Row actions

- role dropdown for editable users:
  - `KK`
  - `Leader`
  - `Admin`
- assigned KK dropdown for KK users
- `Save` assigned KK button
- `Reset Password`
- `Delete`

### Empty state

- `No users match your search or role filter.`

### Create New User modal

- Title: `Create New User`
- fields:
  - `Full Name`
  - `Email`
  - `Username`
  - `Password`
  - `Role`
  - `Assigned KK Name` when role is KK
- buttons:
  - `Cancel`
  - `Create User`
  - `Creating...`

### Reset Password modal

- Title: `Reset Password`
- shows user name and username/email
- fields:
  - `New Password`
  - `Confirm Password`
- buttons:
  - `Cancel`
  - `Update Password`
  - `Saving...`

## `/admin/logs`

### Access / behavior

- Admin only

### Header

- Title: `Login Activity`
- subtitle: `<total> total login event(s) recorded`
- `Refresh` button

### Table columns

- `User`
- `Role`
- `Action`
- `IP`
- `Browser`
- `Time`

### Row details

- user cell:
  - user name
  - user email
- role text
- action badge formatted as `? <action>`
- browser label simplified to:
  - `Chrome`
  - `Firefox`
  - `Safari`
  - `Edge`
  - or truncated user agent

### Empty state

- `No activity logs yet.`

## `/admin/sheet-changes`

### Access / behavior

- Admin only

### Header

- Title: `Sheet Change History`
- subtitle: `Changes detected automatically on each data refresh · <total> total change(s)`
- `Refresh` button

### Filter chips

- `All`
- `Added`
- `Removed`
- `Present`
- `Absent`
- `Field Updates`

### Table columns

- `Type`
- `Sabha`
- `Description`
- `Detected`

### Change type badges

- `Added`
- `Removed`
- `Present`
- `Absent`
- `Field Updated`

### Empty / error states

- `No changes recorded yet.`
- note: `Changes are detected automatically each time the sheet data refreshes (every 60s).`
- error title: `Failed to load change history`

## Access / Redirect Rules Summary

- `/login`: redirects authenticated users to `/`
- `/sabha/*`: KK users are redirected to `/kk-home`
- `/kk-home`: non-KK users are redirected to `/`
- `/admin/users`: admin only
- `/admin/logs`: admin only
- `/admin/sheet-changes`: admin only
