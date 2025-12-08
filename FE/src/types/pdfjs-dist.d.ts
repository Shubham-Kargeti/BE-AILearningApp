declare module "pdfjs-dist" {
  export interface TextItem {
    str: string;
    dir: string;
    transform: number[];
    width: number;
    height: number;
    fontName: string;
    hasEOL: boolean;
  }

  export interface TextContent {
    items: TextItem[];
    styles: Record<string, any>;
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
    getViewport(params: { scale: number }): any;
    render(params: any): { promise: Promise<void> };
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export interface GetDocumentParams {
    data?: ArrayBuffer;
    url?: string;
  }

  export function getDocument(params: GetDocumentParams): PDFDocumentLoadingTask;

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export const version: string;
}
