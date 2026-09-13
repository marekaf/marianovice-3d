import assert from 'node:assert/strict';
import {runtimeAssetReferences} from './runtime-asset-references.mjs';
const source=`
  import {render} from './renderer.js?v=abc';
  const image='missing-image.png';
  link.download = 'generated-drawing.png';
  link.href = 'missing-input.svg';
  other.download = "generated-copy.svg";
  const next = './next.html';
`;
assert.deepEqual([...runtimeAssetReferences(source)],['./renderer.js?v=abc','missing-image.png','missing-input.svg','./next.html']);
assert.deepEqual([...runtimeAssetReferences(`link.download='output.png'; image.src='output.png';`)],['output.png'],'Using the same name as a real input still requires that input');
console.log('Runtime assets distinguish download names from required scripts, images and links');
