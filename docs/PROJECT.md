# Cay AI — Project Overview

## What It Is
Cay AI is a WhatsApp AI outreach and automation platform built for small businesses in Nassau, Bahamas. It runs as a Node.js agent connected to a client's existing WhatsApp number via linked device, uses AI to write personalised messages, and handles inbound customer messages automatically.

## The Business
- **Brand:** Cay AI
- **Company:** Lucayan Labs
- **Owner:** Granville James-Collie
- **Contact WhatsApp:** 12425254093
- **Market:** Nassau, Bahamas — small businesses and solo entrepreneurs
- **Model:** Managed SaaS — Granville consults, builds, and supports each client instance on their own droplet

## The Product
Each client gets their own instance of the agent connected to their own WhatsApp number, running in Docker on a DigitalOcean droplet. There is no central multi-tenant backend — it is a per-business deployment.

### Pricing Tiers
| Tier | Price | Includes |
|---|---|---|
| Starter | $49/mo | Commands only, CSV contacts, no AI, self-setup |
| Growth | $129/mo | Full AI messaging, knowledge base, setup wizard, support |
| Pro | $299/mo | Everything + priority support, custom onboarding, multi-number, monthly strategy call |

## Target Industries (Priority Order)
1. Boat tour operators, excursion and tour companies
2. Fishing charters
3. Restaurants and bars
4. Real estate agents
5. Car rentals
6. Salons and beauty
7. Vacation rentals / Airbnb hosts
8. Wedding planners and photographers
9. Contractors and handymen
10. Gyms and personal trainers
11. Pharmacies and health clinics

## Operator Console (Dashboard)
Each deployment includes a password-gated web dashboard on `:3000` (accessible via Tailscale). It has four pages:

| Page | URL | Purpose |
|---|---|---|
| Logs | `/` | Live message log, system health panel, active sessions |
| Analytics | `/analytics` | ROI metrics, intent breakdown, daily volume, top contacts |
| Contacts | `/contacts` | Full CRM — add, edit, import, tag, pipeline funnel |
| Settings | `/settings` | Business basics, KB editor with industry templates, AI model, operations |

The console is read/config only — it never sends messages. All message sending stays in WhatsApp.

## Call to Action (Inbound)
- **Primary:** Reply DEMO — agent self-demos live on WhatsApp
- **Secondary:** Reply CALL — sends Calendly link for a consultation
- **Calendar:** https://calendly.com/gjamescollie/30min

## Business Hours vs Response Window
- **Hours (customer-facing):** Monday–Friday, 9am–5pm Bahamas time
- **Response window (AI context):** Monday–Friday, 8am–7pm Bahamas time
  - The AI uses `response_window` to set expectations — outside these hours it will not imply instant human availability
