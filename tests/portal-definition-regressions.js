/*
 * Focused checks for portal-definition normalization.
 * Run with: node tests/portal-definition-regressions.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('scripts/app.js', 'utf8');

function loadFunction(context, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Could not find ${name} in scripts/app.js`);
    const end = source.indexOf('\n/**', start);
    assert.notEqual(end, -1, `Could not find the end of ${name}`);
    vm.runInContext(source.slice(start, end), context, { filename: 'scripts/app.js' });
}

const context = vm.createContext({});
loadFunction(context, 'normalizePortalQuery');
loadFunction(context, 'migrateNodePortals');

const nodes = [{
    id: 'note-ui',
    portals: [
        { id: 'related', name: ' Related ', query: '#UI AND completion=done' },
        { id: 'related', name: 'Second', query: '#Other' }
    ],
    children: [{ id: 'note-child', children: [] }]
}];
context.migrateNodePortals(nodes);

assert.equal(nodes[0].portals[0].name, 'Related');
assert.equal(nodes[0].portals[0].query, '#ui AND completion=done');
assert.equal(nodes[0].portals[0].scope, 'notebook');
assert.deepEqual(JSON.parse(JSON.stringify(nodes[0].portals[0].presentation)), { mode: 'collapsed' });
assert.notEqual(nodes[0].portals[0].id, nodes[0].portals[1].id);
assert.deepEqual(JSON.parse(JSON.stringify(nodes[0].children[0].portals)), []);

console.log('Portal-definition regressions passed.');
