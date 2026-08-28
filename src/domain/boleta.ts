import { CAF } from "./caf.js";
import { TED } from "./ted.js";
import { BoletaError } from "./errors.js";
import { escapeXml } from "./xml-escape.js";
import { SII_DTE_NAMESPACE } from "./xml-namespace.js";

export { BoletaError } from "./errors.js";

/**
 * Estructura de <Documento> según el schema vigente del SII para boleta
 * electrónica: docs/schema_envio_bol/EnvioBOLETA_v11.xsd (elemento
 * BOLETADefType). Solo se generan los campos obligatorios y los
 * opcionales que la API objetivo del CLAUDE.md expone.
 *
 * NOTA — decisión pendiente de confirmar: el schema exige el campo
 * <IndServicio> (tipo de transacción, 1-4) dentro de <IdDoc>, que no
 * está contemplado en la API objetivo. Se usa el valor "3" ("Boleta de
 * Ventas y Servicio"), el caso general, hasta que se confirme si hace
 * falta exponerlo al llamador.
 *
 * NOTA — <Totales> solo incluye <MntTotal> (el único campo obligatorio
 * del schema). No se calculan <MntNeto>/<IVA> todavía: el desglose neto
 * + IVA depende de reglas de redondeo que no están confirmadas contra
 * documentación oficial, así que se prefiere omitirlos (son opcionales)
 * antes que adivinar la fórmula exacta.
 */

const DEFAULT_IND_SERVICIO = "3";
const MAX_ITEM_NAME_LENGTH = 80;
const MAX_LEGAL_NAME_LENGTH = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export interface BoletaIssuer {
  rut: string;
  /** Razón social del emisor, máximo 100 caracteres. */
  legalName?: string;
  /** Giro del emisor, máximo 80 caracteres. */
  businessActivity?: string;
}

export interface BoletaRecipient {
  rut: string;
  /** Razón social del receptor, máximo 100 caracteres. */
  legalName?: string;
}

export interface BoletaItem {
  /** Nombre del ítem, máximo 80 caracteres. */
  name: string;
  quantity?: number;
  price?: number;
}

export interface BoletaInput {
  folio: number;
  /** Fecha de emisión, formato AAAA-MM-DD. */
  issueDate: string;
  issuer: BoletaIssuer;
  recipient: BoletaRecipient;
  items: BoletaItem[];
  /**
   * Fecha y hora de generación del timbre y de la firma del documento,
   * formato AAAA-MM-DDTHH:MI:SS. Se usa el mismo valor para TSTED y
   * TmstFirma por simplicidad — en la práctica el SII no exige que sean
   * exactamente el mismo instante.
   */
  timestamp: string;
}

interface LineItem {
  lineNumber: number;
  name: string;
  quantity?: number;
  price?: number;
  amount: number;
}

export class Boleta {
  /** El bloque <Documento>...</Documento> completo, sin firmar todavía. */
  readonly xml: string;
  readonly id: string;
  readonly documentType: string;
  readonly ted: TED;
  readonly totalAmount: number;

  private constructor(xml: string, id: string, documentType: string, ted: TED, totalAmount: number) {
    this.xml = xml;
    this.id = id;
    this.documentType = documentType;
    this.ted = ted;
    this.totalAmount = totalAmount;
  }

