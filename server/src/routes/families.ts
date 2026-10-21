import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { FamilyStatus, RegistrationType, MemberRole, UserRole, Prisma } from '@prisma/client';
import { canUserApproveRegistration, getUserDirectDebitPermissions } from './permissions.js';

export const familiesRouter = Router();

// Apply auth to all family endpoints
familiesRouter.use(authenticateJWT);

// GET /api/families - List with search, filtering, and pagination
familiesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const {
      search,
      unitId,
      status,
      type,
      directDebit,
      page = '1',
      limit = '20',
      sortBy = 'headOfFamily',
      sortOrder = 'asc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * pageSize;

    // Build Prisma where filter with multi-criteria support
    const andConditions: Prisma.FamilyWhereInput[] = [];

    // Ward isolation: Ward Users can only see families in their assigned ward
    if (req.user && req.user.role === UserRole.WARD_USER) {
      if (!req.user.assignedUnitId) {
        return res.json({
          data: [],
          pagination: { page: pageNum, limit: pageSize, total: 0, totalPages: 0 },
        });
      }
      andConditions.push({ unitId: req.user.assignedUnitId });
    } else if (unitId) {
      const uStr = (unitId as string).trim().toUpperCase();
      if (uStr === 'UNASSIGNED' || uStr === 'NONE' || uStr === 'NULL' || uStr === 'BLANK') {
        andConditions.push({ unitId: null });
      } else {
        const parsedId = parseInt(unitId as string, 10);
        if (!isNaN(parsedId)) {
          andConditions.push({ unitId: parsedId });
        }
      }
    }

    const searchStr = search && typeof search === 'string' ? search.trim() : '';

    // Check if query is an explicit reference or identifier lookup (e.g. "#571", "ref no. #571", "ref #571", pure digits "571")
    const isExplicitRefLookup = Boolean(
      searchStr && (
        /^#\s*\w+/i.test(searchStr) ||
        /^(?:ref(?:erence)?|no\.?|num(?:ber)?|household|id|code)\s*#?\s*\w+/i.test(searchStr) ||
        /^\d{1,6}$/.test(searchStr)
      )
    );

    // If status filter is passed, apply it — unless the user specifically searched an exact reference ID/code (#571)
    // where they want to locate that specific household regardless of its current lifecycle state (PENDING, ACTIVE, etc.).
    if (status && !isExplicitRefLookup) {
      andConditions.push({ status: status as FamilyStatus });
    }

    if (type) {
      andConditions.push({ registrationType: type as RegistrationType });
    }

    if (directDebit) {
      const dd = (directDebit as string).trim().toUpperCase();
      if (dd === 'YES' || dd === 'TRUE' || dd === '1' || dd === 'PLEDGED') {
        andConditions.push({
          directDebit: {
            is: { active: true },
          },
        });
      } else if (dd === 'NO' || dd === 'FALSE' || dd === '0') {
        andConditions.push({
          OR: [
            { directDebit: { is: null } },
            { directDebit: { is: { active: false } } },
          ],
        });
      }
    }

    if (searchStr) {
      const q = searchStr;
      const lower = q.toLowerCase();
      const isUnassignedQuery =
        lower.includes('unasign') ||
        lower.includes('unassign') ||
        lower.includes('no ward') ||
        lower === 'null' ||
        lower === 'blank';
      const isNilQuery = lower === 'nil';

      // Cleaned reference code/number (strips leading prefixes like "ref no. #", "ref #", "ref:", "#", "id #", "household #")
      const cleanedRef = q
        .replace(/^(?:ref(?:erence)?|no\.?|num(?:ber)?|household|code|id|#|:|\s)+/gi, '')
        .trim();

      const searchOr: Prisma.FamilyWhereInput[] = [
        { headFullName: { contains: q, mode: 'insensitive' } },
        { houseName: { contains: q, mode: 'insensitive' } },
        { familyCode: { contains: q, mode: 'insensitive' } },
        { streetAddress: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { postalCode: { contains: q, mode: 'insensitive' } },
        { primaryPhone: { contains: q, mode: 'insensitive' } },
        { primaryEmail: { contains: q, mode: 'insensitive' } },
        {
          members: {
            some: {
              fullName: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];

      // If query had a "#" or "ref" prefix, also search cleanedRef against familyCode
      if (cleanedRef && cleanedRef !== q) {
        searchOr.push({ familyCode: { contains: cleanedRef, mode: 'insensitive' } });
      }

      // Check for numeric ID match (e.g. 571, #571, ref no. #571)
      const candidateDigits = /^\d+$/.test(cleanedRef)
        ? cleanedRef
        : /^\d+$/.test(q)
        ? q
        : (q.match(/\b\d+\b/)?.[0] || '');

      // Avoid treating phone numbers with leading 0 as database IDs
      if (candidateDigits && !candidateDigits.startsWith('0') && candidateDigits.length <= 9) {
        const parsedId = parseInt(candidateDigits, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
          searchOr.push({ id: parsedId });
        }
      }

      // If user typed "unasigned" / "unassigned" / "null" / "no ward", match records without any ward (unitId: null)
      if (isUnassignedQuery) {
        searchOr.push({ unitId: null });
      }

      // If user typed "nil", match the unit named "Nil"
      if (isNilQuery) {
        searchOr.push({ unit: { unitName: { equals: 'Nil', mode: 'insensitive' } } });
      }

      andConditions.push({ OR: searchOr });
    }

    const where: Prisma.FamilyWhereInput = {
      parishId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    // Determine sorting - Default: Always alphabetical by Head of Family
    const orderBy: any = {};
    if (sortBy === 'familyCode') {
      orderBy.familyCode = sortOrder === 'desc' ? 'desc' : 'asc';
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'desc' ? 'desc' : 'asc';
    } else if (sortBy === 'houseName') {
      orderBy.houseName = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.headFullName = sortOrder === 'desc' ? 'desc' : 'asc';
    }

    const [families, totalCount] = await Promise.all([
      prisma.family.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          unit: {
            select: { id: true, unitName: true, category: true },
          },
          members: {
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              role: true,
              fullName: true,
              dateOfBirth: true,
              phone: true,
              email: true,
            },
          },
          _count: {
            select: {
              members: true,
              documents: true,
            },
          },
          directDebit: {
            select: { id: true, active: true },
          },
        },
      }),
      prisma.family.count({ where }),
    ]);

    const ddPerms = req.user
      ? await getUserDirectDebitPermissions(req.user.userId, req.user.role, parishId)
      : { canView: false, canEdit: false };

    return res.json({
      data: families.map((f) => ({
        id: f.id,
        familyCode: f.familyCode,
        registrationType: f.registrationType,
        houseName: f.houseName,
        unit: f.unit,
        streetAddress: f.streetAddress,
        city: f.city,
        state: f.state,
        postalCode: f.postalCode,
        primaryPhone: f.primaryPhone,
        primaryEmail: f.primaryEmail,
        originParish: f.originParish,
        originDiocese: f.originDiocese,
        status: f.status,
        headOfFamily: f.members.find((m) => m.role === MemberRole.HEAD) || f.members[0] || null,
        membersCount: f._count.members,
        documentsCount: f._count.documents,
        registrationDate: f.registrationDate,
        hasDirectDebit: ddPerms.canView ? !!(f.directDebit && f.directDebit.active) : false,
      })),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (err: any) {
    console.error('Error fetching families:', err);
    return res.status(500).json({ error: 'Failed to fetch family directory' });
  }
});

// GET /api/families/meta/pending-count - Pending registrations count
familiesRouter.get('/meta/pending-count', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const count = await prisma.family.count({
      where: {
        parishId,
        status: FamilyStatus.PENDING,
      },
    });
    return res.json({ count });
  } catch (err: any) {
    console.error('Error fetching pending count:', err);
    return res.status(500).json({ error: 'Failed to fetch pending count.' });
  }
});

// GET /api/families/:id - Detailed profile view
familiesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;

    const family = await prisma.family.findFirst({
      where: {
        id: familyId,
        parishId, // Tenant isolation check
      },
      include: {
        unit: true,
        members: {
          orderBy: { orderIndex: 'asc' },
          include: {
            history: {
              orderBy: { startDate: 'desc' },
            },
          },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        notes: {
          orderBy: { noteDate: 'desc' },
        },
        directDebit: true,
        mergedIntoFamily: {
          select: { id: true, familyCode: true, houseName: true },
        },
      },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    // Ward isolation: Ward Users can only see families in their assigned ward
    if (req.user && req.user.role === UserRole.WARD_USER) {
      if (!family.unitId || family.unitId !== req.user.assignedUnitId) {
        return res.status(403).json({ error: 'Access denied: You can only view families in your assigned ward.' });
      }
    }

    // Direct Debit privacy: Check role & custom overrides via getUserDirectDebitPermissions
    const ddPerms = req.user
      ? await getUserDirectDebitPermissions(req.user.userId, req.user.role, parishId)
      : { canView: false, canEdit: false };

    if (!ddPerms.canView) {
      (family as any).directDebit = null;
    }

    // Audit Trail visibility & confidentiality:
    // Standard users (PARISH_USER, WARD_USER) cannot view the Record History & Audit Trail
    const isStandardUser = req.user && (req.user.role === UserRole.PARISH_USER || req.user.role === UserRole.WARD_USER);
    if (isStandardUser) {
      (family as any).notes = [];
    } else if (!ddPerms.canView && (family as any).notes) {
      // If user can view audit notes but cannot view Direct Debit, filter out any confidential Direct Debit audit notes
      (family as any).notes = (family as any).notes.filter(
        (n: any) => !n.noteContent.toLowerCase().includes('direct debit')
      );
    }

    return res.json({
      ...family,
      directDebitPermissions: ddPerms,
    });
  } catch (err: any) {
    console.error('Error fetching family details:', err);
    return res.status(500).json({ error: 'Failed to fetch family details' });
  }
});

// PATCH /api/families/:id - Update family details (Ward assignment, status, notes, address)
familiesRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;

    if (isNaN(familyId)) {
      return res.status(400).json({ error: 'Invalid family ID.' });
    }

    const existing = await prisma.family.findFirst({
      where: { id: familyId, parishId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    // Ward User permission check: Ward Users can only update their own ward's families
    if (req.user && req.user.role === UserRole.WARD_USER) {
      if (!existing.unitId || existing.unitId !== req.user.assignedUnitId) {
        return res.status(403).json({ error: 'Access denied: You can only edit families in your assigned ward.' });
      }
    }

    const {
      unitId,
      status,
      registrationType,
      streetAddress,
      city,
      state,
      postalCode,
      primaryPhone,
      primaryEmail,
      originParish,
      originDiocese,
      generalNotes,
      assignFamilyCode,
    } = req.body;

    const dataToUpdate: Prisma.FamilyUpdateInput = {};

    // 1. Ward Assignment (supports unassigning to null, or connecting to a valid ward)
    if (unitId !== undefined) {
      if (unitId === null || unitId === '' || unitId === 'NONE' || unitId === 'UNASSIGNED') {
        dataToUpdate.unit = { disconnect: true };
      } else {
        const parsedUnitId = parseInt(unitId as string, 10);
        if (!isNaN(parsedUnitId)) {
          const unitExists = await prisma.familyUnit.findFirst({
            where: { id: parsedUnitId, parishId },
          });
          if (unitExists) {
            dataToUpdate.unit = { connect: { id: parsedUnitId } };
          }
        }
      }
    }

    // 2. Status
    if (status && Object.values(FamilyStatus).includes(status)) {
      dataToUpdate.status = status;
    }

    // 3. Registration Type
    if (registrationType && Object.values(RegistrationType).includes(registrationType)) {
      dataToUpdate.registrationType = registrationType;
    }

    // 4. Contact / Address / Roots
    if (streetAddress !== undefined) dataToUpdate.streetAddress = streetAddress ? streetAddress.trim() : null;
    if (city !== undefined) dataToUpdate.city = city ? city.trim() : null;
    if (state !== undefined) dataToUpdate.state = state ? state.trim() : null;
    if (postalCode !== undefined) dataToUpdate.postalCode = postalCode ? postalCode.trim() : null;
    if (primaryPhone !== undefined) dataToUpdate.primaryPhone = primaryPhone ? primaryPhone.trim() : null;
    if (primaryEmail !== undefined) dataToUpdate.primaryEmail = primaryEmail ? primaryEmail.trim() : null;
    if (originParish !== undefined) dataToUpdate.originParish = originParish ? originParish.trim() : null;
    if (originDiocese !== undefined) dataToUpdate.originDiocese = originDiocese ? originDiocese.trim() : null;
    if (generalNotes !== undefined) dataToUpdate.generalNotes = generalNotes ? generalNotes.trim() : null;

    // 5. Optional Auto-Allocation of Family Code if unassigned
    if (assignFamilyCode && !existing.familyCode) {
      const parish = await prisma.parish.findUnique({ where: { id: parishId } });
      if (parish) {
        dataToUpdate.familyCode = `${parish.idPrefix}${parish.nextFamilyNumber}`;
        await prisma.parish.update({
          where: { id: parishId },
          data: { nextFamilyNumber: { increment: 1 } },
        });
      }
    }

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: dataToUpdate,
      include: {
        unit: true,
        members: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return res.json(updated);
  } catch (err: any) {
    console.error('Error updating family:', err);
    return res.status(500).json({ error: 'Failed to update family record.' });
  }
});

// POST /api/families - Create new family or student registration with approval cycle
familiesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const user = req.user;
    const canApprove = user ? await canUserApproveRegistration(user.userId, user.role) : false;

    const {
      registrationType = RegistrationType.FAMILY,
      houseName,
      unitId,
      streetAddress,
      city,
      state,
      postalCode,
      primaryPhone,
      primaryEmail,
      originParish,
      originDiocese,
      members, // Array of members
      headFullName,
      generalNotes,
      status: requestedStatus,
      assignFamilyCode = true,
    } = req.body;

    // Resolve members list (allow explicit array or direct headFullName)
    let membersList = Array.isArray(members) ? members : [];
    if (membersList.length === 0 && (headFullName || req.body.headName)) {
      membersList = [
        {
          role: MemberRole.HEAD,
          fullName: (headFullName || req.body.headName).trim(),
          phone: primaryPhone || null,
          email: primaryEmail || null,
          dateOfBirth: req.body.headDob || null,
        },
      ];
    }

    if (!houseName || membersList.length === 0) {
      return res.status(400).json({ error: 'House name and head of family name are required.' });
    }

    // Resolve Ward / Unit (support unassigned / null / blank / 'UNASSIGNED')
    let resolvedUnitId: number | null = null;
    if (
      unitId !== undefined &&
      unitId !== null &&
      unitId !== '' &&
      unitId !== 'UNASSIGNED' &&
      unitId !== 'NONE' &&
      unitId !== 'NULL' &&
      unitId !== 'BLANK'
    ) {
      const parsed = parseInt(String(unitId), 10);
      if (!isNaN(parsed)) {
        const unitExists = await prisma.familyUnit.findFirst({
          where: { id: parsed, parishId },
        });
        if (unitExists) {
          resolvedUnitId = parsed;
        }
      }
    }

    // Approval Cycle logic:
    // If user has canApprove and specifically requests ACTIVE, activate immediately.
    // Otherwise, default to PENDING status awaiting review.
    const isApprovedImmediately = canApprove && requestedStatus === 'ACTIVE';
    const targetStatus = isApprovedImmediately ? FamilyStatus.ACTIVE : FamilyStatus.PENDING;

    // Generate unique family code using parish prefix & sequence ONLY if actively approved
    const parish = await prisma.parish.findUnique({ where: { id: parishId } });
    let generatedFamilyCode: string | null = null;
    if (parish && isApprovedImmediately && assignFamilyCode) {
      generatedFamilyCode = `${parish.idPrefix}${parish.nextFamilyNumber}`;
    }

    // Transactional creation
    const newFamily = await prisma.$transaction(async (tx) => {
      // 1. Increment parish sequence if code allocated
      if (parish && generatedFamilyCode) {
        await tx.parish.update({
          where: { id: parishId },
          data: { nextFamilyNumber: { increment: 1 } },
        });
      }

      // 2. Create family
      const headMember = membersList.find((m: any) => m.role === MemberRole.HEAD) || membersList[0];
      const headName = headMember?.fullName ? headMember.fullName.trim() : houseName;

      const createdFamily = await tx.family.create({
        data: {
          parishId,
          familyCode: generatedFamilyCode,
          registrationType,
          houseName: houseName.trim(),
          headFullName: headName,
          unitId: resolvedUnitId,
          streetAddress: streetAddress ? streetAddress.trim() : null,
          city: city ? city.trim() : null,
          state: state ? state.trim() : null,
          postalCode: postalCode ? postalCode.trim() : null,
          primaryPhone: primaryPhone ? primaryPhone.trim() : null,
          primaryEmail: primaryEmail ? primaryEmail.trim() : null,
          originParish: originParish ? originParish.trim() : null,
          originDiocese: originDiocese ? originDiocese.trim() : null,
          status: targetStatus,
          registrationDate: new Date(),
          generalNotes: generalNotes ? generalNotes.trim() : null,
        },
      });

      // 3. Create members
      for (let i = 0; i < membersList.length; i++) {
        const m = membersList[i];
        await tx.familyMember.create({
          data: {
            familyId: createdFamily.id,
            role: m.role || (i === 0 ? MemberRole.HEAD : MemberRole.CHILD),
            fullName: m.fullName.trim(),
            dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
            placeOfBirth: m.placeOfBirth ? m.placeOfBirth.trim() : null,
            phone: m.phone ? m.phone.trim() : null,
            email: m.email ? m.email.trim() : null,
            isPrimaryContact: m.role === MemberRole.HEAD || i === 0,
            orderIndex: i,
          },
        });
      }

      // 4. Record audit note
      await tx.familyNote.create({
        data: {
          familyId: createdFamily.id,
          noteDate: new Date(),
          noteContent: isApprovedImmediately
            ? `Registration created and immediately approved by ${user?.fullName || 'Administrator'}.`
            : `New registration submitted by ${user?.fullName || 'User'}, pending verification and approval by Parish Authority.`,
          recordedBy: user?.fullName || 'System',
        },
      });

      return createdFamily;
    });

    return res.status(201).json(newFamily);
  } catch (err: any) {
    console.error('Error creating family:', err);
    return res.status(500).json({ error: 'Failed to create family record.' });
  }
});

