<!-- Keep this short; delete sections that don't apply. -->

## What & why

<!-- The change and the problem it solves. Link the issue / roadmap item. -->

## Verification

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass
- [ ] For a bug fix: a failing test was added first (`core/` → node,
      rendering → `test/dom/`), or — if only reproducible in the live app —
      the repro + the `docs/verifying.md` line that catches it are noted below
- [ ] Touches the rendering path (slide HTML / CSS injection / speaker IPC)?
      Ran `/security-review` — this plugin renders content from other
      people's notes
- [ ] Structural change? `docs/architecture.md` updated in this PR
- [ ] Shipping a roadmap item / release? CHANGELOG.md **and** the Inkdrop
      roadmap + release-log notes updated (see AGENTS.md touchpoints)
- [ ] Depends on undocumented Inkdrop internals? Re-verified per
      `docs/canary-upgrade.md`

<!-- In-app verification an agent can't run: paste the docs/verifying.md
     steps you exercised, or note which a human still needs to run. -->
