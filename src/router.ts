export type RouteHandler = (params: Record<string, string>, query: URLSearchParams) => void;

interface Route {
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

class Router {
  private routes: Route[] = [];
  private ignoredPaths: string[] = [];

  ignorePath(pathPrefix: string) {
    this.ignoredPaths.push(pathPrefix);
  }

  addRoute(path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    let regexPath: string;

    if (path === '*') {
      regexPath = '.*';
    } else {
      const sanitizedPath = path.replace(/\/+$/, '') || '/';
      regexPath = sanitizedPath.replace(/:([^/]+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      });
    }

    this.routes.push({
      pattern: new RegExp(`^${regexPath}/?$`),
      paramNames,
      handler,
    });
  }

  navigateTo(path: string, replace = false, params?: Record<string, string | number | boolean>) {
    let targetPath = path.startsWith('/') ? path : '/' + path;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      const queryString = searchParams.toString();
      if (queryString) {
        targetPath += (targetPath.includes('?') ? '&' : '?') + queryString;
      }
    }

    if (replace) {
      window.history.replaceState({}, '', targetPath);
    } else {
      window.history.pushState({}, '', targetPath);
    }

    this.handleRoute();
    window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'instant'
  });
  }

  init() {
    window.addEventListener('popstate', () => this.handleRoute());

    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('a');

      if (
        target &&
        target.href &&
        target.origin === window.location.origin &&
        target.getAttribute('target') !== '_blank' &&
        !target.hasAttribute('download') &&
        !target.hasAttribute('data-external') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const url = new URL(target.href);

        const isIgnored = this.ignoredPaths.some((prefix) =>
          url.pathname.startsWith(prefix)
        );

        if (isIgnored) {
          return;
        }

        if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
          e.preventDefault();
          this.navigateTo(url.pathname + url.search + url.hash);
        }
      }
    });

    this.handleRoute();
  }

  private handleRoute() {
    const pathname = window.location.pathname;
    const query = new URLSearchParams(window.location.search);

    for (const route of this.routes) {
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1] ? decodeURIComponent(match[index + 1]) : '';
        });
        route.handler(params, query);
        return;
      }
    }

    this.navigateTo('/', true);
  }
}

export const router = new Router();