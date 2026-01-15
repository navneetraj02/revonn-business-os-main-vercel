import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    action?: {
        type: string;
        data?: any;
    };
    type?: string;
    data?: any;
    relatedModule?: string;
    image?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    moduleId?: string; // If chat is started from a specific module
    userId?: string;
}

interface ChatState {
    sessions: ChatSession[];
    currentSessionId: string | null;
    addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
    createSession: (title?: string, moduleId?: string, userId?: string) => string;
    selectSession: (sessionId: string) => void;
    updateSessionTitle: (sessionId: string, title: string) => void;
    deleteSession: (sessionId: string) => void;
    getMessages: (sessionId: string) => Message[];
    clearSessions: () => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            sessions: [],
            currentSessionId: null,

            createSession: (title = 'New Conversation', moduleId, userId) => {
                const id = uuidv4();
                const newSession: ChatSession = {
                    id,
                    title,
                    messages: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    moduleId,
                    userId
                };
                set(state => ({
                    sessions: [newSession, ...state.sessions],
                    currentSessionId: id
                }));
                return id;
            },

            addMessage: (sessionId, message) => {
                set(state => {
                    const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
                    if (sessionIndex === -1) return state;

                    const updatedSessions = [...state.sessions];
                    const updatedSession = { ...updatedSessions[sessionIndex] };

                    updatedSession.messages = [
                        ...updatedSession.messages,
                        {
                            id: uuidv4(),
                            timestamp: Date.now(),
                            ...message
                        }
                    ];
                    updatedSession.updatedAt = Date.now();

                    updatedSessions[sessionIndex] = updatedSession;

                    // Move to top
                    updatedSessions.splice(sessionIndex, 1);
                    updatedSessions.unshift(updatedSession);

                    return { sessions: updatedSessions };
                });
            },

            selectSession: (sessionId) => {
                set({ currentSessionId: sessionId });
            },

            updateSessionTitle: (sessionId, title) => {
                set(state => ({
                    sessions: state.sessions.map(s =>
                        s.id === sessionId ? { ...s, title } : s
                    )
                }));
            },

            deleteSession: (sessionId) => {
                set(state => {
                    const newSessions = state.sessions.filter(s => s.id !== sessionId);
                    return {
                        sessions: newSessions,
                        currentSessionId: state.currentSessionId === sessionId
                            ? (newSessions.length > 0 ? newSessions[0].id : null)
                            : state.currentSessionId
                    };
                });
            },

            getMessages: (sessionId) => {
                const session = get().sessions.find(s => s.id === sessionId);
                return session?.messages || [];
            },

            clearSessions: () => {
                set({ sessions: [], currentSessionId: null });
            }
        }),
        {
            name: 'revonn-chat-storage',
            partialize: (state) => ({ sessions: state.sessions }),
            version: 1,
            migrate: (persistedState: any, version) => {
                if (version === 0) {
                    // Migration to version 1:
                    // 1. Ensure currentSessionId is null (fixes "stuck on previous chat" issue)
                    // 2. Ideally mark old sessions as unknown user or keep them valid for now
                    return {
                        ...persistedState,
                        currentSessionId: null,
                    };
                }
                return persistedState;
            },
        }
    )
);
