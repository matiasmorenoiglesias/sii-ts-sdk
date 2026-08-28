import type { Certificate } from "./certificate.js";
import type { CAF } from "./caf.js";
import { Boleta, type BoletaItem, type BoletaRecipient } from "./boleta.js";
import { DTE } from "./dte.js";
import { IssuerError } from "./errors.js";

export { IssuerError } from "./errors.js";

/** Único ambiente soportado por este SDK — ver alcance en CLAUDE.md. */
export type Environment = "certification";

export interface IssuerOptions {
  rut: string;
  /** Razón social del emisor, máximo 100 caracteres. */
  legalName?: string;
  /** Giro del emisor, máximo 80 caracteres. */
  businessActivity?: string;
  certificate: Certificate;
  environment: Environment;
}

export interface CreateBoletaInput {
  caf: CAF;
  folio: number;
  recipient: BoletaRecipient;
  items: BoletaItem[];
}

/**
 * Fachada pública del SDK — API objetivo de CLAUDE.md. Junta
 * Certificate + CAF + Boleta + DTE en la interfaz que se espera que
 * use un consumidor de la librería.
 */
export class Issuer {
  readonly rut: string;
  readonly legalName: string | undefined;
  readonly businessActivity: string | undefined;
  readonly certificate: Certificate;
  readonly environment: Environment;

  constructor(options: IssuerOptions) {
    if (options.environment !== "certification") {
      throw new IssuerError(
        `Ambiente no soportado: "${options.environment}". Este SDK solo opera en el ambiente de certificación del SII (ver alcance en CLAUDE.md).`,
      );
    }

    this.rut = options.rut;
    this.legalName = options.legalName;
    this.businessActivity = options.businessActivity;
    this.certificate = options.certificate;
    this.environment = options.environment;
  }

  /**
   * Arma y firma una boleta lista para enviar. La fecha de emisión y el
   * timestamp de firma se generan con la hora local del sistema — si el
   * proceso no corre en huso horario de Chile, hay que tenerlo en
   * cuenta (no hay forma de saber la zona horaria correcta desde acá).
   */
  async createBoleta(input: CreateBoletaInput): Promise<DTE> {
    const now = new Date();

    const boleta = Boleta.create(input.caf, {
      folio: input.folio,
      issueDate: formatDate(now),
      issuer: {
        rut: this.rut,
        ...(this.legalName !== undefined && { legalName: this.legalName }),
        ...(this.businessActivity !== undefined && { businessActivity: this.businessActivity }),
      },
      recipient: input.recipient,
      items: input.items,
      timestamp: formatTimestamp(now),
    });

    return DTE.sign(boleta, this.certificate);
  }
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimestamp(date: Date): string {
  return `${formatDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