// PUT /api/families/:id - Full household & members update
familiesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;

    if (isNaN(familyId)) {
      return res.status(400).json({ error: 'Invalid family ID.' });
    }

    const existing = await prisma.family.findFirst({
      where: { id: familyId, parishId },
      include: { members: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    // Ward isolation check for WARD_USER
    if (user && user.role === UserRole.WARD_USER) {
      if (!existing.unitId || existing.unitId !== user.assignedUnitId) {
        return res.status(403).json({ error: 'Access denied: You can only edit families in your assigned ward.' });
      }
    }

    const canApprove = user ? await canUserApproveRegistration(user.userId, user.role) : false;

    const {
      registrationType = existing.registrationType,
      houseName = existing.houseName,
      unitId,
      streetAddress,
      city,
      state,
      postalCode,
      primaryPhone,
      primaryEmail,
      originParish,
      originDiocese,
      generalNotes,
      status,
      members = [],
    } = req.body;

    // Resolve Ward
    let resolvedUnitId: number | null = existing.unitId;
    if (unitId !== undefined) {
      if (unitId === null || unitId === '' || unitId === 'UNASSIGNED' || unitId === 'NONE' || unitId === 'NULL') {
        resolvedUnitId = null;
      } else {
        const parsed = parseInt(String(unitId), 10);
        if (!isNaN(parsed)) {
          const unitExists = await prisma.familyUnit.findFirst({ where: { id: parsed, parishId } });
          if (unitExists) resolvedUnitId = parsed;
        }
      }
    }

    // Status permission check
    let targetStatus = existing.status;
    if (status && Object.values(FamilyStatus).includes(status)) {
      if (status !== existing.status) {
        if (canApprove) {
          targetStatus = status;
        } else {
          return res.status(403).json({ error: 'Access denied: You do not have permission to change the registration status.' });
        }
      }
    }

    // Resolve head name
    const headMember = members.find((m: any) => m.role === MemberRole.HEAD) || members[0];
    const headName = headMember?.fullName ? headMember.fullName.trim() : houseName;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update family record
      const f = await tx.family.update({
        where: { id: familyId },
        data: {
          registrationType,
          houseName: houseName ? houseName.trim() : existing.houseName,
          headFullName: headName,
          unitId: resolvedUnitId,
          streetAddress: streetAddress !== undefined ? (streetAddress ? streetAddress.trim() : null) : existing.streetAddress,
          city: city !== undefined ? (city ? city.trim() : null) : existing.city,
          state: state !== undefined ? (state ? state.trim() : null) : existing.state,
          postalCode: postalCode !== undefined ? (postalCode ? postalCode.trim() : null) : existing.postalCode,
          primaryPhone: primaryPhone !== undefined ? (primaryPhone ? primaryPhone.trim() : null) : existing.primaryPhone,
          primaryEmail: primaryEmail !== undefined ? (primaryEmail ? primaryEmail.trim() : null) : existing.primaryEmail,
          originParish: originParish !== undefined ? (originParish ? originParish.trim() : null) : existing.originParish,
          originDiocese: originDiocese !== undefined ? (originDiocese ? originDiocese.trim() : null) : existing.originDiocese,
          generalNotes: generalNotes !== undefined ? (generalNotes ? generalNotes.trim() : null) : existing.generalNotes,
          status: targetStatus,
        },
      });

      // 2. Sync members
      if (Array.isArray(members) && members.length > 0) {
        const incomingMemberIds = members.filter((m: any) => m.id).map((m: any) => Number(m.id));

        // Delete omitted members
        await tx.familyMember.deleteMany({
          where: {
            familyId,
            id: { notIn: incomingMemberIds },
          },
        });

        // Upsert / Create members
        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          if (m.id) {
            await tx.familyMember.update({
              where: { id: Number(m.id) },
              data: {
                role: m.role || MemberRole.CHILD,
                fullName: m.fullName.trim(),
                dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
                placeOfBirth: m.placeOfBirth ? m.placeOfBirth.trim() : null,
                phone: m.phone ? m.phone.trim() : null,
                email: m.email ? m.email.trim() : null,
                isPrimaryContact: m.role === MemberRole.HEAD || i === 0,
                orderIndex: i,
              },
            });
          } else {
            await tx.familyMember.create({
              data: {
                familyId,
                role: m.role || (i === 0 ? MemberRole.HEAD : MemberRole.CHILD),
                fullName: m.fullName.trim(),
                dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
                placeOfBirth: m.placeOfBirth ? m.placeOfBirth.trim() : null,
                phone: m.phone ? m.phone.trim() : null,
                email: m.email ? m.email.trim() : null,
                isPrimaryContact: m.role === MemberRole.HEAD || i === 0,
                orderIndex: i,
              },
            });
          }
        }
      }

      // 3. Log audit note
      await tx.familyNote.create({
        data: {
          familyId,
          noteDate: new Date(),
          noteContent: `Household details and family members updated by ${user?.fullName || 'User'}.`,
          recordedBy: user?.fullName || 'System',
        },
      });

      return f;
    });

    return res.json(updated);
  } catch (err: any) {
    console.error('Error updating family:', err);
    return res.status(500).json({ error: 'Failed to update family record.' });
  }
});

