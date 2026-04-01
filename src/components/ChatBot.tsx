import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { cn } from '../lib/utils';

const SYSTEM_INSTRUCTION = `You are a helpful AI assistant for a Cricket Scoring application. Your goal is to guide new users on how to use the app.
The app has the following features:
1. Dashboard: Shows recent matches, top players, and overall statistics.
2. Teams: Users can create teams, add players to them, and view team details.
3. Players: Users can view player profiles, their career statistics (runs, wickets, matches), and their recent performances.
4. Matches: Users can schedule new matches (T20, ODI, Test), select teams, and set the number of overs.
5. Tournaments: Users can organize multiple matches into a tournament and view the points table.
6. Scoring: This is the core feature. During a match, users can record every ball.
   - Quick scoring: Buttons for 0, 1, 2, 3, 4, 6, and Wicket.
   - Extras: Buttons for Wide, No Ball, Bye, and Leg Bye.
   - Detailed Ball Entry: A 'Detail' button to record multiple things at once (e.g., No Ball + 4 runs + Wicket).
   - Player Selection: Users must select a Striker, Non-Striker, and Bowler to start scoring.
   - Undo: A button to undo the last recorded ball.
   - Finish Innings/Match: Buttons to complete the current innings or the entire match.
7. Profile: Users can manage their profile information.

When a user asks a question, provide clear, step-by-step instructions. Be friendly and encouraging. If you don't know the answer, suggest they explore the app or ask for more details.`;

interface Message {
  role: 'user' | 'model';
  text: string;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hi! I am your Cricket Scoring assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.concat({ role: 'user', text: userMessage }).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        }
      });

      const response = await model;
      const text = response.text || "I'm sorry, I couldn't process that request.";
      
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error('ChatBot Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] md:w-[400px] h-[500px] flex flex-col"
          >
            <Card className="flex-1 flex flex-col shadow-2xl border-primary/20 rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot size={24} />
                  <CardTitle className="text-lg font-black tracking-tight">Cricket Assistant</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-primary-foreground hover:bg-white/10 rounded-full"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={20} />
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
                >
                  {messages.map((m, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex gap-3 max-w-[85%]",
                        m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={cn(
                        "p-3 rounded-2xl text-sm",
                        m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
                      )}>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>
                            {m.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 mr-auto max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                        <Bot size={16} />
                      </div>
                      <div className="bg-muted p-3 rounded-2xl rounded-tl-none">
                        <Loader2 size={16} className="animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t bg-muted/30">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                  >
                    <Input 
                      placeholder="Ask a question..." 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="rounded-xl border-muted-foreground/20 focus:border-primary"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={!input.trim() || isLoading}
                      className="rounded-xl shrink-0"
                    >
                      <Send size={18} />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors",
          isOpen ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </motion.button>
    </div>
  );
}
