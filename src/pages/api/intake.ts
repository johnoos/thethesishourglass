export const prerender = false;
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { env } from 'cloudflare:workers';

const MAX = { short: 200, long: 3000 };

// Escape anything a visitor typed before it goes into the HTML email.
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const reply = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    // Read the body as JSON (the form's normal route) or as a plain form post.
    let body: Record<string, unknown> = {};
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = (await request.json()) as Record<string, unknown>;
    } else {
      const data = await request.formData();
      data.forEach((value, key) => {
        body[key] = typeof value === 'string' ? value : '';
      });
    }

    // Spam trap: real visitors never fill this hidden field.
    if (clean(body['security-token'], 100)) return reply({ success: true });

    const kind = clean(body.kind, 20) === 'question' ? 'question' : 'apply';
    const name = clean(body.name, MAX.short);
    const email = clean(body.email, MAX.short);
    const institution = clean(body.institution, MAX.short);
    const stage = clean(body.stage, MAX.short);
    const writing = clean(body.writing, MAX.short);
    const timezone = clean(body.timezone, MAX.short);
    const message = clean(body.message, MAX.long);
    const consent = clean(body.consent, 10);

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ error: 'Please check your name and email address.' }, 400);
    }
    if (consent !== 'yes') {
      return reply({ error: 'Please tick the consent box.' }, 400);
    }
    if (kind === 'question' && !message) {
      return reply({ error: 'Please write your question.' }, 400);
    }

    const heading = kind === 'apply' ? 'Application' : 'Question';
    const subject = `${heading} from ${name}`.replace(/[\r\n]+/g, ' ');

    const rows: [string, string][] = [
      ['Name', name],
      ['Email', email],
      ['University and department', institution],
      ['Stage', stage],
      ['Already has writing', writing],
      ['Time zone', timezone],
    ];
    const tableHtml = rows
      .filter(([, value]) => value)
      .map(([label, value]) => `<p><strong>${label}:</strong> ${esc(value)}</p>`)
      .join('');
    const messageHtml = message
      ? `<p><strong>${kind === 'apply' ? 'Topic' : 'Question'}:</strong></p><blockquote style="background:#f4f6f5; padding:15px; border-left:3px solid #127C44;">${esc(message).replace(/\n/g, '<br />')}</blockquote>`
      : '';

    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: 'The Thesis Hourglass <forms@send.johnoosthuizen.com>',
      to: ['john@johnoosthuizen.com'],
      replyTo: email,
      subject,
      html: `<h2>The Thesis Hourglass: ${heading.toLowerCase()}</h2>${tableHtml}${messageHtml}`,
      text: [
          `${heading} from ${name}`,
          ...rows.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
          message ? `\n${message}` : '',
].join('\n'),
    });

    if (error) throw new Error(error.message);
    return reply({ success: true });
  } catch (err) {
    // Log the detail for yourself, but do not show it to visitors.
    console.error('Intake form failed:', err);
    return reply({ error: 'Something went wrong on our side.' }, 500);
  }
};
