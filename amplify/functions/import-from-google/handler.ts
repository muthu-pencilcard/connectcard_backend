import type { Handler } from 'aws-lambda';

interface ImportEvent {
    placeId: string;
}

interface ExternalBusinessData {
    businessName: string;
    phone: string;
    website: string;
    address: string;
    city: string;
    location: {
        lat: number;
        lng: number;
    };
    rating: number; // For initial reviews import later
    user_ratings_total: number;
    photos: string[]; // URLs or references
    googlePlaceId: string;
    googleMapsUrl: string;
    hours: any; // Google format
    category: string; // Mapped from Google types
}

export const handler: Handler = async (event: ImportEvent) => {
    console.log('Import Google Event:', JSON.stringify(event));
    const { placeId } = event;

    if (!placeId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing placeId' }),
        };
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server misconfiguration: Missing Google API Key' }),
        };
    }

    try {
        // Fetch Place Details
        const fields = 'name,formatted_address,international_phone_number,website,geometry,photos,rating,user_ratings_total,url,opening_hours,types,address_components';
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `Google API Error: ${data.status} - ${data.error_message}` }),
            };
        }

        const m = data.result;

        // Helper to find city
        const findComponent = (type: string) =>
            m.address_components?.find((c: any) => c.types.includes(type))?.long_name || '';

        const city = findComponent('locality') || findComponent('administrative_area_level_2') || findComponent('administrative_area_level_1');
        const country = findComponent('country'); // e.g., India

        // Map Category (Simple mapping for now)
        const type = m.types?.[0] || 'Business';
        const category = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');

        const businessData: ExternalBusinessData = {
            businessName: m.name,
            phone: m.international_phone_number || '',
            website: m.website || '',
            address: m.formatted_address,
            city: city || '',
            location: {
                lat: m.geometry?.location?.lat || 0,
                lng: m.geometry?.location?.lng || 0,
            },
            rating: m.rating,
            user_ratings_total: m.user_ratings_total,
            photos: (m.photos || []).slice(0, 5).map((p: any) =>
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${apiKey}` // Note: Client should proxy or download these, hotlinking might be restricted or expire
            ),
            googlePlaceId: placeId,
            googleMapsUrl: m.url,
            hours: m.opening_hours ? m.opening_hours.weekday_text : [],
            category: category,
        };

        return {
            statusCode: 200,
            body: JSON.stringify(businessData),
        };

    } catch (error) {
        console.error('Import Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch from Google' }),
        };
    }
};
