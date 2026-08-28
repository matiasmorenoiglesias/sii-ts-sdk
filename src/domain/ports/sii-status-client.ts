/**
 * Port: consulta de estado contra los webservices SOAP del SII
 * (QueryEstUp.jws y QueryEstDte.jws), según docs/estado_envio.pdf y
 * docs/estado_dte.pdf.
 */

export interface UploadStatusResult {
  trackId?: string;
  /** Ej: "EPR" (Envío Procesado), "RCT" (Rechazado por Error en Carátula), etc. */
  status: string;
  glosa?: string;
  attentionNumber?: string;
  /** Los siguientes solo vienen presentes cuando status es "EPR". */
  documentType?: string;
  informed?: string;
  accepted?: string;
  rejected?: string;
  reviewed?: string;
}

export interface DteStatusInput {
  companyRut: string;
  recipientRut: string;
  documentType: string;
  folio: number;
  /** Fecha de emisión del DTE, formato AAAA-MM-DD (se convierte internamente al formato que exige el SII). */
  issueDate: string;
  totalAmount: number;
}

export interface DteStatusResult {
  /** Ej: "DOK" (aceptado), "DNK" (recibido pero datos no coinciden), etc. */
  status: string;
  glosa?: string;
  errorCode?: string;
  errorGlosa?: string;
  attentionNumber?: string;
}

export interface SiiStatusClient {
  getUploadStatus(companyRut: string, trackId: string, token: string): Promise<UploadStatusResult>;
  getDteStatus(input: DteStatusInput, token: string): Promise<DteStatusResult>;
}
