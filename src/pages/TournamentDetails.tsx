import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { Trophy, Calendar, Users, Activity, ChevronRight, Loader2, Plus, MapPin, Clock } from 'lucide-react';
import { db, doc, onSnapshot, collection, query, where, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  teamIds: string[];
  status: 'upcoming' | 'ongoing' | 'completed';
}

interface Team {
  id: string;
  name: string;
  logo?: string;
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

interface Standing {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  nrr: number;
}

export default function TournamentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const tournamentRef = doc(db, 'tournaments', id);
    const unsubscribeTournament = onSnapshot(tournamentRef, (snapshot) => {
      if (snapshot.exists()) {
        setTournament({ id: snapshot.id, ...snapshot.data() } as Tournament);
      } else {
        toast.error('Tournament not found');
        navigate('/tournaments');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tournaments/${id}`);
    });

    const matchesQuery = query(collection(db, 'matches'), where('tournamentId', '==', id));
    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setMatches(matchesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'matches');
    });

    const teamsQuery = collection(db, 'teams');
    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'teams');
    });

    setLoading(false);
    return () => {
      unsubscribeTournament();
      unsubscribeMatches();
      unsubscribeTeams();
    };
  }, [id, navigate]);

  const calculateStandings = (): Standing[] => {
    if (!tournament || !teams.length) return [];

    const standingsMap: Record<string, Standing> = {};
    
    // Initialize standings for all teams in the tournament
    tournament.teamIds.forEach(teamId => {
      const team = teams.find(t => t.id === teamId);
      if (team) {
        standingsMap[teamId] = {
          teamId,
          teamName: team.name,
          played: 0,
          won: 0,
          lost: 0,
          tied: 0,
          points: 0,
          nrr: 0
        };
      }
    });

    // Process completed matches
    matches.filter(m => m.status === 'completed').forEach(match => {
      const t1 = standingsMap[match.team1Id];
      const t2 = standingsMap[match.team2Id];

      if (t1 && t2) {
        t1.played++;
        t2.played++;

        if (match.result?.includes(match.team1Name)) {
          t1.won++;
          t1.points += 2;
          t2.lost++;
        } else if (match.result?.includes(match.team2Name)) {
          t2.won++;
          t2.points += 2;
          t1.lost++;
        } else {
          t1.tied++;
          t1.points += 1;
          t2.tied++;
          t2.points += 1;
        }
      }
    });

    return Object.values(standingsMap).sort((a, b) => b.points - a.points || b.won - a.won);
  };

  if (loading || !tournament) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="animate-spin text-primary" size={64} />
      </div>
    );
  }

  const standings = calculateStandings();

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Tournament Header */}
      <div className="bg-card p-8 rounded-[2.5rem] border border-muted/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
              <Trophy size={40} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black tracking-tighter">{tournament.name}</h1>
                <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-widest text-[10px] px-3 py-1">
                  {tournament.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><Calendar size={16} /> {format(new Date(tournament.startDate), 'MMM d, yyyy')} - {format(new Date(tournament.endDate), 'MMM d, yyyy')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1.5"><Users size={16} /> {tournament.teamIds.length} Teams</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1.5"><Activity size={16} /> {matches.length} Matches</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
              <Link to="/matches">
                <Plus size={20} className="mr-2" /> Schedule Match
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="standings" className="space-y-8">
        <TabsList className="bg-muted/30 p-1.5 rounded-2xl border border-muted/60 inline-flex">
          <TabsTrigger value="standings" className="rounded-xl px-8 py-2.5 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm">Standings</TabsTrigger>
          <TabsTrigger value="matches" className="rounded-xl px-8 py-2.5 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm">Matches</TabsTrigger>
          <TabsTrigger value="teams" className="rounded-xl px-8 py-2.5 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="standings" className="space-y-6">
          <Card className="rounded-[2rem] border-muted/60 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-muted/60">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pos</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team</th>
                      <th className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">P</th>
                      <th className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">W</th>
                      <th className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">L</th>
                      <th className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">T</th>
                      <th className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">NRR</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/40">
                    {standings.map((standing, index) => (
                      <tr key={standing.teamId} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-8 py-5 font-black text-muted-foreground">{index + 1}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center font-bold text-xs">
                              {standing.teamName.charAt(0)}
                            </div>
                            <span className="font-bold group-hover:text-primary transition-colors">{standing.teamName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-5 font-bold text-center">{standing.played}</td>
                        <td className="px-4 py-5 font-bold text-center text-green-600">{standing.won}</td>
                        <td className="px-4 py-5 font-bold text-center text-destructive">{standing.lost}</td>
                        <td className="px-4 py-5 font-bold text-center">{standing.tied}</td>
                        <td className="px-4 py-5 font-bold text-center text-muted-foreground">{standing.nrr.toFixed(3)}</td>
                        <td className="px-8 py-5 font-black text-right text-lg">{standing.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-muted">
                <Activity className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-xl font-black tracking-tight">No matches scheduled</h3>
                <p className="text-muted-foreground font-medium">Start by scheduling the first match of the tournament</p>
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
                          <div className="w-14 h-14 rounded-2xl bg-muted/30 mx-auto flex items-center justify-center font-bold text-lg">
                            {match.team1Name.charAt(0)}
                          </div>
                          <div className="font-black text-sm truncate">{match.team1Name}</div>
                          {match.status !== 'scheduled' && (
                            <div className="font-black text-xl">{match.score1}/{match.wickets1}</div>
                          )}
                        </div>
                        
                        <div className="text-[10px] font-black text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">VS</div>
                        
                        <div className="flex-1 text-center space-y-2">
                          <div className="w-14 h-14 rounded-2xl bg-muted/30 mx-auto flex items-center justify-center font-bold text-lg">
                            {match.team2Name.charAt(0)}
                          </div>
                          <div className="font-black text-sm truncate">{match.team2Name}</div>
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

        <TabsContent value="teams" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {tournament.teamIds.map((teamId) => {
              const team = teams.find(t => t.id === teamId);
              if (!team) return null;
              return (
                <Link key={teamId} to={`/teams/${teamId}`}>
                  <Card className="rounded-3xl border-muted/60 hover:border-primary/40 hover:shadow-lg transition-all text-center p-6 group">
                    <div className="w-20 h-20 rounded-[2rem] bg-muted/30 mx-auto flex items-center justify-center font-black text-2xl mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {team.name.charAt(0)}
                    </div>
                    <div className="font-black text-sm">{team.name}</div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
