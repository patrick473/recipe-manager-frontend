import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ConfirmOptions {
  label: string;
  content?: string;
  yes?: string;
  no?: string;
}

export interface ConfirmRequest extends Required<ConfirmOptions> {}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private pending: Subject<boolean> | null = null;

  readonly request = signal<ConfirmRequest | null>(null);

  confirm(options: ConfirmOptions): Observable<boolean> {
    this.pending?.complete();

    const subject = new Subject<boolean>();
    this.pending = subject;
    this.request.set({
      label: options.label,
      content: options.content ?? '',
      yes: options.yes ?? 'Confirm',
      no: options.no ?? 'Cancel',
    });
    return subject.asObservable();
  }

  respond(confirmed: boolean): void {
    this.request.set(null);
    this.pending?.next(confirmed);
    this.pending?.complete();
    this.pending = null;
  }
}
