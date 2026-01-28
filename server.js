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
  {
    id: "1",
    text: "Một phong trào đòi lập nhà nước riêng của một cộng đồng dân cư (nhấn mạnh “quyền sống” và bản sắc) phù hợp nhất với xu hướng nào?",
    type: "multiple-choice",
    options: [
      "Xu hướng liên hiệp các dân tộc do giao lưu kinh tế – văn hóa",
      "Xu hướng tách ra để hình thành cộng đồng dân tộc độc lập",
      "Cả hai xu hướng cùng lúc, không phân biệt được",
      "Không thuộc hai xu hướng khách quan nào",
    ],
    correctAnswer: 1,
    timeLimit: 40,
  },
  {
    id: "2",
    text: "Tình huống nào dưới đây là “dấu hiệu nhận diện” mạnh nhất của xu hướng thứ nhất (mà không lẫn sang xu hướng thứ hai)?",
    type: "multiple-choice",
    options: [
      "Các dân tộc ký hiệp định thương mại và trao đổi văn hóa rộng rãi",
      "Các dân tộc trong nhiều quốc gia thành lập liên minh kinh tế khu vực",
      "Một dân tộc thuộc địa đấu tranh thoát khỏi áp bức, bóc lột của thực dân – đế quốc",
      "Phát triển khoa học – công nghệ làm gia tăng giao lưu xuyên biên giới",
    ],
    correctAnswer: 2,
    timeLimit: 45,
  },
  {
    id: "3",
    text: "Nếu lực lượng sản xuất, khoa học – công nghệ và giao lưu kinh tế – văn hóa cùng tăng mạnh, hệ quả nào sau đây “khớp logic” nhất?",
    type: "multiple-choice",
    options: [
      "Nhu cầu xóa bỏ hàng rào ngăn cách dân tộc tăng → các dân tộc xích lại gần nhau",
      "Ý thức dân tộc suy giảm → các cộng đồng dân cư muốn tách ra mạnh hơn",
      "Phong trào chống thực dân tất yếu bùng nổ ở mọi nơi",
      "Các dân tộc ngừng giao lưu để bảo tồn bản sắc",
    ],
    correctAnswer: 0,
    timeLimit: 45,
  },
  {
    id: "4",
    text: "Chọn mệnh đề “sai tinh vi” so với lập luận về xu hướng thứ hai:",
    type: "multiple-choice",
    options: [
      "Xu hướng thứ hai gắn với nhu cầu xóa bỏ hàng rào ngăn cách giữa các dân tộc",
      "Xu hướng thứ hai nổi lên trong bối cảnh chủ nghĩa tư bản phát triển thành chủ nghĩa đế quốc",
      "Xu hướng thứ hai chủ yếu do sự thức tỉnh và trưởng thành về ý thức dân tộc, quyền sống",
      "Xu hướng thứ hai chịu tác động của giao lưu kinh tế và văn hóa",
    ],
    correctAnswer: 2,
    timeLimit: 45,
  },
  {
    id: "5",
    text: "Một cộng đồng dân cư đòi tách ra, nhưng lý do được nêu chủ yếu là “muốn mở rộng thị trường, tăng liên kết sản xuất, mở cửa giao thương”. Theo logic của bài học, cách kết luận đúng nhất là gì?",
    type: "multiple-choice",
    options: [
      "Đó vẫn là xu hướng thứ nhất vì có hành vi tách ra",
      "Đó vẫn là xu hướng thứ hai vì động lực là xóa rào cản và liên kết",
      "Không thể quy vào xu hướng nào vì hành vi và động lực mâu thuẫn",
      "Chắc chắn là xu hướng thứ nhất vì liên quan đến dân tộc",
    ],
    correctAnswer: 2,
    timeLimit: 45,
  },
  {
    id: "6",
    text: "Dân số dân tộc Kinh khoảng 82.085.826 người chiếm 85,3%. Ước lượng tổng dân số (xấp xỉ) hợp lý nhất là?",
    type: "multiple-choice",
    options: ["~86,2 triệu", "~92,5 triệu", "~96,2 triệu", "~102,8 triệu"],
    correctAnswer: 2,
    timeLimit: 45,
  },
  {
    id: "7",
    text: "Trong 53 dân tộc thiểu số, có 6 dân tộc trên 1 triệu người và 11 dân tộc dưới 5.000 người. Kết luận định tính “đúng nhất” về cấu trúc dân số là gì?",
    type: "multiple-choice",
    options: [
      "Quy mô dân số giữa các dân tộc tương đối đồng đều",
      "Chênh lệch quy mô dân số giữa các dân tộc rất lớn",
      "Hầu hết dân tộc thiểu số đều trên 1 triệu người",
      "Không thể suy luận gì về chênh lệch quy mô",
    ],
    correctAnswer: 1,
    timeLimit: 40,
  },
  {
    id: "8",
    text: "Chọn phương án “khớp nhất” với một hệ quả quản trị/ chính sách từ thực tế có nhiều dân tộc dưới 5.000 người:",
    type: "multiple-choice",
    options: [
      "Không cần chính sách riêng vì quy mô nhỏ tự thích nghi",
      "Dễ gặp khó khăn trong tổ chức cuộc sống và bảo tồn → cần quan tâm đặc biệt",
      "Đa số sẽ tự động tăng nhanh dân số trong thời gian ngắn",
      "Chỉ cần tập trung phát triển đô thị là đủ",
    ],
    correctAnswer: 1,
    timeLimit: 45,
  },
  {
    id: "9",
    text: "Nếu một địa bàn là vùng trung du/miền núi phía Bắc và Tây Nguyên, nhận định nào sau đây phù hợp nhất với mô tả về phân bố dân tộc?",
    type: "multiple-choice",
    options: [
      "Địa bàn sinh sống chủ yếu của người Kinh (Việt)",
      "Địa bàn sinh sống chủ yếu của nhiều dân tộc thiểu số",
      "Địa bàn gần như không có cư trú dân tộc thiểu số",
      "Chỉ có các dân tộc thiểu số trên 1 triệu người",
    ],
    correctAnswer: 1,
    timeLimit: 40,
  },
  {
    id: "10",
    text: "Chọn phát biểu “khó nhưng đúng” về khái niệm ‘cư trú xen kẽ’ trong đặc điểm dân tộc Việt Nam:",
    type: "multiple-choice",
    options: [
      "Mỗi dân tộc có lãnh thổ cư trú tách biệt rõ ràng, không chồng lấn",
      "Các dân tộc sống đan xen; ranh giới cư trú không tuyệt đối theo lãnh thổ riêng",
      "Chỉ dân tộc Kinh cư trú xen kẽ, còn dân tộc khác cư trú tập trung",
      "Cư trú xen kẽ đồng nghĩa với đồng hóa hoàn toàn",
    ],
    correctAnswer: 1,
    timeLimit: 45,
  },
  {
    id: "11",
    text: "Nhóm 6 dân tộc thiểu số trên 1 triệu người có tên: Tày, Thái, Mường, Mông, Khmer, Nùng. Nếu đề bài cố tình thay 1 tên bằng “Dao”, thì lỗi nằm ở đâu?",
    type: "multiple-choice",
    options: [
      "Dao không thuộc 54 dân tộc",
      "Dao không nằm trong nhóm 6 dân tộc thiểu số trên 1 triệu người của danh sách này",
      "Dao là dân tộc có dân số thấp nhất 428 người",
      "Dao là dân tộc đa số chiếm 85,3%",
    ],
    correctAnswer: 1,
    timeLimit: 45,
  },
  {
    id: "12",
    text: "Trong nhóm 6 dân tộc thiểu số trên 1 triệu người, dân tộc đông nhất xấp xỉ 1,85 triệu. Nếu chọn đáp án đúng, bạn phải tránh nhầm với các lựa chọn “có vẻ quen” khác. Dân tộc đó là?",
    type: "multiple-choice",
    options: ["Thái", "Khmer", "Tày", "Nùng"],
    correctAnswer: 2,
    timeLimit: 40,
  },
  {
    id: "13",
    text: "Có 11 dân tộc dưới 5.000 người và dân tộc có dân số thấp nhất là 428 người. Kết luận nào hợp lý nhất về mức độ phân hóa trong nhóm 'rất ít người'?",
    type: "multiple-choice",
    options: [
      "Mọi dân tộc dưới 5.000 người đều xấp xỉ 4.900–5.000",
      "Trong nhóm dưới 5.000 người vẫn có phân hóa mạnh, có trường hợp cực nhỏ (428)",
      "Nhóm dưới 5.000 người chắc chắn không cần bảo tồn văn hóa",
      "Không thể so sánh vì 428 không thuộc nhóm dưới 5.000",
    ],
    correctAnswer: 1,
    timeLimit: 45,
  },
  {
    id: "14",
    text: "Một câu hỏi bẫy: Nếu ai đó nói 'xu hướng thứ nhất xuất hiện vì giao lưu kinh tế – văn hóa tăng', bạn phản biện đúng nhất là?",
    type: "multiple-choice",
    options: [
      "Đúng, vì giao lưu tăng thì ai cũng muốn độc lập",
      "Sai, vì động lực cốt lõi của xu hướng thứ nhất là thức tỉnh ý thức dân tộc và quyền sống",
      "Đúng, vì đế quốc bóc lột thuộc địa nên giao lưu tăng",
      "Không thể kết luận gì vì hai xu hướng không có nguyên nhân",
    ],
    correctAnswer: 1,
    timeLimit: 45,
  },
  {
    id: "15",
    text: "Chọn phương án mô tả đúng nhất mối quan hệ giữa “xu hướng thứ hai” và “bối cảnh đế quốc chủ nghĩa” theo lập luận trong bài học:",
    type: "multiple-choice",
    options: [
      "Đế quốc chủ nghĩa làm các dân tộc ngừng giao lưu nên không thể liên hiệp",
      "Đế quốc chủ nghĩa chỉ tạo ra xu hướng tách ra, không liên quan xu hướng liên hiệp",
      "Trong giai đoạn tư bản phát triển thành đế quốc, cùng với phát triển lực lượng sản xuất/khoa học/giao lưu → nảy sinh nhu cầu xóa rào cản → thúc đẩy các dân tộc xích lại gần nhau",
      "Đế quốc chủ nghĩa luôn đồng nghĩa với bình đẳng dân tộc nên các dân tộc tự liên hiệp",
    ],
    correctAnswer: 2,
    timeLimit: 45,
  },
];

