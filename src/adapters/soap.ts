import { XMLParser } from "fast-xml-parser";

/**
 * Helpers compartidos para hablar con los webservices SOAP RPC/encoded
 * del SII (namespace "http://DefaultNamespace" en certificación —
 * verificado contra el WSDL real de maullin.sii.cl, no solo contra los
 * PDFs, que a veces muestran el namespace de producción). La respuesta
 * siempre viene envuelta en un <SII:RESPUESTA><SII:RESP_HDR>/<SII:RESP_BODY>.
 */

export function buildSoapEnvelope(body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`
  );
}

export async function postSoap(
  url: string,
  envelope: string,
  ErrorClass: new (message: string, options?: { cause?: unknown }) => Error,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
      body: envelope,
    });
  } catch (error) {
    throw new ErrorClass(`No se pudo conectar con ${url}`, { cause: error });
  }

  if (!response.ok) {
    throw new ErrorClass(`El SII respondió ${response.status} ${response.statusText} en ${url}`);
  }

  return response.text();
}

export function extractReturnValue(
  soapXml: string,
  tag: string,
  ErrorClass: new (message: string) => Error,
): string {
  const match = soapXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!match?.[1]) {
    throw new ErrorClass(`La respuesta del SII no incluye <${tag}>: ${soapXml.slice(0, 300)}`);
  }
  return unescapeXmlEntities(match[1]);
}

function unescapeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

interface SiiResponseDoc {
  "SII:RESPUESTA"?: {
    "SII:RESP_HDR"?: Record<string, unknown>;
    "SII:RESP_BODY"?: Record<string, unknown>;
  };
}

export interface ParsedSiiResponse {
  header: Record<string, string>;
  body: Record<string, string>;
}

/** Parsea el XML interno (ya desescapado) de <SII:RESPUESTA> a mapas planos de string. */
export function parseSiiResponse(
  innerXml: string,
  ErrorClass: new (message: string, options?: { cause?: unknown }) => Error,
): ParsedSiiResponse {
  const parser = new XMLParser();
  let doc: SiiResponseDoc;
  try {
    doc = parser.parse(innerXml) as SiiResponseDoc;
  } catch (error) {
    throw new ErrorClass("La respuesta del SII no es un XML válido", { cause: error });
  }

  const header = toStringMap(doc["SII:RESPUESTA"]?.["SII:RESP_HDR"]);
  const body = toStringMap(doc["SII:RESPUESTA"]?.["SII:RESP_BODY"]);

  if (header.ESTADO === undefined) {
    throw new ErrorClass(`La respuesta del SII no incluye ESTADO: ${innerXml}`);
  }

  return { header, body };
}

function toStringMap(record: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!record) return result;
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) result[key] = String(value);
  }
  return result;
}
