
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
