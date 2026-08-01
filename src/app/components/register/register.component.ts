import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ButtonDirective } from '../../shared/button.directive';

/**
 * Public registration form. Registering auto-logs-in (mirrors the backend's
 * `POST /auth/register` behavior), so on success this navigates the same way
 * `LoginComponent` does: to `returnUrl` if present, `/recipes` otherwise.
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ButtonDirective],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly form: FormGroup<{
    username: FormControl<string>;
    password: FormControl<string>;
  }> = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password } = this.form.getRawValue();

    this.submitting.set(true);
    this.submitError.set(null);

    this.authService.register(username, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/recipes';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.submitError.set(err.error?.detail ?? 'Registration failed. Please try again.');
        this.submitting.set(false);
        console.error(err);
      },
    });
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  protected get passwordError(): string {
    const ctrl = this.form.get('password');
    if (ctrl?.errors?.['required']) return 'Password is required.';
    if (ctrl?.errors?.['minlength']) return 'Password must be at least 8 characters.';
    return '';
  }
}
