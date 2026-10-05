# mobile/www — the shell's bundled web directory

Capacitor requires a `webDir`. Reserve's native app does **not** bundle the
web build: it hosts the deployed origin (`RESERVE_MOBILE_ORIGIN`), so the
Supabase session, the server routes and the on-device OCR pipeline all run
from Reserve's own origin exactly as they do on the web.

What is here, and why:

| File | Role |
|---|---|
| `offline.html` | Shown when the origin is unreachable (`server.errorPath`). |
| `index.html` | Same page. Capacitor requires an `index.html` in `webDir`; it is only ever reached if the remote origin never loads. |

Nothing in this directory may carry product surface, member data or any
health or compliance claim — it ships inside the signed binary and cannot be
corrected without a new store review.
