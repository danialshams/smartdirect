import { prisma } from "./prisma";

export async function checkDB() {
  const count = await prisma.user.count();
  return `DB is connected. Users: ${count}`;
}
