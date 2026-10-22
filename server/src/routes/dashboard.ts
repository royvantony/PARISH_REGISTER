import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { FamilyStatus, RegistrationType, MemberRole } from '@prisma/client';

export const dashboardRouter = Router();

// Apply auth to all dashboard endpoints
dashboardRouter.use(authenticateJWT);

/**
 * Normalizes contribution amounts into an average monthly equivalent based on frequency.
 * - Weekly: (amount * 52) / 12
 * - Fortnightly: (amount * 26) / 12
 * - Monthly: amount
 * - Quarterly: (amount * 4) / 12
 * - Half-Yearly: (amount * 2) / 12
 * - Annual / Yearly: amount / 12
 */
export function calculateMonthlyEquivalent(
  amount: number | null | undefined,
  frequency: string | null | undefined
): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;
  const freq = (frequency || '').trim().toLowerCase();

  switch (freq) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'fortnightly':
    case 'bi-weekly':
    case 'biweekly':
      return (amount * 26) / 12;
    case 'monthly':
      return amount;
    case 'quarterly':
      return (amount * 4) / 12;
    case 'half-yearly':
    case 'semi-annually':
    case 'semi-annual':
    case 'bi-annual':
      return (amount * 2) / 12;
    case 'annual':
    case 'annually':
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

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
      activeMembersList,
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

      // 6. Direct Debit active records for frequency-aware monthly average calculation (active families only)
      prisma.directDebit.findMany({
        where: {
          parishId,
          active: true,
          family: {
            status: FamilyStatus.ACTIVE,
          },
        },
        select: {
          amount: true,
          frequency: true,
        },
      }),

      // 7. Direct Debit active count (active families only)
      prisma.directDebit.count({
        where: {
          parishId,
          active: true,
          family: {
            status: FamilyStatus.ACTIVE,
          },
        },
      }),

      // 8. All active members for adult/child demographic breakdown
      prisma.familyMember.findMany({
        where: {
          family: {
            parishId,
            status: FamilyStatus.ACTIVE,
          },
        },
        select: {
          role: true,
          dateOfBirth: true,
        },
      }),
    ]);

    // Calculate normalized monthly average across all active direct debits
    let monthlyDirectDebitAvg = 0;
    for (const dd of directDebitAggregate) {
      if (dd.amount) {
        monthlyDirectDebitAvg += calculateMonthlyEquivalent(Number(dd.amount), dd.frequency);
      }
    }
    const roundedMonthlyDirectDebit = Math.round(monthlyDirectDebitAvg);

    // Calculate adult vs child counts
    let adultsCount = 0;
    let kidsCount = 0;
    const now = new Date();
    for (const m of activeMembersList) {
      if (m.dateOfBirth) {
        const age = (now.getTime() - new Date(m.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (age >= 18) adultsCount++;
        else kidsCount++;
      } else {
        if (m.role === MemberRole.CHILD) kidsCount++;
        else adultsCount++;
      }
    }

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
        adultsCount,
        kidsCount,
        activeUnitsCount: totalUnits,
        monthlyDirectDebit: roundedMonthlyDirectDebit,
        monthlyDirectDebitAvg: roundedMonthlyDirectDebit,
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

    // Run parallel queries for chart analytics
    const [unitStats, diocesesGroup, typeGroup, recentActivity, allMembers, allFamilies] = await Promise.all([
      // 1. Ward / Unit Distribution
      prisma.familyUnit.findMany({
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
      }),

      // 2. Roots in India: Top Dioceses of Origin
      prisma.family.groupBy({
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
      }),

      // 3. Registration Types Breakdown
      prisma.family.groupBy({
        by: ['registrationType'],
        where: { parishId, status: FamilyStatus.ACTIVE },
        _count: true,
      }),

      // 4. Recent Notes / Activity Feed
      prisma.familyNote.findMany({
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
      }),

      // 5. Active Family Members for Demographics (Adults vs Kids, Age Brackets)
      prisma.familyMember.findMany({
        where: {
          family: { parishId, status: FamilyStatus.ACTIVE },
        },
        select: {
          role: true,
          dateOfBirth: true,
        },
      }),

      // 6. Active Families for Registration Year Trend, Household Sizes, and Suburbs
      prisma.family.findMany({
        where: { parishId, status: FamilyStatus.ACTIVE },
        select: {
          registrationDate: true,
          createdAt: true,
          city: true,
          _count: {
            select: { members: true },
          },
        },
      }),
    ]);

    // 1. Ward Distribution formatting
    const wardDistribution = unitStats.map((u) => ({
      name: u.unitName,
      category: u.category,
      count: u._count.families,
    }));

    // 2. Dioceses of Origin in India formatting
    const diocesesDistribution = diocesesGroup
      .filter((d) => d.originDiocese && d.originDiocese.trim() !== '')
      .map((d) => ({
        diocese: d.originDiocese as string,
        count: d._count,
      }));

    // 3. Registration Types formatting
    const typeLabels: Record<string, string> = {
      FAMILY: 'Families',
      INDIVIDUAL_STUDENT: 'International Students',
      INDIVIDUAL: 'Individuals',
    };

    const registrationTypes = typeGroup.map((t) => ({
      type: typeLabels[t.registrationType] || t.registrationType,
      count: t._count,
    }));

    // 4. Demographics: Adults vs Kids & Age Brackets
    let adultsCount = 0;
    let kidsCount = 0;
    const now = new Date();

    const ageBracketsMap: Record<string, { label: string; count: number; color: string; order: number }> = {
      '0–4 yrs': { label: 'Infants & Toddlers', count: 0, color: '#06b6d4', order: 1 },
      '5–12 yrs': { label: 'Primary (Catechism)', count: 0, color: '#10b981', order: 2 },
      '13–17 yrs': { label: 'Teens & High School', count: 0, color: '#f59e0b', order: 3 },
      '18–25 yrs': { label: 'Young Adults & Youth', count: 0, color: '#ec4899', order: 4 },
      '26–45 yrs': { label: 'Young Families', count: 0, color: '#3b82f6', order: 5 },
      '46–64 yrs': { label: 'Mature Adults', count: 0, color: '#8b5cf6', order: 6 },
      '65+ yrs': { label: 'Seniors & Elders', count: 0, color: '#64748b', order: 7 },
    };

    for (const m of allMembers) {
      if (m.dateOfBirth) {
        const age = (now.getTime() - new Date(m.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (age >= 18) adultsCount++;
        else kidsCount++;

        if (age < 5) ageBracketsMap['0–4 yrs'].count++;
        else if (age <= 12) ageBracketsMap['5–12 yrs'].count++;
        else if (age <= 17) ageBracketsMap['13–17 yrs'].count++;
        else if (age <= 25) ageBracketsMap['18–25 yrs'].count++;
        else if (age <= 45) ageBracketsMap['26–45 yrs'].count++;
        else if (age <= 64) ageBracketsMap['46–64 yrs'].count++;
        else ageBracketsMap['65+ yrs'].count++;
      } else {
        if (m.role === MemberRole.CHILD) {
          kidsCount++;
          ageBracketsMap['5–12 yrs'].count++;
        } else {
          adultsCount++;
          ageBracketsMap['26–45 yrs'].count++;
        }
      }
    }

    const totalMembersCount = allMembers.length || 1;
    const adultsVsKids = [
      {
        name: 'Adults (18+)',
        count: adultsCount,
        percentage: Math.round((adultsCount / totalMembersCount) * 100),
      },
      {
        name: 'Children & Minors (<18)',
        count: kidsCount,
        percentage: Math.round((kidsCount / totalMembersCount) * 100),
      },
    ];

    const ageBrackets = Object.entries(ageBracketsMap)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([bracket, data]) => ({
        bracket,
        label: data.label,
        count: data.count,
        color: data.color,
      }));

    // 5. Registration Year-Wise Trend
    const yearCounts: Record<string, number> = {};
    for (const f of allFamilies) {
      const d = f.registrationDate || f.createdAt;
      if (d) {
        const y = new Date(d).getFullYear();
        const key = y <= 2015 ? 'Pre-2016' : String(y);
        yearCounts[key] = (yearCounts[key] || 0) + 1;
      }
    }

    // Sort chronologically
    const allYears = Object.keys(yearCounts).sort((a, b) => {
      if (a === 'Pre-2016') return -1;
      if (b === 'Pre-2016') return 1;
      return parseInt(a, 10) - parseInt(b, 10);
    });

    let runningTotal = 0;
    const yearlyRegistrations = allYears.map((year) => {
      const count = yearCounts[year] || 0;
      runningTotal += count;
      return {
        year,
        count,
        cumulative: runningTotal,
      };
    });

    // 6. Household / Family Size Breakdown
    const sizeMap: Record<string, { count: number; description: string; order: number }> = {
      '1 Member': { count: 0, description: 'Students & Singles', order: 1 },
      '2 Members': { count: 0, description: 'Couples', order: 2 },
      '3 Members': { count: 0, description: 'Small Families', order: 3 },
      '4 Members': { count: 0, description: 'Standard Families', order: 4 },
      '5+ Members': { count: 0, description: 'Large Households', order: 5 },
    };

    for (const f of allFamilies) {
      const c = f._count.members;
      if (c <= 1) sizeMap['1 Member'].count++;
      else if (c === 2) sizeMap['2 Members'].count++;
      else if (c === 3) sizeMap['3 Members'].count++;
      else if (c === 4) sizeMap['4 Members'].count++;
      else sizeMap['5+ Members'].count++;
    }

    const totalFamiliesCount = allFamilies.length || 1;
    const familySizes = Object.entries(sizeMap)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([size, data]) => ({
        size,
        count: data.count,
        description: data.description,
        percentage: Math.round((data.count / totalFamiliesCount) * 100),
      }));

    // 7. Suburb / Geographic Distribution (Top 8-10 Suburbs)
    const suburbMap: Record<string, number> = {};
    for (const f of allFamilies) {
      if (f.city && f.city.trim()) {
        const sub = f.city.trim();
        suburbMap[sub] = (suburbMap[sub] || 0) + 1;
      }
    }

    const suburbDistribution = Object.entries(suburbMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([suburb, count]) => ({
        suburb,
        count,
      }));

    return res.json({
      wardDistribution,
      diocesesDistribution,
      registrationTypes,
      adultsVsKids,
      ageBrackets,
      yearlyRegistrations,
      familySizes,
      suburbDistribution,
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
