# Sabha Attendance Sync Automation System

# Overview

We conduct spiritual gatherings called **Sabha** multiple times a week based on age groups and areas.

Example:
- Chirag Nagar Sabha → Friday
- Chirag Nagar (Kishor) Sabha → Tuesday

Attendance is managed through a secure internal web application where:
- Every Sabha has its own Yuvaks
- Attendance is marked manually during Sabha
- Yuvaks are absent by default
- Present Yuvaks are marked as:
```txt
Attending Sabha = Yes
```

Each Yuvak also contains:
- Name
- Area
- Follow-Up KK
- Sabha
- Mobile Number
- Attendance %
- Historical attendance records

---

# Existing System

Currently, Sabha attendance is maintained in two places:

## 1. Sabha Web Application
This is the primary system where attendance is updated during Sabha.

---

## 2. Local Google Sheet
A separate Google Sheet is maintained for:
- Historical attendance tracking
- Attendance percentages
- Super Active Yuvak tracking
- Local record keeping

The Google Sheet contains:
- Yuvak details
- Weekly Sabha attendance columns
- Attendance analytics

Example columns:
```txt
6-Sep-20
13-Sep-20
20-Sep-20
27-Sep-20
```

Attendance is updated manually after Sabha.

---

# Current Manual Workflow

After Sabha completion:

## Step 1
Open Sabha attendance system.

---

## Step 2
Identify Yuvaks marked:
```txt
Attending Sabha = Yes
```

---

## Step 3
Open Google Sheet.

---

## Step 4
Search each Yuvak manually.

---

## Step 5
Find correct Sabha date column.

---

## Step 6
Mark attendance manually.

Example:
```txt
Yes
```


depending on sheet format.

---

# Problem

This process is repetitive because:
- Large number of Yuvaks
- Manual searching in sheet
- Manual attendance marking
- Time-consuming after every Sabha
- Possibility of human errors
- Duplicate/missed entries possible

---

# Proposed Solution

Build an automation system that:

1. Logs into Sabha web application
2. Opens Sabha attendance page
3. Extracts all present Yuvaks
4. Opens Google Sheet automatically
5. Finds matching Yuvak rows
6. Updates attendance for correct Sabha date
7. Saves sheet automatically

This automation will run automatically after Sabha completion.

---

# Important Observation

The Sabha system already provides:
- Attendance status
- Yuvak details
- Sabha information

So:
- No attendance calculation is required
- Only attendance synchronization is required

---

# Example Attendance Data

## Sabha System

| Yuvak | Attending Sabha |
|---|---|
| Rishi Sunil Soni | Yes |
| Aayush Sanjay Gupta | Yes |
| Shivam Kishor Chawda | No |

---

## Google Sheet Update

| Yuvak | 22-May-2026 |
|---|---|
| Rishi Sunil Soni | Yes |
| Aayush Sanjay Gupta | Yes |
| Shivam Kishor Chawda |  |

---

# Automation Workflow

## Night Automation Flow

```txt
Cron Job Trigger
        ↓
Login into Sabha System
        ↓
Open Sabha Attendance Page
        ↓
Extract Present Yuvaks
        ↓
Open Google Sheet
        ↓
Find Matching Rows
        ↓
Update Attendance Column
        ↓
Save Changes
        ↓
Generate Logs
```

---

# Recommended Architecture

## 1. Sabha Scraper Layer

Use:
- Playwright

Responsibilities:
- Login into Sabha system
- Navigate Sabha pages
- Extract Yuvaks marked:
```txt
Attending Sabha = Yes
```

---

## 2. Attendance Processing Layer

Responsibilities:
- Clean Yuvak names
- Remove duplicates
- Match sheet rows correctly
- Prepare attendance updates

---

## 3. Google Sheets Integration Layer

Use:
- Google Sheets API

Responsibilities:
- Open attendance sheet
- Detect correct Sabha date column
- Update attendance automatically
- Save changes

---

# Why Google Sheets API Is Better

Instead of:
```txt
Browser → Open Google Sheets → Type manually
```

Use:
```txt
Backend → Google Sheets API → Update directly
```

Benefits:
- Faster
- More reliable
- No UI dependency
- Easier maintenance
- Better scalability

---

# Matching Logic

## Primary Matching Field
- Yuvak Name

---

## Future Improvements
Possible additional matching:
- Mobile Number
- Unique Yuvak ID

---

# Scheduling

Use:
- node-cron

Example:
```txt
Tuesday → 11:30 PM
Friday → 11:30 PM
```

Automation runs automatically after Sabha completion.

---

# Recommended Tech Stack

| Component | Technology |
|---|---|
| Browser Automation | Playwright |
| Backend | Node.js |
| Language | TypeScript |
| Scheduler | node-cron |
| Google Integration | Google Sheets API |
| Deployment | VPS / Docker |

---

# Important Features

## 1. Duplicate Prevention
Prevent multiple attendance updates for same Sabha.

---

## 2. Name Normalization
Handle:
- Extra spaces
- Capitalization differences
- Small naming inconsistencies

---

## 3. Error Logging
Maintain logs for:
- Missing names
- Failed matches
- Google Sheet update failures

---

## 4. Dry Run Mode
Allow testing without updating actual sheet.

---

# Future Improvements

## 1. Auto Attendance Analytics
Automatically calculate:
- Attendance %
- Super Active Yuvaks
- Weekly attendance trends

---

## 2. Centralized Dashboard
Replace manual sheets completely.

---

## 3. Unified Sabha Management System
Single platform for:
- Attendance
- WhatsApp follow-up
- Analytics
- KK management
- Historical records

---

# Final Goal

The goal is to completely automate post-Sabha attendance synchronization between the Sabha system and local Google Sheets.

This system will:
- Remove repetitive manual work
- Improve attendance accuracy
- Reduce human errors
- Save time after every Sabha
- Keep local records automatically updated