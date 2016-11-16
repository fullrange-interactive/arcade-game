(function (global) {
  var MIN_SPEED = 0.4;
  var MAX_SPEED = 0.5;
  var ZONE_MARGIN = 0.2;
  var WIGGLE_SPEED = 8;
  var WIGGLE_AMPLITUDE = 0.01;

  var ATTACK_PROBABILITY = 0.003;

  var END_Y = 0.8;
  var GAME_OVER_Y = 0.95;
  var NUM_LINES = 7;

  var TURN_ACCEL_Y = 1.1;
  var TURN_ACCEL_X = 1.3;

  var SHOOT_INTERVAL = 3 * 1000;
  var SHOOT_SPEED = 0.5;

  var WARN_DURATION = 1;
  var WARN_MARGIN = 3;

  var SPRITES = ['squid', 'jellyfish', 'basic']

  global.MonsterBasic = Renderable.extend({
    lastShot: 0,
    direction: 1,
    zone: {start: 0, width: 0.4},
    source: 'enemy',
    isDead: false,
    initialize: function (x, y, zone, type) {
      this.renderableInitialize(true);

      this.x = x;
      this.y = this.py = y;
      this.vx = MIN_SPEED;
      this.vy = 0;
      this.zone = zone;

      // Set origin in the middle
      this.originX = 0.5;
      this.originY = 0.5;

      // Initialize wiggle
      this._wiggleSpeed = Math.random() * WIGGLE_SPEED + WIGGLE_SPEED;
      this._counter = 0;

      // Initialize movement
      this._doSwitch = true;
      this._lineAt = 0;
      this._direction = 1;

      // Initialize offense
      this._shootInterval = Math.random() * SHOOT_INTERVAL + SHOOT_INTERVAL;
      this._lastShoot = 0;


      if (!global.scene.monsters)
        global.scene.monsters = [];
      global.scene.monsters.push(this)

      // Initialize graphics
      this.dom = $("<div>")
        .addClass('monster sprite');
      if (type)
        this.dom.addClass(type)
      else
        this.dom.addClass(SPRITES[Math.floor(Math.random()*SPRITES.length)]);
      $(global.scene.dom).append(this.dom);
    },
    _warnTime: 0,
    simulate: function (dt) {
      // Movement
      if (this.isDead)
        return;
      var wigSpeed = this._wiggleSpeed;
      var speed = MIN_SPEED + (this._lineAt / NUM_LINES) * (MAX_SPEED - MIN_SPEED);
      var lineY = (this._lineAt + 1) * (END_Y / NUM_LINES);
      if (this._doSwitch) {
        if (this.x > this.zone.x + this.zone.w - ZONE_MARGIN) {
          this._direction = 0;
          this.vy = speed;
          wigSpeed = 0;
          if (this.py > lineY) {
            this._direction = -1;
            this.vy = 0;
            this.py = lineY;
            this.x = this.zone.x + this.zone.w - ZONE_MARGIN;
            this._lineAt++;
          }
        } else if (this.x < this.zone.x + ZONE_MARGIN) {
          this._direction = 0;
          this.vy = speed;
          wigSpeed = 0;
          if (this.py > lineY) {
            this._direction = 1;
            this.vy = 0;
            this.py = lineY;
            this.x = this.zone.x + ZONE_MARGIN;
            this._lineAt++;
          }
        }
      } else {
        this.vy = speed;
        this.vx = 0;
      }
      this.vx = speed * this._direction;

      this.x += this.vx * dt;
      this.py += this.vy * dt;

      // Offense
      if (Date.now() - this._lastShoot > this._shootInterval) {
        this.shoot();
        this._lastShoot = Date.now();
      }

      if (this._lineAt >= NUM_LINES - WARN_MARGIN && this._warnTime < WARN_DURATION) {
        this._warnTime += dt;
        global.scene.warn(this);
      }

      // Find a breach
      if (this._lineAt >= NUM_LINES - 1 ) {
        var probability = ATTACK_PROBABILITY;
        var x = this.x;
        var w = this._dims.w;

        for (var i in global.scene.shields) {
          var shield = global.scene.shields[i];
          if (shield.x > this.zone.w + this.zone.x) {
            break;
          }
        }
        var lastShield = global.scene.shields[i - 1];
        var beforeLastShield = global.scene.shields[i - 2];

        if (x > beforeLastShield.x + beforeLastShield._dims.w * 1.1 && x < lastShield.x)
          probability = 1;

        var overShield = false;
        for (var i in global.scene.shields) {
          var shield = global.scene.shields[i];
          if (
            (x - w / 2 > shield.x && x + w / 2 < shield.x + shield._dims.w)
            || (x - w / 2 < shield.x && x + w / 2 > shield.x )
            || (x - w / 2 < shield.x + shield._dims.w && x + w / 2 > shield.x + shield._dims.w)) {
            overShield = true;
            break;
          }
        }
        if (!overShield && Math.random() < probability ) {
          this.attack();
        }
      }

      // Wiggle
      this._counter += wigSpeed * dt;
      var wiggle = Math.sin(this._counter) * WIGGLE_AMPLITUDE;
      this.y = this.py + wiggle;

      if (this.py > END_Y) {
        this._doSwitch = false;
      }
      if (this.py > GAME_OVER_Y) {
        global.scene.gameOver(this);
        // this.renderableDestroy();
        // this.dom.remove();
      }

      this.checkCollisions('player-laser');
    },

    die: function () {
      this.isDead = true;
      this.dom.addClass('exploding');
      this.vx = this.vy = 0;
      setTimeout(function () {
        this.renderableDestroy();
        this.dom.remove();
      }.bind(this), 250);
    },

    attack: function () {
      this.vy = MAX_SPEED;
      this._direction = 0;
      this._doSwitch = false;
      this._wiggleSpeed = 0;
    },

    shoot: function () {
      this.lastShot = new Date().getTime();
      var posX = this.x;
      var newLaser = new Laser('enemy', posX, this.y, '#ffffff', SHOOT_SPEED);
    },

    onCollide: function (element, relX, relY) {
      global.Renderable.triggerEvent('monster-kill', this)
      if (global.scene.monsters) {
        var index =  global.scene.monsters.indexOf(this)
        if (index !== -1)
          global.scene.monsters.splice(index, 1);
      }
      element.renderableDestroy();
      element.dom.remove();
      this.die();
    },

    render: function () {
      if (!this.dom.hasClass('dangerous') && this._lineAt === NUM_LINES - WARN_MARGIN) {
        this.dom.addClass('dangerous');
      }
      this.renderableRender();
    }
  });
})(window);