require('./register-typescript.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { HANDCRAFTED_LEVELS } = require('../src/data/levels/campaign/handcrafted.ts');
const { generateLevel, difficultyScore } = require('../src/domain/levels/generator.ts');
const { validateLevelConfig } = require('../src/domain/levels/validation.ts');
const { LEVEL_GENERATION_VERSION } = require('../src/domain/levels/profiles.ts');

const configs = HANDCRAFTED_LEVELS.map(config => {
  const result = validateLevelConfig(config, { campaign: true });
  if (!result.valid) throw new Error(`Level ${config.id}: ${result.errors.join('; ')}`);
  return { ...config, minimumMoves: result.solver.minimumMoves, difficultyScore: difficultyScore(config, result.solver.minimumMoves) };
});
for (let id=11;id<=50;id++) {
  const config = generateLevel(id); configs.push(config);
  console.log(`Level ${id}: ${config.difficulty}, ${config.minimumMoves} moves, candidate ${config.generation.attempt+1}`);
}
const filename = path.resolve(__dirname, `../src/data/levels/campaign/campaign-v${LEVEL_GENERATION_VERSION}.json`);
const contents = JSON.stringify(configs, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(filename) || fs.readFileSync(filename,'utf8') !== contents) throw new Error('Campaign output is stale or not reproducible. Rebuild intentionally and bump generation version for published changes.');
  console.log('All 50 configs exactly reproduce the shipped artifact.');
} else {
  fs.writeFileSync(filename, contents); console.log(`Wrote ${configs.length} concrete level configs to ${path.basename(filename)}`);
}
