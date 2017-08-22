(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['lodash'], factory);
    } else if (typeof exports !== 'undefined') {
        try {
            _ = require('lodash');
        } catch (e) {
        }
        factory(_);
    } else {
        factory(_);
    }
})(function (_) {
    var scope = window;

    var RGBColor = function (r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    };

    var XYZColor = function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    };

    var LabColor = function (l, a, b) {
        this.l = l;
        this.a = a;
        this.b = b;
    };

    var LCHColor = function (l, c, h) {
        this.l = l;
        this.c = c;
        this.h = h;
    };


    var ImpColor = {
        srgb_to_rgb_string: function (c) {
            var ir = Math.min(Math.max(Math.round(c.r*255),0), 255);
            var ig = Math.min(Math.max(Math.round(c.g*255),0), 255);
            var ib = Math.min(Math.max(Math.round(c.b*255),0), 255);
            return 'rgb(' + ir + ',' + ig + ',' + ib + ')';
        },
        srgb_to_linear_rgb: function (c) {
            return new RGBColor(
                c.r <= 0.04045 ? c.r / 12.92 : Math.pow((c.r + 0.055) / 1.055, 2.4),
                c.g <= 0.04045 ? c.g / 12.92 : Math.pow((c.g + 0.055) / 1.055, 2.4),
                c.b <= 0.04045 ? c.b / 12.92 : Math.pow((c.b + 0.055) / 1.055, 2.4)
            );
        },
        linear_rgb_to_srgb: function (c) {
            return new RGBColor(
                c.r <= 0.0031308 ? 12.92 * c.r : Math.pow(c.r, 1.0/2.4) * 1.055 - 0.055,
                c.g <= 0.0031308 ? 12.92 * c.g : Math.pow(c.g, 1.0/2.4) * 1.055 - 0.055,
                c.b <= 0.0031308 ? 12.92 * c.b : Math.pow(c.b, 1.0/2.4) * 1.055 - 0.055
            );
        },
        linear_rgb_to_xyz: function (c) {
            return new XYZColor(
                c.r*0.4124+c.g*0.3576+c.b*0.1805,
                c.r*0.2126+c.g*0.7152+c.b*0.0722,
                c.r*0.0193+c.g*0.1192+c.b*0.9505
            );
        },
        xyz_to_linear_rgb: function (c) {
            return new RGBColor(
                c.x*3.2406 +c.y*-1.5372+c.z*-0.4986,
                c.x*-0.9689+c.y* 1.8758+c.z* 0.0415,
                c.x*0.0557 +c.y*-0.2040+c.z* 1.0570
            );
        },
        lab_f: function (t) {
            if (t > 0.008856452) return Math.pow(t, 1.0/3.0);
            return t*7.787037037 + 0.137931034;
        },
        lab_inv_f: function (t) {
            if (t > 0.206896552) return Math.pow(t, 3.0);
            return (t - 0.137931034) * 0.128418549;
        },
        xyz_to_lab: function (c) {
            var xn = 0.95047, yn = 1.0, zn = 1.08883;
            var fxxn = ImpColor.lab_f(c.x / xn);
            var fyyn = ImpColor.lab_f(c.y / yn);
            var fzzn = ImpColor.lab_f(c.z / zn);
            return new LabColor(
                116.0 * fyyn - 16.0,
                500.0 * (fxxn - fyyn),
                200.0 * (fyyn - fzzn)
            );
        },
        lab_to_xyz: function (c) {
            var xn = 0.95047, yn = 1.0, zn = 1.08883;
            var tl = (c.l + 16.0) / 116.0;
            return new XYZColor(
                xn * ImpColor.lab_inv_f(tl + c.a / 500.0),
                yn * ImpColor.lab_inv_f(tl),
                zn * ImpColor.lab_inv_f(tl - c.b / 200.0)
            );
        },
        lab_to_lch: function (c) {
            return new LCHColor(c.l, Math.sqrt(c.a*c.a + c.b*c.b), Math.atan2(c.b, c.a));
        },
        lch_to_lab: function (c) {
            return new LabColor(c.l, c.c * Math.cos(c.h), c.c * Math.sin(c.h));
        },
        srgb_to_xyz: function (c) {
            return ImpColor.linear_rgb_to_xyz(ImpColor.srgb_to_linear_rgb(c));
        },
        xyz_to_srgb: function (c) {
            return ImpColor.linear_rgb_to_srgb(ImpColor.xyz_to_linear_rgb(c));
        },
        srgb_to_lab: function (c) {
            return ImpColor.xyz_to_lab(ImpColor.srgb_to_xyz(c));
        },
        lab_to_srgb: function (c) {
            return ImpColor.xyz_to_srgb(ImpColor.lab_to_xyz(c));
        },
        srgb_to_lch: function (c) {
            return ImpColor.lab_to_lch(ImpColor.srgb_to_lab(c));
        },
        lch_to_srgb: function (c) {
            return ImpColor.lab_to_srgb(ImpColor.lch_to_lab(c));
        },

        RGBColor: RGBColor,
        LabColor: LabColor,
        XYZColor: XYZColor,
        LCHColor: LCHColor
    };

    scope.ImpColor = ImpColor;
    return scope;
});
