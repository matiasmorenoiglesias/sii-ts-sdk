import type { Certificate } from "./certificate.js";
import type { CAF } from "./caf.js";
import { Boleta, type BoletaItem, type BoletaRecipient, type BoletaReference } from "./boleta.js";
import { DTE } from "./dte.js";
import { EnvioBoleta } from "./envio-boleta.js";
import { IssuerError } from "./errors.js";
import type { SeedSigner } from "./ports/seed-signer.js";
import type { SiiAuthClient } from "./ports/sii-auth-client.js";
import type { DocumentSigner } from "./ports/document-signer.js";
import type { EnvioBoletaUploader, UploadResult } from "./ports/envio-boleta-uploader.js";
import type { DteStatusResult, SiiStatusClient, UploadStatusResult } from "./ports/sii-status-client.js";
import { XmlCryptoSeedSigner } from "../adapters/xml-crypto-seed-signer.js";
import { FetchSiiAuthClient } from "../adapters/fetch-sii-auth-client.js";
import { XmlCryptoDocumentSigner } from "../adapters/xml-crypto-document-signer.js";
import { FetchEnvioBoletaUploader } from "../adapters/fetch-envio-boleta-uploader.js";
import { FetchSiiStatusClient } from "../adapters/fetch-sii-status-client.js";

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
  /** Fecha de la resolución del SII que autoriza a emitir boleta electrónica, AAAA-MM-DD. Requerida para enviar. */
  resolutionDate?: string;
  /** Número de la resolución. Por defecto 0, el valor fijo usado en el ambiente de certificación. */
  resolutionNumber?: number;
}

export interface CreateBoletaInput {
  caf: CAF;
  folio: number;
  recipient: BoletaRecipient;
  items: BoletaItem[];
  /** Referencia a otro documento (ej. el caso del set de pruebas de certificación). */
  reference?: BoletaReference;
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
  readonly resolutionDate: string | undefined;
  readonly resolutionNumber: number;

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
    this.resolutionDate = options.resolutionDate;
    this.resolutionNumber = options.resolutionNumber ?? 0;
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
      ...(input.reference !== undefined && { reference: input.reference }),
      timestamp: formatTimestamp(now),
    });

    return DTE.sign(boleta, this.certificate);
  }

  /**
   * Autentica contra el SII (semilla → token) usando el certificado del
   * emisor. Requiere conexión de red al ambiente de certificación.
   *
   * @param seedSigner SeedSigner port. Defaults to the xml-crypto adapter.
   * @param authClient SiiAuthClient port. Defaults to the fetch adapter.
   */
  async authenticate(
    seedSigner: SeedSigner = new XmlCryptoSeedSigner(),
    authClient: SiiAuthClient = new FetchSiiAuthClient(),
  ): Promise<string> {
    const seedResult = await authClient.getSeed();
    if (seedResult.status !== "00" || !seedResult.seed) {
      throw new IssuerError(`El SII no entregó una semilla válida (estado ${seedResult.status})`);
    }

    const signedSeedXml = seedSigner.sign(seedResult.seed, this.certificate.privateKeyPem, this.certificate.certificatePem);

    const tokenResult = await authClient.getToken(signedSeedXml);
    if (tokenResult.status !== "00" || !tokenResult.token) {
      const detail = tokenResult.glosa ? `: ${tokenResult.glosa}` : "";
      throw new IssuerError(`El SII no entregó un token válido (estado ${tokenResult.status}${detail})`);
    }

    return tokenResult.token;
  }

  /**
   * Envuelve la boleta en un sobre EnvioBOLETA firmado y lo sube al
   * ambiente de certificación. Requiere haber configurado
   * resolutionDate en el constructor. Requiere conexión de red.
   *
   * @param envelopeSigner DocumentSigner port para firmar el sobre. Defaults to the xml-crypto adapter.
   * @param uploader EnvioBoletaUploader port. Defaults to the fetch adapter.
   */
  async send(
    dte: DTE,
    token: string,
    envelopeSigner: DocumentSigner = new XmlCryptoDocumentSigner(),
    uploader: EnvioBoletaUploader = new FetchEnvioBoletaUploader(),
  ): Promise<UploadResult> {
    if (!this.resolutionDate) {
      throw new IssuerError("Falta resolutionDate: configúralo en el constructor de Issuer para poder enviar.");
    }

    const now = new Date();
    // RutEnvia es quien firma el envío (el titular del certificado),
    // que puede ser distinto de RutEmisor (la empresa autorizada por
    // el CAF) — ej. el representante legal firma en nombre de la SpA.
    const senderRut = this.certificate.issuerRut;
    const envio = EnvioBoleta.sign(
      [dte],
      {
        issuerRut: this.rut,
        senderRut,
        resolutionDate: this.resolutionDate,
        resolutionNumber: this.resolutionNumber,
        timestamp: formatTimestamp(now),
      },
      this.certificate,
      envelopeSigner,
    );

    const result = await uploader.upload(envio.xml, senderRut, this.rut, token);
    if (result.status !== "0") {
      throw new IssuerError(`El SII rechazó el envío (estado ${result.status})`);
    }

    return result;
  }

  /**
   * Consulta el estado de un envío ya subido, por su trackId (el que
   * devuelve `send()`). Requiere conexión de red.
   *
   * @param statusClient SiiStatusClient port. Defaults to the fetch adapter.
   */
  async checkUploadStatus(
    trackId: string,
    token: string,
    statusClient: SiiStatusClient = new FetchSiiStatusClient(),
  ): Promise<UploadStatusResult> {
    return statusClient.getUploadStatus(this.rut, trackId, token);
  }

  /**
   * Consulta el estado de un DTE individual ya emitido y enviado.
   * Requiere conexión de red.
   *
   * @param statusClient SiiStatusClient port. Defaults to the fetch adapter.
   */
  async checkDteStatus(
    dte: DTE,
    token: string,
    statusClient: SiiStatusClient = new FetchSiiStatusClient(),
  ): Promise<DteStatusResult> {
    return statusClient.getDteStatus(
      {
        companyRut: this.rut,
        recipientRut: dte.recipientRut,
        documentType: dte.documentType,
        folio: dte.folio,
        issueDate: dte.issueDate,
        totalAmount: dte.totalAmount,
      },
      token,
    );
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
