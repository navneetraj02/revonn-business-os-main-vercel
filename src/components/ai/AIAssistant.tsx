
import { useState, useRef, useEffect } from 'react';
import { X, Send, Mic, MicOff, Sparkles, Loader2, Maximize2, Minimize2, Plus, Image as ImageIcon, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/app-store';
import { useVoiceRecognition, speakText } from '@/hooks/useVoiceRecognition';
import { auth } from '@/lib/firebase';
import type { AIMessage } from '@/types';
import { cn, compressImage } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { generateAIResponse, getShopContext, generateMultimodalResponse, SimpleMessage } from '@/lib/ai-assistant';
import { aiActions, aiTools } from '@/lib/ai-actions';


export function AIAssistant() {
  const navigate = useNavigate();
  const { isAIOpen, setIsAIOpen } = useAppStore();
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: isHindi
        ? "नमस्ते! मैं रेवॉन AI हूं, आपका बिज़नेस असिस्टेंट। 👋\n\nमैं आपकी मदद कर सकता हूं:\n\n• स्टॉक जोड़ना (\"50 keyboards जोड़ो\")\n• बिल बनाना (\"रमेश के लिए 2 कुर्ती का बिल बनाओ\")\n• बिक्री रिपोर्ट (\"आज/7 दिन/30 दिन की बिक्री\")\n• ग्राहक जानकारी\n• मार्केटिंग टिप्स\n• GST सहायता\n\nबोलिए या टाइप कीजिए!"
        : "Hi! I'm Revonn AI, your business assistant. 👋\n\nI can help you with:\n\n• Adding stock (\"Add 50 keyboards\")\n• Creating bills (\"Create bill for Ramesh 2 kurti\")\n• Sales reports (\"Today/7 days/30 days sales\")\n• Customer information\n• Marketing tips\n• GST assistance\n\nSpeak or type!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAttachOptions, setShowAttachOptions] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported, transcript, toggleListening, stopListening } = useVoiceRecognition({
    lang: isHindi ? 'hi-IN' : 'en-IN',
    onResult: (result) => {
      if (result.isFinal) {
        setInput(result.transcript);
        stopListening();
        setTimeout(() => handleSend(result.transcript), 500);
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isAIOpen) inputRef.current?.focus();
  }, [isAIOpen]);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  const detectLanguage = (text: string): 'hindi' | 'english' => {
    const hindiPattern = /[\u0900-\u097F]|kya|hai|kaise|kitna|kitni|mera|aaj|kal|hoon|karo|batao|dikhao|banao|bech|sale|bikri/i;
    return hindiPattern.test(text) ? 'hindi' : 'english';
  };

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



  const handleSend = async (textToSend?: string) => {
    const messageText = textToSend || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // 1. Try Local Business Logic First (ONLY if no image)
      // This checks for intents like "Stock check", "Sales report", "Create bill", etc.
      // passing the message to the intent detector in ai-assistant.ts

      let localResult = { intent: 'unknown', response: '' };
      if (!selectedImage) {
        localResult = await generateAIResponse(messageText);
      }

      // If we found a specific business intent (not 'unknown' and not just a generic 'greeting' that we want LLM to handle better),
      // use the local response which has real DB data.
      if (!selectedImage && localResult.intent !== 'unknown' && localResult.intent !== 'greeting') {
        const assistantMessage: AIMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: localResult.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);

        const lang = detectLanguage(messageText);
        speakText(localResult.response.replace(/[*#\[\]{}]/g, '').slice(0, 500), lang === 'hindi' ? 'hi-IN' : 'en-IN');

        setIsLoading(false);
        return;
      }

      // 2. Fetch Live Context
      const shopContext = await getShopContext();

      // 3. Fallback to Groq Vision/Llama 3 with Tools & Context
      let responseText = "";
      const chatHistory = messages.filter(m => m.id !== '1').map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })) as SimpleMessage[];

      if (selectedImage) {
        // Handle Multimodal Request via Groq Vision
        const compressedImage = await compressImage(selectedImage);
        const visionResponse = await generateMultimodalResponse(messageText, compressedImage, chatHistory);
        responseText = visionResponse.response;

        // Actions are already executed inside generateMultimodalResponse
        if (visionResponse.action && visionResponse.action.type !== 'none') {
          window.dispatchEvent(new CustomEvent('revonn-data-update'));
        }

        setSelectedImage(null);

      } else {
        // --- TEXT ONLY FLOW ---
        // Use generateAIResponse which uses Groq Llama 3 from lib/ai-assistant.ts
        const aiRes = await generateAIResponse(messageText, chatHistory);
        responseText = aiRes.response;
        // Actions handled inside generateAIResponse too.
        if (aiRes.action && aiRes.action.type !== 'none') {
          window.dispatchEvent(new CustomEvent('revonn-data-update'));
        }
      }

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      const lang = detectLanguage(messageText);
      speakText(responseText.replace(/[*#\[\]{}]/g, '').slice(0, 500), lang === 'hindi' ? 'hi-IN' : 'en-IN');

    } catch (error) {
      console.error('AI error:', error);
      const lang = detectLanguage(messageText);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: lang === 'hindi'
          ? "माफ कीजिए, अभी कुछ समस्या है। कृपया थोड़ी देर बाद प्रयास करें।"
          : "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = isHindi ? [
    { label: 'आज की बिक्री?', icon: '📊' },
    { label: '7 दिन की बिक्री', icon: '📈' },
    { label: '30 दिन की बिक्री', icon: '📉' },
    { label: 'कम स्टॉक', icon: '📦' },
    { label: 'बिल बनाओ', icon: '🧾' },
    { label: 'टॉप सेलिंग', icon: '🔥' },
    { label: 'कुल ग्राहक', icon: '👥' },
    { label: 'मार्केटिंग टिप', icon: '💡' }
  ] : [
    { label: "Today's sales?", icon: '📊' },
    { label: '7 day sales', icon: '📈' },
    { label: '30 day sales', icon: '📉' },
    { label: 'Low stock', icon: '📦' },
    { label: 'Create bill', icon: '🧾' },
    { label: 'Top selling', icon: '🔥' },
    { label: 'Total customers', icon: '👥' },
    { label: 'Marketing tip', icon: '💡' }
  ];

  if (!isAIOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md animate-fade-in">
      <div className={cn(
        "fixed bg-card shadow-2xl border border-border flex flex-col transition-all duration-300",
        isFullScreen
          ? "inset-0 rounded-none"
          : "inset-x-0 bottom-0 h-[90vh] rounded-t-3xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">Revonn AI</h2>
              <p className="text-xs text-muted-foreground">
                {isListening
                  ? (isHindi ? '🎤 सुन रहा हूं...' : '🎤 Listening...')
                  : (isHindi ? 'आवाज़ + टेक्स्ट • हिंदी/English' : 'Voice + Text • Hindi/English')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 rounded-xl hover:bg-secondary transition-colors"
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsAIOpen(false)}
              className="p-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                message.role === 'user' ? 'user-bubble' : 'ai-bubble',
                'animate-scale-in max-w-[85%] shadow-md flex flex-col'
              )}>
                {message.image && (
                  <img src={message.image} alt="Uploaded" className="mb-2 rounded-lg max-h-60 object-cover border border-white/20" />
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="ai-bubble flex items-center gap-2 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {isHindi ? 'सोच रहा हूं...' : 'Thinking...'}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide border-t border-border/50">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => { setInput(action.label); inputRef.current?.focus(); }}
              className="px-4 py-2 text-xs font-medium rounded-full bg-secondary text-secondary-foreground whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card/50">
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

          {isListening && (
            <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/30 text-center animate-pulse">
              <p className="text-sm text-primary font-medium flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary animate-ping" />
                {isHindi ? 'सुन रहा हूं... अभी बोलें' : 'Listening... Speak now'}
              </p>
              {transcript && <p className="text-xs text-muted-foreground mt-1">{transcript}</p>}
            </div>
          )}
          <div className="flex items-center gap-3 relative">

            {/* Plus / Attach Button */}
            <div className="relative">
              <button
                onClick={() => setShowAttachOptions(!showAttachOptions)}
                className="p-3.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-all shadow-md"
              >
                <Plus className={cn("w-5 h-5 transition-transform", showAttachOptions ? "rotate-45" : "")} />
              </button>

              {/* Attach Options Popup */}
              {showAttachOptions && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-popover border border-border rounded-xl shadow-xl flex flex-col gap-1 min-w-[150px] animate-in fade-in zoom-in-95 duration-200 z-50">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg text-left"
                  >
                    <Camera className="w-4 h-4 text-blue-500" />
                    <span>Camera</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg text-left"
                  >
                    <ImageIcon className="w-4 h-4 text-green-500" />
                    <span>Upload Image</span>
                  </button>
                </div>
              )}
            </div>

            {/* Hidden Inputs */}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={cameraInputRef}
              onChange={handleFileSelect}
            />

            {isSupported && (
              <button
                onClick={toggleListening}
                className={cn(
                  'p-3.5 rounded-xl transition-all shadow-md',
                  isListening
                    ? 'bg-primary text-primary-foreground animate-pulse scale-110'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isHindi ? "टाइप करें या बोलें..." : "Type or speak..."}
              className="input-field flex-1 text-base py-3"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-3.5 rounded-xl btn-gold disabled:opacity-50 transition-all shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
