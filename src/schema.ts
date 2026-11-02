/**
 * Week Grid Planner frontmatter schema.
 *
 * Master note (masters folder):
 *   master_id: string
 *   rrule: string          — iCalendar RRULE. Tip: BYMONTHDAY=-1 = last day of the month
 *                          (works natively, no special handling needed — 31, -1, etc.
 *                          follow the standard RFC 5545/rrule.js semantics).
 *   title: string
 *   color?: string        — "#RRGGBB" (always quoted — unquoted # breaks YAML)
 *   date?: string          — "YYYY-MM-DD", recurrence anchor date (like iCalendar's DTSTART).
 *                          Recommended whenever the rule has no explicit BYDAY/BYMONTHDAY/
 *                          BYMONTH (e.g. yearly birthdays) — without it the anchor defaults
 *                          to whatever day the plugin first ran, which is unpredictable.
 *
 *   Anything else on the master — body text below the frontmatter, extra
 *   frontmatter properties (e.g. `urgency: !!!`), and tags other than the
 *   plugin's own master tag (e.g. `#home`, `#work`) — is copied onto each
 *   new occurrence when it's generated. Only applies going forward, same as
 *   every other master field: editing a master never touches occurrences
 *   already generated from it (see "no bulk editing" in generateOccurrences()).
 *
 * Occurrence note (tasks folder):
 *   master_id?: string
 *   date: string           — "YYYY-MM-DD", where the task is shown today (changes on drag)
 *   original_date?: string — "YYYY-MM-DD", the master's fixed slot (never changes)
 *   color?: string
 *   status?: string        — "pending" | "done" | "cancelled" | "deleted"
 *                          New notes get "pending" explicitly; notes created before this field
 *                          existed may have it absent, which means the same thing as "pending".
 *                          "cancelled" = "won't do" — still counts as a real, visible task (not
 *                          hidden like "deleted"), just excluded from "pending" bulk actions like
 *                          bringing overdue tasks to today. Rendering (strikethrough/red/both) is
 *                          controlled by WeekGridPlannerSettings.cancelledTaskStyle.
 *   order?: number         — position within the day (lower = higher up)
 */

export const STATUS_PENDING = "pending";
export const STATUS_DONE = "done";
export const STATUS_CANCELLED = "cancelled";
export const STATUS_DELETED = "deleted";

export interface MasterNote {
	master_id: string;
	rrule: string;
	title: string;
	color?: string;
	date?: string;
	/** Frontmatter properties beyond the ones above, copied verbatim onto new occurrences (e.g. `urgency: "!!!"`) . */
	extraFrontmatter: Record<string, unknown>;
	/** Tags other than the plugin's own master tag, copied onto new occurrences (e.g. `home`, `work`). */
	extraTags: string[];
	/** Body text below the frontmatter, copied onto new occurrences as-is. */
	body: string;
}

export interface TaskOccurrence {
	master_id?: string;
	date: string;
	original_date?: string;
	color?: string;
	status?: string;
	order?: number;
}

export function formatIsoDate(d: Date): string {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
