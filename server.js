const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory game states
const gameStates = new Map();
const playerSockets = new Map(); // socketId -> { playerId, roomCode }

// Sample questions - EXACTLY 20 questions for Qualification Round (fixed linear order 1→20)
const QUALIFICATION_QUESTIONS = [
  { id: '1', text: 'Thủ đô của Việt Nam là gì?', type: 'multiple-choice', options: ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ'], correctAnswer: 1, timeLimit: 30 },
  { id: '2', text: '2 + 2 = ?', type: 'multiple-choice', options: ['3', '4', '5', '6'], correctAnswer: 1, timeLimit: 15 },
  { id: '3', text: 'Ai là tác giả của "Truyện Kiều"?', type: 'multiple-choice', options: ['Nguyễn Du', 'Hồ Chí Minh', 'Nguyễn Trãi', 'Lý Thái Tổ'], correctAnswer: 0, timeLimit: 30 },
  { id: '4', text: 'Năm Việt Nam độc lập là năm nào?', type: 'multiple-choice', options: ['1944', '1945', '1946', '1947'], correctAnswer: 1, timeLimit: 30 },
  { id: '5', text: 'Con sông dài nhất Việt Nam?', type: 'multiple-choice', options: ['Sông Hồng', 'Sông Mekong', 'Sông Đồng Nai', 'Sông Cửu Long'], correctAnswer: 1, timeLimit: 30 },
  { id: '6', text: 'Đỉnh núi cao nhất Việt Nam là gì?', type: 'multiple-choice', options: ['Pù Luông', 'Fansipan', 'Bà Đen', 'Yên Tử'], correctAnswer: 1, timeLimit: 30 },
  { id: '7', text: 'Việt Nam có bao nhiêu tỉnh thành?', type: 'multiple-choice', options: ['61', '63', '65', '67'], correctAnswer: 1, timeLimit: 30 },
  { id: '8', text: '15 x 4 = ?', type: 'multiple-choice', options: ['50', '55', '60', '65'], correctAnswer: 2, timeLimit: 15 },
  { id: '9', text: 'Ai sáng tác bài thơ "Nam Quốc Sơn Hà"?', type: 'multiple-choice', options: ['Lý Thường Kiệt', 'Trần Hưng Đạo', 'Nguyễn Trãi', 'Lê Lợi'], correctAnswer: 0, timeLimit: 30 },
  { id: '10', text: 'Biển Đông thuộc đại dương nào?', type: 'multiple-choice', options: ['Đại Tây Dương', 'Ấn Độ Dương', 'Thái Bình Dương', 'Bắc Băng Dương'], correctAnswer: 2, timeLimit: 30 },
  { id: '11', text: 'Quốc hoa của Việt Nam là loài hoa nào?', type: 'multiple-choice', options: ['Hoa hồng', 'Hoa sen', 'Hoa đào', 'Hoa mai'], correctAnswer: 1, timeLimit: 30 },
  { id: '12', text: 'Thành phố nào được gọi là "Thành phố đáng sống"?', type: 'multiple-choice', options: ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Huế'], correctAnswer: 2, timeLimit: 30 },
  { id: '13', text: '100 ÷ 5 = ?', type: 'multiple-choice', options: ['15', '20', '25', '30'], correctAnswer: 1, timeLimit: 15 },
  { id: '14', text: 'Vịnh Hạ Long nằm ở tỉnh nào?', type: 'multiple-choice', options: ['Hải Phòng', 'Quảng Ninh', 'Thanh Hóa', 'Nghệ An'], correctAnswer: 1, timeLimit: 30 },
  { id: '15', text: 'Chủ tịch Hồ Chí Minh sinh năm nào?', type: 'multiple-choice', options: ['1888', '1890', '1892', '1894'], correctAnswer: 1, timeLimit: 30 },
  { id: '16', text: 'Đồng bằng sông nào rộng nhất Việt Nam?', type: 'multiple-choice', options: ['Sông Hồng', 'Sông Cửu Long', 'Sông Đà', 'Sông Mã'], correctAnswer: 1, timeLimit: 30 },
  { id: '17', text: '7² = ?', type: 'multiple-choice', options: ['14', '42', '49', '56'], correctAnswer: 2, timeLimit: 15 },
  { id: '18', text: 'Ai là người đầu tiên dịch "Truyện Kiều" sang tiếng Pháp?', type: 'multiple-choice', options: ['Nguyễn Văn Vĩnh', 'Phạm Quỳnh', 'Hoàng Xuân Hãn', 'Abel des Michels'], correctAnswer: 0, timeLimit: 30 },
  { id: '19', text: 'Hang Sơn Đoòng thuộc tỉnh nào?', type: 'multiple-choice', options: ['Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế', 'Quảng Nam'], correctAnswer: 0, timeLimit: 30 },
  { id: '20', text: 'Việt Nam nằm ở khu vực nào của châu Á?', type: 'multiple-choice', options: ['Đông Á', 'Đông Nam Á', 'Nam Á', 'Tây Á'], correctAnswer: 1, timeLimit: 30 },
];

// Fixed 15 warm-up questions - strictly sequential
const WARMUP_QUESTIONS = [
  { id: 'w01', text: 'Hành tinh lớn nhất trong hệ Mặt Trời là gì?', type: 'multiple-choice', options: ['Sao Thổ', 'Sao Mộc', 'Sao Hỏa', 'Trái Đất'], correctAnswer: 1, timeLimit: 10 },
  { id: 'w02', text: 'Nước nào có diện tích lớn nhất thế giới?', type: 'multiple-choice', options: ['Trung Quốc', 'Mỹ', 'Canada', 'Nga'], correctAnswer: 3, timeLimit: 10 },
  { id: 'w03', text: 'Kim tự tháp Giza nằm ở quốc gia nào?', type: 'multiple-choice', options: ['Ả Rập Saudi', 'Ai Cập', 'Iraq', 'Iran'], correctAnswer: 1, timeLimit: 10 },
  { id: 'w04', text: '5 x 8 = ?', type: 'multiple-choice', options: ['35', '40', '45', '50'], correctAnswer: 1, timeLimit: 10 },
  { id: 'w05', text: 'Nguyên tố hóa học có ký hiệu Au là gì?', type: 'multiple-choice', options: ['Bạc', 'Đồng', 'Vàng', 'Sắt'], correctAnswer: 2, timeLimit: 10 },
  { id: 'w06', text: 'Đơn vị tiền tệ của Nhật Bản là gì?', type: 'multiple-choice', options: ['Won', 'Yên', 'Nhân dân tệ', 'Đô la'], correctAnswer: 1, timeLimit: 10 },
  { id: 'w07', text: 'Sông nào dài nhất thế giới?', type: 'multiple-choice', options: ['Sông Amazon', 'Sông Nile', 'Sông Dương Tử', 'Sông Mississippi'], correctAnswer: 1, timeLimit: 10 },
  { id: 'w08', text: 'Ai là tác giả của bức tranh "Mona Lisa"?', type: 'multiple-choice', options: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Botticelli'], correctAnswer: 2, timeLimit: 10 },
  { id: 'w09', text: 'Thủ đô của Úc là thành phố nào?', type: 'multiple-choice', options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correctAnswer: 2, timeLimit: 10 },
  { id: 'w10', text: '144 ÷ 12 = ?', type: 'multiple-choice', options: ['10', '11', '12', '13'], correctAnswer: 2, timeLimit: 10 },
  { id: 'w11', text: 'Loài động vật nào lớn nhất trên Trái Đất?', type: 'multiple-choice', options: ['Voi châu Phi', 'Cá voi xanh', 'Hươu cao cổ', 'Cá mập trắng'], correctAnswer: 1, timeLimit: 10 },
  { id: 'w12', text: 'Năm nào Neil Armstrong đặt chân lên Mặt Trăng?', type: 'multiple-choice', options: ['1965', '1967', '1969', '1971'], correctAnswer: 2, timeLimit: 10 },
  { id: 'w13', text: 'Công thức hóa học của nước là gì?', type: 'multiple-choice', options: ['CO2', 'H2O', 'NaCl', 'O2'], correctAnswer: 1, timeLimit: 10 },
  { id: 'w14', text: 'Ai viết vở kịch "Romeo và Juliet"?', type: 'multiple-choice', options: ['Charles Dickens', 'Mark Twain', 'William Shakespeare', 'Jane Austen'], correctAnswer: 2, timeLimit: 10 },
  { id: 'w15', text: 'Biển nào lớn nhất thế giới?', type: 'multiple-choice', options: ['Biển Đông', 'Biển Địa Trung Hải', 'Biển Caribe', 'Biển Philippines'], correctAnswer: 3, timeLimit: 10 },
];

// Warm-up round duration: 3 minutes = 180 seconds
const WARMUP_DURATION = 180;

const BUZZER_QUESTIONS = [
  { id: 'b1', text: 'Ai phát hiện ra châu Mỹ?', type: 'buzzer', correctAnswer: null, timeLimit: 60 },
  { id: 'b2', text: 'Kim tự tháp Giza nằm ở quốc gia nào?', type: 'buzzer', correctAnswer: null, timeLimit: 60 },
  { id: 'b3', text: 'Ai viết "Romeo và Juliet"?', type: 'buzzer', correctAnswer: null, timeLimit: 60 },
  { id: 'b4', text: 'Nguyên tố hóa học có ký hiệu Au là gì?', type: 'buzzer', correctAnswer: null, timeLimit: 60 },
  { id: 'b5', text: 'Chiến tranh thế giới thứ hai kết thúc năm nào?', type: 'buzzer', correctAnswer: null, timeLimit: 60 },
];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function selectTopPlayers(players, count) {
  return players
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return (a.lastAnswerTime || 0) - (b.lastAnswerTime || 0);
    })
    .slice(0, count);
}

const timers = new Map();
const warmupTimers = new Map(); // Separate timer for warmup round

function startTimer(io, roomCode) {
  // Clear existing timer for this room
  if (timers.has(roomCode)) {
    clearInterval(timers.get(roomCode));
  }

  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentQuestion) return;

  const timer = setInterval(() => {
    const currentGameState = gameStates.get(roomCode);
    if (!currentGameState || !currentGameState.currentQuestion) {
      clearInterval(timer);
      timers.delete(roomCode);
      return;
    }

    currentGameState.timeRemaining--;
    gameStates.set(roomCode, currentGameState);
    io.to(roomCode).emit('timer-update', currentGameState.timeRemaining);

    if (currentGameState.timeRemaining <= 0) {
      clearInterval(timer);
      timers.delete(roomCode);
    }
  }, 1000);

  timers.set(roomCode, timer);
}

