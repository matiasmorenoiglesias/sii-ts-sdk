/**
 * Port: what the domain needs to open a .p12 file, without knowing which
 * library implements it. The domain consumes this interface; the concrete
 * adapter (node-forge, or something else later) lives in src/adapters.
 */

export interface ParsedCertificate {
  privateKeyPem: string;
  certificatePem: string;
  /** X.509 certificate subject fields (CN, serialNumber, O, etc.) */
  subject: Record<string, string>;
}

export interface CertificateParser {
  parse(buffer: Buffer, password: string): ParsedCertificate;
}
