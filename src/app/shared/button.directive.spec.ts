import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ButtonAppearance, ButtonDirective, ButtonSize } from './button.directive';

@Component({
  imports: [ButtonDirective],
  template: `<button appButton [appearance]="appearance" [size]="size" [iconOnly]="iconOnly">
    button
  </button>`,
})
class TestHostComponent {
  appearance: ButtonAppearance = 'secondary';
  size: ButtonSize = 'm';
  iconOnly = false;
}

@Component({
  imports: [ButtonDirective],
  template: `<button appButton iconOnly>button</button>`,
})
class StaticIconOnlyHostComponent {}

describe('ButtonDirective', () => {
  describe('appearance', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let button: HTMLButtonElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TestHostComponent] });
      fixture = TestBed.createComponent(TestHostComponent);
      button = fixture.nativeElement.querySelector('button');
    });

    const appearanceClasses = [
      'btn-primary',
      'btn-secondary',
      'btn-secondary-destructive',
      'btn-flat',
    ];

    it.each([
      ['primary', 'btn-primary'],
      ['secondary', 'btn-secondary'],
      ['secondary-destructive', 'btn-secondary-destructive'],
      ['flat', 'btn-flat'],
    ] as [ButtonAppearance, string][])(
      'appearance="%s" adds %s and no other appearance class',
      (appearance, expectedClass) => {
        fixture.componentInstance.appearance = appearance;
        fixture.detectChanges();

        expect(button.classList.contains('btn')).toBe(true);
        expect(button.classList.contains(expectedClass)).toBe(true);

        for (const otherClass of appearanceClasses) {
          if (otherClass !== expectedClass) {
            expect(button.classList.contains(otherClass)).toBe(false);
          }
        }
      },
    );

    it('always applies the btn class regardless of appearance', () => {
      fixture.detectChanges();
      expect(button.classList.contains('btn')).toBe(true);
    });
  });

  describe('size', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let button: HTMLButtonElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TestHostComponent] });
      fixture = TestBed.createComponent(TestHostComponent);
      button = fixture.nativeElement.querySelector('button');
    });

    it('size="s" adds btn-s', () => {
      fixture.componentInstance.size = 's';
      fixture.detectChanges();

      expect(button.classList.contains('btn-s')).toBe(true);
    });

    it('size="m" (default) does not add btn-s', () => {
      fixture.detectChanges();

      expect(button.classList.contains('btn-s')).toBe(false);
    });
  });

  describe('iconOnly (bound input)', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let button: HTMLButtonElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TestHostComponent] });
      fixture = TestBed.createComponent(TestHostComponent);
      button = fixture.nativeElement.querySelector('button');
    });

    it('iconOnly=false does not add btn-icon', () => {
      fixture.detectChanges();

      expect(button.classList.contains('btn-icon')).toBe(false);
    });

    it('iconOnly=true adds btn-icon', () => {
      fixture.componentInstance.iconOnly = true;
      fixture.detectChanges();

      expect(button.classList.contains('btn-icon')).toBe(true);
    });
  });

  describe('iconOnly (static/unbound attribute)', () => {
    it('resolves to true via the booleanAttribute transform', () => {
      TestBed.configureTestingModule({ imports: [StaticIconOnlyHostComponent] });
      const fixture = TestBed.createComponent(StaticIconOnlyHostComponent);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.classList.contains('btn-icon')).toBe(true);
    });
  });
});
