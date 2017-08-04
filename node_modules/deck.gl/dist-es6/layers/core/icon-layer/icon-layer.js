var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
import { Layer } from '../../../lib';
import { GL, Model, Geometry, Texture2D, loadTextures } from 'luma.gl';
import { fp64ify, enable64bitSupport } from '../../../lib/utils/fp64';
import { COORDINATE_SYSTEM } from '../../../lib';

import vs from './icon-layer-vertex.glsl';
import vs64 from './icon-layer-vertex-64.glsl';
import fs from './icon-layer-fragment.glsl';

var DEFAULT_COLOR = [0, 0, 0, 255];

/*
 * @param {object} props
 * @param {Texture2D | string} props.iconAtlas - atlas image url or texture
 * @param {object} props.iconMapping - icon names mapped to icon definitions
 * @param {object} props.iconMapping[icon_name].x - x position of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].y - y position of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].width - width of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].height - height of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].anchorX - x anchor of icon on the atlas image,
 *   default to width / 2
 * @param {object} props.iconMapping[icon_name].anchorY - y anchor of icon on the atlas image,
 *   default to height / 2
 * @param {object} props.iconMapping[icon_name].mask - whether icon is treated as a transparency
 *   mask. If true, user defined color is applied. If false, original color from the image is
 *   applied. Default to false.
 * @param {number} props.size - icon size in pixels
 * @param {func} props.getPosition - returns anchor position of the icon, in [lng, lat, z]
 * @param {func} props.getIcon - returns icon name as a string
 * @param {func} props.getSize - returns icon size multiplier as a number
 * @param {func} props.getColor - returns color of the icon in [r, g, b, a]. Only works on icons
 *   with mask: true.
 * @param {func} props.getAngle - returns rotating angle (in degree) of the icon.
 */
var defaultProps = {
  iconAtlas: null,
  iconMapping: {},
  sizeScale: 1,
  fp64: false,

  getPosition: function getPosition(x) {
    return x.position;
  },
  getIcon: function getIcon(x) {
    return x.icon;
  },
  getColor: function getColor(x) {
    return x.color || DEFAULT_COLOR;
  },
  getSize: function getSize(x) {
    return x.size || 1;
  },
  getAngle: function getAngle(x) {
    return x.angle || 0;
  }
};

var IconLayer = function (_Layer) {
  _inherits(IconLayer, _Layer);

  function IconLayer() {
    _classCallCheck(this, IconLayer);

    return _possibleConstructorReturn(this, (IconLayer.__proto__ || Object.getPrototypeOf(IconLayer)).apply(this, arguments));
  }

  _createClass(IconLayer, [{
    key: 'getShaders',
    value: function getShaders() {
      return enable64bitSupport(this.props) ? { vs: vs64, fs: fs, modules: ['project64'] } : { vs: vs, fs: fs }; // 'project' module added by default.
    }
  }, {
    key: 'initializeState',
    value: function initializeState() {
      var attributeManager = this.state.attributeManager;
      var gl = this.context.gl;

      /* eslint-disable max-len */

      attributeManager.addInstanced({
        instancePositions: { size: 3, accessor: 'getPosition', update: this.calculateInstancePositions },
        instanceSizes: { size: 1, accessor: 'getSize', update: this.calculateInstanceSizes },
        instanceOffsets: { size: 2, accessor: 'getIcon', update: this.calculateInstanceOffsets },
        instanceIconFrames: { size: 4, accessor: 'getIcon', update: this.calculateInstanceIconFrames },
        instanceColorModes: { size: 1, type: GL.UNSIGNED_BYTE, accessor: 'getIcon', update: this.calculateInstanceColorMode },
        instanceColors: { size: 4, type: GL.UNSIGNED_BYTE, accessor: 'getColor', update: this.calculateInstanceColors },
        instanceAngles: { size: 1, accessor: 'getAngle', update: this.calculateInstanceAngles }
      });
      /* eslint-enable max-len */

      this.setState({ model: this._getModel(gl) });
    }
  }, {
    key: 'updateAttribute',
    value: function updateAttribute(_ref) {
      var props = _ref.props,
          oldProps = _ref.oldProps,
          changeFlags = _ref.changeFlags;

      if (props.fp64 !== oldProps.fp64) {
        var attributeManager = this.state.attributeManager;

        attributeManager.invalidateAll();

        if (props.fp64 && props.projectionMode === COORDINATE_SYSTEM.LNGLAT) {
          attributeManager.addInstanced({
            instancePositions64xyLow: {
              size: 2,
              accessor: 'getPosition',
              update: this.calculateInstancePositions64xyLow
            }
          });
        } else {
          attributeManager.remove(['instancePositions64xyLow']);
        }
      }
    }
  }, {
    key: 'updateState',
    value: function updateState(_ref2) {
      var _this2 = this;

      var oldProps = _ref2.oldProps,
          props = _ref2.props,
          changeFlags = _ref2.changeFlags;

      _get(IconLayer.prototype.__proto__ || Object.getPrototypeOf(IconLayer.prototype), 'updateState', this).call(this, { props: props, oldProps: oldProps, changeFlags: changeFlags });

      var iconAtlas = props.iconAtlas,
          iconMapping = props.iconMapping;


      if (oldProps.iconMapping !== iconMapping) {
        var attributeManager = this.state.attributeManager;

        attributeManager.invalidate('instanceOffsets');
        attributeManager.invalidate('instanceIconFrames');
        attributeManager.invalidate('instanceColorModes');
      }

      if (oldProps.iconAtlas !== iconAtlas) {

        if (iconAtlas instanceof Texture2D) {
          this.setState({ iconsTexture: iconAtlas });
        } else if (typeof iconAtlas === 'string') {
          loadTextures(this.context.gl, {
            urls: [iconAtlas]
          }).then(function (_ref3) {
            var _ref4 = _slicedToArray(_ref3, 1),
                texture = _ref4[0];

            _this2.setState({ iconsTexture: texture });
          });
        }
      }

      if (props.fp64 !== oldProps.fp64) {
        var gl = this.context.gl;

        this.setState({ model: this._getModel(gl) });
      }
      this.updateAttribute({ props: props, oldProps: oldProps, changeFlags: changeFlags });
    }
  }, {
    key: 'draw',
    value: function draw(_ref5) {
      var uniforms = _ref5.uniforms;
      var sizeScale = this.props.sizeScale;
      var iconsTexture = this.state.iconsTexture;


      if (iconsTexture) {
        this.state.model.render(Object.assign({}, uniforms, {
          iconsTexture: iconsTexture,
          iconsTextureDim: [iconsTexture.width, iconsTexture.height],
          sizeScale: sizeScale
        }));
      }
    }
  }, {
    key: '_getModel',
    value: function _getModel(gl) {

      var positions = [-1, -1, 0, -1, 1, 0, 1, 1, 0, 1, -1, 0];

      return new Model(gl, Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: new Geometry({
          drawMode: GL.TRIANGLE_FAN,
          positions: new Float32Array(positions)
        }),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      }));
    }
  }, {
    key: 'calculateInstancePositions',
    value: function calculateInstancePositions(attribute) {
      var _props = this.props,
          data = _props.data,
          getPosition = _props.getPosition;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = data[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var object = _step.value;

          var position = getPosition(object);
          value[i++] = position[0];
          value[i++] = position[1];
          value[i++] = position[2] || 0;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }, {
    key: 'calculateInstancePositions64xyLow',
    value: function calculateInstancePositions64xyLow(attribute) {
      var _props2 = this.props,
          data = _props2.data,
          getPosition = _props2.getPosition;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = data[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var point = _step2.value;

          var position = getPosition(point);
          value[i++] = fp64ify(position[0])[1];
          value[i++] = fp64ify(position[1])[1];
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  }, {
    key: 'calculateInstanceSizes',
    value: function calculateInstanceSizes(attribute) {
      var _props3 = this.props,
          data = _props3.data,
          getSize = _props3.getSize;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = data[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var object = _step3.value;

          value[i++] = getSize(object);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    }
  }, {
    key: 'calculateInstanceAngles',
    value: function calculateInstanceAngles(attribute) {
      var _props4 = this.props,
          data = _props4.data,
          getAngle = _props4.getAngle;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = data[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var object = _step4.value;

          value[i++] = getAngle(object);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }
  }, {
    key: 'calculateInstanceColors',
    value: function calculateInstanceColors(attribute) {
      var _props5 = this.props,
          data = _props5.data,
          getColor = _props5.getColor;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = data[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var object = _step5.value;

          var color = getColor(object);

          value[i++] = color[0];
          value[i++] = color[1];
          value[i++] = color[2];
          value[i++] = isNaN(color[3]) ? 255 : color[3];
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5.return) {
            _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }
    }
  }, {
    key: 'calculateInstanceOffsets',
    value: function calculateInstanceOffsets(attribute) {
      var _props6 = this.props,
          data = _props6.data,
          iconMapping = _props6.iconMapping,
          getIcon = _props6.getIcon;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;
      var _iteratorError6 = undefined;

      try {
        for (var _iterator6 = data[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
          var object = _step6.value;

          var icon = getIcon(object);
          var rect = iconMapping[icon] || {};
          value[i++] = 1 / 2 - rect.anchorX / rect.width || 0;
          value[i++] = 1 / 2 - rect.anchorY / rect.height || 0;
        }
      } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion6 && _iterator6.return) {
            _iterator6.return();
          }
        } finally {
          if (_didIteratorError6) {
            throw _iteratorError6;
          }
        }
      }
    }
  }, {
    key: 'calculateInstanceColorMode',
    value: function calculateInstanceColorMode(attribute) {
      var _props7 = this.props,
          data = _props7.data,
          iconMapping = _props7.iconMapping,
          getIcon = _props7.getIcon;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = data[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var object = _step7.value;

          var icon = getIcon(object);
          var colorMode = iconMapping[icon] && iconMapping[icon].mask;
          value[i++] = colorMode ? 1 : 0;
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7.return) {
            _iterator7.return();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
        }
      }
    }
  }, {
    key: 'calculateInstanceIconFrames',
    value: function calculateInstanceIconFrames(attribute) {
      var _props8 = this.props,
          data = _props8.data,
          iconMapping = _props8.iconMapping,
          getIcon = _props8.getIcon;
      var value = attribute.value;

      var i = 0;
      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = data[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var object = _step8.value;

          var icon = getIcon(object);
          var rect = iconMapping[icon] || {};
          value[i++] = rect.x || 0;
          value[i++] = rect.y || 0;
          value[i++] = rect.width || 0;
          value[i++] = rect.height || 0;
        }
      } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion8 && _iterator8.return) {
            _iterator8.return();
          }
        } finally {
          if (_didIteratorError8) {
            throw _iteratorError8;
          }
        }
      }
    }
  }]);

  return IconLayer;
}(Layer);

