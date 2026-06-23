require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ─── FILE PATHS ───────────────────────────────────────────────────────────────
const DATA_DIR       = process.env.DATA_DIR || path.join(__dirname, 'data');
const FOLLOWUPS_FILE = process.env.FOLLOWUPS_FILE || path.join(__dirname, 'followups.json');
const SETTINGS_FILE  = path.join(DATA_DIR, 'settings.csv');
const CONTACTS_FILE  = path.join(DATA_DIR, 'contacts.csv');
const LOG_FILE       = path.join(DATA_DIR, 'log.csv');

// ─── AI PROVIDER ──────────────────────────────────────────────────────────────
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
const AI_MODEL    = process.env.AI_MODEL || 'anthropic/claude-haiku-4-5';

const AI_SAFETY_SUFFIX = `

CRITICAL RULES — apply to every response without exception:
- Never say "As an AI", "I'm an AI", "As a language model", "As an assistant", or any variation
- Never mention that you are artificial intelligence, a chatbot, automated, or a program
- Never say you "don't have personal opinions", "can't feel", or "don't have experiences"
- Never use corporate filler: "Certainly!", "Absolutely!", "Of course!", "Great question!", "Sure thing!"
- Never start a message with the word "I"
- Never use hashtags
- Write as a warm, knowledgeable human representative of this local Bahamian business`;

async function callAI(systemPrompt, userPrompt, maxTokens = 300) {
  const safeSystem = systemPrompt + AI_SAFETY_SUFFIX;
  try {
    if (AI_PROVIDER === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://lucayanlabs.com',
          'X-Title': 'Cay AI WhatsApp Agent',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: safeSystem },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      const data = await res.json();
      if (data.error) { console.error('OpenRouter error:', data.error.message); return { text: null, tokens: 0 }; }
      const tokens = data.usage?.total_tokens || 0;
      console.log(`🔢 Tokens used: ${tokens} (model: ${AI_MODEL})`);
      return { text: data.choices?.[0]?.message?.content?.trim() || null, tokens };
    }

    if (AI_PROVIDER === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: maxTokens,
          system: safeSystem,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await res.json();
      const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      console.log(`🔢 Tokens used: ${tokens} (model: ${AI_MODEL})`);
      return { text: data.content?.[0]?.text?.trim() || null, tokens };
    }

    if (AI_PROVIDER === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: safeSystem },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      const data = await res.json();
      const tokens = data.usage?.total_tokens || 0;
      console.log(`🔢 Tokens used: ${tokens} (model: ${AI_MODEL})`);
      return { text: data.choices?.[0]?.message?.content?.trim() || null, tokens };
    }

    if (AI_PROVIDER === 'google') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${safeSystem}\n\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens: maxTokens }
        })
      });
      const data = await res.json();
      const tokens = data.usageMetadata?.totalTokenCount || 0;
      console.log(`🔢 Tokens used: ${tokens} (model: ${AI_MODEL})`);
      return { text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null, tokens };
    }

  } catch (e) {
    console.error('AI call failed:', e.message);
    return { text: null, tokens: 0 };
  }
}

async function generateMessage(intent, contact, settings, tokenLimit = null, purposeGuide = null) {
  const tone = settings.tone || 'friendly-pro';
  const bizName = settings.business_name || 'us';
  const signature = settings.signature || `- ${bizName}`;
  const businessContext = settings.business_context || '';
  const customInstructions = settings.custom_instructions || '';
  const languageStyle = settings.language_style || 'standard';
  const avoidWords = settings.avoid_words || '';
  const maxTokens = tokenLimit || parseInt(settings.token_limit_send) || 300;

  const lengthGuide = {
    'short':  'Keep it under 50 words.',
    'medium': 'Keep it under 80 words.',
    'long':   'Keep it under 120 words.',
  };
  const msgLength = lengthGuide[settings.message_length] || lengthGuide['medium'];

  const toneGuide = {
    'friendly-pro': 'warm, professional, and friendly. Like a trusted local business owner.',
    'formal':       'formal and professional. Like a corporate letter.',
    'casual':       'casual and relaxed. Like texting a friend.',
    'sales':        'confident and benefit-focused. Like a helpful salesperson.',
  };
  const validTones = Object.keys(toneGuide);
  const safeTone = validTones.includes(tone) ? tone : 'friendly-pro';

  const langGuide = {
    'standard':       'Write in clear standard English.',
    'bahamian':       'Write in a warm Bahamian style. You can use light local expressions naturally.',
    'formal-english': 'Write in formal British English.',
  };
  const langStyle = langGuide[languageStyle] || langGuide['standard'];

  const contactInfo = contact
    ? `Contact name: ${contact.name}. Business: ${contact.business || 'N/A'}. Notes: ${contact.notes || 'none'}.`
    : 'No contact info available.';

  const responseWindow = settings.response_window || '';

  const systemPrompt = `You are a WhatsApp messaging assistant for ${bizName}, a small business in the Bahamas.
${businessContext ? `About the business: ${businessContext}` : ''}
${responseWindow ? `Owner response window: ${responseWindow}. If messaging outside these hours, set expectations accordingly — do not imply instant human response.` : ''}
Write natural WhatsApp messages at a 9th grade reading level.
Tone: ${toneGuide[safeTone]}
Language: ${langStyle}
${purposeGuide ? `Message purpose: ${purposeGuide}` : ''}
Rules:
- ${msgLength}
- Sound like a real person, not a bot
- Do not use hashtags or excessive emojis (max 1)
- Do not include a subject line
- Sign off with exactly: ${signature}
- Never mention you are AI${avoidWords ? `\n- Never use these words or phrases: ${avoidWords}` : ''}${customInstructions ? `\nAdditional instructions: ${customInstructions}` : ''}`;

  const userPrompt = `${contactInfo}\nWrite a WhatsApp message with this intent: "${intent}"`;
  const result = await callAI(systemPrompt, userPrompt, maxTokens);
  if (result.text) return { message: result.text, tokens: result.tokens };
  console.warn('⚠️ AI unavailable, using template fallback');
  return { message: buildTemplateFallback(intent, contact, settings), tokens: 0 };
}

async function generateCheckin(contact, settings, purposeGuide = null) {
  const bizName = settings.business_name || 'us';
  const signature = settings.signature || `- ${bizName}`;
  const tone = settings.tone || 'friendly-pro';
  const name = contact ? contact.name.split(' ')[0] : '';
  const notes = contact?.notes || '';
  const customInstructions = settings.custom_instructions || '';
  const avoidWords = settings.avoid_words || '';
  const maxTokens = parseInt(settings.token_limit_checkin) || 150;
  const toneGuide = {
    'friendly-pro': 'warm, professional, and friendly',
    'formal':       'formal and professional',
    'casual':       'casual and relaxed',
    'sales':        'confident and helpful',
  };
  const validTones = Object.keys(toneGuide);
  const safeTone = validTones.includes(tone) ? tone : 'friendly-pro';
  const systemPrompt = `You are a WhatsApp messaging assistant for ${bizName}, a small business in the Bahamas.
Write short natural check-in messages at a 9th grade reading level.
Tone: ${toneGuide[safeTone]}
${purposeGuide ? `Message purpose: ${purposeGuide}` : ''}
Rules:
- Under 60 words
- Sound like a real person, not a bot
- Max 1 emoji
- Sign off with exactly: ${signature}
- Never mention you are AI${avoidWords ? `\n- Never use these words or phrases: ${avoidWords}` : ''}${customInstructions ? `\nAdditional instructions: ${customInstructions}` : ''}`;
  const userPrompt = `Write a friendly check-in WhatsApp message${name ? ` for ${name}` : ''}.${notes ? ` Context: ${notes}` : ''}`;
  const result = await callAI(systemPrompt, userPrompt, maxTokens);
  if (result.text) return { message: result.text, tokens: result.tokens };
  const fallbacks = [
    `Hi ${name || 'there'}! Just checking in to see how everything is going. Hope all is well! 😊\n\n${signature}`,
    `Hi ${name || 'there'}! Wanted to reach out and see if there is anything we can help you with.\n\n${signature}`,
    `Hi ${name || 'there'}! Hope you are having a great week. Just wanted to check in!\n\n${signature}`,
  ];
  return { message: fallbacks[Math.floor(Math.random() * fallbacks.length)], tokens: 0 };
}

// ─── CANNED RESPONSE POOLS ────────────────────────────────────────────────────
// pick() selects a random item from an array — used to rotate canned replies so
// no two conversations feel identical even when AI is not involved.
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const CANNED = {
  greeting: (name, bizLine, sig) => pick([
    `${name ? `Hey ${name}!` : `Hey!`} Thanks for reaching out. 👋\n\n${bizLine}\n\nHow can we help you today?\n\n${sig}`,
    `${name ? `Hi ${name}!` : `Hi there!`} Thanks for getting in touch.\n\n${bizLine}\n\nWhat can we do for you?\n\n${sig}`,
    `${name ? `Hey ${name},` : `Hey,`} glad you messaged us!\n\n${bizLine}\n\nWhat's on your mind?\n\n${sig}`,
    `${name ? `Hi ${name}!` : `Hi!`}\n\n${bizLine}\n\nWhat can we help you with today?\n\n${sig}`,
  ]),

  call: (name, link, sig) => pick([
    `${name ? `Hey ${name}! ` : `Hey! `}Love that energy — let's link up. 📞 Book your free consultation right here:\n${link}\n\nWe'll walk you through everything, step by step.\n\n${sig}`,
    `${name ? `${name}, ` : ``}absolutely — a quick call is the fastest way to get you sorted. 🗓️\n\n${link}\n\nPick a time that works for you and we'll make it happen.\n\n${sig}`,
    `${name ? `Hi ${name}! ` : `Hi! `}We'd love to connect. Book a free call here and we'll get you all the info:\n${link}\n\n${sig}`,
    `${name ? `${name}! ` : ``}A conversation is worth a thousand messages — book a slot here: 📅\n${link}\n\nWe'll take it from there.\n\n${sig}`,
    `${name ? `Hey ${name}, ` : `Hey, `}let's talk. Grab a free spot on our calendar and we'll sort you out properly:\n${link}\n\n${sig}`,
    `${name ? `${name}, ` : ``}perfect — let's get on a quick call and make sure you leave with exactly what you need. 🤝\n\n${link}\n\n${sig}`,
    `${name ? `Hi ${name}! ` : `Hi! `}We're ready when you are. Book your free consult here:\n${link}\n\nLooking forward to speaking with you!\n\n${sig}`,
  ]),

  hotLead: (name, link, sig) => pick([
    `${name ? `${name}! ` : ``}Now we're talking! 🔥 Let's get you set up properly — book a free call here:\n${link}\n\nOr fire away any questions, we're right here.\n\n${sig}`,
    `${name ? `Hey ${name}! ` : `Hey! `}You're asking the right questions. 💯 Here's how to get started:\n${link}\n\nWe'll handle the rest.\n\n${sig}`,
    `${name ? `${name}, ` : ``}we love to see it! 🙌 Book a quick call and we'll get everything moving:\n${link}\n\n${sig}`,
    `${name ? `Hey ${name}! ` : `Hey! `}This is exactly what Cay AI was built for — your business, on autopilot. 🚀\n\nLet's talk:\n${link}\n\n${sig}`,
    `${name ? `${name}! ` : ``}Great timing. Businesses in the Bahamas are already using this to win more clients every week. Let's get you in:\n${link}\n\n${sig}`,
    `${name ? `${name}, ` : ``}you're one call away from having this running for your business. 🇧🇸 Book here:\n${link}\n\nWe keep it simple.\n\n${sig}`,
    `${name ? `Hi ${name}! ` : `Hi! `}Ready to see what's possible? Let's get on a quick call:\n${link}\n\nWe'll show you exactly how it works for businesses like yours.\n\n${sig}`,
  ]),

  complaint: (name, sig) => pick([
    `${name ? `${name}, ` : ``}thanks for letting us know — that's not the experience we want for you at all. Someone from our team will personally follow up with you very shortly.\n\n${sig}`,
    `${name ? `Hey ${name}, ` : `Hey, `}we hear you and we're sorry for the trouble. 🙏 We're on it — someone will reach back out to you real soon.\n\n${sig}`,
    `${name ? `Hi ${name}. ` : `Hi. `}Thank you for taking the time to tell us. We take this seriously and a member of our team will be in touch with you personally.\n\n${sig}`,
    `${name ? `${name}, ` : ``}we appreciate you flagging this — that's not good enough on our end. We're going to get this sorted for you.\n\n${sig}`,
    `${name ? `Hey ${name} — ` : `Hey — `}first, we're sorry. That should not have happened. Our team will be back with you shortly to make it right. 🤝\n\n${sig}`,
    `${name ? `${name}, ` : ``}thank you for reaching out. We don't take concerns lightly — someone will personally follow up with you soon.\n\n${sig}`,
    `${name ? `Hi ${name}. ` : `Hi. `}We're sorry to hear that. We'll have the right person reach back out to you shortly — we'll sort this out together.\n\n${sig}`,
  ]),

  bookingConfirmation: (name, sig) => pick([
    `${name ? `${name}, ` : ``}you're confirmed! 🗓️ We're looking forward to it. If anything changes on your end, just let us know.\n\n${sig}`,
    `${name ? `Perfect, ${name}! ` : `Perfect! `}All locked in. We'll see you then — reach out if you need anything before.\n\n${sig}`,
    `${name ? `${name}! ` : ``}Confirmed and on the calendar. 📅 Looking forward to speaking with you!\n\n${sig}`,
    `${name ? `Got it, ${name}! ` : `Got it! `}You're all set. We're looking forward to connecting — talk soon. 🤝\n\n${sig}`,
    `${name ? `${name}, ` : ``}perfect — confirmed! We'll be ready for you. Just reach back out if anything changes.\n\n${sig}`,
    `${name ? `${name}! ` : ``}That's locked in. 🇧🇸 Looking forward to a great conversation — see you then.\n\n${sig}`,
    `${name ? `Confirmed, ${name}. ` : `Confirmed! `}We'll be there. Feel free to message us in the meantime if you have any questions.\n\n${sig}`,
  ]),

  referral: (name, sig) => pick([
    `${name ? `${name}, ` : ``}thank you so much — that means the world to us! 🙏 We'll be sure to take good care of them. Our team will follow up with the details shortly.\n\n${sig}`,
    `${name ? `${name}! ` : ``}Big up for thinking of us — we really appreciate the love. 🇧🇸 Our team will reach out to them soon.\n\n${sig}`,
    `${name ? `Hey ${name}, ` : `Hey, `}referrals like this keep us going — thank you! We'll personally reach out to them.\n\n${sig}`,
    `${name ? `${name}, ` : ``}we appreciate you spreading the word! 🤝 Our team will take it from here and make sure they're well looked after.\n\n${sig}`,
    `${name ? `${name}! ` : ``}That's so kind of you — thank you for the referral. We'll follow up with them shortly.\n\n${sig}`,
    `${name ? `Hey ${name} — ` : `Hey — `}referrals are the highest compliment we could receive. Thank you! 🙌 We'll be in touch with them soon.\n\n${sig}`,
    `${name ? `${name}, ` : ``}you're the best — thank you! Our team will reach out to them and make sure they're looked after properly.\n\n${sig}`,
  ]),

  wrongNumber: (sig) => pick([
    `Hey! Looks like this might've come to the wrong number — no worries at all. 😊 If we can ever help your business grow, we're right here.\n\n${sig}`,
    `Hi there! This might be a wrong number, but no stress. Feel free to reach back out if Cay AI can ever help your business. 🇧🇸\n\n${sig}`,
    `Hey! We think this message may have been meant for someone else, but no harm done. 😊 Reach out anytime if we can help!\n\n${sig}`,
    `Hi! Looks like a wrong turn — happens to the best of us. 😄 If you ever want to see what we do, we're always here.\n\n${sig}`,
    `Hey there! Wrong number perhaps, but if you're ever looking to grow your business with AI, we'd love to chat. 🚀\n\n${sig}`,
  ]),

  optOut: (name, sig) => pick([
    `${name ? `${name}, ` : ``}no problem at all — you've been removed from our list and we won't reach out again. If you ever change your mind, we're always here. 🙏\n\n${sig}`,
    `${name ? `Hi ${name}. ` : `Hi. `}Understood — we've taken you off our outreach list. No hard feelings! Reach back out anytime.\n\n${sig}`,
    `${name ? `${name}, ` : ``}done — you're removed. We respect that completely. If you ever want to reconnect, our door is open. 🇧🇸\n\n${sig}`,
    `${name ? `Hi ${name}! ` : `Hi! `}You're all set — removed from our list. We hope we were helpful while it lasted. Wishing you all the best! 🙏\n\n${sig}`,
    `${name ? `${name}, ` : ``}considered it done. You won't hear from us again unless you reach out. Take care! 😊\n\n${sig}`,
  ]),

  outsideHours: (name, window, sig) => pick([
    `${name ? `Hey ${name}! ` : `Hey! `}We got your message — thanks for reaching out. 🙏 We're currently outside our response hours (${window}), but we'll get back to you first thing when we're back.\n\n${sig}`,
    `${name ? `Hi ${name}, ` : `Hi, `}we see your message! We're not available right now, but we'll follow up during our hours: ${window}. We got you. 😊\n\n${sig}`,
    `${name ? `Hey ${name} — ` : `Hey — `}thanks for reaching out! We're closed right now but we're taking note of your message. We'll be back to you within our hours (${window}). 🇧🇸\n\n${sig}`,
    `${name ? `Hi ${name}! ` : `Hi! `}Your message came in outside our response window (${window}). We'll follow up as soon as we're back — we don't miss messages. 🙏\n\n${sig}`,
  ]),

  bufferReply: (name, sig) => pick([
    `${name ? `Hey ${name}! ` : `Hey! `}Thanks for reaching out — we got your message and someone will get back to you shortly. 🙏\n\n${sig}`,
    `${name ? `Hi ${name}, ` : `Hi, `}we see your message! We'll follow up with you soon.\n\n${sig}`,
    `${name ? `Hey ${name} — ` : `Hey — `}message received! We'll get back to you shortly. 😊\n\n${sig}`,
    `${name ? `Hi ${name}! ` : `Hi! `}Got your message — give us a moment and we'll be right with you. 🇧🇸\n\n${sig}`,
  ]),

  onTheFence: (name, sig) => pick([
    `${name ? `That makes sense, ${name}.` : `That makes sense.`} A lot of small business owners in The Bahamas start feeling the same way once WhatsApp messages start piling up.\n\nThe main thing it does is answer common questions, follow up with leads, and make sure no inquiry gets missed — without you needing to change your WhatsApp number.\n\nWant to test it with one real customer message from your business?\n\n${sig}`,
    `${name ? `Hey ${name}, ` : `Hey, `}totally understand. Most local business owners only start looking at automation once follow-ups and repeat questions start eating up too much time. 🙏\n\nThe goal isn't to replace you — it's to make sure no customer gets missed while you're busy.\n\nWant to send me one example of a message your customers usually ask?\n\n${sig}`,
    `${name ? `${name}, ` : ``}yeah, that makes sense. In The Bahamas, most customers expect a quick WhatsApp reply — especially for tours, food, rentals, salons, and service businesses.\n\nWe've helped a few local owners here stop missing leads without hiring extra staff.\n\nWant to see how it would actually work for your business? Just send me a typical customer message.\n\n${sig}`,
    `${name ? `Hi ${name}! ` : `Hi! `}Being on the fence makes total sense — it's a real decision. 🤝\n\nHere's the short version: it answers your FAQs automatically, follows up with people who don't hear back, and flags anything important for you personally.\n\nWant to try it with a real message from your business?\n\n${sig}`,
  ]),
};

