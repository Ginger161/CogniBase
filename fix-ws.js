const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fix() {
  const ws = await prisma.workspace.findMany({ where: { title: 'Untitled Workspace' } });
  for (let w of ws) {
    const doc = await prisma.document.findFirst({ where: { workspaceId: w.id } });
    const name = doc ? doc.name.replace(/\.[^/.]+$/, '') : 'Philosophy of Education';
    await prisma.workspace.update({ where: { id: w.id }, data: { title: name } });
    console.log('Renamed', w.id, 'to', name);
  }
}
fix().then(() => prisma.$disconnect());
