'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { GamePhase, Question, BuzzerEntry, Player } from '@/types';

export default function PlayerPage() {
  const {
    socket,
    gameState,
    connected,
    joinRoom,
    pressBuzzer,
    submitAnswer,
    submitQualificationAnswer,
    nextQualificationQuestion,
    submitWarmupAnswer,
    activateStar,
    onBuzzerPressed,
    onTimerUpdate,
    onAnswerResult,
    onQualificationResult,
    onQualificationStart,
    onWarmupStart,
    onWarmupAnswerResult,
    onWarmupTimerUpdate,
    onWarmupEnded
  } = useSocket();

  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [buzzerWinner, setBuzzerWinner] = useState<BuzzerEntry | null>(null);
  const [hasBuzzed, setHasBuzzed] = useState(false);

  // Qualification round state
  const [qualificationQuestionIndex, setQualificationQuestionIndex] = useState(0);
  const [qualificationQuestions, setQualificationQuestions] = useState<Question[]>([]);
  const [qualificationCompleted, setQualificationCompleted] = useState(false);
  const [qualificationScore, setQualificationScore] = useState(0);
  const [showQualificationResult, setShowQualificationResult] = useState(false);

  // Warmup round state
  const [warmupQuestionIndex, setWarmupQuestionIndex] = useState(0);
  const [warmupQuestions, setWarmupQuestions] = useState<Question[]>([]);
  const [warmupTimeRemaining, setWarmupTimeRemaining] = useState(180);
  const [warmupCompleted, setWarmupCompleted] = useState(false);
  const [warmupScore, setWarmupScore] = useState(0);
  const [isWarmupActive, setIsWarmupActive] = useState(false);
  const [warmupHonorBoard, setWarmupHonorBoard] = useState<Player[]>([]);

  // Get current player data
  const currentPlayer = gameState?.players.find(p => {
    // Match by socket id stored in session
    return p.id === socket?.data?.playerId;
  });

  useEffect(() => {
    const cleanup = onTimerUpdate?.((time) => {
      setTimeRemaining(time);
    });
    return cleanup;
  }, [onTimerUpdate]);

  useEffect(() => {
    const cleanup = onBuzzerPressed?.((entry) => {
      setBuzzerWinner(entry);
    });
    return cleanup;
  }, [onBuzzerPressed]);

  useEffect(() => {
    const cleanup = onAnswerResult?.((playerId, correct, points) => {
      if (socket?.data?.playerId === playerId) {
        setLastResult({ correct, points });
        setTimeout(() => setLastResult(null), 3000);
      }
    });
    return cleanup;
  }, [onAnswerResult, socket]);

  // Handle qualification result - update score and move to next question
  useEffect(() => {
    const cleanup = onQualificationResult?.((correct, points, totalScore, isComplete, questions) => {
      console.log('[Qualification] Result received:', { correct, points, totalScore, isComplete });
      
      // Fallback: if questions not set yet, set them now
      if (questions && qualificationQuestions.length === 0) {
        console.log('[Qualification] Setting questions from result callback');
        setQualificationQuestions(questions);
      }

      setQualificationScore(totalScore);
      setLastResult({ correct, points });
      
      setTimeout(() => {
        setLastResult(null);
        if (isComplete) {
          console.log('[Qualification] Completed!');
          setQualificationCompleted(true);
        } else {
          // Move to next question - THIS IS THE CRITICAL UPDATE
          setQualificationQuestionIndex(prev => {
            const nextIndex = prev + 1;
            console.log('[Qualification] Moving to question', nextIndex + 1);
            return nextIndex;
          });
          setSelectedAnswer(null);
          setHasAnswered(false);
          setShowQualificationResult(false);
        }
      }, 1500);
    });
    return cleanup;
  }, [onQualificationResult]); // Removed qualificationQuestions.length from deps to prevent listener recreation

  // Reset states when question changes (for buzzer round only)
  useEffect(() => {
    if (gameState?.phase === 'buzzer') {
      setSelectedAnswer(null);
      setHasAnswered(false);
      setBuzzerWinner(null);
      setHasBuzzed(false);
    }
  }, [gameState?.currentQuestion?.id, gameState?.phase]);

  // Listen for qualification start event - SINGLE SOURCE OF TRUTH for qualification init
  useEffect(() => {
    const cleanup = onQualificationStart?.((questions) => {
      console.log('[Qualification] Starting with', questions.length, 'questions');
      setQualificationQuestions(questions);
      setQualificationQuestionIndex(0);
      setQualificationCompleted(false);
      setQualificationScore(0);
      setSelectedAnswer(null);
      setHasAnswered(false);
    });
    return cleanup;
  }, [onQualificationStart]);

  // Listen for warmup start event
  useEffect(() => {
    const cleanup = onWarmupStart?.((data) => {
      setWarmupQuestions(data.questions);
      setWarmupQuestionIndex(0);
      setWarmupCompleted(false);
      setWarmupScore(0);
      setWarmupTimeRemaining(data.duration);
      setIsWarmupActive(true);
      setSelectedAnswer(null);
      setHasAnswered(false);
    });
    return cleanup;
  }, [onWarmupStart]);

  // Listen for warmup answer result
  useEffect(() => {
    const cleanup = onWarmupAnswerResult?.((result) => {
      setLastResult({ correct: result.correct, points: result.points });
      setWarmupScore(result.totalScore);

      setTimeout(() => {
        setLastResult(null);
        if (result.isComplete) {
          setWarmupCompleted(true);
        } else {
          setWarmupQuestionIndex(result.questionIndex);
          setSelectedAnswer(null);
          setHasAnswered(false);
        }
      }, 1000);
    });
    return cleanup;
  }, [onWarmupAnswerResult]);

  // Listen for warmup timer updates
  useEffect(() => {
    const cleanup = onWarmupTimerUpdate?.((timeRemaining) => {
      setWarmupTimeRemaining(timeRemaining);
    });
    return cleanup;
  }, [onWarmupTimerUpdate]);

  // Listen for warmup round end (honor board)
  useEffect(() => {
    const cleanup = onWarmupEnded?.((data) => {
      setIsWarmupActive(false);
      setWarmupHonorBoard(data.ranking);
    });
    return cleanup;
  }, [onWarmupEnded]);

  // CRITICAL: Reset round-specific states when phase changes
  useEffect(() => {
    const phase = gameState?.phase;

    // Reset states when entering a new phase
    setSelectedAnswer(null);
    setHasAnswered(false);
    setLastResult(null);
    setBuzzerWinner(null);
    setHasBuzzed(false);

    // Reset warmup states when leaving warmup phases
    if (phase !== 'warmup' && phase !== 'warmup-honor') {
      setWarmupQuestions([]);
      setWarmupQuestionIndex(0);
      setWarmupCompleted(false);
      setWarmupScore(0);
      setIsWarmupActive(false);
      setWarmupTimeRemaining(180);
    }

    // Reset qualification states when leaving qualification
    if (phase !== 'qualification') {
      setQualificationQuestions([]);
      setQualificationQuestionIndex(0);
      setQualificationCompleted(false);
      setQualificationScore(0);
    }
  }, [gameState?.phase]);

  const handleJoin = () => {
    if (!roomCode.trim() || !playerName.trim()) {
      setError('Vui lòng nhập mã phòng và tên của bạn');
      return;
    }

    joinRoom(roomCode.toUpperCase(), playerName, (success, message) => {
      if (success) {
        setIsJoined(true);
        setError('');
      } else {
        setError(message || 'Không thể vào phòng');
      }
    });
  };

  const handleSelectAnswer = (answerIdx: number) => {
    if (hasAnswered || !gameState?.currentQuestion) return;

    setSelectedAnswer(answerIdx);
    setHasAnswered(true);

    submitAnswer({
      playerId: socket?.data?.playerId || '',
      questionId: gameState.currentQuestion.id,
      answer: answerIdx,
      timestamp: Date.now()
    });
  };

  const handleQualificationAnswer = (answerIdx: number) => {
    if (hasAnswered || qualificationCompleted) return;

    const currentQuestion = qualificationQuestions[qualificationQuestionIndex];
    if (!currentQuestion) return;

    setSelectedAnswer(answerIdx);
    setHasAnswered(true);
    setShowQualificationResult(true);

    submitQualificationAnswer({
      playerId: socket?.data?.playerId || '',
      questionId: currentQuestion.id,
      questionIndex: qualificationQuestionIndex,
      answer: answerIdx,
      timestamp: Date.now()
    });
  };

  const handleBuzzer = () => {
    if (!gameState?.buzzerEnabled || hasBuzzed) return;
    setHasBuzzed(true);
    pressBuzzer();
  };

  const handleWarmupAnswer = (answerIdx: number) => {
    if (hasAnswered || warmupCompleted || !isWarmupActive) return;

    const currentQuestion = warmupQuestions[warmupQuestionIndex];
    if (!currentQuestion) return;

    setSelectedAnswer(answerIdx);
    setHasAnswered(true);

    // Calculate time taken (approximation based on question start)
    const timeTaken = 10; // Default per question time

    submitWarmupAnswer({
      playerId: socket?.data?.playerId || '',
      questionId: currentQuestion.id,
      questionIndex: warmupQuestionIndex,
      answer: answerIdx,
      timeTaken
    });
  };

  const handleActivateStar = () => {
    activateStar();
  };

  const getPhaseLabel = (phase: GamePhase) => {
    switch (phase) {
      case 'waiting': return 'Đang chờ bắt đầu';
      case 'qualification': return 'Vòng Khởi Động';
      case 'warmup': return 'Vòng Vượt Chướng Ngại Vật';
      case 'warmup-honor': return 'Bảng Vinh Danh';
      case 'buzzer': return 'Vòng Tăng Tốc';
      case 'finished': return 'Kết Thúc';
      default: return phase;
    }
  };

  // Join Screen
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F0F23] via-slate-900 to-[#0F0F23] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-[#E2E8F0]">Vào Phòng Thi</h1>
            <p className="text-slate-400">Nhập mã phòng từ quản trò</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Mã Phòng</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="VD: ABC123"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-center text-2xl font-mono tracking-widest text-[#E2E8F0] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                maxLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Tên Của Bạn</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên của bạn"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-[#E2E8F0] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                maxLength={20}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              onClick={handleJoin}
              disabled={!connected}
              className="w-full py-4 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
            >
              {connected ? 'Vào Phòng' : 'Đang kết nối...'}
            </button>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-slate-400">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#22C55E] animate-pulse' : 'bg-red-500'}`}></div>
              <span>{connected ? 'Đã kết nối máy chủ' : 'Đang kết nối...'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game Screen
  return (
    <div className="min-h-screen bg-[#0F0F23] text-[#E2E8F0] flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Phòng: {gameState?.roomCode}</p>
            <p className="font-bold text-lg">{playerName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Điểm</p>
            <p className="text-2xl font-bold text-[#7C3AED]">
              {gameState?.players.find(p => p.name === playerName)?.score || 0}
            </p>
          </div>
        </div>
        {gameState && (
          <div className="mt-2">
            <span className="px-3 py-1 bg-[#7C3AED]/20 text-[#A78BFA] rounded-full text-sm">
              {getPhaseLabel(gameState.phase)}
            </span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col">
        {/* Timer - Only for warmup and buzzer */}
        {gameState?.currentQuestion && gameState.phase !== 'qualification' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Thời gian</span>
              <span className={`text-2xl font-mono font-bold ${timeRemaining <= 10 ? 'text-[#F43F5E] animate-pulse' : 'text-[#22C55E]'}`}>
                {timeRemaining}s
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${timeRemaining <= 10 ? 'bg-[#F43F5E]' : 'bg-[#22C55E]'}`}
                style={{ width: `${(timeRemaining / (gameState.currentQuestion.timeLimit || 30)) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Waiting State */}
        {gameState?.phase === 'waiting' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xl">Đang chờ quản trò bắt đầu...</p>
              <p className="text-slate-400">{gameState.players.length} thí sinh trong phòng</p>
            </div>
          </div>
        )}

        {/* QUALIFICATION ROUND - Individual Exam */}
        {gameState?.phase === 'qualification' && !qualificationCompleted && qualificationQuestions.length > 0 && (
          <div className="flex-1 flex flex-col">
            {/* Progress indicator */}
            <div className="mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Tiến độ bài thi</span>
                <span className="text-sm font-medium">
                  Câu {qualificationQuestionIndex + 1} / {qualificationQuestions.length}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7C3AED] transition-all duration-300"
                  style={{ width: `${((qualificationQuestionIndex + 1) / qualificationQuestions.length) * 100}%` }}
                ></div>
              </div>
              <div className="mt-2 text-center">
                <span className="text-[#22C55E] font-bold text-lg">{qualificationScore} điểm</span>
              </div>
            </div>

            {/* Question */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-4">
              <p className="text-xl font-medium text-center">
                {qualificationQuestions[qualificationQuestionIndex]?.text}
              </p>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-1 gap-3 flex-1">
              {qualificationQuestions[qualificationQuestionIndex]?.options?.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQualificationAnswer(idx)}
                  disabled={hasAnswered}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer
                    ${selectedAnswer === idx
                      ? 'border-[#7C3AED] bg-[#7C3AED]/20'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'}
                    ${hasAnswered ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                >
                  <span className="font-bold mr-3 text-[#7C3AED]">{String.fromCharCode(65 + idx)}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Qualification Completed */}
        {gameState?.phase === 'qualification' && qualificationCompleted && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-6 bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
              <div className="text-6xl">✅</div>
              <h2 className="text-2xl font-bold text-[#22C55E]">Hoàn thành bài thi!</h2>
              <div className="space-y-2">
                <p className="text-slate-400">Điểm của bạn:</p>
                <p className="text-5xl font-bold text-[#7C3AED]">{qualificationScore}</p>
                <p className="text-slate-400">điểm</p>
              </div>
              <p className="text-slate-500 text-sm">
                Đang chờ các thí sinh khác hoàn thành...
              </p>
              <div className="w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        )}

        {/* Warmup Round - Sequential Questions with 3-min Timer */}
        {gameState?.phase === 'warmup' && isWarmupActive && !warmupCompleted && warmupQuestions.length > 0 && (
          <div className="flex-1 flex flex-col">
            {/* Warmup Timer */}
            <div className="mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Thời gian còn lại</span>
                <span className={`text-2xl font-mono font-bold ${warmupTimeRemaining <= 30 ? 'text-[#F43F5E] animate-pulse' : 'text-[#22C55E]'}`}>
                  {Math.floor(warmupTimeRemaining / 60)}:{(warmupTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${warmupTimeRemaining <= 30 ? 'bg-[#F43F5E]' : 'bg-[#22C55E]'}`}
                  style={{ width: `${(warmupTimeRemaining / 180) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Tiến độ</span>
                <span className="text-sm font-medium">
                  Câu {warmupQuestionIndex + 1} / {warmupQuestions.length}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7C3AED] transition-all duration-300"
                  style={{ width: `${((warmupQuestionIndex + 1) / warmupQuestions.length) * 100}%` }}
                ></div>
              </div>
              <div className="mt-2 text-center">
                <span className="text-[#22C55E] font-bold text-lg">{warmupScore} điểm</span>
              </div>
            </div>

            {/* Question */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-4">
              <p className="text-xl font-medium text-center">
                {warmupQuestions[warmupQuestionIndex]?.text}
              </p>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-1 gap-3 flex-1">
              {warmupQuestions[warmupQuestionIndex]?.options?.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleWarmupAnswer(idx)}
                  disabled={hasAnswered}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer
                    ${selectedAnswer === idx
                      ? 'border-[#7C3AED] bg-[#7C3AED]/20'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'}
                    ${hasAnswered ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                >
                  <span className="font-bold mr-3 text-[#7C3AED]">{String.fromCharCode(65 + idx)}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Warmup Completed - Waiting for others */}
        {gameState?.phase === 'warmup' && warmupCompleted && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-6 bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
              <div className="text-6xl">✅</div>
              <h2 className="text-2xl font-bold text-[#22C55E]">Hoàn thành vòng thi!</h2>
              <div className="space-y-2">
                <p className="text-slate-400">Điểm của bạn:</p>
                <p className="text-5xl font-bold text-[#7C3AED]">{warmupScore}</p>
                <p className="text-slate-400">điểm</p>
              </div>
              <p className="text-slate-500 text-sm">
                Đang chờ hết thời gian hoặc các thí sinh khác...
              </p>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-slate-400">Thời gian còn:</span>
                <span className={`font-mono font-bold ${warmupTimeRemaining <= 30 ? 'text-[#F43F5E]' : 'text-[#22C55E]'}`}>
                  {Math.floor(warmupTimeRemaining / 60)}:{(warmupTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Warmup Honor Board - EXCLUSIVE: Only render when phase is warmup-honor */}
        {gameState?.phase === 'warmup-honor' && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-lg space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-[#FFD700] animate-pulse">🏆 BẢNG VINH DANH 🏆</h2>
                <p className="text-slate-400 mt-2">Top 8 thí sinh xuất sắc nhất</p>
              </div>

              <div className="space-y-3">
                {warmupHonorBoard.slice(0, 8).map((player, idx) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-500 transform
                      ${idx === 0 ? 'bg-yellow-500/20 border-yellow-500 scale-105' :
                        idx === 1 ? 'bg-slate-400/20 border-slate-400' :
                          idx === 2 ? 'bg-orange-600/20 border-orange-500' :
                            'bg-slate-800/50 border-slate-600'}
                      ${player.name === playerName ? 'ring-2 ring-[#7C3AED]' : ''}
                    `}
                    style={{
                      animationDelay: `${idx * 0.1}s`,
                      animation: 'slideInFromRight 0.5s ease-out forwards'
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <span className={`text-2xl font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-400'}`}>
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-lg">
                        {player.name}
                        {player.name === playerName && <span className="text-[#7C3AED] ml-2">(Bạn)</span>}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-[#22C55E]">{player.warmupScore || 0} điểm</span>
                  </div>
                ))}
              </div>

              <div className="text-center text-slate-400 text-sm mt-4">
                <p>Đang chờ quản trò tiếp tục vòng tiếp theo...</p>
              </div>
            </div>
          </div>
        )}

        {/* Buzzer Round */}
        {gameState?.phase === 'buzzer' && (
          <div className="flex-1 flex flex-col">
            {/* Question */}
            {gameState.currentQuestion && (
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-4">
                <p className="text-xl font-medium text-center">{gameState.currentQuestion.text}</p>
              </div>
            )}

            {/* Star Button */}
            {!gameState.players.find(p => p.name === playerName)?.hasUsedStar && (
              <div className="mb-4">
                <button
                  onClick={handleActivateStar}
                  disabled={gameState.players.find(p => p.name === playerName)?.starActivated}
                  className={`w-full py-4 rounded-xl font-semibold transition-all duration-200 cursor-pointer
                    ${gameState.players.find(p => p.name === playerName)?.starActivated
                      ? 'bg-yellow-500 text-black animate-pulse'
                      : 'bg-yellow-600 hover:bg-yellow-500 text-black'
                    }`}
                >
                  {gameState.players.find(p => p.name === playerName)?.starActivated
                    ? '⭐ NGÔI SAO ĐÃ KÍCH HOẠT (x2 Điểm)'
                    : '⭐ Sử Dụng Ngôi Sao (x2 Điểm)'}
                </button>
              </div>
            )}

            {/* Buzzer Status */}
            {buzzerWinner ? (
              <div className="flex-1 flex items-center justify-center">
                <div className={`text-center p-8 rounded-2xl ${buzzerWinner.playerName === playerName
                  ? 'bg-[#22C55E]/20 border-2 border-[#22C55E]'
                  : 'bg-slate-800/50'
                  }`}>
                  {buzzerWinner.playerName === playerName ? (
                    <>
                      <p className="text-4xl mb-2">🎉</p>
                      <p className="text-2xl font-bold text-[#22C55E]">BẠN BẤM NHANH NHẤT!</p>
                      <p className="text-slate-400 mt-2">Chờ quản trò chấm điểm</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl text-slate-400">Người bấm nhanh nhất:</p>
                      <p className="text-2xl font-bold text-[#F43F5E]">{buzzerWinner.playerName}</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={handleBuzzer}
                  disabled={!gameState.buzzerEnabled || hasBuzzed}
                  className={`w-64 h-64 rounded-full font-bold text-3xl transition-all duration-200 cursor-pointer
                    ${gameState.buzzerEnabled && !hasBuzzed
                      ? 'bg-gradient-to-br from-[#F43F5E] to-red-700 hover:scale-110 active:scale-95 shadow-lg shadow-[#F43F5E]/50 animate-pulse'
                      : 'bg-slate-600 cursor-not-allowed opacity-50'
                    }`}
                >
                  {gameState.buzzerEnabled ? 'BẤM CHUÔNG!' : 'Chờ...'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Game Finished - Final Summary Screen */}
        {gameState?.phase === 'finished' && (
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <div className="text-center space-y-6 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Trophy Animation */}
              <div className="relative">
                <p className="text-7xl animate-bounce">🏆</p>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 bg-yellow-400/20 rounded-full animate-ping"></div>
                </div>
              </div>

              <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-[#7C3AED] to-[#F43F5E] bg-clip-text text-transparent">
                Tổng Kết Cuộc Thi
              </h2>

              {/* Your Result Highlight */}
              {(() => {
                const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
                const myRank = sortedPlayers.findIndex(p => p.name === playerName) + 1;
                const myScore = sortedPlayers.find(p => p.name === playerName)?.score || 0;
                const isWinner = myRank === 1;

                return (
                  <div className={`p-5 rounded-2xl border-2 ${isWinner
                    ? 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/10 border-yellow-400 shadow-lg shadow-yellow-400/20'
                    : 'bg-slate-800/50 border-slate-600'}`}
                  >
                    {isWinner && <p className="text-2xl mb-2">👑</p>}
                    <p className="text-slate-400 text-sm">Thành tích của bạn</p>
                    <p className="text-4xl font-bold text-[#7C3AED] my-2">{myScore} điểm</p>
                    <p className={`text-lg font-semibold ${isWinner ? 'text-yellow-400' : 'text-slate-300'}`}>
                      Hạng {myRank} / {gameState.players.length}
                    </p>
                    {isWinner && <p className="text-[#22C55E] text-sm mt-2 font-medium">🎉 Bạn là Quán quân!</p>}
                  </div>
                );
              })()}

              {/* Full Rankings */}
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 text-slate-300">📊 Bảng Xếp Hạng</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {[...gameState.players]
                    .sort((a, b) => b.score - a.score)
                    .map((player, idx) => {
                      const isMe = player.name === playerName;
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';

                      return (
                        <div
                          key={player.id}
                          className={`flex items-center justify-between p-3 rounded-xl transition-all duration-300
                            ${isMe
                              ? 'bg-[#7C3AED]/30 border-2 border-[#7C3AED] scale-105'
                              : idx === 0
                                ? 'bg-yellow-500/20 border border-yellow-500/50'
                                : idx === 1
                                  ? 'bg-slate-400/20 border border-slate-400/50'
                                  : idx === 2
                                    ? 'bg-orange-600/20 border border-orange-500/50'
                                    : 'bg-slate-700/30 border border-slate-600/30'
                            }`}
                          style={{ animationDelay: `${idx * 100}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`font-bold w-8 text-center ${idx === 0 ? 'text-yellow-400' :
                                idx === 1 ? 'text-slate-300' :
                                  idx === 2 ? 'text-orange-400' : 'text-slate-500'
                              }`}>
                              {medal || `#${idx + 1}`}
                            </span>
                            <span className={`font-medium ${isMe ? 'text-[#7C3AED]' : 'text-white'}`}>
                              {player.name} {isMe && '(Bạn)'}
                            </span>
                          </div>
                          <span className={`font-bold ${idx === 0 ? 'text-yellow-400' :
                              idx === 1 ? 'text-slate-300' :
                                idx === 2 ? 'text-orange-400' : 'text-slate-400'
                            }`}>
                            {player.score} đ
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Thank you message */}
              <p className="text-slate-400 text-sm">
                ✨ Cảm ơn bạn đã tham gia Đường Lên Đỉnh Olympia! ✨
              </p>
            </div>
          </div>
        )}

        {/* Result Notification */}
        {lastResult && (
          <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 
            ${lastResult.correct ? 'bg-[#22C55E]' : 'bg-red-600'} 
            px-8 py-6 rounded-2xl shadow-2xl text-center`}
          >
            <p className="text-3xl font-bold">{lastResult.correct ? '✓ ĐÚNG!' : '✗ SAI!'}</p>
            <p className="text-xl mt-2">{lastResult.points > 0 ? '+' : ''}{lastResult.points} điểm</p>
          </div>
        )}
      </main>

      {/* Footer - Scoreboard */}
      <footer className="bg-slate-900/80 border-t border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Xếp hạng:</span>
          <span className="font-bold">
            #{(gameState?.players
              .sort((a, b) => b.score - a.score)
              .findIndex(p => p.name === playerName) || 0) + 1} / {gameState?.players.length || 0}
          </span>
        </div>
      </footer>
    </div>
  );
}