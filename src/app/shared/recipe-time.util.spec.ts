import { totalTimeMinutes } from './recipe-time.util';

describe('totalTimeMinutes', () => {
  it('returns null when both prep and cook time are null', () => {
    expect(totalTimeMinutes({ prepTimeMinutes: null, cookTimeMinutes: null })).toBeNull();
  });

  it('treats a null prep time as 0', () => {
    expect(totalTimeMinutes({ prepTimeMinutes: null, cookTimeMinutes: 20 })).toBe(20);
  });

  it('treats a null cook time as 0', () => {
    expect(totalTimeMinutes({ prepTimeMinutes: 15, cookTimeMinutes: null })).toBe(15);
  });

  it('sums prep and cook time when both are set', () => {
    expect(totalTimeMinutes({ prepTimeMinutes: 15, cookTimeMinutes: 20 })).toBe(35);
  });

  it('treats undefined the same as null', () => {
    expect(totalTimeMinutes({ prepTimeMinutes: undefined, cookTimeMinutes: undefined })).toBeNull();
  });
});
