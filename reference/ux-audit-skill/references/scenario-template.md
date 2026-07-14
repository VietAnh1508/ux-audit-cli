# <Scenario Name>

<!-- Short name for this journey, e.g. "New User Onboarding" or "Core Voting Loop" -->

**App URL:** http://localhost:3000
**App Name:** MyApp
**App Persona:** One sentence describing the app and who uses it.
**Auth:** email: test@example.com / password: changeme

<!-- Auth: use a dedicated test account created solely for this audit — never a personal or production account.
     The AI will sign in with these credentials.
     Omit this field entirely for public pages (landing pages, product listings, etc.) that do not require sign-in. -->

**Session:** fresh

<!-- Session options (only relevant when Auth is present):
     fresh         — log out any existing session before starting; use when the scenario tests sign-in or onboarding
     authenticated — sign in silently if not already logged in, then navigate to App URL; use when the scenario starts mid-app
     Omit alongside Auth when the scenario is entirely public-facing.
-->

**Viewport:** desktop

<!-- Viewport options: desktop (default) | mobile (390px width) -->

**Output:** .claude/ux-audit/<scenario-name>-audit.md

<!-- Output path for the report. Defaults to UX_AUDIT.md in the project root if omitted. -->

## Scenario

You are a first-time user who just received an invite link. You have never
seen this app before.

1. Arrive at the sign-in page. Try to understand what the app is before logging in.
2. Submit the form with a wrong password to see how errors are handled.
3. Sign in successfully and take stock of the landing screen.
4. Find the core action (e.g. "cast a vote") and complete it.
5. Observe the confirmation state — does the app make it clear what just happened?
