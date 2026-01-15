import { useRef, useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import { ChatInterface } from '@/components/ai/ChatInterface';
import { AppLayout } from '@/components/layout/AppLayout';

export default function Home() {
    const { currentSessionId } = useChatStore();

    return (
        <AppLayout hideNav title="Revonn AI">
            <ChatInterface />
        </AppLayout>
    );
}
