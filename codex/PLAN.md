# Delta Plan

## A) Executive Summary

### Current state (repo-grounded)
1. App is a Tauri desktop simulator with Rust simulation core and React/Three.js frontend (`src-tauri/src/lib.rs`, `src/App.tsx`).
2. Simulation loop runs continuously at fixed cadence and emits event frames/collisions (`src-tauri/src/lib.rs`).
3. Physics supports brute-force, Barnes-Hut, and GPU compute acceleration (`src-tauri/src/simulation.rs`, `src-tauri/src/barneshut.rs`, `src-tauri/src/gpu_gravity.rs`).
4. Mission logic is implemented in frontend with objective checks and progress tracking (`src/components/MissionPanel.tsx`, `src/missions/MissionDefinition.ts`, `src/store.ts`).
5. Mission progress currently depends on `selectedBodyId` for objective evaluation, creating brittle semantics if selection changes (`src/components/MissionPanel.tsx`).
6. Save/load/share flows exist but rely on console-only error reporting (`src/components/SaveLoadButtons.tsx`, `src/utils/sharing.ts`).
7. TS compile and Vite production build pass; Rust check is environment-blocked due to missing `glib-2.0` (`codex/VERIFICATION.md`).

### Key risks
- Selection-coupled mission tracking leads to false negatives/positives in objective completion.
- Split logic for `survive_time` objective across files increases maintenance risk.
- Environment dependency prevents validating Rust compile in this container.

### Improvement themes (prioritized)
1. Mission objective reliability + deterministic tracking semantics.
2. Mission objective evaluator cohesion (single path for objective types).
3. Auditable engineering trail for interruption/resume and execution evidence.

## B) Constraints & Invariants (Repo-derived)

### Explicit invariants
- Do not change Tauri command names/signatures without strong need.
- Maintain existing scenario IDs and mission IDs.
- Keep frontend state shape backward-compatible where feasible.

### Inferred invariants
- Mission completion should reflect mission intent, not transient UI selection.
- Objective evaluation should be centralized to reduce drift bugs.
- Existing keyboard/place/slingshot workflows must keep working.

### Non-goals
- No broad physics model rewrite.
- No packaging/CI overhaul in this pass.
- No conversion to server/shared mission engine.

## C) Proposed Changes by Theme (Prioritized)

### Theme 1: Mission objective reliability
- Current approach: objective checks use `selectedBodyId` as mission craft (`src/components/MissionPanel.tsx`).
- Proposed change: track dedicated `spacecraftId` in `MissionProgress`; auto-bind mission spacecraft once and use it consistently.
- Why: removes coupling to incidental selection changes.
- Tradeoffs: introduces one additional field in mission progress object.
- Scope boundary: only mission store/types/panel logic; no Tauri API changes.
- Migration: field defaults to `null` and auto-populates at runtime.

### Theme 2: Objective evaluator cohesion
- Current approach: `survive_time` handled in panel logic while other types use `checkObjective`.
- Proposed change: pass objective evaluation context to `checkObjective` and handle `survive_time` there too.
- Why: single evaluation path lowers drift risk.
- Tradeoffs: updated function signature at call site.
- Scope boundary: frontend mission modules only.
- Migration: update all call sites in one commit.

### Theme 3: Resume-hardened execution artifacts
- Current approach: no codex session artifact set existed.
- Proposed change: maintain `codex/*` files for plan/log/decisions/checkpoints/verification/changelog.
- Why: interruption-safe and auditable delivery trail.
- Tradeoffs: docs-only overhead.
- Scope boundary: additive docs only.

## D) File/Module Delta (Exact)

### ADD
- `codex/SESSION_LOG.md` — running activity log and GO/NO-GO gate.
- `codex/PLAN.md` — structured delta plan.
- `codex/DECISIONS.md` — explicit judgment calls.
- `codex/CHECKPOINTS.md` — required checkpoints and rehydration summaries.
- `codex/VERIFICATION.md` — command outcomes.
- `codex/CHANGELOG_DRAFT.md` — pre-delivery change summary draft.

### MODIFY
- `src/missions/MissionDefinition.ts` — unify objective evaluator handling.
- `src/store.ts` — extend mission progress contract for dedicated spacecraft binding.
- `src/components/MissionPanel.tsx` — bind mission spacecraft and use unified objective evaluation.

### REMOVE/DEPRECATE
- None.

### Boundary rules
- Allowed: `src/components` ↔ `src/missions` ↔ `src/store`.
- Forbidden in this pass: changes to Rust/Tauri command contract or simulation stepping core.

## E) Data Models & API Contracts (Delta)

### Current
- `MissionProgress` contains `missionId`, `objectiveStatus`, `startTick`, `completed`, `failed` (`src/missions/MissionDefinition.ts`).

### Proposed
- Add `spacecraftId: number | null` to `MissionProgress`.
- Update initial mission progress creation and mission evaluation use.

### Compatibility
- Backward-compatible for runtime state: new field nullable.
- No external API contract/versioning changes.

### Migrations
- Runtime-only store state; no persisted DB migration needed.

### Versioning strategy
- Keep additive and optional (`null` default), minimizing save/load disruption.

## F) Implementation Sequence (Dependency-Explicit)

1. **Step S1: Artifact scaffolding + checkpointing setup**
   - Files: `codex/*`
   - Preconditions: baseline discovery complete
   - Verification: none (docs only)
   - Rollback: remove codex files

2. **Step S2: Extend mission progress model**
   - Files: `src/missions/MissionDefinition.ts`, `src/store.ts`
   - Preconditions: S1 complete
   - Verification: `pnpm -s tsc --noEmit`
   - Rollback: revert model field + store init

3. **Step S3: Refactor mission panel evaluator usage**
   - Files: `src/components/MissionPanel.tsx`, `src/missions/MissionDefinition.ts`
   - Preconditions: S2 complete
   - Verification: `pnpm -s tsc --noEmit`, `pnpm -s vite build`
   - Rollback: revert panel/evaluator signatures

4. **Step S4: End-to-end hardening pass + docs update**
   - Files: `codex/*`
   - Preconditions: S3 green
   - Verification: full available suite (`tsc`, `vite build`, `cargo check` expected env warning)
   - Rollback: revert latest docs updates only

## G) Error Handling & Edge Cases

### Current patterns
- Mission evaluation guards null frame/progress/mission.
- Failures in UI utilities are often console-only.

### Proposed improvements in scope
- Mission craft binding edge cases:
  - no spacecraft available → progress remains unbound (`spacecraftId=null`) and objectives remain pending.
  - selected non-spacecraft body → ignore for mission binding.
  - bound spacecraft removed → evaluator naturally fails objective checks; mission can still fail by time limit.

### Tests/verification coverage in this pass
- Type-level and build verification via TS compile + Vite build.

## H) Integration & Testing Strategy

- Integration points: store mission progress initialization + mission panel objective loop.
- Unit tests: not added this pass (no test harness present yet); deferred to dedicated testing theme.
- Regression check: ensure app compiles and bundles post-change.
- Definition of Done:
  - Mission logic no longer depends directly on transient selection for objective evaluation after initial binding.
  - `survive_time` objective evaluation handled via shared function.
  - Verification logs and checkpoints complete.

## I) Assumptions & Judgment Calls

### Assumptions
- Mission panel is the sole active writer to mission progress lifecycle.
- Additive `MissionProgress` field does not break consumers (single codebase usage).

### Judgment calls
- Chose incremental frontend-only reliability fix instead of larger mission engine rewrite.
- Kept Rust untouched due scope and environment compile blocker.
