import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';

describe('apiBaseUrlInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('prepends environment.apiUrl to a relative request URL', () => {
    http.get('/recipes').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/recipes`);
    expect(req.request.url).toBe(`${environment.apiUrl}/recipes`);
    req.flush({});
  });

  it('passes an absolute http:// URL through unchanged', () => {
    http.get('http://example.com/foo').subscribe();

    const req = httpMock.expectOne('http://example.com/foo');
    expect(req.request.url).toBe('http://example.com/foo');
    req.flush({});
  });

  it('passes an absolute https:// URL through unchanged', () => {
    http.get('https://example.com/foo').subscribe();

    const req = httpMock.expectOne('https://example.com/foo');
    expect(req.request.url).toBe('https://example.com/foo');
    req.flush({});
  });
});
