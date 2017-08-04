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

import React, { createElement } from 'react';
import PropTypes from 'prop-types';
import autobind from './autobind';
import WebGLRenderer from './webgl-renderer';
import { LayerManager, Layer } from '../lib';
import { EffectManager, Effect } from '../experimental';
import { GL, setParameters } from 'luma.gl';
import { Viewport, WebMercatorViewport } from '../lib/viewports';
import EventManager from '../utils/events/event-manager';

function noop() {}

var propTypes = {
  id: PropTypes.string,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  layers: PropTypes.arrayOf(PropTypes.instanceOf(Layer)).isRequired,
  effects: PropTypes.arrayOf(PropTypes.instanceOf(Effect)),
  gl: PropTypes.object,
  debug: PropTypes.bool,
  pickingRadius: PropTypes.number,
  viewport: PropTypes.instanceOf(Viewport),
  onWebGLInitialized: PropTypes.func,
  onAfterRender: PropTypes.func,
  onLayerClick: PropTypes.func,
  onLayerHover: PropTypes.func
};

var defaultProps = {
  id: 'deckgl-overlay',
  debug: false,
  pickingRadius: 0,
  gl: null,
  effects: [],
  onWebGLInitialized: noop,
  onAfterRender: noop,
  onLayerClick: null,
  onLayerHover: null
};

