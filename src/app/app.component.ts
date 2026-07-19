import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { TuiRoot, TuiButton, TuiIcon, TUI_DARK_MODE } from '@taiga-ui/core';
import { TuiAppBar } from '@taiga-ui/layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, TuiRoot, TuiAppBar, TuiButton, TuiIcon],
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly darkMode = inject(TUI_DARK_MODE);

  protected toggleTheme(): void {
    this.darkMode.set(!this.darkMode());
  }
}