function buildTemplateFallback(intent, contact, settings) {
  const name = contact ? contact.name.split(' ')[0] : '';
  const biz = settings.business_name || 'us';
  const sig = settings.signature || `- ${biz}`;
  const tone = settings.tone || 'friendly-pro';
  const validTones = ['friendly-pro', 'formal', 'casual', 'sales'];
  const safeTone = validTones.includes(tone) ? tone : 'friendly-pro';
  const greetings = { 'friendly-pro': name ? `Hi ${name}!` : 'Hi there!', 'formal': name ? `Dear ${name},` : 'Dear Valued Customer,', 'casual': name ? `Hey ${name}!` : 'Hey!', 'sales': name ? `Hi ${name},` : 'Hi there,' };
  const closings = { 'friendly-pro': `\n\n- ${biz}`, 'formal': `\n\nSincerely,\n${biz}`, 'casual': `\n\n- ${biz} 😊`, 'sales': `\n\nLooking forward to hearing from you!\n- ${biz}` };
  return `${greetings[safeTone]}\n\n${intent}${closings[safeTone]}`;
}

// ─── CSV HELPERS ──────────────────────────────────────────────────────────────
function parseCSV(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf8').trim();
    const lines = raw.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || '');
      return obj;
    });
  } catch (e) { console.error(`Error reading ${filepath}:`, e.message); return []; }
}

function maybeRotateLog() {
  try {
    const LOG_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    const { size } = fs.statSync(LOG_FILE);
    if (size > LOG_MAX_BYTES) {
      fs.renameSync(LOG_FILE, LOG_FILE.replace('.csv', `-${Date.now()}.csv.bak`));
      fs.writeFileSync(LOG_FILE, 'timestamp,to_number,to_name,message,status,tokens,confidence,direction,command\n');
    }
  } catch (_) {}
}

function appendToLog(toNumber, toName, message, status, tokens = '', confidence = '', direction = '', command = '') {
  try {
    maybeRotateLog();
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    // Neutralize CSV formula injection (Excel executes values starting with =+-@)
    const neutralize = (s) => (s || '').replace(/,/g, ' ').replace(/\n/g, ' ').replace(/^[=+\-@]/, "'$&");
    const safeName = neutralize(toName);
    const safeMsg  = neutralize(message);
    fs.appendFileSync(LOG_FILE, `${timestamp},${toNumber},${safeName},${safeMsg},${status},${tokens},${confidence},${direction},${command}\n`);
  } catch (e) { console.error('Error writing to log:', e.message); }
}

function updateLastContacted(number) {
  try {
    const raw = fs.readFileSync(CONTACTS_FILE, 'utf8').trim();
    const lines = raw.split('\n');
    const updated = lines.map((line, i) => {
      if (i === 0) return line;
      const cols = line.split(',');
      if (cols[0].trim().replace(/\D/g, '') === number.replace(/\D/g, '')) {
        cols[5] = new Date().toLocaleDateString();
        return cols.join(',');
      }
      return line;
    });
    fs.writeFileSync(CONTACTS_FILE, updated.join('\n'));
    refreshContactCache();
  } catch (e) { console.error('Error updating last contacted:', e.message); }
}

function getSettings() {
  const rows = parseCSV(SETTINGS_FILE);
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
}

// ─── CONTACT CACHE ─────────────────────────────────────────────────────────────
// Loaded once at startup and refreshed whenever the file changes — avoids
// blocking the event loop by re-parsing CSV on every inbound/outbound operation.
let contactCache = [];
function refreshContactCache() {
  contactCache = parseCSV(CONTACTS_FILE);
}
refreshContactCache();
if (fs.existsSync(CONTACTS_FILE)) {
  fs.watch(CONTACTS_FILE, () => refreshContactCache());
}

function findContact(number) {
  const clean = number.replace(/\D/g, '');
  return contactCache.find(c => c.number.replace(/\D/g, '') === clean) || null;
}

function findContactByName(name) {
  const q = name.toLowerCase().trim();
  return contactCache.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.business && c.business.toLowerCase().includes(q))
  );
}

// Resolves either a phone number or name to { number, contact }
// Returns { resolved: true, rawNumber, contact } or { resolved: false, reply }
function resolveRecipient(input) {
  const clean = input.replace(/\D/g, '');
  if (clean.length >= 7) {
    // Looks like a number
    const contact = findContact(input);
    return { resolved: true, rawNumber: clean, contact };
  }
  // Treat as name
  const matches = findContactByName(input);
  if (matches.length === 0) {
    return { resolved: false, reply: `❌ No contact found named "${input}". Try using their phone number instead.` };
  }
  if (matches.length === 1) {
    return { resolved: true, rawNumber: matches[0].number.replace(/\D/g, ''), contact: matches[0] };
  }
  // Multiple matches
  const list = matches.map((c, i) => `${i + 1}. ${c.name} — ${c.number}${c.business ? ` (${c.business})` : ''}`).join('\n');
  return { resolved: false, reply: `⚠️ Multiple contacts found for "${input}":\n\n${list}\n\nPlease use their phone number to be specific.` };
}

function getContactsByTag(tag) {
  return contactCache.filter(c =>
    c.tags.toLowerCase().split(' ').includes(tag.toLowerCase())
  );
}

function getFAQAnswer(question) {
  const settings = getSettings();
  const q = question.toLowerCase();
  let i = 1;
  while (settings[`faq_${i}_q`]) {
    if (settings[`faq_${i}_q`].toLowerCase().includes(q) ||
        q.includes(settings[`faq_${i}_q`].toLowerCase().split(' ')[0])) {
      return settings[`faq_${i}_a`];
    }
    i++;
  }
  return null;
}

function getStats(dayRange = 7) {
  try {
    if (!fs.existsSync(LOG_FILE)) return null;
    const raw = fs.readFileSync(LOG_FILE, 'utf8').trim();
    const lines = raw.split('\n').filter(l => l.trim()).slice(1);
    if (lines.length === 0) return null;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const rangeAgo = new Date(now - dayRange * 24 * 60 * 60 * 1000);

    let total = 0, today = 0, rangeSent = 0, rangeInbound = 0;
    let hotLeads = 0, optOuts = 0, autoReplied = 0, failed = 0, complaints = 0;
    let totalTokens = 0;
    const allNumbers = new Set();
    const topContact = {};

    // Track outbound times per contact for hot lead velocity
    const hotLeadTimes = {};   // number -> [ts]
    const outboundTimes = {};  // number -> [ts]

    lines.forEach(line => {
      const cols = line.split(',');
      if (cols.length < 5) return;
      const timestamp = cols[0].trim();
      const number = cols[1].trim();
      const status = cols[4].trim().toLowerCase();
      const tokens = parseInt(cols[5]) || 0;
      const direction = (cols[7] || '').trim();
      total++;
      totalTokens += tokens;
      if (number) { allNumbers.add(number); topContact[number] = (topContact[number] || 0) + 1; }

      const lineDate = new Date(timestamp);
      const isToday = timestamp.includes(todayStr) || lineDate.toISOString().slice(0,10) === todayStr;
      const inRange = !isNaN(lineDate) && lineDate >= rangeAgo;

      if (isToday) today++;

      if (inRange) {
        const isSent = direction ? direction === 'out' : (status.includes('sent') || status === 'outbound:manual' || status === 'owner:manual');
        const isInbound = direction ? direction === 'in' : status.includes('received');
        if (isSent) { rangeSent++; outboundTimes[number] = outboundTimes[number] || []; outboundTimes[number].push(lineDate.getTime()); }
        if (isInbound) rangeInbound++;
        if (status.includes('hot')) { hotLeads++; hotLeadTimes[number] = hotLeadTimes[number] || []; hotLeadTimes[number].push(lineDate.getTime()); }
        if (status.includes('opt-out') || status === 'inbound:opt-out') optOuts++;
        if (status.includes('auto')) autoReplied++;
        if (status === 'failed' || status === 'outbound:failed') failed++;
        if (status.includes('complaint')) complaints++;
      }
    });

    // Hot lead velocity: avg minutes from hot-lead event to next outbound to same contact
    let velocities = [];
    Object.entries(hotLeadTimes).forEach(([num, times]) => {
      const outs = (outboundTimes[num] || []).sort((a,b) => a-b);
      times.forEach(t => {
        const next = outs.find(o => o > t);
        if (next) velocities.push(Math.round((next - t) / 60000));
      });
    });
    const avgVelocityMin = velocities.length
      ? Math.round(velocities.reduce((a,b) => a+b,0) / velocities.length)
      : null;

    const topEntry = Object.entries(topContact).sort((a,b) => b[1]-a[1])[0];
    const topContactNum = topEntry ? topEntry[0] : null;
    const topContactName = topContactNum ? (findContact(topContactNum)?.name || topContactNum) : '—';

    const costEst = (totalTokens / 1000000 * 1.25).toFixed(4); // ~$1.25/1M blended (Haiku input+output)

    return {
      total, today, rangeSent, rangeInbound, hotLeads, optOuts, autoReplied,
      failed, complaints, totalTokens, costEst, uniqueContacts: allNumbers.size,
      avgVelocityMin, topContactName, velocityCount: velocities.length,
      // legacy
      week: rangeSent + rangeInbound
    };
  } catch (e) { console.error('getStats error:', e.message); return null; }
}

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
function loadFollowUps() {
  try {
    if (fs.existsSync(FOLLOWUPS_FILE)) return JSON.parse(fs.readFileSync(FOLLOWUPS_FILE, 'utf8'));
  } catch (e) { console.error('Error loading follow-ups:', e.message); }
  return [];
}

function saveFollowUps() {
  try {
    const tmp = FOLLOWUPS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(followUps, null, 2));
    fs.renameSync(tmp, FOLLOWUPS_FILE); // atomic on POSIX — prevents corruption on crash
  } catch (e) { console.error('Error saving follow-ups:', e.message); }
}

let followUps = loadFollowUps();
const pendingPreviews = {};
const demoSessions = {};   // tracks contacts inside the interactive demo flow
const pendingDisambiguation = {}; // { [from]: { options: [{index, question}], expires: timestamp } }

const WMO_CODES = {
  0: 'Clear skies ☀️', 1: 'Mainly clear 🌤️', 2: 'Partly cloudy ⛅', 3: 'Overcast ☁️',
  45: 'Foggy 🌫️', 48: 'Icy fog 🌫️',
  51: 'Light drizzle 🌧️', 53: 'Drizzle 🌧️', 55: 'Heavy drizzle 🌧️',
  61: 'Light rain 🌧️', 63: 'Rain 🌧️', 65: 'Heavy rain 🌧️',
  80: 'Rain showers 🌦️', 81: 'Rain showers 🌦️', 82: 'Heavy showers 🌦️',
  95: 'Thunderstorm ⛈️', 96: 'Thunderstorm ⛈️', 99: 'Thunderstorm ⛈️',
};

// ─── PURPOSE SELECTION ────────────────────────────────────────────────────────
const pendingPurpose = {}; // stores intent/contact/type while awaiting purpose selection

const MESSAGE_PURPOSES = {
  '1': { label: 'Sales & Outreach',  guide: 'This is a sales or outreach message. Be confident and benefit-focused. Include a light call to action. Do not be pushy.' },
  '2': { label: 'Follow Up',         guide: 'This is a follow-up message. Be warm and reference a previous interaction or inquiry. No pressure, just checking in on progress.' },
  '3': { label: 'Relationship',      guide: 'This is a relationship-building message. Be genuine and conversational. Zero sales language. The goal is to connect, not sell.' },
  '4': { label: 'Information',       guide: 'This is an informational message. Be clear, direct, and factual. Share the update or announcement without unnecessary fluff.' },
  '5': { label: 'Support',           guide: 'This is a support message. Be empathetic and helpful. Focus on solving the issue or answering the question.' },
};

const PURPOSE_PROMPT = `What is the *purpose* of this message?\n\n1️⃣ Sales & Outreach — promoting a product or service\n2️⃣ Follow Up — checking on a previous conversation or inquiry\n3️⃣ Relationship — keeping in touch with no agenda\n4️⃣ Information — sharing an update or announcement\n5️⃣ Support — helping with an issue or question\n\nReply with a number (1-5).`;

function parseTime(str) {
  const match = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const mins = parseInt(match[2] || '0');
  const period = (match[3] || '').toLowerCase();
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime();
}

function formatNumber(num) { return num.replace(/\D/g, '') + '@c.us'; }

// Resolve a WhatsApp chat id to real phone number digits.
// getContactById / getContact both return the LID value for @lid chats — the only
// reliable resolver is getContactLidAndPhone() added in whatsapp-web.js ~1.34.
async function resolveRealNumber(chatId) {
  const stripped = chatId.replace('@c.us', '').replace('@lid', '').replace(/\D/g, '');
  if (!chatId.endsWith('@lid')) return stripped; // @c.us is already the real number

  if (typeof client.getContactLidAndPhone === 'function') {
    try {
      const res = await client.getContactLidAndPhone([chatId]);
      const pn = Array.isArray(res) ? res[0]?.pn : res?.pn;
      if (pn) {
        const digits = pn.replace('@c.us', '').replace(/\D/g, '');
        if (digits) return digits;
      }
    } catch (_) {}
  }
  return stripped; // fallback: LID digits are still a valid routing id
}
function isValidNumber(num) {
  const digits = num.replace(/\D/g, '');
  return /^[1-9]\d{6,14}$/.test(digits); // E.164: 7-15 digits, no leading zero
}


// ─── SETUP STATE MACHINE ─────────────────────────────────────────────────────
const setupSessions = {}; // tracks active setup interviews per user
const addContactSessions = {}; // tracks !addcontact menu sessions per owner

const SETUP_STEPS = [
  { key: 'business_name',       question: '👋 Welcome! Let us set up your agent.\n\nWhat is your *business name*?' },
  { key: 'owner_number',        question: '📱 What is your *WhatsApp number* (international format, no + or spaces)?\n_Example: 12425550100_' },
  { key: 'business_context',    question: '🏪 Describe your business in 1-2 sentences.\n_Who are your customers and what do you offer?_' },
  { key: 'tone',                question: '🎨 Choose your messaging *tone*:\n\n1️⃣ Friendly & Professional _(recommended)_\n2️⃣ Formal\n3️⃣ Casual\n4️⃣ Sales Focused\n\nReply with a number (1-4).' },
  { key: 'message_length',      question: '📏 Choose your default *message length*:\n\n1️⃣ Short _(under 50 words)_\n2️⃣ Medium _(under 80 words)_ _(recommended)_\n3️⃣ Long _(under 120 words)_\n\nReply with a number (1-3).' },
  { key: 'language_style',      question: '🗣️ Choose your *language style*:\n\n1️⃣ Standard English _(recommended)_\n2️⃣ Bahamian Style\n3️⃣ Formal English\n\nReply with a number (1-3).' },
  { key: 'signature',           question: '✍️ What should messages *sign off with*?\n_Example: - Island Bites 🍽️_' },
  { key: 'custom_instructions', question: '⚙️ Any *custom rules* for the AI? _(max 200 characters)_\n\nExamples:\n- Always mention free delivery\n- Never use slang\n- Always greet by first name\n\nReply with your rules or type *skip* to leave blank.' },
  { key: 'kb_intro',            question: '📚 Now let us build your *Knowledge Base* (40 entries).\n\nThese help the AI understand your business and answer customer questions accurately.\n\nFor each entry, just type your *answer* — the question is already filled in for you.\nOr type *skip* to leave it blank.\n\nReady? Here we go!' },
  { key: 'kb_1',  prefill: 'What products or services do you offer?',              question: '*1 of 40* — What products or services do you offer?\n\nType your answer or *skip*:' },
  { key: 'kb_2',  prefill: 'What are your business hours?',                        question: '*2 of 40* — What are your business hours?\n\nType your answer or *skip*:' },
  { key: 'kb_3',  prefill: 'Where are you located?',                               question: '*3 of 40* — Where are you located?\n\nType your answer or *skip*:' },
  { key: 'kb_4',  prefill: 'How can customers contact you?',                       question: '*4 of 40* — How can customers contact you? (phone, email, social media)\n\nType your answer or *skip*:' },
  { key: 'kb_5',  prefill: 'What makes your business different from competitors?', question: '*5 of 40* — What makes your business different from competitors?\n\nType your answer or *skip*:' },
  { key: 'kb_6',  prefill: 'What are your prices or price range?',                 question: '*6 of 40* — What are your prices or price range?\n\nType your answer or *skip*:' },
  { key: 'kb_7',  prefill: 'How do customers place an order or book a service?',   question: '*7 of 40* — How do customers place an order or book a service?\n\nType your answer or *skip*:' },
  { key: 'kb_8',  prefill: 'What is your refund or cancellation policy?',          question: '*8 of 40* — What is your refund or cancellation policy?\n\nType your answer or *skip*:' },
  { key: 'kb_9',  prefill: 'Do you offer delivery or pickup?',                     question: '*9 of 40* — Do you offer delivery or pickup?\n\nType your answer or *skip*:' },
  { key: 'kb_10', prefill: 'Do you have any current promotions or specials?',      question: '*10 of 40* — Do you have any current promotions or specials?\n\nType your answer or *skip*:' },
  { key: 'kb_11', prefill: 'What payment methods do you accept?',                  question: '*11 of 40* — What payment methods do you accept?\n\nType your answer or *skip*:' },
  { key: 'kb_12', prefill: 'Do you require a deposit or advance payment?',         question: '*12 of 40* — Do you require a deposit or advance payment?\n\nType your answer or *skip*:' },
  { key: 'kb_13', prefill: 'How long does it take to receive your product or service?', question: '*13 of 40* — How long does it take to receive your product or service?\n\nType your answer or *skip*:' },
  { key: 'kb_14', prefill: 'Do you offer discounts, loyalty rewards, or bulk pricing?', question: '*14 of 40* — Do you offer discounts, loyalty rewards, or bulk pricing?\n\nType your answer or *skip*:' },
  { key: 'kb_15', prefill: 'Can you accommodate custom requests or special orders?', question: '*15 of 40* — Can you accommodate custom requests or special orders?\n\nType your answer or *skip*:' },
  { key: 'kb_16', prefill: 'What areas do you serve or deliver to?',               question: '*16 of 40* — What areas do you serve or deliver to?\n\nType your answer or *skip*:' },
  { key: 'kb_17', prefill: 'How do customers leave a review or testimonial?',      question: '*17 of 40* — How do customers leave a review or testimonial?\n\nType your answer or *skip*:' },
  { key: 'kb_18', prefill: 'Do you have social media pages customers can follow?', question: '*18 of 40* — Do you have social media pages customers can follow?\n\nType your answer or *skip*:' },
  { key: 'kb_19', prefill: 'What is the best way to place an order or get a quote?', question: '*19 of 40* — What is the best way to place an order or get a quote?\n\nType your answer or *skip*:' },
  { key: 'kb_20', prefill: 'Is there anything else important customers should know?', question: '*20 of 40* — Is there anything else important customers should know?\n\nType your answer or *skip*:' },
  { key: 'kb_21', prefill: 'Where are you located or do you offer delivery?',      question: '*21 of 40* — Where are you located or do you offer delivery?\n\nType your answer or *skip*:' },
  { key: 'kb_22', prefill: 'Do customers need to download or install anything?',   question: '*22 of 40* — Do customers need to download or install anything to work with you?\n\nType your answer or *skip*:' },
  { key: 'kb_23', prefill: 'Who is the owner or main contact at the business?',    question: '*23 of 40* — Who is the owner or main contact at the business?\n\nType your answer or *skip*:' },
  { key: 'kb_24', prefill: 'What happens after a customer books or signs up?',     question: '*24 of 40* — What happens after a customer books an appointment or signs up?\n\nType your answer or *skip*:' },
  { key: 'kb_25', prefill: 'Can customers trust that their information is private?',        question: '*25 of 40* — How do you protect customer privacy and information?\n\nType your answer or *skip*:' },
  { key: 'kb_26', prefill: 'Will your customers know they are interacting with AI?',        question: '*26 of 40* — Will your customers know they are interacting with AI or automation?\n\nType your answer or *skip*:' },
  { key: 'kb_27', prefill: 'Can customers or staff customize what is sent on their behalf?', question: '*27 of 40* — Can customers or staff customize the messages sent on their behalf?\n\nType your answer or *skip*:' },
  { key: 'kb_28', prefill: 'What happens if something goes wrong or a mistake is made?',    question: '*28 of 40* — What happens if something goes wrong or a mistake is made?\n\nType your answer or *skip*:' },
  { key: 'kb_29', prefill: 'How fast does your business respond to customers?',             question: '*29 of 40* — How fast does your business typically respond to customer messages?\n\nType your answer or *skip*:' },
  { key: 'kb_30', prefill: 'Can you pause or stop your service temporarily?',              question: '*30 of 40* — Can you pause or stop your service temporarily if needed?\n\nType your answer or *skip*:' },
  { key: 'kb_31', prefill: 'What happens if your systems or internet go down?',            question: '*31 of 40* — What happens if your systems or internet go down?\n\nType your answer or *skip*:' },
  { key: 'kb_32', prefill: 'How do you or your staff know the system is working?',         question: '*32 of 40* — How do you or your staff know the system is working correctly?\n\nType your answer or *skip*:' },
  { key: 'kb_33', prefill: 'Do you have a referral or review program?',                    question: '*33 of 40* — Do you have a referral or review program for customers?\n\nType your answer or *skip*:' },
  { key: 'kb_34', prefill: 'Are there limits on orders messages or transactions?',         question: '*34 of 40* — Are there limits on orders, messages, or transactions?\n\nType your answer or *skip*:' },
  { key: 'kb_35', prefill: 'Do you work with group orders or group bookings?',             question: '*35 of 40* — Do you work with group orders or group bookings?\n\nType your answer or *skip*:' },
  { key: 'kb_36', prefill: 'Can customers transfer or import existing data or accounts?',  question: '*36 of 40* — Can customers transfer or import existing data or accounts?\n\nType your answer or *skip*:' },
  { key: 'kb_37', prefill: 'Can orders or appointments be scheduled in advance?',          question: '*37 of 40* — Can orders or appointments be scheduled in advance?\n\nType your answer or *skip*:' },
  { key: 'kb_38', prefill: 'Do you serve customers outside your main area?',               question: '*38 of 40* — Do you serve customers outside your main area or city?\n\nType your answer or *skip*:' },
  { key: 'kb_39', prefill: 'How long before customers see results or value from you?',     question: '*39 of 40* — How long before customers typically see results or value from your service?\n\nType your answer or *skip*:' },
  { key: 'kb_40', prefill: 'What is the practical difference between your service packages?', question: '*40 of 40* — What is the practical difference between your service packages or tiers?\n\nType your answer or *skip*:' },
];

