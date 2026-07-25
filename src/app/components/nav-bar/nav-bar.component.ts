import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, ButtonDirective, IconComponent],
  templateUrl: './nav-bar.component.html',
  styleUrl: './nav-bar.component.scss',
})
export class NavBarComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly expanded = signal(false);

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }
}
