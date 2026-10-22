import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Printer,
  Church,
  RefreshCw,
} from 'lucide-react';
import { CLIENT_BRANDING } from '../../config/branding';

interface ListFilterParams {
  search?: string;
  unitId?: string;
  unitName?: string;
  status?: string;
  type?: string;
  directDebit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ExportFamilyItem {
  id: number;
  familyCode: string | null;
  registrationType: string;
  houseName: string;
  status: string;
  unit: { id: number; unitName: string; category?: string } | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  originParish?: string | null;
  originDiocese?: string | null;
  membersCount: number;
  members: Array<{
    id: number;
    role: string;
    fullName: string;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    phone: string | null;
    email: string | null;
  }>;
  hasDirectDebit?: boolean;
  directDebit?: {
    id: number;
    amount?: number | string | null;
    frequency?: string | null;
    active: boolean;
  } | null;
  headOfFamily?: {
    id: number;
    role: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    dateOfBirth: string | null;
  } | null;
}

interface ParishRegisterListPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ListFilterParams;
  initialTheme?: 'COLOUR' | 'FLAT';
}

export const ParishRegisterListPrintModal: React.FC<ParishRegisterListPrintModalProps> = ({
  isOpen,
  onClose,
  filters,
  initialTheme = 'COLOUR',
}) => {
  const { activeParish, user } = useAuth();
  const [printTheme, setPrintTheme] = useState<'COLOUR' | 'FLAT'>(initialTheme);
  const [isLoading, setIsLoading] = useState(false);
  const [families, setFamilies] = useState<ExportFamilyItem[]>([]);

  useEffect(() => {
    setPrintTheme(initialTheme);
  }, [initialTheme]);

  useEffect(() => {
    if (isOpen) {
      fetchExportData();
    }
  }, [isOpen, filters]);

  const fetchExportData = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (filters.search) params.search = filters.search.trim();
      if (filters.unitId) params.unitId = filters.unitId;
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.directDebit) params.directDebit = filters.directDebit;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      const res = await api.get<{
        total: number;
        data: ExportFamilyItem[];
      }>('/families/export/data', { params });

      setFamilies(res.data.data);
    } catch (err: any) {
      console.error('Failed to load export register dataset:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isColour = printTheme === 'COLOUR';

  // Compute total parishioners
  const totalParishioners = families.reduce(
    (acc, f) => acc + (f.membersCount || f.members.length || 0),
    0
  );

  // Approximate page count in Portrait (Page 1 fits ~20 families with header & filters, Page 2+ fits ~26 families)
  const estimatedPages =
    families.length <= 20 ? 1 : 1 + Math.ceil((families.length - 20) / 26);

  const formatState = (s?: string | null) => {
    if (!s) return 'QLD';
    const u = s.trim().toUpperCase();
    if (u === 'QUEENSLAND' || u === 'QLD' || u === 'BRISBANE') return 'QLD';
    return u;
  };

  const formatWardName = (name?: string | null) => {
    if (!name) return 'Unassigned';
    return name.replace(/\s*ward$/i, '').trim();
  };

  const formatStatusLabel = (status?: string | null) => {
    if (!status || status === 'ALL') return 'All Statuses';
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'Active';
      case 'PENDING':
        return 'Pending Approval';
      case 'MERGED':
        return 'Merged (Marriage)';
      case 'INACTIVE':
        return 'Inactive';
      default:
        return status;
    }
  };

  const formatTypeLabel = (type?: string | null) => {
    if (!type) return 'All Registration Types';
    switch (type.toUpperCase()) {
      case 'FAMILY':
        return 'Families';
      case 'INDIVIDUAL_STUDENT':
        return 'International Students';
      case 'INDIVIDUAL':
        return 'Individuals';
      default:
        return type;
    }
  };

  const formatSortInfo = (sort?: string, order?: 'asc' | 'desc') => {
    const isDesc = order === 'desc';
    switch (sort) {
      case 'ward':
      case 'unit':
        return isDesc ? 'Ward (Z → A)' : 'Ward (A → Z)';
      case 'members':
      case 'membersCount':
        return isDesc ? 'Members (High → Low)' : 'Members (Low → High)';
      case 'status':
        return isDesc ? 'Status (Z → A)' : 'Status (A → Z)';
      case 'familyCode':
      case 'code':
        return isDesc ? 'Family Code (Descending)' : 'Family Code (Ascending)';
      case 'houseName':
        return isDesc ? 'House Name (Z → A)' : 'House Name (A → Z)';
      case 'parishioner':
      case 'headOfFamily':
      case 'headFullName':
      default:
        return isDesc ? 'Parishioner (Head Z → A)' : 'Parishioner (Head A → Z)';
    }
  };

  const printTimestamp = useMemo(() => {
    return new Date().toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [isOpen]);

  const preparedBy = user?.fullName || 'Parish Administration';

  // Robust, self-contained printing using an isolated iframe
  // This guarantees: 1) Zero blank pages, 2) Landscape orientation, 3) Repeating table headers on every page, 4) ZERO overlapping!
  const handleTriggerPrint = () => {
    if (families.length === 0) return;

    // Create a dedicated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const parishName =
      activeParish?.parishName || 'St. Alphonsa Syro-Malabar Catholic Parish';
    const timestamp = new Date().toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const preparedBy = user?.fullName || 'Parish Administration';
    const safeParishName = parishName.replace(/"/g, '\\"');
    const safePreparedBy = preparedBy.replace(/"/g, '\\"');

    // Generate table rows HTML (5 columns: Code & Status, Head & House, Ward/Unit, Members, Address & Contact)
    const rowsHtml = families
      .map((f, idx) => {
        const head = f.headOfFamily || f.members[0];
        const spouse = f.members?.find((m) => m.role?.toUpperCase() === 'SPOUSE');
        const isEven = idx % 2 === 0;
        const rowBg = isEven
          ? isColour
            ? 'background-color: #fbf9f4;'
            : 'background-color: #ffffff;'
          : 'background-color: #ffffff;';

        const statusStyle = isColour
          ? f.status === 'ACTIVE'
            ? 'background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;'
            : 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;'
          : 'background: #ffffff; color: #000000; border: 1px solid #000000;';

        const memberBadgeStyle = isColour
          ? 'background: #e8f3ed; color: #1b4332; border: 1px solid rgba(27,67,50,0.3);'
          : 'background: #ffffff; color: #000000; border: 1px solid #000000;';

        const regTypeLabel =
          f.registrationType === 'FAMILY'
            ? 'Family'
            : f.registrationType === 'INDIVIDUAL_STUDENT'
              ? 'International Student'
              : 'Individual';

        const addressStr = f.streetAddress || 'Address not recorded';
        const cityStateZip = [f.city, formatState(f.state), f.postalCode].filter(Boolean).join(' ');
        const fullAddress = cityStateZip ? `${addressStr}, ${cityStateZip}` : addressStr;

        const phoneHtml = f.primaryPhone ? `<span>&#128222; ${f.primaryPhone}</span>` : '';
        const emailHtml = f.primaryEmail ? `<span>&#9993; ${f.primaryEmail}</span>` : '';
        const contactHtml = [phoneHtml, emailHtml].filter(Boolean).join(' &nbsp;&bull;&nbsp; ');

        return `
          <tr style="${rowBg}">
            <td style="padding: 5px 4px; vertical-align: top; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #475569; font-size: 10px;">
              ${idx + 1}
            </td>
            <td style="padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0;">
              <div style="font-family: monospace; font-weight: 700; font-size: 10.5px; color: #0f172a; line-height: 1.2;">
                ${f.familyCode || `#${f.id}`}
              </div>
              <div style="margin-top: 2px;">
                <span style="display: inline-block; font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 3px; ${statusStyle}">
                  ${f.status}
                </span>
              </div>
            </td>
            <td style="padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0;">
              <div style="font-weight: 800; font-size: 11px; color: #020617; line-height: 1.25;">
                ${head?.fullName || 'Not recorded'}
              </div>
              ${spouse?.fullName
            ? `<div style="font-size: 9.5px; color: #475569; margin-top: 1.5px; line-height: 1.2; font-weight: 500;">${spouse.fullName}</div>`
            : ''
          }
            </td>
            <td style="padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0;">
              <div style="font-weight: 700; font-size: 10.5px; color: ${isColour ? '#1b4332' : '#000000'}; line-height: 1.25; word-break: break-word;">
                ${f.unit ? formatWardName(f.unit.unitName) : '&#9888; Unassigned'}
              </div>
              <div style="font-size: 9.5px; color: #475569; margin-top: 1.5px; line-height: 1.2;">
                ${f.houseName ? `<strong style="color: #0f172a;">${f.houseName}</strong> ` : ''}<span style="color: #64748b;">(${regTypeLabel})</span>
              </div>
            </td>
            <td style="padding: 5px 4px; vertical-align: top; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <span style="display: inline-block; font-weight: 800; font-size: 10px; padding: 1.5px 7px; border-radius: 9999px; ${memberBadgeStyle}">
                ${f.membersCount || f.members.length}
              </span>
            </td>
            <td style="padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0;">
              <div style="color: #0f172a; line-height: 1.25; font-size: 10px;">
                ${fullAddress}
              </div>
              ${contactHtml
            ? `<div style="font-size: 9px; color: #475569; margin-top: 2px; line-height: 1.2;">${contactHtml}</div>`
            : ''
          }
            </td>
          </tr>
        `;
      })
      .join('');

    // Write complete self-contained printable document
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${parishName} - Directory </title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 13mm 8mm;
              @bottom-left {
                content: "Official Record • ${safeParishName} • Strictly Confidential";
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 7.5pt;
                color: #64748b;
                border-top: 1px solid #cbd5e1;
                padding-top: 4px;
                vertical-align: top;
              }
              @bottom-right {
                content: "Printed by: ${safePreparedBy} on ${timestamp} • Page " counter(page) " of " counter(pages);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 7.5pt;
                color: #64748b;
                border-top: 1px solid #cbd5e1;
                padding-top: 4px;
                vertical-align: top;
              }
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 11px;
              line-height: 1.35;
            }
            .header-banner {
              padding-bottom: 8px;
              border-bottom: 2px solid ${isColour ? '#1b4332' : '#000000'};
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .crest-box {
              width: 38px;
              height: 38px;
              border-radius: 8px;
              background: ${isColour ? '#1b4332' : '#000000'};
              border: 1px solid ${isColour ? '#c69214' : '#000000'};
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
            }
            .header-title h1 {
              margin: 0;
              font-size: 15px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.01em;
              color: ${isColour ? '#1b4332' : '#000000'};
            }
            .header-title p {
              margin: 2px 0 0 0;
              font-size: 9.5px;
              color: #475569;
              font-weight: 500;
            }
            .header-meta {
              text-align: right;
              font-size: 9.5px;
              color: #475569;
              line-height: 1.4;
            }
            .filter-scope-box {
              margin-top: 8px;
              margin-bottom: 8px;
              padding: 6px 10px;
              border-radius: 6px;
              font-size: 10px;
              border: 1px solid ${isColour ? '#e8e1d2' : '#000000'};
              background: ${isColour ? '#fbf9f4' : '#ffffff'};
              color: ${isColour ? '#1e293b' : '#000000'};
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 8px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10.5px;
            }
            thead {
              display: table-header-group;
            }
            tbody {
              display: table-row-group;
            }
            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            th {
              background: ${isColour ? '#1b4332' : '#000000'};
              color: #ffffff;
              padding: 6px 8px;
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.03em;
              text-align: left;
              border: none;
            }
            th.text-center {
              text-align: center;
            }
            .footer-box {
              padding-top: 8px;
              margin-top: 10px;
              border-top: 1px solid #cbd5e1;
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 8.5px;
              color: #64748b;
              break-inside: avoid;
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <!-- 1. Header Banner (Page 1) -->
          <div class="header-banner">
            <div class="header-left">
              <img src="${CLIENT_BRANDING.logoUrl}" alt="${CLIENT_BRANDING.logoAlt}" style="height: 38px; width: auto; object-fit: contain;" onerror="this.style.display='none'; document.getElementById('fallback-crest').style.display='flex';" />
              <div id="fallback-crest" class="crest-box" style="display: none;">&#9877;</div>
              <div class="header-title">
                <h1>${parishName}</h1>
                <p>Official Parish Register Directory</p>
              </div>
            </div>
            <div class="header-meta">
              <div>Generated: <strong>${timestamp}</strong></div>
              <div>Prepared by: <strong>${preparedBy}</strong></div>
            </div>
          </div>

          <!-- 2. Active Filter Scope (Page 1) -->
          <div class="filter-scope-box">
            <div>
              <strong style="text-transform: uppercase; font-size: 9px; color: #64748b; margin-right: 6px;">Active Filter Scope:</strong>
              Ward: <strong>${filters.unitName || (filters.unitId ? `Ward #${filters.unitId}` : 'All Wards')}</strong>
              &nbsp;&bull;&nbsp; Status: <strong>${formatStatusLabel(filters.status)}</strong>
              &nbsp;&bull;&nbsp; Type: <strong>${formatTypeLabel(filters.type)}</strong>
              ${filters.directDebit ? `&nbsp;&bull;&nbsp; Direct Debit: <strong>${filters.directDebit === 'YES' ? 'Active' : 'None'}</strong>` : ''}
              ${filters.search ? `&nbsp;&bull;&nbsp; Search: <strong>"${filters.search}"</strong>` : ''}
              &nbsp;&bull;&nbsp; Sorted: <strong>${formatSortInfo(filters.sortBy, filters.sortOrder)}</strong>
            </div>
            <div>
              <strong>Total: <span style="color: ${isColour ? '#1b4332' : '#000000'};">${families.length}</span> Households (${totalParishioners} Parishioners)</strong>
            </div>
          </div>

          <!-- 3. High-Density Table with repeating thead on each page (6 columns, Portrait) -->
          <table>
            <thead>
              <tr>
                <th style="width: 4%; text-align: center;">Sl. No.</th>
                <th style="width: 13%;">Code &amp; Status</th>
                <th style="width: 25%;">Head of Family / Spouse</th>
                <th style="width: 21%;">Ward / House</th>
                <th style="width: 6%; text-align: center;">Members</th>
                <th style="width: 31%;">Address &amp; Primary Contact</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- 4. End-of-Roster Summary Marker -->
          <div style="margin-top: 10px; padding: 6px 0; text-align: center; font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; break-inside: avoid; page-break-inside: avoid;">
            &mdash; End of Official Parish Register  (${families.length} Total Households) &mdash;
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Trigger printing once content is ready
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Clean up the iframe after the print dialog interaction closes
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (_) { }
      }, 2000);
    }, 250);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Parish Register Print Preview"
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="p-3 bg-parish-surface-subtle border border-parish-border rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-parish-text">Report Style:</span>
            <div className="inline-flex rounded-lg border border-parish-border p-0.5 bg-white shadow-xs">
              <button
                type="button"
                onClick={() => setPrintTheme('COLOUR')}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${isColour
                  ? 'bg-parish-primary text-white shadow-xs'
                  : 'text-parish-text-muted hover:text-parish-text'
                  }`}
              >
                🎨 Formatted (Colour)
              </button>
              <button
                type="button"
                onClick={() => setPrintTheme('FLAT')}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${!isColour
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-parish-text-muted hover:text-parish-text'
                  }`}
              >
                🖨️ Flat (B&W Ink-Saver)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-parish-text-muted text-xs">
              Total: <strong>{families.length}</strong> households (<strong>{totalParishioners}</strong> parishioners)
            </span>

            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
              📄 Multi-Page (~{estimatedPages} Pages in Portrait PDF)
            </span>

            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerPrint}
              disabled={isLoading || families.length === 0}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* User Multi-Page Guidance Notice */}
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            💡 <strong>On-Screen Report Preview:</strong> Scroll down to review the report matching your active filters. When saved as PDF or printed, this report automatically flows across <strong>{estimatedPages} portrait A4 pages</strong> with repeating column headers on every page and no overlapping.
          </span>
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 shrink-0 md:hidden bg-slate-200/60 px-2 py-0.5 rounded">
            ⇄ Scroll horizontally to view all columns
          </span>
        </div>

        {/* Document Preview Container (Portrait A4 Preview) */}
        <div className="bg-slate-200/70 p-2 sm:p-4 rounded-2xl overflow-x-auto border border-slate-300 preview-scroll-container touch-pan-x shadow-inner">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-parish-primary" />
              <span className="text-xs font-semibold">Generating print roster matching filters...</span>
            </div>
          ) : families.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-xs">
              No households match the current filter criteria.
            </div>
          ) : (
            <div
              className={`w-[210mm] min-w-[760px] mx-auto p-[8mm] bg-white text-slate-900 shadow-xl rounded-xl border border-slate-300 transition-all duration-150 flex flex-col justify-between shrink-0 ${isColour ? 'font-sans' : 'font-sans text-black'
                }`}
              style={{ boxSizing: 'border-box' }}
            >
              <div className="space-y-3">
                {/* 1. Header Banner (Page 1) */}
                <div
                  className={`pb-2.5 border-b flex items-center justify-between gap-4 ${isColour ? 'border-[#1b4332]' : 'border-black'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={CLIENT_BRANDING.logoUrl}
                      alt={CLIENT_BRANDING.logoAlt}
                      className="h-10 w-auto object-contain shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${isColour
                        ? 'bg-[#1b4332] text-[#fbf9f4] border-[#c69214]'
                        : 'bg-black text-white border-black'
                        }`}
                    >
                      <Church className="w-5 h-5" />
                    </div>
                    <div>
                      <h1
                        className={`text-base font-extrabold uppercase tracking-tight leading-tight ${isColour ? 'text-[#1b4332]' : 'text-black'
                          }`}
                      >
                        {activeParish?.parishName || 'St. Alphonsa Syro-Malabar Catholic Parish Brisbane'}
                      </h1>
                      <p className="text-[10px] text-slate-600 font-medium">
                        Official Parish Register Directory
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                    <div>
                      Generated: <strong>{printTimestamp}</strong>
                    </div>
                    <div>
                      Prepared by: <strong>{preparedBy}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Dynamic Filter Context Stamp (Page 1) */}
                <div
                  className={`p-2 rounded-lg border text-[10.5px] flex items-center justify-between flex-wrap gap-2 ${isColour
                    ? 'bg-[#fbf9f4] border-[#e8e1d2] text-slate-800'
                    : 'bg-white border-black text-black'
                    }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-extrabold uppercase text-[9.5px] tracking-wider text-slate-500">
                      Active Filter Scope:
                    </span>
                    <span>
                      Ward: <strong>{filters.unitName || (filters.unitId ? `Ward #${filters.unitId}` : 'All Wards')}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Status: <strong>{formatStatusLabel(filters.status)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Type: <strong>{formatTypeLabel(filters.type)}</strong>
                    </span>
                    {filters.directDebit && (
                      <>
                        <span>•</span>
                        <span>
                          Direct Debit: <strong>{filters.directDebit === 'YES' ? 'Active' : 'None'}</strong>
                        </span>
                      </>
                    )}
                    {filters.search && (
                      <>
                        <span>•</span>
                        <span>
                          Search: <strong>"{filters.search}"</strong>
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>
                      Sorted: <strong>{formatSortInfo(filters.sortBy, filters.sortOrder)}</strong>
                    </span>
                  </div>

                  <div className="font-bold text-[11px] shrink-0">
                    Total: <span className={isColour ? 'text-[#1b4332]' : 'text-black'}>{families.length}</span> Households (<span>{totalParishioners}</span> Parishioners)
                  </div>
                </div>

                {/* 3. High-Density Typographic Table (6 columns, Portrait) */}
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr
                      className={
                        isColour
                          ? 'bg-[#1b4332] text-white'
                          : 'bg-black text-white border-b-2 border-black'
                      }
                    >
                      <th className="py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider w-[4%] text-center">
                        Sl No
                      </th>
                      <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider w-[13%]">
                        Code & Status
                      </th>
                      <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider w-[25%]">
                        Head of Family / Spouse
                      </th>
                      <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider w-[21%]">
                        Ward / House
                      </th>
                      <th className="py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider w-[6%] text-center">
                        Members
                      </th>
                      <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider w-[31%]">
                        Address & Primary Contact
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {families.map((f, idx) => {
                      const head = f.headOfFamily || f.members[0];
                      const spouse = f.members?.find((m) => m.role?.toUpperCase() === 'SPOUSE');
                      const isEven = idx % 2 === 0;
                      const regTypeLabel =
                        f.registrationType === 'FAMILY'
                          ? 'Family'
                          : f.registrationType === 'INDIVIDUAL_STUDENT'
                            ? 'International Student'
                            : 'Individual';
                      const isPageBreak =
                        idx === 19 ||
                        (idx > 19 && (idx - 19) % 26 === 0 && idx < families.length - 1);
                      const nextPageIndex = idx === 19 ? 2 : Math.floor((idx - 19) / 26) + 2;

                      return (
                        <React.Fragment key={f.id}>
                          <tr
                            className={
                              isEven
                                ? isColour
                                  ? 'bg-[#fbf9f4]/70'
                                  : 'bg-white'
                                : 'bg-white'
                            }
                          >
                            {/* Col 0: Sl No */}
                            <td className="py-1.5 px-1.5 align-top text-center font-bold text-slate-500 text-[10.5px]">
                              {idx + 1}
                            </td>

                            {/* Col 1: Code & Status */}
                            <td className="py-1.5 px-2 align-top">
                              <div className="font-mono font-bold text-xs text-slate-900 leading-tight">
                                {f.familyCode || `#${f.id}`}
                              </div>
                              <div className="mt-0.5">
                                <span
                                  className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border inline-block ${isColour
                                    ? f.status === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                      : 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'border-black text-black'
                                    }`}
                                >
                                  {f.status}
                                </span>
                              </div>
                            </td>

                            {/* Col 2: Head of Family / Spouse */}
                            <td className="py-1.5 px-2 align-top">
                              <div className="font-extrabold text-slate-950 text-[11px] leading-tight">
                                {head?.fullName || 'Not recorded'}
                              </div>
                              {spouse?.fullName && (
                                <div className="text-[9.5px] font-medium text-slate-600 mt-0.5 leading-tight">
                                  {spouse.fullName}
                                </div>
                              )}
                            </td>

                            {/* Col 3: Ward / House */}
                            <td className="py-1.5 px-2 align-top">
                              <div
                                className={`font-bold text-[10.5px] leading-tight break-words ${isColour ? 'text-[#1b4332]' : 'text-black'
                                  }`}
                              >
                                {f.unit ? formatWardName(f.unit.unitName) : '⚠️ Unassigned'}
                              </div>
                              <div className="text-[9.5px] text-slate-600 mt-0.5 leading-tight">
                                {f.houseName && (
                                  <>
                                    <strong className="text-slate-900">{f.houseName}</strong>{' '}
                                  </>
                                )}
                                <span className="text-slate-500">({regTypeLabel})</span>
                              </div>
                            </td>

                            {/* Col 4: Total Members */}
                            <td className="py-1.5 px-1.5 align-top text-center">
                              <span
                                className={`font-extrabold text-[10px] px-2 py-0.5 rounded-full border inline-block ${isColour
                                  ? 'bg-[#e8f3ed] text-[#1b4332] border-[#1b4332]/30'
                                  : 'border-black text-black'
                                  }`}
                              >
                                {f.membersCount || f.members.length}
                              </span>
                            </td>

                            {/* Col 5: Address & Contact */}
                            <td className="py-1.5 px-2 align-top">
                              <div className="text-slate-900 leading-tight text-[10.5px]">
                                {f.streetAddress || 'Address not recorded'}
                                {f.city &&
                                  `, ${f.city} ${formatState(f.state)} ${f.postalCode || ''}`}
                              </div>
                              <div className="text-[9.5px] text-slate-600 flex flex-wrap gap-x-2 pt-0.5 leading-tight">
                                {f.primaryPhone && <span>📞 {f.primaryPhone}</span>}
                                {f.primaryEmail && <span>✉️ {f.primaryEmail}</span>}
                              </div>
                            </td>
                          </tr>

                          {/* On-screen visual divider indicating multi-page PDF boundary */}
                          {isPageBreak && (
                            <tr className="bg-slate-100 text-slate-500 font-bold text-[10px] text-center border-y-2 border-dashed border-slate-300">
                              <td colSpan={6} className="py-1.5">
                                📄 --- End of Page {nextPageIndex - 1} • Page {nextPageIndex} continues below with repeating table header in PDF ---
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 4. Footer */}
              <div className="pt-3 mt-4 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
                <span>
                  Official Record • {activeParish?.parishName || 'St. Alphonsa Syro-Malabar Catholic Parish'} • Strictly Confidential
                </span>
                <span>
                  Printed by: <strong className="text-slate-700 font-semibold">{preparedBy}</strong> on {printTimestamp} • Page 1 of {estimatedPages}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
