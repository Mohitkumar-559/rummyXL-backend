const OLDTONEW = Object.freeze({
  userid: "userId",
  ue: "userEmail",
  un: "userName",
  EmailVerify: "emailVerify",
  MobileVerify: "mobileVerify",
  nwt: "networkType",
  ult: "userLoginType",
  rfc: "referralCode",
  pp: "profilePicture",
  det: "deviceType",
  DeviceId: "deviceID",
  state: "userState",
  ip: "deviceIP",
  phn: "mobileNumber",
  unique_id: "uniqueId",
  tId: "tableId",
  cd: "createDate",
  dids: "DeviceId",
  sn: "serialNumber",
  wc: "chipsForWinner",
  Chips: "userChips",
  totalcash: "totalCash",
  Unutilized: "unutilized",
  Winning: "winning",
  Bonus: "bonus",
  SignUpBonus: "signUpBonus",
  hw: "handsWin",
  hwc: "handsWinCashMode",
  hl: "handsLost",
  hlc: "handsLostCash",
  hd: "handsDropped",
  hdc: "handsDropCash",
  cw: "consecutiveWin",
  cl: "consecutiveLose",
  cdr: "consecutiveDrop",
  thp: "totalHandsPlayed",
  hpc: "totalHandsPlayCash",
  hp: "handsPlayLevelTracking",
  winTrigger: "winTrigger",
  loseStreak: "loseStreak",
  sc: "standupCounter",
  wsp: "winSharePopupCounter",
  thpcd: "totalHandsPlayCounter",
  pprc: "playPointRummyCounter",
  pplrc: "playPoolRummyCounter",
  pdrc: "playDealRummyCounter",
  pbrc: "playBetRummyCounter",
  ptc: "playTurnamentCounter",
  hcl: "highestChipLevel",
  mcw: "mostChipsWon",
  deal_c: "dealModeHelpSessionCounter",
  pool_c: "poolModeHelpSessionCounter",
  bet_c: "betModeHelpSessionCounter",
  lvc: "levelCompletedCounter",
  ppo: "currentLevelPoint",
  pper: "currentLevelCompletedPercentage",
  opc: "operationCounter",
  fdbk: "feedbackCounter",
  rpc: "reportProblemCounter",
  dbc: "dailyBonusCounter",
  invC: "inviteCounters",
  addcash: "addCashCounter",
  tacd: "addCashCounterDay",
  playDays: "playDays",
  spinDays: "spinDays",
  iv: "iosAppCersion",
  ivc: "iosAppVersionCode",
  av: "androidAppVersion",
  avc: "androidAppVersionCode",
  lc: "languageCode",
  _ir: "isRobot",
  _ftp: "firstTimePlaying",
  _isup: "isSuspended",
  _isbkip: "blockByIP",
  _isbkdv: "blockByDevice",
  _io: "isOnline",
  _pyr: "isPlayer",
  _noti: "notification",
  _snd: "sounds",
  _vib: "vibration",
  _challenge: "challange",
  _tutf: "tutorialFlag",
  _winshare: "winSharePopup",
  _shareSpinner: "sharePostSpinner",
  _isSpc: "isFirstTimeUser",
  _fPick: "firstPick",
  _fDiscard: "firstDiscard",
  _fActions: "firstActions",
  _fSort: "firstSort",
  _isRefered: "isRefered",
  _isRated: "isRated",
  _followfb: "followFacebook",
  _followtwe: "followtwitter",
  _followinsta: "followInstagram",
  pl: "previousLogin",
  ll: "lastLogin",
  llgt: "lastLogout",
  lpt: "lastPlayingTime",
  lac: "lastAddCash",
  ldt: "lastDeviceType",
  ldi: "lastDeviceId",
  ls: "lastSession",
  lwsp: "lastWinSharePopupTime",
  lsn: "lastSerialNumber",
  ldbt: "lastDailyBonusTime",
  lsct: "lastSpinCollectTime",
  lort: "lastOfferRejectTime",
  lrtt: "lastRetentionTime",
  lltt: "lastLoginTrackTime",
  lrpt: "lastRatePopupShowingTime",
  tournament: "tournament",
  playwithfriend: "playwithfriend",
  club: "club",
  claimRewards: "claimRewards",
  cAmount: "cashAmount",
  rlsAmount: "rummyLastAmount",
  tbd: "tableBackUpId",
  rand: "rand",
  tbid: "playTableId",
  rejoinID: "rejoinId",
  rejoin: "rejoinFlag",
  cbtn: "inGameNotification",
  ds: "downloadSource",
  ipad: "ipAddress",
  country: "country",
  cc: "countryCode",
  city: "city",
  bv: "bootValue",
  sck: "socketId",
  sessId: "sessionId",
  osType: "osOfDevice",
  osVer: "osVersion",
  devBrnd: "deviceBrand",
  devMdl: "deviceModel",
  ofId: "offerId",
  pCount: "playerCount",
  cpp: "cashPlayerPoints",
  catid: "categoryId",
  ap: "activePlayer",
  si: "seatIndex",
  uid: "userId",
  secTime: "secondTime",
  dps: "dealPoints",
  upc: "userPlayCash",
  bet: "betSetPlayers",
  s: "status",
  rfl: "referrer",
  op: "onlinePlayers",
  RemoveAfter: "removeAfter",
  pjid: "privateJobId",
  prjid: "privateRoundJobId",
  prlnt: "privateTableTimerFlag",
  use_bot: "useBot",
  tci: "tableCreatorId",
  minS: "minimumSeatsConfig",
  ms: "minimumSeats",
  bbv: "currentBet",
  tpr: "tablePoints",
  pt: "pointTable",
  gt: "gameType",
  tst: "tableStats",
  rndsts: "roundStatus",
  tid: "playerTableId",
  jiid: "playerJoinId",
  jt: "joinTime",
  gst: "gameStartTime",
  gedt: "gameEndTime",
  rndCount: "roundCount",
  rType: "robotType",
  indecl: "invalidDeclarations",
  tCount: "turnCount",
  ps: "pointsOfCards",
  tdps: "totalDealPoints",
  pts: "pointsMultipliedBootValue",
  sct: "secondaryTimer",
  tsd: "timerStart",
  ted: "timerEnd",
  cards: "playerCards",
  gCards: "groupCards",
  pure: "pureSequences",
  seq: "impureSequence",
  dwd: "deadwood",
  dCards: "delcaredCards",
  score: "userScore",
  pickCount: "cardsPickCount",
  nuser: "newUser",
  lpc: "lastPickedCard",
  _iw: "isWinner",
  dealewinner: "dealWinnerFlag",
  pco: "playerCashOut",
  isCollect: "isBootValueCollected",
  stdP: "standUpPlayersArray",
  cDeck: "closeDeck",
  oDeck: "openDeck",
  turn: "turnPlayerIndex",
  trCount: "trunCounter",
  asi: "arrayOfIndexActiveUsers",
  Timer: "timer",
  trnuid: "turnUserId",
  secT: "secondaryTimerFlag",
  maxRst: "maxRoundStartTime",
  tdsid: "TDSTrackingId",
  _stuck: "isStuck",
  _isWinner: "winnerHandlingFlag",
  _isLeave: "leaveStatus",
  uCount: "userCount",
  addtime: "addTime",
  dealwin: "dealWinner",
  sub_id: "subscriptionId",
  game_id: "gameId",
  rid: "roundId",
  ctt: "createTableTime",
  maxBet: "maxBetValue",
  pv: "potValue",
  fnsPlayer: "seatIndexOfFirstFinishedPlayer",
  declCount: "declarationCount",
  dealer: "roundDealerIndex",
  tjid: "tableJoinId",
  pi: "playerList",
  dscd: "discardedCards",
  rSeq: "roundSequence",
  ctth: "cardToThrow",
  tCard: "topCard",
  pChips: "playerChips",
  t: "turnTimer",
  tScore: "totalScore",
  tcards: "tableCards",
  wAnimation: "winAnimation",
});

