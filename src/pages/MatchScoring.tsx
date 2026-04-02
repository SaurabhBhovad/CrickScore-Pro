import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Dialog } from '@/src/components/ui/Dialog';
import { Label } from '@/src/components/ui/Label';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { Trophy, Undo, History, Settings, User, Activity, Info, ChevronRight, Share2, MoreVertical, Zap, Target, Loader2, PlusCircle, Award } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { db, doc, onSnapshot, updateDoc, handleFirestoreError, OperationType, collection, query, where, increment, writeBatch, setDoc } from '../firebase';
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
      isOut?: boolean;
    }
  };
  statsUpdated?: boolean;
}

interface Player {
  id: string;
  name: string;
  role: string;
  teamId: string;
  photo?: string;
}

export default function MatchScoring() {
  const { user } = useFirebase();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDetailedBallOpen, setIsDetailedBallOpen] = useState(false);
  const [isInitialSelectionOpen, setIsInitialSelectionOpen] = useState(false);
  const [initialSelectionData, setInitialSelectionData] = useState({
    strikerId: '',
    nonStrikerId: '',
    bowlerId: ''
  });
  const [detailedBallData, setDetailedBallData] = useState({
    runs: 0,
    extraType: 'none' as 'none' | 'wide' | 'noball' | 'bye' | 'legbye',
    extraRuns: 0,
    isWicket: false,
    wicketType: 'bowled',
    strikerId: '',
    nonStrikerId: '',
    bowlerId: ''
  });

  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  useEffect(() => {
    if (match) {
      setDetailedBallData(prev => ({
        ...prev,
        strikerId: match.strikerId || '',
        nonStrikerId: match.nonStrikerId || '',
        bowlerId: match.bowlerId || ''
      }));
    }
  }, [match?.strikerId, match?.nonStrikerId, match?.bowlerId]);

  const handleDetailedBallSubmit = async () => {
    if (!match || !id) return;
    
    // Calculate total runs for the ball
    // For Wide/No Ball, penalty is 1 + extraRuns
    // For Bye/Leg Bye, total runs is extraRuns (runs off bat is 0)
    let totalRuns = 0;
    if (detailedBallData.extraType === 'wide' || detailedBallData.extraType === 'noball') {
      totalRuns = 1 + detailedBallData.extraRuns;
    } else if (detailedBallData.extraType === 'bye' || detailedBallData.extraType === 'legbye') {
      totalRuns = detailedBallData.extraRuns;
    } else {
      totalRuns = detailedBallData.runs;
    }

    // Update striker/bowler if they were changed in the dialog
    if (detailedBallData.strikerId !== match.strikerId || 
        detailedBallData.nonStrikerId !== match.nonStrikerId || 
        detailedBallData.bowlerId !== match.bowlerId) {
      
      const matchRef = doc(db, 'matches', id);
      const striker = battingPlayers.find(p => p.id === detailedBallData.strikerId);
      const nonStriker = battingPlayers.find(p => p.id === detailedBallData.nonStrikerId);
      const bowler = bowlingPlayers.find(p => p.id === detailedBallData.bowlerId);
      
      await updateDoc(matchRef, JSON.parse(JSON.stringify({
        strikerId: detailedBallData.strikerId,
        strikerName: striker?.name || match.strikerName,
        nonStrikerId: detailedBallData.nonStrikerId,
        nonStrikerName: nonStriker?.name || match.nonStrikerName,
        bowlerId: detailedBallData.bowlerId,
        bowlerName: bowler?.name || match.bowlerName
      })));
    }

    await updateScore(
      totalRuns, 
      detailedBallData.isWicket, 
      detailedBallData.extraType, 
      detailedBallData.isWicket ? detailedBallData.wicketType : 'none'
    );
    
    setIsDetailedBallOpen(false);
  };
  const [isBatsmanSelectorOpen, setIsBatsmanSelectorOpen] = useState(false);
  const [isBowlerSelectorOpen, setIsBowlerSelectorOpen] = useState(false);
  const [battingPlayers, setBattingPlayers] = useState<Player[]>([]);
  const [bowlingPlayers, setBowlingPlayers] = useState<Player[]>([]);
  const [selectorType, setSelectorType] = useState<'striker' | 'nonStriker' | 'bowler'>('striker');
  const lastInningsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!match || !user) return;

    // Clear old players to prevent stale data during transition
    setBattingPlayers([]);
    setBowlingPlayers([]);

    const battingTeamId = match.currentInnings === 1 ? match.team1Id : match.team2Id;
    const bowlingTeamId = match.currentInnings === 1 ? match.team2Id : match.team1Id;

    const battingPlayersQuery = query(collection(db, 'players'), where('teamId', '==', battingTeamId), where('ownerId', '==', user.uid));
    const unsubBatting = onSnapshot(battingPlayersQuery, (snapshot) => {
      setBattingPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    });

    const bowlingPlayersQuery = query(collection(db, 'players'), where('teamId', '==', bowlingTeamId), where('ownerId', '==', user.uid));
    const unsubBowling = onSnapshot(bowlingPlayersQuery, (snapshot) => {
      setBowlingPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    });

    return () => {
      unsubBatting();
      unsubBowling();
    };
  }, [match?.team1Id, match?.team2Id, match?.currentInnings, user]);

  useEffect(() => {
    if (!match || match.status === 'completed') return;

    // Initial player selection if not set
    if (!match.strikerId || !match.nonStrikerId || !match.bowlerId) {
      // Only open if we have players loaded
      if (battingPlayers.length > 0 && bowlingPlayers.length > 0) {
        if (lastInningsRef.current !== match.currentInnings) {
          setInitialSelectionData({ strikerId: '', nonStrikerId: '', bowlerId: '' });
          lastInningsRef.current = match.currentInnings;
        }
        setIsInitialSelectionOpen(true);
      }
    }
  }, [match?.id, match?.status, match?.strikerId, match?.nonStrikerId, match?.bowlerId, match?.currentInnings, battingPlayers.length, bowlingPlayers.length]);

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

  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isExtraDialogOpen, setIsExtraDialogOpen] = useState(false);
  const [pendingExtraType, setPendingExtraType] = useState<'wide' | 'noball' | 'bye' | 'legbye'>('wide');

  const updateScore = async (runs: number, isWicket: boolean = false, extraType: 'wide' | 'noball' | 'bye' | 'legbye' | 'none' = 'none', wicketType: string = 'bowled') => {
    if (!match || !id || isUpdating) return;

    setIsUpdating(true);
    try {
      const matchRef = doc(db, 'matches', id);
      const isFirstInnings = (match.currentInnings || 1) === 1;
      const isLegalBall = extraType !== 'wide' && extraType !== 'noball';
      
      // Save current state to history for undo
      const previousPlayerStats = JSON.parse(JSON.stringify(match.playerStats || {}));
      const currentState = {
        score1: match.score1 || 0,
        wickets1: match.wickets1 || 0,
        balls1: match.balls1 || 0,
        score2: match.score2 || 0,
        wickets2: match.wickets2 || 0,
        balls2: match.balls2 || 0,
        currentInnings: match.currentInnings || 1,
        recentBalls: [...(match.recentBalls || [])],
        status: match.status || 'ongoing',
        result: match.result || null,
        strikerId: match.strikerId || null,
        nonStrikerId: match.nonStrikerId || null,
        bowlerId: match.bowlerId || null,
        strikerName: match.strikerName || null,
        nonStrikerName: match.nonStrikerName || null,
        bowlerName: match.bowlerName || null,
        playerStats: previousPlayerStats
      };

      const newHistory = JSON.parse(JSON.stringify([currentState, ...(match.history || [])].slice(0, 10)));
      
      const updates: any = {
        status: 'ongoing',
        history: newHistory,
        playerStats: JSON.parse(JSON.stringify(previousPlayerStats))
      };

      // Ensure striker and bowler are in playerStats and have all fields
      if (match.strikerId) {
        if (!updates.playerStats[match.strikerId]) {
          updates.playerStats[match.strikerId] = { name: match.strikerName || 'Unknown', runs: 0, balls: 0, wickets: 0, runsConceded: 0, ballsBowled: 0, isOut: false };
        } else {
          const s = updates.playerStats[match.strikerId];
          s.runs = s.runs || 0;
          s.balls = s.balls || 0;
          s.wickets = s.wickets || 0;
          s.runsConceded = s.runsConceded || 0;
          s.ballsBowled = s.ballsBowled || 0;
          s.isOut = s.isOut || false;
        }
      }
      
      if (match.bowlerId) {
        if (!updates.playerStats[match.bowlerId]) {
          updates.playerStats[match.bowlerId] = { name: match.bowlerName || 'Unknown', runs: 0, balls: 0, wickets: 0, runsConceded: 0, ballsBowled: 0, isOut: false };
        } else {
          const b = updates.playerStats[match.bowlerId];
          b.runs = b.runs || 0;
          b.balls = b.balls || 0;
          b.wickets = b.wickets || 0;
          b.runsConceded = b.runsConceded || 0;
          b.ballsBowled = b.ballsBowled || 0;
          b.isOut = b.isOut || false;
        }
      }

      // Update player stats
      if (match.strikerId) {
        const s = updates.playerStats[match.strikerId];
        // Batsman gets runs if it's not a Wide/Bye/Leg Bye
        if (extraType === 'none') {
          s.runs += runs;
        } else if (extraType === 'noball') {
          // For No Ball, batsman only gets runs scored off the bat (total runs - 1 penalty)
          s.runs += Math.max(0, runs - 1);
        }
        
        // Batsman faces a ball if it's not a Wide
        if (extraType !== 'wide') {
          s.balls += 1;
        }

        if (isWicket) {
          s.isOut = true;
        }
      }

      if (match.bowlerId) {
        const b = updates.playerStats[match.bowlerId];
        // Bowler concedes runs for everything except Byes and Leg Byes
        if (extraType !== 'bye' && extraType !== 'legbye') {
          b.runsConceded += runs;
        }
        
        // Bowler bowls a legal ball if it's not a Wide or No Ball
        if (isLegalBall) {
          b.ballsBowled += 1;
        }
        
        if (isWicket && wicketType !== 'runout') {
          b.wickets += 1;
        }
      }

      const ballLabel = isWicket ? 'W' : extraType === 'wide' ? 'Wd' : extraType === 'noball' ? 'Nb' : runs.toString();
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

      // Rotate strike on odd runs (only if not a wicket)
      // For extras (Wide/No Ball), we only rotate if the runs scored by running are odd
      const actualRunsRun = (extraType === 'wide' || extraType === 'noball') ? runs - 1 : runs;
      if (actualRunsRun % 2 !== 0 && !isWicket) {
        [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
        [newStrikerName, newNonStrikerName] = [newNonStrikerName, newStrikerName];
      }

      updates.strikerId = newStrikerId || null;
      updates.strikerName = newStrikerName || null;
      updates.nonStrikerId = newNonStrikerId || null;
      updates.nonStrikerName = newNonStrikerName || null;

      if (isFirstInnings) {
        updates.score1 = (match.score1 || 0) + runs;
        updates.wickets1 = (match.wickets1 || 0) + (isWicket ? 1 : 0);
        updates.balls1 = (match.balls1 || 0) + (isLegalBall ? 1 : 0);
        
        ballsAfterUpdate = updates.balls1;
        wicketsAfterUpdate = updates.wickets1;
        scoreAfterUpdate = updates.score1;

        const isAllOut = wicketsAfterUpdate >= 10 || (battingPlayers.length > 0 && wicketsAfterUpdate >= battingPlayers.length - 1);

        // Auto finish first innings
        if (ballsAfterUpdate >= match.overs * 6 || isAllOut) {
          updates.currentInnings = 2;
          updates.recentBalls = [];
          updates.strikerId = null;
          updates.nonStrikerId = null;
          updates.strikerName = null;
          updates.nonStrikerName = null;
          updates.bowlerId = null;
          updates.bowlerName = null;
          
          if (isAllOut) {
            toast.error(`${match.team1Name} All Out!`, { duration: 5000 });
          }
          toast.success('First innings completed automatically!');
        } else {
          // Check for next batsman or bowler
          if (isWicket) {
            updates.strikerId = null;
            updates.strikerName = null;
            setIsBatsmanSelectorOpen(true);
            setSelectorType('striker');
          }
          
          if (isLegalBall && ballsAfterUpdate % 6 === 0 && ballsAfterUpdate > 0) {
            // End of over
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

            // If a wicket just fell on the last ball, we need to adjust the selector
            if (isWicket) {
              // The non-striker (who was just swapped to striker) is now the striker.
              // We need to select a new NON-STRIKER.
              setSelectorType('nonStriker');
            }
          }
        }
      } else {
        updates.score2 = (match.score2 || 0) + runs;
        updates.wickets2 = (match.wickets2 || 0) + (isWicket ? 1 : 0);
        updates.balls2 = (match.balls2 || 0) + (isLegalBall ? 1 : 0);

        ballsAfterUpdate = updates.balls2;
        wicketsAfterUpdate = updates.wickets2;
        scoreAfterUpdate = updates.score2;

        const isAllOut = wicketsAfterUpdate >= 10 || (battingPlayers.length > 0 && wicketsAfterUpdate >= battingPlayers.length - 1);

        // Auto finish match
        const target = match.score1 + 1;
        if (scoreAfterUpdate >= target) {
          updates.status = 'completed';
          const wicketsLeft = battingPlayers.length - wicketsAfterUpdate;
          updates.result = `${match.team2Name} won by ${wicketsLeft} wickets`;
          toast.success('Match completed!');
          await updateCareerStats({ ...match, ...updates });
        } else if (ballsAfterUpdate >= match.overs * 6 || isAllOut) {
          updates.status = 'completed';
          updates.result = scoreAfterUpdate === match.score1 
            ? 'Match Tied' 
            : `${match.team1Name} won by ${match.score1 - scoreAfterUpdate} runs`;
          
          if (isAllOut) {
            toast.error(`${match.team2Name} All Out!`, { duration: 5000 });
          }
          toast.success('Match completed!');
          await updateCareerStats({ ...match, ...updates });
        } else {
          // Check for next batsman or bowler
          if (isWicket) {
            updates.strikerId = null;
            updates.strikerName = null;
            setIsBatsmanSelectorOpen(true);
            setSelectorType('striker');
          }
          
          if (isLegalBall && ballsAfterUpdate % 6 === 0 && ballsAfterUpdate > 0) {
            // End of over
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

            // If a wicket just fell on the last ball, we need to adjust the selector
            if (isWicket) {
              setSelectorType('nonStriker');
            }
          }
        }
      }

      await updateDoc(matchRef, JSON.parse(JSON.stringify(updates)));
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

      await updateDoc(matchRef, JSON.parse(JSON.stringify({
        ...lastState,
        history: newHistory
      })));
      toast.success('Last action undone');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${id}`);
      toast.error('Failed to undo');
    } finally {
      setIsUpdating(false);
    }
  };

  const updateCareerStats = async (matchData: Match) => {
    if (!matchData.playerStats || matchData.statsUpdated || !id) return;

    try {
      const batch = writeBatch(db);
      const matchRef = doc(db, 'matches', id);
      const playerIds = Object.keys(matchData.playerStats);
      
      for (const playerId of playerIds) {
        const stats = matchData.playerStats[playerId];
        const playerRef = doc(db, 'players', playerId);
        
        batch.update(playerRef, {
          'stats.matches': increment(1),
          'stats.runs': increment(stats.runs || 0),
          'stats.balls': increment(stats.balls || 0),
          'stats.wickets': increment(stats.wickets || 0),
          'stats.runsConceded': increment(stats.runsConceded || 0),
          'stats.ballsBowled': increment(stats.ballsBowled || 0),
        });
      }

      // Update team stats
      const team1Ref = doc(db, 'teams', matchData.team1Id);
      const team2Ref = doc(db, 'teams', matchData.team2Id);

      const isDraw = matchData.score1 === matchData.score2;
      const team1Won = matchData.score1 > matchData.score2;

      batch.update(team1Ref, {
        'stats.played': increment(1),
        'stats.won': increment(team1Won ? 1 : 0),
        'stats.lost': increment(!team1Won && !isDraw ? 1 : 0),
        'stats.points': increment(team1Won ? 2 : isDraw ? 1 : 0)
      });

      batch.update(team2Ref, {
        'stats.played': increment(1),
        'stats.won': increment(!team1Won && !isDraw ? 1 : 0),
        'stats.lost': increment(team1Won ? 1 : 0),
        'stats.points': increment(!team1Won && !isDraw ? 2 : isDraw ? 1 : 0)
      });

      // Mark stats as updated in the match document
      batch.update(matchRef, { statsUpdated: true });

      await batch.commit();
    } catch (error) {
      console.error('Failed to update career stats:', error);
    }
  };

  const handleFinishInnings = async () => {
    if (!match || !id) return;
    const isFirstInnings = (match.currentInnings || 1) === 1;
    
    try {
      const matchRef = doc(db, 'matches', id);
      if (isFirstInnings) {
        await updateDoc(matchRef, JSON.parse(JSON.stringify({ 
          currentInnings: 2, 
          recentBalls: [],
          strikerId: null,
          nonStrikerId: null,
          strikerName: null,
          nonStrikerName: null,
          bowlerId: null,
          bowlerName: null
        })));
        toast.success('First innings completed!');
      } else {
        const wicketsLeft = battingPlayers.length - match.wickets2;
        const result = match.score1 > match.score2 
          ? `${match.team1Name} won by ${match.score1 - match.score2} runs`
          : match.score2 > match.score1
            ? `${match.team2Name} won by ${wicketsLeft} wickets`
            : 'Match Tied';
        
        await updateDoc(matchRef, JSON.parse(JSON.stringify({ status: 'completed', result })));
        await updateCareerStats(match);
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

      await updateDoc(matchRef, JSON.parse(JSON.stringify(updates)));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${id}`);
    }
  };

  const handleInitialSelectionSubmit = async () => {
    if (!match || !id) return;
    const { strikerId, nonStrikerId, bowlerId } = initialSelectionData;
    
    if (!strikerId || !nonStrikerId || !bowlerId) {
      toast.error('Please select all players');
      return;
    }

    if (strikerId === nonStrikerId) {
      toast.error('Striker and Non-Striker must be different');
      return;
    }

    try {
      const matchRef = doc(db, 'matches', id);
      const striker = battingPlayers.find(p => p.id === strikerId);
      const nonStriker = battingPlayers.find(p => p.id === nonStrikerId);
      const bowler = bowlingPlayers.find(p => p.id === bowlerId);

      await updateDoc(matchRef, JSON.parse(JSON.stringify({
        strikerId,
        strikerName: striker?.name,
        nonStrikerId,
        nonStrikerName: nonStriker?.name,
        bowlerId,
        bowlerName: bowler?.name,
        status: 'ongoing'
      })));
      
      setIsInitialSelectionOpen(false);
      toast.success('Match started!');
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
                <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                  {['0', '1', '2', '3', '4', '6', 'W'].map((val) => (
                    <Button
                      key={val}
                      variant={val === 'W' ? 'destructive' : 'outline'}
                      disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                      className={cn(
                        "h-20 rounded-3xl text-2xl font-black transition-all hover:scale-105 active:scale-95 border-2",
                        val === 'W' ? "shadow-lg shadow-destructive/20 border-destructive" : "border-muted/60 hover:border-primary hover:bg-primary/5"
                      )}
                      onClick={() => {
                        if (val === 'W') {
                          setIsWicketDialogOpen(true);
                        } else {
                          updateScore(Number(val));
                        }
                      }}
                    >
                      {val}
                    </Button>
                  ))}
                  <Button
                    variant="secondary"
                    disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                    className="h-20 rounded-3xl flex flex-col items-center justify-center gap-1 border-2 border-muted/60 hover:border-primary hover:bg-primary/5 transition-all hover:scale-105 active:scale-95"
                    onClick={() => setIsDetailedBallOpen(true)}
                  >
                    <PlusCircle size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Detail</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="secondary" 
                    disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                    className="h-14 rounded-2xl font-bold text-sm bg-muted/50 hover:bg-muted border border-muted/60"
                    onClick={() => { setPendingExtraType('wide'); setIsExtraDialogOpen(true); }}
                  >
                    Wide
                  </Button>
                  <Button 
                    variant="secondary" 
                    disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                    className="h-14 rounded-2xl font-bold text-sm bg-muted/50 hover:bg-muted border border-muted/60"
                    onClick={() => { setPendingExtraType('noball'); setIsExtraDialogOpen(true); }}
                  >
                    No Ball
                  </Button>
                  <Button 
                    variant="secondary" 
                    disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                    className="h-14 rounded-2xl font-bold text-sm bg-muted/50 hover:bg-muted border border-muted/60"
                    onClick={() => { setPendingExtraType('bye'); setIsExtraDialogOpen(true); }}
                  >
                    Byes
                  </Button>
                  <Button 
                    variant="secondary" 
                    disabled={isUpdating || !match.strikerId || !match.nonStrikerId || !match.bowlerId}
                    className="h-14 rounded-2xl font-bold text-sm bg-muted/50 hover:bg-muted border border-muted/60"
                    onClick={() => { setPendingExtraType('legbye'); setIsExtraDialogOpen(true); }}
                  >
                    Leg Byes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dialogs */}
          <Dialog
            isOpen={isInitialSelectionOpen}
            onClose={() => {}} // Prevent closing without selection
            title="Start Innings"
            description="Select the opening batsmen and the first bowler."
          >
            <div className="space-y-6 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Striker</Label>
                  <Select 
                    value={initialSelectionData.strikerId} 
                    onChange={(e) => setInitialSelectionData(prev => ({ ...prev, strikerId: e.target.value }))}
                    className="h-12 rounded-xl"
                  >
                    <option value="">Select Striker</option>
                    {battingPlayers
                      .filter(p => p.id !== initialSelectionData.nonStrikerId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Non-Striker</Label>
                  <Select 
                    value={initialSelectionData.nonStrikerId} 
                    onChange={(e) => setInitialSelectionData(prev => ({ ...prev, nonStrikerId: e.target.value }))}
                    className="h-12 rounded-xl"
                  >
                    <option value="">Select Non-Striker</option>
                    {battingPlayers
                      .filter(p => p.id !== initialSelectionData.strikerId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Opening Bowler</Label>
                  <Select 
                    value={initialSelectionData.bowlerId} 
                    onChange={(e) => setInitialSelectionData(prev => ({ ...prev, bowlerId: e.target.value }))}
                    className="h-12 rounded-xl"
                  >
                    <option value="">Select Bowler</option>
                    {bowlingPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <Button 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                onClick={handleInitialSelectionSubmit}
              >
                Start Match
              </Button>
            </div>
          </Dialog>

          <Dialog
            isOpen={isDetailedBallOpen}
            onClose={() => setIsDetailedBallOpen(false)}
            title="Detailed Ball Entry"
            description="Record all details for this ball at once."
          >
            <div className="space-y-6 pt-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Runs off Bat</Label>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4, 6].map(r => (
                      <Button
                        key={r}
                        variant={detailedBallData.runs === r ? 'default' : 'outline'}
                        className={cn("flex-1 h-10 rounded-xl font-bold", detailedBallData.runs === r && "bg-primary text-primary-foreground")}
                        onClick={() => setDetailedBallData(prev => ({ ...prev, runs: r, extraType: prev.extraType === 'wide' || prev.extraType === 'noball' ? prev.extraType : 'none' }))}
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Extras</Label>
                  <div className="flex flex-wrap gap-2">
                    {['none', 'wide', 'noball', 'bye', 'legbye'].map(type => (
                      <Button
                        key={type}
                        variant={detailedBallData.extraType === type ? 'default' : 'outline'}
                        className={cn("h-10 rounded-xl font-bold px-3 capitalize", detailedBallData.extraType === type && "bg-primary text-primary-foreground")}
                        onClick={() => setDetailedBallData(prev => ({ ...prev, extraType: type as any }))}
                      >
                        {type === 'none' ? 'None' : type}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {detailedBallData.extraType !== 'none' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Extra Runs (excluding penalty)</Label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map(r => (
                      <Button
                        key={r}
                        variant={detailedBallData.extraRuns === r ? 'default' : 'outline'}
                        className={cn("flex-1 h-10 rounded-xl font-bold", detailedBallData.extraRuns === r && "bg-primary text-primary-foreground")}
                        onClick={() => setDetailedBallData(prev => ({ ...prev, extraRuns: r }))}
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted/40">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black", detailedBallData.isWicket ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground")}>
                    W
                  </div>
                  <div>
                    <div className="font-bold">Wicket?</div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Is the batsman out?</div>
                  </div>
                </div>
                <Button
                  variant={detailedBallData.isWicket ? 'destructive' : 'outline'}
                  className="rounded-xl font-bold"
                  onClick={() => setDetailedBallData(prev => ({ ...prev, isWicket: !prev.isWicket }))}
                >
                  {detailedBallData.isWicket ? 'Yes, Out' : 'No'}
                </Button>
              </div>

              {detailedBallData.isWicket && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Dismissal Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket'].map(type => (
                      <Button
                        key={type}
                        variant={detailedBallData.wicketType === type.toLowerCase().replace(' ', '') ? 'default' : 'outline'}
                        className={cn("h-10 rounded-xl font-bold text-xs", detailedBallData.wicketType === type.toLowerCase().replace(' ', '') && "bg-primary text-primary-foreground")}
                        onClick={() => setDetailedBallData(prev => ({ ...prev, wicketType: type.toLowerCase().replace(' ', '') }))}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-muted/60">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Striker</Label>
                    <Select 
                      value={detailedBallData.strikerId} 
                      onChange={(e) => setDetailedBallData(prev => ({ ...prev, strikerId: e.target.value }))}
                      className="h-12 rounded-xl"
                    >
                      {battingPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Non-Striker</Label>
                    <Select 
                      value={detailedBallData.nonStrikerId} 
                      onChange={(e) => setDetailedBallData(prev => ({ ...prev, nonStrikerId: e.target.value }))}
                      className="h-12 rounded-xl"
                    >
                      {battingPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Bowler</Label>
                  <Select 
                    value={detailedBallData.bowlerId} 
                    onChange={(e) => setDetailedBallData(prev => ({ ...prev, bowlerId: e.target.value }))}
                    className="h-12 rounded-xl"
                  >
                    {bowlingPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsDetailedBallOpen(false)}>Cancel</Button>
                <Button className="flex-1 h-12 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleDetailedBallSubmit}>Record Ball</Button>
              </div>
            </div>
          </Dialog>

          <Dialog
            isOpen={isWicketDialogOpen}
            onClose={() => setIsWicketDialogOpen(false)}
            title="Wicket Type"
            description="Select how the batsman was dismissed."
          >
            <div className="grid grid-cols-2 gap-3 py-4">
              {['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket'].map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  className="h-12 font-bold"
                  onClick={() => {
                    updateScore(0, true, 'none', type.toLowerCase().replace(' ', ''));
                    setIsWicketDialogOpen(false);
                  }}
                >
                  {type}
                </Button>
              ))}
            </div>
          </Dialog>

          <Dialog
            isOpen={isExtraDialogOpen}
            onClose={() => setIsExtraDialogOpen(false)}
            title={`${pendingExtraType.charAt(0).toUpperCase() + pendingExtraType.slice(1)} Runs`}
            description="How many additional runs were scored?"
          >
            <div className="grid grid-cols-3 gap-3 py-4">
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <Button
                  key={r}
                  variant="outline"
                  className="h-12 font-bold"
                  onClick={() => {
                    const totalRuns = (pendingExtraType === 'wide' || pendingExtraType === 'noball') ? r + 1 : r;
                    updateScore(totalRuns, false, pendingExtraType);
                    setIsExtraDialogOpen(false);
                  }}
                >
                  {r === 0 ? 'Just Penalty' : `+ ${r} Runs`}
                </Button>
              ))}
            </div>
          </Dialog>

          {match.status === 'completed' && (
            <div className="space-y-6">
              <Card className="rounded-[2.5rem] border-primary/20 bg-primary/5 overflow-hidden shadow-2xl">
                <div className="bg-primary p-10 text-center text-primary-foreground relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <Trophy className="absolute -top-10 -left-10 w-40 h-40" />
                    <Activity className="absolute -bottom-10 -right-10 w-40 h-40" />
                  </div>
                  <Trophy className="mx-auto mb-6 relative z-10" size={80} />
                  <h2 className="text-4xl font-black tracking-tight mb-3 relative z-10">{match.result}</h2>
                  <p className="text-primary-foreground/80 font-black uppercase tracking-[0.2em] text-sm relative z-10">Match Completed</p>
                </div>
                
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2 flex items-center gap-2">
                        <Award size={14} className="text-primary" />
                        Top Batsmen
                      </h3>
                      {(Object.values(match.playerStats || {}) as any[])
                        .sort((a, b) => b.runs - a.runs)
                        .slice(0, 3)
                        .map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-muted/40">
                            <div className="font-bold text-sm">{p.name}</div>
                            <div className="font-black text-primary">{p.runs} <span className="text-[10px] text-muted-foreground font-bold ml-1">({p.balls})</span></div>
                          </div>
                        ))
                      }
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2 flex items-center gap-2">
                        <Activity size={14} className="text-secondary-foreground" />
                        Top Bowlers
                      </h3>
                      {(Object.values(match.playerStats || {}) as any[])
                        .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
                        .slice(0, 3)
                        .map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-muted/40">
                            <div className="font-bold text-sm">{p.name}</div>
                            <div className="font-black text-secondary-foreground">{p.wickets} <span className="text-[10px] text-muted-foreground font-bold ml-1">({p.runsConceded})</span></div>
                          </div>
                        ))
                      }
                    </div>
                  </div>

                  <div className="pt-6 grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline"
                      className="h-14 rounded-2xl font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5"
                      onClick={() => setIsScorecardOpen(true)}
                    >
                      View Scorecard
                    </Button>
                    <Button 
                      className="h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                      onClick={() => navigate('/')}
                    >
                      Back to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Dialog
                isOpen={isScorecardOpen}
                onClose={() => setIsScorecardOpen(false)}
                title="Match Scorecard"
                description="Detailed statistics for all players in this match."
                className="max-w-4xl"
              >
                <div className="py-4">
                  <Scorecard match={match} />
                </div>
              </Dialog>
            </div>
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
          
          {match.balls1 === 0 && match.currentInnings === 1 && (
            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                onClick={async () => {
                  const matchRef = doc(db, 'matches', id!);
                  await updateDoc(matchRef, JSON.parse(JSON.stringify({
                    team1Id: match.team2Id,
                    team2Id: match.team1Id,
                    team1Name: match.team2Name,
                    team2Name: match.team1Name,
                    strikerId: null,
                    nonStrikerId: null,
                    bowlerId: null,
                    strikerName: null,
                    nonStrikerName: null,
                    bowlerName: null
                  })));
                  toast.success('Batting order swapped!');
                  setIsSettingsOpen(false);
                }}
              >
                <Activity size={18} />
                Swap Batting Order
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center font-medium">Available only before the first ball is bowled.</p>
            </div>
          )}

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
            .filter(p => p.id !== match.strikerId && p.id !== match.nonStrikerId && !match.playerStats?.[p.id]?.isOut)
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
            <div className="text-center py-10 space-y-4">
              <div className="text-muted-foreground font-medium">No players found for this team.</div>
              <Button 
                variant="outline" 
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
                onClick={async () => {
                  const name = prompt('Enter player name:');
                  if (name) {
                    const battingTeamId = match.currentInnings === 1 ? match.team1Id : match.team2Id;
                    const playerRef = doc(collection(db, 'players'));
                    await setDoc(playerRef, {
                      id: playerRef.id,
                      name,
                      teamId: battingTeamId,
                      ownerId: user.uid,
                      role: 'Batsman',
                      stats: { 
                        matches: 0, 
                        runs: 0, 
                        balls: 0, 
                        wickets: 0, 
                        runsConceded: 0, 
                        ballsBowled: 0,
                        highestScore: 0,
                        average: 0,
                        strikeRate: 0
                      }
                    });
                    toast.success('Player added!');
                  }
                }}
              >
                <PlusCircle size={18} />
                Quick Add Player
              </Button>
            </div>
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
            <div className="text-center py-10 space-y-4">
              <div className="text-muted-foreground font-medium">No players found for this team.</div>
              <Button 
                variant="outline" 
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
                onClick={async () => {
                  const name = prompt('Enter player name:');
                  if (name) {
                    const bowlingTeamId = match.currentInnings === 1 ? match.team2Id : match.team1Id;
                    const playerRef = doc(collection(db, 'players'));
                    await setDoc(playerRef, {
                      id: playerRef.id,
                      name,
                      teamId: bowlingTeamId,
                      ownerId: user.uid,
                      role: 'Bowler',
                      stats: { 
                        matches: 0, 
                        runs: 0, 
                        balls: 0, 
                        wickets: 0, 
                        runsConceded: 0, 
                        ballsBowled: 0,
                        highestScore: 0,
                        average: 0,
                        strikeRate: 0
                      }
                    });
                    toast.success('Player added!');
                  }
                }}
              >
                <PlusCircle size={18} />
                Quick Add Player
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
