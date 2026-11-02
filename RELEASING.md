# Releasing

A release is a git tag that exactly matches the version in `manifest.json` (no `v` prefix). Pushing the tag makes GitHub Actions build the plugin and publish a release with `main.js`, `manifest.json` and `styles.css` attached; BRAT and manual installs read those assets.

1. Bump the version in `manifest.json`, `package.json` and `package-lock.json` (the first two `"version"` lines).
2. Add a `## [x.y.z]` section to `CHANGELOG.md`; the release notes are taken from it.
3. Commit, then tag and push:

```
git add -A
git commit -m "Release x.y.z"
git tag x.y.z
git push origin main --tags
```

The workflow fails on purpose if the tag and `manifest.json` disagree. To redo a release, delete the tag locally and on GitHub (`git tag -d x.y.z` and `git push origin :refs/tags/x.y.z`), fix the problem, and tag again.
