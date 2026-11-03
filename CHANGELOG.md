# Changelog

Todas as mudanças notáveis do Week Grid Planner são registradas aqui.

## [0.3.29]
### Fixed
- Fast drag-and-drop sometimes did nothing: the card snapped back to where it was. The drag log showed that in quick drags (about 50-100 ms from pick-up to release) the browser delivered **no `drop` event at all**, even though the pointer was released inside the list (10 of 11 quick drags in one capture; slower drags were fine). Day columns and the Someday list now also accept the drag on `dragenter`, not only on `dragover`, as the HTML drag-and-drop model expects. Likely cause: when the pointer crosses into a new element, `dragenter` fires first and `dragover` only on the next update, so releasing in between counted as "drop not allowed"
### Changed
- Temporary drag debug log: now records every `dragenter` (and whether it was accepted), any `dragover` that was not accepted, and the drop effect, pointer position and element under the pointer at `dragend`, to confirm the fix above

## [0.3.28]
### Fixed
- A stale safety timer from the previous drop could fire in the middle of the *next* drag when that drag started within 2 s of the drop (found with the drag debug log: it happened in 4 of 5 quick successive drags). The timer forced a re-render while a card was being held, so the list jumped by one card height, the card being dragged reappeared in its old slot, and — because the drop index counts visible cards — the drop position could end up off by one. The timer is now skipped when a newer drag is in progress (it still runs normally if the drag that scheduled it never delivered `dragend`), and timers no longer stack
### Changed
- Temporary drag debug log: keeps 1500 lines instead of 500, records the cursor's Y position and the target card's midpoint on every placeholder move, and flags renders and board snapshots that happen while a drag is in progress (`dragInProgress`)

## [0.3.27]
### Added
- **Temporary, development-only** drag-and-drop trace, to debug small glitches in the drag animation without having to describe them. Not a feature and not meant to ship: it only observes and changes no dragging behavior. It records (in memory, only during a drag and for a few seconds after) the drag events, placeholder moves, the order/date writes, every render and FLIP step with timings, and two board-state snapshots after a drop (stuck placeholder, hidden or duplicated cards, leftover inline animation styles). It is saved to `drag-debug.log` in the plugin folder (one write per drag) and can be copied with the command "Copy drag debug log (temporary)". To remove it: delete `src/drag-debug.ts` and every line tagged `DRAGDEBUG` (`grep -rn DRAGDEBUG src`)

## [0.3.26]
### Fixed
- Cleanup pass against Obsidian's official plugin-review lint rules (`eslint-plugin-obsidianmd`, the same checks the new automated review is built on); 91 findings down to 12. No intended behavior changes
- `manifest.json` now declares the required `isDesktopOnly` field (`false` — the plugin runs on mobile)
- Frontmatter reads and `processFrontMatter` callbacks are typed through one shared `Frontmatter` type and a `cachedFrontmatter()` helper in `fields.ts`, instead of Obsidian's `any`-typed values. Every value is narrowed before use; a non-string `date` or `master_id` in a note's frontmatter is now ignored by the overdue / cleanup / duplicate-id scans instead of being compared as-is
- Removed redundant `as TFile` / `as MouseEvent` casts (the types were already correct), and the four `console.log` diagnostics ("plugin loaded", occurrences generated, masters found). Error and warning logging is kept
- Confirm buttons use `setDestructive()` (`setWarning()` on buttons is deprecated); bare `setTimeout` / `requestAnimationFrame` calls now go through `window.` so they work in popout windows
- Not in this release: the inline `element.style` assignments in the drag animation (`view.ts`) and `color-utils.ts`, and three sentence-case warnings on placeholder text (`#3b82f6`, `wgp`), which look like false positives

## [0.3.25]
### Changed
- Settings tab migrated to Obsidian's declarative settings API (`getSettingDefinitions()`), following the official migration guide (Path A, clean 1.13-only). `display()` is gone: Obsidian now renders the page from the definitions, saves values itself, and indexes every setting for the global settings search (previously none of them were findable there). **`minAppVersion` is now 1.13.0** — the plugin will not load on older Obsidian versions
- Input validation moved out of silent `onChange` early-returns into `validate` callbacks, so a rejected value now shows an inline error instead of being quietly ignored: generation horizon and side-border thickness must be whole numbers (>= 0 and >= 1), and the folder, log-path and property-name fields can't be left empty. Clearing a number field falls back to its default (14 / 3) rather than 0, so it can't accidentally switch generation off
- Masters/tasks folder fields use the built-in folder control instead of our own `FolderSuggest` wiring (`folder-suggest.ts` itself stays — "Generate note templates…" still uses it)
- The log-path field's greyed-out-while-logging-is-off behavior is now a `disabled` predicate instead of a captured `TextComponent`
- Settings sections are real groups with headings; "Apply tag now", "Apply rename now" and the palette button keep their existing look via `render` rows. Every place that used to call `this.display()` to refresh the tab after a modal or "Apply prefix" now calls `this.update()` — on 1.13+ `display()` would silently refresh nothing

## [0.3.24]
### Added
- Activity log: a persistent, reviewable record of what the plugin does — which occurrences it generated (with file paths, not just a count), which tasks got deleted and whether that was automatic or manual, and any errors along the way (invalid RRULE, failed file creation/deletion) — kept in a plain vault note instead of only a Notice (which can be missed) or the console (which needs DevTools open). New entries are prepended at the top, so the most recent activity is always the first thing visible on opening the note. The file is capped at ~200KB, trimming the oldest entries once exceeded, cutting cleanly at entry boundaries rather than mid-entry
- New settings: "Keep an activity log" (toggle, on by default) and "Log note path" (text field, default `Week Grid Planner Log.md` at vault root) — the path field stays visible but greys out via `setDisabled()` when logging is off, rather than being hidden outright

