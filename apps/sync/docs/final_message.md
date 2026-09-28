# Sabha Message Examples

This file contains sample message formats used in Sabha follow-up automation.

---

# 1. Total Absent Report

```txt
Sabha: Chirag Nagar
Date: 22-May-2026

❌ Absent Report
Total Absent: 54

👤 Ansh Maurya (5)
──────────────
Ganesh Korde
❌ Absent: 59
📞 Phone number

Harsh Tiwari
❌ Absent: 30
📞 Phone number

Hitarth Pandya
❌ Absent: 46
📞 Phone number

Mahesh Ghanchi
❌ Absent: 51
📞 Phone number

Piyush Patel
❌ Absent: 45
📞 Phone number


👤 Bharat Bhanushali (13)
──────────────
Chintan Patil
❌ Absent: 1
📞 Phone number

Dhruvil Bhanushali
❌ Absent: 2
📞 Phone number

Hitansh Mange
❌ Absent: 1
📞 Phone number

Lakshman Yadav
❌ Absent: 58
📞 Phone number

Mayuresh Jadhav
❌ Absent: 50
📞 Phone number
```

---

# 2. Follow-up Karyakarta Summary

```txt
Followups Karyakarta Summary
Sabha: Chirag Nagar
Date: 22-May-2026

Deepam Jethva 5/6
Dhanji Nor 12/13
Paras Patel 2/3
Nakul Patel 9/11
Dharmik Parmar 3/6
Dinesh Parmar 2/5
Shubh Dave 5/9
Ansh Maurya 5/10
Omkar Deshmukhe 2/7
Ramji Devda 9/16
Kalpit Desai 6/15
Bharat Bhanushali 8/21
```

---

# 3. Sabha Summary

```txt
Sabha Summary
Sabha: Chirag Nagar
Date: 22-May-2026

✅ Present : 68
👥 Strength : 122
```

---

# 4. Individual KK Message

```txt
Sabha: Chirag Nagar
Date: 22-May-2026

👤 Shubh Dave
──────────────
❌ Absents: 4

Kevin Vala
❌ Absent: 11
📞 Phone number

Mayank Shetty
❌ Absent: 25
📞 Phone number

Om Gajra
❌ Absent: 6
📞 Phone number

Tanishk Yadav
❌ Absent: 2
📞 Phone number
```

---

# Notes

## Meaning of "Absent: X"
The number represents how many times that Yuvak has remained absent.

Example:
```txt
❌ Absent: 11
```

Means:
- The Yuvak has been absent 11 times.

---

# Automation Goal

These messages will be:
- Generated automatically
- Formatted dynamically
- Sent through WhatsApp automatically
- Triggered periodically during and after Sabha