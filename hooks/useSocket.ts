import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Player, Question, BuzzerEntry, GamePhase, PlayerAnswer } from '@/types';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const socketIo = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socketIo;

    socketIo.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socketIo.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socketIo.on('game-state', (newGameState: GameState) => {
      setGameState(newGameState);
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, []);

  const createRoom = useCallback((callback: (roomCode: string) => void) => {
    if (socketRef.current) {
      socketRef.current.emit('create-room', callback);
    }
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, callback: (success: boolean, message?: string) => void) => {
    if (socketRef.current) {
      socketRef.current.emit('join-room', roomCode, playerName, callback);
    }
  }, []);

  const startGame = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('start-game');
    }
  }, []);

  const nextQuestion = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('next-question');
    }
  }, []);

  const enableBuzzer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('enable-buzzer');
    }
  }, []);

  const disableBuzzer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('disable-buzzer');
    }
  }, []);

  const resetBuzzer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('reset-buzzer');
    }
  }, []);

  const pressBuzzer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('press-buzzer');
    }
  }, []);

  const markAnswer = useCallback((playerId: string, correct: boolean) => {
    if (socketRef.current) {
      socketRef.current.emit('mark-answer', playerId, correct);
    }
  }, []);

  const submitAnswer = useCallback((answer: PlayerAnswer) => {
    if (socketRef.current) {
      socketRef.current.emit('submit-answer', answer);
    }
  }, []);

  // Qualification round - individual exam answer submission
  const submitQualificationAnswer = useCallback((answer: {
    playerId: string;
    questionId: string;
    questionIndex: number;
    answer: number;
    timestamp: number;
  }) => {
    if (socketRef.current) {
      socketRef.current.emit('submit-qualification-answer', answer);
    }
  }, []);

  const nextQualificationQuestion = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('next-qualification-question');
    }
  }, []);

  // Warmup round - submit answer for sequential questions
  const submitWarmupAnswer = useCallback((answer: {
    playerId: string;
    questionId: string;
    questionIndex: number;
    answer: number;
    timeTaken: number;
  }) => {
    if (socketRef.current) {
      socketRef.current.emit('submit-warmup-answer', answer);
    }
  }, []);

  const activateStar = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('activate-star');
    }
  }, []);

  const activatePlayerStar = useCallback((playerId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('activate-player-star', playerId);
    }
  }, []);

  // Event listeners
  const onPlayerJoined = useCallback((callback: (player: Player) => void) => {
    if (socketRef.current) {
      socketRef.current.on('player-joined', callback);
      return () => {
        socketRef.current?.off('player-joined', callback);
      };
    }
  }, []);

  const onPlayerDisconnected = useCallback((callback: (playerId: string) => void) => {
    if (socketRef.current) {
      socketRef.current.on('player-disconnected', callback);
      return () => {
        socketRef.current?.off('player-disconnected', callback);
      };
    }
  }, []);

  const onBuzzerPressed = useCallback((callback: (buzzerEntry: BuzzerEntry) => void) => {
    if (socketRef.current) {
      socketRef.current.on('buzzer-pressed', callback);
      return () => {
        socketRef.current?.off('buzzer-pressed', callback);
      };
    }
  }, []);

  const onQuestionStarted = useCallback((callback: (question: Question) => void) => {
    if (socketRef.current) {
      socketRef.current.on('question-started', callback);
      return () => {
        socketRef.current?.off('question-started', callback);
      };
    }
  }, []);

  const onTimerUpdate = useCallback((callback: (timeRemaining: number) => void) => {
    if (socketRef.current) {
      socketRef.current.on('timer-update', callback);
      return () => {
        socketRef.current?.off('timer-update', callback);
      };
    }
  }, []);

  const onStarActivated = useCallback((callback: (playerId: string) => void) => {
    if (socketRef.current) {
      socketRef.current.on('star-activated', callback);
      return () => {
        socketRef.current?.off('star-activated', callback);
      };
    }
  }, []);

  const onAnswerResult = useCallback((callback: (playerId: string, correct: boolean, points: number) => void) => {
    if (socketRef.current) {
      socketRef.current.on('answer-result', callback);
      return () => {
        socketRef.current?.off('answer-result', callback);
      };
    }
  }, []);

  // Qualification round result listener
  const onQualificationResult = useCallback((callback: (correct: boolean, points: number, totalScore: number, isComplete: boolean, questions?: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on('qualification-result', callback);
      return () => {
        socketRef.current?.off('qualification-result', callback);
      };
    }
  }, []);

  // Qualification round start listener
  const onQualificationStart = useCallback((callback: (questions: Question[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on('qualification-start', callback);
      return () => {
        socketRef.current?.off('qualification-start', callback);
      };
    }
  }, []);

  // Warmup round start listener
  const onWarmupStart = useCallback((callback: (data: { questions: Question[], duration: number }) => void) => {
    if (socketRef.current) {
      socketRef.current.on('warmup-start', callback);
      return () => {
        socketRef.current?.off('warmup-start', callback);
      };
    }
  }, []);

  // Warmup answer result listener
  const onWarmupAnswerResult = useCallback((callback: (result: {
    correct: boolean;
    points: number;
    totalScore: number;
    questionIndex: number;
    isComplete: boolean;
    nextQuestion: Question | null;
  }) => void) => {
    if (socketRef.current) {
      socketRef.current.on('warmup-answer-result', callback);
      return () => {
        socketRef.current?.off('warmup-answer-result', callback);
      };
    }
  }, []);

  // Warmup timer update listener
  const onWarmupTimerUpdate = useCallback((callback: (timeRemaining: number) => void) => {
    if (socketRef.current) {
      socketRef.current.on('warmup-timer-update', callback);
      return () => {
        socketRef.current?.off('warmup-timer-update', callback);
      };
    }
  }, []);

  // Warmup round ended listener (shows honor board)
  const onWarmupEnded = useCallback((callback: (data: { ranking: Player[], phase: string }) => void) => {
    if (socketRef.current) {
      socketRef.current.on('warmup-ended', callback);
      return () => {
        socketRef.current?.off('warmup-ended', callback);
      };
    }
  }, []);

  // Warmup player progress listener (for host)
  const onWarmupPlayerProgress = useCallback((callback: (progress: {
    playerId: string;
    playerName: string;
    questionIndex: number;
    score: number;
    completed: boolean;
  }) => void) => {
    if (socketRef.current) {
      socketRef.current.on('warmup-player-progress', callback);
      return () => {
        socketRef.current?.off('warmup-player-progress', callback);
      };
    }
  }, []);

  const onPhaseChanged = useCallback((callback: (phase: GamePhase) => void) => {
    if (socketRef.current) {
      socketRef.current.on('phase-changed', callback);
      return () => {
        socketRef.current?.off('phase-changed', callback);
      };
    }
  }, []);

  return {
    socket,
    gameState,
    connected,
    createRoom,
    joinRoom,
    startGame,
    nextQuestion,
    enableBuzzer,
    disableBuzzer,
    resetBuzzer,
    pressBuzzer,
    markAnswer,
    submitAnswer,
    submitQualificationAnswer,
    nextQualificationQuestion,
    submitWarmupAnswer,
    activateStar,
    activatePlayerStar,
    onPlayerJoined,
    onPlayerDisconnected,
    onBuzzerPressed,
    onQuestionStarted,
    onTimerUpdate,
    onStarActivated,
    onAnswerResult,
    onQualificationResult,
    onQualificationStart,
    onWarmupStart,
    onWarmupAnswerResult,
    onWarmupTimerUpdate,
    onWarmupEnded,
    onWarmupPlayerProgress,
    onPhaseChanged
  };
};