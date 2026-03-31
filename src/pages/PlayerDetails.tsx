import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { User, Activity, ChevronRight, Loader2, Plus, MapPin, Clock, Calendar, Trophy, Zap, Target } from 'lucide-react';
import { db, doc, onSnapshot, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface Player {
  id: string;
  name: string;
  role: string;
  battingStyle: string;
  bowlingStyle: string;
  teamId: string;
  teamName?: string;
  photo?: string;
  stats?: {
    matches: number;
    runs: number;
    wickets: number;
    average: number;
    strikeRate: number;
    highestScore?: number;
    bestBowling?: string;
    economy?: number;
  };
}

export default function PlayerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const playerRef = doc(db, 'players', id);
    const unsubscribe = onSnapshot(playerRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlayer({ id: snapshot.id, ...snapshot.data() } as Player);
      } else {
        toast.error('Player not found');
        navigate('/players');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `players/${id}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, navigate]);

  if (loading || !player) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="animate-spin text-primary" size={64} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Player Header */}
      <div className="bg-card p-8 rounded-[2.5rem] border border-muted/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner font-black text-4xl">
              {player.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black tracking-tighter">{player.name}</h1>
                <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-widest text-[10px] px-3 py-1">
                  {player.role}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><Zap size={16} /> {player.battingStyle}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1.5"><Activity size={16} /> {player.bowlingStyle}</span>
                {player.teamName && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    <Link to={`/teams/${player.teamId}`} className="hover:text-primary transition-colors font-bold">
                      {player.teamName}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-2xl h-12 px-6 font-bold">
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Matches', value: player.stats?.matches || 0, icon: Activity, color: 'text-blue-500' },
          { label: 'Runs', value: player.stats?.runs || 0, icon: Zap, color: 'text-yellow-500' },
          { label: 'Wickets', value: player.stats?.wickets || 0, icon: Target, color: 'text-red-500' },
          { label: 'Average', value: (player.stats?.average || 0).toFixed(2), icon: Trophy, color: 'text-primary' },
        ].map((stat, i) => (
          <Card key={i} className="rounded-3xl border-muted/60 shadow-sm overflow-hidden group hover:border-primary/40 transition-all">
            <CardContent className="p-6">
              <div className={cn("w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors", stat.color)}>
                <stat.icon size={20} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</div>
              <div className="text-3xl font-black tracking-tight">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black tracking-tight">Career Highlights</CardTitle>
              <CardDescription className="font-medium">Key milestones and achievements in the career</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-muted/20 rounded-2xl border border-muted/40">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <div className="font-black text-sm mb-1">Highest Score: {player.stats?.highestScore || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground font-medium">Personal best in a single innings</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-muted/20 rounded-2xl border border-muted/40">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Target size={20} />
                  </div>
                  <div>
                    <div className="font-black text-sm mb-1">Best Bowling: {player.stats?.bestBowling || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground font-medium">Most wickets taken in a single match</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black tracking-tight">Detailed Statistics</CardTitle>
              <CardDescription className="font-medium">In-depth performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Batting Stats</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Batting Average</span>
                      <span className="font-black">{(player.stats?.average || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Strike Rate</span>
                      <span className="font-black">{(player.stats?.strikeRate || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Highest Score</span>
                      <span className="font-black">{player.stats?.highestScore || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Bowling Stats</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Wickets</span>
                      <span className="font-black">{player.stats?.wickets || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Best Bowling</span>
                      <span className="font-black">{player.stats?.bestBowling || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Economy</span>
                      <span className="font-black">{(player.stats?.economy || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black tracking-tight">Player Info</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Batting Style</div>
                <div className="font-bold">{player.battingStyle}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bowling Style</div>
                <div className="font-bold">{player.bowlingStyle}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Team</div>
                <div className="font-bold">{player.teamName || 'Free Agent'}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
