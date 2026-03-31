import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { Users, Activity, ChevronRight, Loader2, Plus, MapPin, Clock, Calendar, User, Trophy } from 'lucide-react';
import { db, doc, onSnapshot, collection, query, where, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';

interface Team {
  id: string;
  name: string;
  logo?: string;
  description?: string;
}

interface Player {
  id: string;
  name: string;
  role: string;
  battingStyle: string;
  bowlingStyle: string;
}

interface Match {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  date: string;
  venue?: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  result?: string;
  score1: number;
  wickets1: number;
  score2: number;
  wickets2: number;
}

export default function TeamDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const teamRef = doc(db, 'teams', id);
    const unsubscribeTeam = onSnapshot(teamRef, (snapshot) => {
      if (snapshot.exists()) {
        setTeam({ id: snapshot.id, ...snapshot.data() } as Team);
      } else {
        toast.error('Team not found');
        navigate('/teams');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `teams/${id}`);
    });

    const playersQuery = query(collection(db, 'players'), where('teamId', '==', id));
    const unsubscribePlayers = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(playersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'players');
    });

    const matchesQuery1 = query(collection(db, 'matches'), where('team1Id', '==', id));
    const matchesQuery2 = query(collection(db, 'matches'), where('team2Id', '==', id));
    
    const unsubscribeMatches1 = onSnapshot(matchesQuery1, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setMatches(prev => {
        const otherMatches = prev.filter(m => m.team1Id !== id);
        return [...otherMatches, ...matchesData];
      });
    });

    const unsubscribeMatches2 = onSnapshot(matchesQuery2, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setMatches(prev => {
        const otherMatches = prev.filter(m => m.team2Id !== id);
        return [...otherMatches, ...matchesData];
      });
    });

    setLoading(false);
    return () => {
      unsubscribeTeam();
      unsubscribePlayers();
      unsubscribeMatches1();
      unsubscribeMatches2();
    };
  }, [id, navigate]);

  if (loading || !team) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="animate-spin text-primary" size={64} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Team Header */}
      <div className="bg-card p-8 rounded-[2.5rem] border border-muted/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner font-black text-3xl">
              {team.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter mb-2">{team.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><Users size={16} /> {players.length} Players</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1.5"><Activity size={16} /> {matches.length} Matches</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
              <Link to="/players">
                <Plus size={20} className="mr-2" /> Add Player
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="players" className="space-y-8">
        <TabsList className="bg-muted/30 p-1.5 rounded-2xl border border-muted/60 inline-flex">
          <TabsTrigger value="players" className="rounded-xl px-8 py-2.5 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm">Players</TabsTrigger>
          <TabsTrigger value="matches" className="rounded-xl px-8 py-2.5 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm">Matches</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {players.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-muted">
                <User className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-xl font-black tracking-tight">No players added</h3>
                <p className="text-muted-foreground font-medium">Start by adding players to this team</p>
              </div>
            ) : (
              players.map((player) => (
                <Link key={player.id} to={`/players/${player.id}`}>
                  <Card className="rounded-3xl border-muted/60 hover:border-primary/40 hover:shadow-lg transition-all group overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center font-black text-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        {player.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-lg tracking-tight">{player.name}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{player.role}</div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="matches" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-muted">
                <Activity className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-xl font-black tracking-tight">No matches played</h3>
                <p className="text-muted-foreground font-medium">Schedule a match to see it here</p>
              </div>
            ) : (
              matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((match) => (
                <Link key={match.id} to={`/matches/${match.id}`}>
                  <Card className="rounded-3xl border-muted/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all group overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <Calendar size={12} /> {format(new Date(match.date), 'MMM d, yyyy')}
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <Clock size={12} /> {format(new Date(match.date), 'hh:mm a')}
                        </div>
                        <Badge variant={match.status === 'completed' ? 'secondary' : match.status === 'ongoing' ? 'destructive' : 'outline'} className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
                          {match.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4 mb-6">
                        <div className="flex-1 text-center space-y-2">
                          <div className={cn("w-14 h-14 rounded-2xl mx-auto flex items-center justify-center font-bold text-lg", match.team1Id === id ? "bg-primary/10 text-primary" : "bg-muted/30")}>
                            {match.team1Name.charAt(0)}
                          </div>
                          <div className={cn("font-black text-sm truncate", match.team1Id === id && "text-primary")}>{match.team1Name}</div>
                          {match.status !== 'scheduled' && (
                            <div className="font-black text-xl">{match.score1}/{match.wickets1}</div>
                          )}
                        </div>
                        
                        <div className="text-[10px] font-black text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">VS</div>
                        
                        <div className="flex-1 text-center space-y-2">
                          <div className={cn("w-14 h-14 rounded-2xl mx-auto flex items-center justify-center font-bold text-lg", match.team2Id === id ? "bg-primary/10 text-primary" : "bg-muted/30")}>
                            {match.team2Name.charAt(0)}
                          </div>
                          <div className={cn("font-black text-sm truncate", match.team2Id === id && "text-primary")}>{match.team2Name}</div>
                          {match.status !== 'scheduled' && (
                            <div className="font-black text-xl">{match.score2}/{match.wickets2}</div>
                          )}
                        </div>
                      </div>
                      
                      {match.result && (
                        <div className="bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest p-3 rounded-xl text-center border border-primary/10">
                          {match.result}
                        </div>
                      )}
                      
                      <div className="mt-6 pt-6 border-t border-muted/60 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                          <MapPin size={12} /> {match.venue || 'TBD'}
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
