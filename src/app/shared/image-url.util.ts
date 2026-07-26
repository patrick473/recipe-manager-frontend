import { environment } from '../../environments/environment';

/**
 * Resolves a relative `imageUrl` (e.g. `/recipes/1/image`) into an absolute
 * URL loadable from a template-bound `<img src>`. The `apiBaseUrlInterceptor`
 * only rewrites HttpClient requests — a plain `<img>` tag is resolved by the
 * browser against its own origin, never passing through HttpClient, so this
 * is a second, deliberate place `environment.apiUrl` gets applied.
 */
export function resolveImageUrl(path: string | null | undefined): string | null {
  return path ? `${environment.apiUrl}${path}` : null;
}