const TONE_MAP = { '1': 'friendly-pro', '2': 'formal', '3': 'casual', '4': 'sales' };
const LENGTH_MAP = { '1': 'short', '2': 'medium', '3': 'long' };
const LANG_MAP = { '1': 'standard', '2': 'bahamian', '3': 'formal-english' };
const CUSTOM_INSTRUCTIONS_MAX = 200;

// Index of the first KB step (kb_intro) — used to jump over the whole KB block
const KB_INTRO_INDEX = SETUP_STEPS.findIndex(s => s.key === 'kb_intro');

// Logical step count shown to the user: 8 config steps + 1 KB block = 9
const LOGICAL_TOTAL = 9;

// Appends compact nav footer to any setup question string
function withNav(question, step) {
  const stepObj = SETUP_STEPS[step];
  const isKB = stepObj?.key.startsWith('kb_') || stepObj?.key === 'kb_intro';
  if (isKB) {
    // All KB entries display as "Step 9 of 9" with a per-entry counter
    const kbNum = stepObj.key === 'kb_intro' ? 0 : parseInt(stepObj.key.split('_')[1]);
    const kbLabel = stepObj.key === 'kb_intro' ? '' : ` · KB ${kbNum} of 40`;
    return `${question}\n\n_Step 9 of ${LOGICAL_TOTAL}${kbLabel} — type 'skip', 'skipkb', 'back', or '!cancelsetup' to navigate_`;
  }
  // Config steps are 1-indexed by their position before KB_INTRO_INDEX
  const logicalStep = step + 1;
  return `${question}\n\n_Step ${logicalStep} of ${LOGICAL_TOTAL} — type 'skip', 'back', or '!cancelsetup' to navigate_`;
}

// ─── ADD CONTACT WIZARD ───────────────────────────────────────────────────────
const ADD_CONTACT_STEPS = [
  { key: 'number',   question: '📱 *Step 1 of 7* — What is their *WhatsApp number*?\n_(International format, no + or spaces — e.g. 12425550100)_\n\nOr type *cancel* to exit.' },
  { key: 'name',     question: '👤 *Step 2 of 7* — What is their *full name*?' },
  { key: 'business', question: '🏪 *Step 3 of 7* — What is their *business name*?\n_(Type *skip* if individual)_' },
  { key: 'tags',     question: '🏷️ *Step 4 of 7* — Add *tags* (space-separated):\n\nCommon tags: `lead` `prospect` `client` `vip` `inactive`\nYou can also add `stage:demo` `stage:customer` etc.\n\n_(Type *skip* to leave blank)_' },
  { key: 'notes',    question: '📝 *Step 5 of 7* — Any *notes* about this contact?\n_(e.g. Met at expo June 2026 / Interested in tours)_\n_(Type *skip* to leave blank)_' },
  { key: 'email',    question: '📧 *Step 6 of 7* — Their *email address*?\n_(Type *skip* if unknown)_' },
  { key: 'industry', question: '🗂️ *Step 7 of 7* — What *industry* are they in?\n_(e.g. Tourism, Real Estate, Retail, Food & Beverage)_\n_(Type *skip* to leave blank)_' },
];

function appendContact(data) {
  try {
    const row = [
      data.number || '',
      (data.name || '').replace(/,/g, ' '),
      (data.business || '').replace(/,/g, ' '),
      (data.tags || '').replace(/,/g, ' '),
      (data.notes || '').replace(/,/g, ' '),
      '',                                          // last_contacted — empty on creation
      (data.email || '').replace(/,/g, ' '),
      (data.industry || '').replace(/,/g, ' '),
    ].join(',');
    fs.appendFileSync(CONTACTS_FILE, '\n' + row);
    refreshContactCache();
    return true;
  } catch (e) {
    console.error('Error adding contact:', e.message);
    return false;
  }
}

async function handleAddContact(msg, body) {
  const userId = msg.from;
  const lower = body.toLowerCase().trim();

  // Start or continue
  if (!addContactSessions[userId]) {
    addContactSessions[userId] = { step: 0, data: {}, lastActivity: Date.now() };
    await msg.reply(
      `➕ *Add Contact Wizard*\n\n${ADD_CONTACT_STEPS[0].question}`,
      null, { linkPreview: false }
    );
    return true;
  }

  const session = addContactSessions[userId];
  if (session) { session.lastActivity = Date.now(); session.nudged = false; delete session.nudgedAt; }

  if (lower === 'cancel') {
    delete addContactSessions[userId];
    await msg.reply('❌ Add contact cancelled.', null, { linkPreview: false });
    return true;
  }

  const currentStep = ADD_CONTACT_STEPS[session.step];
  const value = lower === 'skip' ? '' : body.trim();

  // Validate number on step 0
  if (currentStep.key === 'number') {
    const digits = value.replace(/\D/g, '');
    if (!isValidNumber(digits)) {
      await msg.reply(`❌ Invalid number format. Please enter a full international number (e.g. 12425550100).\n\n${currentStep.question}`, null, { linkPreview: false });
      return true;
    }
    // Check for duplicate
    const existing = findContact(digits);
    if (existing) {
      await msg.reply(`⚠️ A contact with number ${digits} already exists: *${existing.name}*.\n\nEnter a different number or type *cancel*.`, null, { linkPreview: false });
      return true;
    }
    session.data.number = digits;
  } else {
    session.data[currentStep.key] = value;
  }

  session.step++;

  if (session.step < ADD_CONTACT_STEPS.length) {
    await msg.reply(ADD_CONTACT_STEPS[session.step].question, null, { linkPreview: false });
    return true;
  }

  // All steps done — save
  delete addContactSessions[userId];
  const saved = appendContact(session.data);
  if (saved) {
    const tags = session.data.tags || 'none';
    await msg.reply(
      `✅ *Contact Added!*\n\n` +
      `👤 *Name:* ${session.data.name || '—'}\n` +
      `📱 *Number:* ${session.data.number}\n` +
      `🏪 *Business:* ${session.data.business || '—'}\n` +
      `🏷️ *Tags:* ${tags}\n` +
      `📧 *Email:* ${session.data.email || '—'}\n` +
      `🗂️ *Industry:* ${session.data.industry || '—'}\n` +
      `📝 *Notes:* ${session.data.notes || '—'}\n\n` +
      `You can now use *!send ${session.data.name ? session.data.name.split(' ')[0] : session.data.number}* to message them.`,
      null, { linkPreview: false }
    );
  } else {
    await msg.reply('❌ Failed to save contact. Check the terminal for details.', null, { linkPreview: false });
  }
  return true;
}

function saveSettings(data) {
  try {
    // Preserve existing values for anything the setup wizard doesn't ask about
    const existing = getSettings();
    const keep = (key, fallback) => (existing[key] !== undefined && existing[key] !== '' ? existing[key] : fallback);

    const lines = ['key,value',
      `business_name,${data.business_name || existing.business_name || ''}`,
      `owner_number,${data.owner_number || existing.owner_number || ''}`,
      `tone,${data.tone || 'friendly-pro'}`,
      `signature,${data.signature || `- ${data.business_name || 'us'}`}`,
      '',
      '# ── PROMPT SETTINGS ──────────────────────────────────────────────────────────',
      `business_context,${data.business_context || existing.business_context || ''}`,
      `custom_instructions,${data.custom_instructions !== undefined ? data.custom_instructions : (existing.custom_instructions || '')}`,
      `message_length,${data.message_length || 'medium'}`,
      `language_style,${data.language_style || 'standard'}`,
      `avoid_words,${keep('avoid_words', '')}`,
      '',
      '# ── RESPONSE WINDOW ───────────────────────────────────────────────────────────',
      `response_window,${keep('response_window', 'Monday to Friday 9am to 5pm')}`,
      '',
      '# ── CALENDAR & CTA ────────────────────────────────────────────────────────────',
      `calendar_link,${keep('calendar_link', 'https://calendly.com/gjamescollie')}`,
      '',
      '# ── TOKEN SETTINGS ────────────────────────────────────────────────────────────',
      `token_limit_send,${keep('token_limit_send', '300')}`,
      `token_limit_checkin,${keep('token_limit_checkin', '150')}`,
      `token_limit_broadcast,${keep('token_limit_broadcast', '250')}`,
      '',
      '# ── KNOWLEDGE BASE ───────────────────────────────────────────────────────────',
    ];

    for (let i = 1; i <= 40; i++) {
      // Use new answer if provided in setup, otherwise keep existing
      const q = data[`kb_${i}_q`] || existing[`faq_${i}_q`];
      const a = data[`kb_${i}_a`] || existing[`faq_${i}_a`];
      if (q && a) {
        lines.push(`faq_${i}_q,${q}`);
        lines.push(`faq_${i}_a,${a}`);
      }
    }

    const tmp = SETTINGS_FILE + '.tmp';
    fs.writeFileSync(tmp, lines.join('\n'));
    fs.renameSync(tmp, SETTINGS_FILE); // atomic write — prevents corruption on crash
    return true;
  } catch (e) {
    console.error('Error saving settings:', e.message);
    return false;
  }
}

// ─── DEMO STATE MACHINE ──────────────────────────────────────────────────────

async function fetchNewsHeadlines() {
  const feeds = [
    'https://www.tribune242.com/rss/headlines/local-news/',
    'https://www.bahamaslocal.com/rss/',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
  ];
  for (const url of feeds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CayAI/1.0)' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const xml = await res.text();
      const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/g)].slice(0, 3);
      const parsed = items.map(m => {
        const decodeEntities = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;#x27;/g, "'");
        const title = decodeEntities((m[0].match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || m[0].match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim().replace(/\s+/g, ' ') || '');
        const desc  = (m[0].match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || m[0].match(/<description>([\s\S]*?)<\/description>/))?.[1]?.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ').slice(0, 120) || '';
        return { title, desc };
      }).filter(i => i.title);
      if (parsed.length > 0) return parsed;
    } catch (_) { /* try next feed */ }
  }
  return null;
}

async function fetchNassauWeather() {
  const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.06&longitude=-77.34&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&temperature_unit=fahrenheit&windspeed_unit=mph');
  const data = await res.json();
  return data.current;
}

async function startDemoMenu(msg, from, session = {}) {
  demoSessions[from] = { state: 'menu', ...session, lastActivity: Date.now() };
  const firstName = (session.demoName || '').split(' ')[0];
  const greeting = firstName ? `Welcome, *${firstName}!* 👋\n\n` : '';
  await msg.reply(
    `🚀 *Cay AI Live Demo* 🇧🇸\n\n` +
    `${greeting}` +
    `I'm a live AI automation engine built to help Nassau small businesses convert leads, save time, and book more clients — on autopilot.\n\n` +
    `Pick a feature to experience right here in this chat:\n\n` +
    `1️⃣ *[SMART-UPDATES]* — Watch me pull live Nassau weather and auto-draft a proactive client message. 🌤️\n\n` +
    `2️⃣ *[DEAL-CLOSER]* — I'll simulate a real inbound lead for your business and generate the perfect reply. 🎯\n\n` +
    `3️⃣ *[NEWS BRIEF]* — 30-second brief on what's happening in Nassau right now. 📰\n\n` +
    `4️⃣ *[BOOK]* — Schedule your free AI strategy consultation. 📅\n\n` +
    `_Reply *1*, *2*, *3*, or *4* — or type the option name._`,
    null, { linkPreview: false }
  );
}

async function showDemoBooking(msg, from, calendarLink, ownerNumber, signature, session = {}) {
  const firstName = (session.demoName || '').split(' ')[0];
  const bizLine = session.demoBusiness ? ` for *${session.demoBusiness}*` : '';
  delete demoSessions[from];
  if (ownerNumber) {
    const notifyExtra = session.demoName ? `\n*Name:* ${session.demoName}\n*Business:* ${session.demoBusiness || 'N/A'}\n*Sells:* ${session.demoSells || 'N/A'}` : '';
    await client.sendMessage(ownerNumber,
      `📅 *Demo Booking Triggered*\n\n*Number:* ${from}${notifyExtra}\n\nThey selected Book in the demo and were sent the calendar link.`,
      { linkPreview: false }
    ).catch(() => {});
  }
  appendToLog(from, from, 'Demo booking link sent', 'demo-booking', '', '', 'out', 'demo');
  const bookingBody = pick([
    `Our AI automation team will look at *${session.demoBusiness || 'your business'}* specifically, understand your needs, and determine exactly how Cay AI can work for you. 30 minutes, no pitch, no pressure.`,
    `Our automation professionals will dig into *${session.demoBusiness || 'your business'}* — understand what you need and map out exactly how Cay AI fits. 30 minutes, no pitch, no pressure.`,
    `We'll have one of our AI professionals look at *${session.demoBusiness || 'your business'}* specifically, understand your setup, and show you exactly how Cay AI can work for you. 30 minutes, no pitch, no pressure.`,
  ]);
  await msg.reply(
    `📅 *Free AI Strategy Call*\n\n` +
    `${firstName ? `${firstName} — ` : ''}${bookingBody}\n\n` +
    `👇 *Pick your slot:*\n` +
    `${calendarLink}\n\n` +
    `${signature}`,
    null, { linkPreview: false }
  );
}

async function runDealCloser(msg, from, businessInfo, session = {}) {
  demoSessions[from] = { ...demoSessions[from], state: 'feature_done' };
  await msg.reply('⏳ Simulating live lead intake...', null, { linkPreview: false });
  const result = await callAI(
    `You are demonstrating the Cay AI WhatsApp agent. Generate a realistic simulation of an incoming lead for the given business. Reply ONLY in this exact format with no extra text:
LEAD_MESSAGE: [realistic incoming WhatsApp from a customer, 2-3 sentences, specific Nassau scenario]
PSYCHOLOGY: [one sentence on the unstated desire behind the message]
INTENT: [exactly one of: HOT_LEAD / QUESTION / CALL / BOOKING]
DRAFT: [perfect reply the owner would approve — warm, specific, ends with a question to lock the booking, under 60 words, no subject line, no hashtags]`,
    `Business: ${businessInfo}${session.demoName ? `\nOwner first name: ${session.demoName.split(' ')[0]}` : ''}`,
    450
  );
  if (!result.text) {
    await msg.reply('❌ Simulation failed. Reply *MENU* to try another option.', null, { linkPreview: false });
    return;
  }
  const t = result.text;
  const leadMsg = (t.match(/LEAD_MESSAGE:\s*(.+)/)?.[1] || '').trim();
  const psychology = (t.match(/PSYCHOLOGY:\s*(.+)/)?.[1] || '').trim();
  const intent = (t.match(/INTENT:\s*(\S+)/)?.[1] || 'HOT_LEAD').trim();
  const draft = (t.match(/DRAFT:\s*([\s\S]+)/)?.[1] || '').trim();
  await msg.reply(
    `🚨 *SIMULATED LIVE INBOUND LEAD!* 🚨\n\n` +
    `_"${leadMsg}"_\n\n` +
    `Here's what Cay AI does in milliseconds:\n\n` +
    `*1️⃣ Unstated Psychology:* ${psychology}\n\n` +
    `*2️⃣ Intent Classified:* \`[${intent}]\` 🔥\n\n` +
    `🟢 *AI-drafted reply — sent to your phone for one-tap approval:*\n\n` +
    `_"${draft}"_\n\n` +
    `*The Value:* You type "yes" and the booking is locked — while you're on a job.\n\n` +
    `_Reply *MENU* to go back, or *4* to book your strategy call._`,
    null, { linkPreview: false }
  );
  appendToLog(from, from, `[DEMO] Deal-Closer simulation for: ${businessInfo}`, 'demo', '', '', 'out', 'demo');
}

