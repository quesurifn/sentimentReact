var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Copyright (c) 2015 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import MapState from './map-state';

// EVENT HANDLING PARAMETERS
var PITCH_MOUSE_THRESHOLD = 5;
var PITCH_ACCEL = 1.2;
var ZOOM_ACCEL = 0.01;

var EVENT_TYPES = {
  WHEEL: ['wheel'],
  PAN: ['panstart', 'panmove', 'panend'],
  PINCH: ['pinchstart', 'pinchmove', 'pinchend'],
  DOUBLE_TAP: ['doubletap']
};

var MapControls = function () {
  /**
   * @classdesc
   * A class that handles events and updates mercator style viewport parameters
   */
  function MapControls() {
    _classCallCheck(this, MapControls);

    this._state = {
      isDragging: false
    };
    this.handleEvent = this.handleEvent.bind(this);
  }

  /**
   * Callback for events
   * @param {hammer.Event} event
   */


  _createClass(MapControls, [{
    key: 'handleEvent',
    value: function handleEvent(event) {
      this.mapState = new MapState(Object.assign({}, this.mapStateProps, this._state));

      switch (event.type) {
        case 'panstart':
          return this._onPanStart(event);
        case 'panmove':
          return this._onPan(event);
        case 'panend':
          return this._onPanEnd(event);
        case 'pinchstart':
          return this._onPinchStart(event);
        case 'pinch':
          return this._onPinch(event);
        case 'pinchend':
          return this._onPinchEnd(event);
        case 'doubletap':
          return this._onDoubleTap(event);
        case 'wheel':
          return this._onWheel(event);
        default:
          return false;
      }
    }

    /* Event utils */
    // Event object: http://hammerjs.github.io/api/#event-object

  }, {
    key: 'getCenter',
    value: function getCenter(event) {
      var _event$offsetCenter = event.offsetCenter,
          x = _event$offsetCenter.x,
          y = _event$offsetCenter.y;

      return [x, y];
    }
  }, {
    key: 'isFunctionKeyPressed',
    value: function isFunctionKeyPressed(event) {
      var srcEvent = event.srcEvent;

      return Boolean(srcEvent.metaKey || srcEvent.altKey || srcEvent.ctrlKey || srcEvent.shiftKey);
    }
  }, {
    key: 'setState',
    value: function setState(newState) {
      Object.assign(this._state, newState);
      if (this.onStateChange) {
        this.onStateChange(this._state);
      }
    }

    /* Callback util */
    // formats map state and invokes callback function

  }, {
    key: 'updateViewport',
    value: function updateViewport(newMapState) {
      var extraState = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var oldViewport = this.mapState.getViewportProps();
      var newViewport = newMapState.getViewportProps();

      if (this.onViewportChange && Object.keys(newViewport).some(function (key) {
        return oldViewport[key] !== newViewport[key];
      })) {
        // Viewport has changed
        this.onViewportChange(newViewport);
      }

      this.setState(Object.assign({}, newMapState.getInteractiveState(), extraState));
    }

    /**
     * Extract interactivity options
     */

  }, {
    key: 'setOptions',
    value: function setOptions(options) {
      var onChangeViewport = options.onChangeViewport,
          onViewportChange = options.onViewportChange,
          _options$onStateChang = options.onStateChange,
          onStateChange = _options$onStateChang === undefined ? this.onStateChange : _options$onStateChang,
          _options$eventManager = options.eventManager,
          eventManager = _options$eventManager === undefined ? this.eventManager : _options$eventManager,
          _options$scrollZoom = options.scrollZoom,
          scrollZoom = _options$scrollZoom === undefined ? true : _options$scrollZoom,
          _options$dragPan = options.dragPan,
          dragPan = _options$dragPan === undefined ? true : _options$dragPan,
          _options$dragRotate = options.dragRotate,
          dragRotate = _options$dragRotate === undefined ? true : _options$dragRotate,
          _options$doubleClickZ = options.doubleClickZoom,
          doubleClickZoom = _options$doubleClickZ === undefined ? true : _options$doubleClickZ,
          _options$touchZoomRot = options.touchZoomRotate,
          touchZoomRotate = _options$touchZoomRot === undefined ? true : _options$touchZoomRot;

      // TODO(deprecate): remove this check when `onChangeViewport` gets deprecated

      this.onViewportChange = onViewportChange || onChangeViewport;
      this.onStateChange = onStateChange;
      this.mapStateProps = options;
      if (this.eventManager !== eventManager) {
        // EventManager has changed
        this.eventManager = eventManager;
        this._events = {};
      }

      // Register/unregister events
      this.toggleEvents(EVENT_TYPES.WHEEL, scrollZoom);
      this.toggleEvents(EVENT_TYPES.PAN, dragPan || dragRotate);
      this.toggleEvents(EVENT_TYPES.PINCH, touchZoomRotate);
      this.toggleEvents(EVENT_TYPES.DOUBLE_TAP, doubleClickZoom);

      // Interaction toggles
      this.scrollZoom = scrollZoom;
      this.dragPan = dragPan;
      this.dragRotate = dragRotate;
      this.doubleClickZoom = doubleClickZoom;
      this.touchZoomRotate = touchZoomRotate;
    }
  }, {
    key: 'toggleEvents',
    value: function toggleEvents(eventNames, enabled) {
      var _this = this;

      if (this.eventManager) {
        eventNames.forEach(function (eventName) {
          if (_this._events[eventName] !== enabled) {
            _this._events[eventName] = enabled;
            if (enabled) {
              _this.eventManager.on(eventName, _this.handleEvent);
            } else {
              _this.eventManager.off(eventName, _this.handleEvent);
            }
          }
        });
      }
    }

    /* Event handlers */
    // Default handler for the `panstart` event.

  }, {
    key: '_onPanStart',
    value: function _onPanStart(event) {
      var pos = this.getCenter(event);
      var newMapState = this.mapState.panStart({ pos: pos }).rotateStart({ pos: pos });
      return this.updateViewport(newMapState, { isDragging: true });
    }

    // Default handler for the `panmove` event.

  }, {
    key: '_onPan',
    value: function _onPan(event) {
      return this.isFunctionKeyPressed(event) ? this._onPanRotate(event) : this._onPanMove(event);
    }

    // Default handler for the `panend` event.

  }, {
    key: '_onPanEnd',
    value: function _onPanEnd(event) {
      var newMapState = this.mapState.panEnd().rotateEnd();
      return this.updateViewport(newMapState, { isDragging: false });
    }

    // Default handler for panning to move.
    // Called by `_onPan` when panning without function key pressed.

  }, {
    key: '_onPanMove',
    value: function _onPanMove(event) {
      if (!this.dragPan) {
        return false;
      }
      var pos = this.getCenter(event);
      var newMapState = this.mapState.pan({ pos: pos });
      return this.updateViewport(newMapState);
    }

    // Default handler for panning to rotate.
    // Called by `_onPan` when panning with function key pressed.

  }, {
    key: '_onPanRotate',
    value: function _onPanRotate(event) {
      if (!this.dragRotate) {
        return false;
      }

      var deltaX = event.deltaX,
          deltaY = event.deltaY;

      var _getCenter = this.getCenter(event),
          _getCenter2 = _slicedToArray(_getCenter, 2),
          centerY = _getCenter2[1];

      var startY = centerY - deltaY;

      var _mapState$getViewport = this.mapState.getViewportProps(),
          width = _mapState$getViewport.width,
          height = _mapState$getViewport.height;

      var deltaScaleX = deltaX / width;
      var deltaScaleY = 0;

      if (deltaY > 0) {
        if (Math.abs(height - startY) > PITCH_MOUSE_THRESHOLD) {
          // Move from 0 to -1 as we drag upwards
          deltaScaleY = deltaY / (startY - height) * PITCH_ACCEL;
        }
      } else if (deltaY < 0) {
        if (startY > PITCH_MOUSE_THRESHOLD) {
          // Move from 0 to 1 as we drag upwards
          deltaScaleY = 1 - centerY / startY;
        }
      }
      deltaScaleY = Math.min(1, Math.max(-1, deltaScaleY));

      var newMapState = this.mapState.rotate({ deltaScaleX: deltaScaleX, deltaScaleY: deltaScaleY });
      return this.updateViewport(newMapState);
    }

    // Default handler for the `wheel` event.

  }, {
    key: '_onWheel',
    value: function _onWheel(event) {
      if (!this.scrollZoom) {
        return false;
      }

      var pos = this.getCenter(event);
      var delta = event.delta;

      // Map wheel delta to relative scale

      var scale = 2 / (1 + Math.exp(-Math.abs(delta * ZOOM_ACCEL)));
      if (delta < 0 && scale !== 0) {
        scale = 1 / scale;
      }

      var newMapState = this.mapState.zoom({ pos: pos, scale: scale });
      return this.updateViewport(newMapState);
    }

    // Default handler for the `pinchstart` event.

  }, {
    key: '_onPinchStart',
    value: function _onPinchStart(event) {
      var pos = this.getCenter(event);
      var newMapState = this.mapState.zoomStart({ pos: pos });
      return this.updateViewport(newMapState, { isDragging: true });
    }

    // Default handler for the `pinch` event.

  }, {
    key: '_onPinch',
    value: function _onPinch(event) {
      if (!this.touchZoomRotate) {
        return false;
      }
      var pos = this.getCenter(event);
      var scale = event.scale;

      var newMapState = this.mapState.zoom({ pos: pos, scale: scale });
      return this.updateViewport(newMapState);
    }

    // Default handler for the `pinchend` event.

  }, {
    key: '_onPinchEnd',
    value: function _onPinchEnd(event) {
      var newMapState = this.mapState.zoomEnd();
      return this.updateViewport(newMapState, { isDragging: false });
    }

    // Default handler for the `doubletap` event.

  }, {
    key: '_onDoubleTap',
    value: function _onDoubleTap(event) {
      if (!this.doubleClickZoom) {
        return false;
      }
      var pos = this.getCenter(event);
      var isZoomOut = this.isFunctionKeyPressed(event);

      var newMapState = this.mapState.zoom({ pos: pos, scale: isZoomOut ? 0.5 : 2 });
      return this.updateViewport(newMapState);
    }
  }]);

  return MapControls;
}();

