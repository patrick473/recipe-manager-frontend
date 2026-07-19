import { provideTaiga } from "@taiga-ui/core";
import { TuiConfirmService } from '@taiga-ui/kit';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './interceptors/api-base-url.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
    provideTaiga(),
    TuiConfirmService,
    ],
};
