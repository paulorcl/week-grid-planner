import { App, TFile, moment } from "obsidian";

export type LogSeverity = "info" | "warning" | "error";

/** Oldest entries are trimmed once the file would exceed this size. ~200KB is many hundreds of entries — likely months of activity for a personal vault. */
const MAX_LOG_BYTES = 200_000;

const SEVERITY_MARKER: Record<LogSeverity, string> = {
	info: "",
	warning: "⚠️ ",
	error: "❌ ",
};

/**
 * Appends one entry to the plugin's activity log — everything it does on
 * its own (occurrence generation, auto-cleanup) plus anything it does on
 * request that touches the vault (manual deletes, cleanup), so there's a
 * durable record beyond a Notice that can be missed or a console message
 * that needs DevTools open to see. Newest entries go at the top, so the
 * most recent activity is always the first thing visible on opening the
 * note. A no-op if logging is off or the path is blank — callers don't
 * need to check settings.activityLogEnabled themselves before calling
 * this. Logging failures are also swallowed (a console.error only, no
 * Notice) — writing to the log must never be allowed to break the actual
 * operation it's logging.
 */
export async function writeLog(
	app: App,
	enabled: boolean,
	path: string,
	title: string,
	options: { severity?: LogSeverity; details?: string[] } = {},
): Promise<void> {
	if (!enabled || !path.trim()) return;

	try {
		const { severity = "info", details = [] } = options;
		const timestamp = moment().format("YYYY-MM-DD HH:mm");
		const lines = [`### ${timestamp} — ${SEVERITY_MARKER[severity]}${title}`];
		for (const detail of details) lines.push(`- ${detail}`);
		const entry = lines.join("\n");

		const file = app.vault.getAbstractFileByPath(path);
		let body = "";
		if (file instanceof TFile) {
			const existing = await app.vault.read(file);
			// Strip the leading "# Week Grid Planner Log" heading (and the
			// blank line(s) after it) — re-added below, so the file always
			// starts with exactly one, regardless of how many times this runs.
			body = existing.replace(/^# Week Grid Planner Log\n+/, "");
		}

		let combined = body ? `${entry}\n\n${body}` : entry;
		if (combined.length > MAX_LOG_BYTES) {
			const truncated = combined.slice(0, MAX_LOG_BYTES);
			// Cut back to the last complete entry boundary, so trimming
			// never leaves a half-written entry dangling at the end.
			const lastBoundary = truncated.lastIndexOf("\n### ");
			combined = lastBoundary > 0 ? truncated.slice(0, lastBoundary) : truncated;
		}

		const finalContent = `# Week Grid Planner Log\n\n${combined}\n`;
		if (file instanceof TFile) {
			await app.vault.modify(file, finalContent);
		} else {
			await app.vault.create(path, finalContent);
		}
	} catch (error) {
		console.error("Week Grid Planner: failed to write to the activity log.", error);
	}
}
