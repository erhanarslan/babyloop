# Engagement Measurement

Engaged time is not route open/close wall-clock time.

Web engagement counts only when the document is visible and the window is focused. Mobile engagement counts only while the app state is active. Heartbeat deltas are capped at 30 seconds so sleep/background gaps do not inflate dwell time.

Route changes close the previous surface and start a new surface. Raw query strings are stripped and route params are converted to templates such as `/listings/[id]`, `/conversations/[id]`, and `/categories/[slug]`.

Dashboard engagement metrics should show total, average, p50, and p90 where available. Average alone is not enough because long sessions can skew interpretation.
