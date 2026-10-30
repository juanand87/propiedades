const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  ts = require('typescript');
const source = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/lib/estate-api.ts'),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const target = {};
new Function('exports', 'process', js)(target, process);
assert.equal(
  target.price('99999999999999.1234', 'UF'),
  'UF 99.999.999.999.999,1234',
);
assert.equal(target.price('150000000.0000', 'CLP'), '$150.000.000');
assert.equal(target.price('1200.1000', 'UF'), 'UF 1.200,1');
assert.equal(target.price(null, 'UF'), 'Precio por definir');
assert.equal(target.price('NaN', 'UF'), 'Precio por definir');
console.log('5 comprobaciones de formato monetario exacto: correctas.');
