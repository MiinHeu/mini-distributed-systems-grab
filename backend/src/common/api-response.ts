export type ApiResponse<T> = {
  readOnly: boolean;
  warning: string | null;
  activeNode: string | null;
  data: T;
};

export function ok<T>(data: T, opts?: Partial<ApiResponse<T>>): ApiResponse<T> {
  return {
    readOnly: opts?.readOnly ?? false,
    warning: opts?.warning ?? null,
    activeNode: opts?.activeNode ?? null,
    data,
  };
}

