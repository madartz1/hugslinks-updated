# HUGS Cards app

The app is a separate public mobile web section at `/app/`. Its web app manifest and service worker are scoped to `/app/`; the service worker only caches the app shell, never accounts, payments, giveaway entries, or other website pages.

Available now: existing card discovery, category filtering, browser-local favorites, card-link sharing, English and Spanish, Home Screen installation, and navigation back to the existing site. Existing card product pages handle individual purchases. Favorites are not proof of purchase or membership entitlement.

Membership subscriptions remain closed. The giveaway is presented as end-of-month gifts and grand prize giveaways, with varying prize types. TVs and motorized or electric vehicles are possible prize categories, not secured or announced prizes. Each promotion must state its exact dates and confirmed prizes before opening. No subscription checkout, login, winner list, entry form, or data collection is simulated. The $7.99 benefits are proposed; premium animated purchases and custom services remain separate.

Before activating membership: confirm benefits and rights, subscription price and tax handling, secure account sign-in, server-verified membership entitlements, subscription checkout, signed webhooks, and a customer billing/cancellation portal. Protect member-only content on the server, not with browser storage.

Before opening the free giveaway: confirm legal sponsor and mailing address, reserve prizes, review and publish completed rules and privacy policy, finalize eligible geography and dates, and implement server-side entry validation and deduplication with durable records. All eligible entrants use the same public free form. Do not require membership or grant payment-based entry advantages.

Test Home Screen installation and sharing on actual iPhone Safari and Android Chrome before broad promotion. An app-scoped offline shell does not make linked product pages or card artwork available offline. The app is not an App Store or Google Play listing.
