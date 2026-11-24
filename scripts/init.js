'use strict';
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../db');
const email = process.env.ADMIN_EMAIL, pass = process.env.ADMIN_PASSWORD, name = process.env.ADMIN_NAME || 'Administrador';
if (!email || !pass || pass.length < 12) {
    console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres).');
    process.exitCode = 1;
} else {
    main();
}

async function main() {
    try {
        const hash = bcrypt.hashSync(pass, 12);
        await db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(name, email, hash, 'admin');
        console.log('Conta administrativa criada.');
    } catch (error) {
        console.error('Não foi possível criar a conta:', error.message);
        process.exitCode = 1;
    } finally {
        await db.disconnect();
    }
}