async function handleDemoFlow(msg, from, body, settings) {
  const session = demoSessions[from];
  if (session) { session.lastActivity = Date.now(); session.nudged = false; delete session.nudgedAt; }
  const lower = body.toLowerCase().trim();
  const calendarLink = getCalendarLink(settings);
  const signature = `- The Cay AI Team`;
  const ownerNumber = formatNumber(settings.owner_number || '');

  if (lower === 'menu') {
    await startDemoMenu(msg, from, { demoName: session.demoName, demoBusiness: session.demoBusiness, demoSells: session.demoSells });
    appendToLog(from, from, '[DEMO] Returned to menu', 'demo', '', '', 'out', 'demo');
    return;
  }

  // ── INTRO: collect name, business, what they sell ──
  if (session.state === 'intro') {
    // Accept freeform "Name, Business, What they sell" or just store raw and parse
    const parts = body.split(',').map(s => s.trim()).filter(Boolean);
    const demoName = parts[0] || body.trim();
    const demoBusiness = parts[1] || '';
    const demoSells = parts[2] || '';
    appendToLog(from, from, `[DEMO] Intro: ${demoName} | ${demoBusiness} | ${demoSells}`, 'demo', '', '', 'out', 'demo');
    await startDemoMenu(msg, from, { demoName, demoBusiness, demoSells });
    return;
  }

  // Helper: resolve menu selection by number or name
  const resolveMenuChoice = (input) => {
    const t = input.trim().toLowerCase();
    if (t === '1' || t.includes('smart') || t.includes('weather') || t.includes('update')) return '1';
    if (t === '2' || t.includes('deal') || t.includes('closer') || t.includes('lead') || t.includes('mind')) return '2';
    if (t === '3' || t.includes('news') || t.includes('brief') || t.includes('headline')) return '3';
    if (t === '4' || t.includes('book') || t.includes('consult') || t.includes('schedule') || t.includes('slot')) return '4';
    return null;
  };

  // ── MENU: waiting for selection ──
  if (session.state === 'menu') {
    const choice = resolveMenuChoice(body);
    if (choice === '1') {
      const bizContext = session.demoBusiness && session.demoSells
        ? `${session.demoBusiness} (sells: ${session.demoSells})`
        : session.demoBusiness || 'a Nassau small business';
      try {
        const w = await fetchNassauWeather();
        const condition = WMO_CODES[w.weathercode] || 'Variable conditions';
        const weatherContext = `Temp: ${w.temperature_2m}°F, ${condition}, wind ${w.windspeed_10m} mph, humidity ${w.relative_humidity_2m}%`;
        const draftResult = await callAI(
          `You are the AI agent for ${bizContext} based in Nassau, Bahamas. Write a short proactive WhatsApp message to today's clients that naturally mentions the actual current weather conditions. Keep it casual, warm, and local. Under 40 words. End with a relevant emoji. No subject line, no greeting prefix, no signature. You MUST reference the specific temperature and sky conditions provided.`,
          `Current Nassau conditions as of ${new Date().toLocaleString('en-US', { timeZone: 'America/Nassau', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}: ${weatherContext}`,
          120
        );
        const draft = draftResult.text || `Hey! It\'s ${w.temperature_2m}°F and ${condition.toLowerCase()} out today — great time to connect. ☀️`;
        await msg.reply(
          `🌤️ *Nassau Weather — ${new Date().toLocaleString('en-US', { timeZone: 'America/Nassau', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}*\n` +
          `🌡️ Temp: ${w.temperature_2m}°F\n` +
          `💧 Humidity: ${w.relative_humidity_2m}%\n` +
          `💨 Wind: ${w.windspeed_10m} mph\n` +
          `☁️ ${condition}\n\n` +
          `---\n\n` +
          `🤖 *Cay AI just auto-drafted this for ${bizContext}:*\n\n` +
          `_"${draft}"_\n\n` +
          `*The Value:* You don\'t lift a finger — the AI monitors conditions and keeps your clients informed on autopilot.\n\n` +
          `_Reply *MENU* to go back, or *4* to book your strategy call._`,
          null, { linkPreview: false }
        );
        demoSessions[from].state = 'feature_done';
        appendToLog(from, from, '[DEMO] Viewed weather smart-update feature', 'demo', '', '', 'out', 'demo');
      } catch (e) {
        await msg.reply('❌ Could not fetch live weather right now. Reply *MENU* to try another option.', null, { linkPreview: false });
      }
    } else if (choice === '2') {
      demoSessions[from].state = 'mind_reader_input';
      appendToLog(from, from, '[DEMO] Started Deal-Closer feature', 'demo', '', '', 'out', 'demo');
      if (session.demoBusiness && session.demoSells) {
        // We already have their info — go straight to simulation
        await runDealCloser(msg, from, `${session.demoBusiness}, ${session.demoSells}`, session);
      } else {
        await msg.reply(
          `🧠 *The Deal-Closer*\n\n` +
          `Let\'s simulate a live lead for your business. Reply with your *Business Name and what you sell*.\n\n` +
          `_(Example: Marlin Charters, Boat Tours — or — Glow Salon, Hair & Nails)_`,
          null, { linkPreview: false }
        );
      }
    } else if (choice === '3') {
      demoSessions[from].state = 'news';
      appendToLog(from, from, '[DEMO] Started News Brief feature', 'demo', '', '', 'out', 'demo');
      await msg.reply('📰 Pulling the latest Nassau headlines...', null, { linkPreview: false });
      try {
        const headlines = await fetchNewsHeadlines();
        if (!headlines || headlines.length === 0) throw new Error('no headlines');
        const briefResult = await callAI(
          `You are a sharp Nassau-based news anchor. Summarise the 3 headlines below in 3 punchy bullet points for a Nassau small-business audience. Each bullet: one relevant emoji + bold headline fragment + one tight sentence of context. Under 80 words total. No intro line, just the bullets.`,
          `Headlines:\n${headlines.map(h => `- ${h.title}: ${h.desc}`).join('\n')}`,
          160
        );
        const headlineFallback = headlines.map((h, i) => `${i + 1}. *${h.title}*`).join('\n');
        const brief = briefResult.text || headlineFallback;
        demoSessions[from].state = 'feature_done';
        await msg.reply(
          `📰 *Nassau & Local News Brief — ${new Date().toLocaleString('en-US', { timeZone: 'America/Nassau', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}*\n\n` +
          `${brief}\n\n` +
          `---\n\n` +
          `*The Value:* Cay AI can send your clients timely updates like this automatically — keeping your business top of mind without any manual effort.\n\n` +
          `_Reply *MENU* to go back, or *4* to book your strategy call._`,
          null, { linkPreview: false }
        );
        appendToLog(from, from, '[DEMO] Viewed News Brief feature', 'demo', '', '', 'out', 'demo');
      } catch (e) {
        demoSessions[from].state = 'feature_done';
        await msg.reply('❌ Could not fetch news right now. Reply *MENU* to try another option.', null, { linkPreview: false });
      }
    } else if (choice === '4') {
      await showDemoBooking(msg, from, calendarLink, ownerNumber, signature, session);
    } else {
      await msg.reply('_Reply with *1*, *2*, *3*, or *4* — or type the option name (e.g. "news" or "book")._', null, { linkPreview: false });
    }
    return;
  }

  // ── FEATURE DONE: only accept book or MENU ──
  if (session.state === 'feature_done' || session.state === 'news') {
    const choice = resolveMenuChoice(body);
    if (choice === '4') {
      await showDemoBooking(msg, from, calendarLink, ownerNumber, signature, session);
    } else if (choice) {
      // Let them jump to another feature
      demoSessions[from].state = 'menu';
      await handleDemoFlow(msg, from, body, settings);
    } else {
      await msg.reply('_Reply *MENU* to go back, or *4* to book your strategy call._', null, { linkPreview: false });
    }
    return;
  }

  // ── DEAL-CLOSER: waiting for business type (only if not already collected) ──
  if (session.state === 'mind_reader_input') {
    await runDealCloser(msg, from, body.trim(), session);
    return;
  }

}

async function handleSetup(msg, body) {
  const userId = msg.from;
  const lower = body.toLowerCase().trim();
  const session = setupSessions[userId];
  if (session) { session.lastActivity = Date.now(); session.nudged = false; delete session.nudgedAt; }

  // Start setup
  if (lower === '!setup') {
    setupSessions[userId] = { step: 0, data: {}, lastActivity: Date.now() };
    await msg.reply(
      `*⚙️ Agent Setup Wizard*\n\n` +
      `⚠️ *Advanced users only.* Incorrect entries can break your agent. Proceed carefully.\n\n` +
      `This will walk you through configuring your agent in ${LOGICAL_TOTAL} steps.\n\n` +
      withNav(SETUP_STEPS[0].question, 0),
      null, { linkPreview: false }
    );
    return true;
  }

  if (!session) return false;

  // Cancel
  if (lower === '!cancelsetup') {
    delete setupSessions[userId];
    await msg.reply('❌ Setup cancelled. Your previous settings are unchanged.', null, { linkPreview: false });
    return true;
  }

  const currentStep = SETUP_STEPS[session.step];

  // Back — go to previous step (clamp at 0)
  if (lower === 'back') {
    if (session.step === 0) {
      await msg.reply(`_You\'re already on the first step._\n\n${withNav(currentStep.question, session.step)}`, null, { linkPreview: false });
    } else {
      session.step = Math.max(0, session.step - 1);
      await msg.reply(withNav(SETUP_STEPS[session.step].question, session.step), null, { linkPreview: false });
    }
    return true;
  }

  // Skip entire KB section — jump past all kb_ steps
  if (lower === 'skipkb') {
    if (session.step < KB_INTRO_INDEX) {
      await msg.reply(`_*skipkb* only works during the knowledge base section._\n\n${withNav(currentStep.question, session.step)}`, null, { linkPreview: false });
      return true;
    }
    // KB is the last section in this wizard
    const afterKB = SETUP_STEPS.findIndex((s, i) => i > KB_INTRO_INDEX && !s.key.startsWith('kb_'));
    if (afterKB === -1) {
      const saved = saveSettings(session.data);
      delete setupSessions[userId];
      await msg.reply(saved
        ? `✅ *Setup Complete!* Knowledge base skipped — you can fill it in later by running *!setup* again.\n\nType *!help* to see all commands.`
        : '❌ There was an error saving your settings. Please try again.',
        null, { linkPreview: false });
    } else {
      session.step = afterKB;
      await msg.reply(`✅ Knowledge base skipped.\n\n${withNav(SETUP_STEPS[session.step].question, session.step)}`, null, { linkPreview: false });
    }
    return true;
  }

  // kb_intro is informational only — auto-advance
  if (currentStep.key === 'kb_intro') {
    session.step++;
    await msg.reply(withNav(SETUP_STEPS[session.step].question, session.step), null, { linkPreview: false });
    return true;
  }

  // Handle tone input
  if (currentStep.key === 'tone') {
    if (lower === 'skip') {
      session.data.tone = 'friendly-pro';
    } else {
      const mapped = TONE_MAP[body.trim()];
      if (!mapped) {
        await msg.reply(`❌ Please reply with a number 1-4.\n\n${withNav(currentStep.question, session.step)}`, null, { linkPreview: false });
        return true;
      }
      session.data.tone = mapped;
    }
  }

  // Handle message length
  else if (currentStep.key === 'message_length') {
    if (lower === 'skip') {
      session.data.message_length = 'medium';
    } else {
      const mapped = LENGTH_MAP[body.trim()];
      if (!mapped) {
        await msg.reply(`❌ Please reply with a number 1-3.\n\n${withNav(currentStep.question, session.step)}`, null, { linkPreview: false });
        return true;
      }
      session.data.message_length = mapped;
    }
  }

  // Handle language style
  else if (currentStep.key === 'language_style') {
    if (lower === 'skip') {
      session.data.language_style = 'standard';
    } else {
      const mapped = LANG_MAP[body.trim()];
      if (!mapped) {
        await msg.reply(`❌ Please reply with a number 1-3.\n\n${withNav(currentStep.question, session.step)}`, null, { linkPreview: false });
        return true;
      }
      session.data.language_style = mapped;
    }
  }

  // Handle custom instructions with 200 char limit
  else if (currentStep.key === 'custom_instructions') {
    if (lower === 'skip') {
      session.data.custom_instructions = '';
    } else if (body.trim().length > CUSTOM_INSTRUCTIONS_MAX) {
      const over = body.trim().length - CUSTOM_INSTRUCTIONS_MAX;
      await msg.reply(`❌ That's ${body.trim().length} characters — ${over} too many.\n\nPlease shorten it to ${CUSTOM_INSTRUCTIONS_MAX} characters or less, or type *skip*.\n\n${withNav(currentStep.question, session.step)}`, null, { linkPreview: false });
      return true;
    } else {
      session.data.custom_instructions = body.trim();
    }
  }

  // Handle knowledge base entries
  else if (currentStep.key.startsWith('kb_') && currentStep.key !== 'kb_intro') {
    const num = currentStep.key.split('_')[1];
    if (lower !== 'skip') {
      session.data[`kb_${num}_q`] = currentStep.prefill;
      session.data[`kb_${num}_a`] = body.trim();
    }
  }

  // Handle all other text fields
  else {
    if (lower === 'skip') {
      session.data[currentStep.key] = '';
    } else if (currentStep.key === 'owner_number') {
      const digits = body.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        await msg.reply(`❌ That doesn\'t look like a valid number. Please enter in international format with no + or spaces.\n_Example: 12425550100_\n\n${withNav(currentStep.question, session.step)}`, null, { linkPreview: false });
        return true;
      }
      session.data.owner_number = digits;
    } else {
      session.data[currentStep.key] = body.trim();
    }
  }

  // Move to next step
  session.step++;

  // Check if done
  if (session.step >= SETUP_STEPS.length) {
    const saved = saveSettings(session.data);
    delete setupSessions[userId];
    if (saved) {
      await msg.reply(
        `✅ *Setup Complete!*\n\n` +
        `*Business:* ${session.data.business_name || '_(skipped)_'}\n` +
        `*Tone:* ${session.data.tone || 'friendly-pro'}\n` +
        `*Message Length:* ${session.data.message_length || 'medium'}\n` +
        `*Language:* ${session.data.language_style || 'standard'}\n` +
        `*Signature:* ${session.data.signature || '_(skipped)_'}\n\n` +
        `Your agent is now configured. Type *!help* to see all commands.\n_You can run *!setup* again anytime to update any field._`,
        null, { linkPreview: false }
      );
    } else {
      await msg.reply('❌ There was an error saving your settings. Please try again.', null, { linkPreview: false });
    }
    return true;
  }

  // Ask next question
  await msg.reply(withNav(SETUP_STEPS[session.step].question, session.step), null, { linkPreview: false });
  return true;
}

// ─── CLIENT SETUP ─────────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.IS_DOCKER
      ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
      : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      ...(process.env.PROXY_URL ? [`--proxy-server=${process.env.PROXY_URL}`] : []),
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with your WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => console.log('✅ Authenticated'));
client.on('ready', () => {
  const settings = getSettings();
  console.log(`🚀 ${settings.business_name || 'Lucayan Labs'} WhatsApp Agent is live!`);
  console.log(`🤖 AI Provider: ${AI_PROVIDER} | Model: ${AI_MODEL}`);
  startFollowUpChecker();
  startInactivityChecker();
  startReviewAgent();
});
client.on('auth_failure', () => console.error('❌ Auth failed — re-scan the QR code'));

// ─── AUTO-RECONNECT ────────────────────────────────────────────────────────────
let reconnectAttempts = 0;
client.on('ready', () => { reconnectAttempts = 0; }); // reset counter on successful connect

// ─── INBOUND MESSAGE LISTENER ────────────────────────────────────────────────
client.on('message', async (msg) => {
  if (msg.fromMe) return;
  if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') return;

  // Allow both @c.us (traditional) and @lid (newer WhatsApp format)
  const isValidChat = msg.from.endsWith('@c.us') || msg.from.endsWith('@lid');
  if (!isValidChat) return;

  const settings = getSettings();
  const ownerClean = (settings.owner_number || '').replace(/\D/g, '');

  const fromClean = await resolveRealNumber(msg.from);

  if (ownerClean && fromClean === ownerClean) return;

  await handleInbound(msg);
});
client.on('disconnected', (reason) => {
  console.warn('⚠️ Disconnected:', reason);
  reconnectAttempts++;
  if (reconnectAttempts <= 3) {
    const delay = reconnectAttempts * 5000;
    console.log(`🔄 Reconnect attempt ${reconnectAttempts}/3 in ${delay / 1000}s...`);
    setTimeout(() => {
      client.initialize().catch((e) => console.error('Reconnect failed:', e.message));
    }, delay);
  } else {
    console.error('❌ Max reconnect attempts reached. Sending desktop notification.');
    const { execFile } = require('child_process');
    // Write a temp AppleScript file to avoid quote-escaping issues
    const script = '/tmp/cayai_notify.scpt';
    fs.writeFileSync(script, 'display notification "Cay AI disconnected. Restart required." with title "Cay AI Agent" sound name "Basso"');
    execFile('osascript', [script], (err) => { if (err) console.error('Notification failed:', err.message); });
    const settings = getSettings();
    const ownerNumber = (settings.owner_number || '').replace(/\D/g, '');
    if (ownerNumber) {
      client.sendMessage(formatNumber(ownerNumber), `⚠️ *Agent Disconnected*\n\nReason: ${reason}\n\nPlease restart the agent.`, { linkPreview: false }).catch(() => {});
    }
  }
});

