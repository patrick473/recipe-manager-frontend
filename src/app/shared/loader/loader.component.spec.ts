import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  it('defaults to the small size and renders no text', () => {
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('.loader-l')).toBeNull();
    expect(nativeElement.querySelector('.loader-text')).toBeNull();
  });

  it('applies the large-size class and renders the given text', () => {
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.componentRef.setInput('size', 'l');
    fixture.componentRef.setInput('text', 'Loading recipes…');
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('.loader-l')).toBeTruthy();
    expect(nativeElement.querySelector('.loader-text')?.textContent?.trim()).toBe(
      'Loading recipes…',
    );
  });
});
