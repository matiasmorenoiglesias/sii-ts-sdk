/**
 * Port: what the domain needs to read a CAF (Código de Autorización de
 * Folios) XML file, without knowing which XML library implements it.
 *
 * Structure per SII "Instructivo Técnico Factura Electrónica" (Anexo 1 -
 * Código de Autorización de Folios): docs/instructivo_emision.pdf
 *
 *   <AUTORIZACION>
 *     <CAF version="1.0">
 *       <DA>
 *         <RE>...</RE>              RUT emisor
 *         <RS>...</RS>              Razón social
 *         <TD>...</TD>              Tipo de documento
 *         <RNG><D>...</D><H>...</H></RNG>  Rango de folios
 *         <FA>...</FA>              Fecha de autorización (AAAA-MM-DD)
 *         <RSAPK><M>...</M><E>...</E></RSAPK>  Llave pública del SII
 *         <IDK>...</IDK>            Identificador de la llave del SII
 *       </DA>
 *       <FRMA algoritmo="SHA1withRSA">...</FRMA>  Firma del SII sobre DA
 *     </CAF>
 *     <RSASK>-----BEGIN RSA PRIVATE KEY-----...</RSASK>  Llave privada
 *     <RSAPUBK>...</RSAPUBK>
 *   </AUTORIZACION>
 */

export interface ParsedCAF {
  issuerRut: string;
  legalName: string;
  documentType: string;
  folioRange: { from: number; to: number };
  /** Fecha de autorización tal cual la entrega el SII (AAAA-MM-DD), sin parsear a Date. */
  authorizedAt: string;
  publicKeyModulus: string;
  publicKeyExponent: string;
  keyId: string;
  /** Llave privada que firma el TED, en formato PEM tal cual la entrega el SII. */
  privateKeyPem: string;
  /**
   * El bloque <CAF version="...">...</CAF> tal cual apareció en el XML
   * original (byte a byte, sin reconstruir). El TED debe embeber este
   * bloque exactamente así — el SII firmó su copia sobre esos bytes
   * exactos, así que reconstruirlo desde los campos parseados podría
   * introducir diferencias de espacios que invaliden la firma.
   */
  rawXml: string;
}

export interface CAFParser {
  parse(buffer: Buffer): ParsedCAF;
}
