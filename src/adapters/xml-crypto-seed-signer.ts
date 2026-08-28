import { SignedXml } from "xml-crypto";
import type { SeedSigner } from "../domain/ports/seed-signer.js";
import { buildKeyInfoContent } from "./xml-dsig-key-info.js";

const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";
const ENVELOPED_SIGNATURE = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

/** Adapter for the SeedSigner port using xml-crypto (enveloped XMLDSig). */
export class XmlCryptoSeedSigner implements SeedSigner {
  sign(seed: string, privateKeyPem: string, certificatePem: string): string {
    const xml = `<getToken><item><Semilla>${seed}</Semilla></item></getToken>`;

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certificatePem,
      signatureAlgorithm: RSA_SHA1,
      canonicalizationAlgorithm: C14N,
      getKeyInfoContent: () => buildKeyInfoContent(certificatePem),
    });

    sig.addReference({
      xpath: "/*",
      transforms: [ENVELOPED_SIGNATURE],
      digestAlgorithm: SHA1,
      isEmptyUri: true,
    });

    sig.computeSignature(xml);

    return sig.getSignedXml();
  }
}
