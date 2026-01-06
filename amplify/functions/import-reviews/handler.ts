import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

interface ImportReviewsEvent {
    businessPk: string;
    businessSk: string;
    googlePlaceId?: string;
    yelpBusinessId?: string;
}

interface GoogleReview {
    author_name: string;
    author_url?: string;
    profile_photo_url?: string;
    rating: number;
    text: string;
    time: number; // Unix timestamp
    relative_time_description?: string;
}

interface YelpReview {
    id: string;
    rating: number;
    text: string;
    time_created: string; // ISO 8601
    url: string;
    user: {
        name: string;
        image_url?: string;
        profile_url?: string;
    };
}

export const handler: Handler = async (event: ImportReviewsEvent) => {
    console.log('Import Reviews Event:', JSON.stringify(event));

    const { businessPk, businessSk, googlePlaceId, yelpBusinessId } = event;
    const results = {
        googleReviews: 0,
        yelpReviews: 0,
        errors: [] as string[],
    };

    try {
        // Import Google Reviews
        if (googlePlaceId) {
            try {
                const googleReviews = await fetchGoogleReviews(googlePlaceId);
                for (const review of googleReviews) {
                    await saveReview(businessPk, businessSk, review, 'GOOGLE');
                    results.googleReviews++;
                }
            } catch (error) {
                const errorMsg = `Google import failed: ${error}`;
                console.error(errorMsg);
                results.errors.push(errorMsg);
            }
        }

        // Import Yelp Reviews
        if (yelpBusinessId) {
            try {
                const yelpReviews = await fetchYelpReviews(yelpBusinessId);
                for (const review of yelpReviews) {
                    await saveReview(businessPk, businessSk, review, 'YELP');
                    results.yelpReviews++;
                }
            } catch (error) {
                const errorMsg = `Yelp import failed: ${error}`;
                console.error(errorMsg);
                results.errors.push(errorMsg);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify(results),
        };
    } catch (error) {
        console.error('Import Reviews Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to import reviews', details: error }),
        };
    }
};

async function fetchGoogleReviews(placeId: string): Promise<any[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_PLACES_API_KEY not configured');
    }

    // Google Places API - Place Details endpoint
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
        throw new Error(`Google API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    return data.result?.reviews || [];
}

async function fetchYelpReviews(businessId: string): Promise<any[]> {
    const apiKey = process.env.YELP_API_KEY;
    if (!apiKey) {
        throw new Error('YELP_API_KEY not configured');
    }

    // Yelp Fusion API - Reviews endpoint
    const url = `https://api.yelp.com/v3/businesses/${businessId}/reviews`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    const data = await response.json();

    if (response.status !== 200) {
        throw new Error(`Yelp API error: ${data.error?.description || 'Unknown error'}`);
    }

    return data.reviews || [];
}

async function saveReview(
    businessPk: string,
    businessSk: string,
    review: GoogleReview | YelpReview,
    source: 'GOOGLE' | 'YELP'
): Promise<void> {
    const tableName = process.env.REVIEW_TABLE_NAME;
    if (!tableName) {
        throw new Error('REVIEW_TABLE_NAME not configured');
    }

    let reviewData: any;

    if (source === 'GOOGLE') {
        const googleReview = review as GoogleReview;
        reviewData = {
            businessPk,
            businessSk,
            userId: 'SYSTEM', // External reviews don't have ConnectCard user IDs
            rating: googleReview.rating,
            comment: googleReview.text,
            source: 'GOOGLE',
            externalId: `google_${businessPk}_${googleReview.time}`, // Unique ID
            externalUrl: googleReview.author_url || '',
            authorName: googleReview.author_name,
            authorPhotoUrl: googleReview.profile_photo_url || '',
            reviewDate: new Date(googleReview.time * 1000).toISOString(),
            lastSyncedAt: new Date().toISOString(),
            isVerified: false,
        };
    } else {
        const yelpReview = review as YelpReview;
        reviewData = {
            businessPk,
            businessSk,
            userId: 'SYSTEM',
            rating: yelpReview.rating,
            comment: yelpReview.text,
            source: 'YELP',
            externalId: yelpReview.id,
            externalUrl: yelpReview.url,
            authorName: yelpReview.user.name,
            authorPhotoUrl: yelpReview.user.image_url || '',
            reviewDate: yelpReview.time_created,
            lastSyncedAt: new Date().toISOString(),
            isVerified: false,
        };
    }

    // Check if review already exists (prevent duplicates)
    const existingReview = await checkExistingReview(reviewData.externalId);
    if (existingReview) {
        console.log(`Review already exists: ${reviewData.externalId}`);
        return;
    }

    // Save to DynamoDB
    const command = new PutCommand({
        TableName: tableName,
        Item: {
            ...reviewData,
            id: reviewData.externalId, // Use external ID as primary key
            createdAt: reviewData.reviewDate,
            updatedAt: new Date().toISOString(),
        },
    });

    await docClient.send(command);
    console.log(`Saved ${source} review: ${reviewData.externalId}`);
}

async function checkExistingReview(externalId: string): Promise<boolean> {
    const tableName = process.env.REVIEW_TABLE_NAME;
    if (!tableName) return false;

    try {
        const command = new QueryCommand({
            TableName: tableName,
            IndexName: 'externalId', // Using the secondary index we created
            KeyConditionExpression: 'externalId = :externalId',
            ExpressionAttributeValues: {
                ':externalId': externalId,
            },
            Limit: 1,
        });

        const result = await docClient.send(command);
        return (result.Items?.length || 0) > 0;
    } catch (error) {
        console.error('Error checking existing review:', error);
        return false;
    }
}
