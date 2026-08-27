/**
 * Puerto: lo que el dominio necesita para abrir un archivo .p12, sin saber
 * qué librería lo implementa. El dominio consume esta interfaz; el
 * adaptador concreto (node-forge, u otra cosa el día de mañana) vive en
 * src/adaptadores.
 */

export interface CertificadoParseado {
  llavePrivadaPem: string;
  certificadoPem: string;
  /** Campos del subject del certificado X.509 (CN, serialNumber, O, etc.) */
  subject: Record<string, string>;
}

export interface ParseadorCertificadoDigital {
  parsear(buffer: Buffer, password: string): CertificadoParseado;
}
