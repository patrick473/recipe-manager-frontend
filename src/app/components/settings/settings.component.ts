import { Component, signal } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly themeService = new ThemeService();

  readonly currentTheme = this.themeService.theme;

  protected readonly availableThemes = ['cucumber', 'mango'] as const;

  switchTheme(theme: 'cucumber' | 'mango') {
    this.themeService.set(theme);
  }
}
