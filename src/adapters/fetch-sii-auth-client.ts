import type { SiiAuthClient, SiiSeedResult, SiiTokenResult } from "../domain/ports/sii-auth-client.js";
import { SiiAuthClientError } from "../domain/errors.js";
import { escapeXml } from "../domain/xml-escape.js";
import { buildSoapEnvelope, postSoap, extractReturnValue, parseSiiResponse } from "./soap.js";

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
    const responseXml = await postSoap(SEED_URL, envelope, SiiAuthClientError);
    const inner = extractReturnValue(responseXml, "getSeedReturn", SiiAuthClientError);
    const { header, body } = parseSiiResponse(inner, SiiAuthClientError);
    return { status: header.ESTADO ?? "", ...(body.SEMILLA !== undefined && { seed: body.SEMILLA }) };
  }

  async getToken(signedSeedXml: string): Promise<SiiTokenResult> {
    const requestBody = `<getToken xmlns="${NAMESPACE}"><pszXml xsi:type="xsd:string">${escapeXml(signedSeedXml)}</pszXml></getToken>`;
    const envelope = buildSoapEnvelope(requestBody);
    const responseXml = await postSoap(TOKEN_URL, envelope, SiiAuthClientError);
    const inner = extractReturnValue(responseXml, "getTokenReturn", SiiAuthClientError);
    const { header, body } = parseSiiResponse(inner, SiiAuthClientError);
    return {
      status: header.ESTADO ?? "",
      ...(header.GLOSA !== undefined && { glosa: header.GLOSA }),
      ...(body.TOKEN !== undefined && { token: body.TOKEN }),
    };
  }
}