export default IconLayer;


IconLayer.layerName = 'IconLayer';
IconLayer.defaultProps = defaultProps;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9sYXllcnMvY29yZS9pY29uLWxheWVyL2ljb24tbGF5ZXIuanMiXSwibmFtZXMiOlsiTGF5ZXIiLCJHTCIsIk1vZGVsIiwiR2VvbWV0cnkiLCJUZXh0dXJlMkQiLCJsb2FkVGV4dHVyZXMiLCJmcDY0aWZ5IiwiZW5hYmxlNjRiaXRTdXBwb3J0IiwiQ09PUkRJTkFURV9TWVNURU0iLCJ2cyIsInZzNjQiLCJmcyIsIkRFRkFVTFRfQ09MT1IiLCJkZWZhdWx0UHJvcHMiLCJpY29uQXRsYXMiLCJpY29uTWFwcGluZyIsInNpemVTY2FsZSIsImZwNjQiLCJnZXRQb3NpdGlvbiIsIngiLCJwb3NpdGlvbiIsImdldEljb24iLCJpY29uIiwiZ2V0Q29sb3IiLCJjb2xvciIsImdldFNpemUiLCJzaXplIiwiZ2V0QW5nbGUiLCJhbmdsZSIsIkljb25MYXllciIsInByb3BzIiwibW9kdWxlcyIsImF0dHJpYnV0ZU1hbmFnZXIiLCJzdGF0ZSIsImdsIiwiY29udGV4dCIsImFkZEluc3RhbmNlZCIsImluc3RhbmNlUG9zaXRpb25zIiwiYWNjZXNzb3IiLCJ1cGRhdGUiLCJjYWxjdWxhdGVJbnN0YW5jZVBvc2l0aW9ucyIsImluc3RhbmNlU2l6ZXMiLCJjYWxjdWxhdGVJbnN0YW5jZVNpemVzIiwiaW5zdGFuY2VPZmZzZXRzIiwiY2FsY3VsYXRlSW5zdGFuY2VPZmZzZXRzIiwiaW5zdGFuY2VJY29uRnJhbWVzIiwiY2FsY3VsYXRlSW5zdGFuY2VJY29uRnJhbWVzIiwiaW5zdGFuY2VDb2xvck1vZGVzIiwidHlwZSIsIlVOU0lHTkVEX0JZVEUiLCJjYWxjdWxhdGVJbnN0YW5jZUNvbG9yTW9kZSIsImluc3RhbmNlQ29sb3JzIiwiY2FsY3VsYXRlSW5zdGFuY2VDb2xvcnMiLCJpbnN0YW5jZUFuZ2xlcyIsImNhbGN1bGF0ZUluc3RhbmNlQW5nbGVzIiwic2V0U3RhdGUiLCJtb2RlbCIsIl9nZXRNb2RlbCIsIm9sZFByb3BzIiwiY2hhbmdlRmxhZ3MiLCJpbnZhbGlkYXRlQWxsIiwicHJvamVjdGlvbk1vZGUiLCJMTkdMQVQiLCJpbnN0YW5jZVBvc2l0aW9uczY0eHlMb3ciLCJjYWxjdWxhdGVJbnN0YW5jZVBvc2l0aW9uczY0eHlMb3ciLCJyZW1vdmUiLCJpbnZhbGlkYXRlIiwiaWNvbnNUZXh0dXJlIiwidXJscyIsInRoZW4iLCJ0ZXh0dXJlIiwidXBkYXRlQXR0cmlidXRlIiwidW5pZm9ybXMiLCJyZW5kZXIiLCJPYmplY3QiLCJhc3NpZ24iLCJpY29uc1RleHR1cmVEaW0iLCJ3aWR0aCIsImhlaWdodCIsInBvc2l0aW9ucyIsImdldFNoYWRlcnMiLCJpZCIsImdlb21ldHJ5IiwiZHJhd01vZGUiLCJUUklBTkdMRV9GQU4iLCJGbG9hdDMyQXJyYXkiLCJpc0luc3RhbmNlZCIsInNoYWRlckNhY2hlIiwiYXR0cmlidXRlIiwiZGF0YSIsInZhbHVlIiwiaSIsIm9iamVjdCIsInBvaW50IiwiaXNOYU4iLCJyZWN0IiwiYW5jaG9yWCIsImFuY2hvclkiLCJjb2xvck1vZGUiLCJtYXNrIiwieSIsImxheWVyTmFtZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFRQSxLQUFSLFFBQW9CLGNBQXBCO0FBQ0EsU0FBUUMsRUFBUixFQUFZQyxLQUFaLEVBQW1CQyxRQUFuQixFQUE2QkMsU0FBN0IsRUFBd0NDLFlBQXhDLFFBQTJELFNBQTNEO0FBQ0EsU0FBUUMsT0FBUixFQUFpQkMsa0JBQWpCLFFBQTBDLHlCQUExQztBQUNBLFNBQVFDLGlCQUFSLFFBQWdDLGNBQWhDOztBQUVBLE9BQU9DLEVBQVAsTUFBZSwwQkFBZjtBQUNBLE9BQU9DLElBQVAsTUFBaUIsNkJBQWpCO0FBQ0EsT0FBT0MsRUFBUCxNQUFlLDRCQUFmOztBQUVBLElBQU1DLGdCQUFnQixDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sQ0FBUCxFQUFVLEdBQVYsQ0FBdEI7O0FBRUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBdUJBLElBQU1DLGVBQWU7QUFDbkJDLGFBQVcsSUFEUTtBQUVuQkMsZUFBYSxFQUZNO0FBR25CQyxhQUFXLENBSFE7QUFJbkJDLFFBQU0sS0FKYTs7QUFNbkJDLGVBQWE7QUFBQSxXQUFLQyxFQUFFQyxRQUFQO0FBQUEsR0FOTTtBQU9uQkMsV0FBUztBQUFBLFdBQUtGLEVBQUVHLElBQVA7QUFBQSxHQVBVO0FBUW5CQyxZQUFVO0FBQUEsV0FBS0osRUFBRUssS0FBRixJQUFXWixhQUFoQjtBQUFBLEdBUlM7QUFTbkJhLFdBQVM7QUFBQSxXQUFLTixFQUFFTyxJQUFGLElBQVUsQ0FBZjtBQUFBLEdBVFU7QUFVbkJDLFlBQVU7QUFBQSxXQUFLUixFQUFFUyxLQUFGLElBQVcsQ0FBaEI7QUFBQTtBQVZTLENBQXJCOztJQWFxQkMsUzs7Ozs7Ozs7Ozs7aUNBQ047QUFDWCxhQUFPdEIsbUJBQW1CLEtBQUt1QixLQUF4QixJQUNMLEVBQUNyQixJQUFJQyxJQUFMLEVBQVdDLE1BQVgsRUFBZW9CLFNBQVMsQ0FBQyxXQUFELENBQXhCLEVBREssR0FFTCxFQUFDdEIsTUFBRCxFQUFLRSxNQUFMLEVBRkYsQ0FEVyxDQUdFO0FBQ2Q7OztzQ0FFaUI7QUFBQSxVQUNUcUIsZ0JBRFMsR0FDVyxLQUFLQyxLQURoQixDQUNURCxnQkFEUztBQUFBLFVBRVRFLEVBRlMsR0FFSCxLQUFLQyxPQUZGLENBRVRELEVBRlM7O0FBSWhCOztBQUNBRix1QkFBaUJJLFlBQWpCLENBQThCO0FBQzVCQywyQkFBbUIsRUFBQ1gsTUFBTSxDQUFQLEVBQVVZLFVBQVUsYUFBcEIsRUFBbUNDLFFBQVEsS0FBS0MsMEJBQWhELEVBRFM7QUFFNUJDLHVCQUFlLEVBQUNmLE1BQU0sQ0FBUCxFQUFVWSxVQUFVLFNBQXBCLEVBQStCQyxRQUFRLEtBQUtHLHNCQUE1QyxFQUZhO0FBRzVCQyx5QkFBaUIsRUFBQ2pCLE1BQU0sQ0FBUCxFQUFVWSxVQUFVLFNBQXBCLEVBQStCQyxRQUFRLEtBQUtLLHdCQUE1QyxFQUhXO0FBSTVCQyw0QkFBb0IsRUFBQ25CLE1BQU0sQ0FBUCxFQUFVWSxVQUFVLFNBQXBCLEVBQStCQyxRQUFRLEtBQUtPLDJCQUE1QyxFQUpRO0FBSzVCQyw0QkFBb0IsRUFBQ3JCLE1BQU0sQ0FBUCxFQUFVc0IsTUFBTS9DLEdBQUdnRCxhQUFuQixFQUFrQ1gsVUFBVSxTQUE1QyxFQUF1REMsUUFBUSxLQUFLVywwQkFBcEUsRUFMUTtBQU01QkMsd0JBQWdCLEVBQUN6QixNQUFNLENBQVAsRUFBVXNCLE1BQU0vQyxHQUFHZ0QsYUFBbkIsRUFBa0NYLFVBQVUsVUFBNUMsRUFBd0RDLFFBQVEsS0FBS2EsdUJBQXJFLEVBTlk7QUFPNUJDLHdCQUFnQixFQUFDM0IsTUFBTSxDQUFQLEVBQVVZLFVBQVUsVUFBcEIsRUFBZ0NDLFFBQVEsS0FBS2UsdUJBQTdDO0FBUFksT0FBOUI7QUFTQTs7QUFFQSxXQUFLQyxRQUFMLENBQWMsRUFBQ0MsT0FBTyxLQUFLQyxTQUFMLENBQWV2QixFQUFmLENBQVIsRUFBZDtBQUNEOzs7MENBRStDO0FBQUEsVUFBL0JKLEtBQStCLFFBQS9CQSxLQUErQjtBQUFBLFVBQXhCNEIsUUFBd0IsUUFBeEJBLFFBQXdCO0FBQUEsVUFBZEMsV0FBYyxRQUFkQSxXQUFjOztBQUM5QyxVQUFJN0IsTUFBTWIsSUFBTixLQUFleUMsU0FBU3pDLElBQTVCLEVBQWtDO0FBQUEsWUFDekJlLGdCQUR5QixHQUNMLEtBQUtDLEtBREEsQ0FDekJELGdCQUR5Qjs7QUFFaENBLHlCQUFpQjRCLGFBQWpCOztBQUVBLFlBQUk5QixNQUFNYixJQUFOLElBQWNhLE1BQU0rQixjQUFOLEtBQXlCckQsa0JBQWtCc0QsTUFBN0QsRUFBcUU7QUFDbkU5QiwyQkFBaUJJLFlBQWpCLENBQThCO0FBQzVCMkIsc0NBQTBCO0FBQ3hCckMsb0JBQU0sQ0FEa0I7QUFFeEJZLHdCQUFVLGFBRmM7QUFHeEJDLHNCQUFRLEtBQUt5QjtBQUhXO0FBREUsV0FBOUI7QUFPRCxTQVJELE1BUU87QUFDTGhDLDJCQUFpQmlDLE1BQWpCLENBQXdCLENBQ3RCLDBCQURzQixDQUF4QjtBQUdEO0FBRUY7QUFDRjs7O3VDQUUyQztBQUFBOztBQUFBLFVBQS9CUCxRQUErQixTQUEvQkEsUUFBK0I7QUFBQSxVQUFyQjVCLEtBQXFCLFNBQXJCQSxLQUFxQjtBQUFBLFVBQWQ2QixXQUFjLFNBQWRBLFdBQWM7O0FBQzFDLHdIQUFrQixFQUFDN0IsWUFBRCxFQUFRNEIsa0JBQVIsRUFBa0JDLHdCQUFsQixFQUFsQjs7QUFEMEMsVUFHbkM3QyxTQUhtQyxHQUdUZ0IsS0FIUyxDQUduQ2hCLFNBSG1DO0FBQUEsVUFHeEJDLFdBSHdCLEdBR1RlLEtBSFMsQ0FHeEJmLFdBSHdCOzs7QUFLMUMsVUFBSTJDLFNBQVMzQyxXQUFULEtBQXlCQSxXQUE3QixFQUEwQztBQUFBLFlBQ2pDaUIsZ0JBRGlDLEdBQ2IsS0FBS0MsS0FEUSxDQUNqQ0QsZ0JBRGlDOztBQUV4Q0EseUJBQWlCa0MsVUFBakIsQ0FBNEIsaUJBQTVCO0FBQ0FsQyx5QkFBaUJrQyxVQUFqQixDQUE0QixvQkFBNUI7QUFDQWxDLHlCQUFpQmtDLFVBQWpCLENBQTRCLG9CQUE1QjtBQUNEOztBQUVELFVBQUlSLFNBQVM1QyxTQUFULEtBQXVCQSxTQUEzQixFQUFzQzs7QUFFcEMsWUFBSUEscUJBQXFCVixTQUF6QixFQUFvQztBQUNsQyxlQUFLbUQsUUFBTCxDQUFjLEVBQUNZLGNBQWNyRCxTQUFmLEVBQWQ7QUFDRCxTQUZELE1BRU8sSUFBSSxPQUFPQSxTQUFQLEtBQXFCLFFBQXpCLEVBQW1DO0FBQ3hDVCx1QkFBYSxLQUFLOEIsT0FBTCxDQUFhRCxFQUExQixFQUE4QjtBQUM1QmtDLGtCQUFNLENBQUN0RCxTQUFEO0FBRHNCLFdBQTlCLEVBR0N1RCxJQUhELENBR00saUJBQWU7QUFBQTtBQUFBLGdCQUFiQyxPQUFhOztBQUNuQixtQkFBS2YsUUFBTCxDQUFjLEVBQUNZLGNBQWNHLE9BQWYsRUFBZDtBQUNELFdBTEQ7QUFNRDtBQUNGOztBQUVELFVBQUl4QyxNQUFNYixJQUFOLEtBQWV5QyxTQUFTekMsSUFBNUIsRUFBa0M7QUFBQSxZQUN6QmlCLEVBRHlCLEdBQ25CLEtBQUtDLE9BRGMsQ0FDekJELEVBRHlCOztBQUVoQyxhQUFLcUIsUUFBTCxDQUFjLEVBQUNDLE9BQU8sS0FBS0MsU0FBTCxDQUFldkIsRUFBZixDQUFSLEVBQWQ7QUFDRDtBQUNELFdBQUtxQyxlQUFMLENBQXFCLEVBQUN6QyxZQUFELEVBQVE0QixrQkFBUixFQUFrQkMsd0JBQWxCLEVBQXJCO0FBRUQ7OztnQ0FFZ0I7QUFBQSxVQUFYYSxRQUFXLFNBQVhBLFFBQVc7QUFBQSxVQUNSeEQsU0FEUSxHQUNLLEtBQUtjLEtBRFYsQ0FDUmQsU0FEUTtBQUFBLFVBRVJtRCxZQUZRLEdBRVEsS0FBS2xDLEtBRmIsQ0FFUmtDLFlBRlE7OztBQUlmLFVBQUlBLFlBQUosRUFBa0I7QUFDaEIsYUFBS2xDLEtBQUwsQ0FBV3VCLEtBQVgsQ0FBaUJpQixNQUFqQixDQUF3QkMsT0FBT0MsTUFBUCxDQUFjLEVBQWQsRUFBa0JILFFBQWxCLEVBQTRCO0FBQ2xETCxvQ0FEa0Q7QUFFbERTLDJCQUFpQixDQUFDVCxhQUFhVSxLQUFkLEVBQXFCVixhQUFhVyxNQUFsQyxDQUZpQztBQUdsRDlEO0FBSGtELFNBQTVCLENBQXhCO0FBS0Q7QUFDRjs7OzhCQUVTa0IsRSxFQUFJOztBQUVaLFVBQU02QyxZQUFZLENBQUMsQ0FBQyxDQUFGLEVBQUssQ0FBQyxDQUFOLEVBQVMsQ0FBVCxFQUFZLENBQUMsQ0FBYixFQUFnQixDQUFoQixFQUFtQixDQUFuQixFQUFzQixDQUF0QixFQUF5QixDQUF6QixFQUE0QixDQUE1QixFQUErQixDQUEvQixFQUFrQyxDQUFDLENBQW5DLEVBQXNDLENBQXRDLENBQWxCOztBQUVBLGFBQU8sSUFBSTdFLEtBQUosQ0FBVWdDLEVBQVYsRUFBY3dDLE9BQU9DLE1BQVAsQ0FBYyxFQUFkLEVBQWtCLEtBQUtLLFVBQUwsRUFBbEIsRUFBcUM7QUFDeERDLFlBQUksS0FBS25ELEtBQUwsQ0FBV21ELEVBRHlDO0FBRXhEQyxrQkFBVSxJQUFJL0UsUUFBSixDQUFhO0FBQ3JCZ0Ysb0JBQVVsRixHQUFHbUYsWUFEUTtBQUVyQkwscUJBQVcsSUFBSU0sWUFBSixDQUFpQk4sU0FBakI7QUFGVSxTQUFiLENBRjhDO0FBTXhETyxxQkFBYSxJQU4yQztBQU94REMscUJBQWEsS0FBS3BELE9BQUwsQ0FBYW9EO0FBUDhCLE9BQXJDLENBQWQsQ0FBUDtBQVNEOzs7K0NBRTBCQyxTLEVBQVc7QUFBQSxtQkFDUixLQUFLMUQsS0FERztBQUFBLFVBQzdCMkQsSUFENkIsVUFDN0JBLElBRDZCO0FBQUEsVUFDdkJ2RSxXQUR1QixVQUN2QkEsV0FEdUI7QUFBQSxVQUU3QndFLEtBRjZCLEdBRXBCRixTQUZvQixDQUU3QkUsS0FGNkI7O0FBR3BDLFVBQUlDLElBQUksQ0FBUjtBQUhvQztBQUFBO0FBQUE7O0FBQUE7QUFJcEMsNkJBQXFCRixJQUFyQiw4SEFBMkI7QUFBQSxjQUFoQkcsTUFBZ0I7O0FBQ3pCLGNBQU14RSxXQUFXRixZQUFZMEUsTUFBWixDQUFqQjtBQUNBRixnQkFBTUMsR0FBTixJQUFhdkUsU0FBUyxDQUFULENBQWI7QUFDQXNFLGdCQUFNQyxHQUFOLElBQWF2RSxTQUFTLENBQVQsQ0FBYjtBQUNBc0UsZ0JBQU1DLEdBQU4sSUFBYXZFLFNBQVMsQ0FBVCxLQUFlLENBQTVCO0FBQ0Q7QUFUbUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVVyQzs7O3NEQUVpQ29FLFMsRUFBVztBQUFBLG9CQUNmLEtBQUsxRCxLQURVO0FBQUEsVUFDcEMyRCxJQURvQyxXQUNwQ0EsSUFEb0M7QUFBQSxVQUM5QnZFLFdBRDhCLFdBQzlCQSxXQUQ4QjtBQUFBLFVBRXBDd0UsS0FGb0MsR0FFM0JGLFNBRjJCLENBRXBDRSxLQUZvQzs7QUFHM0MsVUFBSUMsSUFBSSxDQUFSO0FBSDJDO0FBQUE7QUFBQTs7QUFBQTtBQUkzQyw4QkFBb0JGLElBQXBCLG1JQUEwQjtBQUFBLGNBQWZJLEtBQWU7O0FBQ3hCLGNBQU16RSxXQUFXRixZQUFZMkUsS0FBWixDQUFqQjtBQUNBSCxnQkFBTUMsR0FBTixJQUFhckYsUUFBUWMsU0FBUyxDQUFULENBQVIsRUFBcUIsQ0FBckIsQ0FBYjtBQUNBc0UsZ0JBQU1DLEdBQU4sSUFBYXJGLFFBQVFjLFNBQVMsQ0FBVCxDQUFSLEVBQXFCLENBQXJCLENBQWI7QUFDRDtBQVIwQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBUzVDOzs7MkNBRXNCb0UsUyxFQUFXO0FBQUEsb0JBQ1IsS0FBSzFELEtBREc7QUFBQSxVQUN6QjJELElBRHlCLFdBQ3pCQSxJQUR5QjtBQUFBLFVBQ25CaEUsT0FEbUIsV0FDbkJBLE9BRG1CO0FBQUEsVUFFekJpRSxLQUZ5QixHQUVoQkYsU0FGZ0IsQ0FFekJFLEtBRnlCOztBQUdoQyxVQUFJQyxJQUFJLENBQVI7QUFIZ0M7QUFBQTtBQUFBOztBQUFBO0FBSWhDLDhCQUFxQkYsSUFBckIsbUlBQTJCO0FBQUEsY0FBaEJHLE1BQWdCOztBQUN6QkYsZ0JBQU1DLEdBQU4sSUFBYWxFLFFBQVFtRSxNQUFSLENBQWI7QUFDRDtBQU4rQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBT2pDOzs7NENBRXVCSixTLEVBQVc7QUFBQSxvQkFDUixLQUFLMUQsS0FERztBQUFBLFVBQzFCMkQsSUFEMEIsV0FDMUJBLElBRDBCO0FBQUEsVUFDcEI5RCxRQURvQixXQUNwQkEsUUFEb0I7QUFBQSxVQUUxQitELEtBRjBCLEdBRWpCRixTQUZpQixDQUUxQkUsS0FGMEI7O0FBR2pDLFVBQUlDLElBQUksQ0FBUjtBQUhpQztBQUFBO0FBQUE7O0FBQUE7QUFJakMsOEJBQXFCRixJQUFyQixtSUFBMkI7QUFBQSxjQUFoQkcsTUFBZ0I7O0FBQ3pCRixnQkFBTUMsR0FBTixJQUFhaEUsU0FBU2lFLE1BQVQsQ0FBYjtBQUNEO0FBTmdDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFPbEM7Ozs0Q0FFdUJKLFMsRUFBVztBQUFBLG9CQUNSLEtBQUsxRCxLQURHO0FBQUEsVUFDMUIyRCxJQUQwQixXQUMxQkEsSUFEMEI7QUFBQSxVQUNwQmxFLFFBRG9CLFdBQ3BCQSxRQURvQjtBQUFBLFVBRTFCbUUsS0FGMEIsR0FFakJGLFNBRmlCLENBRTFCRSxLQUYwQjs7QUFHakMsVUFBSUMsSUFBSSxDQUFSO0FBSGlDO0FBQUE7QUFBQTs7QUFBQTtBQUlqQyw4QkFBcUJGLElBQXJCLG1JQUEyQjtBQUFBLGNBQWhCRyxNQUFnQjs7QUFDekIsY0FBTXBFLFFBQVFELFNBQVNxRSxNQUFULENBQWQ7O0FBRUFGLGdCQUFNQyxHQUFOLElBQWFuRSxNQUFNLENBQU4sQ0FBYjtBQUNBa0UsZ0JBQU1DLEdBQU4sSUFBYW5FLE1BQU0sQ0FBTixDQUFiO0FBQ0FrRSxnQkFBTUMsR0FBTixJQUFhbkUsTUFBTSxDQUFOLENBQWI7QUFDQWtFLGdCQUFNQyxHQUFOLElBQWFHLE1BQU10RSxNQUFNLENBQU4sQ0FBTixJQUFrQixHQUFsQixHQUF3QkEsTUFBTSxDQUFOLENBQXJDO0FBQ0Q7QUFYZ0M7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVlsQzs7OzZDQUV3QmdFLFMsRUFBVztBQUFBLG9CQUNHLEtBQUsxRCxLQURSO0FBQUEsVUFDM0IyRCxJQUQyQixXQUMzQkEsSUFEMkI7QUFBQSxVQUNyQjFFLFdBRHFCLFdBQ3JCQSxXQURxQjtBQUFBLFVBQ1JNLE9BRFEsV0FDUkEsT0FEUTtBQUFBLFVBRTNCcUUsS0FGMkIsR0FFbEJGLFNBRmtCLENBRTNCRSxLQUYyQjs7QUFHbEMsVUFBSUMsSUFBSSxDQUFSO0FBSGtDO0FBQUE7QUFBQTs7QUFBQTtBQUlsQyw4QkFBcUJGLElBQXJCLG1JQUEyQjtBQUFBLGNBQWhCRyxNQUFnQjs7QUFDekIsY0FBTXRFLE9BQU9ELFFBQVF1RSxNQUFSLENBQWI7QUFDQSxjQUFNRyxPQUFPaEYsWUFBWU8sSUFBWixLQUFxQixFQUFsQztBQUNBb0UsZ0JBQU1DLEdBQU4sSUFBYyxJQUFJLENBQUosR0FBUUksS0FBS0MsT0FBTCxHQUFlRCxLQUFLbEIsS0FBN0IsSUFBdUMsQ0FBcEQ7QUFDQWEsZ0JBQU1DLEdBQU4sSUFBYyxJQUFJLENBQUosR0FBUUksS0FBS0UsT0FBTCxHQUFlRixLQUFLakIsTUFBN0IsSUFBd0MsQ0FBckQ7QUFDRDtBQVRpQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBVW5DOzs7K0NBRTBCVSxTLEVBQVc7QUFBQSxvQkFDQyxLQUFLMUQsS0FETjtBQUFBLFVBQzdCMkQsSUFENkIsV0FDN0JBLElBRDZCO0FBQUEsVUFDdkIxRSxXQUR1QixXQUN2QkEsV0FEdUI7QUFBQSxVQUNWTSxPQURVLFdBQ1ZBLE9BRFU7QUFBQSxVQUU3QnFFLEtBRjZCLEdBRXBCRixTQUZvQixDQUU3QkUsS0FGNkI7O0FBR3BDLFVBQUlDLElBQUksQ0FBUjtBQUhvQztBQUFBO0FBQUE7O0FBQUE7QUFJcEMsOEJBQXFCRixJQUFyQixtSUFBMkI7QUFBQSxjQUFoQkcsTUFBZ0I7O0FBQ3pCLGNBQU10RSxPQUFPRCxRQUFRdUUsTUFBUixDQUFiO0FBQ0EsY0FBTU0sWUFBWW5GLFlBQVlPLElBQVosS0FBcUJQLFlBQVlPLElBQVosRUFBa0I2RSxJQUF6RDtBQUNBVCxnQkFBTUMsR0FBTixJQUFhTyxZQUFZLENBQVosR0FBZ0IsQ0FBN0I7QUFDRDtBQVJtQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBU3JDOzs7Z0RBRTJCVixTLEVBQVc7QUFBQSxvQkFDQSxLQUFLMUQsS0FETDtBQUFBLFVBQzlCMkQsSUFEOEIsV0FDOUJBLElBRDhCO0FBQUEsVUFDeEIxRSxXQUR3QixXQUN4QkEsV0FEd0I7QUFBQSxVQUNYTSxPQURXLFdBQ1hBLE9BRFc7QUFBQSxVQUU5QnFFLEtBRjhCLEdBRXJCRixTQUZxQixDQUU5QkUsS0FGOEI7O0FBR3JDLFVBQUlDLElBQUksQ0FBUjtBQUhxQztBQUFBO0FBQUE7O0FBQUE7QUFJckMsOEJBQXFCRixJQUFyQixtSUFBMkI7QUFBQSxjQUFoQkcsTUFBZ0I7O0FBQ3pCLGNBQU10RSxPQUFPRCxRQUFRdUUsTUFBUixDQUFiO0FBQ0EsY0FBTUcsT0FBT2hGLFlBQVlPLElBQVosS0FBcUIsRUFBbEM7QUFDQW9FLGdCQUFNQyxHQUFOLElBQWFJLEtBQUs1RSxDQUFMLElBQVUsQ0FBdkI7QUFDQXVFLGdCQUFNQyxHQUFOLElBQWFJLEtBQUtLLENBQUwsSUFBVSxDQUF2QjtBQUNBVixnQkFBTUMsR0FBTixJQUFhSSxLQUFLbEIsS0FBTCxJQUFjLENBQTNCO0FBQ0FhLGdCQUFNQyxHQUFOLElBQWFJLEtBQUtqQixNQUFMLElBQWUsQ0FBNUI7QUFDRDtBQVhvQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBWXRDOzs7O0VBeE1vQzlFLEs7O2VBQWxCNkIsUzs7O0FBMk1yQkEsVUFBVXdFLFNBQVYsR0FBc0IsV0FBdEI7QUFDQXhFLFVBQVVoQixZQUFWLEdBQXlCQSxZQUF6QiIsImZpbGUiOiJpY29uLWxheWVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IChjKSAyMDE1IC0gMjAxNyBVYmVyIFRlY2hub2xvZ2llcywgSW5jLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbi8vIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbi8vIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbi8vIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbi8vIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuLy8gZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuLy8gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuLy8gSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4vLyBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbi8vIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbi8vIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4vLyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4vLyBUSEUgU09GVFdBUkUuXG5pbXBvcnQge0xheWVyfSBmcm9tICcuLi8uLi8uLi9saWInO1xuaW1wb3J0IHtHTCwgTW9kZWwsIEdlb21ldHJ5LCBUZXh0dXJlMkQsIGxvYWRUZXh0dXJlc30gZnJvbSAnbHVtYS5nbCc7XG5pbXBvcnQge2ZwNjRpZnksIGVuYWJsZTY0Yml0U3VwcG9ydH0gZnJvbSAnLi4vLi4vLi4vbGliL3V0aWxzL2ZwNjQnO1xuaW1wb3J0IHtDT09SRElOQVRFX1NZU1RFTX0gZnJvbSAnLi4vLi4vLi4vbGliJztcblxuaW1wb3J0IHZzIGZyb20gJy4vaWNvbi1sYXllci12ZXJ0ZXguZ2xzbCc7XG5pbXBvcnQgdnM2NCBmcm9tICcuL2ljb24tbGF5ZXItdmVydGV4LTY0Lmdsc2wnO1xuaW1wb3J0IGZzIGZyb20gJy4vaWNvbi1sYXllci1mcmFnbWVudC5nbHNsJztcblxuY29uc3QgREVGQVVMVF9DT0xPUiA9IFswLCAwLCAwLCAyNTVdO1xuXG4vKlxuICogQHBhcmFtIHtvYmplY3R9IHByb3BzXG4gKiBAcGFyYW0ge1RleHR1cmUyRCB8IHN0cmluZ30gcHJvcHMuaWNvbkF0bGFzIC0gYXRsYXMgaW1hZ2UgdXJsIG9yIHRleHR1cmVcbiAqIEBwYXJhbSB7b2JqZWN0fSBwcm9wcy5pY29uTWFwcGluZyAtIGljb24gbmFtZXMgbWFwcGVkIHRvIGljb24gZGVmaW5pdGlvbnNcbiAqIEBwYXJhbSB7b2JqZWN0fSBwcm9wcy5pY29uTWFwcGluZ1tpY29uX25hbWVdLnggLSB4IHBvc2l0aW9uIG9mIGljb24gb24gdGhlIGF0bGFzIGltYWdlXG4gKiBAcGFyYW0ge29iamVjdH0gcHJvcHMuaWNvbk1hcHBpbmdbaWNvbl9uYW1lXS55IC0geSBwb3NpdGlvbiBvZiBpY29uIG9uIHRoZSBhdGxhcyBpbWFnZVxuICogQHBhcmFtIHtvYmplY3R9IHByb3BzLmljb25NYXBwaW5nW2ljb25fbmFtZV0ud2lkdGggLSB3aWR0aCBvZiBpY29uIG9uIHRoZSBhdGxhcyBpbWFnZVxuICogQHBhcmFtIHtvYmplY3R9IHByb3BzLmljb25NYXBwaW5nW2ljb25fbmFtZV0uaGVpZ2h0IC0gaGVpZ2h0IG9mIGljb24gb24gdGhlIGF0bGFzIGltYWdlXG4gKiBAcGFyYW0ge29iamVjdH0gcHJvcHMuaWNvbk1hcHBpbmdbaWNvbl9uYW1lXS5hbmNob3JYIC0geCBhbmNob3Igb2YgaWNvbiBvbiB0aGUgYXRsYXMgaW1hZ2UsXG4gKiAgIGRlZmF1bHQgdG8gd2lkdGggLyAyXG4gKiBAcGFyYW0ge29iamVjdH0gcHJvcHMuaWNvbk1hcHBpbmdbaWNvbl9uYW1lXS5hbmNob3JZIC0geSBhbmNob3Igb2YgaWNvbiBvbiB0aGUgYXRsYXMgaW1hZ2UsXG4gKiAgIGRlZmF1bHQgdG8gaGVpZ2h0IC8gMlxuICogQHBhcmFtIHtvYmplY3R9IHByb3BzLmljb25NYXBwaW5nW2ljb25fbmFtZV0ubWFzayAtIHdoZXRoZXIgaWNvbiBpcyB0cmVhdGVkIGFzIGEgdHJhbnNwYXJlbmN5XG4gKiAgIG1hc2suIElmIHRydWUsIHVzZXIgZGVmaW5lZCBjb2xvciBpcyBhcHBsaWVkLiBJZiBmYWxzZSwgb3JpZ2luYWwgY29sb3IgZnJvbSB0aGUgaW1hZ2UgaXNcbiAqICAgYXBwbGllZC4gRGVmYXVsdCB0byBmYWxzZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBwcm9wcy5zaXplIC0gaWNvbiBzaXplIGluIHBpeGVsc1xuICogQHBhcmFtIHtmdW5jfSBwcm9wcy5nZXRQb3NpdGlvbiAtIHJldHVybnMgYW5jaG9yIHBvc2l0aW9uIG9mIHRoZSBpY29uLCBpbiBbbG5nLCBsYXQsIHpdXG4gKiBAcGFyYW0ge2Z1bmN9IHByb3BzLmdldEljb24gLSByZXR1cm5zIGljb24gbmFtZSBhcyBhIHN0cmluZ1xuICogQHBhcmFtIHtmdW5jfSBwcm9wcy5nZXRTaXplIC0gcmV0dXJucyBpY29uIHNpemUgbXVsdGlwbGllciBhcyBhIG51bWJlclxuICogQHBhcmFtIHtmdW5jfSBwcm9wcy5nZXRDb2xvciAtIHJldHVybnMgY29sb3Igb2YgdGhlIGljb24gaW4gW3IsIGcsIGIsIGFdLiBPbmx5IHdvcmtzIG9uIGljb25zXG4gKiAgIHdpdGggbWFzazogdHJ1ZS5cbiAqIEBwYXJhbSB7ZnVuY30gcHJvcHMuZ2V0QW5nbGUgLSByZXR1cm5zIHJvdGF0aW5nIGFuZ2xlIChpbiBkZWdyZWUpIG9mIHRoZSBpY29uLlxuICovXG5jb25zdCBkZWZhdWx0UHJvcHMgPSB7XG4gIGljb25BdGxhczogbnVsbCxcbiAgaWNvbk1hcHBpbmc6IHt9LFxuICBzaXplU2NhbGU6IDEsXG4gIGZwNjQ6IGZhbHNlLFxuXG4gIGdldFBvc2l0aW9uOiB4ID0+IHgucG9zaXRpb24sXG4gIGdldEljb246IHggPT4geC5pY29uLFxuICBnZXRDb2xvcjogeCA9PiB4LmNvbG9yIHx8IERFRkFVTFRfQ09MT1IsXG4gIGdldFNpemU6IHggPT4geC5zaXplIHx8IDEsXG4gIGdldEFuZ2xlOiB4ID0+IHguYW5nbGUgfHwgMFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSWNvbkxheWVyIGV4dGVuZHMgTGF5ZXIge1xuICBnZXRTaGFkZXJzKCkge1xuICAgIHJldHVybiBlbmFibGU2NGJpdFN1cHBvcnQodGhpcy5wcm9wcykgP1xuICAgICAge3ZzOiB2czY0LCBmcywgbW9kdWxlczogWydwcm9qZWN0NjQnXX0gOlxuICAgICAge3ZzLCBmc307ICAvLyAncHJvamVjdCcgbW9kdWxlIGFkZGVkIGJ5IGRlZmF1bHQuXG4gIH1cblxuICBpbml0aWFsaXplU3RhdGUoKSB7XG4gICAgY29uc3Qge2F0dHJpYnV0ZU1hbmFnZXJ9ID0gdGhpcy5zdGF0ZTtcbiAgICBjb25zdCB7Z2x9ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgLyogZXNsaW50LWRpc2FibGUgbWF4LWxlbiAqL1xuICAgIGF0dHJpYnV0ZU1hbmFnZXIuYWRkSW5zdGFuY2VkKHtcbiAgICAgIGluc3RhbmNlUG9zaXRpb25zOiB7c2l6ZTogMywgYWNjZXNzb3I6ICdnZXRQb3NpdGlvbicsIHVwZGF0ZTogdGhpcy5jYWxjdWxhdGVJbnN0YW5jZVBvc2l0aW9uc30sXG4gICAgICBpbnN0YW5jZVNpemVzOiB7c2l6ZTogMSwgYWNjZXNzb3I6ICdnZXRTaXplJywgdXBkYXRlOiB0aGlzLmNhbGN1bGF0ZUluc3RhbmNlU2l6ZXN9LFxuICAgICAgaW5zdGFuY2VPZmZzZXRzOiB7c2l6ZTogMiwgYWNjZXNzb3I6ICdnZXRJY29uJywgdXBkYXRlOiB0aGlzLmNhbGN1bGF0ZUluc3RhbmNlT2Zmc2V0c30sXG4gICAgICBpbnN0YW5jZUljb25GcmFtZXM6IHtzaXplOiA0LCBhY2Nlc3NvcjogJ2dldEljb24nLCB1cGRhdGU6IHRoaXMuY2FsY3VsYXRlSW5zdGFuY2VJY29uRnJhbWVzfSxcbiAgICAgIGluc3RhbmNlQ29sb3JNb2Rlczoge3NpemU6IDEsIHR5cGU6IEdMLlVOU0lHTkVEX0JZVEUsIGFjY2Vzc29yOiAnZ2V0SWNvbicsIHVwZGF0ZTogdGhpcy5jYWxjdWxhdGVJbnN0YW5jZUNvbG9yTW9kZX0sXG4gICAgICBpbnN0YW5jZUNvbG9yczoge3NpemU6IDQsIHR5cGU6IEdMLlVOU0lHTkVEX0JZVEUsIGFjY2Vzc29yOiAnZ2V0Q29sb3InLCB1cGRhdGU6IHRoaXMuY2FsY3VsYXRlSW5zdGFuY2VDb2xvcnN9LFxuICAgICAgaW5zdGFuY2VBbmdsZXM6IHtzaXplOiAxLCBhY2Nlc3NvcjogJ2dldEFuZ2xlJywgdXBkYXRlOiB0aGlzLmNhbGN1bGF0ZUluc3RhbmNlQW5nbGVzfVxuICAgIH0pO1xuICAgIC8qIGVzbGludC1lbmFibGUgbWF4LWxlbiAqL1xuXG4gICAgdGhpcy5zZXRTdGF0ZSh7bW9kZWw6IHRoaXMuX2dldE1vZGVsKGdsKX0pO1xuICB9XG5cbiAgdXBkYXRlQXR0cmlidXRlKHtwcm9wcywgb2xkUHJvcHMsIGNoYW5nZUZsYWdzfSkge1xuICAgIGlmIChwcm9wcy5mcDY0ICE9PSBvbGRQcm9wcy5mcDY0KSB7XG4gICAgICBjb25zdCB7YXR0cmlidXRlTWFuYWdlcn0gPSB0aGlzLnN0YXRlO1xuICAgICAgYXR0cmlidXRlTWFuYWdlci5pbnZhbGlkYXRlQWxsKCk7XG5cbiAgICAgIGlmIChwcm9wcy5mcDY0ICYmIHByb3BzLnByb2plY3Rpb25Nb2RlID09PSBDT09SRElOQVRFX1NZU1RFTS5MTkdMQVQpIHtcbiAgICAgICAgYXR0cmlidXRlTWFuYWdlci5hZGRJbnN0YW5jZWQoe1xuICAgICAgICAgIGluc3RhbmNlUG9zaXRpb25zNjR4eUxvdzoge1xuICAgICAgICAgICAgc2l6ZTogMixcbiAgICAgICAgICAgIGFjY2Vzc29yOiAnZ2V0UG9zaXRpb24nLFxuICAgICAgICAgICAgdXBkYXRlOiB0aGlzLmNhbGN1bGF0ZUluc3RhbmNlUG9zaXRpb25zNjR4eUxvd1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyaWJ1dGVNYW5hZ2VyLnJlbW92ZShbXG4gICAgICAgICAgJ2luc3RhbmNlUG9zaXRpb25zNjR4eUxvdydcbiAgICAgICAgXSk7XG4gICAgICB9XG5cbiAgICB9XG4gIH1cblxuICB1cGRhdGVTdGF0ZSh7b2xkUHJvcHMsIHByb3BzLCBjaGFuZ2VGbGFnc30pIHtcbiAgICBzdXBlci51cGRhdGVTdGF0ZSh7cHJvcHMsIG9sZFByb3BzLCBjaGFuZ2VGbGFnc30pO1xuXG4gICAgY29uc3Qge2ljb25BdGxhcywgaWNvbk1hcHBpbmd9ID0gcHJvcHM7XG5cbiAgICBpZiAob2xkUHJvcHMuaWNvbk1hcHBpbmcgIT09IGljb25NYXBwaW5nKSB7XG4gICAgICBjb25zdCB7YXR0cmlidXRlTWFuYWdlcn0gPSB0aGlzLnN0YXRlO1xuICAgICAgYXR0cmlidXRlTWFuYWdlci5pbnZhbGlkYXRlKCdpbnN0YW5jZU9mZnNldHMnKTtcbiAgICAgIGF0dHJpYnV0ZU1hbmFnZXIuaW52YWxpZGF0ZSgnaW5zdGFuY2VJY29uRnJhbWVzJyk7XG4gICAgICBhdHRyaWJ1dGVNYW5hZ2VyLmludmFsaWRhdGUoJ2luc3RhbmNlQ29sb3JNb2RlcycpO1xuICAgIH1cblxuICAgIGlmIChvbGRQcm9wcy5pY29uQXRsYXMgIT09IGljb25BdGxhcykge1xuXG4gICAgICBpZiAoaWNvbkF0bGFzIGluc3RhbmNlb2YgVGV4dHVyZTJEKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe2ljb25zVGV4dHVyZTogaWNvbkF0bGFzfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpY29uQXRsYXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGxvYWRUZXh0dXJlcyh0aGlzLmNvbnRleHQuZ2wsIHtcbiAgICAgICAgICB1cmxzOiBbaWNvbkF0bGFzXVxuICAgICAgICB9KVxuICAgICAgICAudGhlbigoW3RleHR1cmVdKSA9PiB7XG4gICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7aWNvbnNUZXh0dXJlOiB0ZXh0dXJlfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwcm9wcy5mcDY0ICE9PSBvbGRQcm9wcy5mcDY0KSB7XG4gICAgICBjb25zdCB7Z2x9ID0gdGhpcy5jb250ZXh0O1xuICAgICAgdGhpcy5zZXRTdGF0ZSh7bW9kZWw6IHRoaXMuX2dldE1vZGVsKGdsKX0pO1xuICAgIH1cbiAgICB0aGlzLnVwZGF0ZUF0dHJpYnV0ZSh7cHJvcHMsIG9sZFByb3BzLCBjaGFuZ2VGbGFnc30pO1xuXG4gIH1cblxuICBkcmF3KHt1bmlmb3Jtc30pIHtcbiAgICBjb25zdCB7c2l6ZVNjYWxlfSA9IHRoaXMucHJvcHM7XG4gICAgY29uc3Qge2ljb25zVGV4dHVyZX0gPSB0aGlzLnN0YXRlO1xuXG4gICAgaWYgKGljb25zVGV4dHVyZSkge1xuICAgICAgdGhpcy5zdGF0ZS5tb2RlbC5yZW5kZXIoT2JqZWN0LmFzc2lnbih7fSwgdW5pZm9ybXMsIHtcbiAgICAgICAgaWNvbnNUZXh0dXJlLFxuICAgICAgICBpY29uc1RleHR1cmVEaW06IFtpY29uc1RleHR1cmUud2lkdGgsIGljb25zVGV4dHVyZS5oZWlnaHRdLFxuICAgICAgICBzaXplU2NhbGVcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0TW9kZWwoZ2wpIHtcblxuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFstMSwgLTEsIDAsIC0xLCAxLCAwLCAxLCAxLCAwLCAxLCAtMSwgMF07XG5cbiAgICByZXR1cm4gbmV3IE1vZGVsKGdsLCBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmdldFNoYWRlcnMoKSwge1xuICAgICAgaWQ6IHRoaXMucHJvcHMuaWQsXG4gICAgICBnZW9tZXRyeTogbmV3IEdlb21ldHJ5KHtcbiAgICAgICAgZHJhd01vZGU6IEdMLlRSSUFOR0xFX0ZBTixcbiAgICAgICAgcG9zaXRpb25zOiBuZXcgRmxvYXQzMkFycmF5KHBvc2l0aW9ucylcbiAgICAgIH0pLFxuICAgICAgaXNJbnN0YW5jZWQ6IHRydWUsXG4gICAgICBzaGFkZXJDYWNoZTogdGhpcy5jb250ZXh0LnNoYWRlckNhY2hlXG4gICAgfSkpO1xuICB9XG5cbiAgY2FsY3VsYXRlSW5zdGFuY2VQb3NpdGlvbnMoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qge2RhdGEsIGdldFBvc2l0aW9ufSA9IHRoaXMucHJvcHM7XG4gICAgY29uc3Qge3ZhbHVlfSA9IGF0dHJpYnV0ZTtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBvYmplY3Qgb2YgZGF0YSkge1xuICAgICAgY29uc3QgcG9zaXRpb24gPSBnZXRQb3NpdGlvbihvYmplY3QpO1xuICAgICAgdmFsdWVbaSsrXSA9IHBvc2l0aW9uWzBdO1xuICAgICAgdmFsdWVbaSsrXSA9IHBvc2l0aW9uWzFdO1xuICAgICAgdmFsdWVbaSsrXSA9IHBvc2l0aW9uWzJdIHx8IDA7XG4gICAgfVxuICB9XG5cbiAgY2FsY3VsYXRlSW5zdGFuY2VQb3NpdGlvbnM2NHh5TG93KGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IHtkYXRhLCBnZXRQb3NpdGlvbn0gPSB0aGlzLnByb3BzO1xuICAgIGNvbnN0IHt2YWx1ZX0gPSBhdHRyaWJ1dGU7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgcG9pbnQgb2YgZGF0YSkge1xuICAgICAgY29uc3QgcG9zaXRpb24gPSBnZXRQb3NpdGlvbihwb2ludCk7XG4gICAgICB2YWx1ZVtpKytdID0gZnA2NGlmeShwb3NpdGlvblswXSlbMV07XG4gICAgICB2YWx1ZVtpKytdID0gZnA2NGlmeShwb3NpdGlvblsxXSlbMV07XG4gICAgfVxuICB9XG5cbiAgY2FsY3VsYXRlSW5zdGFuY2VTaXplcyhhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCB7ZGF0YSwgZ2V0U2l6ZX0gPSB0aGlzLnByb3BzO1xuICAgIGNvbnN0IHt2YWx1ZX0gPSBhdHRyaWJ1dGU7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3Qgb2JqZWN0IG9mIGRhdGEpIHtcbiAgICAgIHZhbHVlW2krK10gPSBnZXRTaXplKG9iamVjdCk7XG4gICAgfVxuICB9XG5cbiAgY2FsY3VsYXRlSW5zdGFuY2VBbmdsZXMoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qge2RhdGEsIGdldEFuZ2xlfSA9IHRoaXMucHJvcHM7XG4gICAgY29uc3Qge3ZhbHVlfSA9IGF0dHJpYnV0ZTtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBvYmplY3Qgb2YgZGF0YSkge1xuICAgICAgdmFsdWVbaSsrXSA9IGdldEFuZ2xlKG9iamVjdCk7XG4gICAgfVxuICB9XG5cbiAgY2FsY3VsYXRlSW5zdGFuY2VDb2xvcnMoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qge2RhdGEsIGdldENvbG9yfSA9IHRoaXMucHJvcHM7XG4gICAgY29uc3Qge3ZhbHVlfSA9IGF0dHJpYnV0ZTtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBvYmplY3Qgb2YgZGF0YSkge1xuICAgICAgY29uc3QgY29sb3IgPSBnZXRDb2xvcihvYmplY3QpO1xuXG4gICAgICB2YWx1ZVtpKytdID0gY29sb3JbMF07XG4gICAgICB2YWx1ZVtpKytdID0gY29sb3JbMV07XG4gICAgICB2YWx1ZVtpKytdID0gY29sb3JbMl07XG4gICAgICB2YWx1ZVtpKytdID0gaXNOYU4oY29sb3JbM10pID8gMjU1IDogY29sb3JbM107XG4gICAgfVxuICB9XG5cbiAgY2FsY3VsYXRlSW5zdGFuY2VPZmZzZXRzKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IHtkYXRhLCBpY29uTWFwcGluZywgZ2V0SWNvbn0gPSB0aGlzLnByb3BzO1xuICAgIGNvbnN0IHt2YWx1ZX0gPSBhdHRyaWJ1dGU7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3Qgb2JqZWN0IG9mIGRhdGEpIHtcbiAgICAgIGNvbnN0IGljb24gPSBnZXRJY29uKG9iamVjdCk7XG4gICAgICBjb25zdCByZWN0ID0gaWNvbk1hcHBpbmdbaWNvbl0gfHwge307XG4gICAgICB2YWx1ZVtpKytdID0gKDEgLyAyIC0gcmVjdC5hbmNob3JYIC8gcmVjdC53aWR0aCkgfHwgMDtcbiAgICAgIHZhbHVlW2krK10gPSAoMSAvIDIgLSByZWN0LmFuY2hvclkgLyByZWN0LmhlaWdodCkgfHwgMDtcbiAgICB9XG4gIH1cblxuICBjYWxjdWxhdGVJbnN0YW5jZUNvbG9yTW9kZShhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCB7ZGF0YSwgaWNvbk1hcHBpbmcsIGdldEljb259ID0gdGhpcy5wcm9wcztcbiAgICBjb25zdCB7dmFsdWV9ID0gYXR0cmlidXRlO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IG9iamVjdCBvZiBkYXRhKSB7XG4gICAgICBjb25zdCBpY29uID0gZ2V0SWNvbihvYmplY3QpO1xuICAgICAgY29uc3QgY29sb3JNb2RlID0gaWNvbk1hcHBpbmdbaWNvbl0gJiYgaWNvbk1hcHBpbmdbaWNvbl0ubWFzaztcbiAgICAgIHZhbHVlW2krK10gPSBjb2xvck1vZGUgPyAxIDogMDtcbiAgICB9XG4gIH1cblxuICBjYWxjdWxhdGVJbnN0YW5jZUljb25GcmFtZXMoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qge2RhdGEsIGljb25NYXBwaW5nLCBnZXRJY29ufSA9IHRoaXMucHJvcHM7XG4gICAgY29uc3Qge3ZhbHVlfSA9IGF0dHJpYnV0ZTtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBvYmplY3Qgb2YgZGF0YSkge1xuICAgICAgY29uc3QgaWNvbiA9IGdldEljb24ob2JqZWN0KTtcbiAgICAgIGNvbnN0IHJlY3QgPSBpY29uTWFwcGluZ1tpY29uXSB8fCB7fTtcbiAgICAgIHZhbHVlW2krK10gPSByZWN0LnggfHwgMDtcbiAgICAgIHZhbHVlW2krK10gPSByZWN0LnkgfHwgMDtcbiAgICAgIHZhbHVlW2krK10gPSByZWN0LndpZHRoIHx8IDA7XG4gICAgICB2YWx1ZVtpKytdID0gcmVjdC5oZWlnaHQgfHwgMDtcbiAgICB9XG4gIH1cbn1cblxuSWNvbkxheWVyLmxheWVyTmFtZSA9ICdJY29uTGF5ZXInO1xuSWNvbkxheWVyLmRlZmF1bHRQcm9wcyA9IGRlZmF1bHRQcm9wcztcbiJdfQ==