var DeckGL = function (_React$Component) {
  _inherits(DeckGL, _React$Component);

  function DeckGL(props) {
    _classCallCheck(this, DeckGL);

    var _this = _possibleConstructorReturn(this, (DeckGL.__proto__ || Object.getPrototypeOf(DeckGL)).call(this, props));

    _this.state = {};
    _this.needsRedraw = true;
    _this.layerManager = null;
    _this.effectManager = null;
    autobind(_this);
    return _this;
  }

  _createClass(DeckGL, [{
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps(nextProps) {
      this._updateLayers(nextProps);
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      if (this.layerManager) {
        this.layerManager.finalize();
      }
    }

    /* Public API */

  }, {
    key: 'queryObject',
    value: function queryObject(_ref) {
      var x = _ref.x,
          y = _ref.y,
          _ref$radius = _ref.radius,
          radius = _ref$radius === undefined ? 0 : _ref$radius,
          _ref$layerIds = _ref.layerIds,
          layerIds = _ref$layerIds === undefined ? null : _ref$layerIds;

      var selectedInfos = this.layerManager.pickLayer({ x: x, y: y, radius: radius, layerIds: layerIds, mode: 'query' });
      return selectedInfos.length ? selectedInfos[0] : null;
    }
  }, {
    key: 'queryVisibleObjects',
    value: function queryVisibleObjects(_ref2) {
      var x = _ref2.x,
          y = _ref2.y,
          _ref2$width = _ref2.width,
          width = _ref2$width === undefined ? 1 : _ref2$width,
          _ref2$height = _ref2.height,
          height = _ref2$height === undefined ? 1 : _ref2$height,
          _ref2$layerIds = _ref2.layerIds,
          layerIds = _ref2$layerIds === undefined ? null : _ref2$layerIds;

      return this.layerManager.queryLayer({ x: x, y: y, width: width, height: height, layerIds: layerIds });
    }
  }, {
    key: '_updateLayers',
    value: function _updateLayers(nextProps) {
      var width = nextProps.width,
          height = nextProps.height,
          latitude = nextProps.latitude,
          longitude = nextProps.longitude,
          zoom = nextProps.zoom,
          pitch = nextProps.pitch,
          bearing = nextProps.bearing,
          altitude = nextProps.altitude,
          pickingRadius = nextProps.pickingRadius,
          onLayerClick = nextProps.onLayerClick,
          onLayerHover = nextProps.onLayerHover;


      this.layerManager.setEventHandlingParameters({
        pickingRadius: pickingRadius,
        onLayerClick: onLayerClick,
        onLayerHover: onLayerHover
      });

      // If Viewport is not supplied, create one from mercator props
      var viewport = nextProps.viewport;

      viewport = viewport || new WebMercatorViewport({
        width: width, height: height, latitude: latitude, longitude: longitude, zoom: zoom, pitch: pitch, bearing: bearing, altitude: altitude
      });

      if (this.layerManager) {
        this.layerManager.setViewport(viewport).updateLayers({ newLayers: nextProps.layers });
      }
    }
  }, {
    key: '_onRendererInitialized',
    value: function _onRendererInitialized(_ref3) {
      var gl = _ref3.gl,
          canvas = _ref3.canvas;

      setParameters(gl, {
        blend: true,
        blendFunc: [GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA],
        polygonOffsetFill: true
      });

      var props = this.props;

      props.onWebGLInitialized(gl);

      // Note: avoid React setState due GL animation loop / setState timing issue
      this.layerManager = new LayerManager({ gl: gl });
      this.layerManager.initEventHandling(new EventManager(canvas));
      this.effectManager = new EffectManager({ gl: gl, layerManager: this.layerManager });

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = props.effects[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var effect = _step.value;

          this.effectManager.addEffect(effect);
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

      this._updateLayers(props);
    }
  }, {
    key: '_onRenderFrame',
    value: function _onRenderFrame(_ref4) {
      var gl = _ref4.gl;

      var redraw = this.layerManager.needsRedraw({ clearRedrawFlags: true });
      if (!redraw) {
        return;
      }

      // clear depth and color buffers
      gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

      this.effectManager.preDraw();
      this.layerManager.drawLayers({ pass: 'to screen' });
      this.effectManager.draw();
    }
  }, {
    key: 'render',
    value: function render() {
      var _props = this.props,
          width = _props.width,
          height = _props.height,
          gl = _props.gl,
          debug = _props.debug;


      return createElement(WebGLRenderer, Object.assign({}, this.props, {
        width: width,
        height: height,
        // NOTE: Add 'useDevicePixelRatio' to 'this.props' and also pass it down to
        // to modules where window.devicePixelRatio is used.
        useDevicePixelRatio: true,
        gl: gl,
        debug: debug,
        onRendererInitialized: this._onRendererInitialized,
        onNeedRedraw: this._onNeedRedraw,
        onRenderFrame: this._onRenderFrame
      }));
    }
  }]);

  return DeckGL;
}(React.Component);

export default DeckGL;


DeckGL.propTypes = propTypes;
DeckGL.defaultProps = defaultProps;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZWFjdC9kZWNrZ2wuanMiXSwibmFtZXMiOlsiUmVhY3QiLCJjcmVhdGVFbGVtZW50IiwiUHJvcFR5cGVzIiwiYXV0b2JpbmQiLCJXZWJHTFJlbmRlcmVyIiwiTGF5ZXJNYW5hZ2VyIiwiTGF5ZXIiLCJFZmZlY3RNYW5hZ2VyIiwiRWZmZWN0IiwiR0wiLCJzZXRQYXJhbWV0ZXJzIiwiVmlld3BvcnQiLCJXZWJNZXJjYXRvclZpZXdwb3J0IiwiRXZlbnRNYW5hZ2VyIiwibm9vcCIsInByb3BUeXBlcyIsImlkIiwic3RyaW5nIiwid2lkdGgiLCJudW1iZXIiLCJpc1JlcXVpcmVkIiwiaGVpZ2h0IiwibGF5ZXJzIiwiYXJyYXlPZiIsImluc3RhbmNlT2YiLCJlZmZlY3RzIiwiZ2wiLCJvYmplY3QiLCJkZWJ1ZyIsImJvb2wiLCJwaWNraW5nUmFkaXVzIiwidmlld3BvcnQiLCJvbldlYkdMSW5pdGlhbGl6ZWQiLCJmdW5jIiwib25BZnRlclJlbmRlciIsIm9uTGF5ZXJDbGljayIsIm9uTGF5ZXJIb3ZlciIsImRlZmF1bHRQcm9wcyIsIkRlY2tHTCIsInByb3BzIiwic3RhdGUiLCJuZWVkc1JlZHJhdyIsImxheWVyTWFuYWdlciIsImVmZmVjdE1hbmFnZXIiLCJuZXh0UHJvcHMiLCJfdXBkYXRlTGF5ZXJzIiwiZmluYWxpemUiLCJ4IiwieSIsInJhZGl1cyIsImxheWVySWRzIiwic2VsZWN0ZWRJbmZvcyIsInBpY2tMYXllciIsIm1vZGUiLCJsZW5ndGgiLCJxdWVyeUxheWVyIiwibGF0aXR1ZGUiLCJsb25naXR1ZGUiLCJ6b29tIiwicGl0Y2giLCJiZWFyaW5nIiwiYWx0aXR1ZGUiLCJzZXRFdmVudEhhbmRsaW5nUGFyYW1ldGVycyIsInNldFZpZXdwb3J0IiwidXBkYXRlTGF5ZXJzIiwibmV3TGF5ZXJzIiwiY2FudmFzIiwiYmxlbmQiLCJibGVuZEZ1bmMiLCJTUkNfQUxQSEEiLCJPTkVfTUlOVVNfU1JDX0FMUEhBIiwicG9seWdvbk9mZnNldEZpbGwiLCJpbml0RXZlbnRIYW5kbGluZyIsImVmZmVjdCIsImFkZEVmZmVjdCIsInJlZHJhdyIsImNsZWFyUmVkcmF3RmxhZ3MiLCJjbGVhciIsIkNPTE9SX0JVRkZFUl9CSVQiLCJERVBUSF9CVUZGRVJfQklUIiwicHJlRHJhdyIsImRyYXdMYXllcnMiLCJwYXNzIiwiZHJhdyIsIk9iamVjdCIsImFzc2lnbiIsInVzZURldmljZVBpeGVsUmF0aW8iLCJvblJlbmRlcmVySW5pdGlhbGl6ZWQiLCJfb25SZW5kZXJlckluaXRpYWxpemVkIiwib25OZWVkUmVkcmF3IiwiX29uTmVlZFJlZHJhdyIsIm9uUmVuZGVyRnJhbWUiLCJfb25SZW5kZXJGcmFtZSIsIkNvbXBvbmVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxPQUFPQSxLQUFQLElBQWVDLGFBQWYsUUFBbUMsT0FBbkM7QUFDQSxPQUFPQyxTQUFQLE1BQXNCLFlBQXRCO0FBQ0EsT0FBT0MsUUFBUCxNQUFxQixZQUFyQjtBQUNBLE9BQU9DLGFBQVAsTUFBMEIsa0JBQTFCO0FBQ0EsU0FBUUMsWUFBUixFQUFzQkMsS0FBdEIsUUFBa0MsUUFBbEM7QUFDQSxTQUFRQyxhQUFSLEVBQXVCQyxNQUF2QixRQUFvQyxpQkFBcEM7QUFDQSxTQUFRQyxFQUFSLEVBQVlDLGFBQVosUUFBZ0MsU0FBaEM7QUFDQSxTQUFRQyxRQUFSLEVBQWtCQyxtQkFBbEIsUUFBNEMsa0JBQTVDO0FBQ0EsT0FBT0MsWUFBUCxNQUF5QiwrQkFBekI7O0FBRUEsU0FBU0MsSUFBVCxHQUFnQixDQUFFOztBQUVsQixJQUFNQyxZQUFZO0FBQ2hCQyxNQUFJZCxVQUFVZSxNQURFO0FBRWhCQyxTQUFPaEIsVUFBVWlCLE1BQVYsQ0FBaUJDLFVBRlI7QUFHaEJDLFVBQVFuQixVQUFVaUIsTUFBVixDQUFpQkMs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LFdBQUt2QyxhQUFMLENBQW1Cd0MsSUFBbkI7QUFDRDs7OzZCQUVRO0FBQUEsbUJBQzRCLEtBQUs1QyxLQURqQztBQUFBLFVBQ0FyQixLQURBLFVBQ0FBLEtBREE7QUFBQSxVQUNPRyxNQURQLFVBQ09BLE1BRFA7QUFBQSxVQUNlSyxFQURmLFVBQ2VBLEVBRGY7QUFBQSxVQUNtQkUsS0FEbkIsVUFDbUJBLEtBRG5COzs7QUFHUCxhQUFPM0IsY0FBY0csYUFBZCxFQUE2QmdGLE9BQU9DLE1BQVAsQ0FBYyxFQUFkLEVBQWtCLEtBQUs5QyxLQUF2QixFQUE4QjtBQUNoRXJCLG9CQURnRTtBQUVoRUcsc0JBRmdFO0FBR2hFO0FBQ0E7QUFDQWlFLDZCQUFxQixJQUwyQztBQU1oRTVELGNBTmdFO0FBT2hFRSxvQkFQZ0U7QUFRaEUyRCwrQkFBdUIsS0FBS0Msc0JBUm9DO0FBU2hFQyxzQkFBYyxLQUFLQyxhQVQ2QztBQVVoRUMsdUJBQWUsS0FBS0M7QUFWNEMsT0FBOUIsQ0FBN0IsQ0FBUDtBQVlEOzs7O0VBbkhpQzVGLE1BQU02RixTOztlQUFyQnZELE07OztBQXNIckJBLE9BQU92QixTQUFQLEdBQW1CQSxTQUFuQjtBQUNBdUIsT0FBT0QsWUFBUCxHQUFzQkEsWUFBdEIiLCJmaWxlIjoiZGVja2dsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IChjKSAyMDE1IC0gMjAxNyBVYmVyIFRlY2hub2xvZ2llcywgSW5jLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbi8vIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbi8vIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbi8vIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbi8vIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuLy8gZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuLy8gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuLy8gSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4vLyBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbi8vIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbi8vIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4vLyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4vLyBUSEUgU09GVFdBUkUuXG5cbmltcG9ydCBSZWFjdCwge2NyZWF0ZUVsZW1lbnR9IGZyb20gJ3JlYWN0JztcbmltcG9ydCBQcm9wVHlwZXMgZnJvbSAncHJvcC10eXBlcyc7XG5pbXBvcnQgYXV0b2JpbmQgZnJvbSAnLi9hdXRvYmluZCc7XG5pbXBvcnQgV2ViR0xSZW5kZXJlciBmcm9tICcuL3dlYmdsLXJlbmRlcmVyJztcbmltcG9ydCB7TGF5ZXJNYW5hZ2VyLCBMYXllcn0gZnJvbSAnLi4vbGliJztcbmltcG9ydCB7RWZmZWN0TWFuYWdlciwgRWZmZWN0fSBmcm9tICcuLi9leHBlcmltZW50YWwnO1xuaW1wb3J0IHtHTCwgc2V0UGFyYW1ldGVyc30gZnJvbSAnbHVtYS5nbCc7XG5pbXBvcnQge1ZpZXdwb3J0LCBXZWJNZXJjYXRvclZpZXdwb3J0fSBmcm9tICcuLi9saWIvdmlld3BvcnRzJztcbmltcG9ydCBFdmVudE1hbmFnZXIgZnJvbSAnLi4vdXRpbHMvZXZlbnRzL2V2ZW50LW1hbmFnZXInO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxuY29uc3QgcHJvcFR5cGVzID0ge1xuICBpZDogUHJvcFR5cGVzLnN0cmluZyxcbiAgd2lkdGg6IFByb3BUeXBlcy5udW1iZXIuaXNSZXF1aXJlZCxcbiAgaGVpZ2h0OiBQcm9wVHlwZXMubnVtYmVyLmlzUmVxdWlyZWQsXG4gIGxheWVyczogUHJvcFR5cGVzLmFycmF5T2YoUHJvcFR5cGVzLmluc3RhbmNlT2YoTGF5ZXIpKS5pc1JlcXVpcmVkLFxuICBlZmZlY3RzOiBQcm9wVHlwZXMuYXJyYXlPZihQcm9wVHlwZXMuaW5zdGFuY2VPZihFZmZlY3QpKSxcbiAgZ2w6IFByb3BUeXBlcy5vYmplY3QsXG4gIGRlYnVnOiBQcm9wVHlwZXMuYm9vbCxcbiAgcGlja2luZ1JhZGl1czogUHJvcFR5cGVzLm51bWJlcixcbiAgdmlld3BvcnQ6IFByb3BUeXBlcy5pbnN0YW5jZU9mKFZpZXdwb3J0KSxcbiAgb25XZWJHTEluaXRpYWxpemVkOiBQcm9wVHlwZXMuZnVuYyxcbiAgb25BZnRlclJlbmRlcjogUHJvcFR5cGVzLmZ1bmMsXG4gIG9uTGF5ZXJDbGljazogUHJvcFR5cGVzLmZ1bmMsXG4gIG9uTGF5ZXJIb3ZlcjogUHJvcFR5cGVzLmZ1bmNcbn07XG5cbmNvbnN0IGRlZmF1bHRQcm9wcyA9IHtcbiAgaWQ6ICdkZWNrZ2wtb3ZlcmxheScsXG4gIGRlYnVnOiBmYWxzZSxcbiAgcGlja2luZ1JhZGl1czogMCxcbiAgZ2w6IG51bGwsXG4gIGVmZmVjdHM6IFtdLFxuICBvbldlYkdMSW5pdGlhbGl6ZWQ6IG5vb3AsXG4gIG9uQWZ0ZXJSZW5kZXI6IG5vb3AsXG4gIG9uTGF5ZXJDbGljazogbnVsbCxcbiAgb25MYXllckhvdmVyOiBudWxsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEZWNrR0wgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLnN0YXRlID0ge307XG4gICAgdGhpcy5uZWVkc1JlZHJhdyA9IHRydWU7XG4gICAgdGhpcy5sYXllck1hbmFnZXIgPSBudWxsO1xuICAgIHRoaXMuZWZmZWN0TWFuYWdlciA9IG51bGw7XG4gICAgYXV0b2JpbmQodGhpcyk7XG4gIH1cblxuICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKG5leHRQcm9wcykge1xuICAgIHRoaXMuX3VwZGF0ZUxheWVycyhuZXh0UHJvcHMpO1xuICB9XG5cbiAgY29tcG9uZW50V2lsbFVubW91bnQoKSB7XG4gICAgaWYgKHRoaXMubGF5ZXJNYW5hZ2VyKSB7XG4gICAgICB0aGlzLmxheWVyTWFuYWdlci5maW5hbGl6ZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qIFB1YmxpYyBBUEkgKi9cbiAgcXVlcnlPYmplY3Qoe3gsIHksIHJhZGl1cyA9IDAsIGxheWVySWRzID0gbnVsbH0pIHtcbiAgICBjb25zdCBzZWxlY3RlZEluZm9zID0gdGhpcy5sYXllck1hbmFnZXIucGlja0xheWVyKHt4LCB5LCByYWRpdXMsIGxheWVySWRzLCBtb2RlOiAncXVlcnknfSk7XG4gICAgcmV0dXJuIHNlbGVjdGVkSW5mb3MubGVuZ3RoID8gc2VsZWN0ZWRJbmZvc1swXSA6IG51bGw7XG4gIH1cblxuICBxdWVyeVZpc2libGVPYmplY3RzKHt4LCB5LCB3aWR0aCA9IDEsIGhlaWdodCA9IDEsIGxheWVySWRzID0gbnVsbH0pIHtcbiAgICByZXR1cm4gdGhpcy5sYXllck1hbmFnZXIucXVlcnlMYXllcih7eCwgeSwgd2lkdGgsIGhlaWdodCwgbGF5ZXJJZHN9KTtcbiAgfVxuXG4gIF91cGRhdGVMYXllcnMobmV4dFByb3BzKSB7XG4gICAgY29uc3Qge1xuICAgICAgd2lkdGgsXG4gICAgICBoZWlnaHQsXG4gICAgICBsYXRpdHVkZSxcbiAgICAgIGxvbmdpdHVkZSxcbiAgICAgIHpvb20sXG4gICAgICBwaXRjaCxcbiAgICAgIGJlYXJpbmcsXG4gICAgICBhbHRpdHVkZSxcbiAgICAgIHBpY2tpbmdSYWRpdXMsXG4gICAgICBvbkxheWVyQ2xpY2ssXG4gICAgICBvbkxheWVySG92ZXJcbiAgICB9ID0gbmV4dFByb3BzO1xuXG4gICAgdGhpcy5sYXllck1hbmFnZXIuc2V0RXZlbnRIYW5kbGluZ1BhcmFtZXRlcnMoe1xuICAgICAgcGlja2luZ1JhZGl1cyxcbiAgICAgIG9uTGF5ZXJDbGljayxcbiAgICAgIG9uTGF5ZXJIb3ZlclxuICAgIH0pO1xuXG4gICAgLy8gSWYgVmlld3BvcnQgaXMgbm90IHN1cHBsaWVkLCBjcmVhdGUgb25lIGZyb20gbWVyY2F0b3IgcHJvcHNcbiAgICBsZXQge3ZpZXdwb3J0fSA9IG5leHRQcm9wcztcbiAgICB2aWV3cG9ydCA9IHZpZXdwb3J0IHx8IG5ldyBXZWJNZXJjYXRvclZpZXdwb3J0KHtcbiAgICAgIHdpZHRoLCBoZWlnaHQsIGxhdGl0dWRlLCBsb25naXR1ZGUsIHpvb20sIHBpdGNoLCBiZWFyaW5nLCBhbHRpdHVkZVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMubGF5ZXJNYW5hZ2VyKSB7XG4gICAgICB0aGlzLmxheWVyTWFuYWdlclxuICAgICAgICAuc2V0Vmlld3BvcnQodmlld3BvcnQpXG4gICAgICAgIC51cGRhdGVMYXllcnMoe25ld0xheWVyczogbmV4dFByb3BzLmxheWVyc30pO1xuICAgIH1cbiAgfVxuXG4gIF9vblJlbmRlcmVySW5pdGlhbGl6ZWQoe2dsLCBjYW52YXN9KSB7XG4gICAgc2V0UGFyYW1ldGVycyhnbCwge1xuICAgICAgYmxlbmQ6IHRydWUsXG4gICAgICBibGVuZEZ1bmM6IFtHTC5TUkNfQUxQSEEsIEdMLk9ORV9NSU5VU19TUkNfQUxQSEFdLFxuICAgICAgcG9seWdvbk9mZnNldEZpbGw6IHRydWVcbiAgICB9KTtcblxuICAgIGNvbnN0IHtwcm9wc30gPSB0aGlzO1xuICAgIHByb3BzLm9uV2ViR0xJbml0aWFsaXplZChnbCk7XG5cbiAgICAvLyBOb3RlOiBhdm9pZCBSZWFjdCBzZXRTdGF0ZSBkdWUgR0wgYW5pbWF0aW9uIGxvb3AgLyBzZXRTdGF0ZSB0aW1pbmcgaXNzdWVcbiAgICB0aGlzLmxheWVyTWFuYWdlciA9IG5ldyBMYXllck1hbmFnZXIoe2dsfSk7XG4gICAgdGhpcy5sYXllck1hbmFnZXIuaW5pdEV2ZW50SGFuZGxpbmcobmV3IEV2ZW50TWFuYWdlcihjYW52YXMpKTtcbiAgICB0aGlzLmVmZmVjdE1hbmFnZXIgPSBuZXcgRWZmZWN0TWFuYWdlcih7Z2wsIGxheWVyTWFuYWdlcjogdGhpcy5sYXllck1hbmFnZXJ9KTtcblxuICAgIGZvciAoY29uc3QgZWZmZWN0IG9mIHByb3BzLmVmZmVjdHMpIHtcbiAgICAgIHRoaXMuZWZmZWN0TWFuYWdlci5hZGRFZmZlY3QoZWZmZWN0KTtcbiAgICB9XG5cbiAgICB0aGlzLl91cGRhdGVMYXllcnMocHJvcHMpO1xuICB9XG5cbiAgX29uUmVuZGVyRnJhbWUoe2dsfSkge1xuICAgIGNvbnN0IHJlZHJhdyA9IHRoaXMubGF5ZXJNYW5hZ2VyLm5lZWRzUmVkcmF3KHtjbGVhclJlZHJhd0ZsYWdzOiB0cnVlfSk7XG4gICAgaWYgKCFyZWRyYXcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBjbGVhciBkZXB0aCBhbmQgY29sb3IgYnVmZmVyc1xuICAgIGdsLmNsZWFyKEdMLkNPTE9SX0JVRkZFUl9CSVQgfCBHTC5ERVBUSF9CVUZGRVJfQklUKTtcblxuICAgIHRoaXMuZWZmZWN0TWFuYWdlci5wcmVEcmF3KCk7XG4gICAgdGhpcy5sYXllck1hbmFnZXIuZHJhd0xheWVycyh7cGFzczogJ3RvIHNjcmVlbid9KTtcbiAgICB0aGlzLmVmZmVjdE1hbmFnZXIuZHJhdygpO1xuICB9XG5cbiAgcmVuZGVyKCkge1xuICAgIGNvbnN0IHt3aWR0aCwgaGVpZ2h0LCBnbCwgZGVidWd9ID0gdGhpcy5wcm9wcztcblxuICAgIHJldHVybiBjcmVhdGVFbGVtZW50KFdlYkdMUmVuZGVyZXIsIE9iamVjdC5hc3NpZ24oe30sIHRoaXMucHJvcHMsIHtcbiAgICAgIHdpZHRoLFxuICAgICAgaGVpZ2h0LFxuICAgICAgLy8gTk9URTogQWRkICd1c2VEZXZpY2VQaXhlbFJhdGlvJyB0byAndGhpcy5wcm9wcycgYW5kIGFsc28gcGFzcyBpdCBkb3duIHRvXG4gICAgICAvLyB0byBtb2R1bGVzIHdoZXJlIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIGlzIHVzZWQuXG4gICAgICB1c2VEZXZpY2VQaXhlbFJhdGlvOiB0cnVlLFxuICAgICAgZ2wsXG4gICAgICBkZWJ1ZyxcbiAgICAgIG9uUmVuZGVyZXJJbml0aWFsaXplZDogdGhpcy5fb25SZW5kZXJlckluaXRpYWxpemVkLFxuICAgICAgb25OZWVkUmVkcmF3OiB0aGlzLl9vbk5lZWRSZWRyYXcsXG4gICAgICBvblJlbmRlckZyYW1lOiB0aGlzLl9vblJlbmRlckZyYW1lXG4gICAgfSkpO1xuICB9XG59XG5cbkRlY2tHTC5wcm9wVHlwZXMgPSBwcm9wVHlwZXM7XG5EZWNrR0wuZGVmYXVsdFByb3BzID0gZGVmYXVsdFByb3BzO1xuIl19