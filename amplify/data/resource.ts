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
    // Single Table Design Keys
    pk: a.string().required(), // Hierarchy: COUNTRY#STATE#CITY#AREA
    sk: a.string().required(), // Identity: BIZ#slug or USER#id

    // Identity
    slug: a.string().required(),
    businessName: a.string().required(),
    tagline: a.string(),

    // Contact
    phone: a.string().required(),
    email: a.string(),
    website: a.string(),
    whatsapp: a.string(),

    // Location & SEO
    category: a.string().required(),
    address: a.string(),
    city: a.string(),
    location: a.customType({
      lat: a.float(),
      lng: a.float(),
    }),
    serviceAreaRadius: a.integer(),

    // Global Pricing Logic
    country: a.ref('CountryCode'),
    currency: a.ref('CurrencyCode'),
    tier: a.ref('SubscriptionTier'),

    // Media (S3 Keys)
    logoUrl: a.string(),
    coverPhotoUrl: a.string(),
    galleryUrls: a.string().array(),

    // Operational
    hours: a.json(),
    isVerified: a.boolean().default(false),

    // Metrics (Analytics)
    viewCount: a.integer().default(0),
    saveCount: a.integer().default(0),

    // Metadata (Flexible JSON/Dict for SEO & Hierarchy)
    desc: a.string(),

    // --- RELATIONS ---
    reviews: a.hasMany('Review', 'businessId'),
  })
    .identifier(['pk', 'sk'])
    .secondaryIndexes(index => [
      index('slug').queryField('getBusinessBySlug') // Fast lookup by slug for SEO pages
    ])
    .authorization(allow => [
      allow.publicApiKey(), // Anyone can read (SEO)
      allow.owner(),        // Owner can edit
    ]),

  // --- 2. SAVED CONTACT (User Retention) ---
  SavedContact: a.model({
    userId: a.string().required(), // Cognito Sub ID
    businessPk: a.string(),
    businessSk: a.string(),

    // Scanned Card Data (For cards NOT in directory)
    scannedData: a.json(),         // Stores: { name, phone, email, fullText, imageKey }

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
      index('userId').sortKeys(['businessSk']) // Fast lookup: "Get my contacts"
    ])
    .authorization(allow => [
      allow.owner(), // Only I can see my saved contacts
    ]),

  // --- 3. REVIEWS (Phase 0.5 Social Proof) ---
  Review: a.model({
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    business: a.belongsTo('BusinessCard', ['businessPk', 'businessSk']),
    userId: a.string().required(),
    rating: a.integer().required(), // 1-5
    comment: a.string(),
    photoUrl: a.string(), // Proof of work
    isVerified: a.boolean().default(false),
  })
    .secondaryIndexes(index => [
      index('businessSk').sortKeys(['rating']) // Query by BIZ#slug
    ])
    .authorization(allow => [
      allow.publicApiKey(), // Public can read
      allow.owner(),        // User can edit their review
    ]),
  // --- 4. SPACES (Curated Communities) ---
  Space: a.model({
    pk: a.string().required(), // Hierarchy: CAT#category#CITY#city
    sk: a.string().required(), // Identity: SPACE#name

    name: a.string().required(),
    description: a.string(),
    icon: a.string(),
    banner: a.string(),
    category: a.string(), // "Plumber"
    city: a.string(),     // "Bangalore"
    isPublic: a.boolean().default(true),

    // Relations
    businesses: a.hasMany('BusinessInSpace', 'spaceId'),
  })
    .identifier(['pk', 'sk'])
    .authorization(allow => [
      allow.publicApiKey(),
      allow.owner(),
    ]),

  // Join Model for Many-to-Many (Business <-> Space)
  BusinessInSpace: a.model({
    businessId: a.string().required(),
    spaceId: a.string().required(),

    business: a.belongsTo('BusinessCard', 'businessId'),
    space: a.belongsTo('Space', 'spaceId'),
  })
    .authorization(allow => [
      allow.publicApiKey(),
      allow.owner(),
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
