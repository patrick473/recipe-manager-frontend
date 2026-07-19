import { Directive, HostBinding, booleanAttribute, input } from '@angular/core';

export type ButtonAppearance = 'primary' | 'secondary' | 'secondary-destructive' | 'flat';
export type ButtonSize = 's' | 'm';

/**
 * Applies button styling to a native <button> or <a>, keeping native semantics
 * (routerLink, type="submit", disabled) instead of wrapping them in a component.
 */
@Directive({
  selector: '[appButton]',
  standalone: true,
})
export class ButtonDirective {
  readonly appearance = input<ButtonAppearance>('secondary');
  readonly size = input<ButtonSize>('m');
  readonly iconOnly = input(false, { transform: booleanAttribute });

  @HostBinding('class.btn') readonly btnClass = true;

  @HostBinding('class.btn-primary') get isPrimary(): boolean {
    return this.appearance() === 'primary';
  }

  @HostBinding('class.btn-secondary') get isSecondary(): boolean {
    return this.appearance() === 'secondary';
  }

  @HostBinding('class.btn-secondary-destructive') get isSecondaryDestructive(): boolean {
    return this.appearance() === 'secondary-destructive';
  }

  @HostBinding('class.btn-flat') get isFlat(): boolean {
    return this.appearance() === 'flat';
  }

  @HostBinding('class.btn-s') get isSmall(): boolean {
    return this.size() === 's';
  }

  @HostBinding('class.btn-icon') get isIconOnly(): boolean {
    return this.iconOnly();
  }
}
