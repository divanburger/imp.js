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

    /**
     * @constructor
     * @param {number} x
     * @param {number} y
     */
    var Vec = function (x, y) {
        this.x = x;
        this.y = y;
    };

    /**
     * @returns {Vec}
     */
    Vec.prototype.dup = function () {
        return new Vec(this.x, this.y);
    };

    /**
     * @param {Vec} other
     * @returns {Vec}
     */
    Vec.prototype.add = function (other) {
        return new Vec(this.x + other.x, this.y + other.y);
    };

    /**
     * @param {Vec} other
     * @returns {Vec}
     */
    Vec.prototype.sub = function (other) {
        return new Vec(this.x - other.x, this.y - other.y);
    };

    /**
     * @param {number} scalar
     * @returns {Vec}
     */
    Vec.prototype.mul = function (scalar) {
        return new Vec(this.x * scalar, this.y * scalar);
    };

    /**
     * @returns {number} square of the length of the vector
     */
    Vec.prototype.length_sqr = function () {
        return this.x * this.x + this.y * this.y;
    };

    /**
     * @returns {number} length of the vector
     */
    Vec.prototype.length = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };

    var Util = {
        PI: Math.PI,
        PI_2: Math.PI * 0.5,
        TAU: Math.PI * 2.0,

        normalize_angle: function (angle) {
            while (angle < 0.0) angle += Util.TAU;
            while (angle >= Util.TAU) angle -= Util.TAU;
            return angle;
        },
        vec_to_angle: function (a) {
            return Util.normalize_angle(Math.atan2(a.y, a.x));
        },
        angle_to_vec: function (angle) {
            return new Vec(Math.cos(angle), Math.sin(angle));
        },
        angle_radius_to_vec: function (angle, radius) {
            return Util.angle_to_vec(angle).mul(radius);
        },
        percent_to_angle: function (percentage) {
            return percentage * Util.TAU / 100.0;
        },
        center_of_rect: function (pos, size) {
            return pos.add(size.mul(0.5));
        },
        fit_circle_in_rect: function (pos, size, margin) {
            return {
                pos: Util.center_of_rect(pos, size),
                radius: (size.x > size.y) ? (size.y / 2 - margin.y) : (size.x / 2 - margin.x)
            };
        },
        point_in_rect: function (point, pos, size) {
            return (point.x >= pos.x) && (point.y >= pos.y) && (point.x < pos.x + size.x) && (point.y < pos.y + size.y);
        },
        smooth_factor: function (f) {
            return f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        },
        align_pos_to_stroke_pixel: function (v) {
            return new Vec(Math.round(v.x) + 0.5, Math.round(v.y) + 0.5);
        },
        align_size_to_pixel: function (v) {
            return new Vec(Math.round(v.x), Math.round(v.y));
        }
    };

    var ImpContext = function () {
        this.global_config = {};
        this.canvas = null;
        this.instance = null;
        this.global_state = {};
        this.id_stack = [];
        this.tooltip_origin = null;
        this.tooltip_func = null;
    };

    /**
     * @param {string} text
     * @param {Vec|null} [origin]
     */
    ImpContext.prototype.show_tooltip = function (text, origin) {
        if (origin) {
            this.tooltip_origin = origin.dup();
        } else {
            this.tooltip_origin = this.instance.mouse_position.dup();
        }

        this.tooltip_func = function (pos) {
            this._tooltip(text, pos);
        };
    };

    ImpContext.prototype.push_id = function (id) {
        this.id_stack.push(id);
    };

    ImpContext.prototype.pop_id = function (num) {
        if (!num) num = 1;
        console.assert(this.id_stack.length >= num);
        this.id_stack.splice(-num, num);
    };

    ImpContext.prototype.set_state = function (id, value) {
        _.set(this.global_state, _.concat(this.id_stack, id), value);
    };

    ImpContext.prototype.get_state = function (id, dflt) {
        return _.get(this.global_state, _.concat(this.id_stack, id), dflt);
    };

    ImpContext.prototype.move_toward = function (from, target, speed) {
        return from + (target - from) * Math.min(speed * this.delta * 0.001, 1.0);
    };

    ImpContext.prototype.move_to = function (v) {
        this.canvas.moveTo(v.x, v.y);
    };

    ImpContext.prototype.line_to = function (v) {
        this.canvas.lineTo(v.x, v.y);
    };

    ImpContext.prototype.rect_fill = function (pos, size) {
        this.canvas.fillRect(pos.x, pos.y, size.x, size.y);
    };

    ImpContext.prototype.calculate_series_maximum = function (series) {
        var maximum = 0;
        for (var i = 0; i < series.data.length; i++) {
            if (maximum < series.data[i]) {
                maximum = series.data[i];
            }
        }
        return maximum;
    };

    ImpContext.prototype.apply_color = function (color, value) {
        return _.isFunction(color) ? color(value) : color;
    };

    ImpContext.prototype.apply_template = function (text, template) {
        if (_.isFunction(template)) {
            return template(text);
        } else {
            return template ? template.replace('@', text) : text;
        }
    };

    ImpContext.prototype.clip_rect = function (pos, size, draw) {
        this.canvas.save();
        this.canvas.beginPath();
        this.canvas.rect(pos.x, pos.y, size.x, size.y);
        this.canvas.clip();
        draw();
        this.canvas.restore();
    };

    ImpContext.prototype.set_fill_style = function (color, value) {
        this.canvas.fillStyle = this.apply_color(color, value);
    };

    ImpContext.prototype.set_stroke_style = function (color, value) {
        this.canvas.strokeStyle = this.apply_color(color, value);
    };

    ImpContext.prototype.set_text_style = function (config) {
        this.canvas.font = config.text_size + 'px ' + config.text_font;
        this.canvas.fillStyle = config.text_color;
    };

    ImpContext.prototype.text_centered_at = function (config, text, pos) {
        config = _.defaults(config, {
            template: null
        });

        this.canvas.textAlign = 'center';
        this.canvas.textBaseline = 'middle';
        this.set_text_style(config);
        this.canvas.fillText(this.apply_template(text, config.template), pos.x, pos.y);
    };

    ImpContext.prototype.text_centered_striked = function (config, text, pos, size) {
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
        this.canvas.moveTo(pos.x + config.strike_margin, center.y);
        this.canvas.lineTo(text_left, center.y);
        this.canvas.moveTo(text_right, center.y);
        this.canvas.lineTo(pos.x + size.x - config.strike_margin, center.y);
        this.canvas.stroke();
    };

    ImpContext.prototype.horizontal_slider = function (config, name, initial_value, min, max, pos, size) {
        var value = _.get(config, name, initial_value);
        var factor = 1.0 - (value - min) / (max - min);
        var slider_height = 10;
        var slider_width = 20;

        if (this.instance.mouse_down && Util.point_in_rect(this.instance.mouse_position, pos, size)) {
            factor = (this.instance.mouse_position.y - pos.y - slider_height * 0.5) / (size.y - slider_height);
            factor = Math.max(Math.min(factor, 1.0), 0.0);
            value = (1.0 - factor) * (max - min) + min;
            _.set(config, name, value);
        }

        var track_center_x = size.x * 0.5;
        var track_width = 10;
        var track_height = size.y - slider_height;

        var slider_pos = pos.add(new Vec(track_center_x, slider_height * 0.5 + factor * track_height));

        // Draw track
        this.canvas.fillStyle = '#AAA';
        this.canvas.fillRect(pos.x + track_center_x - track_width * 0.5, pos.y + slider_height * 0.5, track_width, track_height);

        // Draw slider
        this.canvas.fillStyle = '#CCC';
        this.canvas.strokeStyle = '3333';
        this.canvas.beginPath();
        this.canvas.rect(slider_pos.x - slider_width * 0.5, slider_pos.y - slider_height * 0.5, slider_width, slider_height);
        this.canvas.fill();
        this.canvas.stroke();
    };

    ImpContext.prototype.horizontal_bar = function (config, x, baseline_y, w, scale_y, value) {
        config = _.defaults(config, {
            bar_color: '#92d1ee',
            bar_hover_color: '#000000',
            text_color: 'black',
            text_template: function (value) {
                return Math.round(value) + '%';
            },
            tooltip_template: function (value) {
                return _.round(value, 2) + '%';
            }
        });

        var scaled_value = value * scale_y;
        var pos = {x: x, y: baseline_y - scaled_value};
        var size = {x: w, y: scaled_value};

        var hover = Util.point_in_rect(this.instance.mouse_position, pos, size);
        this.set_fill_style(hover ? config.bar_hover_color : config.bar_color, value);

        this.canvas.fillRect(pos.x, pos.y, size.x, size.y);

        if (hover) {
            this.set_text_style(config);
            this.canvas.textAlign = 'center';
            this.canvas.textBaseline = 'alphabetic';
            this.canvas.fillText(this.apply_template(value, config.text_template), pos.x + size.x * 0.5, pos.y - 5, size.x);

            this.show_tooltip(this.apply_template(value, config.tooltip_template));
        }
    };

    ImpContext.prototype.horizontal_bar_series = function (config, pos, size, series) {
        var self = this;

        config = _.defaults(config, {
            gap: 4,
            x_zoom_factor: 1.0,
            x_zoom_center: 0.0
        });

        this.clip_rect(pos, size, function () {
            size = size.dup();
            size.x = size.x * config.x_zoom_factor;

            var bar_x, bar_w, i;
            var scale_y = size.y / config.maximum;

            if (series.config.series_type === Imp.SeriesType.MOVING) {
                var offset = series.offset % 1;

                bar_w = (size.x / series.length) - config.gap;

                for (i = 0; i < series.data.length; i++) {
                    bar_x = pos.x + (i - offset) * (bar_w + config.gap) + config.gap * 0.5;
                    self.horizontal_bar(config, bar_x, pos.y + size.y, bar_w, scale_y, series.data[i]);
                }
            } else {
                bar_w = (size.x / series.data.length) - config.gap;

                for (i = 0; i < series.data.length; i++) {
                    bar_x = pos.x + i * (bar_w + config.gap) + config.gap * 0.5;
                    self.horizontal_bar(config, bar_x, pos.y + size.y, bar_w, scale_y, series.data[i]);
                }
            }
        });
    };

    ImpContext.prototype._line_series_moving = function (config, pos, size, series) {
        var offset = series.offset % 1;

        var interval = size.x / (series.length - 1);
        var scale_y = size.y / config.maximum;
        var last_point_pos = new Vec(pos.x - offset * interval, pos.y + size.y - series.data[0] * scale_y);

        this.move_to(last_point_pos);

        for (var i = 1; i < series.data.length; i++) {
            var point_pos = new Vec(pos.x + (i - offset) * interval, pos.y + size.y - series.data[i] * scale_y);

            if (config.smooth) {
                var center_x = (last_point_pos.x + point_pos.x) * 0.5;
                this.canvas.bezierCurveTo(center_x, last_point_pos.y, center_x, point_pos.y, point_pos.x, point_pos.y);
            } else {
                this.line_to(point_pos);
            }

            last_point_pos = point_pos;
        }
    };

    ImpContext.prototype._line_series = function (config, pos, size, series) {
        var interval = size.x / (series.data.length - 1);
        var scale_y = size.y / config.maximum;
        var last_point_pos = new Vec(pos.x, pos.y + size.y - series.data[0] * scale_y);

        this.move_to(last_point_pos);

        for (var i = 1; i < series.data.length; i++) {
            var point_pos = new Vec(pos.x + i * interval, pos.y + size.y - series.data[i] * scale_y);

            if (config.smooth) {
                var center_x = (last_point_pos.x + point_pos.x) * 0.5;
                this.canvas.bezierCurveTo(center_x, last_point_pos.y, center_x, point_pos.y, point_pos.x, point_pos.y);
            } else {
                this.line_to(point_pos);
            }

            last_point_pos = point_pos;
        }
    };

    ImpContext.prototype.line_series = function (config, pos, size, series) {
        var self = this;

        config = _.defaults(config, {
            color: "rgba(0, 0, 0, 0.5)",
            line_width: 2,
            smooth: false
        });

        this.clip_rect(pos, size, function () {
            self.canvas.strokeStyle = config.color;
            self.canvas.lineWidth = config.line_width;
            self.canvas.beginPath();

            if (series.config.series_type === Imp.SeriesType.MOVING) {
                self._line_series_moving(config, pos, size, series);
            } else {
                self._line_series(config, pos, size, series);
            }

            self.canvas.stroke();
        });
    };

    ImpContext.prototype._area_series_moving = function (config, pos, size, series) {
        var offset = series.offset % 1;

        var interval = size.x / (series.length - 1);
        var scale_y = size.y / config.maximum;
        var start_point_pos = new Vec(pos.x - offset * interval, pos.y + size.y - series.data[0] * scale_y);
        var last_point_pos = start_point_pos;

        this.canvas.fillStyle = config.color;
        this.canvas.strokeStyle = config.outline_color;
        this.canvas.beginPath();
        this.canvas.moveTo(start_point_pos.x, start_point_pos.y);
        for (var i = 1; i < series.data.length; i++) {
            var point_pos = new Vec(pos.x + (i - offset) * interval, pos.y + size.y - series.data[i] * scale_y);

            if (config.smooth) {
                var center_x = (last_point_pos.x + point_pos.x) * 0.5;
                this.canvas.bezierCurveTo(center_x, last_point_pos.y, center_x, point_pos.y, point_pos.x, point_pos.y);
            } else {
                this.line_to(point_pos);
            }

            last_point_pos = point_pos;
        }

        this.canvas.lineWidth = config.outline_width;
        this.canvas.stroke();

        this.line_to(new Vec(last_point_pos.x, pos.y + size.y));
        this.line_to(new Vec(start_point_pos.x, pos.y + size.y));
        this.canvas.fill();
    };

    ImpContext.prototype._area_series = function (config, pos, size, series) {
        var interval = size.x / (series.data.length - 1);
        var scale_y = size.y / config.maximum;
        var start_point_pos = new Vec(pos.x, pos.y + size.y - series.data[0] * scale_y);
        var last_point_pos = start_point_pos;

        this.canvas.fillStyle = config.color;
        this.canvas.strokeStyle = config.outline_color;
        this.canvas.beginPath();
        this.move_to(start_point_pos);
        for (var i = 1; i < series.data.length; i++) {
            var point_pos = new Vec(pos.x + i * interval, pos.y + size.y - series.data[i] * scale_y);

            if (config.smooth) {
                var center_x = (last_point_pos.x + point_pos.x) * 0.5;
                this.canvas.bezierCurveTo(center_x, last_point_pos.y, center_x, point_pos.y, point_pos.x, point_pos.y);
            } else {
                this.line_to(point_pos);
            }

            last_point_pos = point_pos;
        }

        this.canvas.lineWidth = config.outline_width;
        this.canvas.stroke();

        this.line_to(new Vec(last_point_pos.x, pos.y + size.y));
        this.line_to(new Vec(start_point_pos.x, pos.y + size.y));
        this.canvas.fill();
    };

    ImpContext.prototype.area_series = function (config, pos, size, series) {
        var self = this;

        config = _.defaults(config, {
            color: "rgba(0, 0, 0, 0.5)",
            outline_color: "rgba(0, 0, 0, 1)",
            outline_width: 2,
            smooth: false
        });

        this.clip_rect(pos, size, function () {

            if (series.config.series_type === Imp.SeriesType.MOVING) {
                self._area_series_moving(config, pos, size, series);
            } else {
                self._area_series(config, pos, size, series);
            }
        });
    };

    ImpContext.prototype.pie_section_text = function (config, text, pos, angle, distance) {
        var text_pos = pos.add(Util.angle_radius_to_vec(angle, distance));

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

    ImpContext.prototype.pie_ring = function (config, pos, inner_radius, outer_radius, start_percentage, percentage) {
        config = _.defaults(config, {
            name: '',
            color: 'blue',
            center_distance: 0.0,
            text_distance: 10.0
        });

        var start_angle = Util.percent_to_angle(start_percentage) - Util.PI_2;
        var end_angle = Util.percent_to_angle(start_percentage + percentage) - Util.PI_2;
        var center_angle = (start_angle + end_angle) * 0.5;

        if (config.center_distance > 0.0) {
            pos = pos.add(Util.angle_radius_to_vec(center_angle, config.center_distance));
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

    ImpContext.prototype.pie_section = function (config, pos, radius, start_angle, end_angle, value) {
        config = _.defaults(config, {
            name: '',
            color: 'blue',
            hover_color: 'red',
            center_distance: 0.0,
            hover_center_distance: 10.0,
            text_distance: 10.0
        });

        var center_angle = (start_angle + end_angle) * 0.5;

        // Test hover
        var hover = false;
        var mouse_vec = this.instance.mouse_position.sub(pos);
        var mouse_distance_sqr = mouse_vec.length_sqr();
        if (mouse_distance_sqr <= radius * radius) {
            var mouse_angle = Util.vec_to_angle(mouse_vec);

            var a = Util.normalize_angle(mouse_angle - start_angle);
            var b = Util.normalize_angle(end_angle - start_angle);
            if (a >= 0.0 && a < b) hover = true;
        }

        // Apply hover
        var target_center_distance = config.center_distance;
        if (hover) {
            target_center_distance = config.hover_center_distance;
            this.show_tooltip(config.name + ': ' + value);
            this.canvas.fillStyle = config.hover_color;
        } else {
            this.canvas.fillStyle = config.color;
        }

        // Animate center_distance
        var center_distance = this.get_state('center_distance', config.center_distance);
        center_distance = this.move_toward(center_distance, target_center_distance, 10.0);
        this.set_state('center_distance', center_distance);

        if (center_distance > 0.1) {
            pos = pos.add(Util.angle_radius_to_vec(center_angle, center_distance));
        }

        this.canvas.beginPath();
        this.canvas.moveTo(pos.x, pos.y);
        this.canvas.arc(pos.x, pos.y, radius, start_angle, end_angle, false);
        this.canvas.closePath();
        this.canvas.fill();
    };

    ImpContext.prototype.pie_chart_with_side_labels = function (config, series, pos, size) {
        config = _.defaults(config, {
            parts: [],
            gap: 0,
            start_angle: 0
        });

        var angles = [];
        var labels = [];

        var start_percent = 0.0, value;
        for (var i = 0; i < series.data.length; i++) {
            value = series.data[i];

            var start_angle = Util.percent_to_angle(start_percent) - Util.PI_2 + config.start_angle;
            var end_angle = Util.percent_to_angle(start_percent + value) - Util.PI_2 + config.start_angle;
            var center_angle = (start_angle + end_angle) * 0.5;
            angles.push({start: start_angle, end: end_angle, center: center_angle});

            var vec = Util.angle_to_vec(center_angle);
            labels.push({text: config.parts[i].name, vec: vec, index: i, pos: new Vec(0, 0)});

            start_percent += series.data[i];
        }

        var text_height = 12;
        var half_text_height = text_height;
        var text_space = 5;

        this.canvas.font = text_height + 'px sans';

        labels = _.sortBy(labels, [function(l) { return l.vec.y;}]);
        var widest = 0;
        for (var i = 0; i < labels.length; i++) {
            var m = this.canvas.measureText(labels[i].text);
            widest = Math.max(widest, m.width);
        }

        var graph_x = widest + 10;
        var graph_width = size.x - widest - widest - 20;

        var space = text_height + 10;
        var graph_circle = Util.fit_circle_in_rect(pos.add(new Vec(graph_x, 0)), new Vec(graph_width, size.y), new Vec(space, space));

        var left_label_start = pos.x + size.x * 0.5 - graph_circle.radius - text_space * 2;
        var right_label_start = pos.x + size.x * 0.5 + graph_circle.radius + text_space * 2;

        // Determine label y position
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i];

            var side_end_x = (label.vec.x < 0 ? left_label_start + text_space : right_label_start - text_space) - graph_circle.pos.x;
            var distance_to_side = side_end_x / label.vec.x;

            var y_bound = (label.vec.y < 0 ? pos.y + half_text_height : pos.y + size.y - half_text_height) - graph_circle.pos.y;
            var distance_to_y_bound = y_bound / label.vec.y;

            var distance = Math.min(distance_to_side, distance_to_y_bound);
            label.pos = new Vec(side_end_x, label.vec.y * distance);
        }

        // Space out labels
        var last_left_label = null, last_right_label = null;
        var spread_label = function (direction, label) {
            var last_label = null;
            if (label.vec.x < 0) {
                last_label = last_left_label;
                last_left_label = label;
            } else {
                last_label = last_right_label;
                last_right_label = label;
            }

            if (last_label) {
                if (direction && label.pos.y < 0) {
                    if (last_label.pos.y + text_height > label.pos.y) {
                        label.pos.y = Math.min(last_label.pos.y + text_height, graph_circle.radius);
                    }
                } else if (!direction && label.pos.y > 0) {
                    if (last_label.pos.y - text_height < label.pos.y) {
                        label.pos.y = Math.max(last_label.pos.y - text_height, -graph_circle.radius);
                    }
                }
            }
        };

        last_left_label = null;
        last_right_label = null;
        _.each(labels, function (l) {spread_label(true, l)});
        last_left_label = null;
        last_right_label = null;
        _.eachRight(labels, function (l) {spread_label(false, l)});

        // Draw labels
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i];
            var distance = label.pos.y / label.vec.y;

            var bend_pos = label.vec.mul(distance);

            var end_pos = new Vec(label.pos.x, bend_pos.y);
            var start_pos = label.vec.mul(graph_circle.radius);

            this.canvas.beginPath();
            this.move_to(graph_circle.pos.add(start_pos));
            this.line_to(graph_circle.pos.add(bend_pos));
            this.line_to(graph_circle.pos.add(end_pos));
            this.canvas.stroke();

            var text_pos = graph_circle.pos.add(end_pos).add(new Vec(label.vec.x < 0 ? -text_space : text_space, 0));
            this.canvas.textBaseline = 'middle';
            this.canvas.textAlign = (label.vec.x < 0 ? 'right' : 'left');
            this.canvas.fillText(label.text, text_pos.x, text_pos.y);
        }

        // Draw graph
        this.push_id('pie');
        start_percent = 0.0;
        for (var i = 0; i < series.data.length; i++) {
            this.push_id(i);
            this.pie_section(config.parts[i], graph_circle.pos, graph_circle.radius, angles[i].start, angles[i].end, series.data[i]);
            this.pop_id();
            start_percent += series.data[i];
        }

        this.pop_id();
    };

    ImpContext.prototype.pie_chart = function (config, series, center_pos, radius) {
        config = _.defaults(config, {
            parts: [],
            gap: 0
        });

        this.push_id('pie');

        var start_percent = 0.0;
        for (var i = 0; i < series.data.length; i++) {
            var value = series.data[i];
            var start_angle = Util.percent_to_angle(start_percent) - Util.PI_2;
            var end_angle = Util.percent_to_angle(start_percent + value) - Util.PI_2;
            this.push_id(i);
            this.pie_section(config.parts[i], center_pos, radius, start_angle, end_angle, value);
            this.pop_id();
            start_percent += series.data[i];
        }

        this.pop_id();
    };

    ImpContext.prototype.pie_ring_chart = function (config, series, center_pos, radius) {
        config = _.defaults(config, {
            outer_radius: radius,
            inner_radius: radius * 0.5,
            parts: [],
            gap: 0
        });

        var start_percentage = 0.0;
        for (var i = 0; i < series.data.length; i++) {
            var outer_radius = _.isFunction(config.outer_radius) ? config.outer_radius(radius, i, series.data[i]) : config.outer_radius;
            var inner_radius = _.isFunction(config.inner_radius) ? config.inner_radius(radius, i, series.data[i]) : config.inner_radius;
            this.pie_ring(config.parts[i], center_pos, inner_radius, outer_radius, start_percentage, Math.max(series.data[i] - config.gap, 0));
            start_percentage += series.data[i];
        }
    };

    ImpContext.prototype.horizontal_line_with_label = function (config, value, graph_x, graph_width, y) {
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

    ImpContext.prototype.horizontal_grid_with_labels = function (config, pos, label_width, graph_width, h) {
        config = _.defaults(config, {
            maximum: 100,
            minimum: 0,
            interval: 10,
            grid_color: '#888'
        });

        var value;
        var graph_x = pos.x + label_width;
        for (value = config.minimum; value < config.maximum; value += config.interval) {
            var y = pos.y + h * (1.0 - (value - config.minimum) / (config.maximum - config.minimum));
            this.horizontal_line_with_label(config, value, graph_x, graph_width, y);
        }

        this.horizontal_line_with_label(config, value, graph_x, graph_width, pos.y);
    };

    ImpContext.prototype._tooltip = function (text, pos) {
        this.canvas.save();
        this.canvas.font = '12px sans';
        this.canvas.textAlign = 'left';
        this.canvas.textBaseline = 'top';

        // Align to pixels
        var cursor_offset = 20;
        var padding = new Vec(5, 5);

        // Determine size
        var m = this.canvas.measureText(text);
        var rect_pos = pos.add(new Vec(cursor_offset, 0));
        var rect_size = padding.mul(2).add(new Vec(m.width, 12));

        // Position tooltip correctly
        if (rect_pos.x + rect_size.x >= this.instance.width) {
            rect_pos.x = pos.x - cursor_offset - rect_size.x;
        }

        if (rect_pos.y + rect_size.y >= this.instance.height) {
            rect_pos.y = this.instance.height - rect_size.y;
        }

        rect_pos = Util.align_pos_to_stroke_pixel(rect_pos);
        rect_size = Util.align_size_to_pixel(rect_size);

        // Draw background
        this.canvas.fillStyle = 'white';
        this.canvas.fillRect(rect_pos.x, rect_pos.y, rect_size.x, rect_size.y);
        this.canvas.strokeStyle = 'black';
        this.canvas.strokeRect(rect_pos.x, rect_pos.y, rect_size.x, rect_size.y);

        // Draw text
        this.canvas.fillStyle = 'black';
        this.canvas.fillText(text, rect_pos.x + padding.x, rect_pos.y + padding.y);
        this.canvas.restore();
    };

    var ImpDataQueue = function (config) {
        this.config = config;
        this.queue = [];
        this.interpolation_time = 0.5;
    };

    ImpDataQueue.SeriesType = {
        STATIC: 0,
        DYNAMIC: 1,
        MOVING: 2
    };

    ImpDataQueue.prototype.push_data = function (data) {
        this.queue.push({data: data, factor: 0.0});
    };

    ImpDataQueue.prototype.update = function (delta) {
        var index, delete_before_index = 0;
        for (index = 0; index < this.queue.length; index++) {
            var entry = this.queue[index];
            if (entry.factor >= 1.0) {
                delete_before_index = index;
            }
            else {
                entry.factor = Math.min(entry.factor + delta * 0.001 / this.interpolation_time, 1.0);
            }
        }

        if (delete_before_index > 0) this.queue.splice(0, delete_before_index);

        if (this.queue.length > 3) {
            console.log("Imp data queue is lagging behind; decrease interpolation time or slow down data pushing");
            console.log("Delta is " + delta);
        }
    };

    ImpDataQueue.prototype.get_data = function () {
        var config = this.config;

        console.assert(this.queue.length > 0);
        console.assert(config.length === this.queue[0].data.length);

        var series = [];
        var series_id;
        for (series_id = 0; series_id < config.length; series_id++) {
            var series_type = this.config[series_id].series_type;
            var cur;

            if (series_type === ImpDataQueue.SeriesType.STATIC) {
                cur = this.queue[this.queue.length - 1].data[series_id];
            } else {
                cur = this.queue[0].data[series_id];
                for (var index = 1; index < this.queue.length; index++) {
                    var entry = this.queue[index];
                    if (series_type === ImpDataQueue.SeriesType.MOVING) {
                        cur = this._interpolate_moving(index, cur, entry.data[series_id], entry.factor);
                    } else {
                        cur = this._interpolate_dynamic(index, cur, entry.data[series_id], entry.factor);
                    }
                }
            }

            cur.config = this.config[series_id];
            cur.length = this.queue[0].data[series_id].data.length;
            series.push(cur);
        }

        return series;
    };

    ImpDataQueue.prototype._interpolate_moving = function (series_id, a, b, factor) {
        if (factor >= 1.0) return b;

        var factor_b = Util.smooth_factor(factor);
        var factor_a = 1.0 - factor_b;
        var start_offset = Math.min(a.offset, b.offset);
        var offset_a = a.offset - start_offset;
        var offset_b = b.offset - start_offset;
        var end_a = a.data.length + offset_a;
        var end_b = b.data.length + offset_b;
        var end = Math.max(end_a, end_b);

        var series_result = [];
        for (var value_index = 0; value_index < end; value_index++) {
            if (value_index >= offset_b && value_index < end_b) {
                series_result.push(b.data[value_index - offset_b]);
            } else {
                series_result.push(a.data[value_index - offset_a]);
            }
        }

        return {
            data: series_result,
            offset: a.offset * factor_a + b.offset * factor_b,
            length: b.data.length
        };
    };

    ImpDataQueue.prototype._interpolate_dynamic = function (series_id, a, b, factor) {
        if (factor >= 1.0) return b;

        var factor_b = Util.smooth_factor(factor);
        var factor_a = 1.0 - factor_b;

        var series_result = [];
        for (var value_index = 0; value_index < a.data.length; value_index++) {
            series_result.push(a.data[value_index] * factor_a + b.data[value_index] * factor_b);
        }

        return {data: series_result};
    };

    var Imp = function (selector, render_func, data_config, config) {
        var self = this;

        this.element = $(selector);
        this.canvas_element = $('<canvas/>');
        this.element.append(this.canvas_element);
        this.last_timestamp = 0;
        this.data_queue = new ImpDataQueue(data_config);
        this.width = 800;
        this.height = 800;
        this.mouse_position = new Vec(0, 0);
        this.mouse_over = false;
        this.mouse_down = false;
        this.context = new ImpContext();
        this.render_func = render_func;
        this.canvas = this.canvas_element[0].getContext('2d');

        this.config = _.defaults(config, {
            text_color: '#333',
            text_size: 12,
            text_font: 'sans'
        });

        this.context.global_config = this.config;
        this.context.canvas = this.canvas;
        this.context.instance = self;

        $(window).on('resize', function () {
            self._on_resize();
        });

        var ce = this.canvas_element[0];

        ce.addEventListener('mousemove', function (event) {
            var rect = ce.getBoundingClientRect();
            self.mouse_position = new Vec(event.clientX - rect.left, event.clientY - rect.top);
        });
        ce.addEventListener('mouseover', function (event) {
            self.mouse_over = true;
        });
        ce.addEventListener('mouseout', function (event) {
            self.mouse_over = false;
            self.mouse_down = false;
            self.mouse_position = new Vec(-1000, -1000);
        });
        ce.addEventListener('mousedown', function (event) {
            self.mouse_down = true;
        });
        ce.addEventListener('mouseup', function (event) {
            self.mouse_down = false;
        });

        this._on_resize();
        this._step();
    };

    Imp.prototype.push_data = function (data) {
        this.data_queue.push_data(data);
    };

    Imp.prototype.render = function (delta) {
        this.context.delta = delta;
        this.data_queue.update(delta);

        this.canvas.clearRect(0, 0, this.width, this.height);
        this.render_func(this.context, this.data_queue.get_data());

        if (this.context.tooltip_func) {
            this.context.tooltip_func(this.context.tooltip_origin);
            this.context.tooltip_func = null;
        }
    };

    Imp.prototype._step = function () {
        var self = this;
        window.requestAnimationFrame(function (timestamp) {
            var delta = 0;
            if (self.last_timestamp >= 0) delta = timestamp - self.last_timestamp;
            self.last_timestamp = timestamp;
            self.render(delta);
            self._step();
        });
    };

    Imp.prototype._on_resize = function () {
        this.width = this.element.width();
        this.height = this.element.height();
        this.canvas.canvas.width = this.width;
        this.canvas.canvas.height = this.height;
    };

    Imp.SeriesType = ImpDataQueue.SeriesType;
    Imp.Util = Util;
    Imp.Vec = Vec;

    scope.Imp = Imp;
    return scope;
});
