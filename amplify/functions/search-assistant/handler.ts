import { Handler } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

export const handler: Handler = async (event) => {
    const { prompt } = event.arguments;
    console.log("AI Search Assistant received:", prompt);

    try {
        const input = {
            modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 300,
                messages: [
                    {
                        role: "user",
                        content: `
You are a helpful Concierge for a Business Directory app.
Your job is to interpret the User's search query and extract structured filters to query the database.
You must return a STRICT JSON object only. No markdown. No conversational text outside the JSON.

Available Filters to Extract:
1. category: (String) - e.g., 'Plumber', 'Doctor', 'Restaurant', 'Gym', 'Spa', 'Shopping'. Map user intent to these standard categories.
2. city: (String) - Extract the city name if mentioned.
3. _searchInfo: (String) - If no category is clear, provide a keyword to search business names (e.g. 'Sushi' or 'Nike').

Output Schema:
{
  "filters": {
    "category": { "eq": "CategoryName" }, // Optional
    "city": { "eq": "CityName" },         // Optional
    "_searchInfo": "keyword"              // Optional fallback
  },
  "message": "A friendly short response to the user affirming what you are looking for."
}

User Query: "${prompt}"
JSON Response:
`
                    }
                ]
            }),
        };

        const command = new InvokeModelCommand(input);
        const response = await client.send(command);

        // Parse Bedrock Response
        const responseBody = new TextDecoder().decode(response.body);
        const result = JSON.parse(responseBody);
        const content = result.content[0].text;

        // Extract JSON from potential wrapper text
        // Sometimes LLMs wrap in backticks
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const finalJson = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (!finalJson) {
            throw new Error("Failed to parse AI response");
        }

        return finalJson;

    } catch (error) {
        console.error("Bedrock Error:", error);
        // Fallback if AI fails (or throttling)
        return {
            filters: { _searchInfo: prompt },
            message: "I'm having trouble connecting to my brain, so I'll just search for keywords."
        };
    }
};
