'use strict';

const nodemailer = require('nodemailer');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Parse "Name <email>" format
function parseSender(from) {
  const m = (from || '').match(/^(.+?)\s*<(.+?)>$/);
  return m
    ? { name: m[1].trim(), email: m[2].trim() }
    : { name: 'PochaSet', email: from || 'noreply@pochaset.com' };
}

// ── Brevo HTTP API (works on Render — uses HTTPS port 443) ──
async function sendViaBrevoApi({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY no configurado');

  const sender = parseSender(process.env.SMTP_FROM);
  console.log(`[Email] Usando Brevo API → ${to}`);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${body}`);
  console.log(`[Email] ✅ Brevo API OK — respuesta: ${body}`);
}

// ── Nodemailer SMTP (funciona en local) ─────────────────────
async function sendViaSmtp({ to, subject, html }) {
  console.log('[Email] Usando SMTP:', {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || '587',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS ? `***${process.env.SMTP_PASS.slice(-4)}` : '(vacío)',
  });

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || 'PochaSet <noreply@pochaset.com>',
    to, subject, html,
  });
  console.log(`[Email] ✅ SMTP OK — messageId: ${info.messageId}`);
}

// ── Selector automático ──────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  console.log(`[Email] Intentando enviar a: ${to} | Asunto: ${subject}`);

  // 1. Brevo API (preferido en producción — no usa SMTP)
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevoApi({ to, subject, html });
  }

  // 2. SMTP genérico (para local u otros proveedores)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      return await sendViaSmtp({ to, subject, html });
    } catch (err) {
      console.error(`[Email] ❌ SMTP falló:`, err.message);
      throw err;
    }
  }

  // 3. Sin configuración — modo desarrollo
  console.warn('[Email] ⚠️  Sin BREVO_API_KEY ni SMTP — imprimiendo en consola:');
  console.log(`\n📧 [DEV EMAIL]\nTo: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, '')}\n`);
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
