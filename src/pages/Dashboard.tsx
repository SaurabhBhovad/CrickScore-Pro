import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { Trophy, Users, User, Activity, Plus, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, MoreHorizontal, Zap, Loader2, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db, collection, onSnapshot, query, where, limit, orderBy, handleFirestoreError, OperationType } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

const matchData = [
  { name: 'Mon', matches: 4 },
  { name: 'Tue', matches: 7 },
  { name: 'Wed', matches: 5 },
  { name: 'Thu', matches: 8 },
  { name: 'Fri', matches: 12 },
  { name: 'Sat', matches: 18 },
  { name: 'Sun', matches: 15 },
];

interface Player {
  id: string;
  name: string;
  role: string;
  teamId: string;
  ownerId: string;
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

export default function Dashboard() {
  const { user } = useFirebase();
  const [counts, setCounts] = useState({
    matches: 0,
    active: 0,
    teams: 0,
    players: 0
  });
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [userPlayers, setUserPlayers] = useState<Player[]>([]);
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [matchActivityData, setMatchActivityData] = useState([
    { name: 'Mon', matches: 0 },
    { name: 'Tue', matches: 0 },
    { name: 'Wed', matches: 0 },
    { name: 'Thu', matches: 0 },
    { name: 'Fri', matches: 0 },
    { name: 'Sat', matches: 0 },
    { name: 'Sun', matches: 0 },
  ]);

  useEffect(() => {
    if (!user) return;

    const matchesQuery = query(collection(db, 'matches'), where('ownerId', '==', user.uid));
    const unsubMatches = onSnapshot(matchesQuery, (snapshot) => {
      const matches = snapshot.docs.map(doc => doc.data());
      setCounts(prev => ({
        ...prev,
        matches: snapshot.size,
        active: matches.filter(m => m.status === 'ongoing').length
      }));

      // Calculate activity data
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const countsByDay: Record<string, number> = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
      
      matches.forEach(m => {
        if (m.date) {
          const date = new Date(m.date);
          const dayName = days[date.getDay()];
          if (countsByDay[dayName] !== undefined) {
            countsByDay[dayName]++;
          }
        }
      });

      setMatchActivityData([
        { name: 'Mon', matches: countsByDay['Mon'] },
        { name: 'Tue', matches: countsByDay['Tue'] },
        { name: 'Wed', matches: countsByDay['Wed'] },
        { name: 'Thu', matches: countsByDay['Thu'] },
        { name: 'Fri', matches: countsByDay['Fri'] },
        { name: 'Sat', matches: countsByDay['Sat'] },
        { name: 'Sun', matches: countsByDay['Sun'] },
      ]);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'matches'));

    const teamsQuery = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
    const unsubTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamMap: Record<string, string> = {};
      const utIds: string[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        teamMap[doc.id] = data.name;
        utIds.push(doc.id);
      });
      setTeams(teamMap);
      setUserTeamIds(utIds);
      setCounts(prev => ({ ...prev, teams: utIds.length }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'teams'));

    const playersQuery = query(collection(db, 'players'), where('ownerId', '==', user.uid));
    const unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Player[];
      
      setUserPlayers(playersData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'players'));

    const recentQuery = query(collection(db, 'matches'), where('ownerId', '==', user.uid), orderBy('date', 'desc'), limit(3));
    const unsubRecent = onSnapshot(recentQuery, (snapshot) => {
      setRecentMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'matches'));

    return () => {
      unsubMatches();
      unsubTeams();
      unsubPlayers();
      unsubRecent();
    };
  }, [user]);

  const stats = [
    { name: 'Total Matches', value: counts.matches.toString(), change: '+12%', trend: 'up', icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Active Events', value: counts.active.toString(), change: '+2', trend: 'up', icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
    { name: 'Total Teams', value: counts.teams.toString(), change: '0%', trend: 'neutral', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { name: 'Total Players', value: counts.players.toString(), change: '+24', trend: 'up', icon: User, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const filteredUserPlayers = React.useMemo(() => {
    return userPlayers.filter(p => userTeamIds.includes(p.teamId));
  }, [userPlayers, userTeamIds]);

  useEffect(() => {
    setCounts(prev => ({ ...prev, players: filteredUserPlayers.length }));
  }, [filteredUserPlayers]);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="animate-spin text-primary" size={64} />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Dashboard</h1>
          <p className="text-muted-foreground font-medium mt-1">Welcome back, here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/tournaments">
            <Button variant="outline" className="rounded-2xl h-12 px-6 font-bold border-muted hover:bg-muted/50">
              <Calendar size={18} className="mr-2" />
              Tournaments
            </Button>
          </Link>
          <Link to="/matches">
            <Button className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20 group">
              <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform" />
              New Match
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 w-full max-w-[400px]">
          <TabsTrigger value="overview" className="rounded-xl font-bold h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="players" className="rounded-xl font-bold h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Players & Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-10">
          {/* Stats Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.name} className="border-muted/60 shadow-sm hover:shadow-xl transition-all duration-300 group rounded-[2rem] overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                      <stat.icon size={28} />
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full",
                      stat.trend === 'up' ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    )}>
                      {stat.trend === 'up' ? <ArrowUpRight size={14} /> : <TrendingUp size={14} />}
                      {stat.change}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{stat.name}</p>
                    <h3 className="text-4xl font-black tracking-tighter mt-1">{stat.value}</h3>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Activity Chart */}
            <Card className="lg:col-span-12 xl:col-span-8 rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
              <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight">Match Activity</CardTitle>
                  <CardDescription className="font-medium">Weekly match distribution across the circuit</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreHorizontal size={20} />
                </Button>
              </CardHeader>
              <CardContent className="p-8 pt-10">
                <div className="h-[350px] w-full min-h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={matchActivityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderRadius: '16px', 
                          border: '1px solid hsl(var(--muted))',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                        }}
                        itemStyle={{ fontWeight: 700, color: 'hsl(var(--primary))' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="matches" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorMatches)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Performers Sidebar */}
            <div className="lg:col-span-12 xl:col-span-4 space-y-8">
              <Card className="rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-2xl font-black tracking-tight">Best Batsmen</CardTitle>
                  <CardDescription className="font-medium">Leading run scorers</CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-2 space-y-6">
                  {filteredUserPlayers
                    .filter(p => (p.stats?.matches || 0) > 0)
                    .sort((a, b) => (b.stats?.runs || 0) - (a.stats?.runs || 0))
                    .slice(0, 3)
                    .map((player, i) => (
                    <div key={player.id} className="flex items-center gap-4 group cursor-pointer">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden border-2 border-background shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center font-black text-xl">
                          {player.photo ? (
                            <img src={player.photo} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            player.name.charAt(0)
                          )}
                        </div>
                        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-black shadow-md">
                          {i + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm truncate group-hover:text-primary transition-colors">{player.name}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{teams[player.teamId] || 'Free Agent'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg leading-none">{player.stats?.runs || 0}</div>
                        <div className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">Runs</div>
                      </div>
                    </div>
                  ))}
                  {filteredUserPlayers.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      No players found.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-2xl font-black tracking-tight">Best Bowlers</CardTitle>
                  <CardDescription className="font-medium">Leading wicket takers</CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-2 space-y-6">
                  {filteredUserPlayers
                    .filter(p => (p.stats?.matches || 0) > 0)
                    .sort((a, b) => (b.stats?.wickets || 0) - (a.stats?.wickets || 0))
                    .slice(0, 3)
                    .map((player, i) => (
                    <div key={player.id} className="flex items-center gap-4 group cursor-pointer">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden border-2 border-background shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center font-black text-xl">
                          {player.photo ? (
                            <img src={player.photo} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            player.name.charAt(0)
                          )}
                        </div>
                        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-black shadow-md">
                          {i + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm truncate group-hover:text-primary transition-colors">{player.name}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{teams[player.teamId] || 'Free Agent'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg leading-none">{player.stats?.wickets || 0}</div>
                        <div className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">Wickets</div>
                      </div>
                    </div>
                  ))}
                  {filteredUserPlayers.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      No players found.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Matches Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black tracking-tight">Recent Matches</h2>
              <Link to="/matches" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                View All <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {recentMatches.map((match) => (
                <Link key={match.id} to={`/matches/${match.id}`}>
                  <Card className="border-muted/60 shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] overflow-hidden group">
                    <CardContent className="p-8">
                      <div className="flex items-center justify-between mb-6">
                        <Badge variant={match.status === 'ongoing' ? 'destructive' : 'secondary'} className="rounded-full px-3 py-1 font-black text-[10px] uppercase tracking-widest">
                          {match.status}
                        </Badge>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{match.matchType} • {match.overs} Overs</span>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden border border-muted font-bold text-xs">
                              {match.team1Name.charAt(0)}
                            </div>
                            <span className="font-black text-sm">{match.team1Name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-lg">{match.score1}/{match.wickets1}</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{Math.floor(match.balls1/6)}.{match.balls1%6} Overs</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden border border-muted font-bold text-xs">
                              {match.team2Name.charAt(0)}
                            </div>
                            <span className="font-black text-sm">{match.team2Name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-lg">{match.score2}/{match.wickets2}</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{Math.floor(match.balls2/6)}.{match.balls2%6} Overs</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 pt-6 border-t border-muted/60 flex items-center justify-between">
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                          <Zap size={14} className="fill-primary" />
                          {match.result || (match.status === 'ongoing' ? 'Match in progress' : 'Scheduled')}
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <ArrowUpRight size={16} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredUserPlayers.map((player) => (
              <Card key={player.id} className="border-muted/60 shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] overflow-hidden group">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl border-2 border-background shadow-sm overflow-hidden">
                      {player.photo ? (
                        <img src={player.photo} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        player.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-lg group-hover:text-primary transition-colors">{player.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-black">{player.role}</Badge>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{teams[player.teamId] || 'Free Agent'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-muted/30 rounded-2xl text-center">
                      <div className="text-2xl font-black">{(player.stats?.matches || 0) > 0 ? (player.stats?.runs || 0) : '-'}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Runs</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-2xl text-center">
                      <div className="text-2xl font-black">{(player.stats?.matches || 0) > 0 ? (player.stats?.wickets || 0) : '-'}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Wickets</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-muted-foreground">Matches</span>
                      <span className="font-black">{player.stats?.matches || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-muted-foreground">Average</span>
                      <span className="font-black">{(player.stats?.matches || 0) > 0 ? (player.stats?.average || 0) : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-muted-foreground">Strike Rate</span>
                      <span className="font-black">{(player.stats?.matches || 0) > 0 ? (player.stats?.strikeRate || 0) : 'N/A'}</span>
                    </div>
                  </div>

                  <Link to={`/players/${player.id}`} className="block mt-8">
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      View Profile
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
            {filteredUserPlayers.length === 0 && (
              <div className="col-span-full text-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                <User className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-xl font-black">No players found</h3>
                <p className="text-muted-foreground font-medium">Add players during team creation to see them here.</p>
                <Link to="/teams">
                  <Button className="mt-6 rounded-xl font-bold">Create Team</Button>
                </Link>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
