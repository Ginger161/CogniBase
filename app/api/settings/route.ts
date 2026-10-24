import { logActivity } from '@/lib/audit-log';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePrismaUser(user);

    let dbUser;
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { preferences: true }
      });

      if (!dbUser) {
        return NextResponse.json({
          id: user.id,
          email: user.email || '',
          username: user.email?.split('@')[0] || 'Student',
          preferences: {
            theme: 'system',
            sidebarMode: 'expanded',
            dailyFocusGoal: 120,
            guideComplexity: 'standard'
          }
        });
      }

      // Return a default object if userPreferences is null so the UI can render
      if (!dbUser.preferences) {
        Object.assign(dbUser, {
          preferences: { theme: 'charcoal', sidebarMode: 'expanded', dailyFocusGoal: 120, guideComplexity: 'standard' },
        });
      }
    } catch (e) {
      console.warn("Database error in settings GET, falling back:", e);
      return NextResponse.json({
        id: user.id,
        email: user.email || '',
        username: user.email?.split('@')[0] || 'Student',
        preferences: {
          theme: 'system',
          sidebarMode: 'expanded',
          dailyFocusGoal: 120,
          guideComplexity: 'standard'
        }
      });
    }

    return NextResponse.json(dbUser);
  } catch (error) {
    console.error("Settings GET Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensurePrismaUser(user);

    const data = await req.json().catch(() => ({}));
    const { username, school, department, preferences } = data;

    const tooLong = (v: unknown, max: number) => v !== undefined && (typeof v !== 'string' || v.length > max);
    if (tooLong(username, 80) || tooLong(school, 120) || tooLong(department, 120)) {
      return NextResponse.json({ error: "Profile fields must be text under 120 characters." }, { status: 400 });
    }
    if (preferences !== undefined) {
      const goal = preferences?.dailyFocusGoal;
      const goalNumber = goal === undefined ? undefined : Number(goal);
      if (goalNumber !== undefined && (!Number.isInteger(goalNumber) || goalNumber < 10 || goalNumber > 720)) {
        return NextResponse.json({ error: "Daily focus goal must be between 10 and 720 minutes." }, { status: 400 });
      }
      const theme = preferences?.theme;
      if (theme !== undefined && !['charcoal', 'dark', 'ivory', 'system'].includes(theme)) {
        return NextResponse.json({ error: "Unknown theme." }, { status: 400 });
      }
    }

    // Robust upsert for User profile
    const updatedUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: username !== undefined ? username : undefined,
        school: school !== undefined ? school : undefined,
        department: department !== undefined ? department : undefined,
      },
      create: {
        id: user.id,
        email: user.email || '',
        username: username,
        school: school,
        department: department,
      }
    });

    // Robust upsert for UserPreferences
    let updatedPreferences = null;
    if (preferences) {
      const { theme, sidebarMode, dailyFocusGoal, guideComplexity } = preferences;
      updatedPreferences = await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: {
          theme: theme !== undefined ? theme : undefined,
          sidebarMode: sidebarMode !== undefined ? sidebarMode : undefined,
          dailyFocusGoal: dailyFocusGoal !== undefined ? parseInt(dailyFocusGoal) : undefined,
          guideComplexity: guideComplexity !== undefined ? guideComplexity : undefined
        },
        create: {
          userId: user.id,
          theme: theme || "system",
          sidebarMode: sidebarMode || "expanded",
          dailyFocusGoal: dailyFocusGoal ? parseInt(dailyFocusGoal) : 120,
          guideComplexity: guideComplexity || "standard"
        }
      });
    }

    logActivity(user.id, 'update_settings', 'Updated profile or preferences', req).catch(console.error);
    return NextResponse.json({ user: updatedUser, preferences: updatedPreferences });
  } catch (error) {
    console.error("Settings POST Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
