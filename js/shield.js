(function (global) {
  global.Shield = Renderable.extend({
    source: 'shield',
    doCheckCollisions: false,
    initialize: function (x, y) {
      this.renderableInitialize(true);
      this.x = x;
      this.y = y;

      this.originX = 0.5;
      this.originY = 0.5;

      this._damages = [];
      // this.dom = $("<div>").addClass('sprite shield');
      // $(global.scene.dom).append(this.dom);

      this.dom = $("<div>").addClass('sprite shield');
      $(global.scene.dom).append(this.dom);

      this._canvas = $('<canvas>').get(0);
      this._canvas.width = Math.floor(this.dom.width());
      this._canvas.height = Math.floor(this.dom.height());

      if (!global.scene.shields)
        global.scene.shields = [];
      global.scene.shields.push(this);

      this._ctx = this._canvas.getContext('2d');
      this._redraw();
    },

    simulate: function (dt) {
    },

    _redraw: function () {
      var ctx = this._ctx;
      var canvas = this._canvas;
      var w = canvas.width;
      var h = canvas.height;

      ctx.beginPath();
      ctx.fillStyle = '#c3ff29';
      ctx.rect(0, 0, w, h)
      ctx.fill();

      for (var i in this._damages) {
        var damage = this._damages[i];
        ctx.fillStyle = '#ff0000';
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(damage.x * w, damage.y * h, damage.size * w * 1.1, damage.size * w * 1.1, 0, 2 * Math.PI, false)
        ctx.clip();
        ctx.clearRect(0, 0, w, h);
        ctx.restore();

      }

      this._canvasResult = this._canvas.toDataURL();
      this.dom.get(0).style.backgroundImage = 'url(' + this._canvasResult + ')';
    },

    onCollide: function (element, relX, relY) {
      var x = Math.max(0, relX / this._dims.w);
      var y = Math.max(0, relY / this._dims.h);

      if (y <= 0 || x <= 0)
        return;

      var touches = false;
      for (var i in this._damages) {
        var damage = this._damages[i];
        var d2 = (x - damage.x) * (x - damage.x) + (y - damage.y) * (y - damage.y);
        if (d2 < damage.size * damage.size) {
          touches = true;
        }
      }

      if (!touches) {
        element.renderableDestroy();
        element.dom.remove();
      }

      var damage = {
        x: x, 
        y: y, 
        size: (element.source === 'player')?0.1:0.07
      };
      this._damages.push(damage);
      this._redraw();
    },

    render: function () {
      this.renderableRender();
    }
  });
})(window);