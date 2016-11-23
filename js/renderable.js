(function (global) {
  // You can make substeps to the simulation for more precision
  var SIMULATE_STEPS = 1;
  var SIMULATE_INTERVAL = 15;

  var GAME_OVER_CIRCLE_TIME = 1.0;
  var GAME_OVER_CIRCLE_K = 5;

  var WARN_TIME = 500;
  var WARN_MARGIN = 0.02;

  global.Renderable = Class.extend({
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
    type: 'renderable',
    renderableInitialize: function (collideable) {
      global.scene.addRenderable(this, collideable);
    },
    renderableDestroy: function () {
      global.scene.removeRenderable(this);
    },
    getDims: function () {
      if (!this._dims) {
        this._dims = {
          w: this.pixelsToUnits('x', this.dom.width()),
          h: this.pixelsToUnits('y', this.dom.height())
        };
      }
    },
    renderableRender: function () {
      if (!this._domElement)
        this._domElement = this.dom.get(0);
      this.getDims();
      var x = this.unitsToPixels('x', this.x);
      var y = this.unitsToPixels('y', this.y);
      x -= this.unitsToPixels('x', this.originX * this._dims.w);
      y -= this.unitsToPixels('y', this.originY * this._dims.h);
      this._domElement.style.transform = "translate(" + x + "px, " + y + "px)";
    },
    render: function () {
      this.renderableRender();
    },
    /** We need a orthonormous grid - use height for both x and y */
    unitsToPixels: function (dimension, units) {
      if (dimension === 'x') {
        return global.scene.dims.h * units;
      } else if (dimension === 'y'){
        return global.scene.dims.h * units;
      } else {
        throw "Illegal dimension in unitsToPixel:" + dimension;
      }
    },
    pixelsToUnits: function (dimension, pixels) {
      if (dimension === 'x') {
        return pixels / global.scene.dims.h;
      } else if (dimension === 'y') {
        return pixels / global.scene.dims.h;
      } else {
        throw "Illegal dimension in pixelsToUnits:" + pixels;
      }
    },
    onCollide: function (element) {
      console.log('collide');
    },
    checkCollisions: function (exclude) {
      for (var k in global.scene.collideables) {
        if (k === this.source || (exclude && k === exclude)) {
          continue;
        }
        for (var i in global.scene.collideables[k]) {
          if (!this._dims) {
            this._dims = {
              w: this.pixelsToUnits('x', this.dom.width()),
              h: this.pixelsToUnits('y', this.dom.height())
            };
          }
          var me = {
            x: this.x - this.originX * this._dims.w,
            y: this.y - this.originY * this._dims.h,
            w: this._dims.w,
            h: this._dims.h
          }
          if (!global.scene.collideables[k][i]._dims) {
            global.scene.collideables[k][i]._dims = {
              w: this.pixelsToUnits('x', global.scene.collideables[k][i].dom.width()),
              h: this.pixelsToUnits('y', global.scene.collideables[k][i].dom.height())
            }
          }
          var him = {
            x: global.scene.collideables[k][i].x - global.scene.collideables[k][i].originX * global.scene.collideables[k][i]._dims.w,
            y: global.scene.collideables[k][i].y - global.scene.collideables[k][i].originY * global.scene.collideables[k][i]._dims.h,
            w: global.scene.collideables[k][i]._dims.w,
            h: global.scene.collideables[k][i]._dims.h
          }
          if (global.scene.collideables[k][i].source === this.source) {
            continue;
          }
          var collides = false;
          if (me.x > him.x && me.x < him.x + him.w) {
            if (me.y > him.y && me.y < him.y + him.h)
              collides = true;
            if (me.y + me.h > him.y && me.y < him.y)
              collides = true;
          }
          if (me.x + me.w > him.x && me.x < him.x) {
            if (me.y > him.y && me.y < him.y + him.h)
              collides = true;
            if (me.y + me.h > him.y && me.y < him.y)
              collides = true;
          }
          if (collides) {
            global.scene.collideables[k][i].onCollide(this, me.x - him.x, me.y - him.y);
            return;
          }
        }
      }
    }
  });


  global.Renderable._listeners = {};

  global.Renderable.triggerEvent = function (type, element) {
    if (this._listeners[type])
      for (var i in this._listeners[type]) {
        this._listeners[type][i](element)
      }
  }

  global.Renderable.addListener = function (type, callback) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(callback);
  }

  global.Renderable.removeListener = function (type, callback) {
    if (this._listenrs[type]) {
      var index = this._listeners[type].indexOf(callback);
      this._listeners[type].splice(index, 1);
    }
  }

  var Scene = Class.extend({
    _renderables: [],
    collideables: {},
    dom: null,
    last: null,
    _doSim: true,
    _gameOver: false,
    _gameOverRenderable: null,
    initialize: function (dom) {
      this.dom = dom;
      this.last = Date.now();
      setInterval(this.simulateDT.bind(this), SIMULATE_INTERVAL);
      global.requestAnimationFrame(this.loop.bind(this));
      this.dims = {
        w: $(dom).width(),
        h: $(dom).height()
      }
    },
    reset: function () {
      for (var i in this._renderables) {
        this._renderables[i].dom.remove();
      }
      $('.game-over').removeClass('visible');
      this._circler.remove();
      this._circleSize = null;
      this._renderables = [];
      this.collideables = {};
      this._doSim = true;
      this._gameOver = false;
      this._gameOverRenderable = null;
      this.shields = [];
      this.monsters = [];
    },
    simulateDT: function () {
      // SIMULATE LAG
      // if (Math.random() < 0.7)
      //   return;
      var time = Date.now();
      if (!this.last) {
        this.last = time;
      }
      var dt = time - this.last;
      this.last = time;
      for (var i = 0; i < dt; i += dt / SIMULATE_STEPS) {
        this.simulate((dt / SIMULATE_STEPS) / 1000);
      }
    },
    updateDims: function () {
      this.dims = {
        w: $(this.dom).width(),
        h: $(this.dom).height()
      }
      // Orthonormous dimensions
      this.oDims = {
        w: this.dims.w / this.dims.h,
        h: 1
      }
    },
    render: function () {
      for (var i in this._renderables) {
        this._renderables[i].render();
      }
      if (this._gameOver) {
        var canvas = this._circler.get(0);
        var ctx = canvas.getContext('2d');
        var r = this._gameOverRenderable;
        var targetSize = r._dims.w * 3;
        var x = r.x / this.oDims.w * canvas.width;
        var y = r.y / this.oDims.h * canvas.height;
        this._circleSize -= (this._circleSize - targetSize) / GAME_OVER_CIRCLE_K;

        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.beginPath();
        // this._circleSize * this.dims.w / 2, this._circleSize * this.dims.w / 2
        ctx.ellipse(x, y, (this._circleSize / this.oDims.w) * (this.dims.w / 2), (this._circleSize / this.oDims.w) * (this.dims.w / 2), 0, 0, 2 * Math.PI, false);
        ctx.clip();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    },
    simulate: function (dt) {
      if (!this._doSim)
        return;
      for (var i in this._renderables) {
        this._renderables[i].simulate(dt);
      }
    },
    loop: function (time) {
      this.render();
      if (!this.last) {
        this.last = time;
      }
      var dt = time - this.last;
      // this.last = time;
      // this.simulate(dt / 1000);
      global.requestAnimationFrame(this.loop.bind(this));
    },
    addRenderable: function (renderable, collideable) {
      this._renderables.push(renderable);
      if (collideable) {
        if (typeof this.collideables[renderable.source] === 'undefined') {
          this.collideables[renderable.source] = [];
        }
        this.collideables[renderable.source].push(renderable);
        renderable._collideable = true;
      }
    },
    removeRenderable: function (renderable) {
      var index = this._renderables.indexOf(renderable);
      if (index >= 0) {
        this._renderables.splice(index, 1);
      }
      if (renderable._collideable) {
        var index = this.collideables[renderable.source].indexOf(renderable);
        if (index >= 0) {
          this.collideables[renderable.source].splice(index, 1);
        }
      }
    },
    gameOver: function (renderable) {
      this._circler = $('<canvas>').addClass('game-over-canvas');
      $(this.dom).append(this._circler);
      this._circler.get(0).width = $(this.dom).width();
      this._circler.get(0).height = $(this.dom).height();
      this._doSim = false;
      this._gameOver = true;
      this._gameOverRenderable = renderable;
      this._circleSize = this.oDims.w;
      setTimeout(function () {
        $("#game-over-1").addClass('visible')
      }, 1000);
      setTimeout(function () {
        $("#game-over-2").addClass('visible')
      }, 1300);
      setTimeout(function () {
        $("#game-over-3").addClass('visible')
      }, 1600);
      if (this.onGameOver) {
        this.onGameOver();
      }
    },
    warn: function (renderable) {
      $("#warner").addClass('visible');
      var lw = Math.max(0, renderable.x / this.oDims.w - WARN_MARGIN);
      var rw = Math.min(1, 1 - renderable.x / this.oDims.w - WARN_MARGIN);
      var rl = Math.min(1, renderable.x / this.oDims.w + WARN_MARGIN);
      $('#warner .left').css({
        width: (lw * 100) + '%'
      });
      $('#warner .right').css({
        left: (rl * 100) + '%',
        width: (rw * 100) + '%'
      });
      if (this._warnTimeout) {
        clearTimeout(this._warnTimeout);
      }
      this._warnTimeout = setTimeout(function () {
        $("#warner").removeClass('visible');
      }, WARN_TIME)
    }
  });

  global.createScene = function (dom) {
    global.scene = new Scene(dom);
  };
})(window);