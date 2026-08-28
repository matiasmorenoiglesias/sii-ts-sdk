import type { DTE } from "./dte.js";
import type { Certificate } from "./certificate.js";
import type { DocumentSigner } from "./ports/document-signer.js";
import { XmlCryptoDocumentSigner } from "../adapters/xml-crypto-document-signer.js";
import { EnvioBoletaError } from "./errors.js";
import { escapeXml } from "./xml-escape.js";
import { SII_DTE_NAMESPACE } from "./xml-namespace.js";

export { EnvioBoletaError } from "./errors.js";

/**
 * Sobre de envío: EnvioBOLETA = SetDTE (Caratula + uno o más DTE) +
 * Signature, firmado con el certificado del emisor. Estructura según
 * docs/schema_envio_bol/EnvioBOLETA_v11.xsd.
 *
 * RutReceptor por defecto es el RUT del SII (60803000-K) — el
 * instructivo técnico y el manual de certificación (Factura
 * Electrónica) indican ese valor fijo como receptor del envío tanto en
 * certificación como en producción.
 */

const SII_RUT = "60803000-K";
const SET_DTE_ID = "SetDoc";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export interface EnvioBoletaInput {
  issuerRut: string;
  /** RUT de quien firma y envía (usuario autorizado ante el SII). */
  senderRut: string;
  /** Fecha de la resolución del SII que autoriza a emitir boleta electrónica, AAAA-MM-DD. */
  resolutionDate: string;
  /** Número de la resolución. En ambiente de certificación suele ser 0. */
  resolutionNumber: number;
  /** Fecha y hora de firma del envío, AAAA-MM-DDTHH:MI:SS. */
  timestamp: string;
  /** RUT del receptor del envío. Por defecto, el RUT del SII. */
  receiverRut?: string;
}

export class EnvioBoleta {
  /** El bloque <EnvioBOLETA>...</EnvioBOLETA> completo, firmado. */
  readonly xml: string;

  private constructor(xml: string) {
    this.xml = xml;
  }

  /**
   * @param signer DocumentSigner port. Defaults to the xml-crypto
   * adapter; a different one (or a fake) can be injected to test the
   * domain logic without depending on the concrete library.
   */
  static sign(
    dtes: DTE[],
    input: EnvioBoletaInput,
    certificate: Certificate,
    signer: DocumentSigner = new XmlCryptoDocumentSigner(),
  ): EnvioBoleta {
    if (dtes.length === 0) {
      throw new EnvioBoletaError("El envío debe incluir al menos un DTE");
    }
    if (!DATE_PATTERN.test(input.resolutionDate)) {
      throw new EnvioBoletaError(`resolutionDate debe tener formato AAAA-MM-DD, se recibió "${input.resolutionDate}"`);
    }
    if (!TIMESTAMP_PATTERN.test(input.timestamp)) {
      throw new EnvioBoletaError(`timestamp debe tener formato AAAA-MM-DDTHH:MI:SS, se recibió "${input.timestamp}"`);
    }

    const caratula =
      `<Caratula version="1.0">` +
      `<RutEmisor>${escapeXml(input.issuerRut)}</RutEmisor>` +
      `<RutEnvia>${escapeXml(input.senderRut)}</RutEnvia>` +
      `<RutReceptor>${escapeXml(input.receiverRut ?? SII_RUT)}</RutReceptor>` +
      `<FchResol>${input.resolutionDate}</FchResol>` +
      `<NroResol>${input.resolutionNumber}</NroResol>` +
      `<TmstFirmaEnv>${input.timestamp}</TmstFirmaEnv>` +
      countByDocumentType(dtes)
        .map(({ documentType, count }) => `<SubTotDTE><TpoDTE>${documentType}</TpoDTE><NroDTE>${count}</NroDTE></SubTotDTE>`)
        .join("") +
      "</Caratula>";

    const setDteXml =
      `<SetDTE xmlns="${SII_DTE_NAMESPACE}" ID="${SET_DTE_ID}">` +
      caratula +
      dtes.map((dte) => dte.xml).join("") +
      "</SetDTE>";

    let signatureXml: string;
    try {
      signatureXml = signer.sign(setDteXml, certificate.privateKeyPem, certificate.certificatePem);
    } catch (error) {
      throw new EnvioBoletaError("No se pudo firmar el envío", { cause: error });
    }

    const xml = `<EnvioBOLETA xmlns="${SII_DTE_NAMESPACE}" version="1.0">${setDteXml}${signatureXml}</EnvioBOLETA>`;
    return new EnvioBoleta(xml);
  }
}

function countByDocumentType(dtes: DTE[]): { documentType: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const dte of dtes) {
    counts.set(dte.documentType, (counts.get(dte.documentType) ?? 0) + 1);
  }
  return [...counts.entries()].map(([documentType, count]) => ({ documentType, count }));
}
