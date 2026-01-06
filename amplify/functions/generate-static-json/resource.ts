import { defineFunction } from '@aws-amplify/backend';

export const generateStaticJson = defineFunction({
    name: 'generate-static-json',
    entry: './handler.ts',
    timeoutSeconds: 60, // Scans can take time
    memoryMB: 512,
});
