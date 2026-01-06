import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*
 * ConnectCard Data Schema
 * 
 * CORE MODELS:
 * 1. BusinessCard: The public profile (Directory Entry).
 * 2. SavedContact: The user's personal address book entry (Retention).
 * 
 * PRICING STRATEGY:
 * - Includes 'country' and 'currency' to support Global Pricing (IN, US, UK, AE).
 */

const schema = a.schema({
  // --- ENUMS ---
  CountryCode: a.enum(['IN', 'US', 'UK', 'AE']),
  CurrencyCode: a.enum(['INR', 'USD', 'GBP', 'AED']),
  SubscriptionTier: a.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),

  // --- 1. BUSINESS CARD (Public Directory) ---
  BusinessCard: a.model({
    // Identity
    slug: a.string().required(), // URL-friendly ID e.g. "rk-plumbing"
    businessName: a.string().required(),
    tagline: a.string(),

    // Contact
    phone: a.string().required(),
    email: a.string(),
    website: a.string(),
    whatsapp: a.string(),

    // Location & SEO
    category: a.string().required(), // "Plumber"
    address: a.string(),
    city: a.string(),
    location: a.customType({
      lat: a.float(),
      lng: a.float(),
    }),
    serviceAreaRadius: a.integer(), // km

    // Global Pricing Logic
    country: a.ref('CountryCode'),
    currency: a.ref('CurrencyCode'),
    tier: a.ref('SubscriptionTier'),

    // Media (S3 Keys)
    logoUrl: a.string(),
    coverPhotoUrl: a.string(),
    galleryUrls: a.string().array(), // Max 5 (Starter) -> Unlimited (Ent)

    // Operational
    hours: a.json(), // Structured JSON: { "mon": "9-5", "tue": "9-5" ... }
    isVerified: a.boolean().default(false),

    // Metrics (Analytics)
    viewCount: a.integer().default(0),
    saveCount: a.integer().default(0),

    // --- RELATIONS ---
    // A Business can have many Reviews (Phase 0.5)
    reviews: a.hasMany('Review', 'businessId'),
  })
    .authorization(allow => [
      allow.publicApiKey(), // Anyone can read (SEO)
      allow.owner(),        // Owner can edit
    ]),

  // --- 2. SAVED CONTACT (User Retention) ---
  SavedContact: a.model({
    userId: a.string().required(), // Cognitive Sub ID
    businessId: a.string().required(), // Reference to BusinessCard.id

    // Personalization
    customName: a.string(), // "My Plumber"
    tags: a.string().array(), // ["Emergency", "Home"]
    personalNotes: a.string(),

    // Smart Reminders
    reminderDate: a.datetime(), // Next Due Date
    reminderLabel: a.string(), // "AC Service"

    // Offline Sync Metadata
    lastSyncedAt: a.datetime(),
  })
    .secondaryIndexes(index => [
      index('userId').sortKeys(['businessId']) // Fast lookup: "Get my contacts"
    ])
    .authorization(allow => [
      allow.owner(), // Only I can see my saved contacts
    ]),

  // --- 3. REVIEWS (Phase 0.5 Social Proof) ---
  Review: a.model({
    businessId: a.string().required(),
    userId: a.string().required(),
    rating: a.integer().required(), // 1-5
    comment: a.string(),
    photoUrl: a.string(), // Proof of work
    isVerified: a.boolean().default(false),
  })
    .secondaryIndexes(index => [
      index('businessId').sortKeys(['rating']) // "Get reviews for this business"
    ])
    .authorization(allow => [
      allow.publicApiKey(), // Public can read
      allow.owner(),        // User can edit their review
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30, // Long-lived for public access
    },
  },
});
