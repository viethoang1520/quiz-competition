'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { GamePhase, Player, BuzzerEntry } from '@/types';

export default function HostPage() {
  const {
    gameState,
    connected,
    createRoom,
    startGame,
    nextQuestion,
    enableBuzzer,
    disableBuzzer,
    resetBuzzer,
    markAnswer,
    activatePlayerStar,
    onBuzzerPressed,
    onTimerUpdate,
    onWarmupTimerUpdate,
    onWarmupPlayerProgress,
    onWarmupEnded
  } = useSocket();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [lastBuzzer, setLastBuzzer] = useState<BuzzerEntry | null>(null);
  const [showResult, setShowResult] = useState<{ playerId: string; correct: boolean; points: number } | null>(null);

  // Warmup state
  const [warmupTimeRemaining, setWarmupTimeRemaining] = useState(180);
  const [warmupPlayerProgress, setWarmupPlayerProgress] = useState<Map<string, { questionIndex: number; score: number; completed: boolean }>>(new Map());
  const [warmupHonorBoard, setWarmupHonorBoard] = useState<Player[]>([]);

  useEffect(() => {
    if (connected && !roomCode) {
      createRoom((code) => {
        setRoomCode(code);
      });
    }
  }, [connected, roomCode, createRoom]);

  useEffect(() => {
    const cleanup = onTimerUpdate?.((time) => {
      setTimeRemaining(time);
    });
    return cleanup;
  }, [onTimerUpdate]);

  useEffect(() => {
    const cleanup = onBuzzerPressed?.((entry) => {
      setLastBuzzer(entry);
    });
    return cleanup;
  }, [onBuzzerPressed]);

  // Warmup timer listener
  useEffect(() => {
    const cleanup = onWarmupTimerUpdate?.((time) => {
      setWarmupTimeRemaining(time);
    });
    return cleanup;
  }, [onWarmupTimerUpdate]);

  // Warmup player progress listener
  useEffect(() => {
    const cleanup = onWarmupPlayerProgress?.((progress) => {
      setWarmupPlayerProgress(prev => {
        const newMap = new Map(prev);
        newMap.set(progress.playerId, {
          questionIndex: progress.questionIndex,
          score: progress.score,
          completed: progress.completed
        });
        return newMap;
      });
    });
    return cleanup;
  }, [onWarmupPlayerProgress]);

  // Warmup ended listener (honor board)
  useEffect(() => {
    const cleanup = onWarmupEnded?.((data) => {
      setWarmupHonorBoard(data.ranking);
    });
    return cleanup;
  }, [onWarmupEnded]);

  // CRITICAL: Reset round-specific states when phase changes
  useEffect(() => {
    const phase = gameState?.phase;

    // Reset buzzer-related state
    setLastBuzzer(null);
    setShowResult(null);

    // Reset warmup states when leaving warmup phases
    if (phase !== 'warmup' && phase !== 'warmup-honor') {
      setWarmupPlayerProgress(new Map());
      setWarmupTimeRemaining(180);
    }
  }, [gameState?.phase]);

  const handleMarkAnswer = (playerId: string, correct: boolean) => {
    markAnswer(playerId, correct);
    setLastBuzzer(null);

    const player = gameState?.players.find(p => p.id === playerId);
    if (player) {
      let points = 0;
      if (gameState?.phase === 'warmup') {
        points = correct ? 10 : 0;
      } else if (gameState?.phase === 'buzzer') {
        const basePoints = correct ? 20 : -10;
        points = player.starActivated ? basePoints * 2 : basePoints;
      }
      setShowResult({ playerId, correct, points });
      setTimeout(() => setShowResult(null), 2000);
    }
  };

  const getPhaseLabel = (phase: GamePhase) => {
    switch (phase) {
      case 'waiting': return 'Đang chờ thí sinh';
      case 'qualification': return 'Vòng Khởi Động';
      case 'warmup': return 'Vòng Vượt Chướng Ngại Vật';
      case 'warmup-honor': return 'Bảng Vinh Danh';
      case 'buzzer': return 'Vòng Tăng Tốc';
      case 'finished': return 'Kết Thúc';
      default: return phase;
    }
  };

  const getPhaseColor = (phase: GamePhase) => {
    switch (phase) {
      case 'waiting': return 'bg-slate-600';
      case 'qualification': return 'bg-blue-600';
      case 'warmup': return 'bg-yellow-600';
      case 'warmup-honor': return 'bg-[#FFD700]';
      case 'buzzer': return 'bg-[#F43F5E]';
      case 'finished': return 'bg-[#22C55E]';
      default: return 'bg-slate-600';
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0F0F23] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400">Đang kết nối đến máy chủ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F23] text-[#E2E8F0]">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-[#7C3AED]">QUẢN TRÒ</h1>
            {roomCode && (
              <div className="bg-slate-800 px-4 py-2 rounded-lg">
                <span className="text-slate-400 text-sm">Mã phòng:</span>
                <span className="ml-2 text-2xl font-mono font-bold text-[#F43F5E]">{roomCode}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {gameState && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(gameState.phase)}`}>
                {getPhaseLabel(gameState.phase)}
              </span>
            )}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#22C55E]' : 'bg-red-500'}`}></div>
              <span className="text-sm text-slate-400">{connected ? 'Đã kết nối' : 'Mất kết nối'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Question & Timer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer - Only show for warmup and buzzer rounds */}
          {gameState?.currentQuestion && gameState.phase !== 'qualification' && (
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400">Thời gian còn lại</span>
                <span className={`text-4xl font-mono font-bold ${timeRemaining <= 10 ? 'text-[#F43F5E] animate-pulse' : 'text-[#22C55E]'}`}>
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

          {/* Qualification Round - Show player progress */}
          {gameState?.phase === 'qualification' && (
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-slate-300 mb-4">Vòng Khởi Động - Bài Thi Trắc Nghiệm</h2>
              <div className="text-center py-8">
                <p className="text-slate-400 mb-4">Thí sinh đang làm bài thi trắc nghiệm độc lập</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {gameState.players.map((player) => (
                    <div key={player.id} className="bg-slate-700/50 rounded-xl p-4 text-center">
                      <p className="font-medium truncate">{player.name}</p>
                      <p className="text-2xl font-bold text-[#7C3AED] mt-2">{player.score}</p>
                      <p className="text-xs text-slate-400">điểm</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {player.qualificationCompleted ? '✅ Hoàn thành' : '⏳ Đang làm bài'}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500 mt-6">
                  Chọn top 8 thí sinh có điểm cao nhất để vào vòng tiếp theo
                </p>
              </div>
            </div>
          )}

          {/* Warmup Round - Show timer and player progress */}
          {gameState?.phase === 'warmup' && (
            <div className="space-y-6">
              {/* Warmup Timer */}
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-400">⏱️ Thời gian Vòng Vượt Chướng Ngại Vật</span>
                  <span className={`text-4xl font-mono font-bold ${warmupTimeRemaining <= 30 ? 'text-[#F43F5E] animate-pulse' : 'text-[#22C55E]'}`}>
                    {Math.floor(warmupTimeRemaining / 60)}:{(warmupTimeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${warmupTimeRemaining <= 30 ? 'bg-[#F43F5E]' : 'bg-[#22C55E]'}`}
                    style={{ width: `${(warmupTimeRemaining / 180) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Player Progress */}
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-slate-300 mb-4">Tiến độ thí sinh</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {gameState.players.filter(p => !p.eliminated).map((player) => {
                    const progress = warmupPlayerProgress.get(player.id) || { questionIndex: 0, score: 0, completed: false };
                    return (
                      <div key={player.id} className={`bg-slate-700/50 rounded-xl p-4 text-center border-2 ${progress.completed ? 'border-[#22C55E]' : 'border-transparent'}`}>
                        <p className="font-medium truncate">{player.name}</p>
                        <p className="text-2xl font-bold text-[#7C3AED] mt-2">{progress.score}</p>
                        <p className="text-xs text-slate-400">điểm</p>
                        <div className="mt-2">
                          <div className="h-1 bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#7C3AED] transition-all duration-300"
                              style={{ width: `${(progress.questionIndex / 15) * 100}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {progress.completed ? '✅ Hoàn thành' : `Câu ${progress.questionIndex}/15`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Warmup Honor Board - EXCLUSIVE: Only render when phase is warmup-honor */}
          {gameState?.phase === 'warmup-honor' && (
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-8 border-2 border-[#FFD700]">
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold text-[#FFD700] animate-pulse">🏆 BẢNG VINH DANH 🏆</h2>
                <p className="text-slate-400 mt-2">Kết quả Vòng Vượt Chướng Ngại Vật</p>
                <p className="text-[#22C55E] text-sm mt-1">TOP 4 sẽ vào Vòng Tăng Tốc</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warmupHonorBoard.map((player, idx) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-500
                      ${idx < 4
                        ? idx === 0 ? 'bg-yellow-500/20 border-yellow-500 md:col-span-2' :
                          idx === 1 ? 'bg-slate-400/20 border-slate-400' :
                            idx === 2 ? 'bg-orange-600/20 border-orange-500' :
                              'bg-green-600/20 border-green-500'
                        : 'bg-red-900/20 border-red-500/50 opacity-60'}
                    `}
                    style={{
                      animation: `slideIn 0.5s ease-out ${idx * 0.1}s both`
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <span className={`text-3xl font-bold ${idx < 4
                          ? idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-green-400'
                          : 'text-red-400'
                        }`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xl">{player.name}</span>
                        {idx < 4
                          ? <span className="text-xs text-green-400">Vào Vòng Tăng Tốc</span>
                          : <span className="text-xs text-red-400">Bị loại</span>
                        }
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-[#22C55E]">{player.score || 0} điểm</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Question - Only for buzzer round */}
          {gameState?.phase === 'buzzer' && (
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-300">Câu hỏi hiện tại</h2>
                {gameState && (
                  <span className="text-sm text-slate-500">
                    Câu {(gameState.currentQuestionIndex || 0) + 1}
                  </span>
                )}
              </div>

              {gameState?.currentQuestion ? (
                <div className="space-y-4">
                  <p className="text-2xl font-medium">{gameState.currentQuestion.text}</p>

                  {gameState.currentQuestion.options && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {gameState.currentQuestion.options.map((option, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border ${idx === gameState.currentQuestion?.correctAnswer
                            ? 'border-[#22C55E] bg-[#22C55E]/10'
                            : 'border-slate-600 bg-slate-700/50'
                            }`}
                        >
                          <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                          {option}
                          {idx === gameState.currentQuestion?.correctAnswer && (
                            <span className="ml-2 text-[#22C55E]">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p>Chưa có câu hỏi</p>
                  <p className="text-sm mt-2">Bắt đầu trò chơi hoặc chuyển sang câu hỏi tiếp theo</p>
                </div>
              )}
            </div>
          )}

          {/* Buzzer Queue (Buzzer Round Only) */}
          {gameState?.phase === 'buzzer' && (
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-300">Chuông</h2>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${gameState.buzzerEnabled ? 'bg-[#22C55E] animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-sm">{gameState.buzzerEnabled ? 'ĐÃ MỞ' : 'ĐÃ TẮT'}</span>
                </div>
              </div>

              {lastBuzzer ? (
                <div className="bg-[#F43F5E]/20 border-2 border-[#F43F5E] rounded-xl p-6 text-center animate-pulse">
                  <p className="text-sm text-slate-400 mb-2">NGƯỜI BẤM CHUÔNG ĐẦU TIÊN</p>
                  <p className="text-3xl font-bold text-[#F43F5E]">{lastBuzzer.playerName}</p>

                  {/* Star indicator */}
                  {gameState.players.find(p => p.id === lastBuzzer.playerId)?.starActivated && (
                    <div className="mt-2 text-yellow-400 text-xl">⭐ NGÔI SAO HY VỌNG (x2 Điểm)</div>
                  )}

                  <div className="flex justify-center space-x-4 mt-6">
                    <button
                      onClick={() => handleMarkAnswer(lastBuzzer.playerId, true)}
                      className="px-8 py-3 bg-[#22C55E] hover:bg-green-600 rounded-xl font-semibold transition-colors cursor-pointer"
                    >
                      ✓ Đúng
                    </button>
                    <button
                      onClick={() => handleMarkAnswer(lastBuzzer.playerId, false)}
                      className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-colors cursor-pointer"
                    >
                      ✗ Sai
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  {gameState.buzzerEnabled ? 'Đang chờ thí sinh bấm chuông...' : 'Mở chuông để bắt đầu'}
                </div>
              )}
            </div>
          )}

          {/* Game Finished - Final Leaderboard */}
          {gameState?.phase === 'finished' && (
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-8 border-2 border-[#FFD700]">
              <div className="text-center mb-8">
                <div className="relative inline-block">
                  <p className="text-7xl animate-bounce">🏆</p>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 bg-yellow-400/20 rounded-full animate-ping"></div>
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-[#FFD700] mt-4">KẾT THÚC CUỘC THI</h2>
                <p className="text-slate-400 mt-2">Bảng Xếp Hạng Chung Cuộc - TOP 4</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {[...gameState.players]
                  .filter(p => !p.eliminated)
                  .sort((a, b) => b.score - a.score)
                  .map((player, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';

                    return (
                      <div
                        key={player.id}
                        className={`p-4 rounded-xl border-2 transition-all duration-500
                          ${idx === 0
                            ? 'bg-yellow-500/20 border-yellow-500 md:col-span-2'
                            : idx === 1
                              ? 'bg-slate-400/20 border-slate-400'
                              : idx === 2
                                ? 'bg-orange-600/20 border-orange-500'
                                : 'bg-green-600/20 border-green-500'}
                        `}
                        style={{
                          animation: `slideIn 0.5s ease-out ${idx * 0.1}s both`
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className={`text-3xl font-bold ${idx === 0 ? 'text-yellow-400' :
                                idx === 1 ? 'text-slate-300' :
                                  idx === 2 ? 'text-orange-400' : 'text-green-400'
                              }`}>
                              {medal || `#${idx + 1}`}
                            </span>
                            <div className="flex flex-col">
                              <span className={`font-semibold ${idx === 0 ? 'text-2xl' : 'text-xl'}`}>
                                {player.name}
                              </span>
                              {idx === 0 && (
                                <span className="text-xs text-yellow-400 font-medium">🎉 Quán quân!</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold ${idx === 0 ? 'text-4xl text-yellow-400' : 'text-2xl text-[#7C3AED]'}`}>
                              {player.score}
                            </span>
                            <span className="text-slate-400 text-sm ml-1">điểm</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="text-center mt-8">
                <button
                  onClick={() => window.location.reload()}
                  className="px-8 py-3 bg-gradient-to-r from-[#7C3AED] to-[#F43F5E] hover:from-purple-600 hover:to-rose-600 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Chơi Lại
                </button>
              </div>
            </div>
          )}

          {/* Result Notification */}
          {showResult && (
            <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 
              ${showResult.correct ? 'bg-[#22C55E]' : 'bg-red-600'} 
              px-12 py-8 rounded-2xl shadow-2xl text-center`}
            >
              <p className="text-4xl font-bold">{showResult.correct ? '✓ ĐÚNG RỒI!' : '✗ SAI RỒI'}</p>
              <p className="text-2xl mt-2">{showResult.points > 0 ? '+' : ''}{showResult.points} điểm</p>
            </div>
          )}
        </div>

        {/* Right Column - Controls & Scoreboard */}
        <div className="space-y-6">
          {/* Game Controls */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-300 mb-4">Điều khiển</h2>
            <div className="space-y-3">
              {!gameState?.gameStarted ? (
                <button
                  onClick={startGame}
                  disabled={!gameState || gameState.players.length === 0}
                  className="w-full py-3 bg-[#22C55E] hover:bg-green-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Bắt đầu ({gameState?.players.length || 0} thí sinh)
                </button>
              ) : (
                <>
                  {gameState?.phase === 'qualification' && (
                    <button
                      onClick={nextQuestion}
                      className="w-full py-3 bg-[#7C3AED] hover:bg-purple-600 rounded-xl font-semibold transition-colors cursor-pointer"
                    >
                      Kết thúc Vòng Khởi Động →
                    </button>
                  )}

                  {gameState?.phase === 'warmup' && (
                    <div className="text-center text-slate-400 py-4">
                      <p>Vòng đang diễn ra...</p>
                      <p className="text-sm">Tự động kết thúc khi hết thời gian hoặc tất cả hoàn thành</p>
                    </div>
                  )}

                  {gameState?.phase === 'warmup-honor' && (
                    <button
                      onClick={nextQuestion}
                      className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#F43F5E] hover:from-purple-600 hover:to-rose-600 rounded-xl font-semibold transition-colors cursor-pointer animate-pulse"
                    >
                      Tiếp tục Vòng Tăng Tốc →
                    </button>
                  )}

                  {gameState?.phase === 'buzzer' && (
                    <>
                      <button
                        onClick={nextQuestion}
                        className="w-full py-3 bg-[#7C3AED] hover:bg-purple-600 rounded-xl font-semibold transition-colors cursor-pointer"
                      >
                        Câu hỏi tiếp theo →
                      </button>

                      <button
                        onClick={gameState.buzzerEnabled ? disableBuzzer : enableBuzzer}
                        className={`w-full py-3 ${gameState.buzzerEnabled
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-[#22C55E] hover:bg-green-600'
                          } rounded-xl font-semibold transition-colors cursor-pointer`}
                      >
                        {gameState.buzzerEnabled ? 'Tắt chuông' : 'Mở chuông'}
                      </button>

                      <button
                        onClick={resetBuzzer}
                        className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 rounded-xl font-semibold transition-colors cursor-pointer"
                      >
                        Đặt lại chuông
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Players & Scoreboard */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-300 mb-4">
              Thí sinh ({gameState?.players.filter(p => !p.eliminated).length || 0})
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {gameState?.players
                .filter(p => !p.eliminated)
                .sort((a, b) => b.score - a.score)
                .map((player, idx) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-xl ${idx === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                      idx === 1 ? 'bg-slate-400/20 border border-slate-400/50' :
                        idx === 2 ? 'bg-orange-600/20 border border-orange-600/50' :
                          'bg-slate-700/50'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold
                        ${idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-slate-400 text-black' :
                            idx === 2 ? 'bg-orange-600 text-white' :
                              'bg-slate-600'}`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <span className={`font-medium ${!player.connected ? 'text-slate-500' : ''}`}>
                          {player.name}
                        </span>
                        {player.starActivated && (
                          <span className="ml-2 text-yellow-400">⭐</span>
                        )}
                        {!player.hasUsedStar && gameState.phase === 'buzzer' && (
                          <button
                            onClick={() => activatePlayerStar(player.id)}
                            className="ml-2 text-xs bg-yellow-600 hover:bg-yellow-500 px-2 py-0.5 rounded cursor-pointer"
                          >
                            Dùng Sao
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold">{player.score}</span>
                      <span className="text-slate-400 text-sm ml-1">đ</span>
                    </div>
                  </div>
                ))}

              {(!gameState?.players || gameState.players.length === 0) && (
                <div className="text-center py-8 text-slate-500">
                  <p>Đang chờ thí sinh tham gia...</p>
                  <p className="text-sm mt-2">Chia sẻ mã phòng ở trên</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}