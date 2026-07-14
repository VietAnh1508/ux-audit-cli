# UX Audit — Static Review

Use this path for Mode C — evaluating screenshots instead of a live browser session. Skip the pre-flight checklist and orchestrator steps entirely.

---

## 1. Gather screenshots

If the user has already shared images, proceed. If not, ask:

> "Please share screenshots of each key screen in the flow, labeled by state (e.g. 'Sign-in page', 'Home after login', 'Error state'). If you have before/after shots for any interactions, include both."

## 2. Evaluate each screenshot

Apply these dimensions — all work from screenshots alone:

| Dimension              | Evaluable? |
| ---------------------- | ---------- |
| Visual hierarchy       | ✅ Yes |
| Visual design          | ✅ Yes |
| CTA clarity            | ✅ Yes |
| Empty / loading states | ✅ Yes (if screenshot shows it) |
| Feedback after actions | ✅ If before/after shots provided — otherwise note the gap |
| Information density    | ✅ Yes |
| Copy quality           | ✅ Yes |
| Mobile readiness       | ✅ If mobile screenshots provided |
| Friction               | ✅ Infer from number of steps visible |
| Confusion              | ✅ Yes |

## 3. Accessibility — partial coverage only

Only colour contrast and tap target size can be evaluated from screenshots. Note this once at the top of any accessibility findings:

> _DOM-level accessibility checks (unlabelled elements, alt text, heading structure, keyboard focus) require a live session and could not be run in this static review._

## 4. Write the report

Read `<skill-dir>/assets/report-single.md`. Fill in `{date}` with today's date (YYYY-MM-DD format). Append `(Static review)` to the scenario name in the title. Add one sentence in the Executive Summary noting that DOM-level accessibility checks were not performed.
