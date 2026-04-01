import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Dialog } from '@/src/components/ui/Dialog';
import { Label } from '@/src/components/ui/Label';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { Badge } from '@/src/components/ui/Badge';
import { User, Plus, Search, Filter, TrendingUp, Award, Activity, Loader2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, collection, onSnapshot, query, where, handleFirestoreError, OperationType, deleteDoc, doc } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  role: string;
  teamId: string;
  ownerId?: string;
  teamName?: string;
  photo?: string;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    highestScore: number;
    average: number;
    strikeRate: number;
  };
}

export default function Players() {
  const { user } = useFirebase();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch teams first to map team names
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamMap: Record<string, string> = {};
      const utIds: string[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        teamMap[doc.id] = data.name;
        if (data.ownerId === user.uid) {
          utIds.push(doc.id);
        }
      });
      setTeams(teamMap);
      setUserTeamIds(utIds);
    });

    const playersQuery = query(collection(db, 'players'), where('ownerId', '==', user.uid));
    const unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Player[];
      setPlayers(playersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'players');
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubPlayers();
    };
  }, [user]);

  const filteredPlayers = players.filter(player => 
    userTeamIds.includes(player.teamId) && (
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (teams[player.teamId] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.role.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleDeletePlayer = async (playerId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'players', playerId));
      toast.success('Player deleted successfully');
      setPlayerToDelete(null);
    } catch (error) {
      console.error('Error deleting player:', error);
      toast.error('Failed to delete player');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Players</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage players, roles, and statistics across all teams.</p>
        </div>
        <Link to="/teams">
          <Button className="gap-2 h-11 px-6 shadow-lg">
            <Plus size={20} />
            Add Player (via Team)
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            className="pl-10 h-11 bg-background" 
            placeholder="Search by name, team, or role..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 h-11">
            <Filter size={18} />
            Filters
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
          <User className="mx-auto text-muted-foreground mb-4" size={48} />
          <h3 className="text-xl font-semibold">No players found</h3>
          <p className="text-muted-foreground">Try adjusting your search or add players through team creation.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPlayers.map((player) => (
            <Card key={player.id} className="group hover:shadow-xl transition-all duration-300 border-muted/60 overflow-hidden relative">
              <div className="h-2 bg-primary/10 group-hover:bg-primary transition-colors" />
              {user?.uid === player.ownerId && (
                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow-lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPlayerToDelete(player);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
              <CardHeader className="pb-2 text-center">
                <div className="relative inline-block mx-auto mb-4">
                  <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-2xl border-4 border-background shadow-md overflow-hidden">
                    {player.photo ? (
                      <img src={player.photo} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      player.name.charAt(0)
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow-sm">
                    <Award size={14} />
                  </div>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors truncate px-2">{player.name}</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge variant="outline" className="font-normal">{player.role}</Badge>
                  <span className="text-muted-foreground text-sm">•</span>
                  <span className="text-sm font-medium text-muted-foreground truncate max-w-[120px]">{teams[player.teamId] || 'Free Agent'}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-muted/30 rounded-xl text-center border border-transparent hover:border-primary/20 transition-colors">
                    <div className="text-lg font-bold">{(player.stats?.matches || 0) > 0 ? (player.stats?.runs || 0) : '-'}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Runs</div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-xl text-center border border-transparent hover:border-primary/20 transition-colors">
                    <div className="text-lg font-bold">{(player.stats?.matches || 0) > 0 ? (player.stats?.wickets || 0) : '-'}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Wickets</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 px-1">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-green-500" />
                    <span>SR: {(player.stats?.matches || 0) > 0 ? (player.stats?.strikeRate || 0) : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity size={12} className="text-blue-500" />
                    <span>Avg: {(player.stats?.matches || 0) > 0 ? (player.stats?.average || 0) : 'N/A'}</span>
                  </div>
                </div>
                <Link to={`/players/${player.id}`} className="block">
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    View Full Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        isOpen={!!playerToDelete}
        onClose={() => setPlayerToDelete(null)}
        title="Delete Player?"
        description={`This will permanently delete "${playerToDelete?.name}". This action cannot be undone.`}
      >
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setPlayerToDelete(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => playerToDelete && handleDeletePlayer(playerToDelete.id)}>
            Delete Player
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
