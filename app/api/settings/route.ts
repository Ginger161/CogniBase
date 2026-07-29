import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

export async function GET(req: Request) {
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
        (dbUser as any).preferences = {
          theme: 'system',
          sidebarMode: 'expanded',
          dailyFocusGoal: 120,
          guideComplexity: 'standard'
        };
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

    const data = await req.json();
    const { username, school, department, preferences } = data;

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

    return NextResponse.json({ user: updatedUser, preferences: updatedPreferences });
  } catch (error) {
    console.error("Settings POST Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
