import { defineFunction } from '@aws-amplify/backend';

export const searchAssistant = defineFunction({
    name: 'search-assistant',
    entry: './handler.ts',
    timeoutSeconds: 30, // plenty for simple parsing
});
