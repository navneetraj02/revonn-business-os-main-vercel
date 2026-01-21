
// TODO: Replace with your actual Gemini API Key
// You can get one from Google AI Studio: https://aistudio.google.com/
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCidVtC9PzjkGa5Ihh5OCHMPj3eMWWSJMw";
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper function to validate key
export const isAIConfigured = () => {
    return !!GEMINI_API_KEY && GEMINI_API_KEY.length > 0;
};

export const generateChatTitle = async (messages: { role: string; content: string }[]): Promise<string> => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Format history for the prompt
        const conversation = messages
            .slice(0, 3) // Analyze first few messages for the title
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');

        const prompt = `Analyze this short conversation and generate a concise, relevant topic title (2-5 words). 
        The title should reflect the user's intent or the main task being discussed.
        Do not use quotes.
        
        Conversation:
        ${conversation}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error generating title:", error);
        // Fallback: try to use the first user message if available
        const firstUserMsg = messages.find(m => m.role === 'user')?.content || "New Chat";
        return firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '');
    }
};
