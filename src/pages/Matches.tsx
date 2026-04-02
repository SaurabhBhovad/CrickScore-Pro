import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Dialog } from '@/src/components/ui/Dialog';
import { Label } from '@/src/components/ui/Label';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { Trophy, Plus, Search, Filter, Calendar, Clock, MapPin, Activity, Loader2, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { db, collection, onSnapshot, setDoc, doc, handleFirestoreError, OperationType, query, where } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { toast } from 'sonner';
import Scorecard from '../components/Scorecard';

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
  tournamentId?: string;
  overs: number;
  matchType: string;
  score1: number;
  wickets1: number;
  balls1: number;
  score2: number;
  wickets2: number;
  balls2: number;
  playerStats?: any;
}

interface Team {
  id: string;
  name: string;
}

interface Tournament {
  id: string;
  name: string;
}

export default function Matches() {
  const { user } = useFirebase();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [newMatch, setNewMatch] = useState({
    team1Id: '',
    team2Id: '',
    tournamentId: '',
    overs: 20,
    matchType: 'T20',
    date: new Date().toISOString().slice(0, 16),
    tossWinnerId: '',
    tossDecision: 'bat' as 'bat' | 'bowl'
  });

  const [selectedMatchForScorecard, setSelectedMatchForScorecard] = useState<Match | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch matches
    const matchesQuery = query(collection(db, 'matches'), where('ownerId', '==', user.uid));
    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Match[];
      setMatches(matchesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
      setLoading(false);
    });

    // Fetch teams
    const teamsQuery = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Team[];
      setTeams(teamsData);
    });

    // Fetch tournaments
    const tournamentsQuery = query(collection(db, 'tournaments'), where('ownerId', '==', user.uid));
    const unsubscribeTournaments = onSnapshot(tournamentsQuery, (snapshot) => {
      const tournamentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Tournament[];
      setTournaments(tournamentsData);
    });

    return () => {
      unsubscribeMatches();
      unsubscribeTeams();
      unsubscribeTournaments();
    };
  }, [user]);

  const handleCreateMatch = async () => {
    if (!user) return;
    if (!newMatch.team1Id || !newMatch.team2Id) {
      toast.error('Both teams are required');
      return;
    }
    if (newMatch.team1Id === newMatch.team2Id) {
      toast.error('Teams must be different');
      return;
    }

    setIsCreating(true);
    try {
      const matchId = doc(collection(db, 'matches')).id;
      const team1 = teams.find(t => t.id === newMatch.team1Id);
      const team2 = teams.find(t => t.id === newMatch.team2Id);

      // Determine who bats first
      let battingFirstId = newMatch.team1Id;
      let bowlingFirstId = newMatch.team2Id;

      if (newMatch.tossWinnerId) {
        const tossWinnerId = newMatch.tossWinnerId;
        const tossLoserId = tossWinnerId === newMatch.team1Id ? newMatch.team2Id : newMatch.team1Id;
        
        if (newMatch.tossDecision === 'bat') {
          battingFirstId = tossWinnerId;
          bowlingFirstId = tossLoserId;
        } else {
          battingFirstId = tossLoserId;
          bowlingFirstId = tossWinnerId;
        }
      }

      const matchData: any = {
        id: matchId,
        ownerId: user.uid,
        team1Id: battingFirstId, // Team 1 is always batting first in our scoring logic
        team2Id: bowlingFirstId, // Team 2 is always bowling first in our scoring logic
        team1Name: teams.find(t => t.id === battingFirstId)?.name || 'Team 1',
        team2Name: teams.find(t => t.id === bowlingFirstId)?.name || 'Team 2',
        originalTeam1Id: newMatch.team1Id,
        originalTeam2Id: newMatch.team2Id,
        tossWinnerId: newMatch.tossWinnerId || null,
        tossDecision: newMatch.tossDecision,
        date: newMatch.date,
        status: 'scheduled',
        tournamentId: newMatch.tournamentId || null,
        overs: Number(newMatch.overs),
        matchType: newMatch.matchType,
        score1: 0,
        wickets1: 0,
        balls1: 0,
        score2: 0,
        wickets2: 0,
        balls2: 0,
        currentInnings: 1
      };

      await setDoc(doc(db, 'matches', matchId), matchData);
      toast.success('Match created successfully!');
      setIsCreateDialogOpen(false);
      navigate(`/matches/${matchId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'matches');
      toast.error('Failed to create match');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredMatches = matches.filter(m => 
    m.team1Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.team2Name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Matches</h1>
          <p className="text-muted-foreground mt-1 text-lg">Track live scores, upcoming fixtures, and historical results.</p>
        </div>
        <Button className="gap-2 h-11 px-6 shadow-lg" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus size={20} />
          Create Match
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            className="pl-10 h-11 bg-background" 
            placeholder="Search by team or venue..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2 h-11">
          <Filter size={18} />
          Filters
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
          <Activity className="mx-auto text-muted-foreground mb-4" size={48} />
          <h3 className="text-xl font-semibold">No matches found</h3>
          <p className="text-muted-foreground">Schedule your first match to start scoring.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMatches.map((match) => (
            <Card 
              key={match.id} 
              className="group hover:shadow-xl transition-all duration-300 border-muted/60 overflow-hidden flex flex-col cursor-pointer" 
              onClick={() => navigate(`/matches/${match.id}`)}
            >
              <div className={`h-1.5 transition-colors ${match.status === 'ongoing' ? 'bg-red-500 animate-pulse' : match.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={match.status === 'completed' ? 'success' : match.status === 'ongoing' ? 'destructive' : 'secondary'} className="font-bold capitalize">
                    {match.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <Clock size={12} />
                    <span>{match.overs} Overs</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="flex-1 text-center">
                    <div className="w-12 h-12 rounded-full bg-secondary mx-auto mb-2 flex items-center justify-center font-bold">
                      {match.team1Name.charAt(0)}
                    </div>
                    <div className="font-bold text-sm truncate">{match.team1Name}</div>
                  </div>
                  <div className="text-xs font-bold text-muted-foreground italic">VS</div>
                  <div className="flex-1 text-center">
                    <div className="w-12 h-12 rounded-full bg-secondary mx-auto mb-2 flex items-center justify-center font-bold">
                      {match.team2Name.charAt(0)}
                    </div>
                    <div className="font-bold text-sm truncate">{match.team2Name}</div>
                  </div>
                </div>
                <CardDescription className="text-center font-medium flex items-center justify-center gap-1">
                  <Trophy size={14} className="text-primary" />
                  {tournaments.find(t => t.id === match.tournamentId)?.name || 'Friendly Match'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div>
                      <div className="text-lg font-black tracking-tighter">{match.score1}/{match.wickets1}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        {Math.floor(match.balls1 / 6)}.{match.balls1 % 6} Overs
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black tracking-tighter">{match.score2}/{match.wickets2}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        {Math.floor(match.balls2 / 6)}.{match.balls2 % 6} Overs
                      </div>
                    </div>
                  </div>
                  {match.result && (
                    <div className="pt-4 border-t flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Activity size={14} />
                        <span>{match.result}</span>
                      </div>
                      {match.status === 'completed' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-xs font-bold gap-1 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMatchForScorecard(match);
                          }}
                        >
                          <FileText size={14} />
                          Scorecard
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        isOpen={!!selectedMatchForScorecard}
        onClose={() => setSelectedMatchForScorecard(null)}
        title="Match Scorecard"
        description="Detailed statistics for this match."
        className="max-w-4xl"
      >
        <div className="py-4">
          {selectedMatchForScorecard && <Scorecard match={selectedMatchForScorecard as any} />}
        </div>
      </Dialog>

      <Dialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        title="Create New Match"
        description="Configure the match settings and start live scoring."
      >
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teamA">Team A (Home)</Label>
              <select 
                id="teamA" 
                className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newMatch.team1Id}
                onChange={(e) => setNewMatch({...newMatch, team1Id: e.target.value})}
              >
                <option value="">Select Team A</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamB">Team B (Away)</Label>
              <select 
                id="teamB" 
                className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newMatch.team2Id}
                onChange={(e) => setNewMatch({...newMatch, team2Id: e.target.value})}
              >
                <option value="">Select Team B</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tournament">Tournament (Optional)</Label>
            <select 
              id="tournament" 
              className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={newMatch.tournamentId}
              onChange={(e) => setNewMatch({...newMatch, tournamentId: e.target.value})}
            >
              <option value="">None (Friendly Match)</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="overs">Overs per Innings</Label>
              <Input 
                id="overs" 
                type="number" 
                value={newMatch.overs}
                onChange={(e) => setNewMatch({...newMatch, overs: Number(e.target.value)})}
                className="h-11" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matchType">Match Type</Label>
              <select 
                id="matchType" 
                className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newMatch.matchType}
                onChange={(e) => setNewMatch({...newMatch, matchType: e.target.value})}
              >
                <option value="T20">T20</option>
                <option value="ODI">ODI</option>
                <option value="Test">Test</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Toss Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tossWinner">Toss Winner</Label>
                <select 
                  id="tossWinner" 
                  className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={newMatch.tossWinnerId}
                  onChange={(e) => setNewMatch({...newMatch, tossWinnerId: e.target.value})}
                >
                  <option value="">Select Winner</option>
                  {newMatch.team1Id && <option value={newMatch.team1Id}>{teams.find(t => t.id === newMatch.team1Id)?.name}</option>}
                  {newMatch.team2Id && <option value={newMatch.team2Id}>{teams.find(t => t.id === newMatch.team2Id)?.name}</option>}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tossDecision">Decision</Label>
                <select 
                  id="tossDecision" 
                  className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={newMatch.tossDecision}
                  onChange={(e) => setNewMatch({...newMatch, tossDecision: e.target.value as 'bat' | 'bowl'})}
                >
                  <option value="bat">Batting First</option>
                  <option value="bowl">Bowling First</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Match Date & Time</Label>
            <Input 
              id="date" 
              type="datetime-local" 
              className="h-11" 
              value={newMatch.date}
              onChange={(e) => setNewMatch({...newMatch, date: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-3 pt-6">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button className="px-8 shadow-md" onClick={handleCreateMatch} disabled={isCreating}>
              {isCreating ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              Start Match
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
