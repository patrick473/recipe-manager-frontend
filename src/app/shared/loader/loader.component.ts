import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loader" [class.loader-l]="size() === 'l'">
      <span class="loader-spinner"></span>
      @if (text()) {
        <span class="loader-text">{{ text() }}</span>
      }
    </div>
  `,
  styles: `
    .loader {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-5);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }

    .loader-spinner {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-primary);
      animation: spin 0.7s linear infinite;
    }

    .loader-l .loader-spinner {
      width: 32px;
      height: 32px;
      border-width: 3px;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class LoaderComponent {
  readonly size = input<'s' | 'l'>('s');
  readonly text = input<string>('');
}
