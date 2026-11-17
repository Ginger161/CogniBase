import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    return NextResponse.json(dbUser || {});
  } catch {
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;const data = await req.json().catch(() => ({}));
    const { username, school, department } = data;

    const newUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username,
        school,
        department
      },
      create: {
        id: user.id,
        email: user.email!,
        username,
        school,
        department
      }
    });

    return NextResponse.json(newUser);
  } catch (error) {
    console.error("API Crash Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
