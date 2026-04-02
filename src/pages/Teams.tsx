import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Dialog } from '@/src/components/ui/Dialog';
import { Label } from '@/src/components/ui/Label';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { Badge } from '@/src/components/ui/Badge';
import { Users, Plus, Search, Filter, MapPin, Calendar, Trophy, Loader2, Activity, User, Image as ImageIcon, X, Upload, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { db, collection, onSnapshot, setDoc, doc, query, where, handleFirestoreError, OperationType, deleteDoc, getDocs, writeBatch } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  role: string;
  battingStyle: string;
  bowlingStyle?: string;
  teamId: string;
  ownerId: string;
  photo?: string;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    highestScore: number;
    bestBowling: string;
    average: number;
    strikeRate: number;
  };
}

interface Team {
  id: string;
  name: string;
  logo?: string;
  ownerId: string;
  stats?: {
    played: number;
    won: number;
    lost: number;
    points: number;
  };
}

export default function Teams() {
  const { user } = useFirebase();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

  // Form state
  const [newTeam, setNewTeam] = useState({
    name: '',
    logo: ''
  });
  const [teamPlayers, setTeamPlayers] = useState<{ name: string; role: string; photo?: string }[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState('Batsman');
  const [newPlayerPhoto, setNewPlayerPhoto] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    const teamsQuery = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      setTeams(teamsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
      setLoading(false);
    });

    const playersQuery = query(collection(db, 'players'), where('ownerId', '==', user.uid));
    const unsubscribePlayers = onSnapshot(playersQuery, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const teamId = doc.data().teamId;
        if (teamId) {
          counts[teamId] = (counts[teamId] || 0) + 1;
        }
      });
      setPlayerCounts(counts);
    });

    return () => {
      unsubscribeTeams();
      unsubscribePlayers();
    };
  }, [user]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        toast.error('Logo size should be less than 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTeam({ ...newTeam, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlayerPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        toast.error('Photo size should be less than 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPlayerPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addPlayerToNewTeam = () => {
    if (!newPlayerName.trim()) return;
    setTeamPlayers([...teamPlayers, { name: newPlayerName, role: newPlayerRole, photo: newPlayerPhoto }]);
    setNewPlayerName('');
    setNewPlayerPhoto(undefined);
  };

  const removePlayerFromNewTeam = (index: number) => {
    setTeamPlayers(teamPlayers.filter((_, i) => i !== index));
  };

  const handleCreateTeam = async () => {
    if (!user) {
      toast.error('You must be logged in to create a team');
      return;
    }
    if (!newTeam.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setIsCreating(true);
    try {
      // If there's a partially filled player, add them automatically
      let finalPlayers = [...teamPlayers];
      if (newPlayerName.trim()) {
        finalPlayers.push({ name: newPlayerName, role: newPlayerRole, photo: newPlayerPhoto });
      }

      console.log('Creating team:', newTeam.name, 'with', finalPlayers.length, 'players');
      const teamId = doc(collection(db, 'teams')).id;
      const teamData: Team = {
        id: teamId,
        name: newTeam.name,
        logo: newTeam.logo,
        ownerId: user.uid,
        stats: {
          played: 0,
          won: 0,
          lost: 0,
          points: 0
        }
      };

      await setDoc(doc(db, 'teams', teamId), teamData);
      console.log('Team document created:', teamId);

      // Create players
      for (const p of finalPlayers) {
        const playerId = doc(collection(db, 'players')).id;
        const playerData: Player = {
          id: playerId,
          name: p.name,
          role: p.role,
          battingStyle: 'Right-hand',
          teamId: teamId,
          ownerId: user.uid,
          photo: p.photo || null,
          stats: {
            matches: 0,
            runs: 0,
            wickets: 0,
            highestScore: 0,
            bestBowling: '0/0',
            average: 0,
            strikeRate: 0
          }
        };
        await setDoc(doc(db, 'players', playerId), playerData);
        console.log('Player document created:', playerId);
      }

      toast.success('Team and players created successfully!');
      setIsCreateDialogOpen(false);
      setNewTeam({ name: '', logo: '' });
      setTeamPlayers([]);
      setNewPlayerName('');
      setNewPlayerPhoto(undefined);
    } catch (error: any) {
      console.error('Error creating team:', error);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'teams');
      } catch (err: any) {
        toast.error('Failed to create team: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!user) return;
    
    try {
      // 1. Delete all players associated with this team
      const playersQuery = query(collection(db, 'players'), where('teamId', '==', teamId));
      const playersSnapshot = await getDocs(playersQuery);
      
      const batch = writeBatch(db);
      playersSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // 2. Delete the team document
      batch.delete(doc(db, 'teams', teamId));
      
      await batch.commit();
      toast.success('Team and its players deleted successfully');
      setTeamToDelete(null);
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast.error('Failed to delete team');
    }
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage professional teams, rosters, and performance history.</p>
        </div>
        <Button className="gap-2 h-11 px-6 shadow-lg" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus size={20} />
          Create Team
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            className="pl-10 h-11 bg-background" 
            placeholder="Search teams by name or location..." 
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
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
          <Users className="mx-auto text-muted-foreground mb-4" size={48} />
          <h3 className="text-xl font-semibold">No teams found</h3>
          <p className="text-muted-foreground">Try adjusting your search or create a new team.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTeams.map((team) => (
            <Card key={team.id} className="group hover:shadow-xl transition-all duration-300 border-muted/60 overflow-hidden relative">
              <div className="h-2 bg-primary/10 group-hover:bg-primary transition-colors" />
              {user?.uid === team.ownerId && (
                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow-lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTeamToDelete(team);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
              <CardHeader className="pb-2 text-center">
                <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center text-secondary-foreground mb-4 mx-auto font-bold text-3xl shadow-md border-4 border-background group-hover:scale-105 transition-transform overflow-hidden">
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    team.name.charAt(0)
                  )}
                </div>
                <CardTitle className="text-2xl group-hover:text-primary transition-colors truncate">{team.name}</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
                  <Users size={14} />
                  <span className="text-sm">{playerCounts[team.id] || 0} Players</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div className="p-2 bg-muted/30 rounded-lg text-center">
                    <div className="text-lg font-bold">{team.stats?.played || 0}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Played</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-600">{team.stats?.won || 0}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Won</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-lg text-center">
                    <div className="text-lg font-bold text-red-600">{team.stats?.lost || 0}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lost</div>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Trophy size={16} />
                      <span>Points</span>
                    </div>
                    <span className="font-bold text-primary">{team.stats?.points || 0}</span>
                  </div>
                </div>

                <Link to={`/teams/${team.id}`} className="block">
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    View Team Hub
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
        title="Create New Team"
        description="Establish a new cricket team in the professional circuit."
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="teamName">Official Team Name</Label>
            <Input 
              id="teamName" 
              placeholder="e.g. Mumbai Indians" 
              className="h-11" 
              value={newTeam.name}
              onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Team Logo</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/20">
                {newTeam.logo ? (
                  <img src={newTeam.logo} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Plus className="text-muted-foreground" size={20} />
                )}
              </div>
              <Input 
                id="logo" 
                type="file" 
                accept="image/*"
                className="h-11 cursor-pointer" 
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-bold">Squad Members</Label>
              <Badge variant="secondary">{teamPlayers.length} Players</Badge>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Input 
                    placeholder="Player Name" 
                    className="h-11" 
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPlayerToNewTeam()}
                  />
                  <div className="flex gap-2">
                    <Select 
                      className="h-11 flex-1"
                      value={newPlayerRole}
                      onChange={(e) => setNewPlayerRole(e.target.value)}
                    >
                      <option value="Batsman">Batsman</option>
                      <option value="Bowler">Bowler</option>
                      <option value="All-rounder">All-rounder</option>
                      <option value="Wicketkeeper">Wicketkeeper</option>
                    </Select>
                    <div className="relative">
                      <Input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        id="player-photo"
                        onChange={handlePlayerPhotoUpload}
                      />
                      <Label 
                        htmlFor="player-photo" 
                        className={cn(
                          "h-11 px-4 flex items-center justify-center rounded-xl border border-dashed cursor-pointer transition-colors",
                          newPlayerPhoto ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-muted-foreground/20 hover:bg-muted"
                        )}
                      >
                        {newPlayerPhoto ? <Activity size={18} /> : <User size={18} />}
                      </Label>
                    </div>
                    <Button type="button" variant="secondary" className="h-11" onClick={addPlayerToNewTeam}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {teamPlayers.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-muted">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden border border-primary/20">
                      {player.photo ? (
                        <img src={player.photo} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-bold text-xs">{player.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{player.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{player.role}</div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removePlayerFromNewTeam(index)}
                  >
                    <Plus size={16} className="rotate-45" />
                  </Button>
                </div>
              ))}
              {teamPlayers.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                  No players added yet.
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button className="px-8 shadow-md" onClick={handleCreateTeam} disabled={isCreating}>
              {isCreating ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              Create Team
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={!!teamToDelete}
        onClose={() => setTeamToDelete(null)}
        title="Delete Team?"
        description={`This will permanently delete "${teamToDelete?.name}" and all its players. This action cannot be undone.`}
      >
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setTeamToDelete(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => teamToDelete && handleDeleteTeam(teamToDelete.id)}>
            Delete Team
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
