import { Boleta } from "./boleta.js";
import type { Certificate } from "./certificate.js";
import type { DocumentSigner } from "./ports/document-signer.js";
import { XmlCryptoDocumentSigner } from "../adapters/xml-crypto-document-signer.js";
import { DTEError } from "./errors.js";

export { DTEError } from "./errors.js";

/**
 * DTE = Documento (de Boleta) + Signature, firmado con el certificado
 * digital del emisor (no con la llave del CAF — esa firma es la del
 * TED, ya incluida dentro de Documento). Estructura según
 * docs/schema_envio_bol/EnvioBOLETA_v11.xsd (BOLETADefType).
 */
export class DTE {
  /** El bloque <DTE version="1.0">...</DTE> completo, firmado. */
  readonly xml: string;
  readonly documentType: string;
  readonly folio: number;
  readonly issueDate: string;
  readonly recipientRut: string;
  readonly totalAmount: number;

  private constructor(
    xml: string,
    documentType: string,
    folio: number,
    issueDate: string,
    recipientRut: string,
    totalAmount: number,
  ) {
    this.xml = xml;
    this.documentType = documentType;
    this.folio = folio;
    this.issueDate = issueDate;
    this.recipientRut = recipientRut;
    this.totalAmount = totalAmount;
  }

  /**
   * @param signer DocumentSigner port. Defaults to the xml-crypto
   * adapter; a different one (or a fake) can be injected to test the
   * domain logic without depending on the concrete library.
   */
  static sign(
    boleta: Boleta,
    certificate: Certificate,
    signer: DocumentSigner = new XmlCryptoDocumentSigner(),
  ): DTE {
    let signatureXml: string;
    try {
      signatureXml = signer.sign(boleta.xml, certificate.privateKeyPem, certificate.certificatePem);
    } catch (error) {
      throw new DTEError("No se pudo firmar el documento", { cause: error });
    }

    const xml = `<DTE version="1.0">${boleta.xml}${signatureXml}</DTE>`;
    return new DTE(xml, boleta.documentType, boleta.folio, boleta.issueDate, boleta.recipientRut, boleta.totalAmount);
  }
}
