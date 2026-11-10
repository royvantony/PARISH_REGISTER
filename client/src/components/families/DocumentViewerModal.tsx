import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Badge } from '../ui/Badge';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import {
  FileText,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';

export interface FamilyDocumentItem {
  id: number;
  familyId: number;
  memberId?: number | null;
  documentType: string;
  fileName: string;
  localPath: string;
  originalUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadedAt: string;
  member?: {
    id: number;
    fullName: string;
    role: string;
  } | null;
}

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: FamilyDocumentItem | null;
  familyId: number;
  canDownload?: boolean;
  onActivityLogged?: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document,
  familyId,
  canDownload = true,
  onActivityLogged,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Image manipulation state
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Format file size
  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Human-readable document type labels
  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'PARISH_LETTER':
        return <Badge variant="default" size="sm">Parish Release Letter</Badge>;
      case 'BAPTISM_CERT':
        return <Badge variant="success" size="sm">Baptism Certificate</Badge>;
      case 'SIGNATURE':
        return <Badge variant="subtle" size="sm">Signature</Badge>;
      default:
        return <Badge variant="outline" size="sm">{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  useEffect(() => {
    if (!isOpen || !document) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setZoom(1);
      setRotation(0);
      setError(null);
      return;
    }

    let active = true;
    const loadDocumentBlob = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setZoom(1);
        setRotation(0);

        const response = await api.get(
          `/families/${familyId}/documents/${document.id}/view`,
          {
            responseType: 'blob',
            params: { _t: Date.now() },
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          }
        );

        if (active) {
          const url = URL.createObjectURL(response.data);
          setBlobUrl(url);
          onActivityLogged?.();
        }
      } catch (err: any) {
        if (active) {
          console.error('Failed to load document stream:', err);
          setError(
            err.response?.data?.error ||
            'Unable to load document. You may not have permission to view this attachment.'
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadDocumentBlob();

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, document?.id, familyId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      // Suppress Ctrl+S (Save) and Ctrl+P (Print) inside document viewer
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    // Use capture phase to intercept ESC before parent drawers or background listeners
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || !document) return null;

  const isPdf =
    document.mimeType === 'application/pdf' ||
    document.fileName.toLowerCase().endsWith('.pdf');
  const isImage =
    document.mimeType?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(document.fileName);

  const handleDownload = async () => {
    try {
      const response = await api.get(
        `/families/${familyId}/documents/${document.id}/download`,
        {
          responseType: 'blob',
          params: { _t: Date.now() },
        }
      );
      const url = URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.fileName || 'document');
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onActivityLogged?.();
    } catch (err: any) {
      console.error('Failed to download document:', err);
      alert('Failed to download document. Please check your permissions.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="relative w-full max-w-5xl h-[88vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-parish-border flex flex-col overflow-hidden"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-parish-border bg-parish-surface shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-parish-primary-light/50 border border-parish-border flex items-center justify-center text-parish-primary shrink-0">
              {isPdf ? (
                <FileText className="w-5 h-5 text-rose-600" />
              ) : (
                <FileSpreadsheet className="w-5 h-5 text-parish-primary" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-parish-text truncate max-w-md">
                  {document.fileName}
                </h3>
                {getDocTypeBadge(document.documentType)}
              </div>
              <p className="text-[11px] text-parish-text-muted mt-0.5 flex items-center gap-2">
                <span>{formatFileSize(document.fileSize)}</span>
                <span>•</span>
                <span>
                  Uploaded on {new Date(document.uploadedAt).toLocaleDateString()}
                </span>
                {document.member && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-parish-primary">
                      {document.member.fullName} ({document.member.role})
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Image & PDF zoom & rotate controls */}
            {(isImage || isPdf) && blobUrl && !isLoading && (
              <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-parish-border mr-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.25))}
                  className="p-1.5 rounded-lg hover:bg-parish-surface text-parish-text-muted hover:text-parish-text cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono font-semibold px-1 text-parish-text-muted">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
                  className="p-1.5 rounded-lg hover:bg-parish-surface text-parish-text-muted hover:text-parish-text cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg hover:bg-parish-surface text-parish-text-muted hover:text-parish-text border-l border-parish-border/60 ml-0.5 cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="p-1.5 rounded-lg hover:bg-parish-surface text-parish-text-muted hover:text-parish-text cursor-pointer"
                  title="Reset View"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Authenticated Download Button */}
            {canDownload && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-parish-primary text-white hover:bg-parish-primary/90 shadow-2xs transition-colors cursor-pointer"
                title="Download verified attachment file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-parish-text-muted hover:text-parish-text hover:bg-parish-surface-subtle border border-transparent hover:border-parish-border transition-all cursor-pointer"
              title="Close viewer"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div
          className="flex-1 bg-[#2b2c30] overflow-hidden flex items-center justify-center relative select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 text-white">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-xs font-medium text-slate-300">
                Securely decrypting & loading attachment...
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="max-w-md p-6 rounded-2xl bg-neutral-800 border border-neutral-700 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Unable to View Document</h4>
              <p className="text-xs text-slate-400">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {!isLoading && !error && blobUrl && (
            <>
              {isImage && (
                <div
                  className="w-full h-full flex flex-col items-center justify-center p-6 overflow-auto select-none"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div
                    className="relative flex items-center justify-center transition-transform duration-150 ease-out select-none my-auto"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    <img
                      src={blobUrl}
                      alt={document.fileName}
                      className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl pointer-events-none select-none ring-1 ring-black/20"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                    {/* Transparent protective shield overlay preventing right-click save and drag */}
                    <div
                      className="absolute inset-0 z-10 cursor-default select-none"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  </div>
                </div>
              )}

              {isPdf && (
                <PdfCanvasViewer
                  blobUrl={blobUrl}
                  zoom={zoom}
                  rotation={rotation}
                />
              )}

              {!isImage && !isPdf && (
                <div className="text-center space-y-3 text-white">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-300">
                    Preview is not supported for this file format.
                  </p>
                  {canDownload && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-parish-primary text-white hover:bg-parish-primary/90"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File to View</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
