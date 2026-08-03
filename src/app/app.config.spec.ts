import { describe, expect, it } from 'vitest';
import { appConfig } from './app.config';

describe('appConfig', () => {
  it('registers the router and HTTP client providers', () => {
    expect(appConfig.providers.length).toBe(2);
  });
});