// POST /api/families/:id/approve - Approve pending registration (with optional atomic data update)
familiesRouter.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const canApprove = await canUserApproveRegistration(user.userId, user.role);
    if (!canApprove) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to approve registrations.' });
    }

    const family = await prisma.family.findFirst({
      where: { id: familyId, parishId },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    const {
      registrationType,
      houseName,
      unitId,
      streetAddress,
      city,
      state,
      postalCode,
      primaryPhone,
      primaryEmail,
      originParish,
      originDiocese,
      generalNotes,
      members,
    } = req.body || {};

    const hasUpdates = houseName !== undefined || members !== undefined || unitId !== undefined;

    // Resolve Ward if provided
    let resolvedUnitId: number | null = family.unitId;
    if (unitId !== undefined) {
      if (unitId === null || unitId === '' || unitId === 'UNASSIGNED' || unitId === 'NONE' || unitId === 'NULL') {
        resolvedUnitId = null;
      } else {
        const parsed = parseInt(String(unitId), 10);
        if (!isNaN(parsed)) {
          const unitExists = await prisma.familyUnit.findFirst({ where: { id: parsed, parishId } });
          if (unitExists) resolvedUnitId = parsed;
        }
      }
    }

    // Resolve head name
    let headName = family.headFullName;
    if (Array.isArray(members) && members.length > 0) {
      const headMember = members.find((m: any) => m.role === MemberRole.HEAD) || members[0];
      headName = headMember?.fullName ? headMember.fullName.trim() : (houseName ? houseName.trim() : family.houseName);
    } else if (houseName) {
      headName = houseName.trim();
    }

    // Allocate canonical family code if not already assigned
    let familyCode = family.familyCode;
    const parish = await prisma.parish.findUnique({ where: { id: parishId } });

    await prisma.$transaction(async (tx) => {
      if (!familyCode && parish) {
        familyCode = `${parish.idPrefix}${parish.nextFamilyNumber}`;
        await tx.parish.update({
          where: { id: parishId },
          data: { nextFamilyNumber: { increment: 1 } },
        });
      }

      if (hasUpdates) {
        // 1. Update family record with any modified details and activate
        await tx.family.update({
          where: { id: familyId },
          data: {
            status: FamilyStatus.ACTIVE,
            familyCode,
            registrationType: registrationType || family.registrationType,
            houseName: houseName ? houseName.trim() : family.houseName,
            headFullName: headName,
            unitId: resolvedUnitId,
            streetAddress: streetAddress !== undefined ? (streetAddress ? streetAddress.trim() : null) : family.streetAddress,
            city: city !== undefined ? (city ? city.trim() : null) : family.city,
            state: state !== undefined ? (state ? state.trim() : null) : family.state,
            postalCode: postalCode !== undefined ? (postalCode ? postalCode.trim() : null) : family.postalCode,
            primaryPhone: primaryPhone !== undefined ? (primaryPhone ? primaryPhone.trim() : null) : family.primaryPhone,
            primaryEmail: primaryEmail !== undefined ? (primaryEmail ? primaryEmail.trim() : null) : family.primaryEmail,
            originParish: originParish !== undefined ? (originParish ? originParish.trim() : null) : family.originParish,
            originDiocese: originDiocese !== undefined ? (originDiocese ? originDiocese.trim() : null) : family.originDiocese,
            generalNotes: generalNotes !== undefined ? (generalNotes ? generalNotes.trim() : null) : family.generalNotes,
          },
        });

        // 2. Sync members
        if (Array.isArray(members) && members.length > 0) {
          const incomingMemberIds = members.filter((m: any) => m.id).map((m: any) => Number(m.id));

          // Delete omitted members
          await tx.familyMember.deleteMany({
            where: {
              familyId,
              id: { notIn: incomingMemberIds },
            },
          });

          // Upsert / Create members
          for (let i = 0; i < members.length; i++) {
            const m = members[i];
            if (m.id) {
              await tx.familyMember.update({
                where: { id: Number(m.id) },
                data: {
                  role: m.role || MemberRole.CHILD,
                  fullName: m.fullName.trim(),
                  dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
                  placeOfBirth: m.placeOfBirth ? m.placeOfBirth.trim() : null,
                  phone: m.phone ? m.phone.trim() : null,
                  email: m.email ? m.email.trim() : null,
                  isPrimaryContact: m.role === MemberRole.HEAD || i === 0,
                  orderIndex: i,
                },
              });
            } else {
              await tx.familyMember.create({
                data: {
                  familyId,
                  role: m.role || (i === 0 ? MemberRole.HEAD : MemberRole.CHILD),
                  fullName: m.fullName.trim(),
                  dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
                  placeOfBirth: m.placeOfBirth ? m.placeOfBirth.trim() : null,
                  phone: m.phone ? m.phone.trim() : null,
                  email: m.email ? m.email.trim() : null,
                  isPrimaryContact: m.role === MemberRole.HEAD || i === 0,
                  orderIndex: i,
                },
              });
            }
          }
        }

        // 3. Log combined audit note
        await tx.familyNote.create({
          data: {
            familyId,
            noteDate: new Date(),
            noteContent: `Registration details updated, officially approved, and activated by ${user.fullName} (${user.role}). Family code allocated: ${familyCode}.`,
            recordedBy: user.fullName,
          },
        });
      } else {
        // Standard approval without data modifications
        await tx.family.update({
          where: { id: familyId },
          data: {
            status: FamilyStatus.ACTIVE,
            familyCode,
          },
        });

        await tx.familyNote.create({
          data: {
            familyId,
            noteDate: new Date(),
            noteContent: `Registration officially approved and activated by ${user.fullName} (${user.role}). Family code allocated: ${familyCode}.`,
            recordedBy: user.fullName,
          },
        });
      }
    });

    return res.json({ message: 'Family registration approved successfully!', familyCode });
  } catch (err: any) {
    console.error('Error approving family:', err);
    return res.status(500).json({ error: 'Failed to approve registration.' });
  }
});

