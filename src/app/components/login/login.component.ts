import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { createFormSubmitState } from '../../shared/form-submit-state.util';

/**
 * Public login form. On success, navigates to the `returnUrl` query param
 * (set by `authGuard` when redirecting an unauthenticated visit) or
 * `/recipes` when there isn't one.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ButtonDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form: FormGroup<{
    username: FormControl<string>;
    password: FormControl<string>;
  }> = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  private readonly formSubmitState = createFormSubmitState(this.form);
  protected readonly submitting = this.formSubmitState.submitting;
  protected readonly submitError = this.formSubmitState.submitError;
  protected readonly isInvalid = this.formSubmitState.isInvalid;

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password } = this.form.getRawValue();

    this.submitting.set(true);
    this.submitError.set(null);

    this.authService
      .login(username, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/recipes';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.submitError.set(err.error?.detail ?? 'Invalid username or password.');
          this.submitting.set(false);
          console.error(err);
        },
      });
  }
}
