# claude-watch

Estate-wide AI background-task dashboard.

## Summary

`claude-watch` surfaces active background tasks (batch fixes, estate scans, large refactor walkers) spawned by AI sessions in a refreshing dashboard. It eliminates the need to run ad-hoc `tail -f` commands per task. It auto-discovers active AI-session tracker files under `/tmp/` and surfaces them idempotently.

## Modes

```bash
claude-watch              # dashboard (default) — refreshes every 2s via watch(1)
claude-watch -t           # tail mode — streams new lines from all discovered trackers
claude-watch -f PATH      # watch a specific file
claude-watch -l           # list candidates and exit (no follow)
claude-watch -h           # help
```

## Discovery Contract

The command looks for the following patterns in `/tmp/` (max-depth 2), modified within the last 10 minutes:

* `*progress.log` — line-per-event progress journals
* `*_results.tsv` / `*results.tsv` — outcome inventories (consumes the canonical four-term vocabulary defined in `BATCH-FIX-OUTCOME-CATEGORISATION.adoc`)
* `*.out` — Claude Code background-task output files (matches the `/tmp/claude-*/tasks/<id>.output` convention)

For `*_results.tsv` files, it renders a canonical outcome breakdown (`cut -f4 | sort | uniq -c`). For everything else, it shows the last 3 lines.

## How to participate (For AI Sessions)

There is no manual registration. An AI session only needs to:
* write a progress log to `/tmp/<topic>_progress.log`
* write results to `/tmp/<topic>_results.tsv` using the canonical four-term `outcome` column
* use Claude Code's `run_in_background` task convention

## Estate Integrations

You can install this tool globally or integrate it into your workflow:

* **Shell alias**: `alias cw=claude-watch` in `~/.bashrc` (one-keystroke invocation).
* **tmux binding**: `bind-key C-w split-window -h 'claude-watch'` (Ctrl-b Ctrl-w pops a side pane).
* **VS Code task**: "Run Task" entry that opens `claude-watch -t` in the integrated terminal.

## Background

Surfaced during the BP008 phantom-context estate fix sweep as a minimum-viable terminal-side realisation of the user request for "a Claude watcher dialogue box that is a button I can press to surface for the watchers that thing and watch on loop in real time".
