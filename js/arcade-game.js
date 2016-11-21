$(document).ready(function pageReady() {

  var IS_DEV = true;

  var SHIELDS_AMOUNT = 6;

  var NUM_ZONES = 6;
  var MONSTER_FREQUENCY = 1200;
  var MONSTER_BURST_AMOUNT = 4;
  var MONSTER_BURST_WAIT = 1;

  var MAX_IDLE_TIME = 30000;

  var MAX_PLAYERS = 8;

  var playerColors = [];
  for (var i = 0; i < MAX_PLAYERS; i++) {
    var rgb = hslToRgb(i / MAX_PLAYERS, 1, 0.7);
    playerColors.push(rgbToHex(rgb[0], rgb[1], rgb[2]));
  }

  var remainingColors = JSON.parse(JSON.stringify(playerColors));

  var playerIds = {};
  var waitingPlayers = {};
  var kickedPlayers = {};
  var totalPlayers = 0;
  var totalWaiting = 0;

  var isGameOver = false;

  function createPlayerForId(id) {
    if (playerIds[id]) {
      return false;
    }
    if (totalPlayers === MAX_PLAYERS) {
      var exists = false;
      if (typeof waitingPlayers[id] !== 'undefined') {
        totalWaiting++;
      } else {
        exists = true;
      }
      waitingPlayers[id] = Date.now();
      return !exists;
    }
    if (!spaceships[id]) {
      if (!playerIds[id]) {
        var cIndex = Math.floor(Math.random() * remainingColors.length);
        var color = remainingColors.splice(cIndex, 1)[0];
      } else {
        var color = playerIds[id];
      }

      spaceships[id] = new Spaceship(id, Math.random() * window.scene.oDims.w, color);
      playerIds[id] = color;
      totalPlayers++;
      // clearInterval(newMonsterInterval);
      // newMonsterInterval = setInterval(monsterInterval, MONSTER_FREQUENCY - (totalPlayers / 2) * 100);
      if (waitingPlayers[id]) {
        delete waitingPlayers[id];
      }
      if (kickedPlayers[id]) {
        delete kickedPlayers[id];
      }
      return true;
    }
    return false;
  }

  setInterval(function () {
    var kicked = false;
    for (var i in waitingPlayers) {
      if (Date.now() - waitingPlayers[i] > MAX_IDLE_TIME) {
        delete waitingPlayers[i];
        totalWaiting--;
        kicked = true;
      }
    }
    if (kicked) {
      saveState(connection);
    }
  }, 15000);

  function saveState(connection) {
    connection.sendMessage({
      type: 'saveState',
      data: {
        playerIds: playerIds,
        waitingPlayers: waitingPlayers,
        kickedPlayers: kickedPlayers
      }
    });
  }

  function onOpen(connection) {
    connection.sendMessage({
      type: 'hello',
      data: {
        game: 'arcade-game'
      }
    });
  }

  // When you receive something (including pings), this function will be called
  // with the parsed JSON message all ready for you in parsedMessage.
  function onMessage(connection, parsedMessage) {
    switch (parsedMessage.type) {
      case 'shoot':
        if (!spaceships[parsedMessage.data.userId]) {
          createPlayerForId(parsedMessage.data.userId);
          saveState(connection);
        }
        spaceships[parsedMessage.data.userId].shoot();
        break;
      case 'set-accel':
        if (!spaceships[parsedMessage.data.userId]) {
          createPlayerForId(parsedMessage.data.userId);
          saveState(connection);
        }
        spaceships[parsedMessage.data.userId].setAccel(parseFloat(parsedMessage.data.accel));
        break;
      case 'new-player':
        if (!spaceships[parsedMessage.data.userId]) {
          if (createPlayerForId(parsedMessage.data.userId)) {
            saveState(connection);
          }
        }
      case 'hello':
        saveState(connection);
        break;
      default:
        break;
    }
  }

  if (IS_DEV) {
    var ip = 'localhost'
  } else {
    var ip = 'lausanne.pimp-my-wall.ch'
  }

  var connection = new WebsocketConnection(
    ip,
    8000,
    {
      open: onOpen,
      close: function () {},
      message: onMessage
    }, {
      autoConnect: true,
      autoReconnect: true
    }
  );

  window.createScene($('#scene'));

  function onResize() {
    $('#scene').css('width', $('#overlay').width() + 'px');
    $('#scene').css('height', $('#overlay').height() + 'px');
    window.scene.updateDims();
  };
  $(window).on('resize', onResize);
  onResize();

  var spaceships = {};
  var monsters = [];

  var newMonsterInterval = null;

  var score = 0;
  Renderable.addListener('monster-kill', function (element) {
    score += 100;
    $(".score").each(function () {
      $(this).text('Score: ' + score)
    })
  });

  Renderable.addListener('player-inactive', function (element) {
    remainingColors.push(element.color);
    totalPlayers--;
    // clearInterval(newMonsterInterval);
    // newMonsterInterval = setInterval(monsterInterval, MONSTER_FREQUENCY - (totalPlayers / 2) * 100);
    element.die();
    delete playerIds[element.userId];
    delete spaceships[element.userId];

    var userId = element.userId;

    kickedPlayers[element.userId] = true;
    element.dom.remove();
    element.renderableDestroy();

    if (totalWaiting > 0) {
      for (var i in waitingPlayers) {
        if (totalPlayers >= MAX_PLAYERS) {
          break;
        }
        delete waitingPlayers[i];
        createPlayerForId(i);
        totalWaiting--;
      }
    }

    saveState(connection);

    // remove him from the kicked list after a while just in case
    setTimeout(function () {
      if (kickedPlayers[userId]) {
        delete kickedPlayers[userId];
      }
      saveState(connection);
    }, 100000)
  });

  scene.onGameOver = function () {
    isGameOver = true;
    var countDown = 10;
    var countDownInterval = setInterval(function () {
      countDown--;
      if (countDown === -1) {
        isGameOver = false;
        spaceships = {};
        monsters = [];
        score = 0;
        window.scene.reset();
        clearInterval(countDownInterval);
        initWorld();
        return;
      } 
      $(".game-over .countdown-value").html(countDown);
      $(".game-over .score-value").html(score);
    }.bind(this), 1000)
  }.bind(this);

  function initWorld() {
    score = 0;
    var newSpaceShip = new Spaceship('bot', Math.random() * window.scene.oDims.w, '#ffffff');
    spaceships['bot'] = newSpaceShip;

    for (var i in playerIds) {
      spaceships[i] = new Spaceship(i, Math.random() * window.scene.oDims.w, playerIds[i]);
    }

    // Create shields
    function makeShields() {
      new Shield(0.437, 0.8);
      new Shield(1.020, 0.8);
      new Shield(1.613, 0.8);
      new Shield(2.205, 0.8);
      new Shield(2.797, 0.8);
      new Shield(3.362, 0.8);
      new Shield(3.964, 0.8);
      new Shield(4.593, 0.8);
      new Shield(5.230, 0.8);
      new Shield(5.814, 0.8);
      new Shield(6.397, 0.8);
      new Shield(6.989, 0.8);
      new Shield(7.582, 0.8);
      new Shield(8.165, 0.8);
      new Shield(8.757, 0.8);
      // new Shield(0.593912398, 0.8);
      // new Shield(1.187824796, 0.8);
      // new Shield(1.781737194, 0.8);
      // new Shield(2.375649592, 0.8);
      // new Shield(2.96956199, 0.8);
      // new Shield(3.563474388, 0.8);
      // new Shield(4.157386785, 0.8);
      // new Shield(4.751299183, 0.8);
      // new Shield(5.345211581, 0.8);
      // new Shield(5.939123979, 0.8);
      // new Shield(6.533036377, 0.8);
      // new Shield(7.126948775, 0.8);
      // new Shield(7.720861173, 0.8);
      // new Shield(8.314773571, 0.8);
    }
    makeShields();
  }

3.563474388
4.157386785
4.751299183
5.345211581
5.939123979
6.533036377
7.126948775
7.720861173
8.314773571









  var zones = [];
  for (var i = 0; i < NUM_ZONES; i++) {
    var zone = {
      x: i * window.scene.oDims.w / NUM_ZONES,
      w: window.scene.oDims.w / NUM_ZONES
    }
    zones.push(zone);
  }

  var numMonsters = 0;
  var waitMonsters = 0;
  var zone = zones[Math.floor(Math.random() * zones.length)];
  function monsterInterval() {
    if (isGameOver)
      return;
    // return;
    if (waitMonsters <= Math.max(0, MONSTER_BURST_WAIT - totalPlayers)) {
      waitMonsters++;
      numMonsters = 0;
      return;
    }
    if (totalPlayers > 4) {
      zone = zone = zones[Math.floor(Math.random() * zones.length)];
    }
    if (numMonsters < MONSTER_BURST_AMOUNT + totalPlayers * 3) {
      for (var i = 0; i < Math.ceil(Math.max(totalPlayers, 1) / 3); i++) {
        monsters.push(new MonsterBasic(zone.x + zone.w * (Math.random() * 0.25 + 0.25), -0.05, zone));
        numMonsters++;
        zone = zone = zones[Math.floor(Math.random() * zones.length)];
      }
    }
    if (numMonsters >= MONSTER_BURST_AMOUNT + totalPlayers * 3) {
      zone = zones[Math.floor(Math.random() * zones.length)];
      waitMonsters = 0;
    }
  }

  newMonsterInterval = setInterval(monsterInterval, MONSTER_FREQUENCY);
  initWorld();
});