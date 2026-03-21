'use strict';

const nodemailer = require('nodemailer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function createTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Dev mode: log emails to console
  return null;
}

async function sendEmail({ to, subject, html }) {
  const transport = createTransport();
  if (!transport) {
    console.log(`\n📧 [DEV EMAIL] To: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, '')}\n`);
    return;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'PochaSet <noreply@pochaset.com>',
    to, subject, html,
  });
}

async function sendVerificationEmail(email, token) {
  const url = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: '🌶️ Confirma tu cuenta de PochaSet',
    html: `
      <h2>¡Bienvenido a PochaSet! 🌶️</h2>
      <p>Pulsa el enlace para confirmar tu correo electrónico:</p>
      <p><a href="${url}" style="background:#c0392b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmar cuenta</a></p>
      <p>O copia este enlace: ${url}</p>
      <p><small>Este enlace expira en 24 horas.</small></p>
    `,
  });
}

async function sendResetEmail(email, token) {
  const url = `${BASE_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: '🔑 Recupera tu contraseña de PochaSet',
    html: `
      <h2>Recuperación de contraseña 🔑</h2>
      <p>Pulsa el enlace para establecer una nueva contraseña:</p>
      <p><a href="${url}" style="background:#c0392b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Cambiar contraseña</a></p>
      <p>O copia este enlace: ${url}</p>
      <p><small>Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</small></p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendResetEmail };
