# Validation record

Validated on Windows with Node.js 22.19.0 on 2026-10-04.

| Check | Result |
| --- | --- |
| `npm run check` | Passed: server, panel, and utility JavaScript parse |
| `npm test` | 11 tests passed, zero failures |
| Clean copy setup | Passed, including a checkout path containing spaces |
| Setup rerun and token rotation | Passed; rerun preserves settings, rotation replaces token |
| Generated CCX | Four expected root files; independent Python ZIP/CRC check passed |
| Generated Codex TOML | Parsed independently with Python tomllib; server path resolves |
| Authentication and MCP | Simulated panel round trips, rejected invalid token, four-tool discovery |
| Timeout handling | Undelivered work cancelled; delivered work blocked until late result |
| Panel recovery | Lost result acknowledgment retried without replay; unknown result stops panel |

Python was used only as an independent verification tool and is not required for installation or use.

The tests launch a real Node MCP/HTTP server on an isolated temporary port with fresh temporary credentials. Panel JavaScript is exercised with mocked UXP/DOM/network APIs. No user's Premiere project is edited by the automated checks.

The prepared copy has **not** been installed into a fresh Premiere instance or tested for live editing in this task. CCX structural validation does not prove Adobe installation acceptance. Use the README's installation steps and read-only `project_info` check to complete host verification. The original installed bridge and Codex configuration are left untouched.

GitHub CI is supplied for Windows/Linux and Node 22/24; those remote jobs have not run until the repository is pushed. macOS Adobe installation and other Premiere versions are not claimed as verified.
