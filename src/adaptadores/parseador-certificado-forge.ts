import forge from "node-forge";
import { ErrorCertificado } from "../dominio/errores.js";
import type {
  CertificadoParseado,
  ParseadorCertificadoDigital,
} from "../dominio/puertos/parseador-certificado.js";

/** Adaptador del puerto ParseadorCertificadoDigital usando node-forge. */
export class ParseadorCertificadoForge implements ParseadorCertificadoDigital {
  parsear(buffer: Buffer, password: string): CertificadoParseado {
    let p12Asn1: forge.asn1.Asn1;
    try {
      const p12Der = forge.util.createBuffer(buffer.toString("binary"));
      p12Asn1 = forge.asn1.fromDer(p12Der);
    } catch (error) {
      throw new ErrorCertificado("El archivo .p12 no tiene un formato DER válido", { cause: error });
    }

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch (error) {
      throw new ErrorCertificado(
        "No se pudo abrir el .p12: la contraseña es incorrecta o el archivo está corrupto",
        { cause: error },
      );
    }

    const oidLlave = forge.pki.oids.pkcs8ShroudedKeyBag;
    const oidCert = forge.pki.oids.certBag;
    if (!oidLlave || !oidCert) {
      throw new ErrorCertificado("node-forge no reconoce los OIDs de PKCS#12 esperados");
    }

    const llaveBag = p12.getBags({ bagType: oidLlave })[oidLlave]?.[0];
    const certBag = p12.getBags({ bagType: oidCert })[oidCert]?.[0];

    if (!llaveBag?.key) {
      throw new ErrorCertificado("El .p12 no contiene una llave privada");
    }
    if (!certBag?.cert) {
      throw new ErrorCertificado("El .p12 no contiene un certificado");
    }

    return {
      llavePrivadaPem: forge.pki.privateKeyToPem(llaveBag.key),
      certificadoPem: forge.pki.certificateToPem(certBag.cert),
      subject: mapearSubject(certBag.cert),
    };
  }
}

function mapearSubject(cert: forge.pki.Certificate): Record<string, string> {
  const subject: Record<string, string> = {};
  for (const atributo of cert.subject.attributes) {
    const clave = atributo.shortName || atributo.name;
    if (clave && typeof atributo.value === "string") {
      subject[clave] = atributo.value;
    }
  }
  return subject;
}
