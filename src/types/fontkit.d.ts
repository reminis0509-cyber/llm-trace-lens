// Ambient module declaration for @pdf-lib/fontkit.
// Upstream ships `fontkit.d.ts` as `export as namespace fontkit` which does not
// provide a default-exportable module shape for NodeNext resolution. We only
// need the value (Fontkit instance passed to PDFDocument.registerFontkit), so
// an opaque `unknown` default export is sufficient and type-safe.
declare module '@pdf-lib/fontkit' {
  const fontkit: unknown;
  export default fontkit;
}
