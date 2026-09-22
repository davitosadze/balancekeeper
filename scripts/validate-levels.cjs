require('./register-typescript.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { validateLevelConfig } = require('../src/domain/levels/validation.ts');
const { LEVEL_GENERATION_VERSION } = require('../src/domain/levels/profiles.ts');
const configs = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/data/levels/campaign/campaign-v${LEVEL_GENERATION_VERSION}.json`),'utf8'));
const ids = configs.map(c => c.id);
if (configs.length !== 50 || ids.some((id,i) => id !== i+1) || new Set(ids).size !== 50) throw new Error('Campaign must contain exactly ordered Levels 1–50');
const rows = configs.map(config => {
  const result = validateLevelConfig(config, { campaign: true, nodeLimit: 12000 });
  return { level: config.id, type: config.kind, difficulty: config.difficulty, bottles: config.bottles.length,
    weights: config.weights.length, mechanics: config.mechanics.join(', '), minimumMoves: result.solver?.minimumMoves ?? null,
    twoStarMaxMoves: config.stars.twoStarMaxMoves, threeStarMaxMoves: config.stars.threeStarMaxMoves,
    solvable: result.solver?.solvable ?? false, nodes: result.solver?.nodes ?? 0,
    regenerationAttempts: config.generation?.attempt ?? 0, errors: result.errors };
});
const header = '| Level | Type | Difficulty | Bottles | Weights | Mechanics | Min moves | 2 stars | 3 stars | Solvable | Nodes | Regenerations | Errors |';
const report = '# Campaign v1 validation\n\n' + header + '\n|' + Array(13).fill('---').join('|') + '|\n'
  + rows.map(row => '| ' + Object.values(row).map(value => Array.isArray(value) ? value.join('; ') || '—' : String(value)).join(' | ') + ' |').join('\n') + '\n';
console.log(report);
if (process.argv.includes('--report')) {
  fs.writeFileSync(path.resolve(__dirname,'../docs/level-validation.md'), report);
  fs.writeFileSync(path.resolve(__dirname,'../docs/level-validation.json'), JSON.stringify(rows,null,2)+'\n');
}
const failed = rows.filter(row => row.errors.length);
console.log(`${rows.length - failed.length}/50 valid. Maximum search: ${Math.max(...rows.map(r => r.nodes))} nodes.`);
if (failed.length) process.exitCode = 1;