// Start 3-minute warmup timer
function startWarmupTimer(io, roomCode) {
  // Clear existing warmup timer
  if (warmupTimers.has(roomCode)) {
    clearInterval(warmupTimers.get(roomCode));
  }

  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  gameState.warmupTimeRemaining = WARMUP_DURATION;
  gameState.warmupStartTime = Date.now();
  gameStates.set(roomCode, gameState);

  const timer = setInterval(() => {
    const currentGameState = gameStates.get(roomCode);
    if (!currentGameState || currentGameState.phase !== 'warmup') {
      clearInterval(timer);
      warmupTimers.delete(roomCode);
      return;
    }

    currentGameState.warmupTimeRemaining--;
    gameStates.set(roomCode, currentGameState);
    io.to(roomCode).emit('warmup-timer-update', currentGameState.warmupTimeRemaining);

    // Time's up - end warmup round
    if (currentGameState.warmupTimeRemaining <= 0) {
      clearInterval(timer);
      warmupTimers.delete(roomCode);
      endWarmupRound(io, roomCode);
    }
  }, 1000);

  warmupTimers.set(roomCode, timer);
}

// End warmup round and show honor board
function endWarmupRound(io, roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  // Clear warmup timer if still running
  if (warmupTimers.has(roomCode)) {
    clearInterval(warmupTimers.get(roomCode));
    warmupTimers.delete(roomCode);
  }

  // Get only active (non-eliminated) players for ranking
  const activePlayers = gameState.players.filter(p => !p.eliminated);

  // Calculate ranking by warmup score, then by total response time
  const rankedPlayers = [...activePlayers].sort((a, b) => {
    const scoreA = a.warmupScore || 0;
    const scoreB = b.warmupScore || 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    // Faster total time wins
    const timeA = a.warmupTotalTime || Infinity;
    const timeB = b.warmupTotalTime || Infinity;
    return timeA - timeB;
  });

  // Add warmup score to total score for all active players
  activePlayers.forEach(player => {
    player.score += (player.warmupScore || 0);
  });

  // Mark players ranked 5-8 as eliminated (only TOP 4 continue to buzzer)
  rankedPlayers.forEach((player, idx) => {
    if (idx >= 4) {
      player.eliminated = true;
      player.eliminatedAt = 'warmup';
    }
  });

  gameState.phase = 'warmup-honor';
  gameState.warmupRanking = rankedPlayers; // Full ranking for display
  gameState.currentQuestion = null;

  gameStates.set(roomCode, gameState);
  io.to(roomCode).emit('game-state', gameState);
  io.to(roomCode).emit('phase-changed', 'warmup-honor');
  io.to(roomCode).emit('warmup-ended', { ranking: gameState.warmupRanking, phase: 'warmup-honor' });
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Create room (Host only)
    socket.on('create-room', (callback) => {
      const roomCode = generateRoomCode();
      const gameState = {
        roomCode,
        phase: 'waiting',
        players: [],
        currentQuestion: null,
        currentQuestionIndex: 0,
        buzzerEnabled: false,
        buzzerQueue: [],
        timeRemaining: 0,
        gameStarted: false,
        qualificationQuestions: [...QUALIFICATION_QUESTIONS],
        warmupQuestions: [...WARMUP_QUESTIONS],
        buzzerQuestions: [...BUZZER_QUESTIONS]
      };

      gameStates.set(roomCode, gameState);
      socket.join(roomCode);
      socket.data = { roomCode, isHost: true };

      callback(roomCode);
      console.log('Room created:', roomCode);
    });

    // Join room (Player)
    socket.on('join-room', (roomCode, playerName, callback) => {
      const gameState = gameStates.get(roomCode);

      if (!gameState) {
        callback(false, 'Room not found');
        return;
      }

      if (gameState.gameStarted) {
        callback(false, 'Game already started');
        return;
      }

      const playerId = uuidv4();
      const player = {
        id: playerId,
        name: playerName,
        score: 0,
        hasUsedStar: false,
        starActivated: false,
        connected: true
      };

      gameState.players.push(player);
      gameStates.set(roomCode, gameState);

      playerSockets.set(socket.id, { playerId, roomCode });
      socket.data = { playerId, roomCode, isHost: false };
      socket.join(roomCode);

      // Notify all clients in the room
      io.to(roomCode).emit('game-state', gameState);
      io.to(roomCode).emit('player-joined', player);

      callback(true);
      console.log(`Player ${playerName} joined room ${roomCode}`);
    });

    // Start game
    socket.on('start-game', () => {
      const { roomCode, isHost } = socket.data || {};
      if (!roomCode || !isHost) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState) return;

      gameState.gameStarted = true;
      gameState.phase = 'qualification';
      // For qualification round, each player takes the exam independently
      // No synchronized timer or questions - each player goes at their own pace
      gameState.currentQuestion = null;
      gameState.currentQuestionIndex = 0;

      // Initialize qualification tracking for each player
      gameState.players.forEach(player => {
        player.qualificationCompleted = false;
        player.qualificationQuestionIndex = 0;
        player.qualificationAnswers = [];
      });

      gameStates.set(roomCode, gameState);
      io.to(roomCode).emit('game-state', gameState);
      io.to(roomCode).emit('phase-changed', 'qualification');

      // Send qualification questions to all players
      io.to(roomCode).emit('qualification-start', gameState.qualificationQuestions);
    });

    // Submit qualification answer (individual exam)
    socket.on('submit-qualification-answer', (answer) => {
      const { roomCode, playerId } = socket.data || {};
      if (!roomCode || !playerId) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || gameState.phase !== 'qualification') return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player || player.qualificationCompleted) return;

      const questionIndex = answer.questionIndex;
      const question = gameState.qualificationQuestions[questionIndex];
      if (!question) return;

      const correct = question.correctAnswer === answer.answer;
      const points = correct ? 1 : 0;
      player.score += points;
      player.lastAnswerTime = answer.timestamp;

      // Track the answer
      if (!player.qualificationAnswers) player.qualificationAnswers = [];
      player.qualificationAnswers.push({
        questionId: question.id,
        answer: answer.answer,
        correct,
        timestamp: answer.timestamp
      });

      player.qualificationQuestionIndex = questionIndex + 1;

      // Check if player has completed all questions
      const isComplete = (questionIndex + 1) >= gameState.qualificationQuestions.length;
      if (isComplete) {
        player.qualificationCompleted = true;
      }

      gameStates.set(roomCode, gameState);
      io.to(roomCode).emit('game-state', gameState);

      // Send result back to the player
      socket.emit('qualification-result', correct, points, player.score, isComplete, gameState.qualificationQuestions);
    });

    // Submit warmup answer (sequential questions, 3-minute limit)
    socket.on('submit-warmup-answer', (answer) => {
      const { roomCode, playerId } = socket.data || {};
      if (!roomCode || !playerId) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || gameState.phase !== 'warmup') return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player || player.warmupCompleted || player.eliminated) return;

      const questionIndex = answer.questionIndex;
      const question = gameState.warmupQuestions[questionIndex];
      if (!question) return;

      // Ensure player is on the correct question (sequential only)
      if (questionIndex !== player.warmupQuestionIndex) return;

      const correct = question.correctAnswer === answer.answer;
      const points = correct ? 10 : 0;
      player.warmupScore = (player.warmupScore || 0) + points;
      player.warmupTotalTime = (player.warmupTotalTime || 0) + (answer.timeTaken || 0);

      // Track the answer
      if (!player.warmupAnswers) player.warmupAnswers = [];
      player.warmupAnswers.push({
        questionId: question.id,
        answer: answer.answer,
        correct,
        timeTaken: answer.timeTaken || 0
      });

      player.warmupQuestionIndex = questionIndex + 1;

      // Check if player has completed all 15 questions
      const isComplete = (questionIndex + 1) >= gameState.warmupQuestions.length;
      if (isComplete) {
        player.warmupCompleted = true;
      }

      gameStates.set(roomCode, gameState);

      // Send result back to the player with next question info
      const nextQuestion = isComplete ? null : gameState.warmupQuestions[player.warmupQuestionIndex];
      socket.emit('warmup-answer-result', {
        correct,
        points,
        totalScore: player.warmupScore,
        questionIndex: player.warmupQuestionIndex,
        isComplete,
        nextQuestion
      });

      // Notify host of player progress
      io.to(roomCode).emit('warmup-player-progress', {
        playerId: player.id,
        playerName: player.name,
        questionIndex: player.warmupQuestionIndex,
        score: player.warmupScore,
        completed: player.warmupCompleted
      });

      // Check if ALL active (non-eliminated) players have completed
      const activePlayers = gameState.players.filter(p => !p.eliminated);
      const allCompleted = activePlayers.every(p => p.warmupCompleted);
      if (allCompleted) {
        // End warmup early
        endWarmupRound(io, roomCode);
      }
    });

    // Next question (Host control to move phases)
    socket.on('next-question', () => {
      const { roomCode, isHost } = socket.data || {};
      if (!roomCode || !isHost) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState) return;

      // For qualification phase, "next-question" means end the qualification round and start warmup
      if (gameState.phase === 'qualification') {
        // Sort players by qualification score
        const sortedPlayers = [...gameState.players].sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          return (a.lastAnswerTime || 0) - (b.lastAnswerTime || 0);
        });

        // Mark players outside TOP 8 as eliminated
        sortedPlayers.forEach((player, idx) => {
          if (idx >= 8) {
            player.eliminated = true;
            player.eliminatedAt = 'qualification';
          }
        });

        // Reset score for warmup phase (qualification score was just for ranking)
        gameState.players.forEach(player => {
          player.score = 0;
        });

        // Move to warmup phase
        gameState.phase = 'warmup';
        gameState.currentQuestionIndex = 0;

        // Initialize warmup tracking for non-eliminated players only
        gameState.players.forEach(player => {
          if (!player.eliminated) {
            player.warmupQuestionIndex = 0;
            player.warmupScore = 0;
            player.warmupTotalTime = 0;
            player.warmupCompleted = false;
            player.warmupAnswers = [];
          }
        });

        gameState.warmupTimeRemaining = WARMUP_DURATION;
        gameState.currentQuestion = null; // Each player has their own question

        gameStates.set(roomCode, gameState);
        io.to(roomCode).emit('game-state', gameState);
        io.to(roomCode).emit('phase-changed', 'warmup');
        io.to(roomCode).emit('warmup-start', { questions: gameState.warmupQuestions, duration: WARMUP_DURATION });

        // Start 3-minute warmup timer
        startWarmupTimer(io, roomCode);
        return;
      }

      // For warmup-honor phase, "next-question" means start buzzer round
      if (gameState.phase === 'warmup-honor') {
        gameState.phase = 'buzzer';
        gameState.currentQuestionIndex = 0;
        // Players array already has eliminated players marked - don't replace it
        gameState.currentQuestion = gameState.buzzerQuestions[0];
        gameState.timeRemaining = gameState.currentQuestion.timeLimit;
        gameState.buzzerEnabled = false;
        gameState.buzzerQueue = [];

        gameStates.set(roomCode, gameState);
        io.to(roomCode).emit('game-state', gameState);
        io.to(roomCode).emit('phase-changed', 'buzzer');
        io.to(roomCode).emit('question-started', gameState.currentQuestion);

        startTimer(io, roomCode);
        return;
      }

      gameState.currentQuestionIndex++;
      let questions;

      switch (gameState.phase) {
        case 'buzzer':
          questions = gameState.buzzerQuestions;
          if (gameState.currentQuestionIndex >= questions.length) {
            gameState.phase = 'finished';
            gameStates.set(roomCode, gameState);
            io.to(roomCode).emit('game-state', gameState);
            io.to(roomCode).emit('phase-changed', 'finished');
            return;
          }
          break;
        default:
          return;
      }

      gameState.currentQuestion = questions[gameState.currentQuestionIndex];
      gameState.timeRemaining = gameState.currentQuestion.timeLimit;
      gameState.buzzerEnabled = false;
      gameState.buzzerQueue = [];

      gameStates.set(roomCode, gameState);
      io.to(roomCode).emit('game-state', gameState);
      io.to(roomCode).emit('question-started', gameState.currentQuestion);

      startTimer(io, roomCode);
    });

    // Enable buzzer
    socket.on('enable-buzzer', () => {
      const { roomCode, isHost } = socket.data || {};
      if (!roomCode || !isHost) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || gameState.phase !== 'buzzer') return;

      gameState.buzzerEnabled = true;
      gameState.buzzerQueue = [];
      gameStates.set(roomCode, gameState);
      io.to(roomCode).emit('game-state', gameState);
    });

    // Disable buzzer
    socket.on('disable-buzzer', () => {
      const { roomCode, isHost } = socket.data || {};
      if (!roomCode || !isHost) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState) return;

      gameState.buzzerEnabled = false;
      gameStates.set(roomCode, gameState);
      io.to(roomCode).emit('game-state', gameState);
    });

    // Reset buzzer
    socket.on('reset-buzzer', () => {
      const { roomCode, isHost } = socket.data || {};
      if (!roomCode || !isHost) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState) return;

      gameState.buzzerQueue = [];
      gameState.buzzerEnabled = true;

      gameState.players.forEach(player => {
        player.starActivated = false;
      });

      gameStates.set(roomCode, gameState);
      io.to(roomCode).emit('game-state', gameState);
    });

    // Press buzzer
    socket.on('press-buzzer', () => {
      const { roomCode, playerId } = socket.data || {};
      if (!roomCode || !playerId) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || !gameState.buzzerEnabled) return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player || player.eliminated) return;

      const buzzerEntry = {
        playerId,
        playerName: player.name,
        timestamp: Date.now()
      };

      gameState.buzzerQueue.push(buzzerEntry);
      gameState.buzzerEnabled = false;
      gameStates.set(roomCode, gameState);

      io.to(roomCode).emit('game-state', gameState);
      io.to(roomCode).emit('buzzer-pressed', buzzerEntry);
    });

    // Mark answer
    socket.on('mark-answer', (playerId, correct) => {
      const { roomCode, isHost } = socket.data || {};
      if (!roomCode || !isHost) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState) return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player) return;

      let points = 0;
      if (gameState.phase === 'warmup') {
        points = correct ? 10 : 0;
      } else if (gameState.phase === 'buzzer') {
        const basePoints = correct ? 20 : -10;
        points = player.starActivated ? basePoints * 2 : basePoints;

        if (player.starActivated) {
          player.hasUsedStar = true;
          player.starActivated = false;
        }
      }

      player.score += points;
      gameStates.set(roomCode, gameState);

      io.to(roomCode).emit('game-state', gameState);
      io.to(roomCode).emit('answer-result', playerId, correct, points);
    });

    // Submit answer (multiple choice)
    socket.on('submit-answer', (answer) => {
      const { roomCode, playerId } = socket.data || {};
      if (!roomCode || !playerId) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || !gameState.currentQuestion) return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player) return;

      const question = gameState.currentQuestion;
      const correct = question.correctAnswer === answer.answer;

      let points = 0;
      if (gameState.phase === 'qualification') {
        points = correct ? 1 : 0;
        player.lastAnswerTime = answer.timestamp;
      } else if (gameState.phase === 'warmup') {
        points = correct ? 10 : 0;
      }

      player.score += points;
      gameStates.set(roomCode, gameState);

      io.to(roomCode).emit('game-state', gameState);
      socket.emit('answer-result', playerId, correct, points);
    });

    // Activate star
    socket.on('activate-star', () => {
      const { roomCode, playerId } = socket.data || {};
      if (!roomCode || !playerId) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || gameState.phase !== 'buzzer') return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player || player.hasUsedStar) return;

      player.starActivated = true;
      gameStates.set(roomCode, gameState);

      io.to(roomCode).emit('game-state', gameState);
      io.to(roomCode).emit('star-activated', playerId);
    });

    // Host activate player star
    socket.on('activate-player-star', (playerId) => {
      const { roomCode, isHost } = socket.data || {};
      if (!roomCode || !isHost) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || gameState.phase !== 'buzzer') return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player || player.hasUsedStar) return;

      player.starActivated = true;
      gameStates.set(roomCode, gameState);

      io.to(roomCode).emit('game-state', gameState);
      io.to(roomCode).emit('star-activated', playerId);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      const playerData = playerSockets.get(socket.id);
      if (playerData) {
        const { playerId, roomCode } = playerData;
        const gameState = gameStates.get(roomCode);

        if (gameState) {
          const player = gameState.players.find(p => p.id === playerId);
          if (player) {
            player.connected = false;
            gameStates.set(roomCode, gameState);
            io.to(roomCode).emit('game-state', gameState);
            io.to(roomCode).emit('player-disconnected', playerId);
          }
        }

        playerSockets.delete(socket.id);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});