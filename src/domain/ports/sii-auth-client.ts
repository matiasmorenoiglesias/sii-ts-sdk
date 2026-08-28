/**
 * Port: los dos webservices SOAP de autenticación del SII (CrSeed.jws y
 * GetTokenFromSeed.jws), según docs/autenticacion.pdf. Ambiente de
 * certificación únicamente — ver alcance en CLAUDE.md.
 */

export interface SiiSeedResult {
  /** "00" es éxito; cualquier otro valor es un código de error del SII. */
  status: string;
  seed?: string;
}

export interface SiiTokenResult {
  status: string;
  glosa?: string;
  token?: string;
}

export interface SiiAuthClient {
  getSeed(): Promise<SiiSeedResult>;
  getToken(signedSeedXml: string): Promise<SiiTokenResult>;
}
