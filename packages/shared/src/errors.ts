/** Base class so callers can tell our own failures from library errors. */
export class AppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Invalid or missing configuration. Thrown before any browser starts. */
export class ConfigError extends AppError {}

/** A demo target did not answer its health check. */
export class TargetDownError extends AppError {
  constructor(
    readonly target: string,
    detail: string,
  ) {
    super(`Target "${target}" is down: ${detail}`);
  }
}
