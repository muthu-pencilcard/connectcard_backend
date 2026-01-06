import { defineFunction } from '@aws-amplify/backend';

export const importFromGoogle = defineFunction({
    name: 'import-from-google',
    entry: './handler.ts',
    timeoutSeconds: 60,
    environment: {
        GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',
    },
});
