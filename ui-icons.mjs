const paths = {
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.7 4.3L21 21',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-4.5 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  ruler: 'm3 15 12-12 6 6L9 21Zm10-9 3 3m-6 0 2 2m-5 1 3 3',
  layers: 'm3 8 9-5 9 5-9 5Zm0 5 9 5 9-5M3 17l9 5 9-5',
  filter: 'M3 7h7m4 0h7M3 17h11m4 0h3M14 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  external: 'M13 4h7v7m0-7L10 14m-1-9H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5',
  cube: 'm12 2 9 5v10l-9 5-9-5V7Zm-9 5 9 5 9-5m-9 5v10'
};
export function toolIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','tool-icon');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  svg.setAttribute('viewBox','0 0 24 24');
  const path = document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d',paths[name]);
  svg.append(path);
  return svg;
}

export function decorativeEmoji(value) {
  const span = document.createElement('span');
  span.className = 'term-emoji';
  span.setAttribute('aria-hidden','true');
  span.textContent = value;
  return span;
}
