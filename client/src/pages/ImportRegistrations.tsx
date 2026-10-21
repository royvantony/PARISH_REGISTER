import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import { ConfirmDeleteButton } from '../components/ui/ConfirmDeleteButton';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Home,
  RefreshCw,
  Eye,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  VerifyRegistrationModal,
  type PreviewRecord,
} from '../components/families/VerifyRegistrationModal';

export const ImportRegistrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reference Data & Permissions
  const [units, setUnits] = useState<Array<{ id: number; unitName: string }>>([]);
  const [canApprove, setCanApprove] = useState<boolean>(false);
  const [canCreate, setCanCreate] = useState<boolean>(true);

  // Upload & File State
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Preview List State
  const [records, setRecords] = useState<PreviewRecord[]>([]);
  const [summary, setSummary] = useState<{
    totalRows: number;
    readyCount: number;
    warningCount: number;
    errorCount: number;
  }>({ totalRows: 0, readyCount: 0, warningCount: 0, errorCount: 0 });

  // Processed Tracking (records saved as pending or approved)
  const [processedMap, setProcessedMap] = useState<
    Record<
      string,
      {
        mode: 'PENDING' | 'ACTIVE';
        id: number;
        familyCode?: string | null;
        houseName: string;
      }
    >
  >({});

  // Active modal record
  const [selectedRecord, setSelectedRecord] = useState<PreviewRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Load Permissions and Units
  useEffect(() => {
    const initPage = async () => {
      try {
        const [unitsRes, permsRes] = await Promise.all([
          api.get<Array<{ id: number; unitName: string }>>('/masters/units').catch(() => ({ data: [] })),
          api.get<{ canView: boolean; canCreate: boolean; canApprove: boolean }>('/permissions/import').catch(() => ({
            data: { canView: true, canCreate: true, canApprove: false },
          })),
        ]);

        setUnits(unitsRes.data);
        setCanApprove(permsRes.data.canApprove);
        setCanCreate(permsRes.data.canCreate);
      } catch (err: any) {
        console.error('Failed to initialize import page:', err);
      }
    };

    initPage();
  }, []);

  // Download Template Handler
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'parish_registration_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download template:', err);
      setParseError('Failed to download CSV template. Please try again.');
    }
  };

  // Robust Client-side CSV Parser (handles quoted strings, commas, newlines)
  const parseCSVText = (text: string): Array<Record<string, string>> => {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    // Clean BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        lines.push(currentRow);
      }
    }

    if (lines.length < 2) return [];

    const headers = lines[0];
    const dataRows: Array<Record<string, string>> = [];

    for (let r = 1; r < lines.length; r++) {
      const row = lines[r];
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] || '';
      });
      dataRows.push(obj);
    }

    return dataRows;
  };

  // Handle File Selection
  const handleFileChange = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please select a valid .csv file.');
      return;
    }

    setParseError(null);
    setIsParsing(true);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const parsedRows = parseCSVText(text);

        if (parsedRows.length === 0) {
          setParseError('No data rows found in CSV. Please verify file content.');
          setIsParsing(false);
          return;
        }

        // Call backend preview endpoint for validation, duplicate check, and ward resolution
        const previewRes = await api.post('/import/preview', { rows: parsedRows });
        setRecords(previewRes.data.records);
        setSummary(previewRes.data.summary);
        setProcessedMap({});
        setIsParsing(false);
      };

      reader.onerror = () => {
        setParseError('Failed to read file from disk.');
        setIsParsing(false);
      };

      reader.readAsText(file);
    } catch (err: any) {
      console.error('Error parsing CSV file:', err);
      setParseError(err.response?.data?.error || 'Failed to process CSV file.');
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Dismiss a row from the staging queue
  const handleDismissRow = (tempId: string) => {
    setRecords((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  // Open Verify Modal for a specific row
  const handleOpenVerify = (record: PreviewRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  // Handle Save Success callback from VerifyRegistrationModal
  const handleSaveSuccess = (result: {
    tempId: string;
    mode: 'PENDING' | 'ACTIVE';
    id: number;
    familyCode?: string | null;
    houseName: string;
  }) => {
    setProcessedMap((prev) => ({
      ...prev,
      [result.tempId]: result,
    }));
  };

  // Clear / Reset
  const handleReset = () => {
    setFileName(null);
    setFileSize(null);
    setRecords([]);
    setProcessedMap({});
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processedCount = Object.keys(processedMap).length;

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-parish-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-parish-text-muted mb-1">
            <span>Parish Register</span>
            <span>/</span>
            <span className="text-parish-primary">Import Online Registrations</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-parish-text tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-parish-primary-light text-parish-primary flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            Import Online Registrations (CSV)
          </h1>
          <p className="text-xs text-parish-text-muted mt-1 max-w-2xl">
            Upload registrations exported from the website. Review and verify each household individually before saving as pending or activating with allocated family codes.
          </p>
        </div>

        {/* Header Action: Download Template */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 text-xs border-parish-border hover:bg-parish-surface-subtle"
          >
            <Download className="w-4 h-4 text-parish-primary" />
            <span>Download CSV Template</span>
          </Button>

          {records.length > 0 && (
            <ConfirmButton
              type="button"
              variant="ghost"
              confirmVariant="danger"
              onConfirm={handleReset}
              confirmLabel="Clear all?"
              className="flex items-center gap-1.5 text-xs text-parish-text-muted hover:text-red-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear & Upload New</span>
            </ConfirmButton>
          )}
        </div>
      </div>

      {/* Permissions notice */}
      {!canCreate && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
          <span>You do not have permission to stage registrations. Please contact your Parish Priest or Trustee.</span>
        </div>
      )}

      {/* 1. Upload Dropzone Area (Shown when no file loaded) */}
      {records.length === 0 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-parish-border hover:border-parish-primary/60 rounded-3xl p-8 sm:p-12 text-center transition-all bg-parish-surface hover:bg-parish-primary-light/10 flex flex-col items-center justify-center gap-4 cursor-pointer shadow-xs group"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          />

          <div className="w-16 h-16 rounded-2xl bg-parish-primary-light text-parish-primary flex items-center justify-center group-hover:scale-105 transition-transform shadow-soft">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-parish-text">
              {isParsing ? 'Processing CSV File...' : 'Drop your CSV registration file here'}
            </h3>
            <p className="text-xs text-parish-text-muted mt-1 max-w-md">
              Drag and drop your exported website registrations file, or click to browse. Supports both standard template format and direct web form exports.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <span className="px-3 py-1 rounded-lg bg-parish-surface-subtle border border-parish-border text-[11px] font-semibold text-parish-text-muted">
              CSV UTF-8 (.csv)
            </span>
            <span className="px-3 py-1 rounded-lg bg-parish-surface-subtle border border-parish-border text-[11px] font-semibold text-parish-text-muted">
              Single Row per Family
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {parseError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* 2. Processed Summary / KPI Bar (When records are loaded) */}
      {records.length > 0 && (
        <div className="space-y-4">
          {/* Active File Bar */}
          <div className="p-4 rounded-2xl bg-parish-surface border border-parish-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-parish-primary-light text-parish-primary flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-parish-text flex items-center gap-2">
                  <span>{fileName}</span>
                  {fileSize && (
                    <Badge variant="subtle" size="sm">
                      {fileSize}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-parish-text-muted">
                  Loaded {records.length} household records for individual verification
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/register')}
                className="text-xs border-parish-border flex items-center gap-1.5"
              >
                <span>View Directory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-parish-border shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-parish-text-muted">Total Rows</div>
              <div className="text-xl font-black text-parish-text mt-0.5">{records.length}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-parish-border shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Ready for Review</div>
              <div className="text-xl font-black text-emerald-600 mt-0.5">{summary.readyCount}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-parish-border shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Needs Attention</div>
              <div className="text-xl font-black text-amber-600 mt-0.5">{summary.warningCount}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-parish-border shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Incomplete / Errors</div>
              <div className="text-xl font-black text-red-600 mt-0.5">{summary.errorCount}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-parish-border shadow-xs col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-parish-primary">Saved / Processed</div>
              <div className="text-xl font-black text-parish-primary mt-0.5">
                {processedCount} / {records.length}
              </div>
            </div>
          </div>

          {/* 3. The List Format (Row-by-Row Table) */}
          <div className="bg-parish-surface border border-parish-border rounded-2xl overflow-hidden shadow-soft">
            <div className="px-5 py-4 border-b border-parish-border bg-parish-surface-subtle/50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-parish-text">
                  Staged Registrations ({records.length})
                </h3>
                <p className="text-[11px] text-parish-text-muted mt-0.5">
                  Click <strong className="text-parish-primary font-semibold">Review & Verify</strong> on each row to inspect and save or activate.
                </p>
              </div>

              <div className="text-[11px] text-parish-text-muted font-medium italic">
                * Bulk approval is disabled to ensure canonical data accuracy
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-parish-border bg-parish-surface-subtle text-[11px] font-bold uppercase tracking-wider text-parish-text-muted">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Head of Family</th>
                    <th className="py-3 px-4">Household & Ward</th>
                    <th className="py-3 px-4">Composition</th>
                    <th className="py-3 px-4">Notes & Flags</th>
                    <th className="py-3 px-4 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parish-border text-xs text-parish-text">
                  {records.map((rec) => {
                    const processed = processedMap[rec.tempId];
                    const isProcessed = Boolean(processed);

                    return (
                      <tr
                        key={rec.tempId}
                        className={`transition-colors ${
                          isProcessed
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                            : rec.status === 'ERROR'
                            ? 'bg-red-50/30 hover:bg-red-50/50'
                            : rec.status === 'WARNING'
                            ? 'bg-amber-50/20 hover:bg-amber-50/40'
                            : 'hover:bg-parish-surface-subtle/60'
                        }`}
                      >
                        {/* Row Index */}
                        <td className="py-3.5 px-4 text-center font-mono text-[11px] text-parish-text-muted font-semibold">
                          {rec.rowIndex}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isProcessed ? (
                            processed.mode === 'ACTIVE' ? (
                              <Badge variant="subtle" size="sm" className="bg-emerald-100 text-emerald-800 font-bold border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Active ({processed.familyCode})</span>
                              </Badge>
                            ) : (
                              <Badge variant="subtle" size="sm" className="bg-amber-100 text-amber-800 font-bold border-amber-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Saved Pending</span>
                              </Badge>
                            )
                          ) : rec.status === 'ERROR' ? (
                            <Badge variant="danger" size="sm">
                              Missing Data
                            </Badge>
                          ) : rec.status === 'WARNING' ? (
                            <Badge variant="warning" size="sm">
                              Needs Review
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              Ready
                            </Badge>
                          )}
                        </td>

                        {/* Head of Family */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-parish-text flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-parish-text-muted shrink-0" />
                            <span>{rec.data.headName || 'Missing Name'}</span>
                          </div>
                          <div className="text-[11px] text-parish-text-muted font-mono mt-0.5">
                            {rec.data.headPhone || rec.data.headEmail || 'No contact'}
                          </div>
                        </td>

                        {/* Household & Ward */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-parish-text flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-parish-primary shrink-0" />
                            <span>{rec.data.houseName || 'Not Specified'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-parish-text-muted font-mono">
                              {rec.data.unitName === 'Unassigned' ? (
                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  Unassigned Ward
                                </span>
                              ) : (
                                <span className="text-parish-primary bg-parish-primary-light/50 px-1.5 py-0.2 rounded">
                                  {rec.data.unitName}
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-parish-text-muted uppercase">
                              • {rec.data.registrationType}
                            </span>
                          </div>
                        </td>

                        {/* Composition */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-xs text-parish-text font-medium">
                            {rec.data.registrationType === 'FAMILY' ? (
                              <span>
                                Head
                                {rec.data.hasSpouse || rec.data.spouseName ? ' + Spouse' : ''}
                                {rec.data.children.length > 0 ? ` + ${rec.data.children.length} Child(ren)` : ''}
                              </span>
                            ) : (
                              <span>Single Member</span>
                            )}
                          </div>
                          <div className="text-[11px] text-parish-text-muted">
                            {rec.data.city ? `${rec.data.city}, ${rec.data.state}` : 'Brisbane, QLD'}
                          </div>
                        </td>

                        {/* Notes / Warnings */}
                        <td className="py-3.5 px-4">
                          {rec.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Possible Duplicate</span>
                            </span>
                          ) : rec.errors.length > 0 ? (
                            <span className="text-[11px] text-red-600 font-medium">
                              {rec.errors[0]}
                            </span>
                          ) : rec.warnings.length > 0 ? (
                            <span className="text-[11px] text-amber-600 font-medium truncate max-w-[200px] block">
                              {rec.warnings[0]}
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-medium">
                              Clean registration
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isProcessed ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Saved</span>
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/register/${processed.id}/edit`)}
                                className="text-[11px] h-7 px-2"
                              >
                                View
                              </Button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleOpenVerify(rec)}
                                className="h-8 text-xs font-bold flex items-center gap-1.5 bg-parish-primary hover:bg-parish-primary-hover text-white shadow-xs cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Review & Verify</span>
                              </Button>

                              <ConfirmDeleteButton
                                onDelete={() => handleDismissRow(rec.tempId)}
                                hasContent={true}
                                confirmLabel="Dismiss?"
                                title="Dismiss row from queue"
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Individual Review & Verify Modal */}
      {selectedRecord && (
        <VerifyRegistrationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRecord(null);
          }}
          record={selectedRecord}
          units={units}
          canApprove={canApprove}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
};
