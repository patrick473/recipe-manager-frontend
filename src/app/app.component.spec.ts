import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: vi.fn().mockReturnValue(false),
            currentUser: signal(null),
            logout: vi.fn(),
          },
        },
        { provide: ThemeService, useValue: { toggle: vi.fn(), darkMode: () => false } },
      ],
    });
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the nav bar and confirm dialog outlets', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('app-nav-bar')).toBeTruthy();
    expect(nativeElement.querySelector('app-confirm-dialog')).toBeTruthy();
  });
});
