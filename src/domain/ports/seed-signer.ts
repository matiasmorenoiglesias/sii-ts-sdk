/**
 * Port: firma "enveloped" de la semilla de autenticación, según SII
 * "Manual de Desarrollador Autenticación Automática" (4.1.5):
 * docs/autenticacion.pdf
 *
 * Es una firma XMLDSig distinta a la de DocumentSigner: en vez de
 * referenciar un elemento por ID (Reference URI="#id" + transform
 * C14N), firma el documento completo tal como queda antes de insertar
 * la firma (Reference URI="" + transform "enveloped-signature").
 */
export interface SeedSigner {
  /**
   * Firma la semilla y devuelve el XML completo
   * <getToken><item><Semilla>...</Semilla></item><Signature>...</Signature></getToken>
   * listo para enviar como parámetro de GetTokenFromSeed.jws.
   */
  sign(seed: string, privateKeyPem: string, certificatePem: string): string;
}
