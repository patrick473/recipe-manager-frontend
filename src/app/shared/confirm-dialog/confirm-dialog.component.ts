import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonDirective } from '../button.directive';
import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.request(); as req) {
      <div class="backdrop" (click)="respond(false)">
        <div
          class="dialog"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="req.label"
          (click)="$event.stopPropagation()"
        >
          <h2 class="dialog-label">{{ req.label }}</h2>
          @if (req.content) {
            <p class="dialog-content">{{ req.content }}</p>
          }
          <div class="dialog-actions">
            <button appButton appearance="secondary" type="button" (click)="respond(false)">
              {{ req.no }}
            </button>
            <button
              appButton
              appearance="secondary-destructive"
              type="button"
              (click)="respond(true)"
            >
              {{ req.yes }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      z-index: 1000;
    }

    .dialog {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      padding: var(--space-5);
      max-width: 26.25rem;
      width: 100%;
    }

    .dialog-label {
      font-size: var(--font-size-lg);
      margin-bottom: var(--space-2);
    }

    .dialog-content {
      color: var(--color-text-muted);
      margin-bottom: var(--space-5);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly service = inject(ConfirmDialogService);

  protected respond(confirmed: boolean): void {
    this.service.respond(confirmed);
  }
}
