export interface ColorPaletteEntry {
	name: string;
	hex: string;
}

/**
 * Resolves a task/master's `color` frontmatter value: a literal hex
 * (starts with "#") passes through unchanged, otherwise it's looked up by
 * name in the palette. An unmatched name resolves to undefined (no color
 * applied — same as no color being set at all) rather than being passed
 * through as an invalid CSS value.
 */
export function resolveColor(value: string | undefined, palette: ColorPaletteEntry[]): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (trimmed.startsWith("#")) return trimmed;
	return palette.find((entry) => entry.name === trimmed)?.hex;
}

/** Obsidian's standard cross-theme color variables — used as theme-collision fallbacks, since every theme defines these consistently. */
const THEME_COLOR_VARS = [
	"--color-orange",
	"--color-yellow",
	"--color-purple",
	"--color-pink",
	"--color-cyan",
	"--color-green",
	"--color-red",
	"--color-blue",
];

/**
 * Resolves arbitrary CSS color values (hex, named colors, var()
 * references) to a canonical "rgb(r, g, b)" string via a live, hidden
 * probe element attached to the real DOM — the only reliable way to
 * compare colors given in different formats, or to know what a CSS
 * variable actually resolves to under the vault's current theme. Needs a
 * real attached element (not a detached one) so inherited custom
 * properties like --interactive-accent resolve correctly.
 */
export class ColorResolver {
	private probeEl: HTMLElement;

	constructor(parentEl: HTMLElement) {
		this.probeEl = parentEl.createDiv({ cls: "wgp-color-probe" });
	}

	canonicalize(cssValue: string): string {
		this.probeEl.style.color = "";
		this.probeEl.style.color = cssValue;
		return getComputedStyle(this.probeEl).color;
	}

	/** "#000000" or "#ffffff", whichever contrasts better against `cssValue" (simple YIQ perceived-brightness check). */
	getContrastText(cssValue: string): string {
		const match = this.canonicalize(cssValue).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
		if (!match) return "#000000";
		const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
		const yiq = (r * 299 + g * 587 + b * 114) / 1000;
		return yiq >= 128 ? "#000000" : "#ffffff";
	}

	/**
	 * For each of `avoidCssValues` that `cssValue` collides with (e.g. a
	 * task color matching the card's own resting background, or today's
	 * highlight), tries Obsidian's standard theme colors in order and
	 * returns the first one that's distinct from all of them under the
	 * current theme. Returns `cssValue` unchanged if it doesn't collide
	 * with anything in the list.
	 */
	avoidCollision(cssValue: string, avoidCssValues: string[]): string {
		const avoid = avoidCssValues.map((value) => this.canonicalize(value));
		if (!avoid.includes(this.canonicalize(cssValue))) return cssValue;

		for (const themeVar of THEME_COLOR_VARS) {
			const candidate = `var(${themeVar})`;
			if (!avoid.includes(this.canonicalize(candidate))) return candidate;
		}
		return cssValue;
	}

	/**
	 * Picks a column background distinct from the card's own background
	 * under the current theme. Tries Obsidian's semantic tokens in order
	 * (--background-secondary, then --background-primary-alt) — some
	 * themes set --background-secondary equal to --background-primary,
	 * which would otherwise make every non-today column visually flat
	 * against its own cards, with no way to tell where one card ends and
	 * the column background begins.
	 */
	pickColumnBackground(cardBackgroundCssValue: string): string {
		const candidates = ["var(--background-secondary)", "var(--background-primary-alt)"];
		const cardBg = this.canonicalize(cardBackgroundCssValue);
		for (const candidate of candidates) {
			if (this.canonicalize(candidate) !== cardBg) return candidate;
		}
		// Both candidates collide with the card background — an unusual
		// theme, but give up gracefully rather than throw.
		return candidates[0];
	}
}