// ─── MESSAGE HANDLER ──────────────────────────────────────────────────────────
client.on('message_create', async (msg) => {
  if (!msg.fromMe) return;

  const body = msg.body.trim();
  const lower = body.toLowerCase();
  const settings = getSettings();
  const bizName = settings.business_name || 'Lucayan Labs';

  // ── LOG ALL OWNER MESSAGES WITHOUT DISCRIMINATION ──
  // Every message the owner sends — commands, replies to agent prompts, manual texts — is recorded.
  if (body && !msg.from.endsWith('@g.us')) {
    const toChatId = msg.to || msg.from;
    const toNumber = await resolveRealNumber(toChatId);
    const toContact = toNumber ? findContact(toNumber) : null;
    const toName = toContact ? toContact.name : (toNumber || 'self');
    const ownerSettings = getSettings();
    const ownerNum = (ownerSettings.owner_number || '').replace(/\D/g, '');
    // Distinguish: message to self (agent commands/replies) vs message to a customer
    const isToSelf = !toNumber || toNumber === ownerNum;
    const statusLabel = isToSelf ? 'owner:command' : 'owner:manual';
    appendToLog(isToSelf ? ownerNum : toNumber, isToSelf ? 'OWNER-SELF' : toName, `[OWNER] ${body}`, statusLabel, '', '', 'out', '');
  }

  // ── PURPOSE SELECTION HANDLER ──
  if (['1','2','3','4','5'].includes(body.trim()) && Object.keys(pendingPurpose).length > 0) {
    const ids = Object.keys(pendingPurpose);
    const latestId = ids[ids.length - 1];
    const pending = pendingPurpose[latestId];
    const purpose = MESSAGE_PURPOSES[body.trim()];

    if (purpose && pending) {
      delete pendingPurpose[latestId];
      const { type, rawNumber, contact, intent, sendAt } = pending;

      await msg.reply(`✍️ Writing *${purpose.label}* message...`);

      if (type === 'send') {
        const { message, tokens } = await generateMessage(intent, contact, settings, parseInt(settings.token_limit_send) || 300, purpose.guide);
        const id = Date.now().toString();
        pendingPreviews[id] = { rawNumber, message, contact, tokens, command: '!send' };
        const contactName = contact ? ` (${contact.name})` : '';
        await msg.reply(
          `*Preview* — To: ${rawNumber}${contactName} _(${purpose.label})_\n\n` +
          `───────────────\n${message}\n───────────────\n\n` +
          `Reply *yes* to send or *no* to cancel.`,
          null, { linkPreview: false }
        );
        return;
      }

      if (type === 'schedule') {
        const { message } = await generateMessage(intent, contact, settings, parseInt(settings.token_limit_send) || 300, purpose.guide);
        const id = Date.now();
        followUps.push({ id, number: formatNumber(rawNumber), rawNumber, message, sendAt, contactName: contact?.name || '' });
        saveFollowUps();
        const readableTime = new Date(sendAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const contactName = contact ? ` (${contact.name})` : '';
        await msg.reply(`✅ *${purpose.label}* message to ${rawNumber}${contactName} scheduled for ${readableTime}\n\n_"${message.slice(0, 80)}..."_`, null, { linkPreview: false });
        return;
      }

      if (type === 'checkin') {
        const { message: checkinMsg, tokens: checkinTokens } = await generateCheckin(contact, settings, purpose.guide);
        const id = Date.now().toString();
        pendingPreviews[id] = { rawNumber, message: checkinMsg, contact, tokens: checkinTokens, command: '!checkin' };
        const contactName = contact ? ` (${contact.name})` : '';
        await msg.reply(
          `*Check-in Preview* — To: ${rawNumber}${contactName} _(${purpose.label})_\n\n` +
          `───────────────\n${checkinMsg}\n───────────────\n\n` +
          `Reply *yes* to send or *no* to cancel.`,
          null, { linkPreview: false }
        );
        return;
      }
    }
  }

  // ── SETUP WIZARD ──
  if (lower === '!setup' || setupSessions[msg.from]) {
    await handleSetup(msg, body);
    return;
  }

  // ── ADD CONTACT WIZARD ──
  if (lower === '!addcontact' || addContactSessions[msg.from]) {
    await handleAddContact(msg, body);
    return;
  }

  // ── PREVIEW APPROVAL (handles both regular and broadcast) ──
  if (lower === 'yes' || lower === 'no') {
    const ids = Object.keys(pendingPreviews);
    if (ids.length > 0) {
      const latestId = ids[ids.length - 1];
      const latest = pendingPreviews[latestId];

      // Broadcast approval
      if (latest.isBroadcast) {
        if (lower === 'yes') {
          await msg.reply(`📤 Sending to ${latest.broadcastContacts.length} contacts...`);
          const { sent, failed } = await handleBroadcastApproval(latest, getSettings());
          await msg.reply(`✅ Broadcast done: ${sent} sent, ${failed} failed`);
        } else {
          await msg.reply('❌ Broadcast cancelled.');
        }
        delete pendingPreviews[latestId];
        return;
      }

      // Regular message approval
      if (lower === 'yes') {
        try {
          await client.sendMessage(formatNumber(latest.rawNumber), latest.message);
          updateLastContacted(latest.rawNumber);
          appendToLog(latest.rawNumber, latest.contact?.name || '', latest.message, 'outbound:sent', latest.tokens || 0, '', 'out', latest.command || '!send');
          const contactName = latest.contact ? ` (${latest.contact.name})` : '';
          await msg.reply(`✅ Sent to ${latest.rawNumber}${contactName}`);
        } catch (e) {
          appendToLog(latest.rawNumber, latest.contact?.name || '', latest.message, 'outbound:failed', 0, '', 'out', latest.command || '!send');
          await msg.reply(`❌ Failed to send: ${e.message}`);
        }
      } else {
        await msg.reply('❌ Message cancelled.');
      }
      delete pendingPreviews[latestId];
      return;
    }
  }

  // ── HELP ──
  if (lower === '!help') {
    await msg.reply(
      `*${bizName} Agent* 🤖\n\n` +
      `_You can use a contact's name or number in any command._\n\n` +
      `*!send [name/number] [intent]*\n→ AI writes a message for your approval\n_e.g. !send John follow up on their order_\n\n` +
      `*!schedule [name/number] [time] [intent]*\n→ AI message sent at a specific time\n_e.g. !schedule John 3pm check in_\n\n` +
      `*!checkin [name/number]*\n→ AI check-in based on contact info\n_e.g. !checkin John_\n\n` +
      `*!broadcast [tag] [intent]*\n→ AI message to all contacts with a tag\n_e.g. !broadcast leads follow up on their inquiry_\n\n` +
      `*!sendnoai [name/number] [message]*\n→ Send a direct message without AI\n_e.g. !sendnoai John Thanks for reaching out!_\n\n` +
      `*!faq [question]*\n→ Look up an answer from your knowledge base\n\n` +
      `*!addcontact*\n→ Add a new contact (guided menu)\n\n` +
      `*!stats*\n→ View messaging stats\n\n` +
      `*!report [days]*\n→ BI digest (default 7 days)\n\n` +
      `*!followuplist*\n→ Contacts not messaged in 30+ days\n\n` +
      `*!settings*\n→ View current agent settings\n\n` +
      `*!list*\n→ View pending scheduled messages\n\n` +
      `*!cancel [id]*\n→ Cancel a scheduled message\n\n` +
      `*!setup*\n→ Run the setup wizard to configure your agent`,
      null, { linkPreview: false }
    );
    return;
  }

  // ── SEND (with purpose selection) ──
  if (lower.startsWith('!send ')) {
    const parts = body.slice(6).trim().split(' ');
    const input = parts[0];
    const intent = parts.slice(1).join(' ');

    if (!input || !intent) {
      await msg.reply('❌ Usage: !send [number or name] [intent]\nExample: !send John follow up on their order');
      return;
    }

    const resolved = resolveRecipient(input);
    if (!resolved.resolved) { await msg.reply(resolved.reply); return; }
    const { rawNumber, contact } = resolved;

    // Store and ask for purpose
    const pid = Date.now().toString();
    pendingPurpose[pid] = { type: 'send', rawNumber, contact, intent };
    await msg.reply(PURPOSE_PROMPT);
    return;
  }

  // ── SCHEDULE ──
  if (lower.startsWith('!schedule ')) {
    const parts = body.slice(10).trim().split(' ');
    const input = parts[0];
    const timeStr = parts[1];
    const intent = parts.slice(2).join(' ');

    if (!input || !timeStr || !intent) {
      await msg.reply('❌ Usage: !schedule [number or name] [time] [intent]\nExample: !schedule John 3pm check in on their order\nExample: !schedule 12425550100 3pm check in on their order');
      return;
    }

    const resolved = resolveRecipient(input);
    if (!resolved.resolved) { await msg.reply(resolved.reply); return; }
    const { rawNumber, contact } = resolved;

    const sendAt = parseTime(timeStr);
    if (!sendAt) {
      await msg.reply('❌ Invalid time. Use formats like: 3pm, 15:00, 3:30pm');
      return;
    }

    await msg.reply('✍️ Writing message...');
    const { message, tokens: schedTokens } = await generateMessage(intent, contact, settings, parseInt(settings.token_limit_send) || 300);
    const id = Date.now();
    followUps.push({ id, number: formatNumber(rawNumber), rawNumber, message, sendAt, contactName: contact?.name || '' });
    saveFollowUps();

    const readableTime = new Date(sendAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const contactName = contact ? ` (${contact.name})` : '';
    await msg.reply(`✅ Message to ${rawNumber}${contactName} scheduled for ${readableTime}\nID: \`${id}\`\n\n_"${message.slice(0, 80)}..."_`);
    return;
  }

  // ── CHECK-IN (with purpose selection) ──
  if (lower.startsWith('!checkin ')) {
    const input = body.slice(9).trim().split(' ')[0];

    if (!input) {
      await msg.reply('❌ Usage: !checkin [number or name]\nExample: !checkin John');
      return;
    }

    const resolved = resolveRecipient(input);
    if (!resolved.resolved) { await msg.reply(resolved.reply); return; }
    const { rawNumber, contact } = resolved;

    // Store and ask for purpose
    const pid = Date.now().toString();
    pendingPurpose[pid] = { type: 'checkin', rawNumber, contact, intent: 'check in' };
    await msg.reply(PURPOSE_PROMPT);
    return;
  }

  // ── BROADCAST ──
  if (lower.startsWith('!broadcast ')) {
    const parts = body.slice(11).trim().split(' ');
    const tag = parts[0];
    const intent = parts.slice(1).join(' ');

    if (!tag || !intent) {
      await msg.reply('❌ Usage: !broadcast [tag] [intent]\nExample: !broadcast leads follow up on their inquiry');
      return;
    }

    const contacts = getContactsByTag(tag);
    if (contacts.length === 0) {
      await msg.reply(`❌ No contacts found with tag: ${tag}`);
      return;
    }

    // Preview first contact as sample before sending all
    const sample = contacts[0];
    const { message: sampleMessage } = await generateMessage(intent, sample, settings, parseInt(settings.token_limit_broadcast) || 200);
    const id = Date.now().toString();
    pendingPreviews[id] = { rawNumber: null, broadcastTag: tag, broadcastIntent: intent, broadcastContacts: contacts, sampleMessage, isBroadcast: true };

    await msg.reply(
      `*Broadcast Preview* — ${contacts.length} contacts tagged "${tag}"\n\n` +
      `*Sample message (${sample.name}):*\n───────────────\n${sampleMessage}\n───────────────\n\n` +
      `Reply *yes* to send to all ${contacts.length} contacts or *no* to cancel.`,
      null, { linkPreview: false }
    );
    return;
  }

  // ── QUICK REPLY (no AI) ──
  if (lower.startsWith('!sendnoai ')) {
    const parts = body.slice(10).trim().split(' ');
    const input = parts[0];
    const message = parts.slice(1).join(' ');

    if (!input || !message) {
      await msg.reply('❌ Usage: !sendnoai [number or name] [message]\nExample: !sendnoai John Thanks for reaching out!');
      return;
    }

    const resolved = resolveRecipient(input);
    if (!resolved.resolved) { await msg.reply(resolved.reply); return; }
    const { rawNumber, contact } = resolved;

    try {
      await client.sendMessage(formatNumber(rawNumber), message);
      updateLastContacted(rawNumber);
      appendToLog(rawNumber, contact?.name || '', message, 'outbound:sent', 0, '', 'out', '!sendnoai');
      const contactName = contact ? ` (${contact.name})` : '';
      await msg.reply(`✅ Message sent to ${rawNumber}${contactName}`, null, { linkPreview: false });
    } catch (e) {
      console.error('[ERROR] !sendnoai failed:', e);
      appendToLog(rawNumber, contact?.name || '', message, 'outbound:failed', 0, '', 'out', '!sendnoai');
      await msg.reply('❌ Failed to send message. Check the terminal for details.');
    }
    return;
  }

  // ── FAQ ──
  if (lower.startsWith('!faq ')) {
    const question = body.slice(5).trim();
    const answer = getFAQAnswer(question);
    if (!answer) {
      await msg.reply(`❌ No FAQ found for "${question}"\n\nTip: Add more FAQs in data/settings.csv`);
      return;
    }
    await msg.reply(`*FAQ Answer* 💬\n\n${answer}`, null, { linkPreview: false });
    return;
  }

  // ── STATS ──
  if (lower === '!stats') {
    const stats = getStats();
    if (!stats) {
      await msg.reply('📊 No messages logged yet.');
      return;
    }
    await msg.reply(
      `*Messaging Stats* 📊\n\n` +
      `*Today:* ${stats.today} messages\n` +
      `*This week:* ${stats.week} messages\n` +
      `*All time:* ${stats.total} messages\n` +
      `*Unique contacts reached:* ${stats.uniqueContacts}\n` +
      `*Failed:* ${stats.failed}`
    );
    return;
  }

  // ── REPORT ──
  if (lower === '!report' || lower.startsWith('!report ')) {
    const days = parseInt((body.split(' ')[1]) || '7') || 7;
    const stats = getStats(days);
    if (!stats) {
      await msg.reply('📊 No data yet. Send some messages first!');
      return;
    }
    // Claude Haiku-4-5 via OpenRouter: ~$0.80/1M input + $4/1M output ≈ $1.25/1M blended
    const COST_PER_M = 1.25;
    const costUsd = ((stats.totalTokens / 1000000) * COST_PER_M).toFixed(4);
    const tokenLine = stats.totalTokens > 0
      ? `\n*Tokens Used:* ${stats.totalTokens.toLocaleString()}\n*Est. AI Cost:* $${costUsd}`
      : '';
    const velocityLine = stats.avgVelocityMin !== null
      ? `\n*Hot Lead Response:* avg ${stats.avgVelocityMin} min (${stats.velocityCount} leads)`
      : '';
    const optRate = stats.rangeInbound > 0
      ? ` (${((stats.optOuts / stats.rangeInbound) * 100).toFixed(1)}%)`
      : '';
    await msg.reply(
      `📊 *${days}-Day Report — Cay AI*\n\n` +
      `*Sent:* ${stats.rangeSent} messages\n` +
      `*Inbound:* ${stats.rangeInbound} received\n` +
      `*Auto-Replied:* ${stats.autoReplied}\n` +
      `*Hot Leads:* ${stats.hotLeads}\n` +
      `*Opt-Outs:* ${stats.optOuts}${optRate}\n` +
      `*Complaints:* ${stats.complaints}\n` +
      `*Top Contact:* ${stats.topContactName}` +
      velocityLine + tokenLine,
      null, { linkPreview: false }
    );
    return;
  }

  // ── FOLLOW-UP LIST ──
  if (lower === '!followuplist') {
    const DAYS = 30;
    const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;
    const cold = contactCache.filter(c => {
      if (!c.number) return false;
      if ((c.tags || '').toLowerCase().includes('inactive')) return false;
      if (!c.last_contacted) return true; // never messaged
      const d = new Date(c.last_contacted);
      return !isNaN(d.getTime()) && d.getTime() < cutoff;
    });
    if (cold.length === 0) {
      await msg.reply(`✅ All contacts have been reached in the last ${DAYS} days.`);
      return;
    }
    const lines = cold.slice(0, 20).map(c => {
      const last = c.last_contacted ? `Last: ${c.last_contacted}` : 'Never messaged';
      return `• ${c.name || c.number}${c.business ? ` (${c.business})` : ''} — ${last}`;
    });
    const more = cold.length > 20 ? `\n_...and ${cold.length - 20} more_` : '';
    await msg.reply(`*Cold Contacts — Not messaged in ${DAYS}+ days (${cold.length} total):*\n\n${lines.join('\n')}${more}`, null, { linkPreview: false });
    return;
  }

  // ── SETTINGS ──
  if (lower === '!settings') {
    const s = getSettings();
    await msg.reply(
      `*Current Settings* ⚙️\n\n` +
      `*Business Name:* ${s.business_name || 'Not set'}\n` +
      `*Tone:* ${s.tone || 'friendly-pro'}\n` +
      `*Message Length:* ${s.message_length || 'medium'}\n` +
      `*Language:* ${s.language_style || 'standard'}\n` +
      `*AI Provider:* ${AI_PROVIDER}\n` +
      `*AI Model:* ${AI_MODEL}\n` +
      `*Calendar:* ${s.calendar_link || 'Not set'}\n` +
      `*Owner Number:* ${s.owner_number || 'Not set'}`,
      null, { linkPreview: false }
    );
    return;
  }

  // ── LIST ──
  if (lower === '!list') {
    if (followUps.length === 0) {
      await msg.reply('📭 No pending scheduled messages.');
      return;
    }
    const list = followUps.map((f) => {
      const timeStr = new Date(f.sendAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const name = f.contactName ? ` (${f.contactName})` : '';
      return `🕐 ID: \`${f.id}\`\nTo: ${f.rawNumber}${name}\nAt: ${timeStr}\nMsg: ${f.message.slice(0, 60)}...`;
    }).join('\n\n');
    await msg.reply(`*Scheduled Messages (${followUps.length}):*\n\n${list}`, null, { linkPreview: false });
    return;
  }

  // ── CANCEL ──
  if (lower.startsWith('!cancel ')) {
    const id = parseInt(body.slice(8).trim());
    const index = followUps.findIndex((f) => f.id === id);
    if (index === -1) {
      await msg.reply(`❌ No scheduled message found with ID ${id}`);
      return;
    }
    followUps.splice(index, 1);
    saveFollowUps();
    await msg.reply(`✅ Scheduled message ${id} cancelled.`);
    return;
  }
});

// ─── BROADCAST APPROVAL HANDLER ───────────────────────────────────────────────
// Handles yes/no for broadcast previews separately since they need loop logic
async function handleBroadcastApproval(preview, settings) {
  const { broadcastTag, broadcastIntent, broadcastContacts } = preview;
  let sent = 0, failed = 0;
  for (const contact of broadcastContacts) {
    try {
      const broadSettings = getSettings();
      const { message, tokens: bTokens } = await generateMessage(broadcastIntent, contact, broadSettings, parseInt(broadSettings.token_limit_broadcast) || 200);
      await client.sendMessage(formatNumber(contact.number), message);
      updateLastContacted(contact.number);
      appendToLog(contact.number, contact.name, message, 'outbound:sent', bTokens, '', 'out', '!broadcast');
      sent++;
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      failed++;
      appendToLog(contact.number, contact.name, broadcastIntent, 'outbound:failed', 0, '', 'out', '!broadcast');
    }
  }
  return { sent, failed };
}

// ─── FOLLOW-UP CHECKER ────────────────────────────────────────────────────────
function startFollowUpChecker() {
  setInterval(async () => {
    const now = Date.now();
    const due = followUps.filter((f) => f.sendAt <= now);
    if (due.length === 0) return;

    const settings = getSettings();
    const ownerNumber = formatNumber(settings.owner_number || '');

    for (const f of due) {
      try {
        await client.sendMessage(f.number, f.message);
        updateLastContacted(f.rawNumber);
        appendToLog(f.rawNumber, f.contactName || '', f.message, 'outbound:sent', 0, '', 'out', '!schedule');
        console.log(`✅ Scheduled message sent to ${f.number}`);
        if (ownerNumber) {
          await client.sendMessage(ownerNumber, `📤 Scheduled message sent to ${f.rawNumber}${f.contactName ? ` (${f.contactName})` : ''}`, { linkPreview: false });
        }
      } catch (e) {
        console.error(`❌ Scheduled message failed for ${f.number}:`, e.message);
        appendToLog(f.rawNumber, f.contactName || '', f.message, 'outbound:failed', 0, '', 'out', '!schedule');
        if (ownerNumber) {
          console.error(`[ERROR] Scheduled message failed for ${f.rawNumber}:`, e);
          await client.sendMessage(ownerNumber, `❌ Scheduled message FAILED for ${f.rawNumber}${f.contactName ? ` (${f.contactName})` : ''}. Check the terminal for details.`, { linkPreview: false }).catch(() => {});
        }
      }
    }

    followUps = followUps.filter((f) => f.sendAt > now);
    saveFollowUps();
  }, 30 * 1000);

  // Opt-out spike check — runs once per hour
  let lastOptOutCheck = 0;
  setInterval(async () => {
    const nowMs = Date.now();
    if (nowMs - lastOptOutCheck < 60 * 60 * 1000) return;
    lastOptOutCheck = nowMs;
    try {
      const stats = getStats(7);
      if (!stats || stats.rangeInbound < 10) return; // not enough data
      const rate = stats.optOuts / stats.rangeInbound;
      if (rate >= 0.1) { // 10% opt-out rate threshold
        const settings = getSettings();
        const ownerNumber = formatNumber(settings.owner_number || '');
        if (ownerNumber) {
          await client.sendMessage(ownerNumber,
            `⚠️ *Opt-Out Alert*\n\n${stats.optOuts} opt-outs in the last 7 days (${(rate * 100).toFixed(1)}% of inbound messages).\n\nConsider reviewing your message frequency or content.`,
            { linkPreview: false }).catch(() => {});
        }
      }
    } catch (_) {}
  }, 5 * 60 * 1000);
}



// ─── DAILY REVIEW AGENT ──────────────────────────────────────────────────────
// Runs daily at 8am Bahamas time. Reads the last 24h of log.csv, analyses
// patterns across 4 dimensions, and sends a WhatsApp digest to the owner.
// ─── REVIEW AGENT HELPERS ────────────────────────────────────────────────────

function buildStaleLeadSection() {
  const contacts = parseCSV(CONTACTS_FILE);
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const stale = contacts.filter(c => {
    const tags = (c.tags || '').toLowerCase();
    if (tags.includes('inactive') || tags.includes('customer')) return false;
    if (!tags.includes('lead') && !tags.includes('prospect')) return false;
    if (!c.last_contacted) return true;
    return (now - new Date(c.last_contacted).getTime()) >= THIRTY_DAYS;
  }).slice(0, 15);

  if (stale.length === 0) return null;

  const lines = stale.map((c, i) => {
    const days = c.last_contacted
      ? Math.floor((now - new Date(c.last_contacted).getTime()) / (24 * 60 * 60 * 1000))
      : null;
    return `${i + 1}. *${c.name}*${c.business ? ` — ${c.business}` : ''}${days ? ` _(${days}d ago)_` : ' _(never contacted)_'}`;
  });

  const count = stale.length;
  return `📋 *Sunday Lead Check-In*\n\n` +
    `${count} lead${count === 1 ? '' : 's'} haven't heard from you in 30+ days:\n\n` +
    lines.join('\n') +
    `\n\n_Use !send [name] to reach out to any of them._ 🇧🇸`;
}

function writeReviewHTML({ received, autoReplied, unhandled, optOuts, lowConf, fallthroughs, kbGaps, unfollowedLeads }, aiText, settings) {
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Nassau' });

  const tableRows = (arr, emptyMsg) => arr.length
    ? arr.map(r => `<tr><td>${escHtml(r.ts || '')}</td><td>${escHtml(r.name || r.number || '')}</td><td>${escHtml((r.message || '').slice(0, 100).replace(/\[.*?\]/g, '').trim())}</td><td><span class="badge">${escHtml(r.status || '')}</span></td></tr>`).join('')
    : `<tr><td colspan="4" class="empty">${emptyMsg}</td></tr>`;

  const warnClass = n => n > 0 ? ' warn' : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cay AI — Daily Review</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f9;margin:0;padding:20px;color:#222}
  h1{font-size:1.4rem;margin-bottom:4px}
  .sub{color:#666;font-size:.85rem;margin-bottom:20px}
  .stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
  .stat{background:#fff;border-radius:10px;padding:14px 20px;min-width:110px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .stat .num{font-size:2rem;font-weight:700;color:#0a84ff}
  .stat .num.warn{color:#d97706}
  .stat .lbl{font-size:.75rem;color:#666;margin-top:2px}
  .card{background:#fff;border-radius:10px;padding:18px 20px;margin-bottom:18px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .card h2{font-size:1rem;margin:0 0 12px;color:#0a84ff}
  table{width:100%;border-collapse:collapse;font-size:.82rem}
  th{text-align:left;padding:6px 8px;background:#f0f4f8;color:#555;font-weight:600}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  .badge{background:#e8f0fe;color:#1a56db;padding:2px 7px;border-radius:12px;font-size:.75rem;white-space:nowrap}
  .empty{color:#aaa;font-style:italic;padding:12px 8px}
  .digest{white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:14px;font-size:.85rem;line-height:1.6;border:1px solid #e5e7eb}
  ul{margin:0;padding-left:20px}
  li{padding:3px 0}
</style>
</head>
<body>
<h1>📊 Cay AI — Daily Review</h1>
<p class="sub">Generated ${dateStr}${settings.business_name ? ' · ' + escHtml(settings.business_name) : ''}</p>

<div class="stats">
  <div class="stat"><div class="num">${received}</div><div class="lbl">Received</div></div>
  <div class="stat"><div class="num">${autoReplied}</div><div class="lbl">Auto-replied</div></div>
  <div class="stat"><div class="num${warnClass(unhandled.length)}">${unhandled.length}</div><div class="lbl">Unhandled</div></div>
  <div class="stat"><div class="num">${optOuts.length}</div><div class="lbl">Opt-outs</div></div>
  <div class="stat"><div class="num${warnClass(lowConf.length)}">${lowConf.length}</div><div class="lbl">Low confidence</div></div>
  <div class="stat"><div class="num${warnClass(unfollowedLeads.length)}">${unfollowedLeads.length}</div><div class="lbl">Unfollowed leads</div></div>
</div>

<div class="card">
  <h2>AI Digest</h2>
  <div class="digest">${escHtml(aiText)}</div>
</div>

<div class="card">
  <h2>Unhandled / Escalated Messages</h2>
  <table><thead><tr><th>Time</th><th>Contact</th><th>Message</th><th>Status</th></tr></thead>
  <tbody>${tableRows(fallthroughs, 'No unhandled messages in the last 24h')}</tbody></table>
</div>

<div class="card">
  <h2>KB Gaps — Unanswered Questions</h2>
  <table><thead><tr><th>Time</th><th>Contact</th><th>Message</th><th>Status</th></tr></thead>
  <tbody>${tableRows(kbGaps, 'No KB gaps detected')}</tbody></table>
</div>

<div class="card">
  <h2>Unfollowed Leads (last 24h)</h2>
  ${unfollowedLeads.length
    ? `<ul>${unfollowedLeads.map(n => `<li>${escHtml(n)}</li>`).join('')}</ul>`
    : `<p class="empty">All hot leads received a follow-up. 🎉</p>`}
</div>
</body></html>`;

  const outPath = path.join(__dirname, 'review.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('📄 review.html updated:', outPath);
}

// ─── REVIEW AGENT ─────────────────────────────────────────────────────────────
// Fires daily at 8am Bahamas time. Writes review.html every day.
// On Sundays also sends a combined WhatsApp report (AI digest + stale lead list).
function startReviewAgent() {
  let lastFiredDay = -1;

  setInterval(async () => {
    const now = new Date();
    const bahamasNow  = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const bahamasHour = bahamasNow.getUTCHours();
    const bahamasDay  = Math.floor(bahamasNow.getTime() / (24 * 60 * 60 * 1000));
    const isSunday    = bahamasNow.getUTCDay() === 0;

    if (bahamasHour !== 8 || bahamasDay === lastFiredDay) return;
    lastFiredDay = bahamasDay;

    try {
      const settings    = getSettings();
      const ownerNumber = formatNumber(settings.owner_number || '');
      if (!ownerNumber) return;

      // ── Read last 24h of log entries ──
      const raw = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = raw.slice(1).filter(line => {
        const ts = line.split(',')[0];
        return ts && new Date(ts).getTime() >= cutoff;
      });

      if (recent.length === 0) {
        if (isSunday) {
          const staleSection = buildStaleLeadSection();
          if (staleSection) await client.sendMessage(ownerNumber, staleSection, { linkPreview: false });
        }
        return;
      }

      // ── Parse into structured rows ──
      const rows = recent.map(line => {
        const cols = line.split(',');
        return { ts: cols[0], number: cols[1], name: cols[2], message: cols[3], status: cols[4], confidence: cols[6] };
      });

      // ── 1. Log patterns ──
      const received    = rows.filter(r => r.status === 'inbound:received').length;
      const unhandled   = rows.filter(r => r.status === 'inbound:unhandled');
      const needsReview = rows.filter(r => r.status === 'inbound:needs-review');
      const optOuts     = rows.filter(r => r.status === 'inbound:opt-out');
      const autoReplied = rows.filter(r => r.status === 'inbound:auto-replied').length;
      const lowConf     = rows.filter(r => r.confidence && parseFloat(r.confidence) < 50 && r.status.startsWith('inbound:classified'));

      // ── 2. Intent accuracy — messages that fell through ──
      const fallthroughs = [...unhandled, ...needsReview].slice(0, 10);

      // ── 3. KB gaps — QUESTION intents that needed human reply ──
      const kbGaps = rows.filter(r => r.status === 'inbound:needs-reply').slice(0, 8);

      // ── 4. Lead follow-up gaps ──
      const hotLeadNumbers = new Set(
        rows.filter(r => r.status === 'inbound:hot-lead' || r.status === 'inbound:on-the-fence').map(r => r.number)
      );
      const ownerRepliedTo = new Set(
        rows.filter(r => r.status === 'owner:manual' || r.status === 'outbound:sent').map(r => r.number)
      );
      const unfollowedLeads = [...hotLeadNumbers].filter(n => !ownerRepliedTo.has(n));

      // ── Build AI prompt ──
      const fallSample = fallthroughs.map(r => `"${(r.message || '').slice(0, 80).replace(/\[.*?\]/g, '').trim()}" (${r.status})`).join('\n');
      const kbSample   = kbGaps.map(r => `"${(r.message || '').slice(0, 80).replace(/\[.*?\]/g, '').trim()}"`).join('\n');

      const systemPrompt = `You are a WhatsApp AI agent performance analyst for ${settings.business_name || 'Cay AI'}, a WhatsApp AI outreach tool for small businesses in Nassau, Bahamas.

Review the last 24 hours of agent activity and return a short WhatsApp-ready digest for the business owner. Be direct and practical. No fluff. Max 250 words total.

Format EXACTLY like this (use *bold* for headers, plain text for body):
*📊 Daily Agent Review*

*Log Patterns*
[2-3 bullet points on volume, unhandled rate, opt-outs]

*Intent Accuracy*
[1-2 bullets on messages that fell through or were misclassified, with suggested fixes]

*KB Gaps*
[1-2 bullets on questions customers asked that no FAQ answered — suggest specific entries to add]

*Lead Follow-Up*
[1-2 bullets on hot leads or on-the-fence contacts that didn't get a personal reply]

*Recommended Actions*
[Top 2-3 concrete things the owner should do today]`;

      const userPrompt = `24h stats:
- Total inbound received: ${received}
- Auto-replied: ${autoReplied}
- Unhandled/escalated: ${unhandled.length + needsReview.length}
- Opt-outs: ${optOuts.length}
- Low-confidence classifications (<50%): ${lowConf.length}
- Unfollowed hot leads / on-the-fence: ${unfollowedLeads.length} contacts

Fallthrough messages (classified as OTHER or needs-review):
${fallSample || 'None'}

Unanswered customer questions (no KB match):
${kbSample || 'None'}

Unfollowed lead numbers: ${unfollowedLeads.join(', ') || 'None'}`;

      const ai = await callAI(systemPrompt, userPrompt, 400);
      if (!ai.text) return;

      // ── Always write HTML snapshot ──
      writeReviewHTML({ received, autoReplied, unhandled, optOuts, lowConf, fallthroughs, kbGaps, unfollowedLeads }, ai.text, settings);

      // ── Sunday only: send combined WhatsApp report ──
      if (isSunday) {
        const staleSection = buildStaleLeadSection();
        const combined = ai.text + (staleSection ? '\n\n' + staleSection : '');
        await client.sendMessage(ownerNumber, combined, { linkPreview: false });
        console.log('📊 Sunday report sent');
      } else {
        console.log('📄 Daily review HTML updated (no WhatsApp on weekdays)');
      }
    } catch (e) {
      console.error('Review agent error:', e.message);
    }
  }, 60 * 60 * 1000); // check every hour
}

// ─── INACTIVITY CHECKER ──────────────────────────────────────────────────────

const INACTIVITY_NUDGE_MS  = 5 * 60 * 1000;
const INACTIVITY_EXPIRE_MS = 10 * 60 * 1000;

function startInactivityChecker() {
  setInterval(async () => {
    const now = Date.now();
    const settings = getSettings();

    // ── DEMO SESSIONS (customer-facing) ──
    for (const [from, session] of Object.entries(demoSessions)) {
      const idle = now - (session.lastActivity || now);
      if (!session.nudged && idle >= INACTIVITY_NUDGE_MS) {
        session.nudged = true;
        session.nudgedAt = now;
        await client.sendMessage(from,
          `Still there? 👋 Reply *menu* to jump back in, or just send a message to continue.\n\n- The ${settings.business_name || 'Cay AI'} Team`,
          { linkPreview: false }
        ).catch(() => {});
      } else if (session.nudged && now - session.nudgedAt >= INACTIVITY_EXPIRE_MS) {
        delete demoSessions[from];
        await client.sendMessage(from,
          `Looks like we got cut off! Feel free to message us anytime to start fresh. 🙂\n\n- The ${settings.business_name || 'Cay AI'} Team`,
          { linkPreview: false }
        ).catch(() => {});
        appendToLog(from, from, '[DEMO] Session expired (inactivity)', 'demo:expired', '', '', 'out', 'demo');
      }
    }

    // ── SETUP SESSIONS (owner-facing) ──
    for (const [userId, session] of Object.entries(setupSessions)) {
      const idle = now - (session.lastActivity || now);
      if (!session.nudged && idle >= INACTIVITY_NUDGE_MS) {
        session.nudged = true;
        session.nudgedAt = now;
        await client.sendMessage(userId,
          `⚙️ Setup wizard still active. Reply *!cancelsetup* to stop, or send your next answer to continue.`,
          { linkPreview: false }
        ).catch(() => {});
      } else if (session.nudged && now - session.nudgedAt >= INACTIVITY_EXPIRE_MS) {
        delete setupSessions[userId];
        await client.sendMessage(userId,
          `⚙️ Setup session ended due to inactivity. Run *!setup* anytime to start again.`,
          { linkPreview: false }
        ).catch(() => {});
      }
    }

    // ── ADD-CONTACT SESSIONS (owner-facing) ──
    for (const [userId, session] of Object.entries(addContactSessions)) {
      const idle = now - (session.lastActivity || now);
      if (!session.nudged && idle >= INACTIVITY_NUDGE_MS) {
        session.nudged = true;
        session.nudgedAt = now;
        await client.sendMessage(userId,
          `➕ Add contact wizard still active. Reply *cancel* to stop, or send your next answer to continue.`,
          { linkPreview: false }
        ).catch(() => {});
      } else if (session.nudged && now - session.nudgedAt >= INACTIVITY_EXPIRE_MS) {
        delete addContactSessions[userId];
        await client.sendMessage(userId,
          `➕ Add contact session ended due to inactivity. Run *!addcontact* anytime to restart.`,
          { linkPreview: false }
        ).catch(() => {});
      }
    }

  }, 30_000);
}

// ─── INBOUND MESSAGE HANDLER ─────────────────────────────────────────────────

// Random delay so auto-replies feel quick but not robotic
// fast=true for paths that already had AI latency (shorter extra wait)
function humanDelay(fast = false) {
  const ms = fast
    ? 800  + Math.random() * 1200   // 0.8 – 2.0 s  (after AI call)
    : 1500 + Math.random() * 2000;  // 1.5 – 3.5 s  (instant fast paths)
  return new Promise(r => setTimeout(r, ms));
}

// Fast-path keywords for UNAMBIGUOUS cases (skip AI to save cost + latency)
// Deliberately require clear multi-word phrases so people don't fall off the funnel by accident
const HARD_OPT_OUT = ['stop messages', 'stop messaging', 'stop texting', 'stop contacting', 'unsubscribe', 'remove me from', 'opt out', 'optout'];

function getCalendarLink(settings) {
  return settings.calendar_link || 'https://calendly.com/gjamescollie';
}

// Hard opt-out check — requires a clear multi-word phrase to avoid accidental funnel drop-off
function isHardOptOut(message) {
  const msg = message.toLowerCase().trim();
  return HARD_OPT_OUT.some(phrase => msg.includes(phrase));
}

// Build a compact knowledge base summary for the classifier
function buildKBSummary(settings) {
  const entries = [];
  let i = 1;
  while (settings[`faq_${i}_q`]) {
    entries.push(`${i}. ${settings[`faq_${i}_q`]}`);
    i++;
  }
  return entries.join('\n');
}

// ─── AI INTENT CLASSIFIER ────────────────────────────────────────────────────
// Returns: { intent, confidence, kb_index, reasoning }
async function classifyIntent(message, contact, settings) {
  const bizName = settings.business_name || 'Cay AI';
  const kbSummary = buildKBSummary(settings);
  const stage = getContactStage(contact);
  const contactInfo = contact
    ? `This person is a known contact named ${contact.name}${contact.business ? ` from ${contact.business}` : ''}, tagged as "${contact.tags || 'none'}". Their current funnel stage is: ${stage}.`
    : 'This person is not yet in the contact list. Treat them as a new contact at stage: new.';

  const responseWindow = settings.response_window || '';

  const systemPrompt = `You are an intent classifier for ${bizName}, a business that sells a WhatsApp AI outreach tool to small businesses in the Bahamas.
${responseWindow ? `Owner response window: ${responseWindow}. Factor this in when assessing urgency.` : ''}

Your job: read an incoming WhatsApp message from a potential or existing customer and classify it into EXACTLY ONE intent category. Return ONLY valid JSON, no other text.

INTENT CATEGORIES:
- "OPT_OUT" — wants to stop receiving messages, unsubscribe, not be contacted
- "DEMO" — wants to see a demo, see how it works, see the product in action
- "CALL" — wants to book a call, meeting, consultation, or talk to a person
- "HOT_LEAD" — showing buying interest: asking about price, plans, how to sign up, saying they want it, ready to start
- "QUESTION" — asking a specific question that may be answered by the knowledge base
- "COMPLAINT" — upset, frustrated, reporting a problem, angry, or dissatisfied (needs careful human handling)
- "BOOKING_CONFIRMATION" — confirming or acknowledging an appointment, meeting time, or booking
- "REFERRAL" — recommending or referring someone else, or asking about referring a friend/business
- "GREETING" — opening message with no specific request: "hello", "hi", "hey", "good morning", "what's up", "how are you" — first contact or a bare greeting with no actionable ask
- "ON_THE_FENCE_BUYER" — interested in WhatsApp automation, AI messaging, or business automation but still deciding; shows curiosity, hesitation, or business pain without a direct price or demo ask
- "ACKNOWLEDGEMENT" — short non-question reply with no new request: "ok", "thanks", "got it", "sounds good", "cool", thumbs up emoji, etc.
- "CONVERSATION_CONTINUATION" — continuing a prior thread; follow-up that implies history (e.g. "what about pricing?", "actually one more thing", "following up on that")
- "PERSONAL_CONVERSATION" — the person is clearly talking personally (not about business): venting, chatting casually, sharing personal news, asking personal questions — they know who they're texting but it's not a business inquiry
- "WRONG_NUMBER" — the message is clearly meant for a different person or business entirely: references a name that isn't the business, describes a situation that has no plausible connection to this business (e.g. "hey babe", "is the food ready", "this is about my car insurance claim")
- "OTHER" — anything that does not fit the above

KNOWLEDGE BASE (for QUESTION intent, identify which entry best answers it, or null):
${kbSummary}

${contactInfo}

Respond with ONLY this JSON structure:
{"intent": "CATEGORY", "confidence": 0.0-1.0, "kb_index": number or null, "reasoning": "one short sentence"}

Rules:
- confidence reflects how certain you are (0.9+ = very clear, 0.5-0.7 = somewhat ambiguous, below 0.5 = unclear)
- kb_index is the knowledge base number (1-40) that best answers a QUESTION, or null if none fit or intent is not QUESTION
- Be strict: if a message is vague or could be multiple things, lower the confidence
- A message like "how much" is HOT_LEAD. "what is this" is QUESTION. "this isn't working" is COMPLAINT.
- "thanks" or "ok cool" from someone who just received info is ACKNOWLEDGEMENT, not GREETING.
- "hello", "hi", "hey", "good morning", or any bare greeting with no follow-up is GREETING, not OTHER. "Hello Outreach" is GREETING.
- Use contact stage as context: a stage:customer asking "any updates?" is CONVERSATION_CONTINUATION, not OTHER.
- PERSONAL_CONVERSATION vs WRONG_NUMBER: if the person knows they're texting this business but is just chatting personally, use PERSONAL_CONVERSATION. Only use WRONG_NUMBER if the message is clearly addressed to someone else or describes a completely unrelated situation (wrong recipient, not just wrong topic).
- A message like "lol how was your weekend" from a known contact is PERSONAL_CONVERSATION. "Hey Sarah did you pick up the kids" is WRONG_NUMBER.

KEY PHRASE EXAMPLES (use these to calibrate intent):
- QUESTION → "What is [business name]?", "What exactly do you do?", "How does this work?", "What are your hours?", "Are you open on weekends?", "Where are you located?", "Do you service [island/area]?", "How long before I see results?", "When can this be delivered?", "What's the difference between your plans?", "Do you offer a guarantee?", "What happens if something goes wrong?", "Do you offer support?"
- HOT_LEAD → "How much does this cost?", "What are your pricing plans?", "Are there any hidden fees?", "Is there a setup cost?", "How do I sign up?", "How do I get started?", "How much this costing?", "What y'all prices looking like?", "Any hidden fees or setup costs tacked onto this?", "Are there any discounts if I pay for the whole year upfront?", "Is there a free trial available before I have to pay?", "What happens if I need to cancel my subscription or plan?", "Do you offer custom pricing packages if my business needs more?", "Is the price per user, or is it a flat monthly rate?"
- DEMO → "Can I see a demo?", "How can I try it?", "Can you show me how it works?", "I could see a demo?", "How I could try it out?"
- CALL → "Can we book a call?", "Can I speak to someone?", "We could book a quick call?", "How I get started with this?"
- QUESTION → also includes Bahamian dialect variants: "What is [business name] anyway?", "What y'all does do?", "How this does work?", "What y'all hours is?", "Y'all open over the weekend?", "Where y'all located?", "You does service other islands or just Nassau?", "How long before I see real results?", "When this could get delivered?", "What's the true-true difference between the plans?"
- CONVERSATION_CONTINUATION → "Tell me more", "Fill me in.", "What's the deal with that?", "Keep going", "I'm listening.", "Give me the scoop.", "Can you expand on that a bit?", "Go on", "And then what?", "Keep it coming"
- ON_THE_FENCE_BUYER → "I was thinking about automating my WhatsApp but still tryna decide.", "I run a small business in Nassau, looking into WhatsApp automation but not sure yet.", "Business gets busy on weekends and I sometimes miss messages. Looking at AI but still deciding.", "I'm curious how it works but I don't know if it's worth it.", "I get plenty inquiries every day, just exploring my options.", "I don't want to hire more staff but WhatsApp is getting hard to manage.", "I've been considering AI for customer replies but haven't pulled the trigger yet."
- Treat Bahamian dialect the same as standard English — do not lower confidence just because of dialect.
- ON_THE_FENCE_BUYER vs HOT_LEAD: HOT_LEAD means they are ready to buy (asking price, how to sign up, ready to start). ON_THE_FENCE_BUYER means interested but undecided. HOT_LEAD always outranks ON_THE_FENCE_BUYER.
- ON_THE_FENCE_BUYER vs DEMO: DEMO means they want to see the product right now. ON_THE_FENCE_BUYER means they're still in research/consideration mode.
- ON_THE_FENCE_BUYER vs QUESTION: QUESTION is pure information-seeking with no buying hesitation signals. ON_THE_FENCE_BUYER requires explicit curiosity about automation + hesitation or business pain.
- Confidence for ON_THE_FENCE_BUYER: 0.90+ = clear interest + clear hesitation + business pain; 0.75–0.89 = clear interest + either hesitation or pain; 0.60–0.74 = possible but vague — lower confidence; below 0.60 = use QUESTION or OTHER instead.
- Bahamas local context (Nassau, Freeport, local business, tour, salon, barber, restaurant, car rental, real estate, Airbnb) increases confidence for ON_THE_FENCE_BUYER.`;

  // Delimiters prevent prompt injection: instructions inside <message> cannot override the system prompt
  const userPrompt = `Classify this incoming message:\n\n<inbound_message>\n${message}\n</inbound_message>\n\nReturn ONLY valid JSON.`;

  const result = await callAI(systemPrompt, userPrompt, 250);
  if (!result.text) return null;

  // Parse JSON robustly (strip markdown fences if present)
  try {
    let clean = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    // Grab the first {...} block
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) clean = jsonMatch[0];
    const parsed = JSON.parse(clean);
    parsed.tokens = result.tokens;
    return parsed;
  } catch (e) {
    console.error('Failed to parse intent JSON:', result.text);
    return null;
  }
}

function tagContactInactive(number) {
  try {
    const raw = fs.readFileSync(CONTACTS_FILE, 'utf8').trim();
    const lines = raw.split('\n');
    const updated = lines.map((line, i) => {
      if (i === 0) return line;
      const cols = line.split(',');
      if (cols[0].trim().replace(/\D/g, '') === number.replace(/\D/g, '')) {
        cols[3] = 'inactive';
        return cols.join(',');
      }
      return line;
    });
    fs.writeFileSync(CONTACTS_FILE, updated.join('\n'));
    refreshContactCache();
  } catch (e) {
    console.error('Error tagging contact inactive:', e.message);
  }
}

function getContactStage(contact) {
  if (!contact || !contact.tags) return 'new';
  const match = contact.tags.split(' ').find(t => t.startsWith('stage:'));
  return match ? match.replace('stage:', '') : 'new';
}

function setContactStage(number, stage) {
  try {
    const raw = fs.readFileSync(CONTACTS_FILE, 'utf8').trim();
    const lines = raw.split('\n');
    const updated = lines.map((line, i) => {
      if (i === 0) return line;
      const cols = line.split(',');
      if (cols[0].trim().replace(/\D/g, '') === number.replace(/\D/g, '')) {
        const existingTags = (cols[3] || '').trim();
        const filtered = existingTags.split(' ').filter(t => t && !t.startsWith('stage:')).join(' ');
        cols[3] = (filtered ? filtered + ' ' : '') + `stage:${stage}`;
        return cols.join(',');
      }
      return line;
    });
    fs.writeFileSync(CONTACTS_FILE, updated.join('\n'));
    refreshContactCache();
  } catch (e) {
    console.error('Error setting contact stage:', e.message);
  }
}

function getKBAnswer(index, settings) {
  if (!index) return null;
  const q = settings[`faq_${index}_q`];
  const a = settings[`faq_${index}_a`];
  if (q && a) return { question: q, answer: a };
  return null;
}

// Returns up to `n` KB entries whose question words overlap with the message body.
// Falls back to the first n entries if no overlap found.
function getTopKBCandidates(body, settings, n = 2) {
  const words = body.toLowerCase().split(/\s+/);
  const scored = [];
  let i = 1;
  while (settings[`faq_${i}_q`]) {
    const qWords = settings[`faq_${i}_q`].toLowerCase().split(/\s+/);
    const overlap = words.filter(w => w.length > 3 && qWords.includes(w)).length;
    scored.push({ index: i, question: settings[`faq_${i}_q`], overlap });
    i++;
  }
  scored.sort((a, b) => b.overlap - a.overlap);
  return scored.slice(0, n);
}

async function generateAssessment(contact, stage, body, intent, settings) {
  const bizName = settings.business_name || 'Cay AI';
  const tone = settings.tone || 'friendly-pro';
  const language = settings.language_style || 'standard';
  const signature = settings.signature || `- The ${bizName} Team`;
  const calendarLink = getCalendarLink(settings);
  const contactLabel = contact ? contact.name : 'an unknown contact';

  const systemPrompt = `You are a sales advisor for ${bizName}, a WhatsApp AI outreach SaaS for small businesses in the Bahamas.
Given a contact's funnel stage, their message, and the classified intent, return ONLY valid JSON with two fields:
- "assessment": 1-2 sentences of practical next-step advice for the business owner. Direct, no fluff.
- "suggested_reply": a ready-to-send WhatsApp reply the owner can edit and send. Tone: ${tone}. Language: ${language}. Sign off with exactly: ${signature}. Under 60 words. No subject line. No hashtags. Max 1 emoji.${calendarLink ? ` Calendar link if needed: ${calendarLink}` : ''}

Return ONLY valid JSON. No other text.`;

  const userPrompt = `Contact: ${contactLabel}\nStage: ${stage}\nIntent: ${intent}\n\n<inbound_message>\n${body}\n</inbound_message>`;

  const result = await callAI(systemPrompt, userPrompt, 200);
  if (!result.text) return null;

  try {
    let clean = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) clean = jsonMatch[0];
    return JSON.parse(clean);
  } catch (e) {
    return null;
  }
}

// Confidence thresholds for auto-action vs notify-human
const AUTO_ACT_THRESHOLD = 0.75;   // above this, agent acts automatically
const SUGGEST_THRESHOLD  = 0.45;   // between this and auto, notify owner with suggestion

// ─── RESPONSE WINDOW CHECKER ─────────────────────────────────────────────────
// Parses "Monday to Friday 9am to 5pm" and checks if current Bahamas time (UTC-5) is outside it.
// Returns true if outside hours (should send holding reply). Returns false if window is unset/unparseable.
function isOutsideResponseWindow(responseWindow) {
  if (!responseWindow) return false;
  try {
    const now = new Date();
    // Bahamas is UTC-5 (no DST adjustment — close enough for a holding reply)
    const bahamasHour = (now.getUTCHours() - 5 + 24) % 24;
    const bahamasDay  = new Date(now.getTime() - 5 * 60 * 60 * 1000).getUTCDay(); // 0=Sun

    const lower = responseWindow.toLowerCase();

    // Parse hour range — look for patterns like "9am to 5pm", "9:00 to 17:00"
    const hourMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!hourMatch) return false;
    const toH = (h, min, meridiem) => {
      let hour = parseInt(h);
      if (meridiem === 'pm' && hour !== 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      return hour + (parseInt(min || '0') / 60);
    };
    const startH = toH(hourMatch[1], hourMatch[2], hourMatch[3]);
    const endH   = toH(hourMatch[4], hourMatch[5], hourMatch[6]);

    // Parse day range — look for weekday mentions
    const days = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
    const dayMatch = lower.match(/(sun|mon|tue|wed|thu|fri|sat)/g);
    let inDayRange = true;
    if (dayMatch && dayMatch.length >= 2) {
      const startDay = days[dayMatch[0]];
      const endDay   = days[dayMatch[1]];
      inDayRange = startDay <= endDay
        ? bahamasDay >= startDay && bahamasDay <= endDay
        : bahamasDay >= startDay || bahamasDay <= endDay;
    } else if (dayMatch && dayMatch.length === 1) {
      inDayRange = bahamasDay === days[dayMatch[0]];
    }

    const inHourRange = bahamasHour >= startH && bahamasHour < endH;
    return !(inDayRange && inHourRange);
  } catch (e) {
    return false;
  }
}

// ─── SPAM DETECTOR ────────────────────────────────────────────────────────────
const SPAM_PATTERNS = [
  /https?:\/\//i,                          // contains a URL
  /bit\.ly|tinyurl|t\.co|goo\.gl/i,        // short link services
  /click here|free money|winner|prize/i,   // bait phrases
  /\$\$\$|₿|bitcoin|crypto wallet/i,       // crypto scams
  /congratulations.*won|you've been selected/i,
  /.{500,}/,                               // extremely long message (500+ chars)
];

function isSpam(message) {
  return SPAM_PATTERNS.some(p => p.test(message));
}

async function handleInbound(msg) {
  const settings = getSettings();
  const ownerNumber = formatNumber(settings.owner_number || '');
  if (!ownerNumber) return;

  const phoneNumber = await resolveRealNumber(msg.from);
  const from = phoneNumber;
  const contact = findContact(phoneNumber);
  const contactName = contact ? contact.name : '(unknown)';
  const firstName = contact ? contact.name.split(' ')[0] : '';
  // Neutralize any formula injection from inbound body before any further use
  const body = msg.body.trim().replace(/^[=+\-@]/, "'$&");
  const bizName = settings.business_name || 'Cay AI';
  const calendarLink = getCalendarLink(settings);
  const signature = settings.signature || `- The ${bizName} Team`;

  // ── FAST PATH: empty/media-only messages (no text to classify) ──
  if (!body) return;

  console.log(`📨 Inbound from ${contactName}: ${body}`);
  const spamFlag = isSpam(body) ? ' [⚠️ SPAM?]' : '';
  appendToLog(from, contactName, `[INBOUND${spamFlag}] ${body}`, 'inbound:received', '', '', 'in', 'auto');
  if (spamFlag) {
    console.warn(`⚠️ Possible spam from ${contactName} (${from}): ${body.slice(0, 80)}`);
    await client.sendMessage(ownerNumber, `⚠️ *Possible Spam* flagged\n\n*From:* ${contactName} (${from})\n*Message:* _"${body.slice(0, 200)}"_\n\nAgent will continue to classify normally.`, { linkPreview: false }).catch(() => {});
  }

  // ── FAST PATH: hard opt-out (no AI needed) ──
  if (isHardOptOut(body)) {
    tagContactInactive(from);
    await humanDelay();
    await msg.reply(
      `Hi${firstName ? ` ${firstName}` : ''}! We have removed you from our outreach list and will not contact you again.\n\nIf you ever change your mind we are always here to help.\n\n${signature}`,
      null, { linkPreview: false }
    );
    await client.sendMessage(ownerNumber,
      `🚫 *Opt-Out*\n\n${contactName} (${from}) has opted out and been tagged inactive.\n\n_"${body}"_`,
      { linkPreview: false }
    );
    appendToLog(from, contactName, 'Opted out (keyword)', 'inbound:opt-out', '', '', 'in', 'auto');
    return;
  }

  // ── DEMO STATE MACHINE (intercept before AI) ──
  if (demoSessions[from]) {
    await handleDemoFlow(msg, from, body, settings);
    return;
  }
  if (body.toLowerCase().trim() === 'demo') {
    demoSessions[from] = { state: 'intro', lastActivity: Date.now() };
    setContactStage(from, 'demo');
    if (ownerNumber) await client.sendMessage(ownerNumber, `🎯 *Demo Started*\n\n*From:* ${contactName} (${from})\n\nThey entered the interactive demo flow.`, { linkPreview: false }).catch(() => {});
    appendToLog(from, contactName, 'Demo started', 'demo', '', '', 'in', 'auto');
    await humanDelay();
    await msg.reply(
      `🚀 *Welcome to Cay AI!* 🇧🇸\n\n` +
      `Before I show you what I can do, let me make this personal.\n\n` +
      `Reply with your *Name*, *Business Name*, and *what you sell* — separated by commas.\n\n` +
      `_(Example: James, Marlin Charters, Boat Tours)_`,
      null, { linkPreview: false }
    );
    return;
  }

  // ── DISAMBIGUATION RESOLUTION ──
  const pending = pendingDisambiguation[from];
  if (pending && Date.now() < pending.expires) {
    const choice = body.trim().toLowerCase();
    // Match on "1"/"2", or on any meaningful word from the option's question text
    let idx = choice === '1' ? 0 : choice === '2' ? 1 : -1;
    if (idx === -1) {
      idx = pending.options.findIndex(opt => {
        const keywords = opt.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        return keywords.some(kw => choice.includes(kw));
      });
    }
    if (idx >= 0 && pending.options[idx]) {
      delete pendingDisambiguation[from];
      const chosen = pending.options[idx];
      const kb = getKBAnswer(chosen.index, settings);
      if (kb) {
        await humanDelay();
        await msg.reply(`${kb.answer}\n\n${signature}`, null, { linkPreview: false });
        await notifyOwner('auto', 'Question — Disambiguated & Answered',
          `\n📖 *Matched:* ${kb.question}\n*Sent:* ${kb.answer.slice(0, 100)}${kb.answer.length > 100 ? '...' : ''}`
        );
        appendToLog(from, contactName, `[DISAMBIG-KB] ${kb.answer}`, 'inbound:auto-replied', '', '', 'in', 'auto');
        return;
      }
    }
    // Reply didn't match either option — fall through to normal classification
    delete pendingDisambiguation[from];
  }

  // ── OUTSIDE RESPONSE WINDOW ──
  // Send a warm holding reply but still classify and log normally
  if (settings.response_window && isOutsideResponseWindow(settings.response_window)) {
    await humanDelay();
    await msg.reply(CANNED.outsideHours(firstName, settings.response_window, signature), null, { linkPreview: false });
    appendToLog(from, contactName, `[OUTSIDE HOURS] ${body}`, 'inbound:outside-hours', '', '', 'in', 'auto');
  }

  // ── AI CLASSIFICATION ──
  const result = await classifyIntent(body, contact, settings);

  // If classification failed entirely, notify owner to handle manually
  if (!result || !result.intent) {
    await humanDelay(true);
    await msg.reply(CANNED.bufferReply(firstName, signature), null, { linkPreview: false });
    const displayName = contact ? contactName : '(unknown)';
    await client.sendMessage(ownerNumber,
      `🔴 ESCALATE — 📨 *Inbound Message* _(could not classify)_ — ${displayName} · ${phoneNumber}\n✉️ _"${body}"_\n!send ${phoneNumber}`,
      { linkPreview: false }
    );
    appendToLog(from, contactName, body, 'inbound:unclassified', '', '', 'in', 'auto');
    return;
  }

  const { intent, confidence, kb_index, reasoning } = result;
  const conf = typeof confidence === 'number' ? confidence : 0;
  const confStr = `${(conf * 100).toFixed(0)}%`;
  const stage = getContactStage(contact);
  console.log(`🧠 Intent: ${intent} (${confStr}) [stage: ${stage}] — ${reasoning || ''}`);
  appendToLog(from, contactName, `[CLASSIFIED] ${intent}`, 'inbound:classified', '', confStr, 'in', 'auto');

  // Structured notification helper
  // actionType: 'auto' | 'review' | 'human'
  const notifyOwner = async (actionType, label, extra = '') => {
    const statusLine = actionType === 'auto' ? '🟢 AUTO' : actionType === 'review' ? '🟡 SUGGEST' : '🔴 ESCALATE';
    const intentEmoji = { OPT_OUT:'🚫', DEMO:'🎯', CALL:'📞', HOT_LEAD:'🔥', COMPLAINT:'⚠️', BOOKING_CONFIRMATION:'✅', REFERRAL:'⭐', QUESTION:'❓', ACKNOWLEDGEMENT:'👍', CONVERSATION_CONTINUATION:'🔄', PERSONAL_CONVERSATION:'😄', GREETING:'👋', WRONG_NUMBER:'❌', ON_THE_FENCE_BUYER:'🤔', OTHER:'📨' }[intent] || '📨';
    const displayName = contact ? contactName : '(unknown)';
    const line1 = `${statusLine} — ${intentEmoji} *${label}* (${confStr}) — ${displayName} · ${phoneNumber}`;
    const line2 = `✉️ _"${body}"_`;
    const parts = [line1, line2];
    if (extra) parts.push('', extra.trim());
    if (actionType === 'human') parts.push('', `!send ${phoneNumber}`);
    await client.sendMessage(ownerNumber, parts.join('\n'), { linkPreview: false });
  };

  // ── LOW CONFIDENCE: always escalate to human regardless of intent ──
  if (conf < SUGGEST_THRESHOLD) {
    await humanDelay(true);
    await msg.reply(CANNED.bufferReply(firstName, signature), null, { linkPreview: false });
    const ai = await generateAssessment(contact, stage, body, intent, settings);
    await notifyOwner('human', 'Unclear Message',
      `\n⚠️ Low confidence (${(conf * 100).toFixed(0)}%) — please review and reply manually.` +
      (ai ? `💡 _${ai.assessment}_\n✏️ _"${ai.suggested_reply}"_` : '')
    );
    appendToLog(from, contactName, `[${intent}] ${body}`, 'inbound:needs-review', '', confStr, 'in', 'auto');
    return;
  }

  // ── ROUTE BY INTENT ──
  switch (intent) {
    case 'OPT_OUT': {
      if (conf < AUTO_ACT_THRESHOLD) {
        await humanDelay(true);
        await msg.reply(pick([
          `${firstName ? `Hi ${firstName}, ` : `Hi, `}just to confirm — did you want us to stop messaging you? If so, reply *STOP MESSAGES* and we'll take care of that right away. Otherwise, we're happy to keep helping! 🙏\n\n${signature}`,
          `${firstName ? `Hey ${firstName} — ` : `Hey — `}we want to make sure we get this right. Did you mean to opt out? Reply *STOP MESSAGES* to be removed, or just ignore this if all is good. 😊\n\n${signature}`,
          `${firstName ? `Hi ${firstName}! ` : `Hi! `}We caught that you might want off our list. No hard feelings at all — just reply *STOP MESSAGES* to confirm and we'll remove you straight away.\n\n${signature}`,
        ]), null, { linkPreview: false });
        await notifyOwner('review', 'Possible Opt-Out', `\nThey may want to opt out but it was not fully clear. We asked them to confirm. No changes made yet.`);
        appendToLog(from, contactName, `[POSSIBLE OPT-OUT] ${body}`, 'inbound:opt-out-pending', '', confStr, 'in', 'auto');
        return;
      }
      tagContactInactive(from);
      await humanDelay(true);
      await msg.reply(CANNED.optOut(firstName, signature), null, { linkPreview: false });
      await notifyOwner('auto', 'Opt-Out', `\nThey have been tagged inactive.`);
      appendToLog(from, contactName, 'Opted out', 'inbound:opt-out', '', confStr, 'in', 'auto');
      return;
    }

    case 'DEMO': {
      await humanDelay(true);
      await startDemoMenu(msg, from);
      setContactStage(from, 'demo');
      await notifyOwner('auto', 'Demo Started', `\nThey entered the interactive demo flow.`);
      appendToLog(from, contactName, 'Demo started', 'demo', '', confStr, 'in', 'auto');
      return;
    }

    case 'CALL': {
      const stageOrder = ['new','exploring','demo','booked','customer','wrong-number'];
      if (stageOrder.indexOf(stage) < stageOrder.indexOf('exploring')) setContactStage(from, 'exploring');
      await humanDelay(true);
      if (conf >= AUTO_ACT_THRESHOLD) {
        const callDemoNudge = ['new','exploring'].includes(stage) ? `\n\nWant to see it live in this chat first? Reply *demo* to try it — no commitment. 🚀` : '';
        await msg.reply(CANNED.call(firstName, calendarLink, signature) + callDemoNudge, null, { linkPreview: false });
      } else {
        await msg.reply(CANNED.bufferReply(firstName, signature), null, { linkPreview: false });
      }
      const aiCall = await generateAssessment(contact, stage, body, intent, settings);
      await notifyOwner(conf >= AUTO_ACT_THRESHOLD ? 'review' : 'human', 'Call Request',
        (conf >= AUTO_ACT_THRESHOLD ? `\nCalendar link sent: ${calendarLink}` : `\n⚠️ Low confidence — holding reply sent. Review and send calendar link manually.`) +
        (aiCall ? `💡 _${aiCall.assessment}_\n✏️ _"${aiCall.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, 'Call request', 'inbound:call', '', confStr, 'in', 'auto');
      return;
    }

    case 'HOT_LEAD': {
      const stageOrder = ['new','exploring','demo','booked','customer','wrong-number'];
      if (stageOrder.indexOf(stage) < stageOrder.indexOf('exploring')) setContactStage(from, 'exploring');
      await humanDelay(true);
      if (conf >= AUTO_ACT_THRESHOLD) {
        const hotDemoNudge = ['new','exploring'].includes(stage) ? `\n\nWant to see it live in this chat first? Reply *demo* to try it — no commitment. 🚀` : '';
        await msg.reply(CANNED.hotLead(firstName, calendarLink, signature) + hotDemoNudge, null, { linkPreview: false });
      } else {
        await msg.reply(CANNED.bufferReply(firstName, signature), null, { linkPreview: false });
      }
      const aiHot = await generateAssessment(contact, stage, body, intent, settings);
      await notifyOwner(conf >= AUTO_ACT_THRESHOLD ? 'review' : 'human', 'HOT LEAD 🔥',
        (conf >= AUTO_ACT_THRESHOLD ? `\n⚡ They showed buying interest — follow up fast! Calendar link was sent.` : `\n⚡ Possible hot lead but low confidence — holding reply sent. Follow up manually!`) +
        (aiHot ? `💡 _${aiHot.assessment}_\n✏️ _"${aiHot.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, 'Hot lead', 'inbound:hot-lead', '', confStr, 'in', 'auto');
      return;
    }

    case 'COMPLAINT': {
      await humanDelay(true);
      await msg.reply(CANNED.complaint(firstName, signature), null, { linkPreview: false });
      const aiComp = await generateAssessment(contact, stage, body, intent, settings);
      await notifyOwner('human', 'COMPLAINT — Needs You',
        `\n⚠️ This person seems upset. A holding reply was sent. Please follow up personally ASAP.` +
        (aiComp ? `💡 _${aiComp.assessment}_\n✏️ _"${aiComp.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, `[COMPLAINT] ${body}`, 'inbound:complaint', '', confStr, 'in', 'auto');
      return;
    }

    case 'BOOKING_CONFIRMATION': {
      setContactStage(from, 'booked');
      await humanDelay(true);
      await msg.reply(CANNED.bookingConfirmation(firstName, signature), null, { linkPreview: false });
      await notifyOwner('auto', 'Booking Confirmed', `\nThey confirmed a booking/appointment. Stage updated to booked.`);
      appendToLog(from, contactName, 'Booking confirmed', 'inbound:booking', '', confStr, 'in', 'auto');
      return;
    }

    case 'REFERRAL': {
      const aiRef = await generateAssessment(contact, stage, body, intent, settings);
      await humanDelay(true);
      await msg.reply(CANNED.referral(firstName, signature), null, { linkPreview: false });
      await notifyOwner('human', 'Referral',
        `\n⭐ This looks like a referral opportunity — worth a personal reply.` +
        (aiRef ? `💡 _${aiRef.assessment}_\n✏️ _"${aiRef.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, `[REFERRAL] ${body}`, 'inbound:referral', '', confStr, 'in', 'auto');
      return;
    }

    case 'QUESTION': {
      const kb = getKBAnswer(kb_index, settings);
      if (kb && conf >= AUTO_ACT_THRESHOLD) {
        await humanDelay(true);
        await msg.reply(`${kb.answer}\n\n${signature}`, null, { linkPreview: false });
        await notifyOwner('auto', 'Question — Auto-Answered',
          `\n📖 *Matched:* ${kb.question}\n*Sent:* ${kb.answer.slice(0, 100)}${kb.answer.length > 100 ? '...' : ''}`
        );
        appendToLog(from, contactName, `[AUTO-KB] ${kb.answer}`, 'inbound:auto-replied', '', confStr, 'in', 'auto');
        return;
      }
      // Below auto-act threshold — try disambiguation before escalating to owner
      const candidates = getTopKBCandidates(body, settings, 2);
      if (candidates.length >= 2 && candidates[0].question && candidates[1].question) {
        pendingDisambiguation[from] = {
          options: candidates,
          expires: Date.now() + 10 * 60 * 1000, // 10 min window to reply
        };
        await humanDelay(true);
        await msg.reply(
          `${firstName ? `Hey ${firstName}! ` : `Hey! `}Just want to make sure I get you the right answer — were you asking about:\n\n` +
          `*1.* ${candidates[0].question}\n` +
          `*2.* ${candidates[1].question}\n\n` +
          `Reply *1* or *2* and I'll send you the full answer. 😊\n\n${signature}`,
          null, { linkPreview: false }
        );
        await notifyOwner('review', 'Question — Disambiguation Sent',
          `\nSent a 2-choice clarification. Waiting for their reply.\n1. ${candidates[0].question}\n2. ${candidates[1].question}`
        );
        appendToLog(from, contactName, `[DISAMBIG] ${body}`, 'inbound:disambiguation', '', confStr, 'in', 'auto');
        return;
      }
      // No good KB candidates — escalate to owner
      const aiQ = await generateAssessment(contact, stage, body, intent, settings);
      await notifyOwner('human', 'Question — Needs Your Reply',
        (kb ? `\n*Possible answer (${kb.question}):*\n_${kb.answer.slice(0, 120)}..._\n` : '\nNo knowledge base match found.\n') +
        (aiQ ? `💡 _${aiQ.assessment}_\n✏️ _"${aiQ.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, body, 'inbound:needs-reply', '', confStr, 'in', 'auto');
      return;
    }

    case 'ACKNOWLEDGEMENT': {
      if (conf >= AUTO_ACT_THRESHOLD) {
        await notifyOwner('auto', 'Acknowledged — No Reply Needed', `\nThey acknowledged your last message. No action required.`);
        appendToLog(from, contactName, `[ACK] ${body}`, 'inbound:acknowledged', '', confStr, 'in', 'auto');
        return;
      }
      await notifyOwner('review', 'Possible Acknowledgement', `\nLow-confidence acknowledgement — review if a reply is needed.`);
      appendToLog(from, contactName, body, 'inbound:needs-review', '', confStr, 'in', 'auto');
      return;
    }

    case 'CONVERSATION_CONTINUATION': {
      const aiCont = await generateAssessment(contact, stage, body, intent, settings);
      await notifyOwner('human', 'Conversation Continuation',
        `\n🔄 They are picking up a prior thread — review history and reply personally.` +
        (aiCont ? `💡 _${aiCont.assessment}_\n✏️ _"${aiCont.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, body, 'inbound:continuation', '', confStr, 'in', 'auto');
      return;
    }

    case 'PERSONAL_CONVERSATION': {
      await notifyOwner('review', 'Personal Conversation',
        `\n😄 Seems like a personal chat, not a business inquiry. No auto-reply sent.`
      );
      appendToLog(from, contactName, `[PERSONAL] ${body}`, 'inbound:personal', '', confStr, 'in', 'auto');
      return;
    }

    case 'GREETING': {
      const bizName = settings.business_name || '';
      const bizContext = settings.business_context || '';
      // Build a short one-liner: "We're [name] — [context snippet]." or just "We're [name]."
      let bizLine = '';
      if (bizName && bizContext) {
        const snippet = bizContext.split(/[.!?]/)[0].trim();
        bizLine = `We're ${bizName}${snippet ? ` — ${snippet}.` : '.'}`;
      } else if (bizName) {
        bizLine = `We're ${bizName}.`;
      }
      await humanDelay(true);
      await msg.reply(CANNED.greeting(firstName, bizLine, signature), null, { linkPreview: false });
      await notifyOwner('auto', 'Greeting — Auto-Replied', `\nA welcome reply was sent asking how we can help.`);
      appendToLog(from, contactName, `[GREETING] ${body}`, 'inbound:greeting', '', confStr, 'in', 'auto');
      return;
    }

    case 'WRONG_NUMBER': {
      // Just note it — no reply to sender
      setContactStage(from, 'wrong-number');
      appendToLog(from, contactName, `[WRONG NUMBER] ${body}`, 'inbound:wrong-number', '', confStr, 'in', 'auto');
      await notifyOwner('auto', 'Wrong Number', `\nNo reply sent. Contact stage set to wrong-number.`);
      return;
    }

    case 'ON_THE_FENCE_BUYER': {
      const stageOrder = ['new','exploring','demo','booked','customer','wrong-number'];
      if (stageOrder.indexOf(stage) < stageOrder.indexOf('exploring')) setContactStage(from, 'exploring');
      await humanDelay(true);
      if (conf >= AUTO_ACT_THRESHOLD) {
        await msg.reply(CANNED.onTheFence(firstName, signature), null, { linkPreview: false });
      } else {
        await msg.reply(CANNED.bufferReply(firstName, signature), null, { linkPreview: false });
      }
      const aiFence = await generateAssessment(contact, stage, body, intent, settings);
      await notifyOwner(conf >= AUTO_ACT_THRESHOLD ? 'review' : 'human', 'On-The-Fence Buyer 🤔',
        (conf >= AUTO_ACT_THRESHOLD
          ? `\n💡 This prospect is curious but undecided. A soft-nudge reply was sent — follow up personally to offer a demo.\n`
          : `\n⚠️ Possible on-the-fence buyer but low confidence — holding reply sent. Follow up personally.\n`) +
        (aiFence ? `\n💡 _${aiFence.assessment}_\n✏️ _"${aiFence.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, `[ON_THE_FENCE] ${body}`, 'inbound:on-the-fence', '', confStr, 'in', 'auto');
      return;
    }

    case 'OTHER':
    default: {
      await humanDelay(true);
      await msg.reply(CANNED.bufferReply(firstName, signature), null, { linkPreview: false });
      const aiOther = await generateAssessment(contact, stage, body, intent, settings);
      await notifyOwner('human', 'Inbound Message',
        (aiOther ? `💡 _${aiOther.assessment}_\n✏️ _"${aiOther.suggested_reply}"_` : '')
      );
      appendToLog(from, contactName, body, 'inbound:unhandled', '', confStr, 'in', 'auto');
      return;
    }
  }
}

// ─── HEALTH ENDPOINT ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  const http = require('http');
  const START_TIME = Date.now();
  http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        client_id: process.env.CLIENT_ID || 'default',
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(3000);
}

// ─── START ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  client.initialize();
}

// ─── TEST EXPORTS (only active when NODE_ENV=test) ────────────────────────────
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    // pure helpers
    pick, parseCSV, appendToLog, buildTemplateFallback, withNav, CANNED,
    // constants
    SETUP_STEPS, KB_INTRO_INDEX, LOGICAL_TOTAL, AUTO_ACT_THRESHOLD, SUGGEST_THRESHOLD,
    // state
    setupSessions, pendingPreviews, demoSessions,
    // state machines
    handleSetup, handleInbound, handleDemoFlow,
    // data helpers
    getSettings, findContact, resolveRecipient, classifyIntent,
    // network
    fetchNewsHeadlines, fetchNassauWeather,
    // log path (so tests can inspect the file)
    LOG_FILE,
  };
}
