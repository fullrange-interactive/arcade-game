$(document).ready(function pageReady() {

  var IS_DEV = false;

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
    var ip = '192.168.1.103'
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
      new Shield(0.48, 0.8);
      new Shield(1.125, 0.8);
      new Shield(1.77, 0.8);
      new Shield(2.42, 0.8);
      new Shield(3.07, 0.8);
      new Shield(3.69, 0.8);
      new Shield(4.35, 0.8);
      new Shield(5.04, 0.8);
      new Shield(5.74, 0.8);
      new Shield(6.38, 0.8);
      new Shield(7.02, 0.8);
      new Shield(7.67, 0.8);
      new Shield(8.32, 0.8);
      new Shield(8.96, 0.8);
      new Shield(9.61, 0.8);
    }
    makeShields();
  }

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
      for (var i = 0; i < Math.ceil(totalPlayers / 3); i++) {
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