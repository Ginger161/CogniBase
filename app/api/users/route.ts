import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { id, email, username, school, department } = data;

    const newUser = await prisma.user.upsert({
      where: { id },
      update: {
        email,
        username,
        school,
        department
      },
      create: {
        id, // from Supabase
        email,
        username,
        school,
        department
      }
    });

    return NextResponse.json(newUser);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