export default MapControls;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb250cm9sbGVycy9tYXAtY29udHJvbGxlci9tYXAtY29udHJvbHMuanMiXSwibmFtZXMiOlsiTWFwU3RhdGUiLCJQSVRDSF9NT1VTRV9USFJFU0hPTEQiLCJQSVRDSF9BQ0NFTCIsIlpPT01fQUNDRUwiLCJFVkVOVF9UWVBFUyIsIldIRUVMIiwiUEFOIiwiUElOQ0giLCJET1VCTEVfVEFQIiwiTWFwQ29udHJvbHMiLCJfc3RhdGUiLCJpc0RyYWdnaW5nIiwiaGFuZGxlRXZlbnQiLCJiaW5kIiwiZXZlbnQiLCJtYXBTdGF0ZSIsIk9iamVjdCIsImFzc2lnbiIsIm1hcFN0YXRlUHJvcHMiLCJ0eXBlIiwiX29uUGFuU3RhcnQiLCJfb25QYW4iLCJfb25QYW5FbmQiLCJfb25QaW5jaFN0YXJ0IiwiX29uUGluY2giLCJfb25QaW5jaEVuZCIsIl9vbkRvdWJsZVRhcCIsIl9vbldoZWVsIiwib2Zmc2V0Q2VudGVyIiwieCIsInkiLCJzcmNFdmVudCIsIkJvb2xlYW4iLCJtZXRhS2V5IiwiYWx0S2V5IiwiY3RybEtleSIsInNoaWZ0S2V5IiwibmV3U3RhdGUiLCJvblN0YXRlQ2hhbmdlIiwibmV3TWFwU3RhdGUiLCJleHRyYVN0YXRlIiwib2xkVmlld3BvcnQiLCJnZXRWaWV3cG9ydFByb3BzIiwibmV3Vmlld3BvcnQiLCJvblZpZXdwb3J0Q2hhbmdlIiwia2V5cyIsInNvbWUiLCJrZXkiLCJzZXRTdGF0ZSIsImdldEludGVyYWN0aXZlU3RhdGUiLCJvcHRpb25zIiwib25DaGFuZ2VWaWV3cG9ydCIsImV2ZW50TWFuYWdlciIsInNjcm9sbFpvb20iLCJkcmFnUGFuIiwiZHJhZ1JvdGF0ZSIsImRvdWJsZUNsaWNrWm9vbSIsInRvdWNoWm9vbVJvdGF0ZSIsIl9ldmVudHMiLCJ0b2dnbGVFdmVudHMiLCJldmVudE5hbWVzIiwiZW5hYmxlZCIsImZvckVhY2giLCJldmVudE5hbWUiLCJvbiIsIm9mZiIsInBvcyIsImdldENlbnRlciIsInBhblN0YXJ0Iiwicm90YXRlU3RhcnQiLCJ1cGRhdGVWaWV3cG9ydCIsImlzRnVuY3Rpb25LZXlQcmVzc2VkIiwiX29uUGFuUm90YXRlIiwiX29uUGFuTW92ZSIsInBhbkVuZCIsInJvdGF0ZUVuZCIsInBhbiIsImRlbHRhWCIsImRlbHRhWSIsImNlbnRlclkiLCJzdGFydFkiLCJ3aWR0aCIsImhlaWdodCIsImRlbHRhU2NhbGVYIiwiZGVsdGFTY2FsZVkiLCJNYXRoIiwiYWJzIiwibWluIiwibWF4Iiwicm90YXRlIiwiZGVsdGEiLCJzY2FsZSIsImV4cCIsInpvb20iLCJ6b29tU3RhcnQiLCJ6b29tRW5kIiwiaXNab29tT3V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxPQUFPQSxRQUFQLE1BQXFCLGFBQXJCOztBQUVBO0FBQ0EsSUFBTUMsd0JBQXdCLENBQTlCO0FBQ0EsSUFBTUMsY0FBYyxHQUFwQjtBQUNBLElBQU1DLGFBQWEsSUFBbkI7O0FBRUEsSUFBTUMsY0FBYztBQUNsQkMsU0FBTyxDQUFDLE9BQUQsQ0FEVztBQUVsQkMsT0FBSyxDQUFDLFVBQUQsRUFBYSxTQUFiLEVBQXdCLFFBQXhCLENBRmE7QUFHbEJDLFNBQU8sQ0FBQyxZQUFELEVBQWUsV0FBZixFQUE0QixVQUE1QixDQUhXO0FBSWxCQyxjQUFZLENBQUMsV0FBRDtBQUpNLENBQXBCOztJQU9xQkMsVztBQUNuQjs7OztBQUlBLHlCQUFjO0FBQUE7O0FBQ1osU0FBS0MsTUFBTCxHQUFjO0FBQ1pDLGtCQUFZO0FBREEsS0FBZDtBQUdBLFNBQUtDLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQkMsSUFBakIsQ0FBc0IsSUFBdEIsQ0FBbkI7QUFDRDs7QUFFRDs7Ozs7Ozs7Z0NBSVlDLEssRUFBTztBQUNqQixXQUFLQyxRQUFMLEdBQWdCLElBQUlmLFFBQUosQ0FBYWdCLE9BQU9DLE1BQVAs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SmMsVUFLUDZFLEtBTE8sR0FLRTdFLEtBTEYsQ0FLUDZFLEtBTE87O0FBTWQsVUFBTXBELGNBQWMsS0FBS3hCLFFBQUwsQ0FBYzhFLElBQWQsQ0FBbUIsRUFBQzNCLFFBQUQsRUFBTXlCLFlBQU4sRUFBbkIsQ0FBcEI7QUFDQSxhQUFPLEtBQUtyQixjQUFMLENBQW9CL0IsV0FBcEIsQ0FBUDtBQUNEOztBQUVEOzs7O2dDQUNZekIsSyxFQUFPO0FBQ2pCLFVBQU15QixjQUFjLEtBQUt4QixRQUFMLENBQWNnRixPQUFkLEVBQXBCO0FBQ0EsYUFBTyxLQUFLekIsY0FBTCxDQUFvQi9CLFdBQXBCLEVBQWlDLEVBQUM1QixZQUFZLEtBQWIsRUFBakMsQ0FBUDtBQUNEOztBQUVEOzs7O2lDQUNhRyxLLEVBQU87QUFDbEIsVUFBSSxDQUFDLEtBQUswQyxlQUFWLEVBQTJCO0FBQ3pCLGVBQU8sS0FBUDtBQUNEO0FBQ0QsVUFBTVUsTUFBTSxLQUFLQyxTQUFMLENBQWVyRCxLQUFmLENBQVo7QUFDQSxVQUFNa0YsWUFBWSxLQUFLekIsb0JBQUwsQ0FBMEJ6RCxLQUExQixDQUFsQjs7QUFFQSxVQUFNeUIsY0FBYyxLQUFLeEIsUUFBTCxDQUFjOEUsSUFBZCxDQUFtQixFQUFDM0IsUUFBRCxFQUFNeUIsT0FBT0ssWUFBWSxHQUFaLEdBQWtCLENBQS9CLEVBQW5CLENBQXBCO0FBQ0EsYUFBTyxLQUFLMUIsY0FBTCxDQUFvQi9CLFdBQXBCLENBQVA7QUFDRDs7Ozs7O2VBdlBrQjlCLFciLCJmaWxlIjoibWFwLWNvbnRyb2xzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFViZXIgVGVjaG5vbG9naWVzLCBJbmMuXG5cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbi8vIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbi8vIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbi8vIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbi8vIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuLy8gZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcblxuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbi8vIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4vLyBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbi8vIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuLy8gQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuLy8gTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbi8vIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbi8vIFRIRSBTT0ZUV0FSRS5cblxuaW1wb3J0IE1hcFN0YXRlIGZyb20gJy4vbWFwLXN0YXRlJztcblxuLy8gRVZFTlQgSEFORExJTkcgUEFSQU1FVEVSU1xuY29uc3QgUElUQ0hfTU9VU0VfVEhSRVNIT0xEID0gNTtcbmNvbnN0IFBJVENIX0FDQ0VMID0gMS4yO1xuY29uc3QgWk9PTV9BQ0NFTCA9IDAuMDE7XG5cbmNvbnN0IEVWRU5UX1RZUEVTID0ge1xuICBXSEVFTDogWyd3aGVlbCddLFxuICBQQU46IFsncGFuc3RhcnQnLCAncGFubW92ZScsICdwYW5lbmQnXSxcbiAgUElOQ0g6IFsncGluY2hzdGFydCcsICdwaW5jaG1vdmUnLCAncGluY2hlbmQnXSxcbiAgRE9VQkxFX1RBUDogWydkb3VibGV0YXAnXVxufTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWFwQ29udHJvbHMge1xuICAvKipcbiAgICogQGNsYXNzZGVzY1xuICAgKiBBIGNsYXNzIHRoYXQgaGFuZGxlcyBldmVudHMgYW5kIHVwZGF0ZXMgbWVyY2F0b3Igc3R5bGUgdmlld3BvcnQgcGFyYW1ldGVyc1xuICAgKi9cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fc3RhdGUgPSB7XG4gICAgICBpc0RyYWdnaW5nOiBmYWxzZVxuICAgIH07XG4gICAgdGhpcy5oYW5kbGVFdmVudCA9IHRoaXMuaGFuZGxlRXZlbnQuYmluZCh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayBmb3IgZXZlbnRzXG4gICAqIEBwYXJhbSB7aGFtbWVyLkV2ZW50fSBldmVudFxuICAgKi9cbiAgaGFuZGxlRXZlbnQoZXZlbnQpIHtcbiAgICB0aGlzLm1hcFN0YXRlID0gbmV3IE1hcFN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHRoaXMubWFwU3RhdGVQcm9wcywgdGhpcy5fc3RhdGUpKTtcblxuICAgIHN3aXRjaCAoZXZlbnQudHlwZSkge1xuICAgIGNhc2UgJ3BhbnN0YXJ0JzpcbiAgICAgIHJldHVybiB0aGlzLl9vblBhblN0YXJ0KGV2ZW50KTtcbiAgICBjYXNlICdwYW5tb3ZlJzpcbiAgICAgIHJldHVybiB0aGlzLl9vblBhbihldmVudCk7XG4gICAgY2FzZSAncGFuZW5kJzpcbiAgICAgIHJldHVybiB0aGlzLl9vblBhbkVuZChldmVudCk7XG4gICAgY2FzZSAncGluY2hzdGFydCc6XG4gICAgICByZXR1cm4gdGhpcy5fb25QaW5jaFN0YXJ0KGV2ZW50KTtcbiAgICBjYXNlICdwaW5jaCc6XG4gICAgICByZXR1cm4gdGhpcy5fb25QaW5jaChldmVudCk7XG4gICAgY2FzZSAncGluY2hlbmQnOlxuICAgICAgcmV0dXJuIHRoaXMuX29uUGluY2hFbmQoZXZlbnQpO1xuICAgIGNhc2UgJ2RvdWJsZXRhcCc6XG4gICAgICByZXR1cm4gdGhpcy5fb25Eb3VibGVUYXAoZXZlbnQpO1xuICAgIGNhc2UgJ3doZWVsJzpcbiAgICAgIHJldHVybiB0aGlzLl9vbldoZWVsKGV2ZW50KTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qIEV2ZW50IHV0aWxzICovXG4gIC8vIEV2ZW50IG9iamVjdDogaHR0cDovL2hhbW1lcmpzLmdpdGh1Yi5pby9hcGkvI2V2ZW50LW9iamVjdFxuICBnZXRDZW50ZXIoZXZlbnQpIHtcbiAgICBjb25zdCB7b2Zmc2V0Q2VudGVyOiB7eCwgeX19ID0gZXZlbnQ7XG4gICAgcmV0dXJuIFt4LCB5XTtcbiAgfVxuXG4gIGlzRnVuY3Rpb25LZXlQcmVzc2VkKGV2ZW50KSB7XG4gICAgY29uc3Qge3NyY0V2ZW50fSA9IGV2ZW50O1xuICAgIHJldHVybiBCb29sZWFuKHNyY0V2ZW50Lm1ldGFLZXkgfHwgc3JjRXZlbnQuYWx0S2V5IHx8XG4gICAgICBzcmNFdmVudC5jdHJsS2V5IHx8IHNyY0V2ZW50LnNoaWZ0S2V5KTtcbiAgfVxuXG4gIHNldFN0YXRlKG5ld1N0YXRlKSB7XG4gICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGF0ZSwgbmV3U3RhdGUpO1xuICAgIGlmICh0aGlzLm9uU3RhdGVDaGFuZ2UpIHtcbiAgICAgIHRoaXMub25TdGF0ZUNoYW5nZSh0aGlzLl9zdGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgLyogQ2FsbGJhY2sgdXRpbCAqL1xuICAvLyBmb3JtYXRzIG1hcCBzdGF0ZSBhbmQgaW52b2tlcyBjYWxsYmFjayBmdW5jdGlvblxuICB1cGRhdGVWaWV3cG9ydChuZXdNYXBTdGF0ZSwgZXh0cmFTdGF0ZSA9IHt9KSB7XG4gICAgY29uc3Qgb2xkVmlld3BvcnQgPSB0aGlzLm1hcFN0YXRlLmdldFZpZXdwb3J0UHJvcHMoKTtcbiAgICBjb25zdCBuZXdWaWV3cG9ydCA9IG5ld01hcFN0YXRlLmdldFZpZXdwb3J0UHJvcHMoKTtcblxuICAgIGlmICh0aGlzLm9uVmlld3BvcnRDaGFuZ2UgJiZcbiAgICAgIE9iamVjdC5rZXlzKG5ld1ZpZXdwb3J0KS5zb21lKGtleSA9PiBvbGRWaWV3cG9ydFtrZXldICE9PSBuZXdWaWV3cG9ydFtrZXldKSkge1xuICAgICAgLy8gVmlld3BvcnQgaGFzIGNoYW5nZWRcbiAgICAgIHRoaXMub25WaWV3cG9ydENoYW5nZShuZXdWaWV3cG9ydCk7XG4gICAgfVxuXG4gICAgdGhpcy5zZXRTdGF0ZShPYmplY3QuYXNzaWduKHt9LCBuZXdNYXBTdGF0ZS5nZXRJbnRlcmFjdGl2ZVN0YXRlKCksIGV4dHJhU3RhdGUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IGludGVyYWN0aXZpdHkgb3B0aW9uc1xuICAgKi9cbiAgc2V0T3B0aW9ucyhvcHRpb25zKSB7XG4gICAgY29uc3Qge1xuICAgICAgLy8gVE9ETyhkZXByZWNhdGUpOiByZW1vdmUgdGhpcyB3aGVuIGBvbkNoYW5nZVZpZXdwb3J0YCBnZXRzIGRlcHJlY2F0ZWRcbiAgICAgIG9uQ2hhbmdlVmlld3BvcnQsXG4gICAgICBvblZpZXdwb3J0Q2hhbmdlLFxuICAgICAgb25TdGF0ZUNoYW5nZSA9IHRoaXMub25TdGF0ZUNoYW5nZSxcbiAgICAgIGV2ZW50TWFuYWdlciA9IHRoaXMuZXZlbnRNYW5hZ2VyLFxuICAgICAgc2Nyb2xsWm9vbSA9IHRydWUsXG4gICAgICBkcmFnUGFuID0gdHJ1ZSxcbiAgICAgIGRyYWdSb3RhdGUgPSB0cnVlLFxuICAgICAgZG91YmxlQ2xpY2tab29tID0gdHJ1ZSxcbiAgICAgIHRvdWNoWm9vbVJvdGF0ZSA9IHRydWVcbiAgICB9ID0gb3B0aW9ucztcblxuICAgIC8vIFRPRE8oZGVwcmVjYXRlKTogcmVtb3ZlIHRoaXMgY2hlY2sgd2hlbiBgb25DaGFuZ2VWaWV3cG9ydGAgZ2V0cyBkZXByZWNhdGVkXG4gICAgdGhpcy5vblZpZXdwb3J0Q2hhbmdlID0gb25WaWV3cG9ydENoYW5nZSB8fCBvbkNoYW5nZVZpZXdwb3J0O1xuICAgIHRoaXMub25TdGF0ZUNoYW5nZSA9IG9uU3RhdGVDaGFuZ2U7XG4gICAgdGhpcy5tYXBTdGF0ZVByb3BzID0gb3B0aW9ucztcbiAgICBpZiAodGhpcy5ldmVudE1hbmFnZXIgIT09IGV2ZW50TWFuYWdlcikge1xuICAgICAgLy8gRXZlbnRNYW5hZ2VyIGhhcyBjaGFuZ2VkXG4gICAgICB0aGlzLmV2ZW50TWFuYWdlciA9IGV2ZW50TWFuYWdlcjtcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIH1cblxuICAgIC8vIFJlZ2lzdGVyL3VucmVnaXN0ZXIgZXZlbnRzXG4gICAgdGhpcy50b2dnbGVFdmVudHMoRVZFTlRfVFlQRVMuV0hFRUwsIHNjcm9sbFpvb20pO1xuICAgIHRoaXMudG9nZ2xlRXZlbnRzKEVWRU5UX1RZUEVTLlBBTiwgZHJhZ1BhbiB8fCBkcmFnUm90YXRlKTtcbiAgICB0aGlzLnRvZ2dsZUV2ZW50cyhFVkVOVF9UWVBFUy5QSU5DSCwgdG91Y2hab29tUm90YXRlKTtcbiAgICB0aGlzLnRvZ2dsZUV2ZW50cyhFVkVOVF9UWVBFUy5ET1VCTEVfVEFQLCBkb3VibGVDbGlja1pvb20pO1xuXG4gICAgLy8gSW50ZXJhY3Rpb24gdG9nZ2xlc1xuICAgIHRoaXMuc2Nyb2xsWm9vbSA9IHNjcm9sbFpvb207XG4gICAgdGhpcy5kcmFnUGFuID0gZHJhZ1BhbjtcbiAgICB0aGlzLmRyYWdSb3RhdGUgPSBkcmFnUm90YXRlO1xuICAgIHRoaXMuZG91YmxlQ2xpY2tab29tID0gZG91YmxlQ2xpY2tab29tO1xuICAgIHRoaXMudG91Y2hab29tUm90YXRlID0gdG91Y2hab29tUm90YXRlO1xuICB9XG5cbiAgdG9nZ2xlRXZlbnRzKGV2ZW50TmFtZXMsIGVuYWJsZWQpIHtcbiAgICBpZiAodGhpcy5ldmVudE1hbmFnZXIpIHtcbiAgICAgIGV2ZW50TmFtZXMuZm9yRWFjaChldmVudE5hbWUgPT4ge1xuICAgICAgICBpZiAodGhpcy5fZXZlbnRzW2V2ZW50TmFtZV0gIT09IGVuYWJsZWQpIHtcbiAgICAgICAgICB0aGlzLl9ldmVudHNbZXZlbnROYW1lXSA9IGVuYWJsZWQ7XG4gICAgICAgICAgaWYgKGVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRNYW5hZ2VyLm9uKGV2ZW50TmFtZSwgdGhpcy5oYW5kbGVFdmVudCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRNYW5hZ2VyLm9mZihldmVudE5hbWUsIHRoaXMuaGFuZGxlRXZlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyogRXZlbnQgaGFuZGxlcnMgKi9cbiAgLy8gRGVmYXVsdCBoYW5kbGVyIGZvciB0aGUgYHBhbnN0YXJ0YCBldmVudC5cbiAgX29uUGFuU3RhcnQoZXZlbnQpIHtcbiAgICBjb25zdCBwb3MgPSB0aGlzLmdldENlbnRlcihldmVudCk7XG4gICAgY29uc3QgbmV3TWFwU3RhdGUgPSB0aGlzLm1hcFN0YXRlLnBhblN0YXJ0KHtwb3N9KS5yb3RhdGVTdGFydCh7cG9zfSk7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlVmlld3BvcnQobmV3TWFwU3RhdGUsIHtpc0RyYWdnaW5nOiB0cnVlfSk7XG4gIH1cblxuICAvLyBEZWZhdWx0IGhhbmRsZXIgZm9yIHRoZSBgcGFubW92ZWAgZXZlbnQuXG4gIF9vblBhbihldmVudCkge1xuICAgIHJldHVybiB0aGlzLmlzRnVuY3Rpb25LZXlQcmVzc2VkKGV2ZW50KSA/IHRoaXMuX29uUGFuUm90YXRlKGV2ZW50KSA6IHRoaXMuX29uUGFuTW92ZShldmVudCk7XG4gIH1cblxuICAvLyBEZWZhdWx0IGhhbmRsZXIgZm9yIHRoZSBgcGFuZW5kYCBldmVudC5cbiAgX29uUGFuRW5kKGV2ZW50KSB7XG4gICAgY29uc3QgbmV3TWFwU3RhdGUgPSB0aGlzLm1hcFN0YXRlLnBhbkVuZCgpLnJvdGF0ZUVuZCgpO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZVZpZXdwb3J0KG5ld01hcFN0YXRlLCB7aXNEcmFnZ2luZzogZmFsc2V9KTtcbiAgfVxuXG4gIC8vIERlZmF1bHQgaGFuZGxlciBmb3IgcGFubmluZyB0byBtb3ZlLlxuICAvLyBDYWxsZWQgYnkgYF9vblBhbmAgd2hlbiBwYW5uaW5nIHdpdGhvdXQgZnVuY3Rpb24ga2V5IHByZXNzZWQuXG4gIF9vblBhbk1vdmUoZXZlbnQpIHtcbiAgICBpZiAoIXRoaXMuZHJhZ1Bhbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBwb3MgPSB0aGlzLmdldENlbnRlcihldmVudCk7XG4gICAgY29uc3QgbmV3TWFwU3RhdGUgPSB0aGlzLm1hcFN0YXRlLnBhbih7cG9zfSk7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlVmlld3BvcnQobmV3TWFwU3RhdGUpO1xuICB9XG5cbiAgLy8gRGVmYXVsdCBoYW5kbGVyIGZvciBwYW5uaW5nIHRvIHJvdGF0ZS5cbiAgLy8gQ2FsbGVkIGJ5IGBfb25QYW5gIHdoZW4gcGFubmluZyB3aXRoIGZ1bmN0aW9uIGtleSBwcmVzc2VkLlxuICBfb25QYW5Sb3RhdGUoZXZlbnQpIHtcbiAgICBpZiAoIXRoaXMuZHJhZ1JvdGF0ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHtkZWx0YVgsIGRlbHRhWX0gPSBldmVudDtcbiAgICBjb25zdCBbLCBjZW50ZXJZXSA9IHRoaXMuZ2V0Q2VudGVyKGV2ZW50KTtcbiAgICBjb25zdCBzdGFydFkgPSBjZW50ZXJZIC0gZGVsdGFZO1xuICAgIGNvbnN0IHt3aWR0aCwgaGVpZ2h0fSA9IHRoaXMubWFwU3RhdGUuZ2V0Vmlld3BvcnRQcm9wcygpO1xuXG4gICAgY29uc3QgZGVsdGFTY2FsZVggPSBkZWx0YVggLyB3aWR0aDtcbiAgICBsZXQgZGVsdGFTY2FsZVkgPSAwO1xuXG4gICAgaWYgKGRlbHRhWSA+IDApIHtcbiAgICAgIGlmIChNYXRoLmFicyhoZWlnaHQgLSBzdGFydFkpID4gUElUQ0hfTU9VU0VfVEhSRVNIT0xEKSB7XG4gICAgICAgIC8vIE1vdmUgZnJvbSAwIHRvIC0xIGFzIHdlIGRyYWcgdXB3YXJkc1xuICAgICAgICBkZWx0YVNjYWxlWSA9IGRlbHRhWSAvIChzdGFydFkgLSBoZWlnaHQpICogUElUQ0hfQUNDRUw7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChkZWx0YVkgPCAwKSB7XG4gICAgICBpZiAoc3RhcnRZID4gUElUQ0hfTU9VU0VfVEhSRVNIT0xEKSB7XG4gICAgICAgIC8vIE1vdmUgZnJvbSAwIHRvIDEgYXMgd2UgZHJhZyB1cHdhcmRzXG4gICAgICAgIGRlbHRhU2NhbGVZID0gMSAtIGNlbnRlclkgLyBzdGFydFk7XG4gICAgICB9XG4gICAgfVxuICAgIGRlbHRhU2NhbGVZID0gTWF0aC5taW4oMSwgTWF0aC5tYXgoLTEsIGRlbHRhU2NhbGVZKSk7XG5cbiAgICBjb25zdCBuZXdNYXBTdGF0ZSA9IHRoaXMubWFwU3RhdGUucm90YXRlKHtkZWx0YVNjYWxlWCwgZGVsdGFTY2FsZVl9KTtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVWaWV3cG9ydChuZXdNYXBTdGF0ZSk7XG4gIH1cblxuICAvLyBEZWZhdWx0IGhhbmRsZXIgZm9yIHRoZSBgd2hlZWxgIGV2ZW50LlxuICBfb25XaGVlbChldmVudCkge1xuICAgIGlmICghdGhpcy5zY3JvbGxab29tKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgcG9zID0gdGhpcy5nZXRDZW50ZXIoZXZlbnQpO1xuICAgIGNvbnN0IHtkZWx0YX0gPSBldmVudDtcblxuICAgIC8vIE1hcCB3aGVlbCBkZWx0YSB0byByZWxhdGl2ZSBzY2FsZVxuICAgIGxldCBzY2FsZSA9IDIgLyAoMSArIE1hdGguZXhwKC1NYXRoLmFicyhkZWx0YSAqIFpPT01fQUNDRUwpKSk7XG4gICAgaWYgKGRlbHRhIDwgMCAmJiBzY2FsZSAhPT0gMCkge1xuICAgICAgc2NhbGUgPSAxIC8gc2NhbGU7XG4gICAgfVxuXG4gICAgY29uc3QgbmV3TWFwU3RhdGUgPSB0aGlzLm1hcFN0YXRlLnpvb20oe3Bvcywgc2NhbGV9KTtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVWaWV3cG9ydChuZXdNYXBTdGF0ZSk7XG4gIH1cblxuICAvLyBEZWZhdWx0IGhhbmRsZXIgZm9yIHRoZSBgcGluY2hzdGFydGAgZXZlbnQuXG4gIF9vblBpbmNoU3RhcnQoZXZlbnQpIHtcbiAgICBjb25zdCBwb3MgPSB0aGlzLmdldENlbnRlcihldmVudCk7XG4gICAgY29uc3QgbmV3TWFwU3RhdGUgPSB0aGlzLm1hcFN0YXRlLnpvb21TdGFydCh7cG9zfSk7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlVmlld3BvcnQobmV3TWFwU3RhdGUsIHtpc0RyYWdnaW5nOiB0cnVlfSk7XG4gIH1cblxuICAvLyBEZWZhdWx0IGhhbmRsZXIgZm9yIHRoZSBgcGluY2hgIGV2ZW50LlxuICBfb25QaW5jaChldmVudCkge1xuICAgIGlmICghdGhpcy50b3VjaFpvb21Sb3RhdGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgcG9zID0gdGhpcy5nZXRDZW50ZXIoZXZlbnQpO1xuICAgIGNvbnN0IHtzY2FsZX0gPSBldmVudDtcbiAgICBjb25zdCBuZXdNYXBTdGF0ZSA9IHRoaXMubWFwU3RhdGUuem9vbSh7cG9zLCBzY2FsZX0pO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZVZpZXdwb3J0KG5ld01hcFN0YXRlKTtcbiAgfVxuXG4gIC8vIERlZmF1bHQgaGFuZGxlciBmb3IgdGhlIGBwaW5jaGVuZGAgZXZlbnQuXG4gIF9vblBpbmNoRW5kKGV2ZW50KSB7XG4gICAgY29uc3QgbmV3TWFwU3RhdGUgPSB0aGlzLm1hcFN0YXRlLnpvb21FbmQoKTtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVWaWV3cG9ydChuZXdNYXBTdGF0ZSwge2lzRHJhZ2dpbmc6IGZhbHNlfSk7XG4gIH1cblxuICAvLyBEZWZhdWx0IGhhbmRsZXIgZm9yIHRoZSBgZG91YmxldGFwYCBldmVudC5cbiAgX29uRG91YmxlVGFwKGV2ZW50KSB7XG4gICAgaWYgKCF0aGlzLmRvdWJsZUNsaWNrWm9vbSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBwb3MgPSB0aGlzLmdldENlbnRlcihldmVudCk7XG4gICAgY29uc3QgaXNab29tT3V0ID0gdGhpcy5pc0Z1bmN0aW9uS2V5UHJlc3NlZChldmVudCk7XG5cbiAgICBjb25zdCBuZXdNYXBTdGF0ZSA9IHRoaXMubWFwU3RhdGUuem9vbSh7cG9zLCBzY2FsZTogaXNab29tT3V0ID8gMC41IDogMn0pO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZVZpZXdwb3J0KG5ld01hcFN0YXRlKTtcbiAgfVxufVxuIl19