export class CertificateError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "CertificateError";
  }
}

export class CAFError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "CAFError";
  }
}

export class TEDError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "TEDError";
  }
}

export class BoletaError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "BoletaError";
  }
}

export class DTEError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "DTEError";
  }
}

export class EnvioBoletaError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "EnvioBoletaError";
  }
}

export class IssuerError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "IssuerError";
  }
}

export class SiiAuthClientError extends Error {
  constructor(message: string, { cause }: { cause?: unknown } = {}) {
    super(message, { cause });
    this.name = "SiiAuthClientError";
  }
}
