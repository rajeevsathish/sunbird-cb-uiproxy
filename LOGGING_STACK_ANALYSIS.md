# Logging Stack Analysis: morgan, pino, chalk

Date: 2026-03-21
Repository: sunbird-cb-uiproxy

## Summary

This repo currently has mixed logging-related dependencies:

1. morgan is actively used in runtime request logging.
2. pino is actively used in application logging wrappers.
3. chalk is not used in current TypeScript source, but appears in checked-in dist artifacts from an older build output.

## Where morgan is used

Active source usage:
- src/server.ts
  - import morgan from 'morgan'
  - this.app.use(morgan('short'))

Package entries:
- package.json
  - dependencies.morgan
  - devDependencies.@types/morgan

Assessment:
- morgan is used for HTTP access logs at Express middleware layer.
- This is valid and common for request/response logging.

## Where pino is used

Active source usage:
- src/utils/logger.ts
  - import pino from 'pino'
  - logger wrapper functions: logDebug, logInfo, logWarn, logError, logSuccess
- src/utils/fileLogger.ts
  - separate custom pino writer to file stream

Package entries:
- package.json
  - dependencies.pino
  - dependencies.pino-pretty
  - devDependencies.@types/pino

Assessment:
- pino is the primary app logger abstraction in current source.
- There are two pino patterns:
  1) central wrapper in src/utils/logger.ts
  2) file-stream variant in src/utils/fileLogger.ts
- This is workable, but consolidation to one pattern is recommended for consistency.

## Where chalk is used

TypeScript source:
- No direct chalk usage found in src/**/*.ts

Compiled artifacts:
- dist/utils/logger.js includes chalk-based logging
- dist/package.json still lists chalk

Package entries:
- package.json includes dependencies.chalk

Assessment:
- chalk appears to be legacy from an older logger implementation that is still present in dist output.
- Current source logger (src/utils/logger.ts) uses pino and does not import chalk.

## Why this situation exists

Most likely flow:
1. Older implementation used chalk in logger.
2. Source was later migrated to pino-based logger.
3. Existing dist folder still contains old compiled output, so chalk remains visible there.

## Risks

1. Dependency drift:
- package.json suggests chalk is required even if source no longer uses it.

2. Runtime ambiguity:
- If deployment uses stale dist artifacts, behavior can differ from current source.

3. Logging inconsistency:
- morgan + pino + legacy fileLogger path may produce mixed formats.

## Recommendations

### Priority 1
1. Decide canonical runtime entry:
- Source-built dist from current code only.
2. Rebuild dist cleanly and verify chalk disappears from dist logger output.

### Priority 2
1. Keep morgan for access logs.
2. Keep pino for application logs.
3. Standardize log format and level mapping between morgan and pino outputs.

### Priority 3
1. If no source usage remains after clean build:
- remove chalk from package.json
- remove any dist/package.json stale dependency references

### Priority 4
1. Evaluate whether src/utils/fileLogger.ts is still needed.
2. If not needed, converge to src/utils/logger.ts only.

## Suggested validation checklist

1. grep for chalk in src and fresh dist output.
2. run application and confirm:
- access logs via morgan
- app logs via pino wrapper
3. verify no duplicate or conflicting log formats.
4. confirm dependencies are minimal and accurate.

## Quick conclusion

- morgan: actively used and valid.
- pino: actively used and should remain primary app logger.
- chalk: legacy/stale via dist artifacts, not active in TypeScript source; likely removable after clean build verification.
