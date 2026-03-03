const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding data for browser verification...');

    // Create an Admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@guide.com' },
        update: {},
        create: {
            email: 'admin@guide.com',
            passwordHash: adminPassword,
            firstName: 'System',
            lastName: 'Admin',
            role: 'ADMIN',
        },
    });
    console.log('Admin account created / verified.');

    // Create a General user
    const userPassword = await bcrypt.hash('user123', 10);
    const user = await prisma.user.upsert({
        where: { email: 'user@guide.com' },
        update: {},
        create: {
            email: 'user@guide.com',
            passwordHash: userPassword,
            firstName: 'Test',
            lastName: 'User',
            role: 'USER',
        },
    });
    console.log('Test User account created / verified.');

    // Create a dummy category
    const category = await prisma.category.upsert({
        where: { name: 'Health & Medical' },
        update: {},
        create: {
            name: 'Health & Medical',
            description: 'Apps related to managing health, medications, and doctors.',
        },
    });

    // Create an approved App so we can view AppDetails
    const app = await prisma.app.create({
        data: {
            title: 'MedicaReminder Pro',
            description: 'A simple app designed for older adults to remember when to take their daily medications. Features large text and loud alarms.',
            playstoreLink: 'https://play.google.com/store',
            categoryId: category.id,
            submitterId: user.id,
            approverId: admin.id,
            approvalStatus: 'APPROVED'
        }
    });
    console.log('Test App created:', app.id);

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
