import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from '../../services/theme.service';
import { NavBarComponent } from './nav-bar.component';

describe('NavBarComponent', () => {
  let component: NavBarComponent;
  let themeService: { toggle: ReturnType<typeof vi.fn>; darkMode: () => boolean };

  beforeEach(() => {
    themeService = { toggle: vi.fn(), darkMode: () => false };

    TestBed.configureTestingModule({
      imports: [NavBarComponent],
      providers: [provideRouter([]), { provide: ThemeService, useValue: themeService }],
    });

    component = TestBed.createComponent(NavBarComponent).componentInstance;
  });

  it('toggleExpanded() flips expanded() from false to true', () => {
    expect(component['expanded']()).toBe(false);

    component['toggleExpanded']();

    expect(component['expanded']()).toBe(true);
  });

  it('toggleExpanded() flips expanded() back to false on a second call', () => {
    component['toggleExpanded']();
    component['toggleExpanded']();

    expect(component['expanded']()).toBe(false);
  });

  it('toggleTheme() delegates to ThemeService.toggle()', () => {
    component['toggleTheme']();

    expect(themeService.toggle).toHaveBeenCalledTimes(1);
  });
});
