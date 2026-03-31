import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Dialog } from '@/src/components/ui/Dialog';
import { Label } from '@/src/components/ui/Label';
import { Input } from '@/src/components/ui/Input';
import { Trophy, Undo, History, Settings, User, Activity, Info, ChevronRight, Share2, MoreVertical, Zap, Target, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { db, doc, onSnapshot, updateDoc, handleFirestoreError, OperationType, collection, query, where } from '../firebase';
import { toast } from 'sonner';

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
  currentInnings: number;
  recentBalls?: string[];
  history?: any[];
  strikerId?: string;
  nonStrikerId?: string;
  bowlerId?: string;
  strikerName?: string;
  nonStrikerName?: string;
  bowlerName?: string;
  playerStats?: {
    [playerId: string]: {
      name: string;
      runs: number;
      balls: number;
      wickets: number;
      runsConceded: number;
      ballsBowled: number;
    }
  };
}

interface Player {
  id: string;
  name: string;
  role: string;
  teamId: string;
  photo?: string;
}

export default function MatchScoring() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBatsmanSelectorOpen, setIsBatsmanSelectorOpen] = useState(false);
  const [isBowlerSelectorOpen, setIsBowlerSelectorOpen] = useState(false);
  const [battingPlayers, setBattingPlayers] = useState<Player[]>([]);
  const [bowlingPlayers, setBowlingPlayers] = useState<Player[]>([]);
  const [selectorType, setSelectorType] = useState<'striker' | 'nonStriker' | 'bowler'>('striker');

  useEffect(() => {
    if (!match) return;

    const battingTeamId = match.currentInnings === 1 ? match.team1Id : match.team2Id;
    const bowlingTeamId = match.currentInnings === 1 ? match.team2Id : match.team1Id;

    const unsubBatting = onSnapshot(query(collection(db, 'players'), where('teamId', '==', battingTeamId)), (snapshot) => {
      setBattingPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    });

    const unsubBowling = onSnapshot(query(collection(db, 'players'), where('teamId', '==', bowlingTeamId)), (snapshot) => {
      setBowlingPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    });

    return () => {
      unsubBatting();
      unsubBowling();
    };
  }, [match?.team1Id, match?.team2Id, match?.currentInnings]);

  useEffect(() => {
    if (!match || match.status === 'completed') return;

    // Initial player selection if not set
    if (!match.strikerId || !match.nonStrikerId) {
      setSelectorType('striker');
      setIsBatsmanSelectorOpen(true);
    } else if (!match.bowlerId) {
      setIsBowlerSelectorOpen(true);
    }
  }, [match?.id, match?.status, match?.strikerId, match?.nonStrikerId, match?.bowlerId]);

  useEffect(() => {
    if (!id) return;

    const matchRef = doc(db, 'matches', id);
    const unsubscribe = onSnapshot(matchRef, (snapshot) => {
      if (snapshot.exists()) {
        setMatch({ id: snapshot.id, ...snapshot.data() } as Match);
      } else {
        toast.error('Match not found');
        navigate('/matches');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `matches/${id}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, navigate]);

  const updateScore = async (runs: number, isWicket: boolean = false, isExtra: boolean = false) => {
    if (!match || !id || isUpdating) return;

    setIsUpdating(true);
    try {
      const matchRef = doc(db, 'matches', id);
      const isFirstInnings = (match.currentInnings || 1) === 1;
      
      // Save current state to history for undo
      const previousPlayerStats = JSON.parse(JSON.stringify(match.playerStats || {}));
      const currentState = {
        score1: match.score1,
        wickets1: match.wickets1,
        balls1: match.balls1,
        score2: match.score2,
        wickets2: match.wickets2,
        balls2: match.balls2,
        currentInnings: match.currentInnings,
        recentBalls: [...(match.recentBalls || [])],
        status: match.status,
        result: match.result || null,
        strikerId: match.strikerId || null,
        nonStrikerId: match.nonStrikerId || null,
        bowlerId: match.bowlerId || null,
        strikerName: match.strikerName || null,
        nonStrikerName: match.nonStrikerName || null,
        bowlerName: match.bowlerName || null,
        playerStats: previousPlayerStats
      };

      const newHistory = [currentState, ...(match.history || [])].slice(0, 10);
      
      const updates: any = {
        status: 'ongoing',
        history: newHistory,
        playerStats: JSON.parse(JSON.stringify(previousPlayerStats))
      };

      // Ensure striker and bowler are in playerStats
      if (match.strikerId && !updates.playerStats[match.strikerId]) {
        updates.playerStats[match.strikerId] = { name: match.strikerName, runs: 0, balls: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
      }
      if (match.bowlerId && !updates.playerStats[match.bowlerId]) {
        updates.playerStats[match.bowlerId] = { name: match.bowlerName, runs: 0, balls: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
      }

      // Update player stats
      if (match.strikerId && !isExtra) {
        updates.playerStats[match.strikerId].runs += runs;
        updates.playerStats[match.strikerId].balls += 1;
      }
      if (match.bowlerId) {
        updates.playerStats[match.bowlerId].runsConceded += runs;
        if (!isExtra) {
          updates.playerStats[match.bowlerId].ballsBowled += 1;
        }
        if (isWicket) {
          updates.playerStats[match.bowlerId].wickets += 1;
        }
      }

      const ballLabel = isWicket ? 'W' : runs.toString();
      const newRecentBalls = [ballLabel, ...(match.recentBalls || [])].slice(0, 6);
      updates.recentBalls = newRecentBalls;

      let ballsAfterUpdate = 0;
      let wicketsAfterUpdate = 0;
      let scoreAfterUpdate = 0;

      // Handle strike rotation
      let newStrikerId = match.strikerId;
      let newStrikerName = match.strikerName;
      let newNonStrikerId = match.nonStrikerId;
      let newNonStrikerName = match.nonStrikerName;

      if (runs % 2 !== 0 && !isWicket) {
        // Swap striker and non-striker
        [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
        [newStrikerName, newNonStrikerName] = [newNonStrikerName, newStrikerName];
      }

      updates.strikerId = newStrikerId;
      updates.strikerName = newStrikerName;
      updates.nonStrikerId = newNonStrikerId;
      updates.nonStrikerName = newNonStrikerName;

      if (isFirstInnings) {
        updates.score1 = (match.score1 || 0) + runs;
        updates.wickets1 = (match.wickets1 || 0) + (isWicket ? 1 : 0);
        updates.balls1 = (match.balls1 || 0) + (!isExtra ? 1 : 0);
        
        ballsAfterUpdate = updates.balls1;
        wicketsAfterUpdate = updates.wickets1;
        scoreAfterUpdate = updates.score1;

        // Auto finish first innings
        if (ballsAfterUpdate >= match.overs * 6 || wicketsAfterUpdate >= 10) {
          updates.currentInnings = 2;
          updates.recentBalls = [];
          updates.strikerId = null;
          updates.nonStrikerId = null;
          updates.strikerName = null;
          updates.nonStrikerName = null;
          updates.bowlerId = null;
          updates.bowlerName = null;
          toast.success('First innings completed automatically!');
        } else {
          // Check for next batsman or bowler
          if (isWicket) {
            updates.strikerId = null;
            updates.strikerName = null;
            setIsBatsmanSelectorOpen(true);
            setSelectorType('striker');
          }
          
          if (ballsAfterUpdate % 6 === 0 && ballsAfterUpdate > 0) {
            updates.bowlerId = null;
            updates.bowlerName = null;
            setIsBowlerSelectorOpen(true);
            
            // Swap strike at end of over
            const tempId = updates.strikerId;
            const tempName = updates.strikerName;
            updates.strikerId = updates.nonStrikerId;
            updates.strikerName = updates.nonStrikerName;
            updates.nonStrikerId = tempId;
            updates.nonStrikerName = tempName;
          }
        }
      } else {
        updates.score2 = (match.score2 || 0) + runs;
        updates.wickets2 = (match.wickets2 || 0) + (isWicket ? 1 : 0);
        updates.balls2 = (match.balls2 || 0) + (!isExtra ? 1 : 0);

        ballsAfterUpdate = updates.balls2;
        wicketsAfterUpdate = updates.wickets2;
        scoreAfterUpdate = updates.score2;

        // Auto finish match
        const target = match.score1 + 1;
        if (scoreAfterUpdate >= target) {
          updates.status = 'completed';
          updates.result = `${match.team2Name} won by ${10 - wicketsAfterUpdate} wickets`;
          toast.success('Match completed!');
        } else if (ballsAfterUpdate >= match.overs * 6 || wicketsAfterUpdate >= 10) {
          updates.status = 'completed';
          updates.result = scoreAfterUpdate === match.score1 
            ? 'Match Tied' 
            : `${match.team1Name} won by ${match.score1 - scoreAfterUpdate} runs`;
          toast.success('Match completed!');
        } else {
          // Check for next batsman or bowler
          if (isWicket) {
            updates.strikerId = null;
            updates.strikerName = null;
            setIsBatsmanSelectorOpen(true);
            setSelectorType('striker');
          }
          
          if (ballsAfterUpdate % 6 === 0 && ballsAfterUpdate > 0) {
            updates.bowlerId = null;
            updates.bowlerName = null;
            setIsBowlerSelectorOpen(true);

            // Swap strike at end of over
            const tempId = updates.strikerId;
            const tempName = updates.strikerName;
            updates.strikerId = updates.nonStrikerId;
            updates.strikerName = updates.nonStrikerName;
            updates.nonStrikerId = tempId;
            updates.nonStrikerName = tempName;
          }
        }
      }

      await updateDoc(matchRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${id}`);
      toast.error('Failed to update score');
    } finally {
      setIsUpdating(false);
    }
  };

  const undoScore = async () => {
    if (!match || !id || !match.history || match.history.length === 0 || isUpdating) return;

    setIsUpdating(true);
    try {
      const matchRef = doc(db, 'matches', id);
      const lastState = match.history[0];
      const newHistory = match.history.slice(1);

      await updateDoc(matchRef, {
        ...lastState,
        history: newHistory
      });
      toast.success('Last action undone');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${id}`);
      toast.error('Failed to undo');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFinishInnings = async () => {
    if (!match || !id) return;
    const isFirstInnings = (match.currentInnings || 1) === 1;
    
    try {
      const matchRef = doc(db, 'matches', id);
      if (isFirstInnings) {
        await updateDoc(matchRef, { 
          currentInnings: 2, 
          recentBalls: [],
          strikerId: null,
          nonStrikerId: null,
          strikerName: null,
          nonStrikerName: null,
          bowlerId: null,
          bowlerName: null
        });
        toast.success('First innings completed!');
      } else {
        const result = match.score1 > match.score2 
          ? `${match.team1Name} won by ${match.score1 - match.score2} runs`
          : match.score2 > match.score1
            ? `${match.team2Name} won by ${10 - match.wickets2} wickets`
            : 'Match Tied';
        
        await updateDoc(matchRef, { status: 'completed', result });
        toast.success('Match completed!');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${id}`);
    }
  };

  const onSelectPlayer = async (playerId: string, name: string, type: 'striker' | 'nonStriker' | 'bowler') => {
    if (!match || !id) return;

    try {
      const matchRef = doc(db, 'matches', id);
      const updates: any = {};
      
      if (type === 'striker') {
        updates.strikerId = playerId;
        updates.strikerName = name;
        setIsBatsmanSelectorOpen(false);
        if (!match.nonStrikerId) {
          setSelectorType('nonStriker');
          setIsBatsmanSelectorOpen(true);
        }
      } else if (type === 'nonStriker') {
        updates.nonStrikerId = playerId;
        updates.nonStrikerName = name;
        setIsBatsmanSelectorOpen(false);
      } else if (type === 'bowler') {
        updates.bowlerId = playerId;
        updates.bowlerName = name;
        setIsBowlerSelectorOpen(false);
      }

      await updateDoc(matchRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="animate-spin text-primary" size={64} />
      </div>
    );
  }

  if (!match) return null;

  const isFirstInnings = (match.currentInnings || 1) === 1;
  const currentScore = isFirstInnings ? match.score1 : match.score2;
  const currentWickets = isFirstInnings ? match.wickets1 : match.wickets2;
  const currentBalls = isFirstInnings ? match.balls1 : match.balls2;
  const currentTeam = isFirstInnings ? match.team1Name : match.team2Name;
  
  const overs = Math.floor(currentBalls / 6);
  const ballsInOver = currentBalls % 6;
  const runRate = currentBalls > 0 ? (currentScore / (currentBalls / 6)).toFixed(2) : '0.00';

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Match Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-6 rounded-3xl border border-muted/60 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex -space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border-4 border-background shadow-sm overflow-hidden font-bold text-xl">
              {match.team1Name.charAt(0)}
            </div>
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border-4 border-background shadow-sm overflow-hidden font-bold text-xl">
              {match.team2Name.charAt(0)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black tracking-tighter">{match.team1Name} vs {match.team2Name}</h1>
              {match.status === 'ongoing' && (
                <Badge variant="destructive" className="animate-pulse px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">Live</Badge>
              )}
              {match.status === 'completed' && (
                <Badge variant="success" className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">Finished</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
              <span className="flex items-center gap-1"><Trophy size={14} /> {match.matchType} Match</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{match.overs} Overs</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-muted hover:bg-muted/50" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={20} />
          </Button>
          {match.status !== 'completed' && (
            <Button className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20" onClick={handleFinishInnings}>
              {isFirstInnings ? 'End Innings' : 'Finish Match'}
            </Button>
          )}
        </div>
      </div>

      {/* Scoreboard Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Score Display */}
          <Card className="bg-primary text-primary-foreground border-none shadow-2xl shadow-primary/20 rounded-[2.5rem] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
            <CardContent className="p-10 relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                <div className="text-center md:text-left">
                  <div className="flex items-center gap-2 mb-3 opacity-80">
                    <Zap size={16} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">{currentTeam} Batting</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="text-8xl font-black tracking-tighter leading-none">{currentScore}</span>
                    <span className="text-4xl font-bold opacity-60">/ {currentWickets}</span>
                  </div>
                  <div className="mt-6 flex items-center gap-6">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Overs</div>
                      <div className="text-2xl font-bold">{overs}.{ballsInOver}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Run Rate</div>
                      <div className="text-2xl font-bold">{runRate}</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-6">
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-3">Recent Balls</div>
                    <div className="flex gap-2.5">
                      {(match.recentBalls || []).map((ball, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-transform hover:scale-110 cursor-default",
                            ball === 'W' ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/40" :
                            ball === '6' ? "bg-green-500 text-white shadow-lg shadow-green-500/40" :
                            ball === '4' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40" :
                            "bg-white/10 backdrop-blur-md border border-white/20"
                          )}
                        >
                          {ball}
                        </div>
                      ))}
                    </div>
                  </div>
                  {!isFirstInnings && (
                    <div className="bg-black/20 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Target size={16} className="text-primary-foreground/60" />
                        <span className="text-xs font-bold opacity-80 uppercase tracking-wider">Target:</span>
                        <span className="text-lg font-black">{match.score1 + 1}</span>
                      </div>
                      <div className="w-px h-4 bg-white/20" />
                      <div className="text-xs font-bold opacity-80 uppercase tracking-wider">
                        Need <span className="text-primary-foreground font-black">{match.score1 + 1 - match.score2}</span> from <span className="text-primary-foreground font-black">{(match.overs * 6) - match.balls2}</span> balls
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Current Players Display */}
              <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Batting</div>
                  <div className="space-y-3">
                    <div className={cn(
                      "flex items-center justify-between p-3 rounded-2xl border transition-all",
                      match.strikerId ? "bg-white/10 border-white/20" : "bg-white/5 border-dashed border-white/10"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs">
                          {match.strikerName?.charAt(0) || '?'}
                        </div>
                        <span className="font-bold text-sm">{match.strikerName || 'Select Striker'}</span>
                        {match.strikerId && <Badge className="bg-yellow-400 text-black text-[8px] h-4 px-1 font-black">*</Badge>}
                      </div>
                      {!match.strikerId && (
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => { setSelectorType('striker'); setIsBatsmanSelectorOpen(true); }}>Select</Button>
                      )}
                    </div>
                    <div className={cn(
                      "flex items-center justify-between p-3 rounded-2xl border transition-all",
                      match.nonStrikerId ? "bg-white/10 border-white/20" : "bg-white/5 border-dashed border-white/10"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs">
                          {match.nonStrikerName?.charAt(0) || '?'}
                        </div>
                        <span className="font-bold text-sm">{match.nonStrikerName || 'Select Non-Striker'}</span>
                      </div>
                      {!match.nonStrikerId && (
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => { setSelectorType('nonStriker'); setIsBatsmanSelectorOpen(true); }}>Select</Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Bowling</div>
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-2xl border transition-all",
                    match.bowlerId ? "bg-white/10 border-white/20" : "bg-white/5 border-dashed border-white/10"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs">
                        {match.bowlerName?.charAt(0) || '?'}
                      </div>
                      <span className="font-bold text-sm">{match.bowlerName || 'Select Bowler'}</span>
                    </div>
                    {!match.bowlerId && (
                      <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => setIsBowlerSelectorOpen(true)}>Select</Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scoring Controls */}
          {match.status !== 'completed' && (
            <Card className="rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
              <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black tracking-tight">Scoring Controls</CardTitle>
                  <CardDescription className="font-medium">Tap to update the scoreboard in real-time</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-2xl h-12 w-12 border-muted hover:bg-muted/50 text-muted-foreground"
                  onClick={undoScore}
                  disabled={isUpdating || !match.history || match.history.length === 0}
                >
                  <Undo size={20} />
                </Button>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                  {['0', '1', '2', '3', '4', '6', 'W'].map((val) => (
                    <Button
                      key={val}
                      variant={val === 'W' ? 'destructive' : 'outline'}
                      disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                      className={cn(
                        "h-20 rounded-3xl text-2xl font-black transition-all hover:scale-105 active:scale-95 border-2",
                        val === 'W' ? "shadow-lg shadow-destructive/20 border-destructive" : "border-muted/60 hover:border-primary hover:bg-primary/5"
                      )}
                      onClick={() => updateScore(val === 'W' ? 0 : Number(val), val === 'W')}
                    >
                      {val}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['Wide', 'No Ball', 'Byes', 'Leg Byes'].map((extra) => (
                    <Button 
                      key={extra} 
                      variant="secondary" 
                      disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                      className="h-14 rounded-2xl font-bold text-sm bg-muted/50 hover:bg-muted border border-muted/60"
                      onClick={() => updateScore(1, false, true)}
                    >
                      {extra}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {match.status === 'completed' && (
            <Card className="rounded-[2.5rem] border-primary/20 bg-primary/5 overflow-hidden">
              <div className="bg-primary p-8 text-center text-primary-foreground">
                <Trophy className="mx-auto mb-4" size={64} />
                <h2 className="text-4xl font-black tracking-tight mb-2">{match.result}</h2>
                <p className="text-primary-foreground/80 font-bold uppercase tracking-widest text-sm">Match Completed</p>
              </div>
              
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Top Batsmen</h3>
                    {(Object.values(match.playerStats || {}) as any[])
                      .sort((a, b) => b.runs - a.runs)
                      .slice(0, 3)
                      .map((p, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="font-bold">{p.name}</div>
                          <div className="font-black text-primary">{p.runs} <span className="text-[10px] text-muted-foreground font-bold">({p.balls})</span></div>
                        </div>
                      ))
                    }
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Top Bowlers</h3>
                    {(Object.values(match.playerStats || {}) as any[])
                      .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
                      .slice(0, 3)
                      .map((p, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="font-bold">{p.name}</div>
                          <div className="font-black text-secondary-foreground">{p.wickets} <span className="text-[10px] text-muted-foreground font-bold">({p.runsConceded})</span></div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <Button 
                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest"
                    onClick={() => navigate('/')}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-8">
          {/* Summary */}
          <Card className="rounded-[2rem] border-muted/60 shadow-sm overflow-hidden">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Match Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted/40">
                <div className="font-bold">{match.team1Name}</div>
                <div className="font-black">{match.score1}/{match.wickets1} ({Math.floor(match.balls1/6)}.{match.balls1%6})</div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted/40">
                <div className="font-bold">{match.team2Name}</div>
                <div className="font-black">{match.score2}/{match.wickets2} ({Math.floor(match.balls2/6)}.{match.balls2%6})</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Match Settings"
        description="Adjust match parameters and scoring rules."
      >
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matchType" className="text-xs font-black uppercase tracking-widest">Match Type</Label>
              <Input id="matchType" value={match.matchType} readOnly className="h-12 rounded-xl bg-muted/20" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overs" className="text-xs font-black uppercase tracking-widest">Total Overs</Label>
              <Input id="overs" type="number" value={match.overs} readOnly className="h-12 rounded-xl bg-muted/20" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsSettingsOpen(false)}>Close</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isBatsmanSelectorOpen}
        onClose={() => setIsBatsmanSelectorOpen(false)}
        title={`Select ${selectorType === 'striker' ? 'Striker' : 'Non-Striker'}`}
        description="Choose the next batsman to take the field."
      >
        <div className="grid grid-cols-1 gap-3 pt-4 max-h-[400px] overflow-y-auto">
          {battingPlayers
            .filter(p => p.id !== match.strikerId && p.id !== match.nonStrikerId)
            .map(player => (
              <Button 
                key={player.id} 
                variant="outline" 
                className="h-16 rounded-2xl justify-start px-6 gap-4 border-muted hover:border-primary hover:bg-primary/5"
                onClick={() => onSelectPlayer(player.id, player.name, selectorType as 'striker' | 'nonStriker')}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden">
                  {player.photo ? (
                    <img src={player.photo} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    player.name.charAt(0)
                  )}
                </div>
                <div className="text-left">
                  <div className="font-bold">{player.name}</div>
                  <div className="text-[10px] uppercase font-black text-muted-foreground">{player.role}</div>
                </div>
              </Button>
            ))}
          {battingPlayers.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No players found for this team.</div>
          )}
        </div>
      </Dialog>

      <Dialog
        isOpen={isBowlerSelectorOpen}
        onClose={() => setIsBowlerSelectorOpen(false)}
        title="Select Next Bowler"
        description="Choose the bowler for the next over."
      >
        <div className="grid grid-cols-1 gap-3 pt-4 max-h-[400px] overflow-y-auto">
          {bowlingPlayers
            .filter(p => p.id !== match.bowlerId)
            .map(player => (
              <Button 
                key={player.id} 
                variant="outline" 
                className="h-16 rounded-2xl justify-start px-6 gap-4 border-muted hover:border-primary hover:bg-primary/5"
                onClick={() => onSelectPlayer(player.id, player.name, 'bowler')}
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/20 text-secondary-foreground flex items-center justify-center font-bold overflow-hidden">
                  {player.photo ? (
                    <img src={player.photo} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    player.name.charAt(0)
                  )}
                </div>
                <div className="text-left">
                  <div className="font-bold">{player.name}</div>
                  <div className="text-[10px] uppercase font-black text-muted-foreground">{player.role}</div>
                </div>
              </Button>
            ))}
          {bowlingPlayers.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No players found for this team.</div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
