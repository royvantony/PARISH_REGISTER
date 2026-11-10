import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Tag,
  User,
  CheckCircle2,
  X,
} from 'lucide-react';

interface FamilyMemberOption {
  id: number;
  fullName: string;
  role: string;
}

interface AttachDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: number;
  members: FamilyMemberOption[];
  onSuccess: (newDoc: any) => void;
}

const SUGGESTED_DOCUMENT_TYPES = [
  'Parish Release Letter',
  'Baptism Certificate',
  'Marriage Certificate',
  'Consent / Signature Record',
];

export const AttachDocumentModal: React.FC<AttachDocumentModalProps> = ({
  isOpen,
  onClose,
  familyId,
  members,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [memberId, setMemberId] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds the 10 MB limit.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds the 10 MB limit.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a document file to attach.');
      return;
    }

    const cleanDocType = documentType.trim();
    if (!cleanDocType) {
      setError('Please enter what type of document this is.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', cleanDocType);
      if (memberId) {
        formData.append('memberId', memberId);
      }

      const res = await api.post(`/families/${familyId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onSuccess(res.data.document);
      handleClose();
    } catch (err: any) {
      console.error('Failed to attach document:', err);
      setError(err.response?.data?.error || 'Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setDocumentType('');
    setMemberId('');
    setError(null);
    setIsUploading(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Attach Official Document"
      maxWidth="md"
      closeOnEsc={!isUploading}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* File Dropzone */}
        <div>
          <label className="block text-xs font-semibold text-parish-text mb-1.5">
            Document File <span className="text-red-500">*</span>
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${selectedFile
                ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                : 'border-parish-border hover:border-parish-primary/50 bg-parish-surface-subtle'
              }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-between w-full px-2">
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-parish-text truncate max-w-[240px]">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-parish-text-muted">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-parish-primary-light/50 text-parish-primary flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-parish-text">
                    Click to browse or drag & drop file here
                  </p>
                  <p className="text-[11px] text-parish-text-muted mt-0.5">
                    Supports PDF, PNG, JPEG, WEBP (Max 10 MB)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Document Type Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-parish-primary" />
            <span>Document Type</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            list="suggested-document-types"
            value={documentType}
            onChange={(e) => {
              setDocumentType(e.target.value);
              if (error) setError(null);
            }}
            maxLength={100}
            placeholder="e.g. Baptism Certificate, Marriage Certificate, Parish Release Letter..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text placeholder:text-parish-text-muted/60 focus:outline-none focus:ring-2 focus:ring-parish-primary font-medium"
            required
          />
          <datalist id="suggested-document-types">
            {SUGGESTED_DOCUMENT_TYPES.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </div>

        {/* Member Linkage (Optional) */}
        {members.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-parish-text flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-parish-primary" />
              <span>Link to Specific Member</span>
              <span className="text-[10px] text-parish-text-muted font-normal">(Optional)</span>
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer font-medium"
            >
              <option value="">Household Level Document (Whole Family)</option>
              {members.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.fullName} ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-parish-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isUploading}
            disabled={!selectedFile || isUploading}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Upload & Attach
          </Button>
        </div>
      </form>
    </Modal>
  );
};

