export class CertificateError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "CertificateError";
  }
}
