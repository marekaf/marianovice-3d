export function* runtimeAssetReferences(source) {
  for(const match of source.matchAll(/(['"])([^'"`\s]+\.(?:m?js|html|css|jpg|png|svg)(?:[?#][^'"]*)?)\1/g)){
    if(/\.download\s*=\s*$/.test(source.slice(0,match.index)))continue;
    yield match[2];
  }
}
