# Sabha Follow-up Automation System

# Overview

We conduct spiritual gatherings called **Sabha** multiple times a week based on age groups and areas.

Example:
- Chirag Nagar Sabha → Friday
- Chirag Nagar (Kishor) Sabha → Tuesday

Attendance is managed through a secure internal web application where:
- Every Sabha has its own Yuvaks
- Attendance is marked manually during Sabha
- Yuvaks are absent by default
- Every Yuvak has an assigned KK (Karyakarta)
- One KK can manage multiple Yuvaks
- Same KK can exist across multiple Sabhas

After every Sabha, multiple WhatsApp reports are manually created and sent in internal groups and to respective KKs.

This process is repetitive and time-consuming.

---

# Current Problems

## 1. Manual Repetitive Work


The reports and message formatting are already handled by the existing Sabha web application.

The application already:
- Generates formatted WhatsApp-ready messages
- Creates Sabha summaries
- Creates KK follow-up summaries
- Creates absent reports
- Generates individual KK follow-up messages

The only manual task remaining is:
- Clicking the WhatsApp send/share button for each generated message

---

# Actual Problem Statement

Currently after every Sabha:
1. Open Sabha system
2. Open generated report/message
3. Click WhatsApp icon/button
4. Select/send message
5. Repeat for:
   - Total absent report
   - Follow-up KK summary
   - Sabha summary
   - Individual KK messages

This process becomes repetitive because:
- Multiple messages need to be sent
- Same process repeats every Sabha
- Real-time follow-up during Sabha is difficult manually

---

# Refined Solution

Instead of generating messages manually, the automation system only needs to:

1. Login into Sabha web application
2. Open respective Sabha
3. Detect generated messages/reports
4. Click WhatsApp send/share buttons automatically
5. Repeat periodically during Sabha
6. Send final reports after Sabha completion

---

# Simplified Architecture

## 1. Browser Automation Layer

Use:
- Playwright

Responsibilities:
- Login into Sabha system
- Navigate through Sabha pages
- Detect WhatsApp buttons
- Click send/share buttons automatically
- Handle periodic refresh/checks

---

## 2. Scheduler Layer

Use:
- node-cron

Responsibilities:
- Start automation before Sabha
- Run checks periodically
- Send reports during Sabha
- Send final reports after Sabha

Example:
- Every 30 minutes during Sabha
- Final summary after Sabha ends

---

# Simplified Workflow

## During Sabha

Every 30 minutes:
1. Open Sabha page
2. Check latest attendance updates
3. Click WhatsApp send buttons for:
   - KK follow-up messages
   - Live absent reports

Purpose:
- Immediate follow-up by KKs

---

## After Sabha

Automatically:
1. Open final reports
2. Click WhatsApp send buttons for:
   - Total absent report
   - KK summary
   - Sabha summary
   - Individual KK reports

---

# Why This Approach Is Better

Since the existing system already:
- Handles formatting
- Generates messages
- Organizes attendance

The automation becomes much simpler because:
- No message generation logic required
- No formatting engine required
- No backend processing required

The system only automates user actions.

---

# Recommended Tech Stack

| Component | Technology |
|---|---|
| Browser Automation | Playwright |
| Runtime | Node.js |
| Language | TypeScript |
| Scheduling | node-cron |
| Deployment | VPS / Docker |

---

# Key Features

## 1. Session Persistence
Store login session so repeated login is not required.

---

## 2. Smart Selectors
Use stable selectors for:
- Sabha navigation
- WhatsApp buttons
- Report sections

---

## 3. Auto Retry
If click/send fails:
- Retry automatically
- Log error

---

## 4. Interval-Based Monitoring
Continuously monitor Sabha attendance during ongoing Sabha.

---


# Final Goal

The goal is not to rebuild the existing Sabha system.

The goal is to automate the repetitive manual actions already being performed inside the current system using browser automation.