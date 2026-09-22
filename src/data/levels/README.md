The active campaign is `campaign/campaign-v1.json`: one concrete, validated bundle
of Levels 1–50. The runtime registry imports only this bundle.

Levels 1–10 are authored in `campaign/handcrafted.ts`. Levels 11–50 are generated
before shipping using `src/domain/levels/{profiles,plan,generator}.ts`.

- `npm run levels:build`: deliberately rebuild the concrete artifact.
- `npm run levels:check`: check exact deterministic reproduction without writes.
- `npm run levels:validate`: validate every shipped level; exits nonzero on failure.
- `node scripts/validate-levels.cjs --report`: refresh the Markdown/JSON report.

Preserve published generation versions. For a changed campaign algorithm, bump
`LEVEL_GENERATION_VERSION`, retain the old concrete bundle and deliberately select
the new bundle in the registry. Runtime never generates or silently rerolls levels.

`phase1.ts` retains three legacy fixtures used by regression tests for the original
engine behavior. These fixtures are not imported into the runtime progression.
