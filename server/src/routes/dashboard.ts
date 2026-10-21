import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { FamilyStatus, RegistrationType, MemberRole } from '@prisma/client';

export const dashboardRouter = Router();

// Apply auth to all dashboard endpoints
dashboardRouter.use(authenticateJWT);

// GET /api/dashboard/stats
dashboardRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;

    const [
      activeFamilies,
      studentCount,
      youthCount,
      totalMembers,
      totalUnits,
      directDebitAggregate,
      directDebitCount,
    ] = await Promise.all([
      // 1. Total Active Families
      prisma.family.count({
        where: {
          parishId,
          status: FamilyStatus.ACTIVE,
          registrationType: RegistrationType.FAMILY,
        },
      }),

      // 2. Individual Students
      prisma.family.count({
        where: {
          parishId,
          status: FamilyStatus.ACTIVE,
          registrationType: RegistrationType.INDIVIDUAL_STUDENT,
        },
      }),

      // 3. Individuals (Singles & Adults)
      prisma.family.count({
        where: {
          parishId,
          status: FamilyStatus.ACTIVE,
          registrationType: RegistrationType.INDIVIDUAL,
        },
      }),

      // 4. Total Individual Parishioners (Across all households)
      prisma.familyMember.count({
        where: {
          family: {
            parishId,
            status: FamilyStatus.ACTIVE,
          },
        },
      }),

      // 5. Total Active Wards/Units
      prisma.familyUnit.count({
        where: {
          parishId,
          isActive: true,
        },
      }),

      // 6. Direct Debit monthly sum (if any)
      prisma.directDebit.aggregate({
        where: {
          parishId,
          active: true,
        },
        _sum: {
          amount: true,
        },
      }),

      // 7. Direct Debit active count
      prisma.directDebit.count({
        where: {
          parishId,
          active: true,
        },
      }),
    ]);

    // Active parish details
    const parish = await prisma.parish.findUnique({
      where: { id: parishId },
      select: { parishCode: true, parishName: true, city: true },
    });

    return res.json({
      parish,
      stats: {
        activeFamilies,
        individualStudents: studentCount,
        individuals: youthCount,
        singleYouth: youthCount,
        totalHouseholds: activeFamilies + studentCount + youthCount,
        totalParishioners: totalMembers,
        activeUnitsCount: totalUnits,
        monthlyDirectDebit: directDebitAggregate._sum.amount || 0,
        directDebitCount,
      },
    });
  } catch (err: any) {
    console.error('Error fetching dashboard stats:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// GET /api/dashboard/charts
dashboardRouter.get('/charts', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;

    // 1. Ward / Unit Distribution
    const unitStats = await prisma.familyUnit.findMany({
      where: { parishId, isActive: true },
      select: {
        unitName: true,
        category: true,
        _count: {
          select: { families: true },
        },
      },
      orderBy: {
        families: {
          _count: 'desc',
        },
      },
    });

    const wardDistribution = unitStats.map((u) => ({
      name: u.unitName,
      category: u.category,
      count: u._count.families,
    }));

    // 2. Roots in India: Top Dioceses of Origin
    const diocesesGroup = await prisma.family.groupBy({
      by: ['originDiocese'],
      where: {
        parishId,
        originDiocese: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          originDiocese: 'desc',
        },
      },
    });

    const diocesesDistribution = diocesesGroup
      .filter((d) => d.originDiocese && d.originDiocese.trim() !== '')
      .map((d) => ({
        diocese: d.originDiocese as string,
        count: d._count,
      }));

    // 3. Registration Types Breakdown
    const typeGroup = await prisma.family.groupBy({
      by: ['registrationType'],
      where: { parishId },
      _count: true,
    });

    const typeLabels: Record<string, string> = {
      FAMILY: 'Families',
      INDIVIDUAL_STUDENT: 'International Students',
      INDIVIDUAL: 'Individuals',
    };

    const registrationTypes = typeGroup.map((t) => ({
      type: typeLabels[t.registrationType] || t.registrationType,
      count: t._count,
    }));

    // 4. Recent Notes / Activity Feed
    const recentActivity = await prisma.familyNote.findMany({
      where: {
        family: { parishId },
      },
      take: 6,
      orderBy: {
        noteDate: 'desc',
      },
      include: {
        family: {
          select: {
            houseName: true,
            familyCode: true,
            unit: { select: { unitName: true } },
            members: {
              where: { role: MemberRole.HEAD },
              select: { fullName: true },
              take: 1,
            },
          },
        },
      },
    });

    return res.json({
      wardDistribution,
      diocesesDistribution,
      registrationTypes,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        noteDate: a.noteDate,
        content: a.noteContent,
        recordedBy: a.recordedBy,
        houseName: a.family.houseName,
        headName: a.family.members[0]?.fullName || a.family.houseName,
        familyCode: a.family.familyCode,
        unitName: a.family.unit?.unitName || 'Unassigned',
      })),
    });
  } catch (err: any) {
    console.error('Error fetching dashboard charts:', err);
    return res.status(500).json({ error: 'Failed to fetch chart datasets' });
  }
});
