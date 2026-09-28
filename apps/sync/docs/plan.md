# The Base Flow

We have spritual gathering two a week and it happend on bases of age. 
For example we have Chirag Nagar and Chirag Nagar (Kishor). The Chirag Nagar Kishor happens every tuseday and Chirag Nagar happend on Friday, so we maintain a track record on one of our web app of who is present, what's the total strength
etc.

This gathering or foram we called it sabha

There are few Kariyakarta that have responsibity of yuvaks to call and make them attend this sabha.
KK can be common in both . After every sabha we can send a total report in our internal whatsapp grp about how many where absent, thier names, tier phone number and respective KK whoes is givig me folloup. KK can have multiple yuvaks under him
plus we also share two more thing one the sabha summary and follow up kk summary. I will share an example of all three messages so you get more understanding how it looks. In our web app, we have a separate Sabha, and if you open one of Sabha, we will know the respected yvarks who are regularly attending the Sabha. We mark a yuvak as if he is present in sabha and if not he is already absent by default

#  The problem 

After each sabha i need to send that 3 messages manually and also the message of absented yuvaks to that respective kk too so this is repitative task. Many a times i also need to send report in between of on-going sabha so that a kk knows his yuvaks is present or not so that he can gave follow up him immedirte in sabha and aks him to come.

# The Solution

The system we are using is secure and login base and user of the app has access to his own sabha only so what i was thinking is to automate this system using tools like playwrite which can login on behalf of we scrap the information click the button and send to it. This happend continues on between some period at intervals. we can set this by using cron jobs  

# The examples

`[message.md]` has a messages example of how each message looks when send to grp 