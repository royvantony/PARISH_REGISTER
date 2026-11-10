import React, { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DocumentViewerModal, type FamilyDocumentItem } from './DocumentViewerModal';
import { AttachDocumentModal } from './AttachDocumentModal';
import { api } from '../../lib/api';
import {
  FileText,
  FileSpreadsheet,
  Plus,
  Trash2,
  Eye,
  User as UserIcon,
} from 'lucide-react';

interface FamilyDocumentsSectionProps {
  familyId: number;
  documents: FamilyDocumentItem[];
  readOnly?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canDownload?: boolean;
  members?: Array<{ id: number; fullName: string; role: string }>;
  onDocumentsUpdated?: () => void;
}

export const FamilyDocumentsSection: React.FC<FamilyDocumentsSectionProps> = ({
  familyId,
  documents = [],
  readOnly = false,
  canView = true,
  canEdit = false,
  canDelete = false,
  canDownload = true,
  members = [],
  onDocumentsUpdated,
}) => {
  const [selectedDocForView, setSelectedDocForView] = useState<FamilyDocumentItem | null>(null);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState<boolean>(false);
  const [deletingDoc, setDeletingDoc] = useState<FamilyDocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Format file size
  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'PARISH_LETTER':
        return <Badge variant="default" size="sm">Parish Release Letter</Badge>;
      case 'BAPTISM_CERT':
        return <Badge variant="success" size="sm">Baptism Certificate</Badge>;
      case 'SIGNATURE':
        return <Badge variant="subtle" size="sm">Signature</Badge>;
      case 'ID_PROOF':
        return <Badge variant="warning" size="sm">ID Document</Badge>;
      default:
        return <Badge variant="outline" size="sm">{type.replace('_', ' ')}</Badge>;
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    try {
      setIsDeleting(true);
      await api.delete(`/families/${familyId}/documents/${deletingDoc.id}`);
      setDeletingDoc(null);
      if (onDocumentsUpdated) onDocumentsUpdated();
    } catch (err: any) {
      console.error('Failed to remove document:', err);
      alert(err.response?.data?.error || 'Failed to remove document.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canView) return null;

  return (
    <div className="bg-parish-surface border border-parish-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-parish-primary-light/50 border border-parish-border flex items-center justify-center text-parish-primary">
            <FileText className="w-4 h-4 text-parish-primary" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-parish-text flex items-center gap-2">
              <span>Official Documents & Certificates</span>
              <span className="text-[11px] font-mono text-parish-text-muted font-medium">
                ({documents.length})
              </span>
            </h3>
            <p className="text-[11px] text-parish-text-muted">
              {readOnly
                ? 'Attached parish release letters, certificates, and ID documents (Click to view).'
                : 'Manage household attachments, parish letters, and baptism records.'}
            </p>
          </div>
        </div>

        {/* Attach Button (Edit page only) */}
        {!readOnly && canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAttachModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Attach Document
          </Button>
        )}
      </div>

      {/* Documents Grid / Empty State */}
      {documents.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-parish-surface-subtle border border-dashed border-parish-border text-xs text-parish-text-muted space-y-2">
          <p>No official documents or certificates attached to this household record.</p>
          {!readOnly && canEdit && (
            <button
              type="button"
              onClick={() => setIsAttachModalOpen(true)}
              className="text-xs font-bold text-parish-primary hover:underline cursor-pointer"
            >
              + Attach first document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const isPdf =
              doc.mimeType === 'application/pdf' ||
              doc.fileName.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocForView(doc)}
                className="group relative p-3 rounded-xl border border-parish-border hover:border-parish-primary/50 bg-white dark:bg-slate-800 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-start gap-3"
              >
                {/* File Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isPdf
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                  }`}
                >
                  {isPdf ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-bold text-parish-text truncate max-w-[180px] group-hover:text-parish-primary transition-colors" title={doc.fileName}>
                      {doc.fileName}
                    </p>
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {getDocTypeBadge(doc.documentType)}
                    {doc.fileSize ? (
                      <span className="text-[10px] text-parish-text-muted font-mono">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    ) : null}
                  </div>

                  {doc.member && (
                    <p className="text-[10px] text-parish-text-muted mt-1 flex items-center gap-1 truncate">
                      <UserIcon className="w-3 h-3 text-parish-primary shrink-0" />
                      <span>{doc.member.fullName} ({doc.member.role})</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setSelectedDocForView(doc)}
                    className="p-1.5 rounded-lg text-parish-text-muted hover:text-parish-primary hover:bg-parish-surface-subtle transition-colors cursor-pointer"
                    title="View Document"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {!readOnly && canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeletingDoc(doc)}
                      className="p-1.5 rounded-lg text-parish-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Remove Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Modal Lightbox */}
      <DocumentViewerModal
        isOpen={Boolean(selectedDocForView)}
        onClose={() => setSelectedDocForView(null)}
        document={selectedDocForView}
        familyId={familyId}
        canDownload={canDownload}
      />

      {/* Upload Modal (Edit mode only) */}
      {!readOnly && (
        <AttachDocumentModal
          isOpen={isAttachModalOpen}
          onClose={() => setIsAttachModalOpen(false)}
          familyId={familyId}
          members={members}
          onSuccess={() => {
            if (onDocumentsUpdated) onDocumentsUpdated();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingDoc && (
        <ConfirmDialog
          isOpen={Boolean(deletingDoc)}
          title="Remove Document Attachment"
          message={`Are you sure you want to remove "${deletingDoc.fileName}"? This action will permanently remove the file from parish storage and be logged in the record history.`}
          confirmLabel="Remove Document"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onClose={() => setDeletingDoc(null)}
        />
      )}
    </div>
  );
};
