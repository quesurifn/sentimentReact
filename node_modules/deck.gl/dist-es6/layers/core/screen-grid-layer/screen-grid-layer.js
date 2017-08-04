var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

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
import { GL, Model, Geometry } from 'luma.gl';

import vs from './screen-grid-layer-vertex.glsl';
import fs from './screen-grid-layer-fragment.glsl';

var defaultProps = {
  cellSizePixels: 100,

  // Color range?
  minColor: [0, 0, 0, 255],
  maxColor: [0, 255, 0, 255],

  getPosition: function getPosition(d) {
    return d.position;
  },
  getWeight: function getWeight(d) {
    return 1;
  }
};

var ScreenGridLayer = function (_Layer) {
  _inherits(ScreenGridLayer, _Layer);

  _createClass(ScreenGridLayer, [{
    key: 'getShaders',
    value: function getShaders() {
      return { vs: vs, fs: fs }; // 'project' module added by default.
    }
  }]);

  function ScreenGridLayer(props) {
    _classCallCheck(this, ScreenGridLayer);

    var _this = _possibleConstructorReturn(this, (ScreenGridLayer.__proto__ || Object.getPrototypeOf(ScreenGridLayer)).call(this, props));

    _this._checkRemovedProp('unitWidth', 'cellSizePixels');
    _this._checkRemovedProp('unitHeight', 'cellSizePixels');
    return _this;
  }

  _createClass(ScreenGridLayer, [{
    key: 'initializeState',
    value: function initializeState() {
      var attributeManager = this.state.attributeManager;
      var gl = this.context.gl;

      /* eslint-disable max-len */

      attributeManager.addInstanced({
        instancePositions: { size: 3, update: this.calculateInstancePositions },
        instanceCount: { size: 1, accessor: ['getPosition', 'getWeight'], update: this.calculateInstanceCount }
      });
      /* eslint-disable max-len */

      this.setState({ model: this._getModel(gl) });
    }
  }, {
    key: 'shouldUpdateState',
    value: function shouldUpdateState(_ref) {
      var changeFlags = _ref.changeFlags;

      return changeFlags.somethingChanged;
    }
  }, {
    key: 'updateState',
    value: function updateState(_ref2) {
      var oldProps = _ref2.oldProps,
          props = _ref2.props,
          changeFlags = _ref2.changeFlags;

      _get(ScreenGridLayer.prototype.__proto__ || Object.getPrototypeOf(ScreenGridLayer.prototype), 'updateState', this).call(this, { props: props, oldProps: oldProps, changeFlags: changeFlags });
      var cellSizeChanged = props.cellSizePixels !== oldProps.cellSizePixels;

      if (cellSizeChanged || changeFlags.viewportChanged) {
        this.updateCell();
      }
    }
  }, {
    key: 'draw',
    value: function draw(_ref3) {
      var uniforms = _ref3.uniforms;
      var _props = this.props,
          minColor = _props.minColor,
          maxColor = _props.maxColor;
      var _state = this.state,
          model = _state.model,
          cellScale = _state.cellScale,
          maxCount = _state.maxCount;

      uniforms = Object.assign({}, uniforms, { minColor: minColor, maxColor: maxColor, cellScale: cellScale, maxCount: maxCount });
      model.draw({
        uniforms: uniforms,
        parameters: {
          depthMask: true
        }
      });
    }
  }, {
    key: '_getModel',
    value: function _getModel(gl) {
      return new Model(gl, Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: new Geometry({
          drawMode: GL.TRIANGLE_FAN,
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])
        }),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      }));
    }
  }, {
    key: 'updateCell',
    value: function updateCell() {
      var _context$viewport = this.context.viewport,
          width = _context$viewport.width,
          height = _context$viewport.height;
      var cellSizePixels = this.props.cellSizePixels;


      var MARGIN = 2;
      var cellScale = new Float32Array([(cellSizePixels - MARGIN) / width * 2, -(cellSizePixels - MARGIN) / height * 2, 1]);
      var numCol = Math.ceil(width / cellSizePixels);
      var numRow = Math.ceil(height / cellSizePixels);

      this.setState({
        cellScale: cellScale,
        numCol: numCol,
        numRow: numRow,
        numInstances: numCol * numRow
      });

      var attributeManager = this.state.attributeManager;

      attributeManager.invalidateAll();
    }
  }, {
    key: 'calculateInstancePositions',
    value: function calculateInstancePositions(attribute, _ref4) {
      var numInstances = _ref4.numInstances;
      var _context$viewport2 = this.context.viewport,
          width = _context$viewport2.width,
          height = _context$viewport2.height;
      var cellSizePixels = this.props.cellSizePixels;
      var numCol = this.state.numCol;
      var value = attribute.value,
          size = attribute.size;


      for (var i = 0; i < numInstances; i++) {
        var x = i % numCol;
        var y = Math.floor(i / numCol);
        value[i * size + 0] = x * cellSizePixels / width * 2 - 1;
        value[i * size + 1] = 1 - y * cellSizePixels / height * 2;
        value[i * size + 2] = 0;
      }
    }
  }, {
    key: 'calculateInstanceCount',
    value: function calculateInstanceCount(attribute) {
      var _props2 = this.props,
          data = _props2.data,
          cellSizePixels = _props2.cellSizePixels,
          getPosition = _props2.getPosition,
          getWeight = _props2.getWeight;
      var _state2 = this.state,
          numCol = _state2.numCol,
          numRow = _state2.numRow;
      var value = attribute.value;

      var maxCount = 0;

      value.fill(0.0);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = data[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var point = _step.value;

          var pixel = this.project(getPosition(point));
          var colId = Math.floor(pixel[0] / cellSizePixels);
          var rowId = Math.floor(pixel[1] / cellSizePixels);
          if (colId >= 0 && colId < numCol && rowId >= 0 && rowId < numRow) {
            var i = colId + rowId * numCol;
            value[i] += getWeight(point);
            if (value[i] > maxCount) {
              maxCount = value[i];
            }
          }
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

      this.setState({ maxCount: maxCount });
    }
  }]);

  return ScreenGridLayer;
}(Layer);

