'use strict';

const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM, APP_URL } = require('../config/env');

function makeTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendPasswordResetEmail(email, token) {
  const transport = makeTransport();
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const message = {
    from: EMAIL_FROM,
    to: email,
    subject: 'Recuperação da palavra-passe',
    text: `Clique no link para redefinir a sua palavra-passe: ${resetUrl}`,
    html: `<p>Para recuperar a sua palavra-passe, clique no link abaixo:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  };

  if (process.env.NODE_ENV === 'test' && (!SMTP_HOST || !SMTP_USER || !SMTP_PASS)) {
    return { ok: true, previewUrl: resetUrl };
  }

  const info = await transport.sendMail(message);
  return { ok: true, messageId: info.messageId || null };
}

module.exports = { sendPasswordResetEmail };
