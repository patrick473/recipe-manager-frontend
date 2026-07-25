import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmDialogService);
  });

  it('applies default label/content/yes/no when options are omitted', () => {
    service.confirm({ label: 'Delete item?' }).subscribe();

    expect(service.request()).toEqual({
      label: 'Delete item?',
      content: '',
      yes: 'Confirm',
      no: 'Cancel',
    });
  });

  it('preserves explicitly provided options', () => {
    service
      .confirm({
        label: 'Delete "Pasta"?',
        content: 'This cannot be undone.',
        yes: 'Delete',
        no: 'Keep',
      })
      .subscribe();

    expect(service.request()).toEqual({
      label: 'Delete "Pasta"?',
      content: 'This cannot be undone.',
      yes: 'Delete',
      no: 'Keep',
    });
  });

  it('respond(true) emits true and clears request()', () => {
    let result: boolean | undefined;
    service.confirm({ label: 'Proceed?' }).subscribe((r) => (result = r));

    service.respond(true);

    expect(result).toBe(true);
    expect(service.request()).toBeNull();
  });

  it('respond(false) emits false and clears request()', () => {
    let result: boolean | undefined;
    service.confirm({ label: 'Proceed?' }).subscribe((r) => (result = r));

    service.respond(false);

    expect(result).toBe(false);
    expect(service.request()).toBeNull();
  });

  it('completes the previous pending observable without emitting when confirm() is called again before responding', () => {
    let firstValue: boolean | undefined;
    let firstCompleted = false;

    service.confirm({ label: 'First?' }).subscribe({
      next: (v) => (firstValue = v),
      complete: () => (firstCompleted = true),
    });

    // Second confirm() before the first is answered should complete (not emit on) the first observable.
    service.confirm({ label: 'Second?' }).subscribe();

    expect(firstValue).toBeUndefined();
    expect(firstCompleted).toBe(true);
    expect(service.request()).toEqual({
      label: 'Second?',
      content: '',
      yes: 'Confirm',
      no: 'Cancel',
    });
  });
});
