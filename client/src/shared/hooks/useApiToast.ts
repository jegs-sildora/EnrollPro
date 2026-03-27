import { sileo } from 'sileo';
import type { AxiosError } from 'axios';

export function toastApiError(error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) {
  const data = error.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    sileo.error({ title: 'Validation Error', description: first });
  } else {
    sileo.error({ title: 'Error', description: data?.message ?? 'Something went wrong.' });
  }
}
