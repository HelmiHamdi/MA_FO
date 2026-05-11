import { PrismaClient, ProfileType } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ✅ IV déterministe → même participant = même token toujours
function encryptQrToken(participantId: string, secret: string): string {
  const iv = crypto.createHash('md5').update(participantId).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret.padEnd(32)), iv);
  let encrypted = cipher.update(participantId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function main() {
  console.log('🌱 Seeding database...');

  const QR_SECRET = process.env.QR_BADGE_SECRET || 'dev_secret_key_for_testing_only';

  const participants = [
    {
      id: 'p-001',
      email: 'ahmed.ben.ali@example.com',
      phone: '+21698000001',
      firstName: 'Ahmed',
      lastName: 'Ben Ali',
      jobTitle: 'CEO',
      company: 'TechStart TN',
      sector: 'Tech',
      country: 'TN',
      bio: 'Entrepreneur passionné par les technologies innovantes en Afrique du Nord.',
      tags: JSON.stringify(['startup', 'fintech', 'innovation']),
      profileType: ProfileType.VIP,
      isActive: false,
      visibilityScore: 0.9,
    },
    {
      id: 'p-002',
      email: 'fatma.mansour@example.com',
      phone: '+21698000002',
      firstName: 'Fatma',
      lastName: 'Mansour',
      jobTitle: 'Investment Director',
      company: 'Maghreb Ventures',
      sector: 'Finance',
      country: 'TN',
      bio: 'Investisseur en capital-risque spécialisé dans les startups MENA.',
      tags: JSON.stringify(['VC', 'investment', 'MENA']),
      profileType: ProfileType.INSTITUTIONNEL,
      isActive: false,
      visibilityScore: 0.85,
    },
    {
      id: 'p-003',
      email: 'karim.dridi@example.com',
      phone: '+21698000003',
      firstName: 'Karim',
      lastName: 'Dridi',
      jobTitle: 'CTO',
      company: 'Innov Africa',
      sector: 'Tech',
      country: 'TN',
      bio: 'Expert en transformation digitale et cloud computing.',
      tags: JSON.stringify(['cloud', 'AI', 'digital-transformation']),
      profileType: ProfileType.STANDARD,
      isActive: false,
      visibilityScore: 0.75,
    },
    {
      id: 'p-004',
      email: 'leila.chaabane@example.com',
      phone: '+21698000004',
      firstName: 'Leila',
      lastName: 'Chaabane',
      jobTitle: 'Marketing Director',
      company: 'Brand MENA',
      sector: 'Marketing',
      country: 'TN',
      bio: "Stratège marketing digitale avec 10 ans d'expérience en MENA.",
      tags: JSON.stringify(['marketing', 'branding', 'digital']),
      profileType: ProfileType.STANDARD,
      isActive: false,
      visibilityScore: 0.8,
    },
    {
      id: 'p-005',
      email: 'mehdi.ben.salah@example.com',
      phone: '+21698000005',
      firstName: 'Mehdi',
      lastName: 'Ben Salah',
      jobTitle: 'Product Manager',
      company: 'DigitalWave',
      sector: 'Tech',
      country: 'TN',
      bio: 'PM focalisé sur les produits SaaS pour le marché africain.',
      tags: JSON.stringify(['SaaS', 'product', 'agile']),
      profileType: ProfileType.STANDARD,
      isActive: false,
      visibilityScore: 0.7,
    },
    {
      id: 'p-006',
      email: 'helmi.hamdi@etudiant-fst.utm.tn',
      phone: '+21625152451',
      firstName: 'Helmi',
      lastName: 'Hamdi',
      jobTitle: 'Étudiant Ingénieur',
      company: 'FST — Université de Tunis El Manar',
      sector: 'Tech',
      country: 'TN',
      bio: 'Étudiant ingénieur passionné par le développement fullstack et les startups tech.',
      tags: JSON.stringify(['Tech', 'StartUp', 'Innovation', 'IA']),
      profileType: ProfileType.STANDARD,
      isActive: false,
      visibilityScore: 0.8,
    },
    {
      id: 'p-007',
      email: 'mohamedalihelmihamdi@gmail.com',
      phone: '+21625152452',
      firstName: 'Mohamed Ali',
      lastName: 'Hamdi',
      jobTitle: 'Développeur Fullstack',
      company: 'Freelance',
      sector: 'Tech',
      country: 'TN',
      bio: 'Développeur fullstack spécialisé en NestJS et Next.js.',
      tags: JSON.stringify(['Tech', 'StartUp', 'Innovation']),
      profileType: ProfileType.STANDARD,
      isActive: false,
      visibilityScore: 0.75,
    },
    {
      id: 'p-008',
      email: 'helmihamdi04041999@gmail.com',
      phone: '+21625152453',
      firstName: 'Helmi',
      lastName: 'Hamdi',
      jobTitle: 'Lead Developer',
      company: 'Matchmaking App',
      sector: 'Tech',
      country: 'TN',
      bio: 'Lead developer de la plateforme Matchmaking App — networking B2B en Tunisie.',
      tags: JSON.stringify(['Tech', 'FinTech', 'StartUp', 'Innovation']),
      profileType: ProfileType.VIP,
      isActive: false,
      visibilityScore: 0.95,
    },
    {
  id: 'p-011',
  email: 'hammdihelmi@gmail.com',
   phone: '+21625152460', 
  firstName: 'Helmi',
  lastName: 'Hamdi',
  jobTitle: 'Développeur',
  company: 'Matchmaking App',
  sector: 'Tech',
  country: 'TN',
  bio: 'Développeur passionné.',
  tags: JSON.stringify(['Tech', 'Innovation']),
  profileType: ProfileType.STANDARD,
  isActive: false,
  visibilityScore: 0.8,
},
  ];

  for (const p of participants) {
    const qrToken = encryptQrToken(p.id, QR_SECRET);
    await prisma.participant.upsert({
      where: { id: p.id },
      create: { ...p, badgeQrToken: qrToken },
      update: { ...p, badgeQrToken: qrToken },
    });
    console.log(`   ✓ ${p.firstName} ${p.lastName} — ${p.email}`);
    console.log(`     QR token: ${qrToken.substring(0, 30)}...`);
  }

  const tables = [
    { id: 't-01', number: 1, room: 'Salle A', qrToken: 'table-qr-01' },
    { id: 't-02', number: 2, room: 'Salle A', qrToken: 'table-qr-02' },
    { id: 't-03', number: 3, room: 'Salle B', qrToken: 'table-qr-03' },
    { id: 't-04', number: 4, room: 'Salle B', qrToken: 'table-qr-04' },
    { id: 't-05', number: 5, room: 'Salle C', qrToken: 'table-qr-05' },
  ];

  for (const table of tables) {
    await prisma.table.upsert({
      where: { id: table.id },
      create: table,
      update: table,
    });
  }

  const day1 = new Date('2026-06-15');
  const day2 = new Date('2026-06-16');
  const slots = [];
  let slotIdx = 1;

  for (const day of [day1, day2]) {
    const hours = [9, 9.5, 10, 10.5, 11, 14, 14.5, 15, 15.5, 16];
    for (let i = 0; i < hours.length; i++) {
      const h = Math.floor(hours[i]);
      const m = hours[i] % 1 === 0.5 ? 30 : 0;
      const startTime = new Date(day);
      startTime.setHours(h, m, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 20);
      slots.push({
        id: `slot-${slotIdx++}`,
        eventDay: day,
        startTime,
        endTime,
        tableId: tables[i % tables.length].id,
        isAvailable: true,
      });
    }
  }

  for (const slot of slots) {
    await prisma.timeSlot.upsert({
      where: { id: slot.id },
      create: slot,
      update: slot,
    });
  }

  console.log(`\n✅ Seeded:`);
  console.log(`   - ${participants.length} participants`);
  console.log(`   - ${tables.length} tables`);
  console.log(`   - ${slots.length} time slots`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());