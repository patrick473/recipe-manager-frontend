import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NavBarComponent } from './nav-bar.component';

describe('NavBarComponent', () => {
  let component: NavBarComponent;
  let fixture: ComponentFixture<NavBarComponent>;
  let themeService: { toggle: ReturnType<typeof vi.fn>; darkMode: () => boolean };
  let authService: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof signal<{ userId: number; username: string } | null>>;
    logout: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  /** Creates the fixture and runs an initial `detectChanges()`, expanded so template text is present. */
  function createExpanded(): void {
    fixture = TestBed.createComponent(NavBarComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    component['expanded'].set(true);
    fixture.detectChanges();
  }

  beforeEach(() => {
    themeService = { toggle: vi.fn(), darkMode: () => false };
    authService = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      currentUser: signal(null),
      logout: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [NavBarComponent],
      providers: [
        provideRouter([]),
        { provide: ThemeService, useValue: themeService },
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('toggleExpanded() flips expanded() from false to true', () => {
    component = TestBed.createComponent(NavBarComponent).componentInstance;

    expect(component['expanded']()).toBe(false);

    component['toggleExpanded']();

    expect(component['expanded']()).toBe(true);
  });

  it('toggleExpanded() flips expanded() back to false on a second call', () => {
    component = TestBed.createComponent(NavBarComponent).componentInstance;

    component['toggleExpanded']();
    component['toggleExpanded']();

    expect(component['expanded']()).toBe(false);
  });

  it('toggleTheme() delegates to ThemeService.toggle()', () => {
    component = TestBed.createComponent(NavBarComponent).componentInstance;

    component['toggleTheme']();

    expect(themeService.toggle).toHaveBeenCalledTimes(1);
  });

  describe('authenticated state', () => {
    beforeEach(() => {
      authService.isAuthenticated.mockReturnValue(true);
      authService.currentUser.set({ userId: 1, username: 'alice' });
    });

    it('shows the username and a Log out control, not Log in/Register', () => {
      createExpanded();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('alice');
      expect(text).toContain('Log out');
      expect(text).not.toContain('Log in');
      expect(text).not.toContain('Register');
    });

    it('logout() calls AuthService.logout() then navigates to /login', () => {
      createExpanded();
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component['logout']();

      expect(authService.logout).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('unauthenticated state', () => {
    beforeEach(() => {
      authService.isAuthenticated.mockReturnValue(false);
      authService.currentUser.set(null);
    });

    it('shows Log in/Register links, not the username or Log out', () => {
      createExpanded();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Log in');
      expect(text).toContain('Register');
      expect(text).not.toContain('Log out');
    });
  });
});
