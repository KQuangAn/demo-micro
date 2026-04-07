import { SystemMessage, tool } from 'langchain';
import { z } from 'zod';
import { ChatGroq } from "@langchain/groq"
import "dotenv/config";

const getWeather = tool((input) => `It's always sunny in ${input.city}!`, {
    name: 'get_weather',
    description: 'Get the weather for a given city',
    schema: z.object({
        city: z.string().describe('The city to get the weather for'),
    }),
});

const agent = new ChatGroq({
    model: 'llama-3.1-8b-instant',
    temperature: 0,
    apiKey: process.env.GROQ_API_KEY,
});

async function main() {
    const messages = [
        new SystemMessage("You are a helpful assistant.")
    ]
    // Run the agent
    const result = await agent.invoke(messages);
    console.log(result.content);
}

main().catch(console.error);