import { XMLParser } from "fast-xml-parser";
import type { SiiAuthClient, SiiSeedResult, SiiTokenResult } from "../domain/ports/sii-auth-client.js";
import { SiiAuthClientError } from "../domain/errors.js";
import { escapeXml } from "../domain/xml-escape.js";

/**
 * Adapter for the SiiAuthClient port using fetch nativo de Node. WSDLs
 * y ejemplos en docs/autenticacion.pdf — pero los endpoints reales de
 * certificación (maullin.sii.cl) usan el namespace SOAP
 * "http://DefaultNamespace", distinto al de los ejemplos de producción
 * (palena.sii.cl) del manual. Se verificó contra el WSDL real servido
 * en vivo por maullin.sii.cl, no solo contra el PDF.
 */

const NAMESPACE = "http://DefaultNamespace";
const SEED_URL = "https://maullin.sii.cl/DTEWS/CrSeed.jws";
const TOKEN_URL = "https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws";

export class FetchSiiAuthClient implements SiiAuthClient {
  async getSeed(): Promise<SiiSeedResult> {
    const envelope = buildSoapEnvelope(`<getSeed xmlns="${NAMESPACE}"/>`);
    const responseXml = await postSoap(SEED_URL, envelope);
    const inner = extractReturnValue(responseXml, "getSeedReturn");
    const { status, data } = parseSiiResponse(inner, "SEMILLA");
    return { status, ...(data !== undefined && { seed: data }) };
  }

  async getToken(signedSeedXml: string): Promise<SiiTokenResult> {
    const body = `<getToken xmlns="${NAMESPACE}"><pszXml xsi:type="xsd:string">${escapeXml(signedSeedXml)}</pszXml></getToken>`;
    const envelope = buildSoapEnvelope(body);
    const responseXml = await postSoap(TOKEN_URL, envelope);
    const inner = extractReturnValue(responseXml, "getTokenReturn");
    const { status, glosa, data } = parseSiiResponse(inner, "TOKEN");
    return { status, ...(glosa !== undefined && { glosa }), ...(data !== undefined && { token: data }) };
  }
}

function buildSoapEnvelope(body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`
  );
}

async function postSoap(url: string, envelope: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
      body: envelope,
    });
  } catch (error) {
    throw new SiiAuthClientError(`No se pudo conectar con ${url}`, { cause: error });
  }

  if (!response.ok) {
    throw new SiiAuthClientError(`El SII respondió ${response.status} ${response.statusText} en ${url}`);
  }

  return response.text();
}

function extractReturnValue(soapXml: string, tag: string): string {
  const match = soapXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!match?.[1]) {
    throw new SiiAuthClientError(`La respuesta del SII no incluye <${tag}>: ${soapXml.slice(0, 300)}`);
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
    "SII:RESP_HDR"?: { ESTADO?: unknown; GLOSA?: unknown };
    "SII:RESP_BODY"?: Record<string, unknown>;
  };
}

function parseSiiResponse(
  innerXml: string,
  dataTag: "SEMILLA" | "TOKEN",
): { status: string; glosa: string | undefined; data: string | undefined } {
  const parser = new XMLParser();
  let doc: SiiResponseDoc;
  try {
    doc = parser.parse(innerXml) as SiiResponseDoc;
  } catch (error) {
    throw new SiiAuthClientError("La respuesta del SII no es un XML válido", { cause: error });
  }

  const header = doc["SII:RESPUESTA"]?.["SII:RESP_HDR"];
  const body = doc["SII:RESPUESTA"]?.["SII:RESP_BODY"];

  const status = header?.ESTADO;
  if (status === undefined) {
    throw new SiiAuthClientError(`La respuesta del SII no incluye ESTADO: ${innerXml}`);
  }

  const glosaValue = header?.GLOSA;
  const dataValue = body?.[dataTag];

  return {
    status: String(status),
    glosa: glosaValue !== undefined ? String(glosaValue) : undefined,
    data: dataValue !== undefined ? String(dataValue) : undefined,
  };
}
