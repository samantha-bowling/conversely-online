# Pre-Launch Manual Test Checklist

**Purpose:** Verify critical user flows work end-to-end  
**When to Run:** Before every production deployment  
**Duration:** ~15 minutes

---

## Setup

- [ ] Open 2 browser windows (Chrome Incognito + Firefox Private)
- [ ] Both windows: Navigate to https://conversely.lovable.app (or staging URL)
- [ ] Open DevTools Console in both windows (check for errors)

---

## Test Flow: Happy Path

**Estimated Duration:** 12 minutes

### 🚪 Step 1: Landing & Age Gate (2 min)
**Window 1 (User A):**
- [ ] Page loads without errors
- [ ] Age gate dialog visible
- [ ] Click "I'm 18 or older"
- [ ] **[P0 BLOCKER]** Redirected to `/survey`

**Window 2 (User B):**
- [ ] Repeat same steps
- [ ] **[P0 BLOCKER]** Both reach survey page

---

### 📋 Step 2: Survey Completion (3 min)
**Window 1 (User A):**
- [ ] Username/avatar displayed at top (format: AdjectiveNoun + emoji)
- [ ] Answer Question 1 (any option)
- [ ] Click "Next"
- [ ] Repeat for Questions 2-3
- [ ] Answer Question 4
- [ ] Click "Submit"
- [ ] **[P0 BLOCKER]** Redirected to `/matching`

**Window 2 (User B):**
- [ ] Complete survey with **different answers** than User A
- [ ] **[P0 BLOCKER]** Both reach matching page

---

### 🔍 Step 3: Matching (2 min)
**Both Windows:**
- [ ] **Window 1:** Click "Start Conversation"
- [ ] **Window 2:** Click "Start Conversation" (within 5 seconds of Window 1)
- [ ] **[P0 BLOCKER]** Both redirected to `/chat/:roomId` within 30 seconds
- [ ] Verify both windows show **same room ID** in URL

---

### 💬 Step 4: Message Exchange (4 min)
**Window 1 (User A):**
- [ ] Type "Hello from User A" in message box
- [ ] Click Send (or press Enter)
- [ ] Message appears in chat window with "You" label
- [ ] **[P0 BLOCKER]** Window 2 sees message within 2 seconds

**Window 2 (User B):**
- [ ] Sees "Hello from User A" message with partner's username
- [ ] Type "Hello from User B"
- [ ] Send message
- [ ] **[P0 BLOCKER]** Window 1 sees message within 2 seconds

**Both Windows (Send 5 more messages each):**
- [ ] User A sends: "How are you?"
- [ ] User B responds: "Good, you?"
- [ ] User A: "Great!"
- [ ] User B: "Cool!"
- [ ] User A: "What brings you here?"
- [ ] User B: "Just exploring"
- [ ] User A: "Same here"
- [ ] User B: "Nice to meet you"
- [ ] User A: "You too!"
- [ ] User B: "Take care!"
- [ ] **[P0 BLOCKER]** All messages appear in correct chronological order
- [ ] No duplicate messages
- [ ] No messages missing

---

### 🏁 Step 5: End Chat & Reflection (1 min)
**Window 1 (User A):**
- [ ] Click hamburger menu (top right)
- [ ] Click "End Conversation"
- [ ] Confirmation dialog appears
- [ ] Click "Yes, end conversation"
- [ ] **[P0 BLOCKER]** Reflection dialog appears within 2 seconds
- [ ] Click 5 stars (or any rating)
- [ ] (Optional) Type feedback text
- [ ] Click "Submit" (or "Skip")
- [ ] Post-chat dialog appears ("Conversation ended")
- [ ] Click "Start New Conversation"
- [ ] Redirected to home

**Window 2 (User B):**
- [ ] **[P0 BLOCKER]** Sees "Your partner has left the conversation" banner within 5 seconds
- [ ] Chat input disabled
- [ ] Can still view previous messages

---

## Final Validation

### Console Errors Check
- [ ] **[P0 BLOCKER]** Window 1: All console errors = 0 (warnings OK)
- [ ] **[P0 BLOCKER]** Window 2: All console errors = 0 (warnings OK)

### Database Verification (Optional)
- [ ] Open `/admin/health`
- [ ] Verify `Recent Messages` count increased by ~12
- [ ] Verify `Active Chats` count decreased by 1
- [ ] No safety clamp triggers in logs

---

## ✅ Test Results

**Date:** _______________  
**Tester:** _______________  
**Build/Commit:** _______________

**Overall Result:** ☐ PASS ☑ FAIL

**If FAIL, describe issue:**
```
_____________________________________________________
_____________________________________________________
_____________________________________________________
```

**Action Taken:**
- [ ] Reported issue to tracking system
- [ ] Deployed fix
- [ ] Re-ran test (new result: ______)

---

## Notes

- **P0 BLOCKER:** Must pass before production deployment
- **Warnings:** Can proceed with caution, monitor post-launch
- **Run frequency:** Before every deploy + weekly during low traffic
- **Keep history:** Save completed checklists in `docs/test-runs/`
