# Troubleshooting

| Symptom | Action |
| --- | --- |
| `node` or `npm` is not recognized | Install Node.js 22+ and reopen your terminal and Codex |
| PowerShell blocks npm.ps1 | Use `npm.cmd` in place of `npm` |
| Missing local configuration | Run `npm run setup` from the repository |
| No panel menu | Confirm Premiere 26+, enable Developer Mode, then install CCX or load the generated manifest with UDT |
| CCX installation fails | Open Creative Cloud's error details; use UDT with `local/panel/manifest.json` as the development route |
| Panel keeps reconnecting | Restart Codex after configuring MCP; keep Premiere's panel open; run `npm run doctor` |
| Doctor reports HTTP 403 | Server and installed panel may belong to different copies; rerun setup, reinstall panel, and use the generated Codex snippet |
| `EADDRINUSE` | Stop the other bridge instance or choose a new port; do not run npm start alongside Codex |
| Script returns a UXP error | Check the Adobe API for your installed Premiere version; CEP/ExtendScript scripts are not interchangeable with UXP |
| Timed out after delivery | Inspect `get_result` and the project; never automatically resubmit the edit |
| Busy forever | The panel/script may be stuck; inspect and save project state before restarting Premiere/Codex. Restart loses result history and is not cancellation |
| Result could not be recorded | Server restarted or discarded the result; inspect project state, then click Connect |
| Moved the repository | Rerun setup and merge the regenerated Codex snippet with its new absolute paths |

To change the port:

```powershell
npm run setup -- --port 32127
```

To rotate a token:

```powershell
npm run setup -- --rotate-token
```

Both changes require reinstalling/reloading the panel and restarting Codex. Retire older CCX copies after token rotation. Use one installed panel and one bridge process per Premiere session.

To uninstall, remove or disable `premiere` in Codex MCP configuration and restart Codex, then uninstall the panel in Creative Cloud's Manage Plugins (or unload it in UDT). You can then remove your repository's generated `local/` and `dist/` directories. Your Premiere projects are separate from these files.
