const routes = [];
let onRoute = () => {};

export function addRoute(pattern, config) {
  const keys = [];
  const source = pattern.replace(/:[^/]+/g, (match) => {
    keys.push(match.slice(1));
    return '([^/]+)';
  });
  routes.push({ regex: new RegExp(`^${source}$`), keys, config });
}

export function navigate(path) {
  const target = `#${path}`;
  if (location.hash === target) resolve();
  else location.hash = target;
}

function resolve() {
  const [path, search = ''] = (location.hash.slice(1) || '/').split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  for (const { regex, keys, config } of routes) {
    const match = path.match(regex);
    if (match) {
      const params = Object.fromEntries(keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
      onRoute(config, { params, query, path });
      return;
    }
  }
  navigate('/');
}

export function startRouter(handler) {
  onRoute = handler;
  window.addEventListener('hashchange', resolve);
  resolve();
}
