# Dashboard UI update — 11 October 2026

## Changes

- All dashboard pages inherit the same light palette, type scale, breakpoints and page spacing, including publishing, inbox and insights.
- Mobile page gutters and card padding are 16px; desktop card padding is 24px. Cards use a 16px radius, controls a 10px radius. Forms share a 768px maximum width, normal pages 1152px; the two-panel inbox can use 1400px.
- Long page titles and publishing helper text wrap. Small labels were raised to 12px. Mobile buttons have at least 44px height and icon buttons at least 44px width. Calendar days retain their compact seven-column layout.
- Overview scrolls naturally on short screens and landscape phones. Profile loading stays inside page content; missing accounts and failed profile requests have visible actions.
- The account menu is anchored to its button and constrained to the viewport. Navigation scrolls on short screens. The unavailable tickets link was removed.
- Confirmation dialogs and the automation editor use a shared MUI dialog with a portal, focus handling, Escape, scroll locking and disabled dismissal while saving/deleting.
- Inbox height follows the visible viewport, keyboard resizing, page padding and error banners. The floating account control is hidden on this route to leave the composer clear.
- Insights charts fit their container without shrinking axis typography. Values are available by touch, pointer and keyboard (arrows, Home, End, Escape). The date picker uses a viewport-constrained popover.
- The subscription indicator reads the current subscription instead of showing the repeating one-minute test countdown.
- `package-lock.json` is synchronized with the existing `package.json`; dependency declarations were not changed.

Settings and subscription pages retain their existing functional scope. This update does not add a payment system or a ticket backend, change database schema, or migrate data.

## Validation

Production build (`npm run build`) and TypeScript checks are run locally using a disposable localhost database URL and local authentication values. Prisma generation and the build do not require a live production database. `npm ci --dry-run --ignore-scripts --no-audit --no-fund` validates manifest/lockfile compatibility.

ESLint still reports pre-existing `no-explicit-any` errors in the automation and publishing components; the shared calendar now uses `DayPickerProps` instead of `any`. Production build and lint are separate checks.

Browser visual verification was not available because the Chrome bridge was disconnected. After deployment, check 320px, 360px, 390px and 430px widths, landscape, and desktop. Include long titles, account menu, confirmation dialogs, empty/error/loading states, the inbox keyboard, and touch/keyboard interaction with the chart.

## Pull and build

From a clean deployment checkout on `master`:

```sh
git pull --ff-only origin master
npm ci
npm run build
```

Use the existing deployment environment and restart/deploy with the project's usual process.

## Rollback

The exact pre-update state is preserved remotely on `backup/dashboard-ui-before-20261011` at `bac8323db4243f5631e277157aa484e51fd81f59`.

This update is delivered as one commit with subject `Unify dashboard UI and improve mobile layouts`. To undo it while preserving later history, find its hash and revert that commit from a clean `master` checkout:

```sh
git log --oneline --grep="Unify dashboard UI and improve mobile layouts"
git revert <dashboard-ui-commit-hash>
git push origin master
```

Then pull, install, rebuild and redeploy. Reverting also restores the previous lockfile. To inspect the previous version independently:

```sh
git fetch origin
git switch -c inspect-dashboard-before origin/backup/dashboard-ui-before-20261011
```

No force push or history reset is needed.
