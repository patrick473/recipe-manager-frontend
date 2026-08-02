import { signal, WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';

/**
 * Generic submit-state bookkeeping shared by the login/register forms: a
 * `submitting`/`submitError` signal pair, plus a `touched-and-invalid` field
 * check for templates. Each form still owns its own `onSubmit` orchestration
 * (the actual API call and its success/error handling) — this only
 * centralizes the signal plumbing that's otherwise duplicated verbatim.
 */
export interface FormSubmitState {
  readonly submitting: WritableSignal<boolean>;
  readonly submitError: WritableSignal<string | null>;
  isInvalid(field: string): boolean;
}

export function createFormSubmitState(form: FormGroup): FormSubmitState {
  return {
    submitting: signal(false),
    submitError: signal<string | null>(null),
    isInvalid: (field: string): boolean => {
      const ctrl = form.get(field);
      return !!(ctrl && ctrl.invalid && ctrl.touched);
    },
  };
}
