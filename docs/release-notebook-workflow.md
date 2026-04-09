# Release workflow — notebook

## Prerequisites

- You are on the `main` branch with a clean working tree.
- All tests pass (`npm run test:run`).

---

## Steps

### Step 1 — Confirm tests and build are green

```sh
cd ~/projects/notebook
npm run test:run
npm run build
```

### Step 2 — Bump the version

```sh
npm version <major|minor|patch> --no-git-tag-version
```

This updates `package.json` only. It does **not** rewrite any source literals — that's intentional, because the CLI reads its version from `package.json` at runtime.

### Step 3 — Commit the version bump

```sh
git add package.json package-lock.json
git commit -m "chore(release): v<new-version>"
```

### Step 3.5 — Runtime version check

```sh
cd ~/projects/notebook
npm run build
node bin/notebook.js --version
```

Assert the output matches the version you just set in `package.json`. If it does not, **abort the release** and fix the source before continuing.

> Note: `npm version` only updates `package.json`. The CLI derives its reported version by reading `package.json` at runtime (`src/cli/index.ts`). If someone reintroduces a hardcoded version literal this check will catch it.

### Step 4 — Pack and verify the tarball

```sh
npm pack --dry-run
npm pack
```

Inspect the listed files and confirm `dist/` and `package.json` are included. The tarball will be named `notebook-md-<version>.tgz`.

### Step 5 — Install from tarball and smoke test

```sh
npm install -g ./notebook-md-<version>.tgz
notebook --version   # must match <new-version>
notebook list        # must exit 0
```

### Step 6 — Publish

```sh
npm publish ./notebook-md-<version>.tgz
```

### Step 7 — Tag and push

```sh
git tag v<new-version>
git push origin main --tags
```

### Step 8 — Clean up

Remove the local tarball if desired:

```sh
rm notebook-md-<version>.tgz
```
