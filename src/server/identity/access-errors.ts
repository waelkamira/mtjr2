export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class PermissionDeniedError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export class MfaEnrollmentRequiredError extends PermissionDeniedError {
  constructor() {
    super("Multi-factor authentication enrollment is required.");
    this.name = "MfaEnrollmentRequiredError";
  }
}

export class MfaVerificationRequiredError extends PermissionDeniedError {
  constructor() {
    super("Multi-factor authentication is required or has expired.");
    this.name = "MfaVerificationRequiredError";
  }
}