// POST /api/families/:id/reject - Reject pending registration
familiesRouter.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;
    const { reason } = req.body;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const canApprove = await canUserApproveRegistration(user.userId, user.role);
    if (!canApprove) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to reject registrations.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id: familyId },
        data: {
          status: FamilyStatus.INACTIVE,
        },
      });

      await tx.familyNote.create({
        data: {
          familyId,
          noteDate: new Date(),
          noteContent: `Registration rejected by ${user.fullName}: ${reason || 'Criteria not met or duplicate record.'}`,
          recordedBy: user.fullName,
        },
      });
    });

    return res.json({ message: 'Family registration rejected.' });
  } catch (err: any) {
    console.error('Error rejecting family:', err);
    return res.status(500).json({ error: 'Failed to reject registration.' });
  }
});

// POST /api/families/:id/inactivate - Deactivate an active household with reason and direct debit handling
familiesRouter.post('/:id/inactivate', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;
    const { reason, notes, cancelDirectDebit = true } = req.body;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const canApprove = await canUserApproveRegistration(user.userId, user.role);
    if (!canApprove) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to inactivate household records.' });
    }

    const family = await prisma.family.findFirst({
      where: { id: familyId, parishId },
      include: { directDebit: true },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    if (family.status === FamilyStatus.INACTIVE) {
      return res.status(400).json({ error: 'This household is already marked as inactive.' });
    }

    const selectedReason = reason || 'Household marked as inactive by administrator.';
    const detailNotes = notes ? ` Specific details: ${notes.trim()}` : '';

    await prisma.$transaction(async (tx) => {
      // 1. Update family status to INACTIVE
      await tx.family.update({
        where: { id: familyId },
        data: {
          status: FamilyStatus.INACTIVE,
        },
      });

      // 2. Pause/Cancel Direct Debit if requested and active
      let ddNote = '';
      if (cancelDirectDebit && family.directDebit && family.directDebit.active) {
        await tx.directDebit.update({
          where: { id: family.directDebit.id },
          data: {
            active: false,
            comments: family.directDebit.comments
              ? `${family.directDebit.comments} | Inactivated on household archival (${new Date().toLocaleDateString()})`
              : `Direct debit cancelled on household archival (${new Date().toLocaleDateString()})`,
          },
        });
        ddNote = ' Active Direct Debit was automatically cancelled.';
      }

      // 3. Log comprehensive audit note
      await tx.familyNote.create({
        data: {
          familyId,
          noteDate: new Date(),
          noteContent: `Household transitioned from ${family.status} to INACTIVE by ${user.fullName} (${user.role}). Reason: ${selectedReason}.${detailNotes}${ddNote}`,
          recordedBy: user.fullName,
        },
      });
    });

    return res.json({
      message: 'Household successfully marked as inactive.',
      status: FamilyStatus.INACTIVE,
    });
  } catch (err: any) {
    console.error('Error inactivating family:', err);
    return res.status(500).json({ error: 'Failed to inactivate household.' });
  }
});

