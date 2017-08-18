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

    var ImPlotMath = {
        smoothstep: function (f) {
            return f*f*f*(f*(f*6.0-15.0)+10.0);
        }
    };

    var ImPlotDefault = function () {
        this.global_config = {};
        this.canvas = null;
        this.instance = null;
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

    ImPlotDefault.prototype.apply_color = function (color, value) {
        return _.isFunction(color) ? color(value) : color;
    };

    ImPlotDefault.prototype.apply_template = function (text, template) {
        if (_.isFunction(template)) {
            return template(text);
        } else {
            return template ? template.replace('@', text) : text;
        }
    };

    ImPlotDefault.prototype.set_fill_style = function (color, value) {
        this.canvas.fillStyle = this.apply_color(color, value);
    };

    ImPlotDefault.prototype.set_stroke_style = function (color, value) {
        this.canvas.strokeStyle = this.apply_color(color, value);
    };

    ImPlotDefault.prototype.set_text_style = function (config) {
        this.canvas.font = config.text_size + 'px ' + config.text_font;
        this.canvas.fillStyle = config.text_color;
    };

    ImPlotDefault.prototype.text_centered_at = function (config, text, pos) {
        config = _.defaults(config, {
            template: null
        });

        this.canvas.textAlign = 'center';
        this.canvas.textBaseline = 'middle';
        this.set_text_style(config);
        this.canvas.fillText(this.apply_template(text, config.template), pos.x, pos.y);
    };

    ImPlotDefault.prototype.text_centered_striked = function (config, text, pos, size) {
        config = _.defaults(config, {
            template: null,
            strike_margin: 5
        });

        var center = {x: pos.x + size.x * 0.5, y: pos.y + size.y * 0.5};

        this.canvas.textAlign = 'center';
        this.canvas.textBaseline = 'middle';
        this.set_text_style(config);

        var template_text = this.apply_template(text, config.template);
        this.canvas.fillText(template_text, center.x, center.y);

        var measurements = this.canvas.measureText(template_text);
        var text_left = center.x - measurements.width * 0.5 - config.strike_margin;
        var text_right = center.x + measurements.width * 0.5 + config.strike_margin;

        this.canvas.strokeStyle = config.text_color;
        this.canvas.beginPath();
        this.canvas.moveTo(pos.x+config.strike_margin, center.y);
        this.canvas.lineTo(text_left, center.y);
        this.canvas.moveTo(text_right, center.y);
        this.canvas.lineTo(pos.x+size.x-config.strike_margin, center.y);
        this.canvas.stroke();
    };

    ImPlotDefault.prototype.horizontal_bar = function (config, x, baseline_y, w, scale_y, value) {
        config = _.defaults(config, {
            bar_color: "#92d1ee"
        });

        var scaled_value = value * scale_y;

        this.set_fill_style(config.bar_color, value);
        this.canvas.fillRect(x, baseline_y - scaled_value, w, scaled_value);
    };

    ImPlotDefault.prototype.horizontal_bar_series = function (config, x, y, w, h, series) {
        config = _.defaults(config, {
            gap: 4
        });

        var bar_w = (w / series.length) - config.gap;
        var scale_y = h / config.maximum;

        for (var i = 0; i < series.length; i++) {
            var bar_x = x + i * (bar_w + config.gap) + config.gap * 0.5;
            this.horizontal_bar(config, bar_x, y + h, bar_w, scale_y, series[i]);
        }
    };

    ImPlotDefault.prototype.line_series = function (config, x, y, w, h, series) {
        config = _.defaults(config, {
            color: "rgba(0, 0, 0, 0.5)",
            smooth: false
        });

        var interval = w / series.length;
        var scale_y = h / config.maximum;

        var last_pos = {x: x + 0.5 * interval, y: y + h - series[0] * scale_y};

        this.canvas.strokeStyle = config.color;
        this.canvas.beginPath();
        this.canvas.moveTo(last_pos.x, last_pos.y);

        for (var i = 1; i < series.length; i++) {
            var pos = {x: x + (i + 0.5) * interval, y: y + h - series[i] * scale_y};

            if (config.smooth) {
                var center_x = (last_pos.x + pos.x) * 0.5;
                this.canvas.bezierCurveTo(center_x, last_pos.y, center_x, pos.y, pos.x, pos.y);
            } else {
                this.canvas.lineTo(pos.x, pos.y);
            }
            last_pos = pos;
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

    ImPlotDefault.prototype.add_vec = function (a, b) {
        return {x: a.x + b.x, y: a.y + b.y};
    };

    ImPlotDefault.prototype.angle_radius_to_vec = function (angle, radius) {
        return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius}
    };

    ImPlotDefault.prototype.percent_to_angle = function (percentage) {
        return percentage * Math.PI * 2.0 / 100.0;
    };

    ImPlotDefault.prototype.fit_circle_in_rect = function (pos, size, margin) {
        var pos = {x: pos.x + size.x / 2.0, y: pos.y + size.y / 2.0};
        var radius = (size.x > size.y) ? (size.y / 2 - margin.y) : (size.x / 2 - margin.x);
        return {pos: pos, radius: radius};
    };

    ImPlotDefault.prototype.center_of_rect = function (pos, size) {
        return {x: pos.x + size.x * 0.5, y: pos.y + size.y * 0.5};
    };

    ImPlotDefault.prototype.pie_section_text = function (config, text, pos, angle, distance) {
        var text_pos = this.add_vec(pos, this.angle_radius_to_vec(angle, distance));

        if (text_pos.x < pos.x - 5) {
            this.canvas.textAlign = 'right';
        } else if (text_pos.x > pos.x + 5) {
            this.canvas.textAlign = 'left';
        } else {
            this.canvas.textAlign = 'center';
        }

        this.canvas.textBaseline = 'middle';
        this.canvas.font = this.global_config.text_size + 'px ' + this.global_config.text_font;
        this.canvas.fillStyle = this.global_config.text_color;
        this.canvas.fillText(text, text_pos.x, text_pos.y);
    };

    ImPlotDefault.prototype.pie_ring = function (config, pos, inner_radius, outer_radius, start_percentage, percentage) {
        config = _.defaults(config, {
            name: '',
            color: 'blue',
            center_distance: 0.0,
            text_distance: 10.0
        });

        var start_angle = this.percent_to_angle(start_percentage);
        var end_angle = this.percent_to_angle(start_percentage + percentage);
        var center_angle = (start_angle + end_angle) * 0.5;

        if (config.center_distance > 0.0) {
            pos = this.add_vec(pos, this.angle_radius_to_vec(center_angle, config.center_distance));
        }

        this.canvas.fillStyle = config.color;
        this.canvas.beginPath();
        this.canvas.arc(pos.x, pos.y, inner_radius, start_angle, end_angle, false);
        this.canvas.arc(pos.x, pos.y, outer_radius, end_angle, start_angle, true);
        this.canvas.fill();

        if (config.name) {
            var text_distance = outer_radius + config.text_distance + config.center_distance;
            this.pie_section_text(config, config.name, pos, center_angle, text_distance);
        }
    };

    ImPlotDefault.prototype.pie_section = function (config, pos, radius, start_percentage, percentage) {
        config = _.defaults(config, {
            name: '',
            color: 'blue',
            center_distance: 0.0,
            text_distance: 10.0
        });

        var start_angle = this.percent_to_angle(start_percentage);
        var end_angle = this.percent_to_angle(start_percentage + percentage);
        var center_angle = (start_angle + end_angle) * 0.5;

        if (config.center_distance > 0.0) {
            pos = this.add_vec(pos, this.angle_radius_to_vec(center_angle, config.center_distance));
        }

        this.canvas.fillStyle = config.color;
        this.canvas.beginPath();
        this.canvas.moveTo(pos.x, pos.y);
        this.canvas.arc(pos.x, pos.y, radius, start_angle, end_angle, false);
        this.canvas.closePath();
        this.canvas.fill();

        if (config.name) {
            var text_distance = radius + config.text_distance + config.center_distance;
            this.pie_section_text(config, config.name, pos, center_angle, text_distance);
        }
    };

    ImPlotDefault.prototype.pie_chart = function (config, data, center_pos, radius) {
        config = _.defaults(config, {
            parts: [],
            gap: 0
        });

        var start_percentage = -25.0;
        for (var i = 0; i < data.length; i++) {
            this.pie_section(config.parts[i], center_pos, radius, start_percentage, Math.max(data[i] - config.gap, 0));
            start_percentage += data[i];
        }
    };

    ImPlotDefault.prototype.pie_ring_chart = function (config, data, center_pos, radius) {
        config = _.defaults(config, {
            outer_radius: radius,
            inner_radius: radius * 0.5,
            parts: [],
            gap: 0
        });

        var start_percentage = -25.0;

        for (var i = 0; i < data.length; i++) {
            var outer_radius = _.isFunction(config.outer_radius) ? config.outer_radius(radius, i, data[i]) : config.outer_radius;
            var inner_radius = _.isFunction(config.inner_radius) ? config.inner_radius(radius, i, data[i]) : config.inner_radius;
            this.pie_ring(config.parts[i], center_pos, inner_radius, outer_radius, start_percentage, Math.max(data[i] - config.gap, 0));
            start_percentage += data[i];
        }
    };

    ImPlotDefault.prototype.horizontal_line_with_label = function (config, value, graph_x, graph_width, y) {
        this.set_stroke_style(config.grid_color, value);
        this.canvas.beginPath();
        this.canvas.moveTo(graph_x, y);
        this.canvas.lineTo(graph_x + graph_width, y);
        this.canvas.stroke();

        this.canvas.textBaseline = 'middle';
        this.canvas.textAlign = 'right';
        this.canvas.font = this.global_config.text_size + 'px ' + this.global_config.text_font;
        this.canvas.fillStyle = this.global_config.text_color;
        this.canvas.fillText(value, graph_x - 5, y);
    };

    ImPlotDefault.prototype.horizontal_grid_with_labels = function (config, pos, label_width, graph_width, h) {
        config = _.defaults(config, {
            maximum: 100,
            minimum: 0,
            interval: 10,
            grid_color: '#888'
        });

        var value = 0;
        var graph_x = pos.x + label_width;
        for (value = config.minimum; value < config.maximum; value += config.interval) {
            var y = pos.y + h * (1.0 - (value - config.minimum) / (config.maximum - config.minimum));
            this.horizontal_line_with_label(config, value, graph_x, graph_width, y);
        }

        this.horizontal_line_with_label(config, value, graph_x, graph_width, pos.y);
    };

    ImPlotDefault.prototype.render = function (data) {
        var config = _.defaults(this.global_config, {
            grid: {},
            series: [],
            label_width: 100,
            margin: 10
        });

        var pos = {x: config.margin, y: config.margin};
        var size = {x: this.instance.width - config.margin * 2, y: this.instance.height - config.margin * 2};
        var graph_width = size.x - config.label_width;

        this.horizontal_grid_with_labels(config.grid, pos, config.label_width, graph_width, size.y);

        for (var i = 0; i < config.series.length; i++) {
            this.graph_series(config.series[i], pos.x + config.label_width, pos.y, graph_width, size.y, data[i]);
        }
    };

    var ImPlotDataQueue = function () {
      this.queue = [];
    };

    ImPlotDataQueue.prototype.push_data = function (data) {
        this.queue.push({data: data, factor: 0.0});
    };

    ImPlotDataQueue.prototype.update = function (delta) {

        var index, delete_before_index = 0;
        for (index = 0; index < this.queue.length; index++) {
            var entry = this.queue[index];
            if (entry.factor >= 1.0) {
                delete_before_index = index;
            }
            else {
                entry.factor = Math.min(entry.factor + delta * 0.001, 1.0);
            }
        }

        if (delete_before_index > 0) this.queue.splice(0, delete_before_index);

        // var debug_str = '';
        // for (index = 0; index < this.queue.length; index++) {
        //     debug_str += this.queue[index].factor + ' - '
        // }
        // console.log(debug_str);
    };

    ImPlotDataQueue.prototype.get_data = function () {
        var cur = this.queue[0];
        for (var index = 1; index < this.queue.length; index++) {
            var next = this.queue[index];
            cur = this._interpolate(cur, next);
        }
        return cur.data;
    };

    ImPlotDataQueue.prototype._interpolate = function (a, b) {
        var factor_b = ImPlotMath.smoothstep(b.factor);
        var factor_a = 1.0 - factor_b;
        var result = [];

        for (var series_index = 0; series_index < a.data.length; series_index++) {
            var series_a = a.data[series_index];
            var series_b = b.data[series_index];
            var series_result = [];
            for (var value_index = 0; value_index < series_a.length; value_index++) {
                series_result.push(series_a[value_index] * factor_a + series_b[value_index] * factor_b);
            }
            result.push(series_result);
        }

        return {data: result, factor: 1.0};
    };

    var ImPlot = function (selector, context, config) {
        var self = this;

        this.element = $(selector);
        this.canvas_element = $('<canvas/>');
        this.element.append(this.canvas_element);
        this.last_timestamp = 0;
        this.data_queue = new ImPlotDataQueue();
        this.width = 800;
        this.height = 800;
        this.context = context;
        this.canvas = this.canvas_element[0].getContext('2d');

        this.config = _.defaults(config, {
            text_color: '#333',
            text_size: 12,
            text_font: 'sans'
        });
        console.dir(this.config);

        this.context.global_config = this.config;
        this.context.canvas = this.canvas;
        this.context.instance = self;

        $(window).on('resize', function () {
            self._onResize();
        });

        this._onResize();
        this._step();
    };

    ImPlot.prototype.push_data = function (data) {
        this.data_queue.push_data(data);
    };

    ImPlot.prototype.render = function (delta) {
        this.context.delta = delta;
        this.data_queue.update(delta);

        this.canvas.clearRect(0, 0, this.width, this.height);
        this.context.render(this.data_queue.get_data());
    };

    ImPlot.prototype._step = function () {
        var self = this;
        window.requestAnimationFrame(function (timestamp) {
            var delta = 0;
            if (self.last_timestamp >= 0) delta = timestamp - self.last_timestamp;
            self.last_timestamp = timestamp;
            self.render(delta);
            self._step();
        });
    };

    ImPlot.prototype._onResize = function () {
        this.width = this.element.width();
        this.height = this.element.height();
        this.canvas.canvas.width = this.width;
        this.canvas.canvas.height = this.height;
    };

    scope.ImPlotDefault = ImPlotDefault;
    scope.ImPlot = ImPlot;
    return scope;
})
;
