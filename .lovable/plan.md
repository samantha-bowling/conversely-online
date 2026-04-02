

## Conversely Shutdown + Portfolio Case Study

### Overview
Keep the current site intact but disable matching, and add a polished portfolio case study page accessible from the landing page and footer.

### Part 1: Disable Matching

**Landing page (`src/pages/Landing.tsx`)**
- Replace the "Let's Get Started" button with a disabled state or a styled notice: "Conversely is no longer active. Thank you for being part of it."
- Remove the "Check Activity" button
- Add a link to the new case study page (e.g. "Read the Story Behind Conversely")

**Matching page (`src/pages/Matching.tsx`)**
- Add a redirect or message that matching is no longer available, directing users back to the landing page

**No edge function changes needed** -- the frontend gates will prevent any matching attempts.

### Part 2: Portfolio Case Study Page

**New file: `src/pages/CaseStudy.tsx`**

A clean, visual, scroll-friendly page structured as a portfolio case study with these sections:

1. **Hero** -- Project name, tagline, a brief "what it was" summary, and a sunset notice
2. **The Problem** -- Why Conversely was built: bridging divides through anonymous conversation
3. **How It Worked** -- User flow walkthrough: age gate → survey (5 random questions from 60+) → real-time matching → ephemeral chat → reflection
4. **Technical Architecture** -- High-level system diagram (text-based):
   - React + Vite + Tailwind frontend
   - Backend functions for session management, matching, messaging
   - Real-time subscriptions for chat
   - Anonymous guest sessions (no accounts)
   - Ephemeral messages with auto-delete timers
5. **Matching Algorithm** -- How opposite-matching worked: survey answers scored for difference (60%+ threshold), reputation system, ghost detection via heartbeats, race condition handling with advisory locks
6. **Privacy & Security** -- Zero-knowledge design, GDPR compliance, hCaptcha, rate limiting, content filtering, data retention policies
7. **Challenges & Lessons** -- Race conditions in matching, mobile keyboard layout issues, ephemeral message UX, balancing safety with anonymity
8. **Tech Stack** -- Visual grid of technologies used
9. **Footer** -- Contact link, copyright

**New route in `src/App.tsx`:**
- `/case-study` as a public route

**Footer update (`src/components/Footer.tsx`):**
- Add "Case Study" link in all footer variants

**AboutSheet update (`src/components/AboutSheet.tsx`):**
- Add a link to the case study page at the bottom

### Design Notes
- Uses existing Tailwind theme and shadcn components for consistency
- Responsive layout with proper mobile spacing
- Clean typography with section dividers
- Architecture section uses a styled code/text block for the system diagram
- No external dependencies needed

### Files Changed
1. `src/pages/Landing.tsx` -- disable start button, add case study link
2. `src/pages/Matching.tsx` -- add shutdown redirect/message
3. `src/pages/CaseStudy.tsx` -- new portfolio case study page
4. `src/App.tsx` -- add `/case-study` route
5. `src/components/Footer.tsx` -- add case study link
6. `src/components/AboutSheet.tsx` -- add case study link

