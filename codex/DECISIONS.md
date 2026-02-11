# Decisions Log

## 2026-02-10

1. **Scope containment decision**
   - Decision: Focus implementation on mission reliability and evaluator cohesion in frontend, not cross-cutting architecture refactor.
   - Rationale: User asked for concrete, code-verified action; this is high-value, low-risk, and directly grounded in observed brittleness.
   - Alternatives rejected: broad mission-system rewrite, Rust-side API changes.

2. **Verification strategy decision**
   - Decision: Treat `cargo check` failure as environment warning and proceed with TS/build validation.
   - Rationale: Failure root cause is missing system `glib-2.0`, not a code regression in this pass.
   - Alternatives rejected: adding fake stubs or skipping all verification.

3. **Mission spacecraft binding strategy**
   - Decision: Introduce `missionProgress.spacecraftId` and lazy-bind from selected spacecraft, then fallback to first spacecraft in frame.
   - Rationale: preserves current UX while decoupling mission success from later selection changes.
   - Alternatives rejected: forcing explicit mission craft picker modal (larger UX scope).

4. **Objective evaluator signature expansion**
   - Decision: Extend `checkObjective` with `elapsedTicks` to internalize `survive_time` logic.
   - Rationale: centralizes objective semantics and reduces split logic drift.
   - Alternatives rejected: keep special-casing in panel.
