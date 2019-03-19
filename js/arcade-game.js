$(document).ready(function pageReady() {

  var IS_DEV = false;

  var SHIELDS_AMOUNT = 6;

  var NUM_ZONES = 5;
  var MONSTER_FREQUENCY = 1200;
  var MONSTER_BURST_AMOUNT = 4;
  var MONSTER_BURST_WAIT = 0.4;

  var MAX_IDLE_TIME = 30000;

  var MAX_PLAYERS = 8;

  var MAX_NUM_MONSTERS = 8;

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

      spaceships[id] = new Spaceship(id, Math.random() * window.scene.oDims.w * 0.66, color);
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

  // var numMonsters = 0;

  Renderable.addListener('monster-kill', function (element) {
    console.log('monster died');
    // numMonsters--;
    score += 100;
    $(".score").each(function () {
      $(this).text('Score: ' + score)
    })
    $('#score-2').html('Score:<br>' + score);
    if (monsters.indexOf(element) >= 0) {
      monsters.splice(monsters.indexOf(element), 1);
    }
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
    waitZeroMonsters = false;
    generatedMonsters = 0;
    // numMonsters = 0;
    var newSpaceShip = new Spaceship('bot', Math.random() * window.scene.oDims.w * 0.66, '#ffffff');
    spaceships['bot'] = newSpaceShip;

    for (var i in playerIds) {
      spaceships[i] = new Spaceship(i, Math.random() * window.scene.oDims.w * 0.66, playerIds[i]);
    }

    // Create shields
    function makeShields() {
      new Shield(0.437 - 0.3, 0.8);
      new Shield(0.920 - 0.3, 0.8);
      new Shield(1.413 - 0.3, 0.8);
      new Shield(1.920 - 0.3, 0.8);
      // new Shield(2.205 - 0.3, 0.8);
      // new Shield(2.797 - 0.3, 0.8);
      // new Shield(3.362 - 0.3, 0.8);
      // new Shield(3.964 - 0.3, 0.8);
      // new Shield(4.593 - 0.3, 0.8);
      // new Shield(5.230 - 0.3, 0.8);
      // new Shield(5.814 - 0.3, 0.8);
      // new Shield(6.397, 0.8);
      // new Shield(6.989, 0.8);
      // new Shield(7.582, 0.8);
      // new Shield(8.165, 0.8);
      // new Shield(8.757, 0.8);
    }
    makeShields();
  }

  var zones = [
    {
      subZones: [
        {x: 0.0, w: 1},
        // {x: 0.22, w: 0.22},
        // {x: 0.44, w: 0.22}
      ]
    },
    // {
    //   subZones: [
    //     {x: 0.66, w: 0.14},
    //     {x: 0.8, w: 0.2}
    //   ]
    // },
    // {
    //   subZones: [
    //     {x: 0.6, w: 0.2},
    //     {x: 0.8, w: 0.2}
    //   ]
    // }
  ];
  for (var i in zones) {
    for (var j in zones[i].subZones) {
      zones[i].subZones[j].x *= window.scene.oDims.w;
      zones[i].subZones[j].w *= window.scene.oDims.w;
    }
  }

  var zone = zones[Math.floor(Math.random() * zones.length)];

  var waitZeroMonsters = false;
  var generatedMonsters = 0;

  function monsterInterval() {
    if (isGameOver)
      return;

    if (waitZeroMonsters && monsters.length > 0) {
      console.log('waiting...')
      return;
    } else if (waitZeroMonsters && monsters.length == 0) {
      waitZeroMonsters = false;
      generatedMonsters = 0;
    }

    if (generatedMonsters > MAX_NUM_MONSTERS) {
      zone = zone = zones[Math.floor(Math.random() * zones.length)];
      console.log('Changing zone')
      waitZeroMonsters = true;
      return;
    }

    for (var i = 0; i < 1; i++) {
      var subZone = zone.subZones[Math.floor(Math.random() * zone.subZones.length)];

      monsters.push(new MonsterBasic(subZone.x + subZone.w * 0.5, -0.05, subZone));
      // numMonsters++;
      generatedMonsters++;
    }
  }

  newMonsterInterval = setInterval(monsterInterval, MONSTER_FREQUENCY);
  initWorld();
});