export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public suggestion?: string
  ) {
    super(message);
  }
}