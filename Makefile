# AthlasX repeatable checks. Mirrors the npm scripts (package.json) — use
# whichever is more convenient; both invoke the same underlying commands.

.PHONY: audit-js audit-py sweep-injection check-api-contracts smoke-e2e audit-all

audit-js:
	npm audit

audit-py:
	cd Backend/AI && python -m pip_audit -r requirements.txt

sweep-injection:
	node scripts/check-sql-injection.mjs

check-api-contracts:
	node scripts/check-api-contracts.mjs

smoke-e2e:
	node scripts/smoke-e2e.mjs

audit-all: audit-js audit-py sweep-injection check-api-contracts
