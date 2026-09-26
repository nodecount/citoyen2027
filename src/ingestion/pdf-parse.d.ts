declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResultat {
    numpages: number;
    text: string;
  }
  interface PdfParseOptions {
    pagerender?: (page: { pageNumber?: number; pageIndex?: number; getTextContent: (o?: unknown) => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => Promise<string> | string;
  }
  export default function pdfParse(donnees: Buffer, options?: PdfParseOptions): Promise<PdfParseResultat>;
}
