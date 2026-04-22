import LLMStream from "../components/LLMStream";

export const metadata = {
  title: "LLM Stream Demo",
  description: "Real-time token streaming from Groq via SSE",
};

export default function LLMStreamPage() {
  return <LLMStream />;
}
