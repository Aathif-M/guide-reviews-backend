const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'aathifm99@gmail.com';
    const password = 'password123';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        if (existingUser.role !== 'ADMIN') {
            await prisma.user.update({
                where: { email },
                data: { role: 'ADMIN' }
            });
            console.log('User upgraded to ADMIN');
        } else {
            console.log('Admin already exists');
        }
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
        data: {
            email,
            passwordHash,
            firstName: 'Aathif',
            lastName: 'M',
            role: 'ADMIN'
        }
    });
    console.log('Admin created successfully with password: password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
