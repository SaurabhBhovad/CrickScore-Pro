import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { cn } from '../lib/utils';
import { useFirebase } from './FirebaseProvider';
import { db, collection, query, where, onSnapshot } from '../firebase';

const SYSTEM_INSTRUCTION = `You are a helpful AI assistant for a Cricket Scoring application. Your goal is to guide users and answer questions about their data.
The app has features like Dashboard, Teams, Players, Matches, Tournaments, and real-time Scoring.

You have access to the user's current data provided in the context. Use this data to answer specific questions like "who is the best player in [Tournament Name]" or "how many matches has [Team Name] won".

When answering:
1. Be concise and friendly.
2. Use the provided data to give accurate answers.
3. If the user asks about "best player", consider runs scored or wickets taken.
4. If data is missing or you can't find the answer in the context, politely inform the user.
5. Provide step-by-step instructions for app features if asked.

User Data Context:
{{DATA_CONTEXT}}`;

interface Message {
  role: 'user' | 'model';
  text: string;
}

export function ChatBot() {
  const { user } = useFirebase();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hi! I am your Cricket Scoring assistant. I can help you with app features or answer questions about your tournaments and players. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Data states
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !isOpen) return;

    const unsubPlayers = onSnapshot(query(collection(db, 'players'), where('ownerId', '==', user.uid)), (snap) => {
      setPlayers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTeams = onSnapshot(query(collection(db, 'teams'), where('ownerId', '==', user.uid)), (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTournaments = onSnapshot(query(collection(db, 'tournaments'), where('ownerId', '==', user.uid)), (snap) => {
      setTournaments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMatches = onSnapshot(query(collection(db, 'matches'), where('ownerId', '==', user.uid)), (snap) => {
      setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPlayers();
      unsubTeams();
      unsubTournaments();
      unsubMatches();
    };
  }, [user, isOpen]);

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
      // Prepare data context
      const tournamentStats: Record<string, any> = {};
      tournaments.forEach(t => {
        const tName = t.name || 'Unknown Tournament';
        tournamentStats[tName] = {
          status: t.status,
          playerPerformance: {}
        };
        
        matches.filter(m => m.tournamentId === t.id).forEach(m => {
          if (m.playerStats) {
            Object.entries(m.playerStats).forEach(([pid, pstat]: [string, any]) => {
              const pName = pstat.name || 'Unknown Player';
              if (!tournamentStats[tName].playerPerformance[pName]) {
                tournamentStats[tName].playerPerformance[pName] = { runs: 0, wickets: 0, matches: 0 };
              }
              tournamentStats[tName].playerPerformance[pName].runs += pstat.runs || 0;
              tournamentStats[tName].playerPerformance[pName].wickets += pstat.wickets || 0;
              tournamentStats[tName].playerPerformance[pName].matches += 1;
            });
          }
        });
      });

      const dataContext = {
        tournaments: tournamentStats,
        teams: teams.map(t => ({ name: t.name, stats: t.stats })),
        players: players.map(p => ({ 
          name: p.name, 
          team: teams.find(t => t.id === p.teamId)?.name || 'Unknown',
          careerStats: p.stats 
        })),
        recentMatches: matches.slice(0, 5).map(m => ({
          teams: `${m.team1Name} vs ${m.team2Name}`,
          result: m.result,
          score: `${m.score1}/${m.wickets1} - ${m.score2}/${m.wickets2}`,
          tournament: tournaments.find(t => t.id === m.tournamentId)?.name || 'None'
        }))
      };

      const systemInstruction = SYSTEM_INSTRUCTION.replace('{{DATA_CONTEXT}}', JSON.stringify(dataContext, null, 2));

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.concat({ role: 'user', text: userMessage }).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: systemInstruction,
        }
      });

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
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles size={18} className="text-white animate-pulse" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black tracking-tight leading-none">Cricket AI</CardTitle>
                    <div className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1">Powered by Gemini</div>
                  </div>
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
