# Architecture

```text
Codex local client
    | JSON-RPC / MCP over stdin/stdout
    v
server.cjs (Node.js, one instance)
    ^ authenticated HTTP over loopback, port 32126 by default
    | GET /poll, POST /result
Premiere UXP panel (local/panel)
    | JavaScript via require('premierepro')
    v
Active Premiere project
```

The server binds IPv4 `127.0.0.1` and IPv6 `::1`; IPv6 is optional only when the OS reports it unavailable. Each HTTP route requires the per-install bearer token and an exact loopback Host header. The panel polls `http://localhost:<port>` every 750 ms while idle. It stops polling while executing a script, so a long script can temporarily make `connected` false even while `busy` is true.

The MCP server advertises protocol version `2025-03-26`, supports initialization, ping, tool listing/calling, and newline-delimited JSON-RPC. It implements the small required surface using Node's standard library. Server diagnostics go to stderr, leaving stdout reserved for MCP messages.

Commands are queued once, delivered once, and never automatically replayed. Before-delivery timeouts cancel queued work. After-delivery timeouts retain the job until its result arrives. Duplicate result submissions are acknowledged while the result remains in the 20-entry cache. A panel receiving an unknown-result response after a server restart stops and asks the user to inspect the project before reconnecting.

`scripts/setup.cjs` creates a 32-byte random token, copies only the three panel source files into `local/panel/`, writes matching server/panel config, updates the manifest's port permission, generates Codex TOML, and builds a local ZIP-based CCX. It neither edits the user's Codex config nor installs software. No Adobe binaries, credentials, media, project files, or third-party CEP extensions are included.

The setup output and source have deliberately different roles: `panel/` is safe to publish; `local/` and `dist/` are private. The environment variable `PREMIERE_BRIDGE_CONFIG` optionally points the server to a different absolute config path (used by isolated tests). It must match the installed panel. Configure the port through setup, not a server-only environment override.
