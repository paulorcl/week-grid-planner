export interface TagConfig {
	/** Base tag, without '#'. Empty string = tagging off. */
	tag: string;
	/** Whether masters/tasks get "{tag}/masters" and "{tag}/tasks", or just the plain "{tag}". */
	useSuffixes: boolean;
}

/** The actual tag string a config resolves to for a given folder kind, or null if tagging is off. */
export function tagFor(config: TagConfig, kind: "masters" | "tasks"): string | null {
	if (!config.tag) return null;
	return config.useSuffixes ? `${config.tag}/${kind}` : config.tag;
}

export function tagConfigChanged(oldConfig: TagConfig, newConfig: TagConfig): boolean {
	return oldConfig.tag !== newConfig.tag || oldConfig.useSuffixes !== newConfig.useSuffixes;
}
