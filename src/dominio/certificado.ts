import { ErrorCertificado } from "./errores.js";
import type { ParseadorCertificadoDigital } from "./puertos/parseador-certificado.js";
import { ParseadorCertificadoForge } from "../adaptadores/parseador-certificado-forge.js";

export { ErrorCertificado } from "./errores.js";

export class Certificado {
  readonly llavePrivadaPem: string;
  readonly certificadoPem: string;
  readonly rutEmisor: string;

  private constructor(llavePrivadaPem: string, certificadoPem: string, rutEmisor: string) {
    this.llavePrivadaPem = llavePrivadaPem;
    this.certificadoPem = certificadoPem;
    this.rutEmisor = rutEmisor;
  }

  /**
   * @param parseador Puerto de parseo PKCS#12. Por defecto usa el
   * adaptador de node-forge; se puede inyectar otro (o un fake) para
   * testear el dominio sin depender de la librería concreta.
   */
  static async desdeP12(
    buffer: Buffer,
    password: string,
    parseador: ParseadorCertificadoDigital = new ParseadorCertificadoForge(),
  ): Promise<Certificado> {
    const parseado = parseador.parsear(buffer, password);
    const rutEmisor = extraerRutDelSubject(parseado.subject);

    return new Certificado(parseado.llavePrivadaPem, parseado.certificadoPem, rutEmisor);
  }
}

/**
 * El RUT del titular va en el subject del certificado, típicamente en el
 * campo serialNumber o en un CN con formato "NOMBRE, RUT". El formato
 * exacto depende de la autoridad certificadora (E-Sign, Acepta, etc.).
 * TODO: confirmar contra certificados reales de distintas CAs cuando
 * tengamos fixtures — por ahora se busca en serialNumber primero.
 */
function extraerRutDelSubject(subject: Record<string, string>): string {
  if (subject.serialNumber) {
    return normalizarRut(subject.serialNumber);
  }

  const cn = subject.CN;
  const match = cn?.match(/(\d{1,8}-[\dkK])/);
  if (match?.[1]) {
    return normalizarRut(match[1]);
  }

  throw new ErrorCertificado("No se pudo extraer el RUT del certificado");
}

function normalizarRut(rut: string): string {
  return rut.trim().toUpperCase().replace(/^CL/, "");
}
