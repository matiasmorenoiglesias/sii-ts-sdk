/**
 * Port: subida del sobre EnvioBOLETA al ambiente de certificación del
 * SII, según "Manual Desarrollador Externo Envío Automático Documentos
 * Tributarios Electrónicos" (docs/envio.pdf).
 *
 * A diferencia de los otros pasos, esto NO es un webservice SOAP: es un
 * POST HTTP multipart/form-data (RFC1867) clásico, con el token de
 * autenticación como cookie. El manual fuente es de 2003 — es la parte
 * menos verificada de todo el SDK; no hay forma de probarla sin
 * credenciales reales contra el ambiente real.
 */

export interface UploadResult {
  senderRut: string;
  companyRut: string;
  fileName: string;
  timestamp: string;
  /** "0" es éxito; cualquier otro valor es un código de error del SII. */
  status: string;
  /** Solo presente cuando status es "0". Número de atención del envío. */
  trackId?: string;
}

export interface EnvioBoletaUploader {
  /**
   * @param xml El XML completo del sobre EnvioBOLETA.
   * @param senderRut RUT de quien envía (usuario autorizado), formato XXXXXXXX-X.
   * @param companyRut RUT de la empresa emisora, formato XXXXXXXX-X.
   * @param token Token de autenticación obtenido de GetTokenFromSeed.jws.
   */
  upload(xml: string, senderRut: string, companyRut: string, token: string): Promise<UploadResult>;
}
