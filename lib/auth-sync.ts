import { prisma } from '@/lib/prisma';
import type { User } from '@supabase/supabase-js';

export async function ensurePrismaUser(authUser: User) {
  try {
    return await prisma.user.upsert({
      where: { id: authUser.id },
      update: {},
      create: {
        id: authUser.id,
        email: authUser.email || '',
      }
    });
  } catch (error) {
    console.error("Error in ensurePrismaUser:", error);
    throw error;
  }
}
