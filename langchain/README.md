This is a [Next.js](https://nextjs.org) project with LangChain integration for chatting with Google Gemini using Google Generative AI API.

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory and add your API keys:

```env
GOOGLE_API_KEY=your_google_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
```

- Get your Google API key from [Google AI Studio](https://aistudio.google.com/app/apikey) or [Google Cloud Console](https://console.cloud.google.com/)
- Get your Pinecone API key from [Pinecone Console](https://app.pinecone.io/)

### 3. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the chat interface.

## Features

- **LangChain Agent**: Uses LangChain's `createAgent` with Google Gemini 1.5 Pro model
- **Chat UI**: Beautiful, responsive chat interface with message history
- **Tool Integration**: Includes a weather tool example that demonstrates agent capabilities
- **Real-time Chat**: Send messages and receive responses from the LangChain agent

## Usage

1. Type a message in the input field at the bottom
2. Press Enter or click "Send" to send your message
3. The agent will process your message and respond
4. Try asking: "What's the weather in Tokyo?" to see the tool in action

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
