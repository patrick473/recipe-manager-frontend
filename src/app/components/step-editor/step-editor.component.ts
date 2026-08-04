import { ChangeDetectionStrategy, Component, forwardRef, inject } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { RecipeStepDto } from '../../api/generated/model/recipeStepDto';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-step-editor',
  imports: [ReactiveFormsModule, ButtonDirective, IconComponent],
  templateUrl: './step-editor.component.html',
  styleUrl: './step-editor.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => StepEditorComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => StepEditorComponent), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepEditorComponent implements ControlValueAccessor, Validator {
  private readonly fb = inject(FormBuilder);
  private onChange: (value: RecipeStepDto[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  private draggedIndex: number | null = null;

  protected readonly rows = new FormArray<FormControl<string>>([]);

  constructor() {
    this.rows.valueChanges.subscribe(() => {
      this.onChange(this.toValue());
      this.onValidatorChange();
    });
  }

  writeValue(value: RecipeStepDto[] | null): void {
    this.rows.clear({ emitEvent: false });
    (value?.length ? value : [{ instruction: '' }]).forEach((step) =>
      this.rows.push(this.createControl(step.instruction), { emitEvent: false }),
    );
    this.onValidatorChange();
  }

  registerOnChange(fn: (value: RecipeStepDto[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
  setDisabledState(disabled: boolean): void { disabled ? this.rows.disable({ emitEvent: false }) : this.rows.enable({ emitEvent: false }); }
  validate(_control: AbstractControl): ValidationErrors | null { return this.rows.length >= 1 && this.rows.length <= 100 && this.rows.valid ? null : { steps: true }; }

  protected add(afterIndex = this.rows.length - 1): void {
    this.rows.insert(afterIndex + 1, this.createControl(''));
  }

  protected remove(index: number): void {
    this.rows.removeAt(index);
    this.onTouched();
  }

  protected move(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.rows.length) return;
    const row = this.rows.at(index);
    this.rows.removeAt(index, { emitEvent: false });
    this.rows.insert(target, row);
    this.emitValue();
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter' && !event.shiftKey && this.rows.at(index).value.trim()) {
      event.preventDefault();
      this.add(index);
      queueMicrotask(() => document.getElementById(`step-${index + 2}`)?.focus());
    }
  }

  protected onDragStart(index: number): void { this.draggedIndex = index; }
  protected onDrop(index: number): void {
    if (this.draggedIndex !== null && this.draggedIndex !== index) this.move(this.draggedIndex, index - this.draggedIndex);
    this.draggedIndex = null;
  }
  protected markTouched(): void { this.onTouched(); }

  private createControl(value: string): FormControl<string> {
    return this.fb.nonNullable.control(value, [Validators.required, Validators.maxLength(2000)]);
  }
  private toValue(): RecipeStepDto[] { return this.rows.getRawValue().map((instruction) => ({ instruction })); }
  private emitValue(): void { this.onChange(this.toValue()); this.onValidatorChange(); this.onTouched(); }
}