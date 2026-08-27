import forge from "node-forge";

export class ErrorCertificado extends Error {
  constructor(mensaje: string, { cause }: { cause?: unknown } = {}) {
    super(mensaje, { cause });
    this.name = "ErrorCertificado";
  }
}

export class Certificado {
  readonly llavePrivadaPem: string;
  readonly certificadoPem: string;
  readonly rutEmisor: string;

  private constructor(llavePrivadaPem: string, certificadoPem: string, rutEmisor: string) {
    this.llavePrivadaPem = llavePrivadaPem;
    this.certificadoPem = certificadoPem;
    this.rutEmisor = rutEmisor;
  }

  static async desdeP12(buffer: Buffer, password: string): Promise<Certificado> {
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
    const bagsLlave = p12.getBags({ bagType: oidLlave });
    const bagsCert = p12.getBags({ bagType: oidCert });

    const llaveBag = bagsLlave[oidLlave]?.[0];
    const certBag = bagsCert[oidCert]?.[0];

    if (!llaveBag?.key) {
      throw new ErrorCertificado("El .p12 no contiene una llave privada");
    }
    if (!certBag?.cert) {
      throw new ErrorCertificado("El .p12 no contiene un certificado");
    }

    const llavePrivadaPem = forge.pki.privateKeyToPem(llaveBag.key);
    const certificadoPem = forge.pki.certificateToPem(certBag.cert);
    const rutEmisor = extraerRutDelSubject(certBag.cert);

    return new Certificado(llavePrivadaPem, certificadoPem, rutEmisor);
  }
}

/**
 * El RUT del titular va en el subject del certificado, típicamente en el
 * campo serialNumber o en un CN con formato "NOMBRE, RUT". El formato
 * exacto depende de la autoridad certificadora (E-Sign, Acepta, etc.).
 * TODO: confirmar contra certificados reales de distintas CAs cuando
 * tengamos fixtures — por ahora se busca en serialNumber primero.
 */
function extraerRutDelSubject(cert: forge.pki.Certificate): string {
  const serialNumberAttr = cert.subject.getField("serialNumber");
  if (serialNumberAttr?.value) {
    return normalizarRut(serialNumberAttr.value);
  }

  const cn = cert.subject.getField("CN")?.value;
  const match = cn?.match(/(\d{1,8}-[\dkK])/);
  if (match?.[1]) {
    return normalizarRut(match[1]);
  }

  throw new ErrorCertificado("No se pudo extraer el RUT del certificado");
}

function normalizarRut(rut: string): string {
  return rut.trim().toUpperCase().replace(/^CL/, "");
}
