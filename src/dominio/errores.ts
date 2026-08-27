export class ErrorCertificado extends Error {
  constructor(mensaje: string, { cause }: { cause?: unknown } = {}) {
    super(mensaje, { cause });
    this.name = "ErrorCertificado";
  }
}
