import { defineFunction } from '@aws-amplify/backend';

export const importReviews = defineFunction({
    name: 'import-reviews',
    entry: './handler.ts',
    timeoutSeconds: 60,
    environment: {
        // API keys will be added via AWS Secrets Manager or environment variables
        GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',
        YELP_API_KEY: process.env.YELP_API_KEY || '',
    },
});
