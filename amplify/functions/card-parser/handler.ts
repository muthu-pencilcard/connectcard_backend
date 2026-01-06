import { Handler } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler: Handler = async (event) => {
    console.log('Received Event:', JSON.stringify(event, null, 2));

    const { rawText } = event.arguments || event;

    if (!rawText) {
        return { error: 'No text provided for parsing.' };
    }

    const prompt = `
    You are an expert business card scanner. Extract the specific fields from the raw OCR text below.
    Return ONLY a valid JSON object with the following keys:
    - businessName (string)
    - name (string, the person's name if present)
    - phone (string, formatted consistently)
    - email (string)
    - website (string)
    - address (string)
    - tagline (string, a short catchy slogan if found)
    - category (string, a single word industry like 'Plumber', 'Doctor', 'Retail')

    If a field is not found, leave it as null.
    
    RAW OCR TEXT:
    ${rawText}
    `;

    try {
        const input = {
            modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            }),
        };

        const command = new InvokeModelCommand(input);
        const response = await bedrockClient.send(command);

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const resultString = responseBody.content[0].text;

        // Find JSON in the response (sometimes Claude adds markdown tags)
        const jsonMatch = resultString.match(/\{[\s\S]*\}/);
        const structuredData = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse AI output' };

        console.log('Structured Data:', structuredData);
        return structuredData;

    } catch (error: any) {
        console.error('Bedrock Error:', error);
        return {
            error: 'AI Parsing Failed',
            details: error.message
        };
    }
};
