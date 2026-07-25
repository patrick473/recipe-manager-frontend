import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let service: ConfirmDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    });

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    service = TestBed.inject(ConfirmDialogService);
  });

  it('renders nothing when service.request() is null', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.backdrop')).toBeNull();
    expect(fixture.nativeElement.querySelector('.dialog')).toBeNull();
  });

  describe('when a request is pending', () => {
    beforeEach(() => {
      service.confirm({ label: 'Delete X?', content: 'sure?', yes: 'Delete', no: 'Cancel' });
      fixture.detectChanges();
    });

    it('renders the dialog with the request label, content, yes, and no text', () => {
      const nativeElement = fixture.nativeElement as HTMLElement;

      expect(nativeElement.querySelector('.dialog-label')?.textContent).toContain('Delete X?');
      expect(nativeElement.querySelector('.dialog-content')?.textContent).toContain('sure?');
      expect(nativeElement.textContent).toContain('Delete');
      expect(nativeElement.textContent).toContain('Cancel');
    });

    it('renders the dialog with role="alertdialog" and aria-modal="true"', () => {
      const dialog = fixture.nativeElement.querySelector('.dialog') as HTMLElement;

      expect(dialog.getAttribute('role')).toBe('alertdialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('clicking the backdrop calls respond(false)', () => {
      const respondSpy = vi.spyOn(service, 'respond');
      const backdrop = fixture.nativeElement.querySelector('.backdrop') as HTMLElement;

      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(respondSpy).toHaveBeenCalledWith(false);
    });

    it('clicking inside the dialog does not call respond', () => {
      const respondSpy = vi.spyOn(service, 'respond');
      const dialog = fixture.nativeElement.querySelector('.dialog') as HTMLElement;

      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(respondSpy).not.toHaveBeenCalled();
    });

    it('clicking the cancel button calls respond(false)', () => {
      const respondSpy = vi.spyOn(service, 'respond');
      const cancelButton = fixture.nativeElement.querySelector(
        '.dialog-actions button:first-child',
      ) as HTMLButtonElement;

      cancelButton.click();

      expect(respondSpy).toHaveBeenCalledWith(false);
    });

    it('clicking the confirm button calls respond(true)', () => {
      const respondSpy = vi.spyOn(service, 'respond');
      const confirmButton = fixture.nativeElement.querySelector(
        '.dialog-actions button:last-child',
      ) as HTMLButtonElement;

      confirmButton.click();

      expect(respondSpy).toHaveBeenCalledWith(true);
    });
  });
});
