(function (global) {
  var MIN_TIME_BETWEEN_SHOTS = 150;
  var MAX_SPEED = 10;
  var FRICTION = 0.5;

  var MAX_ACCEL = 30;

  var INVINCIBILITY_TIME = 5000;
  var DEATH_TIME = 3000;

  var LASER_SPEED = 1.2;

  var INACTIVITY_TIME = 30000;

  // var AI_CHANGE_TARGET_PROBABILITY = 0.01;
  var AI_SHOOT_PROBABILITY = 0.1;
  var AI_POSITION_MARGIN = 0.02;
  var AI_POSITION_ANTICIPATION = 0.05;
  var AI_CLOSE_ACCEL = 20;
  var AI_ACCEL_K = 0.8;
  var AI_MIN_SHOOT_DISTANCE = 1.5;
  var AI_ERROR_PROBABILITY = 0.01;
  var AI_BAD_TARGET_PROBABILITY = 0.01;

  global.Spaceship = Renderable.extend({
    lastShot: 0,
    source: 'player',
    dead: false,
    invincible: true,
    lastActivity: null,
    type: 'spaceship',
    initialize: function (id, x, color) {
      this.renderableInitialize(true);
      this.color = color;
      this.x = x;
      this.y = 0.92;
      this.vx = 0;
      this.vy = 0;
      this.ax = 0;
      this.ay = 0;

      this.userId = id;

      this.originX = 0.5;
      this.originY = 0.5;

      this.dom = $("<div>").addClass('spaceship sprite' );
      $(global.scene.dom).append(this.dom);

      this.lastActivity = Date.now();

      this.relive();
    },

    shoot: function () {
      this.lastActivity = Date.now();
      if (this.dead) {
        return;
      }
      this.getDims();
      // global.scene.gameOver(this);
      if (new Date().getTime() - this.lastShot < MIN_TIME_BETWEEN_SHOTS){
        return;
      }
      this.lastShot = new Date().getTime();
      var newLaser = new Laser('player-laser', this.x, this.y - this._dims.h / 2, this.color, -LASER_SPEED);
    },

    setAccel: function (a) {
      if (a > MAX_ACCEL)
        a = MAX_ACCEL;
      else if (a < -MAX_ACCEL)
        a = -MAX_ACCEL
      this.ax = a;
      this.lastActivity = Date.now();
    },

    _currentTarget: null,
    ai: function () {
      function findTarget() {
        if (global.scene.monsters) {
          var greatestY = 0;
          var greatestYIndex = 0;
          for (var i in global.scene.monsters) {
            if (global.scene.monsters[i].py > greatestY) {
              greatestY = global.scene.monsters[i].py;
              greatestYIndex = i;
            }
            if (Math.random() < AI_BAD_TARGET_PROBABILITY) {
              greatestY = global.scene.monsters[i].py;
              greatestYIndex = i;
              break;
            }
          }
          return global.scene.monsters[greatestYIndex];
        } else {
          return null;
        }
      }
      if (typeof this._currentTarget === 'undefined' || this._currentTarget === null || this._currentTarget.isDead) {
        this._currentTarget = findTarget();
      }
      if (typeof this._currentTarget === 'undefined' || this._currentTarget === null || this._currentTarget.isDead) {
        return;
      }
      var dist = this._currentTarget.x - this.x;
      var distY = Math.max(0.3, Math.min(1, Math.abs(this._currentTarget.y - this.y)));
      if (this._currentTarget.vx < 0) {
        dist -= AI_POSITION_ANTICIPATION * (distY) - this._currentTarget.vx * (distY + 0.4);
      } else {
        dist += AI_POSITION_ANTICIPATION * (distY) + this._currentTarget.vx * (distY + 0.4);
      }

      if (Math.abs(dist) < AI_POSITION_MARGIN) {
        this.setAccel(0);
      } else {
        this.setAccel(dist * MAX_ACCEL / AI_ACCEL_K);
      }

      if (Math.random() < AI_SHOOT_PROBABILITY && Math.abs(dist) < AI_MIN_SHOOT_DISTANCE) {
        var underShield = false;
        for (var i in global.scene.shields) {
          var shield = global.scene.shields[i];
          if (shield.x - shield._dims.w / 2 > this.x) {
            break;
          }
          if (shield.x - shield._dims.w / 2 < this.x 
            && shield.x + shield._dims.w / 2 > this.x) {
            underShield = true;
            break;
          }
        }
        if (!underShield || Math.random() < AI_ERROR_PROBABILITY) {
          this.shoot();
        }
      }
    },

    simulate: function (dt) {
      if (this.userId === 'bot') {
        this.ai();
      }
      if (this.dead) {
        this.ax = 0;
        this.ay = 0;
        this.vx = 0;
        this.vy = 0;
        return;
      }

      if (Date.now() - this.lastActivity > INACTIVITY_TIME && this.userId !== 'bot') {
        global.Renderable.triggerEvent('player-inactive', this);
        return;
      }

      this.vx += this.ax * dt;
      this.vy += this.ay * dt;

      if (this.vx > MAX_SPEED)
        this.vx = MAX_SPEED;
      if (this.vx < -MAX_SPEED)
        this.vx = -MAX_SPEED;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Friction
      this.vx *= 1 / (1 + (dt + FRICTION));

      if (this.x < 0) {
        this.x = 0;
        this.vx *= -1;
      }
      if (!this._dims) {
        this.getDims();
      }
      if (this.x + this._dims.w / 2 > global.scene.oDims.w * 0.66) {
        this.x = global.scene.oDims.w * 0.66 - this._dims.w / 2;
        this.vx *= -1;
      }
    },

    onCollide: function (element, relX, relY) {
      if (this.dead) {
        return;
      }
      if (!this.invincible) {
        this.die();
      }
      if (element.type === 'monster') {
        element.die();
      } else {
        element.renderableDestroy();
        element.dom.remove();
      }
      global.Renderable.triggerEvent('player-kill', this);
    },

    die: function () {
      this.dead = true;
      if (this.reliveTimeout) {
        clearTimeout(this.reliveTimeout);
      }
      this.dom.addClass('exploding');
      setTimeout(function () {
        this.dom.removeClass('exploding');
        this.dom.addClass('dead');
        this.reliveTimeout = setTimeout(this.relive.bind(this), DEATH_TIME);
      }.bind(this), 250)
    },

    relive: function () {
      if (this.invincibilityTimeout) {
        clearTimeout(this.invincibilityTimeout);
      }
      this.invincible = true;
      this.dead = false;
      this.dom.removeClass('exploding');
      this.dom.removeClass('dead');
      this.dom.addClass('invincible');
      this.invincibilityTimeout = setTimeout(function () {
        this.invincible = false;
        this.dom.removeClass('invincible');
      }.bind(this), INVINCIBILITY_TIME)
    },

    render: function () {
      this.renderableRender();

      var curColor = this.color;
      if (this.dom.hasClass('exploding')) {
        curColor = 'transparent'
      };

      this.dom.css({
        backgroundColor: curColor,
        // filter: 'url(#spaceship-blur)'
      });
      // var filters = document.querySelector(".filters"), // the SVG that contains the filters
      // defs = filters.querySelector("defs"), // the  element inside the SVG
      // blur = defs.querySelector("#spaceship-blur"), // the blur filter
      // blurFilter = blur.firstElementChild; // the feGaussianBlur primitive
      // var blurAmount = Math.abs(Math.round(this.unitsToPixels('x', this.vx / 100)));
      // blurFilter.setAttribute('stdDeviation', blurAmount + ",0");
    }
  });
})(window);