## [0.3.23]
### Fixed
- Someday never had the "+" add-task strip every day column has — not a display bug, the feature was simply never built for it, so there was no way to create a new task directly in Someday from the UI at all (only by dragging an existing one there, or removing a date via the ⋮ menu). `createInlineTask()`/`createTask()` now accept `isoDate: string | null`, writing no `date` field at all when null, and Someday gets the same "+" strip and click-to-add-empty-space behavior as every other column

## [0.3.22]
### Fixed
- The "flash at the old position, then correct position" after a drop was actually caused by 0.3.19's own fix: forcing our own `render()` the instant the file write resolved raced against Obsidian's own reactivity, and Bases' query cache has its own latency separate from the underlying write — so that forced render sometimes ran against still-stale data, painting the card back at its old spot for an instant before the real update corrected it. Reverted that approach entirely. The drop handlers no longer remove the placeholder, un-hide the dragged card, or force a render — all three are left exactly as the live preview left them, and Obsidian's own reactivity replaces everything in one clean step once the write actually lands, with nothing in between to revert or flash. Replaced the old 500ms per-element safety net with a single, more generous (2s) fallback that forces a proper render only if the placeholder is somehow still around by then — pure insurance against Obsidian's reactivity never firing at all, not something that should ever normally trigger

## [0.3.21]
### Fixed
- The swap animation could still intermittently play after a drop, despite 0.3.18/0.3.19: `skipNextAnimation` was a one-shot flag, consumed by whichever render happened to run first. A drop can trigger two renders in quick succession — our own forced one plus Obsidian's own reactive one, both from the same underlying write — and depending on which won that race, the flag only protected one of them; if the other ran against even slightly different data, it animated. Replaced with `skipAnimationUntil`, a short (400ms) time window instead of a one-shot flag — every render within that window skips animation, regardless of how many fire or in what order

## [0.3.20]
### Fixed
- The "has body text" icon wasn't picking up contrast-safe color in `fill` mode. Same root cause as the tweek fix from earlier: the icon has its own hardcoded `color: var(--text-faint)`, which always wins over an inherited color regardless of specificity — the equivalent override just hadn't been added for `fill`, only `tweek`

## [0.3.19]
### Fixed
- The "blink at the old position" after a drop: the 500ms disappearing-card safety net (0.3.15) was insurance against Obsidian's own re-render being delayed, but when it *did* fire before that re-render caught up, it restored the stale hidden card at its old position — visible as a flash there before the real re-render replaced it at the new one. Both drop handlers now force their own `render()` the instant the file write finishes, instead of waiting on Obsidian's metadata-cache reactivity to notice the change on its own schedule — a real re-render now almost always wins the race, so the safety net stays what it was meant to be: a rarely-needed fallback, not something visibly firing in the normal case. A redundant render from Obsidian's own reactivity arriving right after is harmless, since it just redraws the same already-current data

## [0.3.18]
### Fixed
- Real double-animation bug on drop: the live placeholder already reflows other cards into their final positions during the drag itself, but dropping removed the placeholder *before* the async file write resolved — with nothing holding that gap open anymore (the dragged card was still hidden), the list would snap back toward its pre-drag layout for a moment. The subsequent re-render then captured *that* transient, snapped-back arrangement as FLIP's "before" state and re-animated everything from there to its real final spot — a second, redundant animation stacked on top of what the drag preview had already shown. Fixed by skipping the post-drop render's animation entirely (`skipNextAnimation`, the same mechanism already used for week navigation) — the live placeholder already is the animation for a drag-and-drop move, so nothing needs to move again once it settles. FLIP still animates everywhere else (completing a task, deleting one, moving via the ⋮ menu), since those have no live preview to make a second animation redundant

## [0.3.17]
### Changed
- Completed-task pill opacity in `tweek` mode dropped from 0.5 to 0.25 (more visibly "faded")
- Same dimming now also applies to `fill` mode — opacity on the whole card, since fill colors the entire card rather than just a pill
- Cancelled tasks (either cancelled style — strikethrough, red, or both) now get the same 0.25 dimming in both `tweek` and `fill` modes, matching the completed-task treatment. Didn't touch the existing red/strikethrough text styling itself, just added the opacity on top — a "cancelled, red text" task still shows red text, just dimmed like everything else now is
- All of this only applies when the task actually has a color set (`wgp-has-color`); a colorless done/cancelled task still falls through to the plain strikethrough/faint-text/red treatment every mode already had

## [0.3.16]
### Changed
- Restructured the card's icon+text into a shared wrapper (`.wgp-card-content`), instead of the body icon sitting as a separate sibling next to the text span. In `tweek` mode, the pill's background/padding/radius now paint on this wrapper, so the icon renders visibly inside the pill alongside the text, not next to it. The icon also now inherits `--wgp-color-text` (the same contrast-safe color the pill text already used) in that mode, instead of always being a fixed faint gray. Text truncation/wrap behavior is unaffected — it's still scoped to just the inner `.wgp-card-text`, so a long title still ellipses correctly without the icon getting clipped
- `tweek` mode now fades a completed task's pill (opacity 0.5 on the whole pill) instead of just overriding its text to the generic faint gray — keeps the task's color recognizable but visibly dimmed, closer to how Tweek itself treats completed items. Only applies when the task actually has a color (`wgp-has-color`); a colorless completed task still falls through to the plain strikethrough/faint-text treatment every other mode uses

