# Week Grid Planner

> [!WARNING]
> ## ⚠️ This plugin was made with AI ("vibe coded") and is mainly for personal use
>
> The code was written with an AI assistant (Claude, by Anthropic), not by hand, and the project exists to fit **its author's own workflow**. It is shared as-is, with no promise of support, fixes or feature requests.
>
> - **Treat it as experimental.** It may contain bugs, and it creates, renames, rewrites and deletes notes in your vault, so **keep backups** before trying it.
> - Expect rough edges and breaking changes until 1.0.
> - It is used daily by its author on desktop and Android, but that is the extent of the testing.
> - Use it at your own risk (see the [license](LICENSE)).

A local-first weekly planner for [Obsidian](https://obsidian.md). It adds a **Bases view** that shows your tasks as a 7-day grid (Monday to Friday, with Saturday and Sunday sharing the sixth column) with a **Someday** backlog underneath. Every task is an ordinary note in your vault, and recurring tasks are generated from "master" notes with an RRULE.

Inspired by the Tweek planner app. Not affiliated with it.

## Requirements

- Obsidian **1.13.0 or newer** (the settings page uses the declarative settings API).
- The **Bases** core plugin enabled.

## How it works

- **Tasks** are notes in your tasks folder (default `Tasks`). A task with a `date` (`YYYY-MM-DD`) shows up in that day's column; a task without one lives in **Someday**. A task's `status` is `pending`, `done`, `cancelled` or `deleted` (a soft delete that hides the card but keeps the note).
- **Masters** are notes in your masters folder (default `Masters`) that describe a recurring task with an `rrule`. The plugin generates one note per occurrence into the tasks folder for the next *N* days (default 14). Editing a master never touches occurrences that were already generated.
- **Folders are never created automatically.** You choose them in the settings; the plugin warns if one is missing.
- Property names and the note tag are configurable. Renames run as an explicit "Apply…" migration that shows what will change before anything is rewritten.

## Using the grid

- Drag a card to another day, to Someday, or to a new position within a list; a dashed landing zone shows where it will go.
- Click the **+** strip under a column to add a task inline.
- The card menu (⋮) can move a card up or down, move it to a day or to Someday, mark it cancelled, delete it (soft) or delete it permanently.
- Cards can be colored with a raw hex value or with a name from a palette you define in the settings.

## Commands

- Generate occurrences now
- Delete old tasks…
- Bring overdue tasks to today
- Bring overdue tasks to Someday
- Check for duplicate master IDs…
- Add tags to existing notes…
- Generate note templates…

## Installation

### With BRAT (recommended while the plugin is not in the community list)

1. Install the **BRAT** community plugin.
2. In BRAT, choose *Add beta plugin* and enter this repository's address.
3. BRAT installs the latest release and can keep it updated, on desktop and mobile.

### Manually

Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest) into `<your vault>/.obsidian/plugins/week-grid-planner/`, then enable the plugin under *Settings → Community plugins*.

## Development

```
npm ci
npm run dev      # rebuilds main.js on every change
npm run build    # production build
```

Releases are described in [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE)