const NEWTOOLD = Object.freeze({
  userId: "userid",
  userEmail: "ue",
  userName: "un",
  emailVerify: "EmailVerify",
  mobileVerify: "MobileVerify",
  networkType: "nwt",
  userLoginType: "ult",
  referralCode: "rfc",
  profilePicture: "pp",
  deviceType: "det",
  deviceID: "DeviceId",
  userState: "state",
  deviceIP: "ip",
  mobileNumber: "phn",
  uniqueId: "unique_id",
  tableId: "tId",
  createDate: "cd",
  DeviceId: "dids",
  serialNumber: "sn",
  chipsForWinner: "wc",
  userChips: "Chips",
  totalCash: "totalcash",
  unutilized: "Unutilized",
  winning: "Winning",
  bonus: "Bonus",
  signUpBonus: "SignUpBonus",
  handsWin: "hw",
  handsWinCashMode: "hwc",
  handsLost: "hl",
  handsLostCash: "hlc",
  handsDropped: "hd",
  handsDropCash: "hdc",
  consecutiveWin: "cw",
  consecutiveLose: "cl",
  consecutiveDrop: "cdr",
  totalHandsPlayed: "thp",
  totalHandsPlayCash: "hpc",
  handsPlayLevelTracking: "hp",
  winTrigger: "winTrigger",
  loseStreak: "loseStreak",
  standupCounter: "sc",
  winSharePopupCounter: "wsp",
  totalHandsPlayCounter: "thpcd",
  playPointRummyCounter: "pprc",
  playPoolRummyCounter: "pplrc",
  playDealRummyCounter: "pdrc",
  playBetRummyCounter: "pbrc",
  playTurnamentCounter: "ptc",
  highestChipLevel: "hcl",
  mostChipsWon: "mcw",
  dealModeHelpSessionCounter: "deal_c",
  poolModeHelpSessionCounter: "pool_c",
  betModeHelpSessionCounter: "bet_c",
  levelCompletedCounter: "lvc",
  currentLevelPoint: "ppo",
  currentLevelCompletedPercentage: "pper",
  operationCounter: "opc",
  feedbackCounter: "fdbk",
  reportProblemCounter: "rpc",
  dailyBonusCounter: "dbc",
  inviteCounters: "invC",
  addCashCounter: "addcash",
  addCashCounterDay: "tacd",
  playDays: "playDays",
  spinDays: "spinDays",
  iosAppCersion: "iv",
  iosAppVersionCode: "ivc",
  androidAppVersion: "av",
  androidAppVersionCode: "avc",
  languageCode: "lc",
  isRobot: "_ir",
  firstTimePlaying: "_ftp",
  isSuspended: "_isup",
  blockByIP: "_isbkip",
  blockByDevice: "_isbkdv",
  isOnline: "_io",
  isPlayer: "_pyr",
  notification: "_noti",
  sounds: "_snd",
  vibration: "_vib",
  challange: "_challenge",
  tutorialFlag: "_tutf",
  winSharePopup: "_winshare",
  sharePostSpinner: "_shareSpinner",
  isFirstTimeUser: "_isSpc",
  firstPick: "_fPick",
  firstDiscard: "_fDiscard",
  firstActions: "_fActions",
  firstSort: "_fSort",
  isRefered: "_isRefered",
  isRated: "_isRated",
  followFacebook: "_followfb",
  followtwitter: "_followtwe",
  followInstagram: "_followinsta",
  previousLogin: "pl",
  lastLogin: "ll",
  lastLogout: "llgt",
  lastPlayingTime: "lpt",
  lastAddCash: "lac",
  lastDeviceType: "ldt",
  lastDeviceId: "ldi",
  lastSession: "ls",
  lastWinSharePopupTime: "lwsp",
  lastSerialNumber: "lsn",
  lastDailyBonusTime: "ldbt",
  lastSpinCollectTime: "lsct",
  lastOfferRejectTime: "lort",
  lastRetentionTime: "lrtt",
  lastLoginTrackTime: "lltt",
  lastRatePopupShowingTime: "lrpt",
  tournament: "tournament",
  playWithFriend: "playwithfriend",
  club: "club",
  claimRewards: "claimRewards",
  cashAmount: "cAmount",
  rummyLastAmount: "rlsAmount",
  tableBackUpId: "tbd",
  rand: "rand",
  playTableId: "tbid",
  rejoinId: "rejoinID",
  rejoinFlag: "rejoin",
  inGameNotification: "cbtn",
  downloadSource: "ds",
  ipAddress: "ipad",
  country: "country",
  countryCode: "cc",
  city: "city",
  bootValue: "bv",
  socketId: "sck",
  sessionId: "sessId",
  osOfDevice: "osType",
  osVersion: "osVer",
  deviceBrand: "devBrnd",
  deviceModel: "devMdl",
  offerId: "ofId",
  playerCount: "pCount",
  cashPlayerPoints: "cpp",
  categoryId: "catid",
  activePlayer: "ap",
  seatIndex: "si",
  secondTime: "secTime",
  dealPoints: "dps",
  userPlayCash: "upc",
  betSetPlayers: "bet",
  status: "s",
  referrer: "rfl",
  onlinePlayers: "op",
  isBlock: "IsBlock",
  removeAfter: "RemoveAfter",
  privateJobId: "pjid",
  privateRoundJobId: "prjid",
  privateTableTimerFlag: "prlnt",
  useBot: "use_bot",
  tableCreatorId: "tci",
  minimumSeatsConfig: "minS",
  minimumSeats: "ms",
  currentBet: "bbv",
  tablePoints: "tpr",
  pointTable: "pt",
  gameType: "gt",
  tableStats: "tst",
  roundStatus: "rndsts",
  playerTableId: "tid",
  playerJoinId: "jiid",
  joinTime: "jt",
  gameStartTime: "gst",
  gameEndTime: "gedt",
  roundCount: "rndCount",
  robotType: "rType",
  invalidDeclarations: "indecl",
  turnCount: "tCount",
  pointsOfCards: "ps",
  totalDealPoints: "tdps",
  pointsMultipliedBootValue: "pts",
  secondaryTimer: "sct",
  timerStart: "tsd",
  timerEnd: "ted",
  playerCards: "cards",
  groupCards: "gCards",
  pureSequences: "pure",
  impureSequence: "seq",
  deadwood: "dwd",
  delcaredCards: "dCards",
  userScore: "score",
  cardsPickCount: "pickCount",
  newUser: "nuser",
  lastPickedCard: "lpc",
  isWinner: "_iw",
  dealWinnerFlag: "dealewinner",
  playerCashOut: "pco",
  isBootValueCollected: "isCollect",
  standUpPlayersArray: "stdP",
  closeDeck: "cDeck",
  openDeck: "oDeck",
  turnPlayerIndex: "turn",
  trunCounter: "trCount",
  arrayOfIndexActiveUsers: "asi",
  timer: "Timer",
  turnUserId: "trnuid",
  secondaryTimerFlag: "secT",
  maxRoundStartTime: "maxRst",
  TDSTrackingId: "tdsid",
  isStuck: "_stuck",
  winnerHandlingFlag: "_isWinner",
  leaveStatus: "_isLeave",
  userCount: "uCount",
  addTime: "addtime",
  dealWinner: "dealwin",
  subscriptionId: "sub_id",
  gameId: "game_id",
  roundId: "rid",
  createTableTime: "ctt",
  maxBetValue: "maxBet",
  potValue: "pv",
  seatIndexOfFirstFinishedPlayer: "fnsPlayer",
  declarationCount: "declCount",
  roundDealerIndex: "dealer",
  tableJoinId: "tjid",
  playerList: "pi",
  discardedCards: "dscd",
  roundSequence: "rSeq",
  cardToThrow: "ctth",
  topCard: "tCard",
  playerChips: "pChips",
  turnTimer: "t",
  totalScore: "tScore",
  tableCards: "tcards",
  winAnimation: "wAnimation",
});

const exportObject = Object.freeze({ OLDTONEW, NEWTOOLD });

module.exports = exportObject;
