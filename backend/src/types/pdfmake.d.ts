declare module "pdfmake" {
  interface PdfMakeInstance {
    setFonts(
      fonts: Record<
        string,
        { normal: string; bold?: string; italics?: string; bolditalics?: string }
      >
    ): void;
    setLocalAccessPolicy(callback?: (filePath: string) => boolean): void;
    setUrlAccessPolicy(callback?: (url: string) => boolean): void;
    createPdf(docDefinition: Record<string, unknown>): { write(fileName: string): Promise<void> };
  }
  const pdfMake: PdfMakeInstance;
  export default pdfMake;
}
