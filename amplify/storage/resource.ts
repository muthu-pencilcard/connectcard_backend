import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'connectCardStorage',
    access: (allow) => ({
        'public/*': [
            allow.guest.to(['read']), // Public Profiles & JSON Dump
            allow.authenticated.to(['read', 'write', 'delete']), // Business Owners uploading Loges
        ],
    })
});
