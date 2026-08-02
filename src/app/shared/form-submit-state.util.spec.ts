import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { createFormSubmitState } from './form-submit-state.util';

describe('createFormSubmitState', () => {
  function buildForm() {
    return new FormGroup({
      username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  it('starts with submitting false and no error', () => {
    const state = createFormSubmitState(buildForm());
    expect(state.submitting()).toBe(false);
    expect(state.submitError()).toBeNull();
  });

  it('submitting and submitError are independently settable', () => {
    const state = createFormSubmitState(buildForm());

    state.submitting.set(true);
    state.submitError.set('Something went wrong.');

    expect(state.submitting()).toBe(true);
    expect(state.submitError()).toBe('Something went wrong.');
  });

  it('isInvalid is false when the field is invalid but untouched', () => {
    const state = createFormSubmitState(buildForm());
    expect(state.isInvalid('username')).toBe(false);
  });

  it('isInvalid is true when the field is invalid and touched', () => {
    const form = buildForm();
    const state = createFormSubmitState(form);

    form.get('username')?.markAsTouched();

    expect(state.isInvalid('username')).toBe(true);
  });

  it('isInvalid is false when the field is valid and touched', () => {
    const form = buildForm();
    const state = createFormSubmitState(form);

    form.get('username')?.setValue('alice');
    form.get('username')?.markAsTouched();

    expect(state.isInvalid('username')).toBe(false);
  });

  it('isInvalid is false for a field name that does not exist on the form', () => {
    const state = createFormSubmitState(buildForm());
    expect(state.isInvalid('nonexistent')).toBe(false);
  });
});
