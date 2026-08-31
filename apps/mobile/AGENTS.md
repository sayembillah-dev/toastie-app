# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# This app is a workspace package

`@toastly/mobile` lives in the same pnpm workspace as the API and the web app. Two
consequences worth knowing before you touch anything:

- **Authorization comes from `@toastly/access`, never a copy.** The same `can()` the Nest
  guards run answers the render decision here, against a `PermissionSubject` built the same
  way (`src/session/subject.ts` mirrors `apps/web/src/lib/permissions/subject.ts` and
  `SubjectFactory.toSubject` in the API). Do not restate a permission rule in a screen, and
  do not vendor the engine — a second copy is exactly the drift this arrangement removes.
  `packages/access/dist` must be built (`pnpm build:packages`) before this app typechecks.
- **Run scripts through the workspace.** `pnpm --filter @toastly/mobile <script>`, or
  `pnpm dev:mobile` from the root. Install dependencies with `pnpm`, from the root — there
  is no separate lockfile here.

Metro needs no monorepo configuration: `expo/metro-config` resolves workspace symlinks on
its own from SDK 52, and isolated pnpm installs are supported from SDK 54.