## [0.3.15]
### Fixed
- Two real bugs found during testing, both traced back to the same root cause (hiding the dragged card via `display: none` during a drag):
  - **Card disappearing until an unrelated render fixed it**: the hidden original was only ever meant to be temporary, replaced by a fresh visible one once the frontmatter write triggered a re-render — but if that re-render was ever delayed, the card just stayed invisible with nothing forcing it back. Added a 500ms safety-net timer, started the moment a drop is processed, that restores visibility if nothing else already did (a harmless no-op in the normal case, since a real re-render already destroyed that exact element by then)
  - **Card flying in from the top-left corner**: `getBoundingClientRect()` on a `display: none` element always reports an all-zero rect — so the FLIP animation's "before" position for the just-dropped card was read as `(0, 0)`, and it dutifully animated from there. `captureCardRects()` now skips any card that's currently hidden mid-drag, so it's excluded from animation entirely (it doesn't need one — you just placed it there yourself) rather than animating from a bogus position

## [0.3.14]
### Added
- Live "landing zone" placeholder while dragging a card: a dashed box now shows exactly where the card would land, updated continuously as you drag, instead of only finding out once you drop it. Restructured drag handling from per-card `dragover`/`drop` listeners to list-level ones (needed to compute "where in the whole list does this land" instead of "which specific card did I drop onto"): the dragged card's own element is hidden (not removed — `display: none`, deferred a frame so the browser's native drag-ghost image still captures it first) rather than moved during the drag, and a single reusable placeholder element tracks the cursor across columns, including landing in a different day than where the drag started

### Fixed
- A subtle race in the above: `dragend` fires immediately after `drop`, before the async file update (`moveTaskToDate`) resolves and a fresh render replaces the dragged card's element — without guarding against it, the card would flash back to its old position for a moment. A `dropHandled` flag, set the instant a drop is actually processed, tells `dragend`'s cleanup not to restore the old element's visibility in that case (only a genuine cancelled drag needs that restore)

## [0.3.13]
### Added
- Smooth card animation on reorder/move/complete, via FLIP (First, Last, Invert, Play) — no new dependency: capture each visible card's on-screen position before a render, let the render fully rebuild the DOM as it already does, then diff old vs. new position by file path and animate the difference away with a CSS transform + transition (150ms ease). Cards moving between columns animate too, not just reordering within one. Skipped entirely for week navigation (‹/›/Today) — the whole board changing at once should feel like a page turn, not something visually flying around — and respects `prefers-reduced-motion`. Investigated adopting the referenced kanban plugin's approach (SortableJS) first, but that library's value is mainly its touch-drag fallback, which we don't need — drag-and-drop already works fine on mobile here

## [0.3.12]
### Fixed
- Non-today columns could end up visually indistinguishable from their own cards under some themes — `.wgp-column` already used the semantically correct `--background-secondary` token, but a theme that sets `--background-secondary` equal to `--background-primary` (which does happen) left every column flat against its cards, with only each card's own border to tell them apart. New `pickColumnBackground()` on `ColorResolver` checks that at render time (once per render, not per card) and falls back to `--background-primary-alt` if the two collide under the live theme — applied to both the weekly columns and the Someday section, which now share the same computed background. Today's own highlighted background was already fine and is untouched

## [0.3.11]
### Fixed
- The move/complete buttons (⋮/✓) now also use the contrast-safe text color in `fill` mode — previously only the task text did, so the buttons' default muted color could stay low-contrast against a colored card background. Not needed for `side-border` (card background never changes) or `tweek` (only the text pill is colored)

## [0.3.10]
### Changed
- `waitForFolderMetadataReady()`'s timeout bumped from 5s to 10s — external sync (e.g. Dropbox syncing files in outside of Obsidian) can land a larger batch of files at once than the original guess accounted for, and the cost of waiting a bit longer is far lower than the cost of a duplicate note. Documented a known gap: this only catches a file with *no* cache entry yet, not a *stale* one for a file that already had a cache entry before an external edit changed it — the common external-sync case (new/renamed occurrence notes this device hasn't indexed before) is covered, a frontmatter edit to an already-cached file from outside Obsidian is not

## [0.3.9]
### Fixed
- Real bug, not just cosmetic: occurrences could get duplicated on generation, especially noticeable on mobile. Cause: `onLayoutReady()` only guarantees the workspace layout is restored, not that Obsidian's metadata cache has finished indexing every file yet — if generation ran before an *existing* occurrence's frontmatter was cached, `readExistingSlots()` saw that slot as empty and created a duplicate for it. Added a bounded, polling wait (`waitForFolderMetadataReady()`, 5s max, 200ms interval) before generation reads anything, scoped to just the masters/tasks folders rather than the whole vault
- The nav buttons (‹, ›, Today) had the same root cause as the ⋮/✓ border issue from 0.3.5 — Obsidian's `button:not(.clickable-icon)` box-shadow overriding their intended border. Same fix: added Obsidian's own `clickable-icon` class to stop that rule from matching, then re-asserted the background/border look on top via a compound selector

