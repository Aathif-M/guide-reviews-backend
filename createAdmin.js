const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@guide.com';
    const password = 'admin'; // simple password

    // Check if the admin exists
    const existingAdmin = await prisma.user.findUnique({ where: { email } });

    if (existingAdmin) {
        console.log(`Admin user already exists with email: ${email}`);
        return;
    }

    const adminPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
        data: {
            email: email,
            passwordHash: adminPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'ADMIN',
        },
    });
    console.log(`Successfully created admin user: \nEmail: ${email}\nPassword: ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