// Fixed 15 warm-up questions - strictly sequential
const WARMUP_QUESTIONS = [
  {
    id: "w01",
    text: "Việt Nam là quốc gia đa dân tộc với tổng cộng bao nhiêu dân tộc?",
    type: "multiple-choice",
    options: ["52", "53", "54", "55"],
    correctAnswer: 2,
    timeLimit: 10,
  },
  {
    id: "w02",
    text: "Dân tộc chiếm đa số ở Việt Nam là dân tộc nào?",
    type: "multiple-choice",
    options: ["Tày", "Kinh (Việt)", "Thái", "Mường"],
    correctAnswer: 1,
    timeLimit: 10,
  },
  {
    id: "w03",
    text: "Tỷ lệ dân số dân tộc Kinh (Việt) chiếm khoảng bao nhiêu %?",
    type: "multiple-choice",
    options: ["Khoảng 65,3%", "Khoảng 75,3%", "Khoảng 85,3%", "Khoảng 95,3%"],
    correctAnswer: 2,
    timeLimit: 10,
  },
  {
    id: "w04",
    text: "Đặc điểm cư trú phổ biến của các dân tộc ở Việt Nam là gì?",
    type: "multiple-choice",
    options: [
      "Mỗi dân tộc cư trú tách biệt hoàn toàn",
      "Các dân tộc cư trú xen kẽ nhau",
      "Chỉ cư trú tập trung ở đồng bằng",
      "Chỉ cư trú tập trung ở hải đảo",
    ],
    correctAnswer: 1,
    timeLimit: 10,
  },
  {
    id: "w05",
    text: "Đồng bào dân tộc thiểu số thường sinh sống chủ yếu ở khu vực nào?",
    type: "multiple-choice",
    options: [
      "Vùng biên giới, miền núi, hải đảo",
      "Chỉ ở các đô thị lớn",
      "Chỉ ở đồng bằng ven biển",
      "Chỉ ở trung tâm công nghiệp",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w06",
    text: "Theo chủ nghĩa Mác – Lênin, xu hướng khách quan thứ nhất của quan hệ dân tộc là gì?",
    type: "multiple-choice",
    options: [
      "Cộng đồng dân cư muốn tách ra hình thành dân tộc độc lập",
      "Các dân tộc luôn hòa tan vào nhau",
      "Các dân tộc chỉ liên hiệp về kinh tế",
      "Các dân tộc không bao giờ thay đổi",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w07",
    text: "Theo chủ nghĩa Mác – Lênin, xu hướng khách quan thứ hai của quan hệ dân tộc là gì?",
    type: "multiple-choice",
    options: [
      "Các dân tộc trong một hoặc nhiều quốc gia muốn liên hiệp lại",
      "Các dân tộc đều muốn cô lập với thế giới",
      "Các dân tộc chỉ cạnh tranh và đối đầu",
      "Các dân tộc không có nhu cầu giao lưu",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w08",
    text: "Một nội dung trong Cương lĩnh dân tộc của chủ nghĩa Mác – Lênin là gì?",
    type: "multiple-choice",
    options: [
      "Các dân tộc hoàn toàn bình đẳng",
      "Chỉ ưu tiên một dân tộc lãnh đạo",
      "Không công nhận sự khác biệt dân tộc",
      "Hạn chế giao lưu văn hóa",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w09",
    text: "Nội dung “Các dân tộc được quyền tự quyết” trong Cương lĩnh dân tộc nhằm nhấn mạnh điều gì?",
    type: "multiple-choice",
    options: [
      "Quyền quyết định vận mệnh, con đường phát triển của cộng đồng dân tộc",
      "Quyền đóng cửa không giao lưu với ai",
      "Quyền loại trừ các dân tộc khác",
      "Quyền chỉ tham gia kinh tế, không tham gia chính trị",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w10",
    text: "Thách thức nổi bật trong quan hệ dân tộc hiện nay liên quan đến phát triển là gì?",
    type: "multiple-choice",
    options: [
      "Chênh lệch trình độ phát triển kinh tế – xã hội giữa các vùng, các dân tộc",
      "Tất cả vùng đều phát triển ngang nhau",
      "Không còn vấn đề sinh kế",
      "Không còn khó khăn về hạ tầng",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w11",
    text: "Toàn cầu hóa có thể tác động đến văn hóa dân tộc theo hướng nào?",
    type: "multiple-choice",
    options: [
      "Chỉ mang lại lợi ích, không có rủi ro",
      "Chỉ làm mất văn hóa truyền thống",
      "Gia tăng nguy cơ mai một bản sắc nếu thiếu chọn lọc",
      "Hoàn toàn không ảnh hưởng đến văn hóa",
    ],
    correctAnswer: 2,
    timeLimit: 10,
  },
  {
    id: "w12",
    text: "Một thủ đoạn phổ biến của các thế lực thù địch lợi dụng vấn đề dân tộc là gì?",
    type: "multiple-choice",
    options: [
      "Xuyên tạc, phủ nhận chính sách dân tộc của Đảng và Nhà nước",
      "Khuyến khích đoàn kết và giao lưu văn hóa",
      "Tăng đầu tư hạ tầng vùng khó khăn",
      "Hỗ trợ giáo dục và y tế vùng dân tộc",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w13",
    text: "Vì sao những địa bàn vùng dân tộc thiểu số thường được xem là “chiến lược quan trọng”?",
    type: "multiple-choice",
    options: [
      "Vì liên quan đến quốc phòng – an ninh, kinh tế và môi trường sinh thái",
      "Vì chỉ có giá trị du lịch",
      "Vì không liên quan đến an ninh",
      "Vì chỉ tập trung ở đô thị",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w14",
    text: "Trong bối cảnh hiện nay, một khó khăn xã hội dễ phát sinh ở vùng dân tộc là gì?",
    type: "multiple-choice",
    options: [
      "Tranh chấp đất đai, tài nguyên, sinh kế, di cư tự do",
      "Không còn nhu cầu việc làm",
      "Không còn chênh lệch thông tin",
      "Không còn tác động từ hội nhập",
    ],
    correctAnswer: 0,
    timeLimit: 10,
  },
  {
    id: "w15",
    text: "Trách nhiệm phù hợp của sinh viên để góp phần bảo vệ khối đại đoàn kết dân tộc là gì?",
    type: "multiple-choice",
    options: [
      "Chia sẻ tin chưa kiểm chứng để “cảnh báo” mọi người",
      "Cảnh giác, kiểm chứng thông tin trước khi chia sẻ và tôn trọng sự khác biệt",
      "Tham gia bình luận công kích, kỳ thị dân tộc khác",
      "Thờ ơ, không quan tâm các vấn đề xã hội",
    ],
    correctAnswer: 1,
    timeLimit: 10,
  },
];

// Warm-up round duration: 3 minutes = 180 seconds
const WARMUP_DURATION = 180;

const BUZZER_QUESTIONS = [
  {
    "id": "1",
    "text": "Việt Nam hiện nay có tất cả bao nhiêu dân tộc anh em cùng chung sống trên một lãnh thổ thống nhất?",
    "type": "buzzer",
    "correctAnswer": null,
    "timeLimit": 60
  },
  {
    "id": "2",
    "text": "Dân tộc nào chiếm đa số (khoảng 85,3%) trong tổng dân số của Việt Nam?",
    "type": "buzzer",
    "correctAnswer": null,
    "timeLimit": 60
  },
  {
    "id": "3",
    "text": "Theo chủ nghĩa Mác - Lênin, có mấy xu hướng khách quan trong sự phát triển của quan hệ dân tộc?",
    "type": "buzzer",
    "correctAnswer": null,
    "timeLimit": 60
  },
  {
    "id": "4",
    "text": "Đặc điểm cư trú nổi bật nhất của các dân tộc ở Việt Nam là gì (tập trung hay xen kẽ)?",
    "type": "buzzer",
    "correctAnswer": null,
    "timeLimit": 60
  },
  {
    "id": "5",
    "text": "Một trong những truyền thống quý báu nhất của các dân tộc Việt Nam được hình thành trong quá trình dựng nước và giữ nước là gì?",
    "type": "buzzer",
    "correctAnswer": null,
    "timeLimit": 60
  }
]

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
            // Clear timer when game finishes
            if (timers.has(roomCode)) {
              clearInterval(timers.get(roomCode));
              timers.delete(roomCode);
            }

            gameState.phase = 'finished';
            gameState.currentQuestion = null; // Clear current question
            gameState.timeRemaining = 0; // Reset time
            gameState.buzzerEnabled = false;

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