import { resolveImageUrl } from './image-url.util';

describe('resolveImageUrl', () => {
  it('prefixes environment.apiUrl for a relative path', () => {
    expect(resolveImageUrl('/recipes/1/image')).toBe('http://localhost:8080/recipes/1/image');
  });

  it('returns null for null input', () => {
    expect(resolveImageUrl(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(resolveImageUrl(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(resolveImageUrl('')).toBeNull();
  });
});
