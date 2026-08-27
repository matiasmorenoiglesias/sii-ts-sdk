import { CertificateError } from "./errors.js";
import type { CertificateParser } from "./ports/certificate-parser.js";
import { ForgeCertificateParser } from "../adapters/forge-certificate-parser.js";

export { CertificateError } from "./errors.js";

export class Certificado {
  readonly privateKeyPem: string;
  readonly certificatePem: string;
  readonly rutEmisor: string;

  private constructor(privateKeyPem: string, certificatePem: string, rutEmisor: string) {
    this.privateKeyPem = privateKeyPem;
    this.certificatePem = certificatePem;
    this.rutEmisor = rutEmisor;
  }

  /**
   * @param parser CertificateParser port. Defaults to the node-forge
   * adapter; a different one (or a fake) can be injected to test the
   * domain logic without depending on the concrete library.
   */
  static async desdeP12(
    buffer: Buffer,
    password: string,
    parser: CertificateParser = new ForgeCertificateParser(),
  ): Promise<Certificado> {
    const parsed = parser.parse(buffer, password);
    const rutEmisor = extractRutFromSubject(parsed.subject);

    return new Certificado(parsed.privateKeyPem, parsed.certificatePem, rutEmisor);
  }
}

/**
 * El RUT del titular va en el subject del certificado, típicamente en el
 * campo serialNumber o en un CN con formato "NOMBRE, RUT". El formato
 * exacto depende de la autoridad certificadora (E-Sign, Acepta, etc.).
 * TODO: confirmar contra certificados reales de distintas CAs cuando
 * tengamos fixtures — por ahora se busca en serialNumber primero.
 */
function extractRutFromSubject(subject: Record<string, string>): string {
  if (subject.serialNumber) {
    return normalizeRut(subject.serialNumber);
  }

  const cn = subject.CN;
  const match = cn?.match(/(\d{1,8}-[\dkK])/);
  if (match?.[1]) {
    return normalizeRut(match[1]);
  }

  throw new CertificateError("No se pudo extraer el RUT del certificado");
}

function normalizeRut(rut: string): string {
  return rut.trim().toUpperCase().replace(/^CL/, "");
}
