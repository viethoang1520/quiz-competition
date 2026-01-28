export type GamePhase = 'waiting' | 'qualification' | 'warmup' | 'warmup-honor' | 'buzzer' | 'finished';

export type QuestionType = 'multiple-choice' | 'buzzer';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: number | null;
  timeLimit: number; // seconds
}

export interface Player {
  id: string;
  name: string;
  score: number;
  hasUsedStar: boolean;
  starActivated: boolean;
  lastAnswerTime?: number;
  buzzerRank?: number;
  connected: boolean;
  // Elimination tracking
  eliminated?: boolean;
  eliminatedAt?: 'qualification' | 'warmup';
  // Qualification round tracking
  qualificationCompleted?: boolean;
  qualificationQuestionIndex?: number;
  qualificationAnswers?: { questionId: string; answer: number; correct: boolean; timestamp: number }[];
  // Warm-up round tracking
  warmupQuestionIndex?: number;
  warmupScore?: number;
  warmupTotalTime?: number;
  warmupCompleted?: boolean;
  warmupAnswers?: { questionId: string; answer: number; correct: boolean; timestamp: number }[];
}

export interface BuzzerEntry {
  playerId: string;
  playerName: string;
  timestamp: number;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  buzzerEnabled: boolean;
  buzzerQueue: BuzzerEntry[];
  timeRemaining: number;
  gameStarted: boolean;
  qualificationQuestions: Question[];
  warmupQuestions: Question[];
  buzzerQuestions: Question[];
}

export interface PlayerAnswer {
  playerId: string;
  questionId: string;
  answer: number;
  timestamp: number;
}

export interface SocketEvents {
  // Host events
  'create-room': (callback: (roomCode: string) => void) => void;
  'start-game': () => void;
  'next-question': () => void;
  'enable-buzzer': () => void;
  'disable-buzzer': () => void;
  'mark-answer': (playerId: string, correct: boolean) => void;
  'reset-buzzer': () => void;
  'activate-player-star': (playerId: string) => void;

  // Player events
  'join-room': (roomCode: string, playerName: string, callback: (success: boolean, message?: string) => void) => void;
  'submit-answer': (answer: PlayerAnswer) => void;
  'press-buzzer': () => void;
  'activate-star': () => void;

  // Shared events
  'game-state': (gameState: GameState) => void;
  'player-joined': (player: Player) => void;
  'player-disconnected': (playerId: string) => void;
  'buzzer-pressed': (buzzerEntry: BuzzerEntry) => void;
  'question-started': (question: Question) => void;
  'timer-update': (timeRemaining: number) => void;
  'star-activated': (playerId: string) => void;
  'answer-result': (playerId: string, correct: boolean, points: number) => void;
  'phase-changed': (phase: GamePhase) => void;
}