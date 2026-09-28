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
- Present Yuvaks are marked using a checkbox
- If checkbox is checked → Present
- If checkbox is unchecked → Absent

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

# Existing System UI Reference

Reference screenshots/images of the current system UI and Google Sheet structure have also been provided.

The screenshots show:
- Sabha attendance table
- Yuvak list
- Attendance checkbox system
- Google Sheet structure
- Weekly attendance columns
- Attendance analytics columns

These references will help while building:
- Playwright selectors
- Scraping logic
- Attendance extraction logic
- Google Sheet mapping logic

---

# Current Web Application Flow

The Sabha system is login-based and secure.

## Step 1 — Open Login Page

Open:
```txt
[link]
```

---

## Step 2 — Enter Phone Number

The system first asks for:
```txt
Phone Number
```

The phone number will be stored inside:
```txt
.env
```

Example:
```env
PHONE_NUMBER=9876543210
```

Then click:
```txt
Next
```

---

## Step 3 — Enter Password

After clicking next, the system asks for:
```txt
4 Digit Password
```

This password will also be stored inside:
```txt
.env
```

Example:
```env
PASSWORD=1234
```

Then submit login.

---

## Step 4 — Home Page

After successful login, the user is redirected to the home page.

Home page contains multiple options such as:
- Birthday
- Pending Attendance
- Home
- Contact
- Attendance
- Other Sabha modules

---

## Step 5 — Open Hamburger Menu

Click the:
```txt
Hamburger Menu
```

---

## Step 6 — Open Attendance Section

Inside hamburger menu:
- Click:
```txt
Attendance
```

---

## Step 7 — Select Sabha

After opening attendance:
- Multiple Sabha options are visible

Example:
- Chirag Nagar
- Chirag Nagar (Kishor)
- Other Sabha

Automation should select:
```txt
Chirag Nagar (Kishor)
```

---

## Step 8 — Extract Attendance

After opening Sabha:
- List of Yuvaks becomes visible
- Every Yuvak has a checkbox

Logic:
```txt
Checkbox Checked   → Present
Checkbox Unchecked → Absent
```

Automation should:
- Extract all checked/present Yuvaks only

---

# Current Manual Workflow

After Sabha completion:

## Step 1
Open Sabha attendance system.

---

## Step 2
Open Sabha:
```txt
Chirag Nagar (Kishor)
```

---

## Step 3
Check which Yuvaks have checked checkboxes.

---

## Step 4
Open Google Sheet.

---

## Step 5
Search each Yuvak manually.

---

## Step 6
Find correct Sabha date column.

---

## Step 7
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
2. Navigates automatically to Sabha attendance page
3. Extracts all present Yuvaks
4. Matches Sabha date with Google Sheet date column
5. Finds matching Yuvak rows
6. Updates attendance automatically
7. Saves Google Sheet

This automation will run automatically after Sabha completion.

---

# Important Attendance Logic

## Sabha App Logic

```txt
Checkbox Checked   → Present
Checkbox Unchecked → Absent
```

Only checked Yuvaks should be synced to Google Sheet.

---

# Date Matching Logic

The Sabha date from:
```txt
Web Application
```

must match the corresponding date column inside:
```txt
Google Sheet
```

Example:

If Sabha date is:
```txt
22-May-2026
```

Then automation should:
- Find:
```txt
22-May-2026
```

column in Google Sheet
- Update only that column

---

# Example Attendance Flow

## Sabha App Data

| Yuvak | Checkbox |
|---|---|
| Rishi Sunil Soni | Checked |
| Aayush Sanjay Gupta | Checked |
| Shivam Kishor Chawda | Unchecked |

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
Open Sabha Login Page
        ↓
Enter Phone Number (.env)
        ↓
Click Next
        ↓
Enter 4 Digit Password (.env)
        ↓
Login Successfully
        ↓
Open Hamburger Menu
        ↓
Click Attendance
        ↓
Select Chirag Nagar (Kishor)
        ↓
Extract Checked Yuvaks
        ↓
Extract Sabha Date
        ↓
Open Google Sheet
        ↓
Find Matching Date Column
        ↓
Find Matching Yuvak Rows
        ↓
Update Attendance
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
- Login automation
- Navigation automation
- Checkbox extraction
- Sabha date extraction

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

# Environment Variables

Example:
```env
PHONE_NUMBER=9876543210
PASSWORD=1234
GOOGLE_SHEET_ID=xxxxx
```

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