# Changelog Draft

## Theme: Mission reliability
- Added dedicated mission spacecraft binding (`missionProgress.spacecraftId`) to decouple objective progression from transient selection changes.
- Refactored mission evaluation loop to lazily bind a spacecraft (selected spacecraft preferred, fallback to first available spacecraft).
- Unified objective evaluation by extending `checkObjective` to handle `survive_time` using elapsed ticks.

## Theme: Session auditability
- Added and maintained codex execution artifacts:
  - `codex/SESSION_LOG.md`
  - `codex/PLAN.md`
  - `codex/DECISIONS.md`
  - `codex/CHECKPOINTS.md`
  - `codex/VERIFICATION.md`
  - `codex/CHANGELOG_DRAFT.md`
