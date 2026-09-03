import { Component, computed, inject, signal } from '@angular/core';
import { ThemeName, ThemeMode, ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent {
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;

  readonly availableThemes: ThemeName[] = ['cucumber', 'mango'];
  readonly availableModes: ThemeMode[] = ['light', 'dark'];

  selectedTheme = computed(() => this.theme().name);
  selectedMode = computed(() => this.theme().mode);

  onThemeChange(theme: ThemeName): void {
    this.themeService.setTheme(theme, this.theme().mode);
  }

  onModeChange(mode: ThemeMode): void {
    this.themeService.setTheme(this.theme().name, mode);
  }
}
