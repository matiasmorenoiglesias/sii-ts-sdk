import { XMLParser } from "fast-xml-parser";
import { CAFError } from "../domain/errors.js";
import type { CAFParser, ParsedCAF } from "../domain/ports/caf-parser.js";

interface CAFDocument {
  AUTORIZACION?: {
    CAF?: {
      DA?: {
        RE?: unknown;
        RS?: unknown;
        TD?: unknown;
        RNG?: { D?: unknown; H?: unknown };
        FA?: unknown;
        RSAPK?: { M?: unknown; E?: unknown };
        IDK?: unknown;
      };
    };
    RSASK?: unknown;
  };
}

/** Adapter for the CAFParser port using fast-xml-parser. */
export class FastXmlCAFParser implements CAFParser {
  parse(buffer: Buffer): ParsedCAF {
    const parser = new XMLParser();

    let doc: CAFDocument;
    try {
      doc = parser.parse(buffer.toString("latin1")) as CAFDocument;
    } catch (error) {
      throw new CAFError("El archivo CAF no es un XML válido", { cause: error });
    }

    const da = doc.AUTORIZACION?.CAF?.DA;
    const privateKeyPem = doc.AUTORIZACION?.RSASK;

    if (!da) {
      throw new CAFError("El CAF no tiene la estructura esperada (falta AUTORIZACION/CAF/DA)");
    }
    if (typeof privateKeyPem !== "string") {
      throw new CAFError("El CAF no incluye la llave privada (RSASK)");
    }

    const from = toNumber(da.RNG?.D, "RNG/D");
    const to = toNumber(da.RNG?.H, "RNG/H");

    return {
      issuerRut: toStringField(da.RE, "RE"),
      legalName: toStringField(da.RS, "RS"),
      documentType: toStringField(da.TD, "TD"),
      folioRange: { from, to },
      authorizedAt: toStringField(da.FA, "FA"),
      publicKeyModulus: toStringField(da.RSAPK?.M, "RSAPK/M"),
      publicKeyExponent: toStringField(da.RSAPK?.E, "RSAPK/E"),
      keyId: toStringField(da.IDK, "IDK"),
      privateKeyPem: privateKeyPem.trim(),
    };
  }
}

function toStringField(value: unknown, field: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  throw new CAFError(`El CAF no incluye el campo obligatorio ${field}`);
}

function toNumber(value: unknown, field: string): number {
  const asString = toStringField(value, field);
  const parsed = Number(asString);
  if (!Number.isInteger(parsed)) {
    throw new CAFError(`El campo ${field} del CAF no es un número entero válido: "${asString}"`);
  }
  return parsed;
}