// POST /api/families/:id/reactivate - Reactivate an inactive household back to ACTIVE
familiesRouter.post('/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;
    const { note } = req.body;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const canApprove = await canUserApproveRegistration(user.userId, user.role);
    if (!canApprove) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to reactivate household records.' });
    }

    const family = await prisma.family.findFirst({
      where: { id: familyId, parishId },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    if (family.status === FamilyStatus.ACTIVE) {
      return res.status(400).json({ error: 'This household is already active.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update family status to ACTIVE
      await tx.family.update({
        where: { id: familyId },
        data: {
          status: FamilyStatus.ACTIVE,
        },
      });

      // 2. Log audit note
      const comment = note ? ` Note: ${note.trim()}` : '';
      await tx.familyNote.create({
        data: {
          familyId,
          noteDate: new Date(),
          noteContent: `Household restored from ${family.status} to ACTIVE status by ${user.fullName} (${user.role}).${comment}`,
          recordedBy: user.fullName,
        },
      });
    });

    return res.json({
      message: 'Household successfully reactivated to active status.',
      status: FamilyStatus.ACTIVE,
    });
  } catch (err: any) {
    console.error('Error reactivating family:', err);
    return res.status(500).json({ error: 'Failed to reactivate household.' });
  }
});

// PUT /api/families/:id/direct-debit - Update or create Direct Debit with full auditing
familiesRouter.put('/:id/direct-debit', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const ddPerms = await getUserDirectDebitPermissions(user.userId, user.role, parishId);
    if (!ddPerms.canEdit) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to manage Direct Debit.' });
    }

    const family = await prisma.family.findFirst({
      where: { id: familyId, parishId },
      include: { directDebit: true },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    const { amount, frequency = 'Monthly', active = true, comments } = req.body;

    const parsedAmount = amount !== null && amount !== undefined && amount !== '' ? parseFloat(amount) : null;
    if (active && (parsedAmount === null || isNaN(parsedAmount) || parsedAmount <= 0)) {
      return res.status(400).json({ error: 'Please enter a valid positive contribution amount.' });
    }

    const existing = family.directDebit;
    const changes: string[] = [];

    if (!existing) {
      changes.push(`Direct debit established: $${parsedAmount ? parsedAmount.toFixed(2) : '0.00'} AUD (${frequency})`);
      if (!active) changes.push('Status: Inactive');
      if (comments) changes.push(`Notes: ${comments.trim()}`);
    } else {
      const oldAmount = existing.amount ? parseFloat(existing.amount.toString()) : 0;
      const newAmount = parsedAmount ?? 0;
      if (oldAmount !== newAmount) {
        changes.push(`Amount changed from $${oldAmount.toFixed(2)} to $${newAmount.toFixed(2)} AUD`);
      }
      if (existing.frequency !== frequency) {
        changes.push(`Frequency changed from ${existing.frequency || 'Unspecified'} to ${frequency}`);
      }
      if (existing.active !== Boolean(active)) {
        changes.push(`Status changed from ${existing.active ? 'Active' : 'Inactive'} to ${active ? 'Active' : 'Inactive'}`);
      }
      if ((existing.comments || '').trim() !== (comments || '').trim()) {
        changes.push('Direct debit notes updated');
      }
    }

    const auditMessage = changes.length > 0
      ? `Direct Debit ${existing ? 'updated' : 'established'} by ${user.fullName} (${user.role}): ${changes.join('; ')}.`
      : `Direct Debit verified by ${user.fullName} (${user.role}) with no changes.`;

    const result = await prisma.$transaction(async (tx) => {
      const dd = await tx.directDebit.upsert({
        where: { familyId },
        update: {
          amount: parsedAmount !== null ? new Prisma.Decimal(parsedAmount) : null,
          frequency: frequency || 'Monthly',
          active: Boolean(active),
          comments: comments ? comments.trim() : null,
        },
        create: {
          parishId,
          familyId,
          amount: parsedAmount !== null ? new Prisma.Decimal(parsedAmount) : null,
          frequency: frequency || 'Monthly',
          active: Boolean(active),
          comments: comments ? comments.trim() : null,
        },
      });

      if (changes.length > 0) {
        await tx.familyNote.create({
          data: {
            familyId,
            noteDate: new Date(),
            noteContent: auditMessage,
            recordedBy: user.fullName,
          },
        });
      }

      return dd;
    });

    return res.json({
      message: 'Direct Debit updated successfully.',
      directDebit: result,
    });
  } catch (err: any) {
    console.error('Error updating direct debit:', err);
    return res.status(500).json({ error: 'Failed to update Direct Debit.' });
  }
});

