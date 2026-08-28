import { createSign } from "node:crypto";
import type { CAF } from "./caf.js";
import { TEDError } from "./errors.js";
import { toISO88591 } from "../encoding.js";
import { escapeXml } from "./xml-escape.js";

export { TEDError } from "./errors.js";

/**
 * Estructura y algoritmo de firma según SII "Instructivo Técnico Factura
 * Electrónica" (Anexo 2 - Timbre Electrónico del DTE):
 * docs/instructivo_emision.pdf
 *
 *   <TED version="1.0">
 *     <DD>
 *       <RE>...</RE><TD>...</TD><F>...</F><FE>...</FE>
 *       <RR>...</RR><RSR>...</RSR><MNT>...</MNT><IT1>...</IT1>
 *       <CAF>...</CAF><TSTED>...</TSTED>
 *     </DD>
 *     <FRMT algoritmo="SHA1withRSA">...</FRMT>
 *   </TED>
 *
 * La firma (FRMT) es RSA-SHA1 (PKCS#1) en Base64, calculada sobre el
 * string exacto de <DD>...</DD> (incluyendo el bloque <CAF> tal cual lo
 * entregó el SII), usando la llave privada del CAF — no el certificado
 * del emisor.
 */

export interface TEDInput {
  /** RUT del emisor, debe coincidir con caf.issuerRut. */
  issuerRut: string;
  /** Folio del documento; debe estar dentro del rango autorizado del CAF. */
  folio: number;
  /** Fecha de emisión, formato AAAA-MM-DD (sin convertir a Date). */
  issueDate: string;
  recipientRut: string;
  /** Razón social del receptor, máximo 40 caracteres. */
  recipientLegalName: string;
  /** Monto total del documento, en pesos, sin decimales. */
  totalAmount: number;
  /** Descripción del primer ítem del detalle, máximo 40 caracteres. */
  firstItemName: string;
  /**
   * Fecha y hora de generación del timbre, formato AAAA-MM-DDTHH:MI:SS.
   * El instructivo no especifica zona horaria — se pide explícito en vez
   * de asumir una, para no adivinar ese detalle.
   */
  timestamp: string;
}

const MAX_GLOSA_LENGTH = 40;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export class TED {
  /** El bloque <TED>...</TED> completo, listo para insertar en el DTE. */
  readonly xml: string;

  private constructor(xml: string) {
    this.xml = xml;
  }

  static generate(caf: CAF, input: TEDInput): TED {
    if (input.issuerRut !== caf.issuerRut) {
      throw new TEDError(
        `El RUT emisor (${input.issuerRut}) no coincide con el del CAF (${caf.issuerRut})`,
      );
    }
    if (!caf.includesFolio(input.folio)) {
      throw new TEDError(
        `El folio ${input.folio} no está autorizado por este CAF (rango ${caf.folioRange.from}-${caf.folioRange.to})`,
      );
    }
    if (!DATE_PATTERN.test(input.issueDate)) {
      throw new TEDError(`issueDate debe tener formato AAAA-MM-DD, se recibió "${input.issueDate}"`);
    }
    if (!TIMESTAMP_PATTERN.test(input.timestamp)) {
      throw new TEDError(`timestamp debe tener formato AAAA-MM-DDTHH:MI:SS, se recibió "${input.timestamp}"`);
    }
    if (input.recipientLegalName.length > MAX_GLOSA_LENGTH) {
      throw new TEDError(`recipientLegalName supera los ${MAX_GLOSA_LENGTH} caracteres permitidos`);
    }
    if (input.firstItemName.length > MAX_GLOSA_LENGTH) {
      throw new TEDError(`firstItemName supera los ${MAX_GLOSA_LENGTH} caracteres permitidos`);
    }

    const dd =
      "<DD>" +
      `<RE>${escapeXml(input.issuerRut)}</RE>` +
      `<TD>${escapeXml(caf.documentType)}</TD>` +
      `<F>${input.folio}</F>` +
      `<FE>${input.issueDate}</FE>` +
      `<RR>${escapeXml(input.recipientRut)}</RR>` +
      `<RSR>${escapeXml(input.recipientLegalName)}</RSR>` +
      `<MNT>${input.totalAmount}</MNT>` +
      `<IT1>${escapeXml(input.firstItemName)}</IT1>` +
      caf.rawXml +
      `<TSTED>${input.timestamp}</TSTED>` +
      "</DD>";

    const signature = sign(dd, caf.privateKeyPem);

    const xml = `<TED version="1.0">${dd}<FRMT algoritmo="SHA1withRSA">${signature}</FRMT></TED>`;

    return new TED(xml);
  }
}

function sign(data: string, privateKeyPem: string): string {
  const signer = createSign("RSA-SHA1");
  signer.update(toISO88591(data));
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}
