import forge from "node-forge";
import { CertificateError } from "../domain/errors.js";
import type {
  CertificateParser,
  ParsedCertificate,
} from "../domain/ports/certificate-parser.js";

/** Adapter for the CertificateParser port using node-forge. */
export class ForgeCertificateParser implements CertificateParser {
  parse(buffer: Buffer, password: string): ParsedCertificate {
    let p12Asn1: forge.asn1.Asn1;
    try {
      const p12Der = forge.util.createBuffer(buffer.toString("binary"));
      p12Asn1 = forge.asn1.fromDer(p12Der);
    } catch (error) {
      throw new CertificateError("El archivo .p12 no tiene un formato DER válido", { cause: error });
    }

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch (error) {
      throw new CertificateError(
        "No se pudo abrir el .p12: la contraseña es incorrecta o el archivo está corrupto",
        { cause: error },
      );
    }

    const keyOid = forge.pki.oids.pkcs8ShroudedKeyBag;
    const certOid = forge.pki.oids.certBag;
    if (!keyOid || !certOid) {
      throw new CertificateError("node-forge no reconoce los OIDs de PKCS#12 esperados");
    }

    const keyBag = p12.getBags({ bagType: keyOid })[keyOid]?.[0];
    const certBag = p12.getBags({ bagType: certOid })[certOid]?.[0];

    if (!keyBag?.key) {
      throw new CertificateError("El .p12 no contiene una llave privada");
    }
    if (!certBag?.cert) {
      throw new CertificateError("El .p12 no contiene un certificado");
    }

    return {
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
      certificatePem: forge.pki.certificateToPem(certBag.cert),
      subject: mapSubject(certBag.cert),
    };
  }
}

function mapSubject(cert: forge.pki.Certificate): Record<string, string> {
  const subject: Record<string, string> = {};
  for (const attribute of cert.subject.attributes) {
    const key = attribute.shortName || attribute.name;
    if (key && typeof attribute.value === "string") {
      subject[key] = attribute.value;
    }
  }
  return subject;
}
