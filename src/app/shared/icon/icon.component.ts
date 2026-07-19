import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName = 'chef-hat' | 'plus' | 'pencil' | 'trash' | 'sun' | 'moon' | 'menu' | 'list';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('chef-hat') {
          <path d="M7 21v-4.03A5 5 0 0 1 5 13a5 5 0 0 1 4.58-4.98 4 4 0 0 1 7.98.49A4.5 4.5 0 0 1 19 13a5 5 0 0 1-2 4.97V21Z" />
          <path d="M8 21h8" />
        }
        @case ('plus') {
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        }
        @case ('pencil') {
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        }
        @case ('trash') {
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        }
        @case ('moon') {
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        }
        @case ('menu') {
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        }
        @case ('list') {
          <line x1="9" y1="6" x2="21" y2="6" />
          <line x1="9" y1="12" x2="21" y2="12" />
          <line x1="9" y1="18" x2="21" y2="18" />
          <line x1="4" y1="6" x2="4.01" y2="6" />
          <line x1="4" y1="12" x2="4.01" y2="12" />
          <line x1="4" y1="18" x2="4.01" y2="18" />
        }
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);
}
