(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'lodash'], factory);
    } else if (typeof exports !== 'undefined') {
        try {
            jQuery = require('jquery');
        } catch (e) {
        }
        try {
            _ = require('lodash');
        } catch (e) {
        }
        factory(jQuery, _);
    } else {
        factory(jQuery, _);
    }
})(function ($, _) {
    var scope = window;

    var ImPlotDefault = function () {
        this.global_config = {};
        this.canvas = null;
    };

    ImPlotDefault.prototype.calculate_series_maximum = function (series) {
        var maximum = 0;
        for (var i = 0; i < series.length; i++) {
            if (maximum < series[i]) {
                maximum = series[i];
            }
        }
        return maximum;
    };

    ImPlotDefault.prototype.horizontal_bar = function (config, x, baseline_y, w, scale_y, value) {
        var scaled_value = value * scale_y;

        this.canvas.fillStyle = config.color;
        this.canvas.fillRect(x, baseline_y - scaled_value, w, scaled_value);
    };

    ImPlotDefault.prototype.horizontal_bar_series = function (ctx, config, x, y, w, h, series) {
        config = _.defaults(config, {
            color: "#92d1ee",
            gap: 2
        });

        var bar_w = (w / series.length) - config.gap;
        var scale_y = h / config.maximum;

        for (var i = 0; i < series.length; i++) {
            var bar_x = x + i * (bar_w + config.gap);
            this.horizontal_bar(config, bar_x, y + h, bar_w, scale_y, series[i]);
        }
    };

    ImPlotDefault.prototype.line_series = function (config, x, y, w, h, series) {
        config = _.defaults(config, {
            color: "rgba(0, 0, 0, 0.5)"
        });

        var interval = w / series.length;
        var scale_y = h / config.maximum;

        this.canvas.strokeStyle = config.color;
        this.canvas.beginPath();
        for (var i = 0; i < series.length; i++) {
            var point_x = (i + 0.5) * interval;
            if (i === 0) {
                this.canvas.moveTo(point_x, h - series[i] * scale_y);
            } else {
                this.canvas.lineTo(point_x, h - series[i] * scale_y);
            }
        }
        this.canvas.stroke();
    };

    ImPlotDefault.prototype.graph_series = function (config, x, y, w, h, series) {
        config = _.defaults(config, {
            graph_type: "horizontal_bar",
            maximum: -1
        });

        if (config.maximum < 0) config.maximum = this.calculate_series_maximum(series);

        switch (config.graph_type) {
            case "line":
                this.line_series(config, x, y, w, h, series);
                break;

            case "horizontal_bar":
            default:
                this.horizontal_bar_series(config, x, y, w, h, series);
                break;
        }
    };

    ImPlotDefault.prototype.render = function (data) {
        for (var i = 0; i < this.global_config.series.length; i++) {
            this.graph_series(this.global_config.series[i], 0, 0, 300, 100, data[i]);
        }
    };

    var ImPlot = function (selector, context, config) {
        var self = this;

        this.element = $(selector);
        this.canvas_element = $('<canvas/>');
        this.element.append(this.canvas_element);
        this.last_timestamp = 0;
        this.data = [[]];
        this.width = 800;
        this.height = 800;
        this.context = context;
        this.config = config;
        this.canvas = this.canvas_element[0].getContext('2d');

        this.context.global_config = this.config;
        this.context.canvas = this.canvas;

        $(window).on('resize', function () {
            self._onResize();
        });

        this._onResize();
        this._step();
    };

    ImPlot.prototype.load_data = function (data) {
        this.data = data;
    };

    ImPlot.prototype.render = function (delta) {
        this.canvas.clearRect(0, 0, this.width, this.height);
        this.context.delta = delta;
        this.context.render(this.data);
    };

    ImPlot.prototype._step = function () {
        var self = this;
        window.requestAnimationFrame(function (timestamp) {
            var delta = 0;
            if (this.last_timestamp >= 0) delta = timestamp - this.last_timestamp;
            this.last_timestamp = timestamp;
            self.render(delta);
            self._step();
        });
    };

    ImPlot.prototype._onResize = function () {
        this.canvas_element[0].width = this.width;
        this.canvas_element[0].height = this.height;
    };

    scope.ImPlotContext = ImPlotDefault;
    scope.ImPlot = ImPlot;
    return scope;
})
;
