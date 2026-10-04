# Local bridge security

The bridge executes JavaScript in Premiere with the installed plugin's permissions. Only connect trusted local MCP clients, request intended edits, and save projects before modifying them.

The HTTP service binds only loopback, checks Host, requires a random per-install bearer token, and grants no CORS permission. It is not intended to be exposed on a LAN, the public Internet, or through a tunnel. Local scripts that can read the token can use the bridge; this is not an isolation boundary against other programs running under your account.

`local/connection.json`, `local/panel/connection.json`, and generated `.ccx` files contain that token. They are ignored by Git. Keep them in your private user directory or restrict access to the repository directory. POSIX file modes are requested where supported; on Windows the files inherit the directory's ACLs. Setup never prints the token or copies existing Codex authentication.

Rotate a disclosed token with `npm run setup -- --rotate-token`, reinstall/reload the panel, and restart Codex. Removing a secret from a new commit does not remove it from old Git history.

Project metadata returned through MCP is sent to the configured Codex client as tool output. The bridge itself makes no external API requests, but Codex's usual data handling applies to that output.

A timeout after script delivery is ambiguous. It does not roll back or cancel the script. Do not retry automatically. If a command hangs permanently, inspect the project before restarting the bridge; result history is held only in memory.

For security reports, use a private repository-owner contact or GitHub private vulnerability reporting if enabled. Do not post tokens or private project data in public issues.
