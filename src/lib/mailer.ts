import nodemailer from "nodemailer";

export type MailPayload = { to: string[]; subject: string; html: string; text?: string };

function isMailEnabled() {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}

export async function sendMail(payload: MailPayload) {
  if (!isMailEnabled()) {
    console.log("[MAIL DISABLED] Would send:", { to: payload.to, subject: payload.subject, text: payload.text });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;
  await transporter.sendMail({
    from,
    to: payload.to.join(","),
    subject: payload.subject,
    html: payload.html,
    text: payload.text
  });
}
