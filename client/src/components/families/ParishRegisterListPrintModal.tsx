import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Printer,
  Church,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
} from 'lucide-react';

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
  initialDetailLevel?: 'COMPACT' | 'WHOLE_FAMILY';
}

export const ParishRegisterListPrintModal: React.FC<ParishRegisterListPrintModalProps> = ({
  isOpen,
  onClose,
  filters,
  initialTheme = 'COLOUR',
  initialDetailLevel = 'COMPACT',
}) => {
  const { activeParish, user, parishLogo } = useAuth();
  const [printTheme, setPrintTheme] = useState<'COLOUR' | 'FLAT'>(initialTheme);
  const [exportDetailLevel, setExportDetailLevel] = useState<'COMPACT' | 'WHOLE_FAMILY'>(initialDetailLevel);
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [isLoading, setIsLoading] = useState(true);
  const [families, setFamilies] = useState<ExportFamilyItem[]>([]);

  // Synchronized horizontal scroll refs & handlers for landscape mode
  const topScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [scrollTrackWidth, setScrollTrackWidth] = useState<number>(1200);

  const handleTopScroll = () => {
    if (isSyncingScroll.current) return;
    if (topScrollRef.current && previewScrollRef.current) {
      isSyncingScroll.current = true;
      previewScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handlePreviewScroll = () => {
    if (isSyncingScroll.current) return;
    if (topScrollRef.current && previewScrollRef.current) {
      isSyncingScroll.current = true;
      topScrollRef.current.scrollLeft = previewScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const scrollLeftBy = (amount: number) => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Keep scroll track width synchronized with the document preview width
  useEffect(() => {
    const updateWidth = () => {
      if (previewScrollRef.current) {
        setScrollTrackWidth(Math.max(previewScrollRef.current.scrollWidth, 1200));
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 300);
    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      clearTimeout(timer);
    };
  }, [orientation, exportDetailLevel, families, isOpen]);

  useEffect(() => {
    setPrintTheme(initialTheme);
  }, [initialTheme]);

  useEffect(() => {
    if (initialDetailLevel) {
      setExportDetailLevel(initialDetailLevel);
    }
  }, [initialDetailLevel]);

  const filtersKey = useMemo(() => {
    return JSON.stringify({
      search: filters.search?.trim() || '',
      unitId: filters.unitId || '',
      status: filters.status || '',
      type: filters.type || '',
      directDebit: filters.directDebit || '',
      sortBy: filters.sortBy || '',
      sortOrder: filters.sortOrder || '',
    });
  }, [
    filters.search,
    filters.unitId,
    filters.status,
    filters.type,
    filters.directDebit,
    filters.sortBy,
    filters.sortOrder,
  ]);

  useEffect(() => {
    let isCancelled = false;

    if (isOpen) {
      setIsLoading(true);

      const fetchExportData = async () => {
        try {
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

          if (!isCancelled) {
            setFamilies(res.data.data);
            setIsLoading(false);
          }
        } catch (err: any) {
          if (!isCancelled) {
            console.error('Failed to load export register dataset:', err);
            setIsLoading(false);
          }
        }
      };

      fetchExportData();
    } else {
      setFamilies([]);
      setIsLoading(true);
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, filtersKey]);

  const isColour = printTheme === 'COLOUR';
  const isWholeFamily = exportDetailLevel === 'WHOLE_FAMILY';
  const isLandscape = orientation === 'LANDSCAPE';


  // Compute total parishioners
  const totalParishioners = families.reduce(
    (acc, f) => acc + (f.membersCount || f.members.length || 0),
    0
  );

  // Dynamic estimated page count based on detail level and orientation
  const estimatedPages = useMemo(() => {
    if (isWholeFamily) {
      if (isLandscape) {
        return families.length <= 8 ? 1 : 1 + Math.ceil((families.length - 8) / 12);
      }
      return families.length <= 9 ? 1 : 1 + Math.ceil((families.length - 9) / 13);
    }
    if (isLandscape) {
      return families.length <= 16 ? 1 : 1 + Math.ceil((families.length - 16) / 22);
    }
    return families.length <= 20 ? 1 : 1 + Math.ceil((families.length - 20) / 26);
  }, [families.length, isWholeFamily, isLandscape]);

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

    // Generate table rows HTML (6 columns: Sl No, Code & Status, Family Members, Ward & House, Total Members, Address & Contact)
    const rowsHtml = families
      .map((f, idx) => {
        const head = f.headOfFamily || f.members.find((m) => m.role?.toUpperCase() === 'HEAD') || f.members[0];
        const spouse = f.members?.find((m) => m.role?.toUpperCase() === 'SPOUSE' && m.id !== head?.id);
        const kids = (f.members || []).filter(
          (m) =>
            m.id !== head?.id &&
            (!spouse || m.id !== spouse.id) &&
            (m.role?.toUpperCase() === 'CHILD' ||
              m.role?.toUpperCase() === 'OTHER_DEPENDENT' ||
              !['HEAD', 'SPOUSE'].includes(m.role?.toUpperCase()))
        );

        const headPhone = head?.phone || f.primaryPhone;
        const headEmail = head?.email || f.primaryEmail;
        const headMetaParts = [];
        if (headPhone) headMetaParts.push(`&#128222; ${headPhone}`);
        if (headEmail) headMetaParts.push(`&#9993; ${headEmail}`);
        const headMeta = headMetaParts.join(' &nbsp;&bull;&nbsp; ');

        const spousePhone = spouse?.phone;
        const spouseEmail = spouse?.email;
        const spouseMetaParts = [];
        if (spousePhone) spouseMetaParts.push(`&#128222; ${spousePhone}`);
        if (spouseEmail) spouseMetaParts.push(`&#9993; ${spouseEmail}`);
        const spouseMeta = spouseMetaParts.join(' &nbsp;&bull;&nbsp; ');

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

        if (isWholeFamily) {
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
                <!-- 1. Head: row 1 name, row 2 meta + mobile + email -->
                <div style="font-weight: 800; font-size: 11px; color: #020617; line-height: 1.25;">
                  ${head?.fullName || 'Not recorded'}
                  <span style="font-size: 8px; font-weight: 700; padding: 0.5px 4px; border-radius: 3px; margin-left: 4px; ${isColour ? 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;' : 'border: 1px solid #000000; color: #000000;'}">HEAD</span>
                </div>
                ${headMeta ? `
                  <div style="font-size: 9px; color: #475569; margin-top: 1.5px; line-height: 1.25;">
                    ${headMeta}
                  </div>
                ` : ''}

                <!-- 2. Spouse: row 3 name, row 4 meta + mobile + email -->
                ${spouse ? `
                  <div style="font-weight: 700; font-size: 10.5px; color: #0f172a; margin-top: 3.5px; line-height: 1.25;">
                    ${spouse.fullName}
                    <span style="font-size: 8px; font-weight: 700; padding: 0.5px 4px; border-radius: 3px; margin-left: 4px; ${isColour ? 'background: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8;' : 'border: 1px solid #000000; color: #000000;'}">SPOUSE</span>
                  </div>
                  ${spouseMeta ? `
                    <div style="font-size: 9px; color: #475569; margin-top: 1.5px; line-height: 1.25;">
                      ${spouseMeta}
                    </div>
                  ` : ''}
                ` : ''}

                <!-- 3. Kids: row 5 inline tags (Whole Family only) -->
                ${kids.length > 0 ? `
                  <div style="margin-top: 3.5px; padding-top: 2.5px; border-top: 1px dashed ${isColour ? '#cbd5e1' : '#000000'}; font-size: 8.5px; line-height: 1.3; display: flex; flex-wrap: wrap; align-items: center; gap: 3.5px;">
                    <span style="font-weight: 800; font-size: 8px; text-transform: uppercase; letter-spacing: 0.03em; color: ${isColour ? '#1b4332' : '#000000'}; margin-right: 1px; flex-shrink: 0;">
                      Kids (${kids.length}):
                    </span>
                    ${kids.map((k) => {
                      const meta = k.phone ? `&#128222; ${k.phone}` : '';
                      return `
                        <span style="display: inline-flex; align-items: center; background: ${isColour ? '#f8fafc' : '#ffffff'}; border: 1px solid ${isColour ? '#cbd5e1' : '#000000'}; border-radius: 3px; padding: 0.5px 4.5px; font-size: 8.5px; color: #0f172a; white-space: nowrap;">
                          <strong style="font-weight: 600;">${k.fullName}</strong>
                          ${meta ? `<span style="color: #64748b; font-weight: 500; margin-left: 3px;">(${meta})</span>` : ''}
                        </span>
                      `;
                    }).join('')}
                  </div>
                ` : ''}
              </td>
              <td style="padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 10px; color: #0f172a; line-height: 1.35;">
                  <div style="font-weight: 700; color: ${isColour ? '#1b4332' : '#000000'};">
                    Ward: ${f.unit ? formatWardName(f.unit.unitName) : '&#9888; Unassigned'}
                  </div>
                  <div style="color: #334155; margin-top: 1px;">
                    ${f.houseName ? `House: <strong>${f.houseName}</strong> ` : ''}<span style="color: #64748b;">(${regTypeLabel})</span>
                  </div>
                  <div style="color: #475569; font-size: 9.5px; margin-top: 2px;">
                    📍 ${fullAddress}
                  </div>
                </div>
              </td>
            </tr>
          `;
        }

        // Compact Summary: EXACT INTACT 6 COLUMNS
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
          <title>${parishName} - Directory</title>
          <style>
            @page {
              size: A4 ${orientation.toLowerCase()};
              margin: 8mm 8mm 12mm 8mm;
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
              font-size: 10.5px;
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
              font-size: 10px;
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
              padding: 6px 6px;
              font-size: 9px;
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
              <img src="${parishLogo || '/branding/logo.png'}" alt="${parishName}" style="height: 38px; width: auto; object-fit: contain;" onerror="this.onerror=null; this.src='/branding/logo.png';" />
              <div id="fallback-crest" class="crest-box" style="display: none;">&#9877;</div>
              <div class="header-title">
                <h1>${parishName}</h1>
                <p>Official Parish Register Directory ${isWholeFamily ? '&bull; Whole Family Roster' : '&bull; Compact Summary'}</p>
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
              <strong style="text-transform: uppercase; font-size: 9px; color: #64748b; margin-right: 6px;">Active Scope:</strong>
              Ward: <strong>${filters.unitName || (filters.unitId ? `Ward #${filters.unitId}` : 'All Wards')}</strong>
              &nbsp;&bull;&nbsp; Status: <strong>${formatStatusLabel(filters.status)}</strong>
              &nbsp;&bull;&nbsp; Type: <strong>${formatTypeLabel(filters.type)}</strong>
              ${filters.directDebit ? `&nbsp;&bull;&nbsp; Direct Debit: <strong>${filters.directDebit === 'YES' ? 'Active' : 'None'}</strong>` : ''}
              ${filters.search ? `&nbsp;&bull;&nbsp; Search: <strong>"${filters.search}"</strong>` : ''}
              &nbsp;&bull;&nbsp; Sorted: <strong>${formatSortInfo(filters.sortBy, filters.sortOrder)}</strong>
              &nbsp;&bull;&nbsp; Layout: <strong>${isWholeFamily ? 'Whole Family' : 'Compact Summary'} (${orientation.toLowerCase()})</strong>
            </div>
            <div>
              <strong>Total: <span style="color: ${isColour ? '#1b4332' : '#000000'};">${families.length}</span> Households (${totalParishioners} Parishioners)</strong>
            </div>
          </div>

          <!-- 3. High-Density Table with repeating thead on each page -->
          <table>
            <thead>
              ${isWholeFamily ? `
                <tr>
                  <th style="width: ${isLandscape ? '3.5%' : '4%'}; text-align: center;">Sl No</th>
                  <th style="width: ${isLandscape ? '9.5%' : '11%'};">Code &amp; Status</th>
                  <th style="width: ${isLandscape ? '58%' : '56%'};">Family Members (Head, Spouse &amp; Kids)</th>
                  <th style="width: ${isLandscape ? '29%' : '29%'};">Ward, House &amp; Address</th>
                </tr>
              ` : `
                <tr>
                  <th style="width: ${isLandscape ? '3.5%' : '4%'}; text-align: center;">Sl No</th>
                  <th style="width: ${isLandscape ? '9.5%' : '11%'};">Code &amp; Status</th>
                  <th style="width: ${isLandscape ? '26%' : '25%'};">Head of Family / Spouse</th>
                  <th style="width: ${isLandscape ? '22%' : '21%'};">Ward / House</th>
                  <th style="width: ${isLandscape ? '5%' : '6%'}; text-align: center;">Members</th>
                  <th style="width: ${isLandscape ? '34%' : '33%'};">Address &amp; Primary Contact</th>
                </tr>
              `}
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- 4. End-of-Roster Summary Marker -->
          <div style="margin-top: 10px; padding: 6px 0; text-align: center; font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; break-inside: avoid; page-break-inside: avoid;">
            &mdash; End of Official Parish Register Roster (${families.length} Total Households &bull; ${totalParishioners} Parishioners) &mdash;
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
      maxWidth={isLandscape ? '6xl' : '5xl'}
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="p-3 bg-parish-surface-subtle border border-parish-border rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* 1. Report Style */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-parish-text">Theme:</span>
              <div className="inline-flex rounded-lg border border-parish-border p-0.5 bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setPrintTheme('COLOUR')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${isColour
                    ? 'bg-parish-primary text-white shadow-xs'
                    : 'text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  🎨 Formatted (Colour)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintTheme('FLAT')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${!isColour
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  🖨️ Flat (B&W)
                </button>
              </div>
            </div>

            {/* 2. Content Detail Level (Compact vs Whole Family) */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-parish-text">Content:</span>
              <div className="inline-flex rounded-lg border border-parish-border p-0.5 bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setExportDetailLevel('COMPACT')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${!isWholeFamily
                    ? 'bg-parish-primary text-white shadow-xs'
                    : 'text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  <span>📋 Compact Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportDetailLevel('WHOLE_FAMILY')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${isWholeFamily
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  <span>👨‍👩‍👧‍👦 Whole Family</span>
                </button>
              </div>
            </div>

            {/* 3. Orientation */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-parish-text">Layout:</span>
              <div className="inline-flex rounded-lg border border-parish-border p-0.5 bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setOrientation('PORTRAIT')}
                  className={`px-2 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${!isLandscape
                    ? 'bg-parish-primary text-white shadow-xs'
                    : 'text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  📄 Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('LANDSCAPE')}
                  className={`px-2 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${isLandscape
                    ? 'bg-parish-primary text-white shadow-xs'
                    : 'text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  📃 Landscape
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isLoading ? (
              <span className="text-parish-text-muted text-xs flex items-center gap-1.5 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-parish-primary" />
                Preparing roster...
              </span>
            ) : (
              <>
                <span className="text-parish-text-muted text-xs">
                  Total: <strong>{families.length}</strong> households (<strong>{totalParishioners}</strong> parishioners)
                </span>

                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
                  📄 ~{estimatedPages} Pages ({orientation.toLowerCase()})
                </span>
              </>
            )}

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
            💡 <strong>On-Screen Report Preview:</strong> Scroll down to review the report matching your active filters. When saved as PDF or printed, this report automatically flows across <strong>{estimatedPages} {orientation.toLowerCase()} A4 pages</strong> with repeating column headers on every page and no overlapping.
          </span>
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 shrink-0 md:hidden bg-slate-200/60 px-2 py-0.5 rounded">
            ⇄ Scroll horizontally to view all columns
          </span>
        </div>

        {/* Dedicated Always-Visible Top Horizontal Scroll & Pan Bar (Especially for Landscape) */}
        {isLandscape && (
          <div className="bg-slate-100/95 border border-slate-300 rounded-xl px-3 py-2 flex items-center gap-2.5 shadow-xs transition-all">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 shrink-0">
              <MoveHorizontal className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">Horizontal View:</span>
            </div>

            <button
              type="button"
              onClick={() => scrollLeftBy(-280)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Pan Left (view leftmost columns)"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xs:inline">Pan Left</span>
            </button>

            {/* Interactive Top Scrollbar Track */}
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="flex-1 overflow-x-auto overflow-y-hidden h-5 bg-slate-200/90 rounded border border-slate-300/80 cursor-ew-resize top-scrollbar-track"
              title="Drag or scroll here to pan left/right"
            >
              <div style={{ width: `${scrollTrackWidth}px`, height: '1px' }} />
            </div>

            <button
              type="button"
              onClick={() => scrollLeftBy(280)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Pan Right (view rightmost columns)"
            >
              <span className="hidden xs:inline">Pan Right</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        )}

        {/* Document Preview Container (Portrait or Landscape A4 Preview) */}
        <div
          ref={previewScrollRef}
          onScroll={handlePreviewScroll}
          className="bg-slate-200/70 p-2 sm:p-4 rounded-2xl overflow-auto border border-slate-300 preview-scroll-container touch-pan-x shadow-inner max-h-[calc(85vh-210px)] min-h-[380px]"
        >
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
              className={`mx-auto p-[8mm] bg-white text-slate-900 shadow-xl rounded-xl border border-slate-300 transition-all duration-150 flex flex-col justify-between shrink-0 ${isLandscape ? 'w-[297mm] min-w-[960px]' : 'w-[210mm] min-w-[760px]'} ${isColour ? 'font-sans' : 'font-sans text-black'
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
                      src={parishLogo || '/branding/logo.png'}
                      alt={activeParish?.parishName || 'Parish Official Seal'}
                      className="h-10 w-auto object-contain shrink-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.endsWith('/branding/logo.png')) {
                          target.src = '/branding/logo.png';
                        } else {
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }
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
                        Official Parish Register Directory {isWholeFamily ? '• Whole Family Roster' : '• Compact Summary'}
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
                      Active Scope:
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
                    <span>•</span>
                    <span>
                      Layout: <strong>{isWholeFamily ? 'Whole Family' : 'Compact Summary'} ({orientation.toLowerCase()})</strong>
                    </span>
                  </div>

                  <div className="font-bold text-[11px] shrink-0">
                    Total: <span className={isColour ? 'text-[#1b4332]' : 'text-black'}>{families.length}</span> Households (<span>{totalParishioners}</span> Parishioners)
                  </div>
                </div>

                {/* 3. High-Density Typographic Table */}
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr
                      className={
                        isColour
                          ? 'bg-[#1b4332] text-white'
                          : 'bg-black text-white border-b-2 border-black'
                      }
                    >
                      {isWholeFamily ? (
                        <>
                          <th className={`py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-center ${isLandscape ? 'w-[3.5%]' : 'w-[4%]'}`}>
                            Sl No
                          </th>
                          <th className={`py-2 px-2 font-bold text-[10px] uppercase tracking-wider ${isLandscape ? 'w-[9.5%]' : 'w-[11%]'}`}>
                            Code & Status
                          </th>
                          <th className={`py-2 px-2 font-bold text-[10px] uppercase tracking-wider ${isLandscape ? 'w-[58%]' : 'w-[56%]'}`}>
                            Family Members (Head, Spouse & Kids)
                          </th>
                          <th className={`py-2 px-2 font-bold text-[10px] uppercase tracking-wider ${isLandscape ? 'w-[29%]' : 'w-[29%]'}`}>
                            Ward, House & Address
                          </th>
                        </>
                      ) : (
                        <>
                          <th className={`py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-center ${isLandscape ? 'w-[3.5%]' : 'w-[4%]'}`}>
                            Sl No
                          </th>
                          <th className={`py-2 px-2 font-bold text-[10px] uppercase tracking-wider ${isLandscape ? 'w-[9.5%]' : 'w-[11%]'}`}>
                            Code & Status
                          </th>
                          <th className={`py-2 px-2 font-bold text-[10px] uppercase tracking-wider ${isLandscape ? 'w-[26%]' : 'w-[25%]'}`}>
                            Head of Family / Spouse
                          </th>
                          <th className={`py-2 px-2 font-bold text-[10px] uppercase tracking-wider ${isLandscape ? 'w-[22%]' : 'w-[21%]'}`}>
                            Ward / House
                          </th>
                          <th className={`py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-center ${isLandscape ? 'w-[5%]' : 'w-[6%]'}`}>
                            Members
                          </th>
                          <th className={`py-2 px-2 font-bold text-[10px] uppercase tracking-wider ${isLandscape ? 'w-[34%]' : 'w-[33%]'}`}>
                            Address & Primary Contact
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {families.map((f, idx) => {
                      const head = f.headOfFamily || f.members.find((m) => m.role?.toUpperCase() === 'HEAD') || f.members[0];
                      const spouse = f.members?.find((m) => m.role?.toUpperCase() === 'SPOUSE' && m.id !== head?.id);
                      const kids = (f.members || []).filter(
                        (m) =>
                          m.id !== head?.id &&
                          (!spouse || m.id !== spouse.id) &&
                          (m.role?.toUpperCase() === 'CHILD' ||
                            m.role?.toUpperCase() === 'OTHER_DEPENDENT' ||
                            !['HEAD', 'SPOUSE'].includes(m.role?.toUpperCase()))
                      );



                      const isEven = idx % 2 === 0;
                      const regTypeLabel =
                        f.registrationType === 'FAMILY'
                          ? 'Family'
                          : f.registrationType === 'INDIVIDUAL_STUDENT'
                            ? 'International Student'
                            : 'Individual';

                      const addressStr = f.streetAddress || 'Address not recorded';
                      const cityStateZip = [f.city, formatState(f.state), f.postalCode].filter(Boolean).join(' ');
                      const fullAddress = cityStateZip ? `${addressStr}, ${cityStateZip}` : addressStr;

                      const pageBatchSize = isWholeFamily ? (isLandscape ? 12 : 13) : (isLandscape ? 22 : 26);
                      const firstPageBatch = isWholeFamily ? (isLandscape ? 8 : 9) : (isLandscape ? 16 : 20);
                      const isPageBreak =
                        idx === firstPageBatch - 1 ||
                        (idx >= firstPageBatch && (idx - firstPageBatch + 1) % pageBatchSize === 0 && idx < families.length - 1);
                      const nextPageIndex = idx < firstPageBatch ? 2 : Math.floor((idx - firstPageBatch + 1) / pageBatchSize) + 2;

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
                            {isWholeFamily ? (
                              <>
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

                                {/* Col 2: Family Members (Head, Spouse & Kids) */}
                                <td className="py-1.5 px-2 align-top">
                                  {/* Head: Row 1 Name + Badge, Row 2 Details + Mobile + Email */}
                                  <div className="font-extrabold text-slate-950 text-[11px] leading-tight">
                                    {head?.fullName || 'Not recorded'}
                                    <span
                                      className={`text-[8px] font-bold px-1 py-0.5 rounded ml-1.5 inline-block ${
                                        isColour
                                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                          : 'border border-black text-black'
                                      }`}
                                    >
                                      HEAD
                                    </span>
                                  </div>
                                  {((head?.phone || f.primaryPhone) || (head?.email || f.primaryEmail)) && (
                                    <div className="text-[9px] text-slate-600 mt-0.5 leading-tight flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      {(head?.phone || f.primaryPhone) && (
                                        <span>📞 {head?.phone || f.primaryPhone}</span>
                                      )}
                                      {(head?.email || f.primaryEmail) && (
                                        <span>✉️ {head?.email || f.primaryEmail}</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Spouse: Row 3 Name + Badge, Row 4 Details + Mobile + Email */}
                                  {spouse?.fullName && (
                                    <>
                                      <div className="font-bold text-slate-900 text-[10.5px] mt-1.5 leading-tight">
                                        {spouse.fullName}
                                        <span
                                          className={`text-[8px] font-bold px-1 py-0.5 rounded ml-1.5 inline-block ${
                                            isColour
                                              ? 'bg-pink-100 text-pink-800 border border-pink-200'
                                              : 'border border-black text-black'
                                          }`}
                                        >
                                          SPOUSE
                                        </span>
                                      </div>
                                      {(spouse.phone || spouse.email) && (
                                        <div className="text-[9px] text-slate-600 mt-0.5 leading-tight flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                          {spouse.phone && <span>📞 {spouse.phone}</span>}
                                          {spouse.email && <span>✉️ {spouse.email}</span>}
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {/* Kids: Row 5 Inline Badges */}
                                  {kids.length > 0 && (
                                    <div className={`mt-1.5 pt-1 border-t border-dashed ${isColour ? 'border-slate-200' : 'border-black'} text-[9px] flex flex-wrap items-center gap-1.5`}>
                                      <span className={`font-extrabold uppercase text-[8px] tracking-wider shrink-0 mr-0.5 ${isColour ? 'text-emerald-900' : 'text-black'}`}>
                                        Kids ({kids.length}):
                                      </span>
                                      {kids.map((k) => {
                                        return (
                                          <span
                                            key={k.id}
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] border whitespace-nowrap ${
                                              isColour
                                                ? 'bg-slate-50 text-slate-900 border-slate-200'
                                                : 'bg-white text-black border-black'
                                            }`}
                                          >
                                            <strong className="font-semibold">{k.fullName}</strong>
                                            {k.phone && <span className="text-slate-500 font-medium">(📞 {k.phone})</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>

                                {/* Col 3: Ward, House & Address */}
                                <td className="py-1.5 px-2 align-top">
                                  <div className={`font-bold text-[10.5px] leading-tight break-words ${isColour ? 'text-[#1b4332]' : 'text-black'}`}>
                                    Ward: {f.unit ? formatWardName(f.unit.unitName) : '⚠️ Unassigned'}
                                  </div>
                                  <div className="text-[9.5px] text-slate-700 mt-0.5 leading-tight">
                                    {f.houseName && (
                                      <>
                                        House: <strong className="text-slate-900">{f.houseName}</strong>{' '}
                                      </>
                                    )}
                                    <span className="text-slate-500">({regTypeLabel})</span>
                                  </div>
                                  <div className="text-slate-600 text-[9.5px] mt-1 leading-tight flex items-start gap-1">
                                    <span className="shrink-0 text-slate-400">📍</span>
                                    <span>{fullAddress}</span>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
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

                                {/* Col 2: Head of Family / Spouse (Compact Intact) */}
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

                                {/* Col 3: Ward / House (Compact Intact) */}
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

                                {/* Col 4: Total Members (Compact Intact) */}
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

                                {/* Col 5: Address & Primary Contact (Compact Intact) */}
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
                              </>
                            )}
                          </tr>

                          {/* On-screen visual divider indicating multi-page PDF boundary */}
                          {isPageBreak && (
                            <tr className="bg-slate-100 text-slate-500 font-bold text-[10px] text-center border-y-2 border-dashed border-slate-300">
                              <td colSpan={isWholeFamily ? 4 : 6} className="py-1.5">
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
