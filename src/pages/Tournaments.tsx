import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Dialog } from '@/src/components/ui/Dialog';
import { Label } from '@/src/components/ui/Label';
import { Input } from '@/src/components/ui/Input';
import { Trophy, Plus, Search, Filter, Calendar, Users, Activity, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, collection, onSnapshot, setDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { toast } from 'sonner';

interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  teamIds: string[];
  ownerId: string;
}

interface Team {
  id: string;
  name: string;
}

export default function Tournaments() {
  const { user } = useFirebase();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [newTournament, setNewTournament] = useState({
    name: '',
    startDate: '',
    endDate: '',
    selectedTeams: [] as string[]
  });

  useEffect(() => {
    // Fetch tournaments
    const tournamentsRef = collection(db, 'tournaments');
    const unsubscribeTournaments = onSnapshot(tournamentsRef, (snapshot) => {
      const tournamentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tournament[];
      setTournaments(tournamentsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tournaments');
      setLoading(false);
    });

    // Fetch teams for selection
    const teamsRef = collection(db, 'teams');
    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Team[];
      setTeams(teamsData);
    });

    return () => {
      unsubscribeTournaments();
      unsubscribeTeams();
    };
  }, []);

  const handleCreateTournament = async () => {
    if (!user) return;
    if (!newTournament.name.trim() || !newTournament.startDate) {
      toast.error('Name and Start Date are required');
      return;
    }

    setIsCreating(true);
    try {
      const tournamentId = doc(collection(db, 'tournaments')).id;
      const tournamentData: Tournament = {
        id: tournamentId,
        name: newTournament.name,
        startDate: newTournament.startDate,
        endDate: newTournament.endDate,
        status: 'upcoming',
        teamIds: newTournament.selectedTeams,
        ownerId: user.uid
      };

      await setDoc(doc(db, 'tournaments', tournamentId), tournamentData);
      toast.success('Tournament created successfully!');
      setIsCreateDialogOpen(false);
      setNewTournament({ name: '', startDate: '', endDate: '', selectedTeams: [] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tournaments');
      toast.error('Failed to create tournament');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTeamSelection = (teamId: string) => {
    setNewTournament(prev => ({
      ...prev,
      selectedTeams: prev.selectedTeams.includes(teamId)
        ? prev.selectedTeams.filter(id => id !== teamId)
        : [...prev.selectedTeams, teamId]
    }));
  };

  const filteredTournaments = tournaments.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Tournaments</h1>
          <p className="text-muted-foreground mt-1 text-lg">Organize leagues, championships, and series with full points table tracking.</p>
        </div>
        <Button className="gap-2 h-11 px-6 shadow-lg" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus size={20} />
          Create Tournament
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            className="pl-10 h-11 bg-background" 
            placeholder="Search tournaments by name..." 
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
      ) : filteredTournaments.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
          <Trophy className="mx-auto text-muted-foreground mb-4" size={48} />
          <h3 className="text-xl font-semibold">No tournaments found</h3>
          <p className="text-muted-foreground">Start by creating your first professional tournament.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="group hover:shadow-xl transition-all duration-300 border-muted/60 overflow-hidden flex flex-col">
              <div className={`h-2 transition-colors ${tournament.status === 'ongoing' ? 'bg-blue-500' : tournament.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <CardHeader className="pb-2 text-center">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground mb-4 mx-auto font-bold text-2xl shadow-inner border-2 border-background group-hover:rotate-12 transition-transform">
                  <Trophy size={32} className={tournament.status === 'ongoing' ? 'text-blue-500' : 'text-green-500'} />
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{tournament.name}</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge variant={tournament.status === 'ongoing' ? 'default' : tournament.status === 'completed' ? 'success' : 'secondary'} className="font-medium capitalize">
                    {tournament.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 bg-muted/30 rounded-xl text-center">
                    <div className="text-lg font-bold">0</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Matches</div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-xl text-center">
                    <div className="text-lg font-bold">{tournament.teamIds?.length || 0}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Teams</div>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar size={16} />
                      <span>Start Date</span>
                    </div>
                    <span className="font-medium">{tournament.startDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity size={16} />
                      <span>Status</span>
                    </div>
                    <span className="font-medium capitalize">{tournament.status}</span>
                  </div>
                </div>

                <Link to={`/tournaments/${tournament.id}`} className="block mt-auto">
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    View Standings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        title="Create New Tournament"
        description="Configure a new tournament series or league."
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tournamentName">Tournament Name</Label>
            <Input 
              id="tournamentName" 
              placeholder="e.g. World Cup 2024" 
              className="h-11" 
              value={newTournament.name}
              onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input 
                id="startDate" 
                type="date" 
                className="h-11" 
                value={newTournament.startDate}
                onChange={(e) => setNewTournament({...newTournament, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input 
                id="endDate" 
                type="date" 
                className="h-11" 
                value={newTournament.endDate}
                onChange={(e) => setNewTournament({...newTournament, endDate: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="teams">Select Participating Teams</Label>
            <div className="p-3 border rounded-xl max-h-48 overflow-y-auto space-y-2 bg-muted/10">
              {teams.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No teams available. Create teams first.</p>
              ) : (
                teams.map((team) => (
                  <div 
                    key={team.id} 
                    className="flex items-center gap-3 p-2 hover:bg-background rounded-lg transition-colors cursor-pointer"
                    onClick={() => toggleTeamSelection(team.id)}
                  >
                    <input 
                      type="checkbox" 
                      id={`team-${team.id}`} 
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" 
                      checked={newTournament.selectedTeams.includes(team.id)}
                      readOnly
                    />
                    <label htmlFor={`team-${team.id}`} className="text-sm font-medium cursor-pointer flex-1">{team.name}</label>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button className="px-8 shadow-md" onClick={handleCreateTournament} disabled={isCreating}>
              {isCreating ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              Create Tournament
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
