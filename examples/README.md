# First read-only request

Ask Codex: "Use connection_status, then project_info. List the active project's sequences without changing anything."

`project-info.js` is the equivalent async function body for `execute_script`. Codex passes the file's text as the `script` argument; the panel supplies `premierepro`. Do not run it with Node directly.

Start with read-only inspection before editing, and check the official Premiere UXP API for any operation you request. This bridge cannot make unsupported Adobe APIs available.