// POST /api/families/merge - Non-destructive marriage merge of two single accounts
familiesRouter.post('/merge', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const { primaryFamilyId, secondaryFamilyId, newRoleForSecondary = MemberRole.SPOUSE } = req.body;

    if (!primaryFamilyId || !secondaryFamilyId) {
      return res.status(400).json({ error: 'Both primary and secondary family IDs are required for merge.' });
    }

    const [primary, secondary] = await Promise.all([
      prisma.family.findFirst({ where: { id: primaryFamilyId, parishId }, include: { members: true } }),
      prisma.family.findFirst({ where: { id: secondaryFamilyId, parishId }, include: { members: true } }),
    ]);

    if (!primary || !secondary) {
      return res.status(404).json({ error: 'One or both family records not found in active parish.' });
    }

    const secondaryMember = secondary.members[0];
    if (!secondaryMember) {
      return res.status(400).json({ error: 'Secondary record has no member to transfer.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Move secondary member to primary family as SPOUSE
      await tx.familyMember.update({
        where: { id: secondaryMember.id },
        data: {
          familyId: primary.id,
          role: newRoleForSecondary,
          orderIndex: 1,
        },
      });

      // 2. Add history entry for the merged member
      await tx.memberHistory.create({
        data: {
          memberId: secondaryMember.id,
          familyId: primary.id,
          unitName: primary.unitId ? 'Transferred' : 'General',
          role: newRoleForSecondary,
          changeReason: `Married and merged into ${primary.houseName} (${primary.familyCode || primary.id})`,
        },
      });

      // 3. Mark primary family as full FAMILY registration
      await tx.family.update({
        where: { id: primary.id },
        data: { registrationType: RegistrationType.FAMILY },
      });

      // 4. Archive secondary record (status = MERGED) without deleting
      await tx.family.update({
        where: { id: secondary.id },
        data: {
          status: FamilyStatus.MERGED,
          mergedIntoFamilyId: primary.id,
        },
      });

      // 5. Add note to both records
      await tx.familyNote.create({
        data: {
          familyId: primary.id,
          noteDate: new Date(),
          noteContent: `Merged with ${secondary.houseName} (${secondary.familyCode || secondary.id}) upon marriage.`,
          recordedBy: req.user?.fullName || 'Admin',
        },
      });
    });

    return res.json({ message: 'Marriage merge completed successfully without data loss.' });
  } catch (err: any) {
    console.error('Error during marriage merge:', err);
    return res.status(500).json({ error: 'Failed to merge family records.' });
  }
});
