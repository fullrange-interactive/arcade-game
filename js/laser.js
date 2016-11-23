(function (global) {
  global.Laser = Renderable.extend({
    type: 'laser',
    initialize: function (source, x, y, color, speed) {
      this.renderableInitialize();
      this.color = color;
      this.x = x;
      this.y = y;
      this.speed = speed;
      this.source = source;

      this.dom = $("<div>").addClass('laser sprite');
      $(global.scene.dom).append(this.dom);
    },

    simulate: function (dt) {
      this.y += this.speed * dt;

      if (this.y < 0 || this.y > global.scene.oDims.h) {
        this.speed = 0;
        this.renderableDestroy();
        this.dom.remove();
      }

      if (this.source === 'player-laser') {
        // Dirty hack
        this.checkCollisions('player');
      }
      else {
        this.checkCollisions();
      }
    },

    render: function () {
      this.renderableRender();
      this.dom.css({
        backgroundColor: this.color,
        filter: 'url(#blur)'
      });
      if (this.speed === 0) {
        this.dom.removeClass('moving');
      } else {
        this.dom.addClass('moving');
      }
    }
  });
})(window);