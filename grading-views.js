const GradingViews = (() => {
  const definitions = [
    {id: 'top', label: 'Pohled shora'},
    {id: 'north', label: 'Pohled od severu'},
    {id: 'east', label: 'Pohled od východu'},
    {id: 'south', label: 'Pohled od jihu'},
    {id: 'west', label: 'Pohled od západu'},
  ];
  const css = `.model-sheet{break-before:page;break-inside:avoid;display:flex;flex-direction:column;gap:12px}.model-sheet h2{flex:none;margin:0}.model-sheet img{display:block;width:100%;height:auto;min-height:0;object-fit:contain}.model-sheet figure{margin:0;min-height:0;flex:1;display:flex;align-items:center;justify-content:center}@media print{.model-sheet{height:277mm}.model-sheet img{max-height:254mm}}`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function render(views) {
    return definitions.map(({id, label}) => {
      const view = views.find(view => view.id === id);
      if (!view?.src) throw new Error(`Missing model view: ${id}`);
      return `<section class="sheet model-sheet" data-model-view="${id}"><h2>${label}</h2><figure><img src="${escape(view.src)}" alt="${label}" width="${view.width || 1600}" height="${view.height || 1100}"></figure></section>`;
    }).join('');
  }
  async function load(container, manifestUrl, revision) {
    const response = await fetch(manifestUrl, {cache: 'no-store'});
    if (!response.ok) throw new Error('3D pohledy nejsou vygenerované.');
    const manifest = await response.json();
    if (manifest.reportRevision !== revision || !Array.isArray(manifest.views)) throw new Error('3D pohledy je potřeba aktualizovat.');
    const views = definitions.map(({id}) => {
      const view = manifest.views.find(view => view.id === id);
      if (!view) throw new Error('3D pohledy nejsou kompletní.');
      const url = new URL(view.file, manifestUrl);
      url.searchParams.set('v', view.sha256);
      return {...view, src: url.href};
    });
    const gallery = document.createElement('div');
    gallery.innerHTML = render(views);
    await Promise.all([...gallery.querySelectorAll('img')].map(image => image.decode()));
    container.append(...gallery.children);
  }
  return {definitions, css, render, load};
})();
if (typeof module !== 'undefined') module.exports = {GradingViews};
