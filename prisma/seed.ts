import { prisma } from "../lib/prisma";
import { BUILTIN_TEMPLATES } from "../lib/seed-data";

async function main() {
  console.log("Seeding template bawaan...");
  for (const t of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({
      where: { id: `builtin-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` },
      update: { description: t.description, fields: t.fields },
      create: {
        id: `builtin-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        worldId: null,
        name: t.name,
        description: t.description,
        fields: t.fields,
        isBuiltIn: true,
      },
    });
  }
  console.log(`OK: ${BUILTIN_TEMPLATES.length} template bawaan.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
