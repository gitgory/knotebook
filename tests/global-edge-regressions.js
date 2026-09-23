/*
 * Focused regressions for project-wide edges in destructive operations.
 * Run with: node tests/global-edge-regressions.js
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

function makeContext(values = {}) {
    return vm.createContext({ console, ...values });
}

function node(id, children = []) {
    return {
        id,
        title: id,
        content: '',
        hashtags: [],
        fields: {},
        position: { x: 0, y: 0 },
        zIndex: 0,
        children,
        created: '2026-09-22T00:00:00.000Z',
        modified: '2026-09-22T00:00:00.000Z'
    };
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function testParentDeletionPromotesChildrenAndRetainsRemoteEdges() {
    const child = node('child');
    const parent = node('parent', [child]);
    const remote = node('remote');
    const state = {
        nodes: [parent, remote],
        projectEdges: [
            { from: 'parent', to: 'remote', directed: true },
            { from: 'child', to: 'remote', directed: true }
        ],
        edges: [],
        selectedNodes: ['parent'],
        selectedEdge: null,
        nodeIndex: new Map([['parent', parent], ['remote', remote]]),
        undoSnapshot: null
    };
    state.edges = state.projectEdges;
    const context = makeContext({
        state,
        NODE_HEIGHT: 60,
        CHILD_NODE_VERTICAL_OFFSET: 20,
        CHILD_NODE_STAGGER: 10,
        render: () => {},
        requestAutoSave: () => {}
    });
    ['clonePortalDefinitions', 'deepCopyNodeForUndo', 'createUndoSnapshot', 'getNodeById', 'rebuildNodeIndex', 'deleteNode']
        .forEach(name => loadFunction(context, name));

    context.deleteNode('parent');

    assert.deepEqual(state.nodes.map(item => item.id).sort(), ['child', 'remote']);
    assert.deepEqual(state.projectEdges, [{ from: 'child', to: 'remote', directed: true }]);
}

function testSubtreeCopyRemapsOnlyInternalEdges() {
    let nextId = 0;
    const parent = node('parent', [node('child')]);
    parent.portals = [{
        id: 'portal-parent-1',
        name: 'Related',
        query: '#related',
        scope: 'notebook',
        presentation: { mode: 'collapsed' }
    }];
    const context = makeContext({
        generateId: () => `copy-${++nextId}`
    });
    ['clonePortalDefinitions', 'deepCopyNode', 'createNodeCopiesWithMapping', 'filterAndRemapEdges']
        .forEach(name => loadFunction(context, name));

    const copied = context.createNodeCopiesWithMapping(['parent'], [parent]);
    const edges = context.filterAndRemapEdges([
        { from: 'parent', to: 'child', directed: true },
        { from: 'child', to: 'remote', directed: true }
    ], copied.idMapping);

    assert.equal(copied.nodes[0].children.length, 1);
    assert.deepEqual(plain(copied.nodes[0].portals), parent.portals);
    assert.deepEqual(plain(edges), [{
        from: copied.idMapping.parent,
        to: copied.idMapping.child,
        directed: true
    }]);
}

function testCrossNotebookMoveRetainsOnlyMovedSubtreeEdges() {
    let nextId = 0;
    const sourceParent = node('parent', [node('child')]);
    const sourceRemote = node('remote');
    const sourceProject = {
        version: 2,
        nodes: [sourceParent, sourceRemote],
        edges: [
            { from: 'parent', to: 'child', directed: true },
            { from: 'child', to: 'remote', directed: true }
        ]
    };
    const storage = new Map([['project-source', JSON.stringify(sourceProject)]]);
    const context = makeContext({
        generateId: () => `moved-${++nextId}`,
        STORAGE_KEY_PREFIX: 'project-',
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value)
        },
        migrateProjectEdges: project => ({ edges: project.edges, invalidCount: 0 }),
        updateProjectNoteCount: () => {}
    });
    ['clonePortalDefinitions', 'deepCopyNode', 'createNodeCopiesWithMapping', 'filterAndRemapEdges', 'collectRemovedNodeIds', 'removeNodesRecursively', 'removeNodesFromSourceNotebook']
        .forEach(name => loadFunction(context, name));

    const copied = context.createNodeCopiesWithMapping(['parent'], sourceProject.nodes);
    const targetEdges = context.filterAndRemapEdges(sourceProject.edges, copied.idMapping);
    assert.deepEqual(plain(targetEdges), [{
        from: copied.idMapping.parent,
        to: copied.idMapping.child,
        directed: true
    }]);

    assert.equal(context.removeNodesFromSourceNotebook('source', ['parent']), true);
    const remainingSource = JSON.parse(storage.get('project-source'));
    assert.deepEqual(remainingSource.nodes.map(item => item.id), ['remote']);
    assert.deepEqual(remainingSource.edges, []);
}

testParentDeletionPromotesChildrenAndRetainsRemoteEdges();
testSubtreeCopyRemapsOnlyInternalEdges();
testCrossNotebookMoveRetainsOnlyMovedSubtreeEdges();
console.log('Global edge regressions passed.');
