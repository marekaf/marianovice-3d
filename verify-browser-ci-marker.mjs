import assert from 'node:assert/strict';
import {browserCiMarkerLines} from './scripts/verify-checks.mjs';

const marker={status:'ci-skipped',reason:'needs a GPU',shard:'roof'};
const source=`// browser-ci ${JSON.stringify(marker)}\nimport assert from 'node:assert/strict';\n`;

const read=text=>browserCiMarkerLines(text).map(line=>JSON.parse(line));
assert.deepEqual(read(source),[marker],'A marker on the first line must be read');
assert.deepEqual(read(`﻿${source}`),[marker],'A marker after a byte order mark must keep its status and shard');
assert.deepEqual(read(`﻿﻿${source}`),[],'Only one leading byte order mark is removed');
assert.deepEqual(read(`import assert from 'node:assert/strict';\n${source}`),[marker],'A marker below the first line must be read');
assert.deepEqual(read(`const text='// browser-ci {}';\n`),[],'A marker must start its line');
console.log('A browser-ci marker is read with or without a byte order mark.');
