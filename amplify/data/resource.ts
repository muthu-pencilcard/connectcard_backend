import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { searchAssistant } from '../functions/search-assistant/resource';

/*
 * ConnectCard Data Schema
 */

const schema = a.schema({
  // AI Concierge Query
  askAI: a.query()
    .arguments({ prompt: a.string().required() })
    .returns(a.json())
    .handler(a.handler.function(searchAssistant))
    .authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

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
    catalogueViewCount: a.integer().default(0),

    // Metadata
    desc: a.string(),

    // External Platform Integration
    googlePlaceId: a.string(), // Google Maps Place ID
    googleMapsUrl: a.string(), // Direct link to Google Maps
    yelpBusinessId: a.string(), // Yelp Business ID
    yelpUrl: a.string(), // Direct link to Yelp page

    // --- RELATIONS ---
    reviews: a.hasMany('Review', 'businessId'),
    followers: a.hasMany('Follower', 'businessPk'), // Optional mapping
  })
    .identifier(['pk', 'sk'])
    .secondaryIndexes(index => [
      index('slug').queryField('getBusinessBySlug')
    ])
    .authorization(allow => [
      allow.publicApiKey(),
      allow.owner(),
    ]),

  // --- 2. SAVED CONTACT (User Retention) ---
  SavedContact: a.model({
    userId: a.string().required(),
    businessPk: a.string(),
    businessSk: a.string(),
    scannedData: a.json(),
    customName: a.string(),
    tags: a.string().array(),
    personalNotes: a.string(),
    reminderDate: a.datetime(),
    reminderLabel: a.string(),
    lastSyncedAt: a.datetime(),
  })
    .secondaryIndexes(index => [
      index('userId').sortKeys(['businessSk'])
    ])
    .authorization(allow => [
      allow.owner(),
    ]),

  // --- 3. REVIEWS ---
  ReviewSource: a.enum(['CONNECTCARD', 'GOOGLE', 'YELP']),

  Review: a.model({
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    business: a.belongsTo('BusinessCard', ['businessPk', 'businessSk']),
    userId: a.string().required(),
    rating: a.integer().required(),
    comment: a.string(),
    photoUrl: a.string(),
    isVerified: a.boolean().default(false),

    // External Review Integration
    source: a.ref('ReviewSource').default('CONNECTCARD'),
    externalId: a.string(), // Original review ID from Google/Yelp
    externalUrl: a.string(), // Link to original review
    authorName: a.string(), // Reviewer name from external source
    authorPhotoUrl: a.string(), // Reviewer photo from external source
    reviewDate: a.datetime(), // Original review date
    lastSyncedAt: a.datetime(), // When we last fetched this review
  })
    .secondaryIndexes(index => [
      index('businessSk').sortKeys(['rating']),
      index('businessSk').sortKeys(['reviewDate']), // Sort by date
      index('externalId'), // Prevent duplicate imports
    ])
    .authorization(allow => [
      allow.publicApiKey(),
      allow.owner(),
    ]),

  // --- 4. SPACES ---
  Space: a.model({
    pk: a.string().required(),
    sk: a.string().required(),
    name: a.string().required(),
    description: a.string(),
    icon: a.string(),
    banner: a.string(),
    category: a.string(),
    city: a.string(),
    isPublic: a.boolean().default(true),
    businesses: a.hasMany('BusinessInSpace', 'spaceId'),
  })
    .identifier(['pk', 'sk'])
    .authorization(allow => [
      allow.publicApiKey(),
      allow.owner(),
    ]),

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

  // --- 5. PRIVATE MESSAGING ---
  ChatRoom: a.model({
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    business: a.belongsTo('BusinessCard', ['businessPk', 'businessSk']),
    userSub: a.string().required(),
    lastMessage: a.string(),
    lastMessageAt: a.datetime(),
    messages: a.hasMany('ChatMessage', 'chatRoomId'),
  })
    .secondaryIndexes(index => [
      index('userSub').sortKeys(['lastMessageAt']),
      index('businessSk').sortKeys(['lastMessageAt']),
    ])
    .authorization(allow => [
      allow.authenticated(),
      allow.owner(),
    ]),

  ChatMessage: a.model({
    chatRoomId: a.string().required(),
    chatRoom: a.belongsTo('ChatRoom', 'chatRoomId'),
    senderSub: a.string().required(),
    content: a.string().required(),
    type: a.string().default('TEXT'),
  })
    .authorization(allow => [
      allow.authenticated(),
      allow.owner(),
    ]),

  // --- 6. FOLLOWER ---
  Follower: a.model({
    userId: a.string().required(),
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    business: a.belongsTo('BusinessCard', ['businessPk', 'businessSk']),
    deviceToken: a.string(),
    platform: a.string(),
    notificationsEnabled: a.boolean().default(true),
    followedAt: a.datetime(),
  })
    .secondaryIndexes(index => [
      index('userId').sortKeys(['businessSk']),
      index('businessSk').sortKeys(['userId']),
    ])
    .authorization(allow => [
      allow.owner(),
      allow.authenticated(),
    ]),

  // --- 7. BROADCAST MESSAGE ---
  BroadcastMessage: a.model({
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    business: a.belongsTo('BusinessCard', ['businessPk', 'businessSk']),
    title: a.string().required(),
    message: a.string().required(),
    imageUrl: a.string(),
    actionUrl: a.string(),
    postedAt: a.datetime(),
    expiresAt: a.datetime(),
  })
    .secondaryIndexes(index => [
      index('businessSk').sortKeys(['postedAt']),
    ])
    .authorization(allow => [
      allow.publicApiKey(),
      allow.owner(),
    ]),

  // --- 8. CATALOGUE EVENT (Monetization Audit Trail) ---
  CatalogueEvent: a.model({
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    userId: a.string().required(),
    timestamp: a.datetime().required(),
    itemType: a.string(),
    itemId: a.string(),
  })
    .secondaryIndexes(index => [
      index('businessSk').sortKeys(['timestamp']),
    ])
    .authorization(allow => [
      allow.owner(),
      allow.authenticated(),
    ]),

  // --- 9. BOOKING (Appointment System) ---
  Booking: a.model({
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    business: a.belongsTo('BusinessCard', ['businessPk', 'businessSk']),

    userId: a.string().required(), // Customer
    customerName: a.string().required(),
    customerPhone: a.string().required(),
    customerEmail: a.string(),

    // Appointment Details
    serviceType: a.string(), // "Haircut", "Plumbing", etc.
    appointmentDate: a.datetime().required(),
    duration: a.integer(), // Minutes
    notes: a.string(),

    // Status
    status: a.string().default('PENDING'), // PENDING, CONFIRMED, CANCELLED, COMPLETED
    confirmedAt: a.datetime(),
    cancelledAt: a.datetime(),
    cancellationReason: a.string(),
  })
    .secondaryIndexes(index => [
      index('businessSk').sortKeys(['appointmentDate']), // Business's calendar
      index('userId').sortKeys(['appointmentDate']), // Customer's bookings
    ])
    .authorization(allow => [
      allow.owner(),
      allow.authenticated(),
    ]),

  // --- 10. OFFERS & DEALS (Promotions) ---
  Offer: a.model({
    businessPk: a.string().required(),
    businessSk: a.string().required(),
    business: a.belongsTo('BusinessCard', ['businessPk', 'businessSk']),

    title: a.string().required(), // "20% Off Haircut"
    description: a.string(),
    promoCode: a.string(), // "WELCOME20"
    discountType: a.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BOGO']),
    discountValue: a.float(),

    startDate: a.datetime(),
    endDate: a.datetime(),
    isActive: a.boolean().default(true),

    usageLimit: a.integer(), // Max redemptions total
    usageCount: a.integer().default(0),
  })
    .secondaryIndexes(index => [
      index('businessSk').sortKeys(['endDate']), // Active offers for a biz
    ])
    .authorization(allow => [
      allow.publicApiKey(), // Everyone sees offers
      allow.owner(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
