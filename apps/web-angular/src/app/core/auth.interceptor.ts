import { HttpClient, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { API_BASE_URL } from './config';
import { TokenService } from './token.service';

// Endpoints that must never carry a stale access token or trigger a refresh
// loop on their own 401 — refreshing off the refresh call itself would recurse.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh'];

// Module-level so concurrent 401s (e.g. several requests firing at once after
// the access token expires) share one in-flight refresh instead of racing —
// mirrors the old ApiClient's `refreshInFlight` promise.
let refreshInFlight$: Observable<void> | null = null;

function refreshAccessToken(http: HttpClient, tokens: TokenService): Observable<void> {
  if (!refreshInFlight$) {
    const refreshToken = tokens.getRefreshToken();
    refreshInFlight$ = http
      .post<{ accessToken: string; refreshToken: string }>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .pipe(
        tap((data) => tokens.setTokens(data.accessToken, data.refreshToken)),
        switchMap(() => new Observable<void>((subscriber) => subscriber.complete())),
        catchError((err) => {
          tokens.clear();
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    refreshInFlight$.subscribe({ complete: () => (refreshInFlight$ = null), error: () => (refreshInFlight$ = null) });
  }
  return refreshInFlight$;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenService);
  const http = inject(HttpClient);
  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));

  const accessToken = tokens.getAccessToken();
  const authedReq = accessToken && !isAuthEndpoint ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }) : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !isAuthEndpoint &&
        tokens.getRefreshToken()
      ) {
        return refreshAccessToken(http, tokens).pipe(
          switchMap(() => {
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${tokens.getAccessToken()}` } });
            return next(retried);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