### Changed
- Removed "Border around the card" (`full-border`) as a card color style — anyone with it selected falls back to `side-border` automatically on load
- `fill` and `tweek` color styles now only apply a color when the task actually has one resolved (a new `.wgp-has-color` class, toggled per-card) — previously both fell back to `--interactive-accent` for every colorless task, coloring cards that were never meant to stand out. `side-border` keeps that accent default on purpose, since a thin default border reads as neutral in a way a full fill or pill doesn't
- Fixed `tweek` mode's move/complete buttons drifting to sit right after the (possibly short) text pill instead of staying flush against the card's right edge — the pill's own `flex: 0 1 auto` (needed so it hugs its own text) left the leftover row space unclaimed; `margin-right: auto` on the pill now eats that space instead

## [0.3.8]
### Changed
- Generalized the theme-collision check from 0.3.7: it was only comparing a task's color against today's highlight, in the today column. Now every card, every day, also checks against `--background-primary` (the card's own resting background) — a colored border that matches the card it's on is invisible regardless of which day it's on, not just a today-specific problem. `ColorResolver.avoidCollision()` now takes a list of colors to avoid instead of a single one, and picks the first theme color distinct from all of them

## [0.3.7]
### Added
- Named color palette: Settings → "Manage color palette…" opens a dedicated modal (kept out of the settings page itself so it doesn't grow with every color added) to define name → hex mappings (e.g. `work → #3b82f6`). A note's `color` property can now be a name (`color: work`) instead of a raw hex — resolved through the palette at render time. Raw hex (`color: "#3b82f6"`) keeps working unchanged; an unmatched name just renders with no color, no error. No migration needed to add/remove/rename palette entries — they're not written into notes, just looked up
- New `cardColorStyle` option: **Tweek style** — a colored pill around just the task's text (card background stays neutral), instead of coloring the whole card
- Contrast-safe text color for both `fill` and the new `tweek` mode: a simple luminance (YIQ) check picks black or white text against whatever color is set, computed once per card via a live, hidden probe element that resolves real theme values through `getComputedStyle()` — this also fixed a latent gap in `fill` mode, which had no contrast handling at all before
- Theme-collision handling: in the *today* column specifically, if a task's resolved color canonicalizes to the same color as `--interactive-accent` (today's own highlight), it's swapped for the first of Obsidian's standard theme colors (`--color-orange`, `--color-yellow`, etc.) that's actually distinct under the current theme — so a task doesn't visually disappear into today's highlight
- New "Side border thickness" setting (px), applies to "Side border" mode only — "Border around the card" stays a fixed 2px

### Fixed
- The "Card color style" description said to navigate weeks or reopen the Base to see a change — no longer true since 0.3.6's refresh fix, so the note was removed

## [0.3.6]
### Fixed
- Changing a visual setting (card color style, cancelled-task style, text overflow) did nothing to an already-open Week Grid view — Obsidian only calls `onDataUpdated()` when the underlying data changes, never when a plugin setting does, so the view just kept showing whatever it last rendered. Added a registry of open views on the plugin (`activeViews`, populated/cleaned up via the view's constructor and `onunload()`) and a `refreshAllViews()` method that forces each one to re-render; wired it into the three visual settings above, and into "Apply rename now" too, since a property rename changes which frontmatter keys the view reads — same gap, same fix

## [0.3.5]
### Fixed
- Found the real source of the "border": Obsidian's core CSS has `button:not(.clickable-icon) { box-shadow: var(--input-shadow); ... }` — a themed shadow made to look like a border, applied to any plain `<button>` that isn't marked as an icon button, with higher specificity than our own class selector. `border: none` was never going to touch it, since it's a `box-shadow`, not a `border`. Fixed at the source: both buttons now also carry Obsidian's own `clickable-icon` class, so that rule no longer matches them at all — instead of fighting it property-by-property. Every one of our own selectors for these buttons now repeats `.clickable-icon` too, so our sizing/hover/focus styling stays reliably more specific than `clickable-icon`'s own built-in look, rather than depending on cascade order

## [0.3.4]
### Fixed
- The options button (⋮) still looked bordered despite `border: none` — most likely the browser's default focus outline persisting after the button is clicked (it opens a menu, and `<button>` elements keep focus afterward unless blurred), possibly compounded by mobile's default tap-highlight box. Neither is a CSS `border`, so the earlier `border: none` never touched them. Added explicit `outline: none` on `:focus`/`:focus-visible` (with matching specificity so it can't lose to a more specific rule elsewhere) and `-webkit-tap-highlight-color: transparent` for mobile, plus a defensive `box-shadow: none`

### Changed
- The options button is now 20px wide instead of the full 30px square — "⋮" is a narrow glyph, so the extra width was just empty hover-fill space on either side. The complete button (✓) stays 30×30

## [0.3.3]
### Changed
- Restored the pre-0.3.x proportions: complete/options buttons are now 30×30px (was 22×22px), card padding back to `4px 6px` (was `6px 8px`), card `min-height` now 38px (30px button + 4px top/bottom padding) — matching the original 38px card / 30px button measurements
- Bumped the glyph size on those buttons to `var(--icon-size, 16px)` so they read clearly at the larger size, closer to how Obsidian's own borderless icon buttons (no border, generous padding, subtle hover fill) look

## [0.3.2]
### Fixed
- The 0.3.1 fix (buttons `display: none` when not hovered) had a side effect: with no minimum height set on the card, the row collapsed to just the text's line-height whenever the buttons weren't shown, instead of always keeping the height the buttons used to reserve — cards felt noticeably shorter/cramped. Added `min-height: 22px` to `.wgp-card` (matching the buttons' own height) and bumped padding from `4px 6px` to `6px 8px` for more breathing room
- The options button (⋮) still showed what looked like a border despite `border: none` — actually native `<button>` chrome (appearance), most visible on mobile WebViews, not literally a CSS border. Added `appearance: none` / `-webkit-appearance: none` to both the complete and options buttons to remove it

## [0.3.1]
### Fixed
- The complete/options buttons used `visibility: hidden` to stay out of sight until hover, but `visibility: hidden` still reserves the element's box in the flex layout — so the card text was always narrowed by that reserved space, even when the buttons weren't shown, truncating titles more aggressively than necessary. Switched to `display: none` (removed from layout entirely when not hovering) so the text gets the full card width until the buttons actually appear on hover

## [0.3.0]
### Changed
- Card interaction polish, first version of the 0.3.x visual-refinement phase:
  - The complete (✓) and options (⋮) buttons are now fixed-size squares instead of text with padding
  - The options button no longer has a visible border; both it and the complete button now get a subtle background fill on hover (`--background-modifier-hover`), matching how Obsidian's own icon buttons behave, instead of only a color change
  - Confirmed existing behavior still matches intent: both buttons stay hidden until the card is hovered on desktop, and are always visible on touch devices (no persistent hover there) — no change needed, already correct
- New setting: "Long card text" — choose whether an overly long task title truncates with "…" (default, unchanged) or wraps to a new line

## [0.2.28]
### Added
- New occurrences now inherit everything on the master note that the plugin doesn't manage: body text (e.g. a checklist), extra frontmatter properties (e.g. `urgency: "!!!"`), and tags other than the master's own plugin tag (e.g. `#home`, `#work`) — all copied over at generation time. Extra properties/tags are written via `processFrontMatter` (correctly handles arrays, numbers, etc.), body text is appended after the frontmatter. Same rule as every other master field: only applies to occurrences generated from now on — editing a master never touches occurrences already generated from it

## [0.2.27]
### Fixed
- Editing the "Note tag" field in Settings did nothing visible and had no way to actually apply it — it silently changed what *new* notes would get tagged with, but existing notes never updated and there was no button, only the separate "Add tags to existing notes…" command (which only fills in missing tags, never renames/removes an old one)

### Added
- New "Use /tasks and /masters suffixes" toggle: on (default) keeps `{tag}/masters` and `{tag}/tasks`, off uses the plain `{tag}` tag on both
- The tag field and the new toggle now follow the same active/pending pattern as property names: editing them doesn't change anything until "Apply tag now" — which shows exactly what's changing (e.g. `wgp/masters → wgp`) and how many notes are affected, then migrates the masters/tasks folders (removes the old tag, adds the new one, leaves every other tag alone) and switches over
- Upgrade safety: since `noteTag` already existed before this version, loading settings now seeds the new "pending" tag fields from whatever tag was already active, instead of resetting the Settings box to the "wgp" default on first load after upgrading

## [0.2.26]
### Changed
- Settings: "Tag" and "Property names" are now two separate sections with their own headings, instead of one combined "Tag and property names" section

## [0.2.25]
### Added
- Configurable frontmatter property names, per field (e.g. `status` → `wgp_status`, `date` → `wgp_date`). New Settings section "Tag and property names": a "Property prefix" field + "Apply prefix to all fields below" button to bulk-fill the 8 individual name fields, each still freely editable on its own. Editing the fields alone changes nothing — a separate "Apply rename now" button opens a confirmation modal showing exactly which keys change and how many notes are affected, then rewrites frontmatter (via `processFrontMatter`, never raw text edits) across the masters and tasks folders **only**, and only then switches the plugin over to the new names. Every frontmatter read/write site in the codebase now goes through this configurable mapping instead of hardcoded key names
- Optional note tag, default `wgp` (blank = off). New occurrences get `{tag}/tasks` automatically; master notes don't (you write those by hand) — get `{tag}/masters` on them yourself if you want it. New command "Add tags to existing notes…" backfills the tag onto notes that don't have it yet (masters + tasks folders only), appending to any `tags` already present rather than overwriting
- New command "Generate note templates…": pick a folder (remembered for next time) and it writes a master-note template and a task template, with frontmatter keys and the tag reflecting your current settings. Doesn't touch a file if one already exists at that path

## [0.2.24]
### Fixed
- Master notes with no explicit `date` field were silently losing the last day of the generation horizon (e.g. horizon=14 from today only generated 13 days). Cause: `RRule.fromString()` defaulted `dtstart` to `new Date()` when the rule string had no DTSTART — today's date, but also today's current wall-clock time in the local timezone. That time-of-day carried onto every generated occurrence, so the one landing on the horizon's last day ended up timestamped after midnight UTC (the horizon boundary) and got excluded. dtstart is now explicitly anchored at today's UTC midnight in this case too (masters with an explicit `date` field were unaffected — they already built dtstart explicitly)

## [0.2.23]
### Changed
- The plugin no longer creates the masters/tasks folders automatically — you pick or create them yourself in Settings. If either is missing when generation would run (on vault open or via "Generate occurrences now"), it's skipped and a Notice tells you which folder(s) are missing, instead of silently creating them
- First run (or any time the folders have never both been found present) shows a distinct Notice pointing you at Settings → Week Grid Planner to choose the folders; once both are found existing at least once, later notices are a plain "folder not found" warning instead
- Adding a task via the "+" strip now warns instead of failing silently if the tasks folder doesn't exist

## [0.2.22]
### Fixed
- The grid now reopens on the week you were viewing instead of always snapping back to today's week. Opening a task note replaces the grid in the same tab, so hitting the note's back button recreates the view from scratch, discarding its in-memory state; the last-viewed week is now also kept on the plugin instance (session-only, not saved to disk) so the view can restore it

## [0.2.21]
### Added
- "1 month" option added to the cleanup interval choices (manual "Delete old tasks…" command and the automatic cleanup setting) — now 1m / 3m / 6m / 1y / 2y

## [0.2.20]
### Changed
- Fixed off-by-one in horizon semantics: `horizonDays` now counts today itself — 1 = today only, 2 = today and tomorrow, 3 = today, tomorrow, and the day after, and so on. Previously it meant "today plus N more days" (so 1 generated *two* days, today and tomorrow), which didn't match what "1" should mean. 0 still fully disables generation, unchanged
- **Note if you already have a custom horizon set**: the same saved number now generates one fewer day than before, since day-counting includes today explicitly now. If you want the exact same range as before, bump your saved value by 1 (e.g. 14 → 15)

## [0.2.19]
### Internal
- Removed the one-time `series_id` → `master_id` frontmatter migration (`migrate-master-id.ts` and its call in `main.ts`) added in 0.2.18. It already did its job on first load with that version — every note in the masters/tasks folders has `master_id` since then, so it had nothing left to do

## [0.2.18]
### Changed
- Renamed "series" to "master" throughout: `seriesFolder` setting → `mastersFolder` (default folder name "Series" → "Masters"), `SeriesMaster` type → `MasterNote`, and the `series_id` frontmatter field → `master_id` on both master notes and occurrence notes. Matches the terminology the code already used internally (`readMasters()`, "master note" in comments) more consistently than "series" did
- The duplicate-ID check (renamed "Check for duplicate master IDs…") now also runs automatically alongside occurrence generation — a quiet Notice warns if any are found, pointing at the manual command for the full report; the modal itself still only opens from the command
- Horizon = 0 is now an official, documented way to fully disable automatic generation (not even today's occurrences) — previously the settings field silently rejected 0, and even if forced via `data.json` it would still generate today's occurrences. Setting description updated to say so explicitly
### Added
- One-time migration (`migrate-master-id.ts`): rewrites `series_id` to `master_id` in the frontmatter of every existing note inside the masters/tasks folders, so nothing already generated needs manual editing. Runs before generation and the conflict check on every load, and is safe to remove once confirmed to have run against a real vault (same lifecycle as the settings-key migration removed in 0.2.16)

## [0.2.17]
### Added
- New command "Check for duplicate series IDs…": scans the series folder for master notes sharing the same `series_id` and reports them in a modal with clickable links to each file. Two masters with the same id make the "is this slot filled?" check in occurrence generation ambiguous — an occurrence generated for one can silently make the other's matching slot look already filled

## [0.2.16]
### Internal
- Removed the one-time settings migration code (`migrateLegacySettings`, `renameSettingsKey`, `remapSettingsValue`) added in 0.2.15. It already did its job on first load with that version — `data.json` has been carrying the current English field names since then, so the migration had nothing left to do. `loadSettings()` is back to a plain `Object.assign` with `DEFAULT_SETTINGS`

## [0.2.15]
### Interno
- Código-fonte inteiro traduzido para inglês: identificadores (funções, variáveis, tipos, classes), comentários e chaves do dicionário de i18n. Nenhuma mudança de comportamento — puramente para deixar o projeto acessível caso um dia seja compartilhado publicamente. Os textos exibidos na interface continuam em pt/en conforme o idioma do Obsidian (isso já era assim, só as chaves internas do dicionário mudaram de nome)
- Migração automática incluída em `loadSettings()`: quem já tinha `data.json` salvo com os nomes de campo antigos em português (`pastaSeries`, `pastaPrincipal`, `horizonteDias`, `confirmarApagarDeVerdade`, `limpezaAutomatica`, `estiloCorCard`, `estiloTarefaCancelada`, incluindo os valores tipo "nunca"/"riscado"/"borda-lateral") continua com a configuração intacta — nada precisa ser reconfigurado manualmente
- `manifest.json`/`package.json`: campo `description` traduzido pra inglês
- **Não traduzido nesta leva**: o histórico do CHANGELOG continua em português (as entradas abaixo desta). Avisa se quiser que eu traduza o histórico todo também

## [0.2.14]
### Mudado
- Pastas padrão de tarefas e séries padronizadas em inglês: "Tarefas" → "Tasks", "Series" mantida (a de séries já estava em inglês). Só afeta instalações novas — quem já tem `pastaPrincipal`/`pastaSeries` configurado não é alterado automaticamente

## [0.2.13]
### Renomeado
- O plugin mudou de nome: **Tweeklone → Week Grid Planner** (id: `tweeklone` → `week-grid-planner`). Todas as menções ao Tweek (nome do app que inspirou o projeto) foram removidas do código, comentários e textos — inclusive classes CSS (`tweeklone-*` → `wgp-*`), tipos internos (`TweeklonePlugin`, `TweekloneSettings` etc. → `WeekGridPlanner*`) e o id do ícone/tipo de view customizados
- **Ação manual necessária** (não dá pra automatizar por fora do vault): quem já tinha a versão anterior instalada precisa renomear a pasta do plugin dentro de `.obsidian/plugins/` de `tweeklone` para `week-grid-planner` antes de extrair este zip nela — isso preserva o `data.json` (seus ajustes salvos). Instalar por cima de uma pasta nova sem renomear faz o Obsidian tratar como plugin diferente e perder as configurações. Depois de trocar a pasta, é bom checar o(s) arquivo(s) `.base` que já usam a view — o identificador interno da view também mudou (`tweeklone-week-grid` → `wgp-week-grid`), então pode ser necessário reselecionar "Week Grid Planner" como tipo de view lá

## [0.2.12]
### Adicionado
- Novo status de tarefa `cancelled` ("não fiz e não vou fazer"): tarefa continua visível na view (diferente de `deleted`, que fica escondida), mas passa a ser ignorada por sistemas de "pendente" como os comandos de trazer atrasadas. Alterna via novo item "Marcar como cancelada" / "Desmarcar cancelada" no menu "⋮" do card
- Novo ajuste "Estilo de tarefa cancelada" (riscado / texto vermelho / ambos — padrão: ambos) controla como o status `cancelled` aparece no card
- Novo status padrão `pending`: tarefas novas (manuais ou geradas por série) já nascem com `status: pending` explícito no frontmatter, em vez de ficar sem o campo. Desmarcar "concluída" também volta pra `pending` explícito (antes apagava o campo `status` de vez)
- Novo ajuste "Apagar tarefas antigas automaticamente" (Nunca / 3 meses / 6 meses / 1 ano / 2 anos — padrão: Nunca): roda a mesma lógica do comando "Apagar tarefas antigas…" (sem modal, sem confirmação) toda vez que o plugin gera as ocorrências do horizonte

## [0.2.11]
### Adicionado
- Comando "Apagar tarefas antigas…" (paleta de comandos): abre um modal pra escolher o intervalo (3 meses / 6 meses / 1 ano / 2 anos), baseado no campo `date` — confirma mostrando a contagem real antes de apagar de verdade. Só afeta arquivos dentro da pasta de tarefas configurada, nunca a pasta de séries nem qualquer outro lugar do vault
- Comando "Trazer tarefas atrasadas para hoje": move pra hoje (`date` = hoje) todas as tarefas com `date` anterior a hoje que não estão concluídas nem soft-deletadas — reindexando `order` pra elas caírem nas últimas posições do dia (depois do que já estava lá), respeitando entre si a ordem de quão atrasadas estavam
- Comando "Trazer tarefas atrasadas para Someday": mesma seleção de tarefas atrasadas, mas remove o `date` (manda pra Someday) em vez de mudar pra hoje — mesma lógica de reindexação, pras últimas posições do Someday

## [0.2.10]
### Mudado
- Pasta e conceito "Templates" renomeados para "Séries" (pt) / "Series" (en) — evita colisão de nome com a funcionalidade nativa "Templates" do Obsidian. Configuração de pasta customizada existente é migrada automaticamente na primeira abertura, sem precisar reconfigurar
- Sempre existe uma faixa clicável ("+") logo abaixo do último card do dia para adicionar uma nova tarefa, mesmo quando a coluna já está cheia e não sobra espaço vazio
### Confirmado (sem mudança de código)
- "Todo fim de mês" já é nativamente suportado via `BYMONTHDAY=-1` (padrão RFC 5545/rrule.js) — chegou a ser implementado um clamp customizado pra `BYMONTHDAY=29/30/31` rolar pro último dia do mês, mas foi revertido: pra alvo=31 o clamp é matematicamente idêntico a `-1`, então era complexidade e superfície de bug desnecessárias
### Mudado (cor do card)
- Fundo da coluna do dia passou de `--background-primary-alt` para `--background-secondary`, e fundo do card de `--background-secondary` para `--background-primary` — o card fica claramente distinto (mais "branco"/primário) do fundo da coluna, em qualquer tema (claro ou escuro), em vez do inverso de antes

## [0.2.9]
### Corrigido
- Ícone de "tem corpo de texto" agora usa o SVG original de `square-text` embutido no próprio plugin via `addIcon()`, em vez de `file-text` — não depende mais de qual conjunto de ícones Lucide está embutido na versão do Obsidian instalada (o problema que motivou trocar para `file-text` na 0.2.8)
### Mudado
- Ícone de "tem corpo de texto" movido para a esquerda do título no card (antes ficava à direita)

## [0.2.8]
### Corrigido
- Ícone de "tem corpo de texto" não aparecia no mobile — `square-text` é um ícone recente do Lucide (versão 1.32), possivelmente ausente em conjuntos de ícones mais antigos; trocado por `file-text` (bem mais estável/antigo), com aviso no console via `getIcon()` se algum dia faltar de novo

## [0.2.7]
### Adicionado
- Internacionalização completa da interface (`src/i18n.ts`): comandos, menus, Ajustes, Notices e o modal de confirmação agora seguem o idioma do Obsidian (pt/en, via `moment.locale()`), em vez de texto fixo em português
### Mudado
- Menu "Mover para dia…" agora usa `moment` (localizado) pros nomes dos dias, igual ao cabeçalho da coluna — removido o último uso do array fixo em português

## [0.2.6]
### Adicionado
- Ícone (`square-text`, lucide) ao lado do título quando a nota tem texto além do frontmatter
### Mudado
- Cabeçalho da coluna: data agora mostra "28 Ago"/"28 Aug" (via `moment`, localizado pelo idioma do Obsidian) em vez de "08-28"; fonte maior
- Dia da semana no cabeçalho agora em negrito, também via `moment` localizado, em vez do array fixo em português — "Mover para dia…" no menu ⋮ continua com nomes fixos em português por enquanto

## [0.2.5]
### Adicionado
- Aviso (Notice) quando uma nota mestre tem regra "perigosa" — sem `BYDAY`/`BYMONTHDAY`/`BYMONTH` explícito e sem o campo `date` — que ficaria ancorada no dia em que o plugin rodou pela primeira vez, em vez da data pretendida. `FREQ=DAILY` nunca dispara o aviso (nunca é ambíguo)
### Mudado
- **Campos do frontmatter agora em inglês**, pensando em uma eventual publicação do plugin no futuro: `serie_id`→`series_id`, `titulo`→`title`, `cor`→`color`, `data`→`date`, `data_original`→`original_date`, `ordem`→`order`. `rrule` e `status` não mudaram (já eram iguais nos dois idiomas). **Quebra retrocompatibilidade** — notas já existentes precisam ter os campos renomeados manualmente antes de atualizar

## [0.2.4]
### Adicionado
- Campo `data` (opcional) na nota mestre — data de referência da recorrência (equivale ao `DTSTART` do iCalendar). Corrige regras que não repetem toda semana (ex: `FREQ=YEARLY` puro, sem `BYMONTH`/`BYMONTHDAY`) ficarem ancoradas no dia em que o plugin rodou pela primeira vez, em vez da data real pretendida
- `ics-para-templates.mjs`: agora preenche `data` automaticamente a partir do `DTSTART` do evento original do Google Agenda

## [0.2.3]
### Adicionado
- Confirmação (modal) antes de "Apagar de verdade", com opção de desligar nos Ajustes
- Avisos visíveis (Notice, não só console) quando: ocorrências são geradas, uma RRULE é inválida, ou a criação de uma nota falha
- Comando "Gerar ocorrências agora" na paleta de comandos (`Ctrl+P`) — não precisa mais fechar/reabrir o Obsidian pra forçar a geração
- Configuração de estilo de cor do card (borda lateral / borda ao redor / preenchimento) — estrutura pronta, visual ainda básico (refinamento estético fica pra fase futura, em outro chat)

## [0.2.2]
### Removido
- Sistema de exceções (campo `excecoes` na nota mestre, introduzido na 0.2.0) — descoberto ser redundante com o soft-delete e, pior, contraditório com "Apagar de verdade": apagar uma ocorrência pra forçá-la a regenerar (ex: depois de mudar a cor no template) não devia bloquear a própria regeneração que se queria
### Mudado
- "Apagar de verdade" agora sempre libera a vaga da série pra ser regenerada (antes registrava uma exceção que impedia isso)

## [0.2.1]
### Removido
- Setas ▲/▼ de reordenar no card — no Obsidian mobile, segurar e arrastar o card já funciona como no desktop, então as setas eram redundantes
### Mudado
- "Mover para cima"/"Mover para baixo" viraram itens do menu ⋮
- Botão "×" (apagar) saiu do card e virou item "Apagar" dentro do menu ⋮, junto com "Apagar de verdade"
- Menu ⋮: "Mover para dia…" agora abre um segundo menu com os dias, em vez de listar os 7 dias direto no menu principal (ficava muito extenso)

## [0.2.0]
### Adicionado
- Campo `status` no frontmatter (`done`, `deleted`, ou ausente = pendente), substituindo o antigo `concluida: boolean`
- Soft-delete: apagar uma tarefa marca `status: deleted` em vez de remover a nota — isso mantém a vaga da série "ocupada" pro gerador de recorrência, sem precisar de exceção
- Item "Apagar de verdade" no menu ⋮ (remove a nota de verdade; se for de série, registra exceção na nota mestre antes)
- Campo `ordem` no frontmatter + reordenar tarefas dentro do mesmo dia (drag-and-drop no desktop, reatribuindo `ordem` sequencial)
- Pasta de templates (`Templates/`) virou configurável nos Ajustes, com autocomplete de pastas existentes (igual à pasta de tarefas, que já era configurável)
- Varredura de subpastas dentro de `Templates/` e `Tarefas/` (antes só olhava o nível raiz da pasta)
### Corrigido
- Cor customizada (`cor` no frontmatter) não aparecia nas ocorrências geradas — hex sem aspas (`cor: #3388FF`) vira comentário em YAML por causa do `#`; corrigido escrevendo sempre entre aspas
- `vault.create()` falhava silenciosamente se a pasta de destino não existisse ainda

## [0.1.0]
### Adicionado
- Esqueleto inicial do plugin (manifest, build via esbuild, `rrule` como dependência)
- Geração de ocorrências recorrentes a partir de notas mestre (`serie_id` + `rrule`), disparada no `onLayoutReady()`, com horizonte configurável (padrão: 14 dias)
- View de grid semanal customizada via `registerBasesView` (Bases): 6 colunas (segunda–sexta + sábado/domingo empilhados), navegação entre semanas, Someday
- Criação de tarefa inline, drag-and-drop entre dias, concluir/apagar
- Suporte a mobile: `isDesktopOnly` removido, colunas empilham verticalmente em telas estreitas, botões de ação sempre visíveis em touch (não só no hover)
