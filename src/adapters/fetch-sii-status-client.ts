import type {
  DteStatusInput,
  DteStatusResult,
  SiiStatusClient,
  UploadStatusResult,
} from "../domain/ports/sii-status-client.js";
import { SiiStatusClientError } from "../domain/errors.js";
import { splitRut } from "./rut-format.js";
import { buildSoapEnvelope, postSoap, extractReturnValue, parseSiiResponse } from "./soap.js";

/**
 * Adapter for the SiiStatusClient port. WSDLs y ejemplos en
 * docs/estado_envio.pdf (QueryEstUp) y docs/estado_dte.pdf
 * (QueryEstDte) — verificados contra el WSDL real de maullin.sii.cl.
 */

const NAMESPACE = "http://DefaultNamespace";
const UPLOAD_STATUS_URL = "https://maullin.sii.cl/DTEWS/QueryEstUp.jws";
const DTE_STATUS_URL = "https://maullin.sii.cl/DTEWS/QueryEstDte.jws";

export class FetchSiiStatusClient implements SiiStatusClient {
  async getUploadStatus(companyRut: string, trackId: string, token: string): Promise<UploadStatusResult> {
    const company = splitRut(companyRut, SiiStatusClientError);

    const requestBody =
      `<getEstUp xmlns="${NAMESPACE}">` +
      `<RutCompania xsi:type="xsd:string">${company.number}</RutCompania>` +
      `<DvCompania xsi:type="xsd:string">${company.dv}</DvCompania>` +
      `<TrackId xsi:type="xsd:string">${trackId}</TrackId>` +
      `<Token xsi:type="xsd:string">${token}</Token>` +
      `</getEstUp>`;

    const envelope = buildSoapEnvelope(requestBody);
    const responseXml = await postSoap(UPLOAD_STATUS_URL, envelope, SiiStatusClientError);
    const inner = extractReturnValue(responseXml, "getEstUpReturn", SiiStatusClientError);
    const { header, body } = parseSiiResponse(inner, SiiStatusClientError);

    return {
      status: header.ESTADO ?? "",
      ...(header.TRACKID !== undefined && { trackId: header.TRACKID }),
      ...(header.GLOSA !== undefined && { glosa: header.GLOSA }),
      ...(header.NUM_ATENCION !== undefined && { attentionNumber: header.NUM_ATENCION }),
      ...(body.TIPO_DOCTO !== undefined && { documentType: body.TIPO_DOCTO }),
      ...(body.INFORMADOS !== undefined && { informed: body.INFORMADOS }),
      ...(body.ACEPTADOS !== undefined && { accepted: body.ACEPTADOS }),
      ...(body.RECHAZADOS !== undefined && { rejected: body.RECHAZADOS }),
      ...(body.REPAROS !== undefined && { reviewed: body.REPAROS }),
    };
  }

  async getDteStatus(input: DteStatusInput, token: string): Promise<DteStatusResult> {
    // RutConsultante: quien pregunta. Se asume el mismo emisor
    // consultando sus propios documentos, que es el caso normal.
    const consultante = splitRut(input.companyRut, SiiStatusClientError);
    const company = consultante;
    const recipient = splitRut(input.recipientRut, SiiStatusClientError);

    const requestBody =
      `<getEstDte xmlns="${NAMESPACE}">` +
      `<RutConsultante xsi:type="xsd:string">${consultante.number}</RutConsultante>` +
      `<DvConsultante xsi:type="xsd:string">${consultante.dv}</DvConsultante>` +
      `<RutCompania xsi:type="xsd:string">${company.number}</RutCompania>` +
      `<DvCompania xsi:type="xsd:string">${company.dv}</DvCompania>` +
      `<RutReceptor xsi:type="xsd:string">${recipient.number}</RutReceptor>` +
      `<DvReceptor xsi:type="xsd:string">${recipient.dv}</DvReceptor>` +
      `<TipoDte xsi:type="xsd:string">${input.documentType}</TipoDte>` +
      `<FolioDte xsi:type="xsd:string">${input.folio}</FolioDte>` +
      `<FechaEmisionDte xsi:type="xsd:string">${toDDMMAAAA(input.issueDate)}</FechaEmisionDte>` +
      `<MontoDte xsi:type="xsd:string">${input.totalAmount}</MontoDte>` +
      `<Token xsi:type="xsd:string">${token}</Token>` +
      `</getEstDte>`;

    const envelope = buildSoapEnvelope(requestBody);
    const responseXml = await postSoap(DTE_STATUS_URL, envelope, SiiStatusClientError);
    const inner = extractReturnValue(responseXml, "getEstDteReturn", SiiStatusClientError);
    const { header } = parseSiiResponse(inner, SiiStatusClientError);

    return {
      status: header.ESTADO ?? "",
      ...(header.GLOSA !== undefined && { glosa: header.GLOSA }),
      ...(header.ERR_CODE !== undefined && { errorCode: header.ERR_CODE }),
      ...(header.GLOSA_ERR !== undefined && { errorGlosa: header.GLOSA_ERR }),
      ...(header.NUM_ATENCION !== undefined && { attentionNumber: header.NUM_ATENCION }),
    };
  }
}

/** AAAA-MM-DD -> DDMMAAAA, el formato que exige específicamente este webservice (docs/estado_dte.pdf). */
function toDDMMAAAA(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new SiiStatusClientError(`issueDate debe tener formato AAAA-MM-DD, se recibió "${isoDate}"`);
  }
  const [, year, month, day] = match;
  return `${day}${month}${year}`;
}
