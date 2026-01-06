import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'connectCardStorage',
    access: (allow) => ({
        'public/*': [
            allow.guest.to(['read', 'write']), // Anyone can read profiles and upload logos for now
            allow.authenticated.to(['read', 'write', 'delete']),
        ],
    })
});
