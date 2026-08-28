import { CAFError } from "./errors.js";
import type { CAFParser, ParsedCAF } from "./ports/caf-parser.js";
import { FastXmlCAFParser } from "../adapters/fast-xml-caf-parser.js";

export { CAFError } from "./errors.js";

/** Tipos de DTE dentro del alcance de este SDK: boleta afecta (39) y exenta (41). */
const SUPPORTED_DOCUMENT_TYPES = ["39", "41"];

export class CAF {
  readonly issuerRut: string;
  readonly legalName: string;
  readonly documentType: string;
  readonly folioRange: { readonly from: number; readonly to: number };
  readonly authorizedAt: string;
  readonly publicKeyModulus: string;
  readonly publicKeyExponent: string;
  readonly keyId: string;
  readonly privateKeyPem: string;
  /** Bloque <CAF>...</CAF> textual, tal cual lo entregó el SII — se embebe sin modificar dentro del TED. */
  readonly rawXml: string;

  private constructor(parsed: ParsedCAF) {
    this.issuerRut = parsed.issuerRut;
    this.legalName = parsed.legalName;
    this.documentType = parsed.documentType;
    this.folioRange = parsed.folioRange;
    this.authorizedAt = parsed.authorizedAt;
    this.publicKeyModulus = parsed.publicKeyModulus;
    this.publicKeyExponent = parsed.publicKeyExponent;
    this.keyId = parsed.keyId;
    this.privateKeyPem = parsed.privateKeyPem;
    this.rawXml = parsed.rawXml;
  }

  /**
   * @param parser CAFParser port. Defaults to the fast-xml-parser
   * adapter; a different one (or a fake) can be injected to test the
   * domain logic without depending on the concrete library.
   */
  static async fromXML(buffer: Buffer, parser: CAFParser = new FastXmlCAFParser()): Promise<CAF> {
    const parsed = parser.parse(buffer);

    if (!SUPPORTED_DOCUMENT_TYPES.includes(parsed.documentType)) {
      throw new CAFError(
        `El CAF es para el tipo de documento ${parsed.documentType}, pero este SDK solo soporta boleta afecta (39) y exenta (41)`,
      );
    }
    if (parsed.folioRange.from > parsed.folioRange.to) {
      throw new CAFError(
        `El rango de folios del CAF es inválido: desde ${parsed.folioRange.from} hasta ${parsed.folioRange.to}`,
      );
    }

    return new CAF(parsed);
  }

  /** Indica si el folio dado está dentro del rango autorizado por este CAF. */
  includesFolio(folio: number): boolean {
    return folio >= this.folioRange.from && folio <= this.folioRange.to;
  }
}
