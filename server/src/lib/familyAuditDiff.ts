export interface MemberDiffInput {
  id?: number | string | null;
  fullName: string;
  role?: string;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | Date | null;
  placeOfBirth?: string | null;
}

export interface FamilyDiffInput {
  houseName?: string | null;
  unitId?: number | string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  originParish?: string | null;
  originDiocese?: string | null;
  registrationType?: string | null;
  status?: string | null;
  generalNotes?: string | null;
  members?: MemberDiffInput[];
}

export interface ExistingFamilyWithMembers {
  id: number;
  houseName: string;
  unitId: number | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  originParish: string | null;
  originDiocese: string | null;
  registrationType: string;
  status: string;
  generalNotes: string | null;
  unit?: { id: number; unitName?: string; name?: string } | null;
  members: Array<{
    id: number;
    fullName: string;
    role: string;
    phone: string | null;
    email: string | null;
    dateOfBirth: Date | null;
    placeOfBirth: string | null;
  }>;
}

/**
 * Normalizes string values for comparison:
 * null, undefined, and empty/whitespace strings are all treated as null.
 */
function cleanStr(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

/**
 * Safely truncates a value for display in the audit trail.
 * Max length: 35 characters.
 */
function truncateVal(val: string | null): string {
  if (!val) return 'None';
  if (val.length > 35) {
    return val.substring(0, 32) + '...';
  }
  return val;
}

/**
 * Formats date to YYYY-MM-DD for comparison.
 */
function toDateStr(val: any): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Compares old and new household & member state and generates a concise,
 * human-readable summary of the exact fields changed.
 *
 * Best practices enforced:
 * 1. Zero full-body dumps: Long text fields like pastoral notes only log that they were updated.
 * 2. Capped length: If > 4 fields changed, summarizes remaining changes to prevent audit log bloat.
 * 3. Human-friendly captions instead of database column names.
 */
export function generateFamilyAuditDiff(
  existing: ExistingFamilyWithMembers,
  updated: FamilyDiffInput,
  wardNameLookup?: Map<number, string> | Record<number, string>,
  userFullName?: string | null
): string {
  const changes: string[] = [];
  const actor = userFullName?.trim() || 'User';

  // 1. Primary Household Fields Comparison
  const checkField = (
    caption: string,
    oldVal: string | null | undefined,
    newVal: string | null | undefined,
    sensitiveOrLong: boolean = false
  ) => {
    const oldC = cleanStr(oldVal);
    const newC = cleanStr(newVal);

    if (oldC !== newC) {
      if (sensitiveOrLong) {
        changes.push(`${caption} updated`);
      } else if (!oldC && newC) {
        changes.push(`${caption} set to '${truncateVal(newC)}'`);
      } else if (oldC && !newC) {
        changes.push(`${caption} removed`);
      } else {
        changes.push(`${caption} changed from '${truncateVal(oldC)}' to '${truncateVal(newC)}'`);
      }
    }
  };

  checkField('House Name', existing.houseName, updated.houseName);
  checkField('Primary Mobile', existing.primaryPhone, updated.primaryPhone);
  checkField('Primary Email', existing.primaryEmail, updated.primaryEmail);
  checkField('Street Address', existing.streetAddress, updated.streetAddress);
  checkField('City / Suburb', existing.city, updated.city);
  checkField('State', existing.state, updated.state);
  checkField('Postcode', existing.postalCode, updated.postalCode);
  checkField('Home Parish (Kerala)', existing.originParish, updated.originParish);
  checkField('Origin Diocese', existing.originDiocese, updated.originDiocese);

  // Status & Registration Type
  if (updated.status && updated.status !== existing.status) {
    changes.push(`Status changed from '${existing.status}' to '${updated.status}'`);
  }
  if (updated.registrationType && updated.registrationType !== existing.registrationType) {
    changes.push(`Registration Type changed from '${existing.registrationType}' to '${updated.registrationType}'`);
  }

  // Ward / Unit Comparison
  const oldUnitId = existing.unitId;
  const newUnitId =
    updated.unitId === null || updated.unitId === undefined || updated.unitId === 'UNASSIGNED' || updated.unitId === ''
      ? null
      : Number(updated.unitId);

  if (oldUnitId !== newUnitId) {
    const getWardName = (uid: number | null): string => {
      if (!uid) return 'Unassigned';
      if (wardNameLookup instanceof Map) {
        return wardNameLookup.get(uid) || `Unit #${uid}`;
      }
      if (wardNameLookup && typeof wardNameLookup === 'object') {
        return (wardNameLookup as Record<number, string>)[uid] || `Unit #${uid}`;
      }
      if (existing.unit && existing.unit.id === uid) {
        return existing.unit.unitName || existing.unit.name || `Unit #${uid}`;
      }
      return `Unit #${uid}`;
    };

    const oldWard = getWardName(oldUnitId);
    const newWard = getWardName(newUnitId);
    changes.push(`Family Unit / Ward changed from '${oldWard}' to '${newWard}'`);
  }

  // Pastoral & General Notes: NEVER dump the full text body!
  if (updated.generalNotes !== undefined) {
    const oldNotes = cleanStr(existing.generalNotes);
    const newNotes = cleanStr(updated.generalNotes);
    if (oldNotes !== newNotes) {
      changes.push('Pastoral & Household Notes updated');
    }
  }

  // 2. Family Members Comparison
  if (Array.isArray(updated.members)) {
    const existingMembers = existing.members || [];
    const incomingIds = new Set(
      updated.members.filter((m) => m.id !== undefined && m.id !== null && m.id !== '').map((m) => Number(m.id))
    );

    // Removed members
    for (const oldM of existingMembers) {
      if (!incomingIds.has(oldM.id)) {
        changes.push(`Removed member: ${oldM.fullName || 'Member'} (${oldM.role})`);
      }
    }

    // Added or Updated members
    for (const newM of updated.members) {
      const parsedId = newM.id ? Number(newM.id) : null;
      if (!parsedId) {
        // Newly added member
        changes.push(`Added member: ${newM.fullName || 'New Member'} (${newM.role || 'Member'})`);
      } else {
        const oldM = existingMembers.find((m) => m.id === parsedId);
        if (oldM) {
          const mLabel = cleanStr(newM.fullName) || cleanStr(oldM.fullName) || 'Member';

          // Phone
          const oldPhone = cleanStr(oldM.phone);
          const newPhone = cleanStr(newM.phone);
          if (oldPhone !== newPhone) {
            if (!oldPhone && newPhone) {
              changes.push(`${mLabel} Mobile set to '${truncateVal(newPhone)}'`);
            } else if (oldPhone && !newPhone) {
              changes.push(`${mLabel} Mobile removed`);
            } else {
              changes.push(`${mLabel} Mobile changed from '${truncateVal(oldPhone)}' to '${truncateVal(newPhone)}'`);
            }
          }

          // Email
          const oldEmail = cleanStr(oldM.email);
          const newEmail = cleanStr(newM.email);
          if (oldEmail !== newEmail) {
            if (!oldEmail && newEmail) {
              changes.push(`${mLabel} Email set to '${truncateVal(newEmail)}'`);
            } else if (oldEmail && !newEmail) {
              changes.push(`${mLabel} Email removed`);
            } else {
              changes.push(`${mLabel} Email changed from '${truncateVal(oldEmail)}' to '${truncateVal(newEmail)}'`);
            }
          }

          // Name
          const oldName = cleanStr(oldM.fullName);
          const newName = cleanStr(newM.fullName);
          if (oldName && newName && oldName !== newName) {
            changes.push(`Member name '${oldName}' changed to '${newName}'`);
          }

          // Role
          const oldRole = cleanStr(oldM.role);
          const newRole = cleanStr(newM.role);
          if (oldRole && newRole && oldRole !== newRole) {
            changes.push(`${mLabel} Role changed to '${newRole}'`);
          }

          // DOB
          const oldDob = toDateStr(oldM.dateOfBirth);
          const newDob = toDateStr(newM.dateOfBirth);
          if (oldDob !== newDob) {
            changes.push(`${mLabel} Date of Birth updated`);
          }

          // Place of birth
          const oldPob = cleanStr(oldM.placeOfBirth);
          const newPob = cleanStr(newM.placeOfBirth);
          if (oldPob !== newPob) {
            changes.push(`${mLabel} Place of Birth updated`);
          }
        }
      }
    }
  }

  // 3. Assemble Output with Safeguards
  if (changes.length === 0) {
    return `Household details verified by ${actor} (no changes recorded).`;
  }

  // If 4 or fewer changes, list all of them
  if (changes.length <= 4) {
    return `Household updated by ${actor}: ${changes.join('; ')}.`;
  }

  // If more than 4 changes, list top 4 + summary count to prevent giant notes
  const top4 = changes.slice(0, 4).join('; ');
  const remaining = changes.length - 4;
  return `Household updated by ${actor}: ${top4}; and ${remaining} other fields.`;
}
