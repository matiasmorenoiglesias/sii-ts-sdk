import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import { Certificate } from "../src/domain/certificate.js";
import { XmlCryptoSeedSigner } from "../src/adapters/xml-crypto-seed-signer.js";

const certFixture = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));

test("XmlCryptoSeedSigner produce un <getToken> bien formado y firmado", async () => {
  const certificate = await Certificate.fromP12(await readFile(certFixture), "test1234");
  const signer = new XmlCryptoSeedSigner();

  const signedXml = signer.sign("000000000078", certificate.privateKeyPem, certificate.certificatePem);

  assert.match(signedXml, /^<getToken>/);
  assert.match(signedXml, /<Semilla>000000000078<\/Semilla>/);
  assert.match(signedXml, /<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">/);
  assert.match(signedXml, /<\/getToken>$/);

  const doc = new DOMParser().parseFromString(signedXml, "text/xml");
  const verifier = new SignedXml({ publicCert: certificate.certificatePem });
  const signatureNode = doc.getElementsByTagName("Signature")[0];
  assert.ok(signatureNode, "no se encontró el nodo Signature");
  verifier.loadSignature(signatureNode as Parameters<SignedXml["loadSignature"]>[0]);

  assert.equal(verifier.checkSignature(signedXml), true);
});
