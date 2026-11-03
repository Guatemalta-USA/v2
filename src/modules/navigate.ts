export const ALL_APP_PATHS = [
  '/',
  '/index',
  '/about',
  '/mailinglist',
  '/blog',
  '/blog/post',
  '/blog/editpost',
  '/impact',
  '/impact/project',
  '/impact/editproject',
  '/financialtransparency',
  '/login',
  '/admin',
  '/privatepolicy',
  '/donate',
  '/sponsor-a-child'
] as const;

export type AppPath = typeof ALL_APP_PATHS[number];

interface NavOptions {
  replace?: boolean;
  params?: Record<string, string | number> | URLSearchParams;
}

export const navigateTo = (path: AppPath, options: NavOptions = {}): void => {
  const { replace = false, params } = options;
  const baseUrl = "/";
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const fullPath = `${baseUrl}${cleanPath}`;
  const url = new URL(fullPath, window.location.origin);

  if (params) {
    if (params instanceof URLSearchParams) {
      params.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    } else {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }
  }

  if (replace) {
    window.location.replace(url.href);
  } else {
    window.location.href = url.href;
  }
};