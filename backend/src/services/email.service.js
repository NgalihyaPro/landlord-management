const nodemailer = require('nodemailer');
const { buildFrontendUrl } = require('../utils/frontend-url.utils');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const RESET_PASSWORD_HOURS = Number(process.env.PASSWORD_RESET_HOURS || 1);

let transporterPromise;

const isEmailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_FROM_EMAIL
  );

const isEmailDeliveryRequired = () =>
  process.env.EMAIL_DELIVERY_REQUIRED === 'true';

const getFromAddress = () => {
  const email = process.env.SMTP_FROM_EMAIL;
  const name = process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'LandlordPro';

  return name ? `"${name}" <${email}>` : email;
};

const getTransporter = async () => {
  if (!isEmailConfigured()) {
    throw new Error('Email delivery is not configured.');
  }

  if (!transporterPromise) {
    transporterPromise = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure:
        process.env.SMTP_SECURE === 'true' ||
        Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD || '',
          }
        : undefined,
    });
  }

  return transporterPromise;
};

const sendMail = async ({ to, subject, html, text }) => {
  if (!isEmailConfigured()) {
    if (isEmailDeliveryRequired()) {
      throw new Error('Email delivery is not configured.');
    }

    console.warn(`[mail:skipped] ${subject} -> ${to}`);
    return { delivered: false, skipped: true };
  }

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    text,
  });

  return { delivered: true, skipped: false };
};

const createInviteEmailBody = ({
  heading,
  intro,
  actionLabel,
  actionUrl,
  expiresText,
  footer,
}) => {
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#162033;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #e5eaf2;">
        <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#6b7a90;margin:0 0 12px;">LandlordPro</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">${heading}</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">${intro}</p>
        <p style="margin:0 0 28px;">
          <a href="${actionUrl}" style="display:inline-block;background:#0f8bff;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">
            ${actionLabel}
          </a>
        </p>
        <p style="margin:0 0 14px;font-size:14px;color:#4b5a70;">If the button does not open, use this secure link:</p>
        <p style="word-break:break-all;margin:0 0 20px;font-size:14px;color:#0f8bff;">${actionUrl}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#4b5a70;">${expiresText}</p>
        <p style="margin:0;font-size:13px;color:#6b7a90;">${footer}</p>
      </div>
    </div>
  `;

  const text = `${heading}\n\n${intro}\n\n${actionLabel}: ${actionUrl}\n\n${expiresText}\n\n${footer}`;

  return { html, text };
};

const sendOwnerInviteEmail = async ({ email, fullName, inviteLink, expiresAt, invitedByEmail }) => {
  const message = createInviteEmailBody({
    heading: 'Your landlord workspace invite is ready',
    intro: `Hello${fullName ? ` ${fullName}` : ''}, you have been invited${invitedByEmail ? ` by ${invitedByEmail}` : ''} to create your landlord workspace in LandlordPro.`,
    actionLabel: 'Complete landlord registration',
    actionUrl: inviteLink,
    expiresText: `This invite expires on ${new Date(expiresAt).toLocaleString()}.`,
    footer: 'If you were not expecting this invitation, you can ignore this email.',
  });

  return sendMail({
    to: email,
    subject: 'LandlordPro landlord registration invite',
    ...message,
  });
};

const sendStaffInviteEmail = async ({
  email,
  fullName,
  roleName,
  organizationName,
  setupLink,
  expiresAt,
  invitedByName,
}) => {
  const message = createInviteEmailBody({
    heading: 'You have been invited to join LandlordPro',
    intro: `Hello${fullName ? ` ${fullName}` : ''}, ${invitedByName || 'A landlord administrator'} invited you to join ${organizationName} as ${roleName}.`,
    actionLabel: 'Set up your account',
    actionUrl: setupLink,
    expiresText: `This invite expires on ${new Date(expiresAt).toLocaleString()}.`,
    footer: 'Use the link above to choose your password and activate your access.',
  });

  return sendMail({
    to: email,
    subject: `LandlordPro invite for ${organizationName}`,
    ...message,
  });
};

const createPasswordResetLink = (token) => buildFrontendUrl(`/reset-password/${token}`);

const sendPasswordResetEmail = async ({ email, fullName, resetLink, expiresAt }) => {
  const message = createInviteEmailBody({
    heading: 'Reset your LandlordPro password',
    intro: `Hello${fullName ? ` ${fullName}` : ''}, we received a request to reset your password.`,
    actionLabel: 'Reset password',
    actionUrl: resetLink,
    expiresText: `This reset link expires on ${new Date(expiresAt).toLocaleString()}.`,
    footer: 'If you did not request a password reset, you can ignore this email and your password will stay the same.',
  });

  return sendMail({
    to: email,
    subject: 'Reset your LandlordPro password',
    ...message,
  });
};

module.exports = {
  RESET_PASSWORD_HOURS,
  isEmailConfigured,
  sendOwnerInviteEmail,
  sendStaffInviteEmail,
  createPasswordResetLink,
  sendPasswordResetEmail,
};
