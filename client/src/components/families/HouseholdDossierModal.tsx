import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  Printer,
  Church,
  Home,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CLIENT_BRANDING } from '../../config/branding';

export interface DossierMember {
  id: number;
  role: 'HEAD' | 'SPOUSE' | 'CHILD' | 'OTHER_DEPENDENT' | string;
  fullName: string;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  phone: string | null;
  email: string | null;
  isPrimaryContact?: boolean;
}

export interface DossierFamily {
  id: number;
  familyCode: string | null;
  houseName: string;
  registrationType: string;
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
  members: DossierMember[];
  directDebit?: {
    id?: number;
    amount?: number | string | null;
    frequency?: string | null;
    active?: boolean;
    comments?: string | null;
  } | null;
  generalNotes?: string | null;
  registrationDate?: string;
  createdAt?: string;
}

interface HouseholdDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: DossierFamily | null;
}

export const HouseholdDossierModal: React.FC<HouseholdDossierModalProps> = ({
  isOpen,
  onClose,
  family,
}) => {
  const { user, activeParish } = useAuth();
  const [printTheme, setPrintTheme] = useState<'COLOUR' | 'FLAT'>('COLOUR');
  const [includeNotes, setIncludeNotes] = useState(false);

  const preparedBy = user?.fullName || 'Parish Administration';
  const screenTimestamp = useMemo(() => {
    return new Date().toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, [isOpen]);

  // Age calculation helper
  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatState = (s?: string | null) => {
    if (!s) return 'QLD';
    const u = s.trim().toUpperCase();
    if (u === 'QUEENSLAND' || u === 'QLD' || u === 'BRISBANE') return 'QLD';
    return u;
  };

  // Defensive deduplication of members by id or unique identity
  const uniqueMembers = useMemo(() => {
    if (!family?.members) return [];
    const seen = new Set<string>();
    return family.members.filter((m) => {
      const key = m.id ? `id-${m.id}` : `name-${(m.fullName || '').trim().toLowerCase()}-${m.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [family?.members]);

  const headMember = useMemo(
    () => uniqueMembers.find((m) => m.role === 'HEAD') || uniqueMembers[0],
    [uniqueMembers]
  );
  const spouseMember = useMemo(
    () => uniqueMembers.find((m) => m.role === 'SPOUSE' && m !== headMember),
    [uniqueMembers, headMember]
  );
  const otherMembers = useMemo(
    () => uniqueMembers.filter((m) => m !== headMember && m !== spouseMember),
    [uniqueMembers, headMember, spouseMember]
  );

  // Isolated hidden iframe printing to guarantee EXACTLY 1 A4 page with ZERO repetition
  const handleTriggerPrint = () => {
    if (!family) return;

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

    const isColour = printTheme === 'COLOUR';
    const parishName =
      activeParish?.parishName || 'St. Alphonsa Syro-Malabar Catholic Parish Brisbane';
    const parishCode = activeParish?.parishCode || 'SABN';
    const parishCity = activeParish?.city || 'Brisbane';
    const headerDate = new Date().toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const printTimestamp = new Date().toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const statusBadgeStyle = isColour
      ? family.status === 'ACTIVE'
        ? 'background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;'
        : 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;'
      : 'background: #ffffff; color: #000000; border: 1px solid #000000;';

    const codeBadgeStyle = isColour
      ? 'background: #e8f3ed; color: #1b4332; border: 1px solid #86efac;'
      : 'background: #ffffff; color: #000000; border: 1px solid #000000;';

    const cardBoxStyle = isColour
      ? 'background: #fbf9f4; border: 1px solid #e2e8f0;'
      : 'background: #ffffff; border: 1px solid #cbd5e1;';

    const rootsBoxStyle = isColour
      ? 'background: #fefce8; border: 1px solid #fef08a; color: #713f12;'
      : 'background: #ffffff; border: 1px solid #cbd5e1; color: #000000;';

    // Member cards HTML
    let membersHtml = '';

    // Head card
    if (headMember) {
      const age = calculateAge(headMember.dateOfBirth);
      const dobStr = headMember.dateOfBirth
        ? new Date(headMember.dateOfBirth).toLocaleDateString('en-AU')
        : 'N/A';
      const headCardBg = isColour
        ? 'background: rgba(232, 243, 237, 0.6); border: 1px solid #86efac;'
        : 'background: #ffffff; border: 1px solid #000000;';
      const headBadgeBg = isColour
        ? 'background: #1b4332; color: #ffffff;'
        : 'background: #000000; color: #ffffff;';

      membersHtml += `
        <div style="padding: 7px 10px; border-radius: 8px; ${headCardBg}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
            <div>
              <span style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; display: inline-block; ${headBadgeBg}">
                Head of Family
              </span>
              <div style="font-size: 11.5px; font-weight: 800; color: #020617; margin-top: 3px; line-height: 1.2;">
                ${headMember.fullName}
              </div>
            </div>
            ${headMember.isPrimaryContact
          ? `<span style="font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 4px; ${isColour
            ? 'background: #a7f3d0; color: #064e3b;'
            : 'border: 1px solid #000000;'
          }">Primary Contact</span>`
          : ''
        }
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 9.5px; color: #334155; margin-top: 4px; padding-top: 3px; border-top: 1px solid rgba(0,0,0,0.08);">
            <div>DOB: <strong>${dobStr}</strong> ${age !== null ? `(${age} yrs)` : ''}</div>
            <div>POB: <strong>${headMember.placeOfBirth || 'N/A'}</strong></div>
            ${headMember.phone ? `<div style="grid-column: span 2;">Ph: <strong>${headMember.phone}</strong></div>` : ''}
            ${headMember.email ? `<div style="grid-column: span 2; font-size: 9px; color: #64748b;">${headMember.email}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Spouse card
    if (spouseMember) {
      const age = calculateAge(spouseMember.dateOfBirth);
      const dobStr = spouseMember.dateOfBirth
        ? new Date(spouseMember.dateOfBirth).toLocaleDateString('en-AU')
        : 'N/A';
      const spouseCardBg = isColour
        ? 'background: rgba(254, 243, 199, 0.5); border: 1px solid #fde68a;'
        : 'background: #ffffff; border: 1px solid #cbd5e1;';
      const spouseBadgeBg = isColour
        ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;'
        : 'border: 1px solid #000000; color: #000000;';

      membersHtml += `
        <div style="padding: 7px 10px; border-radius: 8px; ${spouseCardBg}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
            <div>
              <span style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; display: inline-block; ${spouseBadgeBg}">
                Spouse
              </span>
              <div style="font-size: 11.5px; font-weight: 800; color: #020617; margin-top: 3px; line-height: 1.2;">
                ${spouseMember.fullName}
              </div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 9.5px; color: #334155; margin-top: 4px; padding-top: 3px; border-top: 1px solid rgba(0,0,0,0.08);">
            <div>DOB: <strong>${dobStr}</strong> ${age !== null ? `(${age} yrs)` : ''}</div>
            <div>POB: <strong>${spouseMember.placeOfBirth || 'N/A'}</strong></div>
            ${spouseMember.phone ? `<div style="grid-column: span 2;">Ph: <strong>${spouseMember.phone}</strong></div>` : ''}
            ${spouseMember.email ? `<div style="grid-column: span 2; font-size: 9px; color: #64748b;">${spouseMember.email}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Children and Other Dependents
    otherMembers.forEach((m) => {
      const age = calculateAge(m.dateOfBirth);
      const dobStr = m.dateOfBirth
        ? new Date(m.dateOfBirth).toLocaleDateString('en-AU')
        : 'N/A';
      const childCardBg = isColour
        ? 'background: rgba(240, 249, 255, 0.8); border: 1px solid #bae6fd;'
        : 'background: #ffffff; border: 1px solid #cbd5e1;';
      const childBadgeBg = isColour
        ? 'background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc;'
        : 'border: 1px solid #000000; color: #000000;';

      membersHtml += `
        <div style="padding: 6px 9px; border-radius: 8px; ${childCardBg}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; line-height: 1.2;">
              ${m.fullName}
            </div>
            <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; padding: 1px 5px; border-radius: 3px; display: inline-block; ${childBadgeBg}">
              ${m.role}
            </span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 9px; color: #475569; margin-top: 3px; padding-top: 2px; border-top: 1px solid rgba(0,0,0,0.06);">
            <div>DOB: <strong>${dobStr}</strong> ${age !== null ? `(${age} yrs)` : ''}</div>
            <div>POB: <strong>${m.placeOfBirth || 'N/A'}</strong></div>
            ${m.phone ? `<div style="grid-column: span 2;">Ph: ${m.phone}</div>` : ''}
          </div>
        </div>
      `;
    });

    const pastoralNotesHtml =
      includeNotes && family.generalNotes
        ? `
        <div style="margin-top: 8px; padding: 6px 10px; border-radius: 8px; ${isColour
          ? 'background: #fffbeb; border: 1px solid #fde68a; color: #78350f;'
          : 'background: #ffffff; border: 1px solid #cbd5e1;'
        }">
          <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 2px;">
            Pastoral &amp; Administration Remarks
          </div>
          <div style="font-size: 9.5px; line-height: 1.35; white-space: pre-wrap;">
            ${family.generalNotes.trim()}
          </div>
        </div>
      `
        : '';

    // Write complete self-contained printable document
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${parishName} - Household Details - ${family.familyCode || '#' + family.id}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 210mm;
              height: 297mm;
              background: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 11px;
              line-height: 1.35;
            }
            .dossier-wrapper {
              width: 210mm;
              height: 297mm;
              max-height: 297mm;
              padding: 10mm 12mm 10mm 12mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
              break-inside: avoid;
              overflow: hidden;
            }
            .header-banner {
              padding-bottom: 8px;
              border-bottom: 2px solid ${isColour ? '#1b4332' : '#000000'};
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .crest-box {
              width: 40px;
              height: 40px;
              border-radius: 8px;
              background: ${isColour ? '#1b4332' : '#000000'};
              border: 1px solid ${isColour ? '#c69214' : '#000000'};
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 22px;
            }
            .header-title h1 {
              margin: 0;
              font-size: 15px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.01em;
              color: ${isColour ? '#1b4332' : '#000000'};
              line-height: 1.2;
            }
            .header-title p {
              margin: 2px 0 0 0;
              font-size: 9.5px;
              color: #475569;
              font-weight: 500;
            }
            .header-meta {
              text-align: right;
            }
            .code-badge {
              font-family: monospace;
              font-weight: 800;
              font-size: 13px;
              padding: 3px 8px;
              border-radius: 6px;
              display: inline-block;
              ${codeBadgeStyle}
            }
            .summary-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-top: 10px;
            }
            .summary-box {
              padding: 8px 10px;
              border-radius: 8px;
              ${cardBoxStyle}
            }
            .summary-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 4px;
              border-bottom: 1px dashed #cbd5e1;
              margin-bottom: 6px;
            }
            .summary-title {
              font-size: 8.5px;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.05em;
            }
            .roots-box {
              margin-top: 8px;
              padding: 6px 10px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 9.5px;
              ${rootsBoxStyle}
            }
            .roster-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 10px;
              margin-bottom: 6px;
              padding-bottom: 3px;
              border-bottom: 1px solid #e2e8f0;
            }
            .roster-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
            }
            .footer-section {
              padding-top: 10px;
              border-top: 1px solid #cbd5e1;
              margin-top: 12px;
            }
            .sig-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              padding-top: 4px;
            }
            .seal-box {
              width: 80px;
              height: 56px;
              border: 1px dashed #94a3b8;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8.5px;
              color: #94a3b8;
            }
            .bottom-bar {
              margin-top: 8px;
              padding-top: 6px;
              border-top: 1px solid #f1f5f9;
              display: flex;
              justify-content: space-between;
              font-size: 8.5px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="dossier-wrapper">
            <div>
              <!-- 1. Header Banner -->
              <div class="header-banner">
                <div class="header-left">
                  <img src="${CLIENT_BRANDING.logoUrl}" alt="${CLIENT_BRANDING.logoAlt}" style="height: 38px; width: auto; object-fit: contain;" onerror="this.style.display='none'; document.getElementById('fallback-crest').style.display='flex';" />
                  <div id="fallback-crest" class="crest-box" style="display: none;">&#9877;</div>
                  <div class="header-title">
                    <h1>${parishName}</h1>
                    <p>Parish Code: <strong>${parishCode}</strong></p>
                    <p style="font-size: 8.5px; color: #64748b;">${[parishCity, activeParish?.state].filter(Boolean).join(', ')} &bull; Official Household Registration Record</p>
                  </div>
                </div>
                <div class="header-meta">
                  <div class="code-badge">${family.familyCode || '#' + family.id}</div>
                  <div style="font-size: 9px; color: #64748b; margin-top: 3px;">Date: ${headerDate}</div>
                </div>
              </div>

              <!-- 2. Household & Address Grid -->
              <div class="summary-grid">
                <div class="summary-box">
                  <div class="summary-header">
                    <span class="summary-title">Household Identity</span>
                    <span style="font-size: 8.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px; ${statusBadgeStyle}">
                      ${family.status}
                    </span>
                  </div>
                  <div style="font-size: 13px; font-weight: 800; color: #020617;">
                    ${family.houseName} <span style="font-size: 10px; font-weight: normal; color: #64748b;">(Veettuperu)</span>
                  </div>
                  <div style="font-size: 10px; color: #334155; margin-top: 3px;">
                    Registration: <strong>${family.registrationType}</strong>
                  </div>
                  <div style="font-size: 10px; color: #334155; margin-top: 1px;">
                    Ward Allocation: <strong style="color: ${isColour ? '#1b4332' : '#000000'};">${family.unit ? `${family.unit.unitName} Ward` : 'Unassigned'}</strong>
                  </div>
                </div>

                <div class="summary-box">
                  <div class="summary-header">
                    <span class="summary-title">Address &amp; Contact</span>
                    <span style="font-size: 9px; color: #64748b;">&#8962;</span>
                  </div>
                  <div style="font-size: 11px; font-weight: 700; color: #020617;">
                    ${family.streetAddress || 'Address not registered'}
                  </div>
                  <div style="font-size: 10px; color: #334155; margin-top: 2px;">
                    ${[family.city, formatState(family.state), family.postalCode].filter(Boolean).join(' ')}
                  </div>
                  <div style="font-size: 9.5px; color: #475569; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 8px;">
                    ${family.primaryPhone ? `<span>&#128222; <strong>${family.primaryPhone}</strong></span>` : ''}
                    ${family.primaryEmail ? `<span>&#9993; ${family.primaryEmail}</span>` : ''}
                  </div>
                </div>
              </div>

              <!-- 3. Roots in India -->
              <div class="roots-box">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 12px;">&#9877;</span>
                  <strong style="font-size: 10px;">Roots in India:</strong>
                </div>
                <div style="display: flex; gap: 16px;">
                  <div><span style="color: #64748b;">Origin Diocese:</span> <strong>${family.originDiocese || 'Not recorded'}</strong></div>
                  <div><span style="color: #64748b;">Origin Parish:</span> <strong>${family.originParish || 'Not recorded'}</strong></div>
                  <div><span style="color: #64748b;">Rite:</span> <strong>Syro-Malabar</strong></div>
                </div>
              </div>

              <!-- 4. Family Members Roster -->
              <div class="roster-header">
                <span style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #334155; letter-spacing: 0.05em;">
                  Family Members Register (${uniqueMembers.length} Total)
                </span>
                <span style="font-size: 8.5px; color: #64748b;">Ordered by household hierarchy</span>
              </div>

              <div class="roster-grid">
                ${membersHtml}
              </div>

              ${pastoralNotesHtml}
            </div>

            <!-- 5. Verification & Signature Strip (Sticks neatly to bottom of single A4 sheet) -->
            <div class="footer-section">
              <div class="sig-grid">
                <div>
                  <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 52px;">
                    Parish Priest Signature
                  </div>
                  <div style="border-bottom: 1px solid #64748b; width: 200px;"></div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
                    Official Parish Seal
                  </div>
                  <div class="seal-box">[ STAMP ]</div>
                </div>
              </div>

              <div class="bottom-bar">
                <span>Official Record &bull; ${parishName} &bull; Strictly Confidential</span>
                <span>Printed by: <strong>${preparedBy}</strong> on ${printTimestamp}</span>
              </div>
            </div>
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

  // Keyboard shortcut Ctrl+P / Cmd+P interception while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleTriggerPrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleTriggerPrint]);

  if (!family) return null;

  const isColour = printTheme === 'COLOUR';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Family Details"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="p-3 bg-parish-surface-subtle border border-parish-border rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-parish-text">Print Format:</span>
            <div className="inline-flex rounded-lg border border-parish-border p-0.5 bg-white shadow-xs">
              <button
                type="button"
                onClick={() => setPrintTheme('COLOUR')}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${isColour
                  ? 'bg-parish-primary text-white shadow-xs'
                  : 'text-parish-text-muted hover:text-parish-text'
                  }`}
              >
                🎨 Formatted (Colour)
              </button>
              <button
                type="button"
                onClick={() => setPrintTheme('FLAT')}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${!isColour
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-parish-text-muted hover:text-parish-text'
                  }`}
              >
                🖨️ Flat (B&W Ink-Saver)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {family.generalNotes && (
              <label className="flex items-center gap-1.5 cursor-pointer text-parish-text font-medium select-none">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="rounded border-parish-border text-parish-primary focus:ring-parish-primary w-3.5 h-3.5"
                />
                <span>Include Pastoral Remarks</span>
              </label>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerPrint}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Clean Scrollable A4 Document Frame Container */}
        <div className="bg-slate-200/70 p-2 sm:p-6 rounded-2xl overflow-x-auto border border-slate-300 preview-scroll-container touch-pan-x shadow-inner">
          {/* The Actual A4 Sheet Preview */}
          <div
            id="printable-family-dossier"
            className={`w-[210mm] min-w-[760px] min-h-[297mm] mx-auto p-[8mm] sm:p-[12mm] bg-white text-slate-900 shadow-xl transition-all duration-150 flex flex-col justify-between shrink-0 ${isColour ? 'font-sans' : 'font-sans text-black'
              }`}
            style={{
              boxSizing: 'border-box',
            }}
          >
            <div className="space-y-4">
              {/* 1. Official Parish Letterhead Banner */}
              <div
                className={`pb-3 border-b flex items-center justify-between gap-4 ${isColour ? 'border-[#1b4332]' : 'border-black'
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
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isColour
                      ? 'bg-[#1b4332] text-[#fbf9f4] border-[#c69214]'
                      : 'bg-black text-white border-black'
                      }`}
                  >
                    <Church className="w-5 h-5" />
                  </div>
                  <div>
                    <h1
                      className={`text-lg font-extrabold tracking-tight uppercase leading-tight ${isColour ? 'text-[#1b4332]' : 'text-black'
                        }`}
                    >
                      {activeParish?.parishName || 'St. Alphonsa Syro-Malabar Parish'}
                    </h1>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Parish Code: <strong>{activeParish?.parishCode || 'SABN'}</strong>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {[activeParish?.city, activeParish?.state].filter(Boolean).join(', ') || 'Brisbane'} • Official Household Registration Record
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono font-extrabold text-sm px-3 py-1 rounded-lg border inline-block ${isColour
                      ? 'bg-[#e8f3ed] text-[#1b4332] border-emerald-300'
                      : 'bg-white text-black border-black'
                      }`}
                  >
                    {family.familyCode || `#${family.id}`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Date: {new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* 2. Top Summary Boxes (2-Column Grid) */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Box A: Household Identity */}
                <div
                  className={`p-3 rounded-xl border ${isColour
                    ? 'bg-[#fbf9f4] border-slate-200'
                    : 'bg-white border-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-slate-300">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Household Identity
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isColour
                        ? family.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'border-black text-black'
                        }`}
                    >
                      {family.status}
                    </span>
                  </div>

                  <div className="pt-2 space-y-1">
                    <div className="text-sm font-extrabold text-slate-900">
                      {family.houseName}{' '}
                      <span className="text-xs font-normal text-slate-600">(Veettuperu)</span>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      Registration: <strong>{family.registrationType}</strong>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      Ward Allocation:{' '}
                      <strong className={isColour ? 'text-[#1b4332]' : 'text-black'}>
                        {family.unit ? `${family.unit.unitName} Ward` : 'Unassigned'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Box B: Address & Contact */}
                <div
                  className={`p-3 rounded-xl border ${isColour
                    ? 'bg-[#fbf9f4] border-slate-200'
                    : 'bg-white border-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-slate-300">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Address & Contact
                    </span>
                    <Home className="w-3.5 h-3.5 text-slate-500" />
                  </div>

                  <div className="pt-2 space-y-1 text-[11px]">
                    <div className="font-bold text-slate-900">
                      {family.streetAddress || 'Address not registered'}
                    </div>
                    <div className="text-slate-700">
                      {family.city && `${family.city}, `}
                      {formatState(family.state)} {family.postalCode || ''}
                    </div>
                    <div className="text-slate-600 flex flex-wrap gap-x-3 pt-0.5">
                      {family.primaryPhone && (
                        <span>📞 <strong>{family.primaryPhone}</strong></span>
                      )}
                      {family.primaryEmail && (
                        <span>✉️ {family.primaryEmail}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Box C: Ecclesial Roots in India */}
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-4 ${isColour
                  ? 'bg-amber-50/40 border-amber-200/60 text-amber-950'
                  : 'bg-white border-slate-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Church className={`w-4 h-4 shrink-0 ${isColour ? 'text-[#c69214]' : 'text-black'}`} />
                  <span className="font-bold text-[11px]">Roots in India:</span>
                </div>
                <div className="flex items-center gap-6 text-[11px]">
                  <div>
                    <span className="text-slate-500">Origin Diocese:</span>{' '}
                    <strong>{family.originDiocese || 'Not recorded'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Origin Parish:</span>{' '}
                    <strong>{family.originParish || 'Not recorded'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Rite:</span> <strong>Syro-Malabar</strong>
                  </div>
                </div>
              </div>

              {/* 4. Family Members Modular Cards Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Family Members ({uniqueMembers.length} Total)
                  </span>
                  <span className="text-[10px] text-slate-500">Ordered by household hierarchy</span>
                </div>

                {/* 2-Column Responsive Card Grid for Members */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Head Card */}
                  {headMember && (
                    <div
                      className={`p-3 rounded-xl border space-y-1.5 ${isColour
                        ? 'bg-[#e8f3ed]/60 border-emerald-300'
                        : 'bg-white border-black'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border inline-block ${isColour
                              ? 'bg-[#1b4332] text-white border-[#1b4332]'
                              : 'bg-black text-white border-black'
                              }`}
                          >
                            Head of Family
                          </span>
                          <h3 className="font-extrabold text-xs text-slate-950 mt-1">
                            {headMember.fullName}
                          </h3>
                        </div>
                        {headMember.isPrimaryContact && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isColour ? 'bg-emerald-200 text-emerald-950' : 'border border-black'
                              }`}
                          >
                            Primary Contact
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-700 pt-1 border-t border-slate-200">
                        <div>
                          DOB: {headMember.dateOfBirth ? new Date(headMember.dateOfBirth).toLocaleDateString('en-AU') : 'N/A'}
                          {calculateAge(headMember.dateOfBirth) !== null && ` (${calculateAge(headMember.dateOfBirth)} yrs)`}
                        </div>
                        <div>POB: {headMember.placeOfBirth || 'N/A'}</div>
                        {headMember.phone && <div className="col-span-2">Ph: {headMember.phone}</div>}
                        {headMember.email && <div className="col-span-2 text-slate-500">{headMember.email}</div>}
                      </div>
                    </div>
                  )}

                  {/* Spouse Card */}
                  {spouseMember && (
                    <div
                      className={`p-3 rounded-xl border space-y-1.5 ${isColour
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-white border-slate-300'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border inline-block ${isColour
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : 'border-black text-black'
                              }`}
                          >
                            Spouse
                          </span>
                          <h3 className="font-extrabold text-xs text-slate-950 mt-1">
                            {spouseMember.fullName}
                          </h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-700 pt-1 border-t border-slate-200">
                        <div>
                          DOB: {spouseMember.dateOfBirth ? new Date(spouseMember.dateOfBirth).toLocaleDateString('en-AU') : 'N/A'}
                          {calculateAge(spouseMember.dateOfBirth) !== null && ` (${calculateAge(spouseMember.dateOfBirth)} yrs)`}
                        </div>
                        <div>POB: {spouseMember.placeOfBirth || 'N/A'}</div>
                        {spouseMember.phone && <div className="col-span-2">Ph: {spouseMember.phone}</div>}
                        {spouseMember.email && <div className="col-span-2 text-slate-500">{spouseMember.email}</div>}
                      </div>
                    </div>
                  )}

                  {/* Children & Other Dependents */}
                  {otherMembers.map((m) => {
                    const age = calculateAge(m.dateOfBirth);
                    return (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-xl border space-y-1 ${isColour
                          ? 'bg-sky-50/60 border-sky-200'
                          : 'bg-white border-slate-300'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-bold text-xs text-slate-900">{m.fullName}</h4>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${isColour
                              ? 'bg-sky-100 text-sky-900 border-sky-300'
                              : 'border-black text-black'
                              }`}
                          >
                            {m.role}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-600">
                          <div>
                            DOB: {m.dateOfBirth ? new Date(m.dateOfBirth).toLocaleDateString('en-AU') : 'N/A'}
                            {age !== null && ` (${age} yrs)`}
                          </div>
                          <div>POB: {m.placeOfBirth || 'N/A'}</div>
                          {m.phone && <div className="col-span-2">Ph: {m.phone}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Pastoral Notes Strip */}
              {includeNotes && family.generalNotes && (
                <div
                  className={`p-2.5 rounded-xl border text-xs space-y-1 ${isColour ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-white border-black'
                    }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                    Pastoral & Administration Notes
                  </span>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                    {family.generalNotes.trim()}
                  </p>
                </div>
              )}
            </div>

            {/* 5. Official Verification Strip & Footer (Locks to bottom of A4) */}
            <div className="pt-4 border-t border-slate-300 text-xs space-y-3">
              <div className="grid grid-cols-2 gap-8 pt-2">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-14">
                    Parish Priest Signature
                  </div>
                  <div className="border-b border-slate-400 w-52"></div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                    Official Parish Seal
                  </div>
                  <div className="w-20 h-16 border border-dashed border-slate-400 rounded-lg flex items-center justify-center text-[9px] text-slate-400">
                    [ STAMP ]
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-100 pt-2">
                <span>
                  Official Record • {activeParish?.parishName || 'St. Alphonsa Syro-Malabar Parish Brisbane'} • Strictly Confidential
                </span>
                <span>
                  Printed by: <strong className="text-slate-700 font-semibold">{preparedBy}</strong> on {screenTimestamp}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
