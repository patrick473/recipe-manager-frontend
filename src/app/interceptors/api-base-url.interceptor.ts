import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * The Orval-generated API clients emit relative paths (e.g. `/recipes`) since
 * the base URL differs per environment. This prepends `environment.apiUrl` to
 * any relative request before it goes out.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//i.test(req.url)) {
    return next(req);
  }
  return next(req.clone({ url: `${environment.apiUrl}${req.url}` }));
};
