import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Sparkles, Plus, Image as ImageIcon, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn, compressImage } from '@/lib/utils';
import { useChatStore } from '@/store/chat-store';
import { generateAIResponse, generateMultimodalResponse } from '@/lib/ai-assistant';
import { generateChatTitle } from '@/lib/ai';
import { useLanguage } from '@/contexts/LanguageContext';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export function ChatInterface() {
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAttachOptions, setShowAttachOptions] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const { currentSessionId, sessions, createSession, addMessage, updateSessionTitle } = useChatStore();
    const { language } = useLanguage();
    const { currentUser } = useAuth();

    // Get active session or create detailed one
    // Also ensure the session belongs to the current user (or no user for backward compatibility/guests)
    const activeSession = sessions.find(s => s.id === currentSessionId && (currentUser && s.userId === currentUser.uid));
    const messages = activeSession?.messages || [];

    useEffect(() => {
        // Auto-scroll to bottom
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isProcessing]);

    useEffect(() => {
        // Initialize session if none exists OR if current session doesn't match user
        // We check validActiveSession to see if we have a valid session for THIS user
        if (!currentUser) return; // Wait for auth

        const validActiveSession = sessions.find(s => s.id === currentSessionId && (s.userId === currentUser.uid));

        if (!validActiveSession) {
            // Start fresh if no valid session for this user
            createSession('New Conversation', undefined, currentUser.uid);
        }
    }, [currentSessionId, sessions, createSession, currentUser]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
                setShowAttachOptions(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    useEffect(() => {
        // Trigger initial greeting if new/empty session
        if (activeSession && activeSession.messages.length === 0 && !isProcessing) {
            setIsProcessing(true);
            // Simulate AI typing delay
            setTimeout(async () => {
                const greeting = await generateAIResponse(language === 'hi' ? "Namaste" : "Hello");
                addMessage(activeSession.id, {
                    role: 'assistant',
                    content: greeting.response,
                    action: greeting.action
                });
                setIsProcessing(false);
            }, 600);
        }
    }, [activeSession, language, addMessage, isProcessing]);

    const handleSendMessage = async () => {
        if (!input.trim() || isProcessing) return;

        const userMessage = input.trim();
        setInput('');
        setIsProcessing(true);

        // Ensure session exists and matches user
        let sessionId = currentSessionId;
        const validSession = sessions.find(s => s.id === sessionId && (currentUser && s.userId === currentUser.uid));

        if (!sessionId || !validSession) {
            sessionId = createSession('New Conversation', undefined, currentUser?.uid);
        }

        // Add user message
        addMessage(sessionId!, {
            role: 'user',
            content: userMessage,
            image: selectedImage || undefined
        });

        try {
            // Get recent history
            const allMessages = useChatStore.getState().getMessages(sessionId!);
            const history = allMessages
                .slice(0, -1)
                .slice(-10)
                .map(m => ({
                    role: m.role,
                    content: m.content
                }));

            // --- MULTIMODAL (IMAGE) LOGIC ---
            // --- MULTIMODAL (IMAGE) LOGIC ---
            if (selectedImage) {
                // Use shared Groq Vision Handler with Compression
                const compressedImage = await compressImage(selectedImage);
                const response = await generateMultimodalResponse(userMessage, compressedImage, history);

                setSelectedImage(null);

                addMessage(sessionId!, {
                    role: 'assistant',
                    content: response.response,
                    action: response.action
                });

            } else {
                // --- TEXT ONLY (ORIGINAL FLOW) ---
                const response = await generateAIResponse(userMessage, history);
                addMessage(sessionId!, {
                    role: 'assistant',
                    content: response.response,
                    action: response.action
                });
            }

            // Auto-title session if it's the first user message
            // Auto-title session if it's the first user message
            // Auto-title session based on early conversation (first 2 turns)
            const currentMessages = useChatStore.getState().getMessages(sessionId!);
            if (currentMessages.length <= 4) {
                // Generate title asynchronously to not block UI
                // We pass the history to get a better context-aware title
                const historyForTitle = currentMessages.map(m => ({ role: m.role, content: m.content }));
                generateChatTitle(historyForTitle).then(title => {
                    updateSessionTitle(sessionId!, title);
                });
            }

        } catch (error: any) {
            console.error("AI Error:", error);
            addMessage(sessionId!, {
                role: 'assistant',
                content: language === 'hi'
                    ? `Maaf kijiye, kuch samasya hai: ${error.message || error}`
                    : `I'm having trouble connecting. Error: ${error.message || "Unknown error"}. Please check your API key or internet connection.`,
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] md:h-screen bg-background">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                        <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center">
                            <Sparkles className="h-10 w-10 text-primary" />
                        </div>
                        <div className="max-w-md space-y-2">
                            <h2 className="text-2xl font-bold">Good Morning!</h2>
                            <p className="text-lg">I'm ready to help run your business.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm max-w-lg w-full">
                            <Button variant="outline" className="h-auto py-3 text-left justify-start" onClick={() => { setInput("Aaj ki sales dikhao"); }}>
                                "Aaj ki sales dikhao"
                            </Button>
                            <Button variant="outline" className="h-auto py-3 text-left justify-start" onClick={() => { setInput("Check stock for blue kurti"); }}>
                                "Check stock for blue kurti"
                            </Button>
                            <Button variant="outline" className="h-auto py-3 text-left justify-start" onClick={() => { setInput("Ramesh ka bill banao"); }}>
                                "Ramesh ka bill banao"
                            </Button>
                            <Button variant="outline" className="h-auto py-3 text-left justify-start" onClick={() => { setInput("Show low stock items"); }}>
                                "Show low stock items"
                            </Button>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full max-w-3xl mx-auto gap-4 animate-slide-up",
                                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                            <Avatar className={cn(
                                "h-8 w-8 mt-1",
                                msg.role === 'assistant' ? "bg-primary/10" : "bg-muted"
                            )}>
                                <AvatarFallback className={cn(
                                    msg.role === 'assistant' ? "text-primary" : ""
                                )}>
                                    {msg.role === 'assistant' ? 'AI' : 'U'}
                                </AvatarFallback>
                            </Avatar>

                            <div
                                className={cn(
                                    "flex flex-col gap-2 rounded-2xl px-4 py-3 max-w-[85%] text-sm md:text-base shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-card border border-border/50"
                                )}
                            >
                                <div className="whitespace-pre-wrap leading-relaxed">
                                    {msg.image && (
                                        <img src={msg.image} alt="Uploaded" className="mb-2 rounded-lg max-h-60 object-cover border border-white/20" />
                                    )}
                                    {msg.content}
                                </div>

                                {/* Render Actions (if any) */}
                                {msg.action && msg.role === 'assistant' && (
                                    <div className="mt-2 pt-2 border-t border-border/10">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="w-full"
                                            onClick={() => {
                                                if (msg.action?.type === 'create_invoice') navigate('/billing');
                                                if (msg.action?.type === 'add_stock') navigate('/inventory');
                                                if (msg.action?.type === 'add_customer') navigate('/customers');
                                                if (msg.action?.type === 'show_report') navigate('/reports');
                                            }}
                                        >
                                            {msg.action.type === 'create_invoice' ? 'View Billings' :
                                                msg.action.type === 'add_stock' ? 'View Inventory' :
                                                    msg.action.type === 'add_customer' ? 'View Customers' :
                                                        'open ' + msg.action.type.replace('_', ' ')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {isProcessing && (
                    <div className="flex w-full max-w-3xl mx-auto gap-4">
                        <Avatar className="h-8 w-8 mt-1 bg-primary/10">
                            <AvatarFallback className="text-primary">AI</AvatarFallback>
                        </Avatar>
                        <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                            <div className="flex gap-1.5 items-center h-6">
                                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/40">
                {/* Image Preview */}
                {selectedImage && (
                    <div className="mx-4 mb-2 relative inline-block">
                        <img src={selectedImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-border" />
                        <button
                            onClick={clearImage}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-muted/50 rounded-xl p-2 border border-border/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">

                    {/* Plus / Attach Button via toggle */}
                    <div className="relative">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-muted-foreground hover:text-primary mb-1"
                            onClick={() => setShowAttachOptions(!showAttachOptions)}
                        >
                            <Plus className={cn("h-5 w-5 transition-transform", showAttachOptions ? "rotate-45" : "")} />
                        </Button>

                        {/* Attach Popup */}
                        {showAttachOptions && (
                            <div className="absolute bottom-12 left-0 p-2 bg-popover border border-border rounded-xl shadow-xl flex flex-col gap-1 min-w-[150px] animate-in fade-in zoom-in-95 duration-200 z-50">
                                <button className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg text-left" onClick={() => cameraInputRef.current?.click()}>
                                    <Camera className="w-4 h-4 text-blue-500" />
                                    <span>Camera</span>
                                </button>
                                <button className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg text-left" onClick={() => fileInputRef.current?.click()}>
                                    <ImageIcon className="w-4 h-4 text-green-500" />
                                    <span>Upload Image</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
                    <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything..."
                        className="min-h-[50px] max-h-[150px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 px-1 py-3"
                        autoFocus
                    />
                    <div className="flex pb-1 gap-1">
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-primary">
                            <Mic className="h-5 w-5" />
                        </Button>
                        <Button
                            size="icon"
                            className={cn("h-9 w-9 transition-all", input.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isProcessing}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
