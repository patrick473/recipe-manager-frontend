import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { ThemeService } from '../../services/theme.service';

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
