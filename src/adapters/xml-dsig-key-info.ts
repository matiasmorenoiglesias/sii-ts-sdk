import { X509Certificate } from "node:crypto";

/**
 * KeyInfo con <KeyValue><RSAKeyValue> + <X509Data>, según el ejemplo
 * concreto del SII (Anexo 3, A.3.3.1/A.3.3.2 de
 * docs/instructivo_emision.pdf, y 4.1.5 de docs/autenticacion.pdf).
 * xml-crypto por defecto solo genera X509Data; el SII espera ambos.
 */
export function buildKeyInfoContent(certificatePem: string): string {
  const cert = new X509Certificate(certificatePem);
  const jwk = cert.publicKey.export({ format: "jwk" }) as { n?: string; e?: string };
  if (!jwk.n || !jwk.e) {
    throw new Error("El certificado no tiene una llave pública RSA");
  }

  const modulus = base64FromBase64Url(jwk.n);
  const exponent = base64FromBase64Url(jwk.e);
  const certificateDer = certificatePem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s+/g, "");

  return (
    `<KeyValue><RSAKeyValue><Modulus>${modulus}</Modulus><Exponent>${exponent}</Exponent></RSAKeyValue></KeyValue>` +
    `<X509Data><X509Certificate>${certificateDer}</X509Certificate></X509Data>`
  );
}

function base64FromBase64Url(value: string): string {
  const padded = value + "===".slice((value.length + 3) % 4);
  return padded.replace(/-/g, "+").replace(/_/g, "/");
}
