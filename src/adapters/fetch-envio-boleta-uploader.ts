import { XMLParser } from "fast-xml-parser";
import type { EnvioBoletaUploader, UploadResult } from "../domain/ports/envio-boleta-uploader.js";
import { EnvioBoletaUploaderError } from "../domain/errors.js";

/**
 * Adapter for the EnvioBoletaUploader port usando fetch nativo con
 * FormData (multipart/form-data). Endpoint y campos según
 * docs/envio.pdf — el manual describe la construcción manual del
 * request (boundary, Content-Length) porque está pensado para clientes
 * antiguos en C/C++; con fetch + FormData el runtime se encarga de eso
 * correctamente.
 */

const UPLOAD_URL = "https://maullin.sii.cl/cgi_dte/UPL/DTEUpload";

export class FetchEnvioBoletaUploader implements EnvioBoletaUploader {
  async upload(xml: string, senderRut: string, companyRut: string, token: string): Promise<UploadResult> {
    const sender = splitRut(senderRut);
    const company = splitRut(companyRut);

    const form = new FormData();
    form.append("rutSender", sender.number);
    form.append("dvSender", sender.dv);
    form.append("rutCompany", company.number);
    form.append("dvCompany", company.dv);
    form.append("archivo", new Blob([xml], { type: "text/xml" }), "EnvioBoleta.xml");

    let response: Response;
    try {
      response = await fetch(UPLOAD_URL, {
        method: "POST",
        headers: { Cookie: `TOKEN=${token}` },
        body: form,
      });
    } catch (error) {
      throw new EnvioBoletaUploaderError(`No se pudo conectar con ${UPLOAD_URL}`, { cause: error });
    }

    if (!response.ok) {
      throw new EnvioBoletaUploaderError(`El SII respondió ${response.status} ${response.statusText}`);
    }

    return parseUploadResponse(await response.text());
  }
}

function splitRut(rut: string): { number: string; dv: string } {
  const match = rut.match(/^(\d{1,8})-([\dkK])$/);
  if (!match?.[1] || !match[2]) {
    throw new EnvioBoletaUploaderError(`RUT con formato inválido: "${rut}" (se espera XXXXXXXX-X)`);
  }
  return { number: match[1], dv: match[2] };
}

interface RecepcionDteDoc {
  RECEPCIONDTE?: {
    RUTSENDER?: unknown;
    RUTCOMPANY?: unknown;
    FILE?: unknown;
    TIMESTAMP?: unknown;
    STATUS?: unknown;
    TRACKID?: unknown;
  };
}

function parseUploadResponse(responseXml: string): UploadResult {
  const parser = new XMLParser();
  let doc: RecepcionDteDoc;
  try {
    doc = parser.parse(responseXml) as RecepcionDteDoc;
  } catch (error) {
    throw new EnvioBoletaUploaderError("La respuesta del SII no es un XML válido", { cause: error });
  }

  const recepcion = doc.RECEPCIONDTE;
  if (!recepcion || recepcion.STATUS === undefined) {
    throw new EnvioBoletaUploaderError(`La respuesta del SII no tiene el formato esperado: ${responseXml.slice(0, 300)}`);
  }

  const trackId = recepcion.TRACKID;

  return {
    senderRut: String(recepcion.RUTSENDER ?? ""),
    companyRut: String(recepcion.RUTCOMPANY ?? ""),
    fileName: String(recepcion.FILE ?? ""),
    timestamp: String(recepcion.TIMESTAMP ?? ""),
    status: String(recepcion.STATUS),
    ...(trackId !== undefined && { trackId: String(trackId) }),
  };
}