  static create(caf: CAF, input: BoletaInput): Boleta {
    if (!DATE_PATTERN.test(input.issueDate)) {
      throw new BoletaError(`issueDate debe tener formato AAAA-MM-DD, se recibió "${input.issueDate}"`);
    }
    if (!TIMESTAMP_PATTERN.test(input.timestamp)) {
      throw new BoletaError(`timestamp debe tener formato AAAA-MM-DDTHH:MI:SS, se recibió "${input.timestamp}"`);
    }
    if (input.items.length === 0) {
      throw new BoletaError("La boleta debe tener al menos un ítem en el detalle");
    }
    if (input.issuer.legalName && input.issuer.legalName.length > MAX_LEGAL_NAME_LENGTH) {
      throw new BoletaError(`issuer.legalName supera los ${MAX_LEGAL_NAME_LENGTH} caracteres permitidos`);
    }
    if (input.recipient.legalName && input.recipient.legalName.length > MAX_LEGAL_NAME_LENGTH) {
      throw new BoletaError(`recipient.legalName supera los ${MAX_LEGAL_NAME_LENGTH} caracteres permitidos`);
    }

    const lineItems = input.items.map((item, index) => buildLineItem(item, index + 1));
    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const firstItem = lineItems[0];
    if (!firstItem) {
      throw new BoletaError("La boleta debe tener al menos un ítem en el detalle");
    }

    const ted = TED.generate(caf, {
      issuerRut: input.issuer.rut,
      folio: input.folio,
      issueDate: input.issueDate,
      recipientRut: input.recipient.rut,
      recipientLegalName: input.recipient.legalName ?? "",
      totalAmount,
      firstItemName: firstItem.name,
      timestamp: input.timestamp,
    });

    const id = `F${input.folio}T${caf.documentType}`;

    const xml =
      `<Documento xmlns="${SII_DTE_NAMESPACE}" ID="${id}">` +
      "<Encabezado>" +
      buildIdDoc(caf.documentType, input.folio, input.issueDate) +
      buildEmisor(input.issuer) +
      buildReceptor(input.recipient) +
      buildTotales(totalAmount) +
      "</Encabezado>" +
      lineItems.map(buildDetalle).join("") +
      ted.xml +
      `<TmstFirma>${input.timestamp}</TmstFirma>` +
      "</Documento>";

    return new Boleta(xml, id, caf.documentType, ted, totalAmount);
  }
}

function buildLineItem(item: BoletaItem, lineNumber: number): LineItem {
  if (item.name.length > MAX_ITEM_NAME_LENGTH) {
    throw new BoletaError(`El nombre del ítem "${item.name}" supera los ${MAX_ITEM_NAME_LENGTH} caracteres permitidos`);
  }
  if (item.price === undefined) {
    throw new BoletaError(`El ítem "${item.name}" no tiene precio`);
  }
  const quantity = item.quantity ?? 1;
  const amount = Math.round(quantity * item.price);

  return {
    lineNumber,
    name: item.name,
    amount,
    ...(item.quantity !== undefined && { quantity: item.quantity }),
    ...(item.price !== undefined && { price: item.price }),
  };
}

function buildIdDoc(documentType: string, folio: number, issueDate: string): string {
  return (
    "<IdDoc>" +
    `<TipoDTE>${documentType}</TipoDTE>` +
    `<Folio>${folio}</Folio>` +
    `<FchEmis>${issueDate}</FchEmis>` +
    `<IndServicio>${DEFAULT_IND_SERVICIO}</IndServicio>` +
    "</IdDoc>"
  );
}

function buildEmisor(issuer: BoletaIssuer): string {
  let xml = `<Emisor><RUTEmisor>${escapeXml(issuer.rut)}</RUTEmisor>`;
  if (issuer.legalName) xml += `<RznSocEmisor>${escapeXml(issuer.legalName)}</RznSocEmisor>`;
  if (issuer.businessActivity) xml += `<GiroEmisor>${escapeXml(issuer.businessActivity)}</GiroEmisor>`;
  xml += "</Emisor>";
  return xml;
}

function buildReceptor(recipient: BoletaRecipient): string {
  let xml = `<Receptor><RUTRecep>${escapeXml(recipient.rut)}</RUTRecep>`;
  if (recipient.legalName) xml += `<RznSocRecep>${escapeXml(recipient.legalName)}</RznSocRecep>`;
  xml += "</Receptor>";
  return xml;
}

function buildTotales(totalAmount: number): string {
  return `<Totales><MntTotal>${totalAmount}</MntTotal></Totales>`;
}

function buildDetalle(item: LineItem): string {
  let xml = `<Detalle><NroLinDet>${item.lineNumber}</NroLinDet>`;
  xml += `<NmbItem>${escapeXml(item.name)}</NmbItem>`;
  if (item.quantity !== undefined) xml += `<QtyItem>${item.quantity}</QtyItem>`;
  if (item.price !== undefined) xml += `<PrcItem>${item.price}</PrcItem>`;
  xml += `<MontoItem>${item.amount}</MontoItem>`;
  xml += "</Detalle>";
  return xml;
}
