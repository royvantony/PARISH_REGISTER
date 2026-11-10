import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';

// Configure Vite-compatible PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfCanvasViewerProps {
  blobUrl: string;
  zoom?: number;
  rotation?: number;
}

interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  rotation: number;
}

const PdfPage: React.FC<PdfPageProps> = ({
  pdfDoc,
  pageNumber,
  zoom,
  rotation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: any = null;

    pdfDoc.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Base scale calculated to fit container nicely (standard ~1.3 base scale)
      const baseScale = 1.35 * zoom;
      const viewport = page.getViewport({ scale: baseScale, rotation });

      // Support high DPI screens
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext = {
        canvas,
        canvasContext: context,
        transform: transform as any,
        viewport,
      };

      renderTask = page.render(renderContext);
      renderTask.promise.catch((err: any) => {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNumber} render error:`, err);
        }
      });
    });

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, zoom, rotation]);

  return (
    <div
      className="relative flex flex-col items-center select-none"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <canvas
        ref={canvasRef}
        className="bg-white rounded-lg shadow-2xl ring-1 ring-black/20 select-none pointer-events-none"
      />
      {/* Transparent protective shield over the canvas */}
      <div
        className="absolute inset-0 z-10 cursor-default select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  blobUrl,
  zoom = 1,
  rotation = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setRenderError(null);

    const loadTask = pdfjsLib.getDocument({ url: blobUrl });

    loadTask.promise
      .then((doc) => {
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load PDF via PDF.js:', err);
          setRenderError(err.message || 'Failed to render PDF document.');
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      try {
        loadTask.destroy();
      } catch {
        // ignore
      }
    };
  }, [blobUrl]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center select-none overflow-y-auto px-4 pt-10 pb-16"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {isLoading && (
        <div className="flex flex-col items-center justify-center my-auto py-16 gap-3 text-neutral-300">
          <Loader2 className="w-8 h-8 animate-spin text-parish-primary" />
          <p className="text-xs font-semibold">Decrypting & rendering document pages...</p>
        </div>
      )}

      {renderError && !isLoading && (
        <div className="max-w-md my-auto p-6 rounded-2xl bg-neutral-800 border border-neutral-700 text-center space-y-2 text-neutral-200">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm font-bold">Unable to render PDF preview</p>
          <p className="text-xs text-neutral-400">{renderError}</p>
        </div>
      )}

      {!isLoading && !renderError && pdfDoc && (
        <div className="flex flex-col items-center gap-8 w-full">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <PdfPage
              key={pageNum}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              zoom={zoom}
              rotation={rotation}
            />
          ))}
        </div>
      )}
    </div>
  );
};
