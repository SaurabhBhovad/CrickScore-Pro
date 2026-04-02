import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Trophy, Users, Activity, Clock, MapPin } from 'lucide-react';

interface PlayerStat {
  name: string;
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  ballsBowled: number;
  isOut?: boolean;
}

interface Match {
  id: string;
  team1Name: string;
  team2Name: string;
  score1: number;
  wickets1: number;
  balls1: number;
  score2: number;
  wickets2: number;
  balls2: number;
  overs: number;
  venue?: string;
  date: string;
  result?: string;
  status: string;
  playerStats?: Record<string, PlayerStat>;
  team1Players?: string[];
  team2Players?: string[];
}

interface ScorecardProps {
  match: Match;
}

export default function Scorecard({ match }: ScorecardProps) {
  const formatOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

  const team1Batting = Object.values(match.playerStats || {})
    .filter(p => match.team1Players?.includes(p.name) || true) // Simplified for now, we'll improve this
    .filter(p => p.runs > 0 || p.balls > 0 || p.isOut);

  const team2Batting = Object.values(match.playerStats || {})
    .filter(p => match.team2Players?.includes(p.name) || true)
    .filter(p => p.runs > 0 || p.balls > 0 || p.isOut);

  // In a real app, we'd have better mapping of which player belongs to which team in the stats
  // For now, let's just show all players who batted/bowled in the match
  const allStats = Object.values(match.playerStats || {});
  
  const batsmen = allStats.filter(p => p.balls > 0 || p.runs > 0 || p.isOut).sort((a, b) => b.runs - a.runs);
  const bowlers = allStats.filter(p => p.ballsBowled > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 shadow-xl rounded-[2rem]">
        <div className="bg-primary p-8 text-primary-foreground text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <Activity className="absolute -top-10 -left-10 w-40 h-40" />
            <Trophy className="absolute -bottom-10 -right-10 w-40 h-40" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-none px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                {match.status === 'completed' ? 'Match Completed' : 'Match Ongoing'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-3 items-center gap-4 mb-6">
              <div className="text-right">
                <h3 className="text-xl font-black uppercase tracking-tight">{match.team1Name}</h3>
                <div className="text-3xl font-black mt-1">{match.score1}/{match.wickets1}</div>
                <div className="text-xs font-bold opacity-70 mt-1">({formatOvers(match.balls1)} ov)</div>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-black text-xl mb-2">VS</div>
                <div className="h-px w-full bg-white/20" />
              </div>
              
              <div className="text-left">
                <h3 className="text-xl font-black uppercase tracking-tight">{match.team2Name}</h3>
                <div className="text-3xl font-black mt-1">{match.score2}/{match.wickets2}</div>
                <div className="text-xs font-bold opacity-70 mt-1">({formatOvers(match.balls2)} ov)</div>
              </div>
            </div>

            {match.result && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 inline-block mx-auto">
                <p className="text-lg font-black tracking-tight flex items-center gap-3">
                  <Trophy className="text-yellow-400" size={24} />
                  {match.result}
                </p>
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-0">
          <div className="grid md:grid-cols-2 divide-x divide-muted/40">
            {/* Batting Stats */}
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 border-b pb-3">
                <Users className="text-primary" size={20} />
                <h3 className="font-black uppercase tracking-widest text-sm">Batting Performance</h3>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                  <div className="col-span-6">Batsman</div>
                  <div className="col-span-2 text-center">R</div>
                  <div className="col-span-2 text-center">B</div>
                  <div className="col-span-2 text-right">SR</div>
                </div>
                
                <div className="space-y-2">
                  {batsmen.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 items-center p-3 rounded-xl bg-muted/20 border border-muted/40 hover:border-primary/30 transition-colors">
                      <div className="col-span-6">
                        <div className="font-bold text-sm">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground font-medium italic">
                          {p.isOut ? 'Dismissed' : 'Not Out'}
                        </div>
                      </div>
                      <div className="col-span-2 text-center font-black text-primary">{p.runs}</div>
                      <div className="col-span-2 text-center text-xs font-bold text-muted-foreground">{p.balls}</div>
                      <div className="col-span-2 text-right text-xs font-black text-muted-foreground">
                        {p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : '0.0'}
                      </div>
                    </div>
                  ))}
                  {batsmen.length === 0 && <div className="text-center py-8 text-muted-foreground italic text-sm">No batting data available</div>}
                </div>
              </div>
            </div>

            {/* Bowling Stats */}
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 border-b pb-3">
                <Activity className="text-secondary-foreground" size={20} />
                <h3 className="font-black uppercase tracking-widest text-sm">Bowling Performance</h3>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                  <div className="col-span-5">Bowler</div>
                  <div className="col-span-2 text-center">O</div>
                  <div className="col-span-2 text-center">R</div>
                  <div className="col-span-2 text-center">W</div>
                  <div className="col-span-1 text-right">E</div>
                </div>
                
                <div className="space-y-2">
                  {bowlers.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 items-center p-3 rounded-xl bg-muted/20 border border-muted/40 hover:border-secondary/30 transition-colors">
                      <div className="col-span-5">
                        <div className="font-bold text-sm">{p.name}</div>
                      </div>
                      <div className="col-span-2 text-center text-xs font-bold text-muted-foreground">{formatOvers(p.ballsBowled)}</div>
                      <div className="col-span-2 text-center font-bold">{p.runsConceded}</div>
                      <div className="col-span-2 text-center font-black text-secondary-foreground">{p.wickets}</div>
                      <div className="col-span-1 text-right text-[10px] font-black text-muted-foreground">
                        {p.ballsBowled > 0 ? ((p.runsConceded / (p.ballsBowled / 6))).toFixed(1) : '0.0'}
                      </div>
                    </div>
                  ))}
                  {bowlers.length === 0 && <div className="text-center py-8 text-muted-foreground italic text-sm">No bowling data available</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted/10 p-6 border-t flex flex-wrap gap-6 justify-center text-sm text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              {new Date(match.date).toLocaleDateString()}
            </div>
            {match.venue && (
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                {match.venue}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              {match.overs} Overs Match
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
