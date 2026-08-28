/**
 * Port: what the domain needs to produce an XML Digital Signature over
 * an XML fragment, without knowing which library implements it (XML
 * canonicalization + XMLDSig — no se hace a mano, ver adaptador).
 *
 * Estructura y algoritmos exigidos por el SII (Anexo 3, A.3.3.1 y
 * A.3.3.2 de docs/instructivo_emision.pdf):
 *
 *   <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
 *     <SignedInfo>
 *       <CanonicalizationMethod Algorithm="...xml-c14n-20010315"/>
 *       <SignatureMethod Algorithm="...rsa-sha1"/>
 *       <Reference URI="#XXXXX">
 *         <DigestMethod Algorithm="...sha1"/>
 *         <DigestValue>...</DigestValue>
 *       </Reference>
 *     </SignedInfo>
 *     <SignatureValue>...</SignatureValue>
 *     <KeyInfo>
 *       <KeyValue><RSAKeyValue><Modulus>...</Modulus><Exponent>...</Exponent></RSAKeyValue></KeyValue>
 *       <X509Data><X509Certificate>...</X509Certificate></X509Data>
 *     </KeyInfo>
 *   </Signature>
 */

export interface DocumentSigner {
  /**
   * Firma el elemento raíz del fragmento XML dado (debe tener un
   * atributo ID/Id único) y devuelve el bloque <Signature>...</Signature>
   * resultante, listo para insertar como hermano del elemento firmado.
   */
  sign(xml: string, privateKeyPem: string, certificatePem: string): string;
}
