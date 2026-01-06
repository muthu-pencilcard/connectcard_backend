import { defineFunction } from '@aws-amplify/backend';

export const cardParser = defineFunction({
    name: 'card-parser',
    entry: './handler.ts',
    timeoutSeconds: 30,
    memoryMB: 512,
});
