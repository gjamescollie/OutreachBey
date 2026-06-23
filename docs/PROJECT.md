# OutreachBey — Project Overview

## What It Is
OutreachBey is a WhatsApp AI outreach and automation platform built for small businesses and entrepreneurs in Nassau, Bahamas. It runs as a locally-hosted Node.js agent that connects to an existing WhatsApp number via linked device, uses AI to write personalized messages, and handles inbound customer messages automatically.

## The Business
- **Brand:** OutreachBey
- **Company:** GJC Digital
- **Owner:** Granville
- **WhatsApp number:** 12425254093
- **Market:** Nassau, Bahamas — small businesses and solo entrepreneurs
- **Model:** Managed SaaS — Granville consults, builds, and supports each client instance

## The Product
Each client gets their own instance of the agent connected to their own WhatsApp number. There is no central multi-tenant backend — it is a per-business deployment.

### Pricing Tiers
| Tier | Price | Includes |
|---|---|---|
| Starter | $49/mo | Commands only, CSV contacts, no AI, self-setup |
| Growth | $129/mo | Full AI messaging, knowledge base, setup wizard, support |
| Pro | $299/mo | Everything + priority support, custom onboarding, multi-number, monthly strategy call |

## Target Industries (Priority Order)
1. Boat tour operators, excursion and tour companies
2. Restaurants and bars
3. Real estate agents
4. Car rentals
5. Clothing boutiques
6. Salons
7. Vacation rentals / Airbnb hosts
8. Wedding planners and photographers
9. Contractors and handymen
10. Gyms and personal trainers
11. Pharmacies and health clinics

## Competitive Positioning
OutreachBey is built specifically for the Bahamian market. WhatsApp is the primary business communication channel in Nassau. Most international tools (WATI, Interakt) are too complex, too expensive, and not built for this market. OutreachBey is affordable, locally supported, and speaks the local language.

## Call to Action
- **Primary:** Reply DEMO — agent self-demos live on WhatsApp
- **Secondary:** Reply CALL — sends Calendly link for a free consultation
- **Calendar:** https://calendly.com/gjamescollie/30min

## Business Hours vs Response Window
- **Hours (customer-facing):** Monday–Friday, 9am–5pm Bahamas time
- **Response window (AI context):** Monday–Friday, 8am–7pm Bahamas time
  - The AI uses `response_window` to set expectations in messages — outside these hours it will not imply instant human availability
