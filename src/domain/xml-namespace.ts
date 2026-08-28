/**
 * Namespace de los documentos del SII (EnvioBOLETA_v11.xsd,
 * targetNamespace). Se declara explícitamente en cada elemento que se
 * firma (Documento, SetDTE) — no solo en la raíz del sobre — porque la
 * canonicalización XML usada por el SII (C14N inclusiva, no exclusiva)
 * propaga los namespaces en scope al canonicalizar. Si el namespace
 * solo estuviera en la raíz, el mismo elemento se canonicalizaría
 * distinto firmado en aislado vs. embebido en el sobre completo,
 * invalidando la firma en silencio.
 */
export const SII_DTE_NAMESPACE = "http://www.sii.cl/SiiDte";
