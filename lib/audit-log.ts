import { prisma } from '@/lib/prisma';
import geoip from 'geoip-lite';

export async function logActivity(userId: string, action: string, details: string, req?: Request) {
  try {
    let ipAddress: string | null = null;
    let location: string | null = null;

    if (req) {
      const forwardedFor = req.headers.get('x-forwarded-for');
      ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip');

      if (ipAddress) {
        const geo = geoip.lookup(ipAddress);
        if (geo) {
          location = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');
        }
      }
    }

    await prisma.auditLog.create({
      data: { userId, action, details, ipAddress, location }
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}