export default ScreenGridLayer;


ScreenGridLayer.layerName = 'ScreenGridLayer';
ScreenGridLayer.defaultProps = defaultProps;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9sYXllcnMvY29yZS9zY3JlZW4tZ3JpZC1sYXllci9zY3JlZW4tZ3JpZC1sYXllci5qcyJdLCJuYW1lcyI6WyJMYXllciIsIkdMIiwiTW9kZWwiLCJHZW9tZXRyeSIsInZzIiwiZnMiLCJkZWZhdWx0UHJvcHMiLCJjZWxsU2l6ZVBpeGVscyIsIm1pbkNvbG9yIiwibWF4Q29sb3IiLCJnZXRQb3NpdGlvbiIsImQiLCJwb3NpdGlvbiIsImdldFdlaWdodCIsIlNjcmVlbkdyaWRMYXllciIsInByb3BzIiwiX2NoZWNrUmVtb3ZlZFByb3AiLCJhdHRyaWJ1dGVNYW5hZ2VyIiwic3RhdGUiLCJnbCIsImNvbnRleHQiLCJhZGRJbnN0YW5jZWQiLCJpbnN0YW5jZVBvc2l0aW9ucyIsInNpemUiLCJ1cGRhdGUiLCJjYWxjdWxhdGVJbnN0YW5jZVBvc2l0aW9ucyIsImluc3RhbmNlQ291bnQiLCJhY2Nlc3NvciIsImNhbGN1bGF0ZUluc3RhbmNlQ291bnQiLCJzZXRTdGF0ZSIsIm1vZGVsIiwiX2dldE1vZGVsIiwiY2hhbmdlRmxhZ3MiLCJzb21ldGhpbmdDaGFuZ2VkIiwib2xkUHJvcHMiLCJjZWxsU2l6ZUNoYW5nZWQiLCJ2aWV3cG9ydENoYW5nZWQiLCJ1cGRhdGVDZWxsIiwidW5pZm9ybXMiLCJjZWxsU2NhbGUiLCJtYXhDb3VudCIsIk9iamVjdCIsImFzc2lnbiIsImRyYXciLCJwYXJhbWV0ZXJzIiwiZGVwdGhNYXNrIiwiZ2V0U2hhZGVycyIsImlkIiwiZ2VvbWV0cnkiLCJkcmF3TW9kZSIsIlRSSUFOR0xFX0ZBTiIsInZlcnRpY2VzIiwiRmxvYXQzMkFycmF5IiwiaXNJbnN0YW5jZWQiLCJzaGFkZXJDYWNoZSIsInZpZXdwb3J0Iiwid2lkdGgiLCJoZWlnaHQiLCJNQVJHSU4iLCJudW1Db2wiLCJNYXRoIiwiY2VpbCIsIm51bVJvdyIsIm51bUluc3RhbmNlcyIsImludmFsaWRhdGVBbGwiLCJhdHRyaWJ1dGUiLCJ2YWx1ZSIsImkiLCJ4IiwieSIsImZsb29yIiwiZGF0YSIsImZpbGwiLCJwb2ludCIsInBpeGVsIiwicHJvamVjdCIsImNvbElkIiwicm93SWQiLCJsYXllck5hbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxTQUFRQSxLQUFSLFFBQW9CLGNBQXBCO0FBQ0EsU0FBUUMsRUFBUixFQUFZQyxLQUFaLEVBQW1CQyxRQUFuQixRQUFrQyxTQUFsQzs7QUFFQSxPQUFPQyxFQUFQLE1BQWUsaUNBQWY7QUFDQSxPQUFPQyxFQUFQLE1BQWUsbUNBQWY7O0FBRUEsSUFBTUMsZUFBZTtBQUNuQkMsa0JBQWdCLEdBREc7O0FBR25CO0FBQ0FDLFlBQVUsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxHQUFWLENBSlM7QUFLbkJDLFlBQVUsQ0FBQyxDQUFELEVBQUksR0FBSixFQUFTLENBQVQsRUFBWSxHQUFaLENBTFM7O0FBT25CQyxlQUFhO0FBQUEsV0FBS0MsRUFBRUMsUUFBUDtBQUFBLEdBUE07QUFRbkJDLGFBQVc7QUFBQSxXQUFLLENBQUw7QUFBQTtBQVJRLENBQXJCOztJQVdxQkMsZTs7Ozs7aUNBQ047QUFDWCxhQUFPLEVBQUNWLE1BQUQsRUFBS0MsTUFBTCxFQUFQLENBRFcsQ0FDTTtBQUNsQjs7O0FBRUQsMkJBQVlVLEtBQVosRUFBbUI7QUFBQTs7QUFBQSxrSUFDWEEsS0FEVzs7QUFFakIsVUFBS0MsaUJBQUwsQ0FBdUIsV0FBdkIsRUFBb0MsZ0JBQXBDO0FBQ0EsVUFBS0EsaUJBQUwsQ0FBdUIsWUFBdkIsRUFBcUMsZ0JBQXJDO0FBSGlCO0FBSWxCOzs7O3NDQUVpQjtBQUFBLFVBQ1RDLGdCQURTLEdBQ1csS0FBS0MsS0FEaEIsQ0FDVEQsZ0JBRFM7QUFBQSxVQUVURSxFQUZTLEdBRUgsS0FBS0MsT0FGRixDQUVURCxFQUZT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QUFNQyxDQUFOLElBQVczQixRQUFmLEVBQXlCO0FBQ3ZCQSx5QkFBVzBCLE1BQU1DLENBQU4sQ0FBWDtBQUNEO0FBQ0Y7QUFDRjtBQW5CK0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7QUFxQmhDLFdBQUt0QyxRQUFMLENBQWMsRUFBQ1csa0JBQUQsRUFBZDtBQUNEOzs7O0VBNUgwQ3hDLEs7O2VBQXhCYyxlOzs7QUErSHJCQSxnQkFBZ0JnRSxTQUFoQixHQUE0QixpQkFBNUI7QUFDQWhFLGdCQUFnQlIsWUFBaEIsR0FBK0JBLFlBQS9CIiwiZmlsZSI6InNjcmVlbi1ncmlkLWxheWVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IChjKSAyMDE1IC0gMjAxNyBVYmVyIFRlY2hub2xvZ2llcywgSW5jLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbi8vIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbi8vIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbi8vIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbi8vIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuLy8gZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuLy8gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuLy8gSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4vLyBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbi8vIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbi8vIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4vLyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4vLyBUSEUgU09GVFdBUkUuXG5cbmltcG9ydCB7TGF5ZXJ9IGZyb20gJy4uLy4uLy4uL2xpYic7XG5pbXBvcnQge0dMLCBNb2RlbCwgR2VvbWV0cnl9IGZyb20gJ2x1bWEuZ2wnO1xuXG5pbXBvcnQgdnMgZnJvbSAnLi9zY3JlZW4tZ3JpZC1sYXllci12ZXJ0ZXguZ2xzbCc7XG5pbXBvcnQgZnMgZnJvbSAnLi9zY3JlZW4tZ3JpZC1sYXllci1mcmFnbWVudC5nbHNsJztcblxuY29uc3QgZGVmYXVsdFByb3BzID0ge1xuICBjZWxsU2l6ZVBpeGVsczogMTAwLFxuXG4gIC8vIENvbG9yIHJhbmdlP1xuICBtaW5Db2xvcjogWzAsIDAsIDAsIDI1NV0sXG4gIG1heENvbG9yOiBbMCwgMjU1LCAwLCAyNTVdLFxuXG4gIGdldFBvc2l0aW9uOiBkID0+IGQucG9zaXRpb24sXG4gIGdldFdlaWdodDogZCA9PiAxXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTY3JlZW5HcmlkTGF5ZXIgZXh0ZW5kcyBMYXllciB7XG4gIGdldFNoYWRlcnMoKSB7XG4gICAgcmV0dXJuIHt2cywgZnN9OyAvLyAncHJvamVjdCcgbW9kdWxlIGFkZGVkIGJ5IGRlZmF1bHQuXG4gIH1cblxuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLl9jaGVja1JlbW92ZWRQcm9wKCd1bml0V2lkdGgnLCAnY2VsbFNpemVQaXhlbHMnKTtcbiAgICB0aGlzLl9jaGVja1JlbW92ZWRQcm9wKCd1bml0SGVpZ2h0JywgJ2NlbGxTaXplUGl4ZWxzJyk7XG4gIH1cblxuICBpbml0aWFsaXplU3RhdGUoKSB7XG4gICAgY29uc3Qge2F0dHJpYnV0ZU1hbmFnZXJ9ID0gdGhpcy5zdGF0ZTtcbiAgICBjb25zdCB7Z2x9ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgLyogZXNsaW50LWRpc2FibGUgbWF4LWxlbiAqL1xuICAgIGF0dHJpYnV0ZU1hbmFnZXIuYWRkSW5zdGFuY2VkKHtcbiAgICAgIGluc3RhbmNlUG9zaXRpb25zOiB7c2l6ZTogMywgdXBkYXRlOiB0aGlzLmNhbGN1bGF0ZUluc3RhbmNlUG9zaXRpb25zfSxcbiAgICAgIGluc3RhbmNlQ291bnQ6IHtzaXplOiAxLCBhY2Nlc3NvcjogWydnZXRQb3NpdGlvbicsICdnZXRXZWlnaHQnXSwgdXBkYXRlOiB0aGlzLmNhbGN1bGF0ZUluc3RhbmNlQ291bnR9XG4gICAgfSk7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbWF4LWxlbiAqL1xuXG4gICAgdGhpcy5zZXRTdGF0ZSh7bW9kZWw6IHRoaXMuX2dldE1vZGVsKGdsKX0pO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlU3RhdGUoe2NoYW5nZUZsYWdzfSkge1xuICAgIHJldHVybiBjaGFuZ2VGbGFncy5zb21ldGhpbmdDaGFuZ2VkO1xuICB9XG5cbiAgdXBkYXRlU3RhdGUoe29sZFByb3BzLCBwcm9wcywgY2hhbmdlRmxhZ3N9KSB7XG4gICAgc3VwZXIudXBkYXRlU3RhdGUoe3Byb3BzLCBvbGRQcm9wcywgY2hhbmdlRmxhZ3N9KTtcbiAgICBjb25zdCBjZWxsU2l6ZUNoYW5nZWQgPVxuICAgICAgcHJvcHMuY2VsbFNpemVQaXhlbHMgIT09IG9sZFByb3BzLmNlbGxTaXplUGl4ZWxzO1xuXG4gICAgaWYgKGNlbGxTaXplQ2hhbmdlZCB8fCBjaGFuZ2VGbGFncy52aWV3cG9ydENoYW5nZWQpIHtcbiAgICAgIHRoaXMudXBkYXRlQ2VsbCgpO1xuICAgIH1cbiAgfVxuXG4gIGRyYXcoe3VuaWZvcm1zfSkge1xuICAgIGNvbnN0IHttaW5Db2xvciwgbWF4Q29sb3J9ID0gdGhpcy5wcm9wcztcbiAgICBjb25zdCB7bW9kZWwsIGNlbGxTY2FsZSwgbWF4Q291bnR9ID0gdGhpcy5zdGF0ZTtcbiAgICB1bmlmb3JtcyA9IE9iamVjdC5hc3NpZ24oe30sIHVuaWZvcm1zLCB7bWluQ29sb3IsIG1heENvbG9yLCBjZWxsU2NhbGUsIG1heENvdW50fSk7XG4gICAgbW9kZWwuZHJhdyh7XG4gICAgICB1bmlmb3JtcyxcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgZGVwdGhNYXNrOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBfZ2V0TW9kZWwoZ2wpIHtcbiAgICByZXR1cm4gbmV3IE1vZGVsKGdsLCBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmdldFNoYWRlcnMoKSwge1xuICAgICAgaWQ6IHRoaXMucHJvcHMuaWQsXG4gICAgICBnZW9tZXRyeTogbmV3IEdlb21ldHJ5KHtcbiAgICAgICAgZHJhd01vZGU6IEdMLlRSSUFOR0xFX0ZBTixcbiAgICAgICAgdmVydGljZXM6IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsIDAsIDEsIDAsIDAsIDEsIDEsIDAsIDAsIDEsIDBdKVxuICAgICAgfSksXG4gICAgICBpc0luc3RhbmNlZDogdHJ1ZSxcbiAgICAgIHNoYWRlckNhY2hlOiB0aGlzLmNvbnRleHQuc2hhZGVyQ2FjaGVcbiAgICB9KSk7XG4gIH1cblxuICB1cGRhdGVDZWxsKCkge1xuICAgIGNvbnN0IHt3aWR0aCwgaGVpZ2h0fSA9IHRoaXMuY29udGV4dC52aWV3cG9ydDtcbiAgICBjb25zdCB7Y2VsbFNpemVQaXhlbHN9ID0gdGhpcy5wcm9wcztcblxuICAgIGNvbnN0IE1BUkdJTiA9IDI7XG4gICAgY29uc3QgY2VsbFNjYWxlID0gbmV3IEZsb2F0MzJBcnJheShbXG4gICAgICAoY2VsbFNpemVQaXhlbHMgLSBNQVJHSU4pIC8gd2lkdGggKiAyLFxuICAgICAgLShjZWxsU2l6ZVBpeGVscyAtIE1BUkdJTikgLyBoZWlnaHQgKiAyLFxuICAgICAgMVxuICAgIF0pO1xuICAgIGNvbnN0IG51bUNvbCA9IE1hdGguY2VpbCh3aWR0aCAvIGNlbGxTaXplUGl4ZWxzKTtcbiAgICBjb25zdCBudW1Sb3cgPSBNYXRoLmNlaWwoaGVpZ2h0IC8gY2VsbFNpemVQaXhlbHMpO1xuXG4gICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICBjZWxsU2NhbGUsXG4gICAgICBudW1Db2wsXG4gICAgICBudW1Sb3csXG4gICAgICBudW1JbnN0YW5jZXM6IG51bUNvbCAqIG51bVJvd1xuICAgIH0pO1xuXG4gICAgY29uc3Qge2F0dHJpYnV0ZU1hbmFnZXJ9ID0gdGhpcy5zdGF0ZTtcbiAgICBhdHRyaWJ1dGVNYW5hZ2VyLmludmFsaWRhdGVBbGwoKTtcbiAgfVxuXG4gIGNhbGN1bGF0ZUluc3RhbmNlUG9zaXRpb25zKGF0dHJpYnV0ZSwge251bUluc3RhbmNlc30pIHtcbiAgICBjb25zdCB7d2lkdGgsIGhlaWdodH0gPSB0aGlzLmNvbnRleHQudmlld3BvcnQ7XG4gICAgY29uc3Qge2NlbGxTaXplUGl4ZWxzfSA9IHRoaXMucHJvcHM7XG4gICAgY29uc3Qge251bUNvbH0gPSB0aGlzLnN0YXRlO1xuICAgIGNvbnN0IHt2YWx1ZSwgc2l6ZX0gPSBhdHRyaWJ1dGU7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUluc3RhbmNlczsgaSsrKSB7XG4gICAgICBjb25zdCB4ID0gaSAlIG51bUNvbDtcbiAgICAgIGNvbnN0IHkgPSBNYXRoLmZsb29yKGkgLyBudW1Db2wpO1xuICAgICAgdmFsdWVbaSAqIHNpemUgKyAwXSA9IHggKiBjZWxsU2l6ZVBpeGVscyAvIHdpZHRoICogMiAtIDE7XG4gICAgICB2YWx1ZVtpICogc2l6ZSArIDFdID0gMSAtIHkgKiBjZWxsU2l6ZVBpeGVscyAvIGhlaWdodCAqIDI7XG4gICAgICB2YWx1ZVtpICogc2l6ZSArIDJdID0gMDtcbiAgICB9XG4gIH1cblxuICBjYWxjdWxhdGVJbnN0YW5jZUNvdW50KGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IHtkYXRhLCBjZWxsU2l6ZVBpeGVscywgZ2V0UG9zaXRpb24sIGdldFdlaWdodH0gPSB0aGlzLnByb3BzO1xuICAgIGNvbnN0IHtudW1Db2wsIG51bVJvd30gPSB0aGlzLnN0YXRlO1xuICAgIGNvbnN0IHt2YWx1ZX0gPSBhdHRyaWJ1dGU7XG4gICAgbGV0IG1heENvdW50ID0gMDtcblxuICAgIHZhbHVlLmZpbGwoMC4wKTtcblxuICAgIGZvciAoY29uc3QgcG9pbnQgb2YgZGF0YSkge1xuICAgICAgY29uc3QgcGl4ZWwgPSB0aGlzLnByb2plY3QoZ2V0UG9zaXRpb24ocG9pbnQpKTtcbiAgICAgIGNvbnN0IGNvbElkID0gTWF0aC5mbG9vcihwaXhlbFswXSAvIGNlbGxTaXplUGl4ZWxzKTtcbiAgICAgIGNvbnN0IHJvd0lkID0gTWF0aC5mbG9vcihwaXhlbFsxXSAvIGNlbGxTaXplUGl4ZWxzKTtcbiAgICAgIGlmIChjb2xJZCA+PSAwICYmIGNvbElkIDwgbnVtQ29sICYmIHJvd0lkID49IDAgJiYgcm93SWQgPCBudW1Sb3cpIHtcbiAgICAgICAgY29uc3QgaSA9IGNvbElkICsgcm93SWQgKiBudW1Db2w7XG4gICAgICAgIHZhbHVlW2ldICs9IGdldFdlaWdodChwb2ludCk7XG4gICAgICAgIGlmICh2YWx1ZVtpXSA+IG1heENvdW50KSB7XG4gICAgICAgICAgbWF4Q291bnQgPSB2YWx1ZVtpXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2V0U3RhdGUoe21heENvdW50fSk7XG4gIH1cbn1cblxuU2NyZWVuR3JpZExheWVyLmxheWVyTmFtZSA9ICdTY3JlZW5HcmlkTGF5ZXInO1xuU2NyZWVuR3JpZExheWVyLmRlZmF1bHRQcm9wcyA9IGRlZmF1bHRQcm9wcztcbiJdfQ==