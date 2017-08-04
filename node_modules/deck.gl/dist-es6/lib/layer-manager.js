var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

import assert from 'assert';
import { Framebuffer, ShaderCache } from 'luma.gl';
import seer from 'seer';
import Layer from './layer';
import { log } from './utils';
import { flatten } from './utils/flatten';
import { drawLayers as _drawLayers, pickLayers, queryLayers } from './draw-and-pick';
import { LIFECYCLE } from './constants';
import { Viewport } from './viewports';
import { setPropOverrides, layerEditListener, seerInitListener, initLayerInSeer, updateLayerInSeer } from '../debug/seer-integration';

var LOG_PRIORITY_LIFECYCLE = 2;
var LOG_PRIORITY_LIFECYCLE_MINOR = 4;

var LayerManager = function () {
  function LayerManager(_ref) {
    var gl = _ref.gl;

    _classCallCheck(this, LayerManager);

    /* Currently deck.gl expects the DeckGL.layers to be different
     whenever React rerenders. If the same layers array is used, the
     LayerManager's diffing algorithm will generate a fatal error and
     break the rendering.
      `this.lastRenderedLayers` stores the UNFILTERED layers sent
     down to LayerManager, so that `layers` reference can be compared.
     If it's the same across two React render calls, the diffing logic
     will be skipped.
    */

    this.lastRenderedLayers = [];

    this.prevLayers = [];
    this.layers = [];
    this.oldContext = {};
    this.screenCleared = false;
    this._needsRedraw = true;

    this._eventManager = null;
    this._pickingRadius = 0;
    this._onLayerClick = null;
    this._onLayerHover = null;
    this._onClick = this._onClick.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);

    this._initSeer = this._initSeer.bind(this);
    this._editSeer = this._editSeer.bind(this);

    this.context = {
      gl: gl,
      uniforms: {},
      viewport: null,
      viewportChanged: true,
      pickingFBO: null,
      lastPickedInfo: {
        index: -1,
        layerId: null
      },
      shaderCache: new ShaderCache({ gl: gl })
    };

    seerInitListener(this._initSeer);
    layerEditListener(this._editSeer);

    Object.seal(this.context);
    Object.seal(this);
  }

  /**
   * Called upon Seer initialization, manually sends layers data.
   */


  _createClass(LayerManager, [{
    key: '_initSeer',
    value: function _initSeer() {
      this.layers.forEach(function (layer) {
        initLayerInSeer(layer);
        updateLayerInSeer(layer);
      });
    }

    /**
     * On Seer property edition, set override and update layers.
     */

  }, {
    key: '_editSeer',
    value: function _editSeer(payload) {
      if (payload.type !== 'edit' || payload.valuePath[0] !== 'props') {
        return;
      }

      setPropOverrides(payload.itemKey, payload.valuePath.slice(1), payload.value);
      var newLayers = this.layers.map(function (layer) {
        return new layer.constructor(layer.props);
      });
      this.updateLayers({ newLayers: newLayers });
    }

    /**
     * Method to call when the layer manager is not needed anymore.
     *
     * Currently used in the <DeckGL> componentWillUnmount lifecycle to unbind Seer listeners.
     */

  }, {
    key: 'finalize',
    value: function finalize() {
      seer.removeListener(this._initSeer);
      seer.removeListener(this._editSeer);
    }
  }, {
    key: 'setViewport',
    value: function setViewport(viewport) {
      assert(viewport instanceof Viewport, 'Invalid viewport');

      // TODO - viewport change detection breaks METER_OFFSETS mode
      // const oldViewport = this.context.viewport;
      // const viewportChanged = !oldViewport || !viewport.equals(oldViewport);

      this._needsRedraw = true;

      var viewportChanged = true;

      if (viewportChanged) {
        Object.assign(this.oldContext, this.context);
        this.context.viewport = viewport;
        this.context.viewportChanged = true;
        this.context.uniforms = {};
        log(4, viewport);
      }

      return this;
    }

    /**
     * @param {Object} eventManager   A source of DOM input events
     *                                with on()/off() methods for registration,
     *                                which will call handlers with
     *                                an Event object of the following shape:
     *                                {Object: {x, y}} offsetCenter: center of the event
     *                                {Object} srcEvent:             native JS Event object
     */

  }, {
    key: 'initEventHandling',
    value: function initEventHandling(eventManager) {
      this._eventManager = eventManager;

      // TODO: add/remove handlers on demand at runtime, not all at once on init.
      // Consider both top-level handlers like onLayerClick/Hover
      // and per-layer handlers attached to individual layers.
      // https://github.com/uber/deck.gl/issues/634
      this._eventManager.on({
        click: this._onClick,
        pointermove: this._onPointerMove
      });
    }

    /**
     * Set parameters for input event handling.
     * Parameters are to be passed as a single object, with the following shape:
     * @param {Number} pickingRadius    "Fuzziness" of picking (px), to support fat-fingering.
     * @param {Function} onLayerClick   A handler to be called when any layer is clicked.
     * @param {Function} onLayerHover   A handler to be called when any layer is hovered over.
     */

  }, {
    key: 'setEventHandlingParameters',
    value: function setEventHandlingParameters(_ref2) {
      var pickingRadius = _ref2.pickingRadius,
          onLayerClick = _ref2.onLayerClick,
          onLayerHover = _ref2.onLayerHover;

      if (!isNaN(pickingRadius)) {
        this._pickingRadius = pickingRadius;
      }
      if (typeof onLayerClick !== 'undefined') {
        this._onLayerClick = onLayerClick;
      }
      if (typeof onLayerHover !== 'undefined') {
        this._onLayerHover = onLayerHover;
      }
      this._validateEventHandling();
    }
  }, {
    key: 'updateLayers',
    value: function updateLayers(_ref3) {
      var newLayers = _ref3.newLayers;

      // TODO - something is generating state updates that cause rerender of the same
      if (newLayers === this.lastRenderedLayers) {
        log.log(3, 'Ignoring layer update due to layer array not changed');
        return this;
      }
      this.lastRenderedLayers = newLayers;

      assert(this.context.viewport, 'LayerManager.updateLayers: viewport not set');

      // Filter out any null layers
      newLayers = newLayers.filter(function (newLayer) {
        return newLayer !== null;
      });

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = newLayers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var layer = _step.value;

          layer.context = this.context;
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

      this.prevLayers = this.layers;

      var _updateLayers2 = this._updateLayers({
        oldLayers: this.prevLayers,
        newLayers: newLayers
      }),
          error = _updateLayers2.error,
          generatedLayers = _updateLayers2.generatedLayers;

      this.layers = generatedLayers;
      // Throw first error found, if any
      if (error) {
        throw error;
      }
      return this;
    }
  }, {
    key: 'drawLayers',
    value: function drawLayers(_ref4) {
      var pass = _ref4.pass;

      assert(this.context.viewport, 'LayerManager.drawLayers: viewport not set');

      _drawLayers({ layers: this.layers, pass: pass });

      return this;
    }

    // Pick the closest info at given coordinate

  }, {
    key: 'pickLayer',
    value: function pickLayer(_ref5) {
      var x = _ref5.x,
          y = _ref5.y,
          mode = _ref5.mode,
          _ref5$radius = _ref5.radius,
          radius = _ref5$radius === undefined ? 0 : _ref5$radius,
          layerIds = _ref5.layerIds;
      var gl = this.context.gl;

      var layers = layerIds ? this.layers.filter(function (layer) {
        return layerIds.indexOf(layer.id) >= 0;
      }) : this.layers;

      return pickLayers(gl, {
        x: x,
        y: y,
        radius: radius,
        layers: layers,
        mode: mode,
        viewport: this.context.viewport,
        pickingFBO: this._getPickingBuffer(),
        lastPickedInfo: this.context.lastPickedInfo
      });
    }

    // Get all unique infos within a bounding box

  }, {
    key: 'queryLayer',
    value: function queryLayer(_ref6) {
      var x = _ref6.x,
          y = _ref6.y,
          width = _ref6.width,
          height = _ref6.height,
          layerIds = _ref6.layerIds;
      var gl = this.context.gl;

      var layers = layerIds ? this.layers.filter(function (layer) {
        return layerIds.indexOf(layer.id) >= 0;
      }) : this.layers;

      return queryLayers(gl, {
        x: x,
        y: y,
        width: width,
        height: height,
        layers: layers,
        mode: 'query',
        viewport: this.context.viewport,
        pickingFBO: this._getPickingBuffer()
      });
    }
  }, {
    key: 'needsRedraw',
    value: function needsRedraw() {
      var _ref7 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref7$clearRedrawFlag = _ref7.clearRedrawFlags,
          clearRedrawFlags = _ref7$clearRedrawFlag === undefined ? false : _ref7$clearRedrawFlag;

      if (!this.context.viewport) {
        return false;
      }

      var redraw = this._needsRedraw;
      if (clearRedrawFlags) {
        this._needsRedraw = false;
      }

      // Make sure that buffer is cleared once when layer list becomes empty
      if (this.layers.length === 0) {
        if (this.screenCleared === false) {
          redraw = true;
          this.screenCleared = true;
          return true;
        }
      } else if (this.screenCleared === true) {
        this.screenCleared = false;
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.layers[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var layer = _step2.value;

          redraw = redraw || layer.getNeedsRedraw({ clearRedrawFlags: clearRedrawFlags });
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

      return redraw;
    }

    //
    // PRIVATE METHODS
    //

  }, {
    key: '_getPickingBuffer',
    value: function _getPickingBuffer() {
      var gl = this.context.gl;

      // Create a frame buffer if not already available

      this.context.pickingFBO = this.context.pickingFBO || new Framebuffer(gl, {
        width: gl.canvas.width,
        height: gl.canvas.height
      });

      // Resize it to current canvas size (this is a noop if size hasn't changed)
      this.context.pickingFBO.resize({
        width: gl.canvas.width,
        height: gl.canvas.height
      });

      return this.context.pickingFBO;
    }

    // Match all layers, checking for caught errors
    // To avoid having an exception in one layer disrupt other layers

  }, {
    key: '_updateLayers',
    value: function _updateLayers(_ref8) {
      var oldLayers = _ref8.oldLayers,
          newLayers = _ref8.newLayers;

      // Create old layer map
      var oldLayerMap = {};
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = oldLayers[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var oldLayer = _step3.value;

          if (oldLayerMap[oldLayer.id]) {
            log.once(0, 'Multiple old layers with same id ' + layerName(oldLayer));
          } else {
            oldLayerMap[oldLayer.id] = oldLayer;
            oldLayer.lifecycle = LIFECYCLE.AWAITING_FINALIZATION;
          }
        }

        // Allocate array for generated layers
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

      var generatedLayers = [];

      // Match sublayers
      var error = this._matchSublayers({
        newLayers: newLayers, oldLayerMap: oldLayerMap, generatedLayers: generatedLayers
      });

      var error2 = this._finalizeOldLayers(oldLayers);
      var firstError = error || error2;
      return { error: firstError, generatedLayers: generatedLayers };
    }

    /* eslint-disable max-statements */

  }, {
    key: '_matchSublayers',
    value: function _matchSublayers(_ref9) {
      var _this = this;

      var newLayers = _ref9.newLayers,
          oldLayerMap = _ref9.oldLayerMap,
          generatedLayers = _ref9.generatedLayers;

      // Filter out any null layers
      newLayers = newLayers.filter(function (newLayer) {
        return newLayer !== null;
      });

      var error = null;
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        var _loop = function _loop() {
          var newLayer = _step4.value;

          newLayer.context = _this.context;

          try {
            // 1. given a new coming layer, find its matching layer
            var oldLayer = oldLayerMap[newLayer.id];
            oldLayerMap[newLayer.id] = null;

            if (oldLayer === null) {
              log.once(0, 'Multiple new layers with same id ' + layerName(newLayer));
            }

            // Only transfer state at this stage. We must not generate exceptions
            // until all layers' state have been transferred
            if (oldLayer) {
              _this._transferLayerState(oldLayer, newLayer);
              _this._updateLayer(newLayer);

              updateLayerInSeer(newLayer); // Initializes layer in seer chrome extension (if connected)
            } else {
              _this._initializeNewLayer(newLayer);

              initLayerInSeer(newLayer); // Initializes layer in seer chrome extension (if connected)
            }
            generatedLayers.push(newLayer);

            // Call layer lifecycle method: render sublayers
            var props = newLayer.props,
                oldProps = newLayer.oldProps;

            var sublayers = newLayer.isComposite ? newLayer._renderLayers({
              oldProps: oldProps,
              props: props,
              context: _this.context,
              oldContext: _this.oldContext,
              changeFlags: newLayer.diffProps(oldProps, props, _this.context)
            }) : null;
            // End layer lifecycle method: render sublayers

            if (sublayers) {
              // Flatten the returned array, removing any null, undefined or false
              // this allows layers to render sublayers conditionally
              // (see CompositeLayer.renderLayers docs)
              sublayers = flatten(sublayers, { filter: Boolean });

              // populate reference to parent layer
              sublayers.forEach(function (layer) {
                layer.parentLayer = newLayer;
              });

              _this._matchSublayers({
                newLayers: sublayers,
                oldLayerMap: oldLayerMap,
                generatedLayers: generatedLayers
              });
            }
          } catch (err) {
            log.once(0, 'deck.gl error during matching of ' + layerName(newLayer) + ' ' + err, err);
            // Save first error
            error = error || err;
          }
        };

        for (var _iterator4 = newLayers[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          _loop();
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

      return error;
    }
  }, {
    key: '_transferLayerState',
    value: function _transferLayerState(oldLayer, newLayer) {
      var state = oldLayer.state,
          props = oldLayer.props;

      // sanity check

      assert(state, 'deck.gl sanity check - Matching layer has no state');
      if (newLayer !== oldLayer) {
        log(LOG_PRIORITY_LIFECYCLE_MINOR, 'matched ' + layerName(newLayer), oldLayer, '->', newLayer);

        // Move state
        state.layer = newLayer;
        newLayer.state = state;

        // Update model layer reference
        if (state.model) {
          state.model.userData.layer = newLayer;
        }
        // Keep a temporary ref to the old props, for prop comparison
        newLayer.oldProps = props;
        // oldLayer.state = null;

        newLayer.lifecycle = LIFECYCLE.MATCHED;
        oldLayer.lifecycle = LIFECYCLE.AWAITING_GC;
      } else {
        log.log(LOG_PRIORITY_LIFECYCLE_MINOR, 'Matching layer is unchanged ' + newLayer.id);
        newLayer.lifecycle = LIFECYCLE.MATCHED;
        newLayer.oldProps = newLayer.props;
        // TODO - we could avoid prop comparisons in this case
      }
    }

    // Update the old layers that were not matched

  }, {
    key: '_finalizeOldLayers',
    value: function _finalizeOldLayers(oldLayers) {
      var error = null;
      // Matched layers have lifecycle state "outdated"
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = oldLayers[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var layer = _step5.value;

          if (layer.lifecycle === LIFECYCLE.AWAITING_FINALIZATION) {
            error = error || this._finalizeLayer(layer);
          }
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

      return error;
    }

    // Initializes a single layer, calling layer methods

  }, {
    key: '_initializeNewLayer',
    value: function _initializeNewLayer(layer) {
      var error = null;
      // Check if new layer, and initialize it's state
      if (!layer.state) {
        log(LOG_PRIORITY_LIFECYCLE, 'initializing ' + layerName(layer));
        try {

          layer.initializeLayer({
            oldProps: {},
            props: layer.props,
            oldContext: this.oldContext,
            context: this.context,
            changeFlags: layer.diffProps({}, layer.props, this.context)
          });

          layer.lifecycle = LIFECYCLE.INITIALIZED;
        } catch (err) {
          log.once(0, 'deck.gl error during initialization of ' + layerName(layer) + ' ' + err, err);
          // Save first error
          error = error || err;
        }
        // Set back pointer (used in picking)
        if (layer.state) {
          layer.state.layer = layer;
          // Save layer on model for picking purposes
          // TODO - store on model.userData rather than directly on model
        }
        if (layer.state && layer.state.model) {
          layer.state.model.userData.layer = layer;
        }
      }
      return error;
    }

    // Updates a single layer, calling layer methods

  }, {
    key: '_updateLayer',
    value: function _updateLayer(layer) {
      var oldProps = layer.oldProps,
          props = layer.props;

      var error = null;
      if (oldProps) {
        try {
          layer.updateLayer({
            oldProps: oldProps,
            props: props,
            context: this.context,
            oldContext: this.oldContext,
            changeFlags: layer.diffProps(oldProps, layer.props, this.context)
          });
        } catch (err) {
          log.once(0, 'deck.gl error during update of ' + layerName(layer), err);
          // Save first error
          error = err;
        }
        log(LOG_PRIORITY_LIFECYCLE_MINOR, 'updating ' + layerName(layer));
      }
      return error;
    }

    // Finalizes a single layer

  }, {
    key: '_finalizeLayer',
    value: function _finalizeLayer(layer) {
      var error = null;
      var state = layer.state;

      if (state) {
        try {
          layer.finalizeLayer();
        } catch (err) {
          log.once(0, 'deck.gl error during finalization of ' + layerName(layer), err);
          // Save first error
          error = err;
        }
        // layer.state = null;
        layer.lifecycle = LIFECYCLE.FINALIZED;
        log(LOG_PRIORITY_LIFECYCLE, 'finalizing ' + layerName(layer));
      }
      return error;
    }

    /**
     * Warn if a deck-level mouse event has been specified,
     * but no layers are `pickable`.
     */

  }, {
    key: '_validateEventHandling',
    value: function _validateEventHandling() {
      if (this.onLayerClick || this.onLayerHover) {
        if (this.layers.length && !this.layers.some(function (layer) {
          return layer.props.pickable;
        })) {
          log.once(1, 'You have supplied a top-level input event handler (e.g. `onLayerClick`), ' + 'but none of your layers have set the `pickable` flag.');
        }
      }
    }

    /**
     * Route click events to layers.
     * `pickLayer` will call the `onClick` prop of any picked layer,
     * and `onLayerClick` is called directly from here
     * with any picking info generated by `pickLayer`.
     * @param {Object} event  An object encapsulating an input event,
     *                        with the following shape:
     *                        {Object: {x, y}} offsetCenter: center of the event
     *                        {Object} srcEvent:             native JS Event object
     */

  }, {
    key: '_onClick',
    value: function _onClick(event) {
      var pos = event.offsetCenter;
      if (!pos) {
        return;
      }
      var selectedInfos = this.pickLayer({
        x: pos.x,
        y: pos.y,
        radius: this._pickingRadius,
        mode: 'click'
      });
      if (selectedInfos.length) {
        var firstInfo = selectedInfos.find(function (info) {
          return info.index >= 0;
        });
        if (this._onLayerClick) {
          this._onLayerClick(firstInfo, selectedInfos, event.srcEvent);
        }
      }
    }

    /**
     * Route click events to layers.
     * `pickLayer` will call the `onHover` prop of any picked layer,
     * and `onLayerHover` is called directly from here
     * with any picking info generated by `pickLayer`.
     * @param {Object} event  An object encapsulating an input event,
     *                        with the following shape:
     *                        {Object: {x, y}} offsetCenter: center of the event
     *                        {Object} srcEvent:             native JS Event object
     */

  }, {
    key: '_onPointerMove',
    value: function _onPointerMove(event) {
      if (event.isDown) {
        // Do not trigger onHover callbacks if mouse button is down
        return;
      }
      var pos = event.offsetCenter;
      // TODO: consider using this.eventManager.element size instead of layerManager.context
      // but do so in a way that doesn't cause reflow (e.g. `offsetWidth/Height`).
      // maybe the event object offers offsetCenter as a 0<>1 value as well?
      // since it's already doing size calculations...
      var _context$viewport = this.context.viewport,
          width = _context$viewport.width,
          height = _context$viewport.height;

      if (!pos || pos.x < 0 || pos.y < 0 || pos.x > width || pos.y > height) {
        // Check if pointer is inside the canvas
        return;
      }
      var selectedInfos = this.pickLayer({
        x: pos.x,
        y: pos.y,
        radius: this._pickingRadius,
        mode: 'hover'
      });
      if (selectedInfos.length) {
        var firstInfo = selectedInfos.find(function (info) {
          return info.index >= 0;
        });
        if (this._onLayerHover) {
          this._onLayerHover(firstInfo, selectedInfos, event.srcEvent);
        }
      }
    }
  }]);

  return LayerManager;
}();

export default LayerManager;


function layerName(layer) {
  if (layer instanceof Layer) {
    return '' + layer;
  }
  return !layer ? 'null layer' : 'invalid layer';
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvbGF5ZXItbWFuYWdlci5qcyJdLCJuYW1lcyI6WyJhc3NlcnQiLCJGcmFtZWJ1ZmZlciIsIlNoYWRlckNhY2hlIiwic2VlciIsIkxheWVyIiwibG9nIiwiZmxhdHRlbiIsImRyYXdMYXllcnMiLCJwaWNrTGF5ZXJzIiwicXVlcnlMYXllcnMiLCJMSUZFQ1lDTEUiLCJWaWV3cG9ydCIsInNldFByb3BPdmVycmlkZXMiLCJsYXllckVkaXRMaXN0ZW5lciIsInNlZXJJbml0TGlzdGVuZXIiLCJpbml0TGF5ZXJJblNlZXIiLCJ1cGRhdGVMYXllckluU2VlciIsIkxPR19QUklPUklUWV9MSUZFQ1lDTEUiLCJMT0dfUFJJT1JJVFlfTElGRUNZQ0xFX01JTk9SIiwiTGF5ZXJNYW5hZ2VyIiwiZ2wiLCJsYXN0UmVuZGVyZWRMYXllcnMiLCJwcmV2TGF5ZXJzIiwibGF5ZXJzIiwib2xkQ29udGV4dCIsInNjcmVlbkNsZWFyZWQiLCJfbmVlZHNSZWRyYXciLCJfZXZlbnRNYW5hZ2VyIiwiX3BpY2tpbmdSYWRpdXMiLCJfb25MYXllckNsaWNrIiwiX29uTGF5ZXJIb3ZlciIsIl9vbkNsaWNrIiwiYmluZCIsIl9vblBvaW50ZXJNb3ZlIiwiX2luaXRTZWVyIiwiX2VkaXRTZWVyIiwiY29udGV4dCIsInVuaWZvcm1zIiwidmlld3BvcnQiLCJ2aWV3cG9ydENoYW5nZWQiLCJwaWNraW5nRkJPIiwibGFzdFBpY2tlZEluZm8iLCJpbmRleCIsImxheWVySWQiLCJzaGFkZXJDYWNoZSIsIk9iamVjdCIsInNlYWwiLCJmb3JFYWNoIiwibGF5ZXIiLCJwYXlsb2FkIiwidHlwZSIsInZhbHVlUGF0aCIsIml0ZW1LZXkiLCJzbGljZSIsInZhbHVlIiwibmV3TGF5ZXJzIiwibWFwIiwiY29uc3RydWN0b3IiLCJwcm9wcyIsInVwZGF0ZUxheWVycyIsInJlbW92ZUxpc3RlbmVyIiwiYXNzaWduIiwiZXZlbnRNYW5hZ2VyIiwib24iLCJjbGljayIsInBvaW50ZXJtb3ZlIiwicGlja2luZ1JhZGl1cyIsIm9uTGF5ZXJDbGljayIsIm9uTGF5ZXJIb3ZlciIsImlzTmFOIiwiX3ZhbGlkYXRlRXZlbnRIYW5kbGluZyIsImZpbHRlciIsIm5ld0xheWVyIiwiX3VwZGF0ZUxheWVycyIsIm9sZExheWVycyIsImVycm9yIiwiZ2VuZXJhdGVkTGF5ZXJzIiwicGFzcyIsIngiLCJ5IiwibW9kZSIsInJhZGl1cyIsImxheWVySWRzIiwiaW5kZXhPZiIsImlkIiwiX2dldFBpY2tpbmdCdWZmZXIiLCJ3aWR0aCIsImhlaWdodCIsImNsZWFyUmVkcmF3RmxhZ3MiLCJyZWRyYXciLCJsZW5ndGgiLCJnZXROZWVkc1JlZHJhdyIsImNhbnZhcyIsInJlc2l6ZSIsIm9sZExheWVyTWFwIiwib2xkTGF5ZXIiLCJvbmNlIiwibGF5ZXJOYW1lIiwibGlmZWN5Y2xlIiwiQVdBSVRJTkdfRklOQUxJWkFUSU9OIiwiX21hdGNoU3VibGF5ZXJzIiwiZXJyb3IyIiwiX2ZpbmFsaXplT2xkTGF5ZXJzIiwiZmlyc3RFcnJvciIsIl90cmFuc2ZlckxheWVyU3RhdGUiLCJfdXBkYXRlTGF5ZXIiLCJfaW5pdGlhbGl6ZU5ld0xheWVyIiwicHVzaCIsIm9sZFByb3BzIiwic3VibGF5ZXJzIiwiaXNDb21wb3NpdGUiLCJfcmVuZGVyTGF5ZXJzIiwiY2hhbmdlRmxhZ3MiLCJkaWZmUHJvcHMiLCJCb29sZWFuIiwicGFyZW50TGF5ZXIiLCJlcnIiLCJzdGF0ZSIsIm1vZGVsIiwidXNlckRhdGEiLCJNQVRDSEVEIiwiQVdBSVRJTkdfR0MiLCJfZmluYWxpemVMYXllciIsImluaXRpYWxpemVMYXllciIsIklOSVRJQUxJWkVEIiwidXBkYXRlTGF5ZXIiLCJmaW5hbGl6ZUxheWVyIiwiRklOQUxJWkVEIiwic29tZSIsInBpY2thYmxlIiwiZXZlbnQiLCJwb3MiLCJvZmZzZXRDZW50ZXIiLCJzZWxlY3RlZEluZm9zIiwicGlja0xheWVyIiwiZmlyc3RJbmZvIiwiZmluZCIsImluZm8iLCJzcmNFdmVudCIsImlzRG93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QUdxRCxJQUFJckQsQ0FENEI7QUFFbkNDLFdBQUdvRCxJQUFJcEQsQ0FGNEI7QUFHbkNFLGdCQUFRLEtBQUtyRCxjQUhzQjtBQUluQ29ELGNBQU07QUFKNkIsT0FBZixDQUF0QjtBQU1BLFVBQUlxRCxjQUFjM0MsTUFBbEIsRUFBMEI7QUFDeEIsWUFBTTZDLFlBQVlGLGNBQWNHLElBQWQsQ0FBbUI7QUFBQSxpQkFBUUMsS0FBSy9GLEtBQUwsSUFBYyxDQUF0QjtBQUFBLFNBQW5CLENBQWxCO0FBQ0EsWUFBSSxLQUFLWixhQUFULEVBQXdCO0FBQ3RCLGVBQUtBLGFBQUwsQ0FBbUJ5RyxTQUFuQixFQUE4QkYsYUFBOUIsRUFBNkNILE1BQU1RLFFBQW5EO0FBQ0Q7QUFDRjtBQUNGOzs7Ozs7ZUF0a0JrQnZILFk7OztBQXlrQnJCLFNBQVM4RSxTQUFULENBQW1CakQsS0FBbkIsRUFBMEI7QUFDeEIsTUFBSUEsaUJBQWlCNUMsS0FBckIsRUFBNEI7QUFDMUIsZ0JBQVU0QyxLQUFWO0FBQ0Q7QUFDRCxTQUFPLENBQUNBLEtBQUQsR0FBUyxZQUFULEdBQXdCLGVBQS9CO0FBQ0QiLCJmaWxlIjoibGF5ZXItbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAoYykgMjAxNSAtIDIwMTcgVWJlciBUZWNobm9sb2dpZXMsIEluYy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4vLyBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4vLyBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4vLyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4vLyBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbi8vIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbi8vIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1Jcbi8vIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuLy8gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4vLyBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4vLyBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuLy8gT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuLy8gVEhFIFNPRlRXQVJFLlxuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQge0ZyYW1lYnVmZmVyLCBTaGFkZXJDYWNoZX0gZnJvbSAnbHVtYS5nbCc7XG5pbXBvcnQgc2VlciBmcm9tICdzZWVyJztcbmltcG9ydCBMYXllciBmcm9tICcuL2xheWVyJztcbmltcG9ydCB7bG9nfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCB7ZmxhdHRlbn0gZnJvbSAnLi91dGlscy9mbGF0dGVuJztcbmltcG9ydCB7ZHJhd0xheWVycywgcGlja0xheWVycywgcXVlcnlMYXllcnN9IGZyb20gJy4vZHJhdy1hbmQtcGljayc7XG5pbXBvcnQge0xJRkVDWUNMRX0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHtWaWV3cG9ydH0gZnJvbSAnLi92aWV3cG9ydHMnO1xuaW1wb3J0IHtcbiAgc2V0UHJvcE92ZXJyaWRlcyxcbiAgbGF5ZXJFZGl0TGlzdGVuZXIsXG4gIHNlZXJJbml0TGlzdGVuZXIsXG4gIGluaXRMYXllckluU2VlcixcbiAgdXBkYXRlTGF5ZXJJblNlZXJcbn0gZnJvbSAnLi4vZGVidWcvc2Vlci1pbnRlZ3JhdGlvbic7XG5cbmNvbnN0IExPR19QUklPUklUWV9MSUZFQ1lDTEUgPSAyO1xuY29uc3QgTE9HX1BSSU9SSVRZX0xJRkVDWUNMRV9NSU5PUiA9IDQ7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIExheWVyTWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHtnbH0pIHtcbiAgICAvKiBDdXJyZW50bHkgZGVjay5nbCBleHBlY3RzIHRoZSBEZWNrR0wubGF5ZXJzIHRvIGJlIGRpZmZlcmVudFxuICAgICB3aGVuZXZlciBSZWFjdCByZXJlbmRlcnMuIElmIHRoZSBzYW1lIGxheWVycyBhcnJheSBpcyB1c2VkLCB0aGVcbiAgICAgTGF5ZXJNYW5hZ2VyJ3MgZGlmZmluZyBhbGdvcml0aG0gd2lsbCBnZW5lcmF0ZSBhIGZhdGFsIGVycm9yIGFuZFxuICAgICBicmVhayB0aGUgcmVuZGVyaW5nLlxuXG4gICAgIGB0aGlzLmxhc3RSZW5kZXJlZExheWVyc2Agc3RvcmVzIHRoZSBVTkZJTFRFUkVEIGxheWVycyBzZW50XG4gICAgIGRvd24gdG8gTGF5ZXJNYW5hZ2VyLCBzbyB0aGF0IGBsYXllcnNgIHJlZmVyZW5jZSBjYW4gYmUgY29tcGFyZWQuXG4gICAgIElmIGl0J3MgdGhlIHNhbWUgYWNyb3NzIHR3byBSZWFjdCByZW5kZXIgY2FsbHMsIHRoZSBkaWZmaW5nIGxvZ2ljXG4gICAgIHdpbGwgYmUgc2tpcHBlZC5cbiAgICAqL1xuXG4gICAgdGhpcy5sYXN0UmVuZGVyZWRMYXllcnMgPSBbXTtcblxuICAgIHRoaXMucHJldkxheWVycyA9IFtdO1xuICAgIHRoaXMubGF5ZXJzID0gW107XG4gICAgdGhpcy5vbGRDb250ZXh0ID0ge307XG4gICAgdGhpcy5zY3JlZW5DbGVhcmVkID0gZmFsc2U7XG4gICAgdGhpcy5fbmVlZHNSZWRyYXcgPSB0cnVlO1xuXG4gICAgdGhpcy5fZXZlbnRNYW5hZ2VyID0gbnVsbDtcbiAgICB0aGlzLl9waWNraW5nUmFkaXVzID0gMDtcbiAgICB0aGlzLl9vbkxheWVyQ2xpY2sgPSBudWxsO1xuICAgIHRoaXMuX29uTGF5ZXJIb3ZlciA9IG51bGw7XG4gICAgdGhpcy5fb25DbGljayA9IHRoaXMuX29uQ2xpY2suYmluZCh0aGlzKTtcbiAgICB0aGlzLl9vblBvaW50ZXJNb3ZlID0gdGhpcy5fb25Qb2ludGVyTW92ZS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5faW5pdFNlZXIgPSB0aGlzLl9pbml0U2Vlci5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX2VkaXRTZWVyID0gdGhpcy5fZWRpdFNlZXIuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuY29udGV4dCA9IHtcbiAgICAgIGdsLFxuICAgICAgdW5pZm9ybXM6IHt9LFxuICAgICAgdmlld3BvcnQ6IG51bGwsXG4gICAgICB2aWV3cG9ydENoYW5nZWQ6IHRydWUsXG4gICAgICBwaWNraW5nRkJPOiBudWxsLFxuICAgICAgbGFzdFBpY2tlZEluZm86IHtcbiAgICAgICAgaW5kZXg6IC0xLFxuICAgICAgICBsYXllcklkOiBudWxsXG4gICAgICB9LFxuICAgICAgc2hhZGVyQ2FjaGU6IG5ldyBTaGFkZXJDYWNoZSh7Z2x9KVxuICAgIH07XG5cbiAgICBzZWVySW5pdExpc3RlbmVyKHRoaXMuX2luaXRTZWVyKTtcbiAgICBsYXllckVkaXRMaXN0ZW5lcih0aGlzLl9lZGl0U2Vlcik7XG5cbiAgICBPYmplY3Quc2VhbCh0aGlzLmNvbnRleHQpO1xuICAgIE9iamVjdC5zZWFsKHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB1cG9uIFNlZXIgaW5pdGlhbGl6YXRpb24sIG1hbnVhbGx5IHNlbmRzIGxheWVycyBkYXRhLlxuICAgKi9cbiAgX2luaXRTZWVyKCkge1xuICAgIHRoaXMubGF5ZXJzLmZvckVhY2gobGF5ZXIgPT4ge1xuICAgICAgaW5pdExheWVySW5TZWVyKGxheWVyKTtcbiAgICAgIHVwZGF0ZUxheWVySW5TZWVyKGxheWVyKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPbiBTZWVyIHByb3BlcnR5IGVkaXRpb24sIHNldCBvdmVycmlkZSBhbmQgdXBkYXRlIGxheWVycy5cbiAgICovXG4gIF9lZGl0U2VlcihwYXlsb2FkKSB7XG4gICAgaWYgKHBheWxvYWQudHlwZSAhPT0gJ2VkaXQnIHx8IHBheWxvYWQudmFsdWVQYXRoWzBdICE9PSAncHJvcHMnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2V0UHJvcE92ZXJyaWRlcyhwYXlsb2FkLml0ZW1LZXksIHBheWxvYWQudmFsdWVQYXRoLnNsaWNlKDEpLCBwYXlsb2FkLnZhbHVlKTtcbiAgICBjb25zdCBuZXdMYXllcnMgPSB0aGlzLmxheWVycy5tYXAobGF5ZXIgPT4gbmV3IGxheWVyLmNvbnN0cnVjdG9yKGxheWVyLnByb3BzKSk7XG4gICAgdGhpcy51cGRhdGVMYXllcnMoe25ld0xheWVyc30pO1xuICB9XG5cbiAgLyoqXG4gICAqIE1ldGhvZCB0byBjYWxsIHdoZW4gdGhlIGxheWVyIG1hbmFnZXIgaXMgbm90IG5lZWRlZCBhbnltb3JlLlxuICAgKlxuICAgKiBDdXJyZW50bHkgdXNlZCBpbiB0aGUgPERlY2tHTD4gY29tcG9uZW50V2lsbFVubW91bnQgbGlmZWN5Y2xlIHRvIHVuYmluZCBTZWVyIGxpc3RlbmVycy5cbiAgICovXG4gIGZpbmFsaXplKCkge1xuICAgIHNlZXIucmVtb3ZlTGlzdGVuZXIodGhpcy5faW5pdFNlZXIpO1xuICAgIHNlZXIucmVtb3ZlTGlzdGVuZXIodGhpcy5fZWRpdFNlZXIpO1xuICB9XG5cbiAgc2V0Vmlld3BvcnQodmlld3BvcnQpIHtcbiAgICBhc3NlcnQodmlld3BvcnQgaW5zdGFuY2VvZiBWaWV3cG9ydCwgJ0ludmFsaWQgdmlld3BvcnQnKTtcblxuICAgIC8vIFRPRE8gLSB2aWV3cG9ydCBjaGFuZ2UgZGV0ZWN0aW9uIGJyZWFrcyBNRVRFUl9PRkZTRVRTIG1vZGVcbiAgICAvLyBjb25zdCBvbGRWaWV3cG9ydCA9IHRoaXMuY29udGV4dC52aWV3cG9ydDtcbiAgICAvLyBjb25zdCB2aWV3cG9ydENoYW5nZWQgPSAhb2xkVmlld3BvcnQgfHwgIXZpZXdwb3J0LmVxdWFscyhvbGRWaWV3cG9ydCk7XG5cbiAgICB0aGlzLl9uZWVkc1JlZHJhdyA9IHRydWU7XG5cbiAgICBjb25zdCB2aWV3cG9ydENoYW5nZWQgPSB0cnVlO1xuXG4gICAgaWYgKHZpZXdwb3J0Q2hhbmdlZCkge1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLm9sZENvbnRleHQsIHRoaXMuY29udGV4dCk7XG4gICAgICB0aGlzLmNvbnRleHQudmlld3BvcnQgPSB2aWV3cG9ydDtcbiAgICAgIHRoaXMuY29udGV4dC52aWV3cG9ydENoYW5nZWQgPSB0cnVlO1xuICAgICAgdGhpcy5jb250ZXh0LnVuaWZvcm1zID0ge307XG4gICAgICBsb2coNCwgdmlld3BvcnQpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudE1hbmFnZXIgICBBIHNvdXJjZSBvZiBET00gaW5wdXQgZXZlbnRzXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIG9uKCkvb2ZmKCkgbWV0aG9kcyBmb3IgcmVnaXN0cmF0aW9uLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpY2ggd2lsbCBjYWxsIGhhbmRsZXJzIHdpdGhcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuIEV2ZW50IG9iamVjdCBvZiB0aGUgZm9sbG93aW5nIHNoYXBlOlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge09iamVjdDoge3gsIHl9fSBvZmZzZXRDZW50ZXI6IGNlbnRlciBvZiB0aGUgZXZlbnRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtPYmplY3R9IHNyY0V2ZW50OiAgICAgICAgICAgICBuYXRpdmUgSlMgRXZlbnQgb2JqZWN0XG4gICAqL1xuICBpbml0RXZlbnRIYW5kbGluZyhldmVudE1hbmFnZXIpIHtcbiAgICB0aGlzLl9ldmVudE1hbmFnZXIgPSBldmVudE1hbmFnZXI7XG5cbiAgICAvLyBUT0RPOiBhZGQvcmVtb3ZlIGhhbmRsZXJzIG9uIGRlbWFuZCBhdCBydW50aW1lLCBub3QgYWxsIGF0IG9uY2Ugb24gaW5pdC5cbiAgICAvLyBDb25zaWRlciBib3RoIHRvcC1sZXZlbCBoYW5kbGVycyBsaWtlIG9uTGF5ZXJDbGljay9Ib3ZlclxuICAgIC8vIGFuZCBwZXItbGF5ZXIgaGFuZGxlcnMgYXR0YWNoZWQgdG8gaW5kaXZpZHVhbCBsYXllcnMuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3ViZXIvZGVjay5nbC9pc3N1ZXMvNjM0XG4gICAgdGhpcy5fZXZlbnRNYW5hZ2VyLm9uKHtcbiAgICAgIGNsaWNrOiB0aGlzLl9vbkNsaWNrLFxuICAgICAgcG9pbnRlcm1vdmU6IHRoaXMuX29uUG9pbnRlck1vdmVcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgcGFyYW1ldGVycyBmb3IgaW5wdXQgZXZlbnQgaGFuZGxpbmcuXG4gICAqIFBhcmFtZXRlcnMgYXJlIHRvIGJlIHBhc3NlZCBhcyBhIHNpbmdsZSBvYmplY3QsIHdpdGggdGhlIGZvbGxvd2luZyBzaGFwZTpcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHBpY2tpbmdSYWRpdXMgICAgXCJGdXp6aW5lc3NcIiBvZiBwaWNraW5nIChweCksIHRvIHN1cHBvcnQgZmF0LWZpbmdlcmluZy5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25MYXllckNsaWNrICAgQSBoYW5kbGVyIHRvIGJlIGNhbGxlZCB3aGVuIGFueSBsYXllciBpcyBjbGlja2VkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvbkxheWVySG92ZXIgICBBIGhhbmRsZXIgdG8gYmUgY2FsbGVkIHdoZW4gYW55IGxheWVyIGlzIGhvdmVyZWQgb3Zlci5cbiAgICovXG4gIHNldEV2ZW50SGFuZGxpbmdQYXJhbWV0ZXJzKHtcbiAgICBwaWNraW5nUmFkaXVzLFxuICAgIG9uTGF5ZXJDbGljayxcbiAgICBvbkxheWVySG92ZXJcbiAgfSkge1xuICAgIGlmICghaXNOYU4ocGlja2luZ1JhZGl1cykpIHtcbiAgICAgIHRoaXMuX3BpY2tpbmdSYWRpdXMgPSBwaWNraW5nUmFkaXVzO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIG9uTGF5ZXJDbGljayAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuX29uTGF5ZXJDbGljayA9IG9uTGF5ZXJDbGljaztcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvbkxheWVySG92ZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLl9vbkxheWVySG92ZXIgPSBvbkxheWVySG92ZXI7XG4gICAgfVxuICAgIHRoaXMuX3ZhbGlkYXRlRXZlbnRIYW5kbGluZygpO1xuICB9XG5cbiAgdXBkYXRlTGF5ZXJzKHtuZXdMYXllcnN9KSB7XG4gICAgLy8gVE9ETyAtIHNvbWV0aGluZyBpcyBnZW5lcmF0aW5nIHN0YXRlIHVwZGF0ZXMgdGhhdCBjYXVzZSByZXJlbmRlciBvZiB0aGUgc2FtZVxuICAgIGlmIChuZXdMYXllcnMgPT09IHRoaXMubGFzdFJlbmRlcmVkTGF5ZXJzKSB7XG4gICAgICBsb2cubG9nKDMsICdJZ25vcmluZyBsYXllciB1cGRhdGUgZHVlIHRvIGxheWVyIGFycmF5IG5vdCBjaGFuZ2VkJyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy5sYXN0UmVuZGVyZWRMYXllcnMgPSBuZXdMYXllcnM7XG5cbiAgICBhc3NlcnQodGhpcy5jb250ZXh0LnZpZXdwb3J0LCAnTGF5ZXJNYW5hZ2VyLnVwZGF0ZUxheWVyczogdmlld3BvcnQgbm90IHNldCcpO1xuXG4gICAgLy8gRmlsdGVyIG91dCBhbnkgbnVsbCBsYXllcnNcbiAgICBuZXdMYXllcnMgPSBuZXdMYXllcnMuZmlsdGVyKG5ld0xheWVyID0+IG5ld0xheWVyICE9PSBudWxsKTtcblxuICAgIGZvciAoY29uc3QgbGF5ZXIgb2YgbmV3TGF5ZXJzKSB7XG4gICAgICBsYXllci5jb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuICAgIH1cblxuICAgIHRoaXMucHJldkxheWVycyA9IHRoaXMubGF5ZXJzO1xuICAgIGNvbnN0IHtlcnJvciwgZ2VuZXJhdGVkTGF5ZXJzfSA9IHRoaXMuX3VwZGF0ZUxheWVycyh7XG4gICAgICBvbGRMYXllcnM6IHRoaXMucHJldkxheWVycyxcbiAgICAgIG5ld0xheWVyc1xuICAgIH0pO1xuXG4gICAgdGhpcy5sYXllcnMgPSBnZW5lcmF0ZWRMYXllcnM7XG4gICAgLy8gVGhyb3cgZmlyc3QgZXJyb3IgZm91bmQsIGlmIGFueVxuICAgIGlmIChlcnJvcikge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgZHJhd0xheWVycyh7cGFzc30pIHtcbiAgICBhc3NlcnQodGhpcy5jb250ZXh0LnZpZXdwb3J0LCAnTGF5ZXJNYW5hZ2VyLmRyYXdMYXllcnM6IHZpZXdwb3J0IG5vdCBzZXQnKTtcblxuICAgIGRyYXdMYXllcnMoe2xheWVyczogdGhpcy5sYXllcnMsIHBhc3N9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gUGljayB0aGUgY2xvc2VzdCBpbmZvIGF0IGdpdmVuIGNvb3JkaW5hdGVcbiAgcGlja0xheWVyKHt4LCB5LCBtb2RlLCByYWRpdXMgPSAwLCBsYXllcklkc30pIHtcbiAgICBjb25zdCB7Z2x9ID0gdGhpcy5jb250ZXh0O1xuICAgIGNvbnN0IGxheWVycyA9IGxheWVySWRzID9cbiAgICAgIHRoaXMubGF5ZXJzLmZpbHRlcihsYXllciA9PiBsYXllcklkcy5pbmRleE9mKGxheWVyLmlkKSA+PSAwKSA6XG4gICAgICB0aGlzLmxheWVycztcblxuICAgIHJldHVybiBwaWNrTGF5ZXJzKGdsLCB7XG4gICAgICB4LFxuICAgICAgeSxcbiAgICAgIHJhZGl1cyxcbiAgICAgIGxheWVycyxcbiAgICAgIG1vZGUsXG4gICAgICB2aWV3cG9ydDogdGhpcy5jb250ZXh0LnZpZXdwb3J0LFxuICAgICAgcGlja2luZ0ZCTzogdGhpcy5fZ2V0UGlja2luZ0J1ZmZlcigpLFxuICAgICAgbGFzdFBpY2tlZEluZm86IHRoaXMuY29udGV4dC5sYXN0UGlja2VkSW5mb1xuICAgIH0pO1xuICB9XG5cbiAgLy8gR2V0IGFsbCB1bmlxdWUgaW5mb3Mgd2l0aGluIGEgYm91bmRpbmcgYm94XG4gIHF1ZXJ5TGF5ZXIoe3gsIHksIHdpZHRoLCBoZWlnaHQsIGxheWVySWRzfSkge1xuICAgIGNvbnN0IHtnbH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgY29uc3QgbGF5ZXJzID0gbGF5ZXJJZHMgP1xuICAgICAgdGhpcy5sYXllcnMuZmlsdGVyKGxheWVyID0+IGxheWVySWRzLmluZGV4T2YobGF5ZXIuaWQpID49IDApIDpcbiAgICAgIHRoaXMubGF5ZXJzO1xuXG4gICAgcmV0dXJuIHF1ZXJ5TGF5ZXJzKGdsLCB7XG4gICAgICB4LFxuICAgICAgeSxcbiAgICAgIHdpZHRoLFxuICAgICAgaGVpZ2h0LFxuICAgICAgbGF5ZXJzLFxuICAgICAgbW9kZTogJ3F1ZXJ5JyxcbiAgICAgIHZpZXdwb3J0OiB0aGlzLmNvbnRleHQudmlld3BvcnQsXG4gICAgICBwaWNraW5nRkJPOiB0aGlzLl9nZXRQaWNraW5nQnVmZmVyKClcbiAgICB9KTtcbiAgfVxuXG4gIG5lZWRzUmVkcmF3KHtjbGVhclJlZHJhd0ZsYWdzID0gZmFsc2V9ID0ge30pIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dC52aWV3cG9ydCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGxldCByZWRyYXcgPSB0aGlzLl9uZWVkc1JlZHJhdztcbiAgICBpZiAoY2xlYXJSZWRyYXdGbGFncykge1xuICAgICAgdGhpcy5fbmVlZHNSZWRyYXcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCBidWZmZXIgaXMgY2xlYXJlZCBvbmNlIHdoZW4gbGF5ZXIgbGlzdCBiZWNvbWVzIGVtcHR5XG4gICAgaWYgKHRoaXMubGF5ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKHRoaXMuc2NyZWVuQ2xlYXJlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmVkcmF3ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zY3JlZW5DbGVhcmVkID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLnNjcmVlbkNsZWFyZWQgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuc2NyZWVuQ2xlYXJlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgbGF5ZXIgb2YgdGhpcy5sYXllcnMpIHtcbiAgICAgIHJlZHJhdyA9IHJlZHJhdyB8fCBsYXllci5nZXROZWVkc1JlZHJhdyh7Y2xlYXJSZWRyYXdGbGFnc30pO1xuICAgIH1cblxuICAgIHJldHVybiByZWRyYXc7XG4gIH1cblxuICAvL1xuICAvLyBQUklWQVRFIE1FVEhPRFNcbiAgLy9cblxuICBfZ2V0UGlja2luZ0J1ZmZlcigpIHtcbiAgICBjb25zdCB7Z2x9ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgLy8gQ3JlYXRlIGEgZnJhbWUgYnVmZmVyIGlmIG5vdCBhbHJlYWR5IGF2YWlsYWJsZVxuICAgIHRoaXMuY29udGV4dC5waWNraW5nRkJPID0gdGhpcy5jb250ZXh0LnBpY2tpbmdGQk8gfHwgbmV3IEZyYW1lYnVmZmVyKGdsLCB7XG4gICAgICB3aWR0aDogZ2wuY2FudmFzLndpZHRoLFxuICAgICAgaGVpZ2h0OiBnbC5jYW52YXMuaGVpZ2h0XG4gICAgfSk7XG5cbiAgICAvLyBSZXNpemUgaXQgdG8gY3VycmVudCBjYW52YXMgc2l6ZSAodGhpcyBpcyBhIG5vb3AgaWYgc2l6ZSBoYXNuJ3QgY2hhbmdlZClcbiAgICB0aGlzLmNvbnRleHQucGlja2luZ0ZCTy5yZXNpemUoe1xuICAgICAgd2lkdGg6IGdsLmNhbnZhcy53aWR0aCxcbiAgICAgIGhlaWdodDogZ2wuY2FudmFzLmhlaWdodFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuY29udGV4dC5waWNraW5nRkJPO1xuICB9XG5cbiAgLy8gTWF0Y2ggYWxsIGxheWVycywgY2hlY2tpbmcgZm9yIGNhdWdodCBlcnJvcnNcbiAgLy8gVG8gYXZvaWQgaGF2aW5nIGFuIGV4Y2VwdGlvbiBpbiBvbmUgbGF5ZXIgZGlzcnVwdCBvdGhlciBsYXllcnNcbiAgX3VwZGF0ZUxheWVycyh7b2xkTGF5ZXJzLCBuZXdMYXllcnN9KSB7XG4gICAgLy8gQ3JlYXRlIG9sZCBsYXllciBtYXBcbiAgICBjb25zdCBvbGRMYXllck1hcCA9IHt9O1xuICAgIGZvciAoY29uc3Qgb2xkTGF5ZXIgb2Ygb2xkTGF5ZXJzKSB7XG4gICAgICBpZiAob2xkTGF5ZXJNYXBbb2xkTGF5ZXIuaWRdKSB7XG4gICAgICAgIGxvZy5vbmNlKDAsIGBNdWx0aXBsZSBvbGQgbGF5ZXJzIHdpdGggc2FtZSBpZCAke2xheWVyTmFtZShvbGRMYXllcil9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRMYXllck1hcFtvbGRMYXllci5pZF0gPSBvbGRMYXllcjtcbiAgICAgICAgb2xkTGF5ZXIubGlmZWN5Y2xlID0gTElGRUNZQ0xFLkFXQUlUSU5HX0ZJTkFMSVpBVElPTjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBbGxvY2F0ZSBhcnJheSBmb3IgZ2VuZXJhdGVkIGxheWVyc1xuICAgIGNvbnN0IGdlbmVyYXRlZExheWVycyA9IFtdO1xuXG4gICAgLy8gTWF0Y2ggc3VibGF5ZXJzXG4gICAgY29uc3QgZXJyb3IgPSB0aGlzLl9tYXRjaFN1YmxheWVycyh7XG4gICAgICBuZXdMYXllcnMsIG9sZExheWVyTWFwLCBnZW5lcmF0ZWRMYXllcnNcbiAgICB9KTtcblxuICAgIGNvbnN0IGVycm9yMiA9IHRoaXMuX2ZpbmFsaXplT2xkTGF5ZXJzKG9sZExheWVycyk7XG4gICAgY29uc3QgZmlyc3RFcnJvciA9IGVycm9yIHx8IGVycm9yMjtcbiAgICByZXR1cm4ge2Vycm9yOiBmaXJzdEVycm9yLCBnZW5lcmF0ZWRMYXllcnN9O1xuICB9XG5cbiAgLyogZXNsaW50LWRpc2FibGUgbWF4LXN0YXRlbWVudHMgKi9cblxuICBfbWF0Y2hTdWJsYXllcnMoe25ld0xheWVycywgb2xkTGF5ZXJNYXAsIGdlbmVyYXRlZExheWVyc30pIHtcbiAgICAvLyBGaWx0ZXIgb3V0IGFueSBudWxsIGxheWVyc1xuICAgIG5ld0xheWVycyA9IG5ld0xheWVycy5maWx0ZXIobmV3TGF5ZXIgPT4gbmV3TGF5ZXIgIT09IG51bGwpO1xuXG4gICAgbGV0IGVycm9yID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IG5ld0xheWVyIG9mIG5ld0xheWVycykge1xuICAgICAgbmV3TGF5ZXIuY29udGV4dCA9IHRoaXMuY29udGV4dDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gMS4gZ2l2ZW4gYSBuZXcgY29taW5nIGxheWVyLCBmaW5kIGl0cyBtYXRjaGluZyBsYXllclxuICAgICAgICBjb25zdCBvbGRMYXllciA9IG9sZExheWVyTWFwW25ld0xheWVyLmlkXTtcbiAgICAgICAgb2xkTGF5ZXJNYXBbbmV3TGF5ZXIuaWRdID0gbnVsbDtcblxuICAgICAgICBpZiAob2xkTGF5ZXIgPT09IG51bGwpIHtcbiAgICAgICAgICBsb2cub25jZSgwLCBgTXVsdGlwbGUgbmV3IGxheWVycyB3aXRoIHNhbWUgaWQgJHtsYXllck5hbWUobmV3TGF5ZXIpfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT25seSB0cmFuc2ZlciBzdGF0ZSBhdCB0aGlzIHN0YWdlLiBXZSBtdXN0IG5vdCBnZW5lcmF0ZSBleGNlcHRpb25zXG4gICAgICAgIC8vIHVudGlsIGFsbCBsYXllcnMnIHN0YXRlIGhhdmUgYmVlbiB0cmFuc2ZlcnJlZFxuICAgICAgICBpZiAob2xkTGF5ZXIpIHtcbiAgICAgICAgICB0aGlzLl90cmFuc2ZlckxheWVyU3RhdGUob2xkTGF5ZXIsIG5ld0xheWVyKTtcbiAgICAgICAgICB0aGlzLl91cGRhdGVMYXllcihuZXdMYXllcik7XG5cbiAgICAgICAgICB1cGRhdGVMYXllckluU2VlcihuZXdMYXllcik7IC8vIEluaXRpYWxpemVzIGxheWVyIGluIHNlZXIgY2hyb21lIGV4dGVuc2lvbiAoaWYgY29ubmVjdGVkKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX2luaXRpYWxpemVOZXdMYXllcihuZXdMYXllcik7XG5cbiAgICAgICAgICBpbml0TGF5ZXJJblNlZXIobmV3TGF5ZXIpOyAvLyBJbml0aWFsaXplcyBsYXllciBpbiBzZWVyIGNocm9tZSBleHRlbnNpb24gKGlmIGNvbm5lY3RlZClcbiAgICAgICAgfVxuICAgICAgICBnZW5lcmF0ZWRMYXllcnMucHVzaChuZXdMYXllcik7XG5cbiAgICAgICAgLy8gQ2FsbCBsYXllciBsaWZlY3ljbGUgbWV0aG9kOiByZW5kZXIgc3VibGF5ZXJzXG4gICAgICAgIGNvbnN0IHtwcm9wcywgb2xkUHJvcHN9ID0gbmV3TGF5ZXI7XG4gICAgICAgIGxldCBzdWJsYXllcnMgPSBuZXdMYXllci5pc0NvbXBvc2l0ZSA/IG5ld0xheWVyLl9yZW5kZXJMYXllcnMoe1xuICAgICAgICAgIG9sZFByb3BzLFxuICAgICAgICAgIHByb3BzLFxuICAgICAgICAgIGNvbnRleHQ6IHRoaXMuY29udGV4dCxcbiAgICAgICAgICBvbGRDb250ZXh0OiB0aGlzLm9sZENvbnRleHQsXG4gICAgICAgICAgY2hhbmdlRmxhZ3M6IG5ld0xheWVyLmRpZmZQcm9wcyhvbGRQcm9wcywgcHJvcHMsIHRoaXMuY29udGV4dClcbiAgICAgICAgfSkgOiBudWxsO1xuICAgICAgICAvLyBFbmQgbGF5ZXIgbGlmZWN5Y2xlIG1ldGhvZDogcmVuZGVyIHN1YmxheWVyc1xuXG4gICAgICAgIGlmIChzdWJsYXllcnMpIHtcbiAgICAgICAgICAvLyBGbGF0dGVuIHRoZSByZXR1cm5lZCBhcnJheSwgcmVtb3ZpbmcgYW55IG51bGwsIHVuZGVmaW5lZCBvciBmYWxzZVxuICAgICAgICAgIC8vIHRoaXMgYWxsb3dzIGxheWVycyB0byByZW5kZXIgc3VibGF5ZXJzIGNvbmRpdGlvbmFsbHlcbiAgICAgICAgICAvLyAoc2VlIENvbXBvc2l0ZUxheWVyLnJlbmRlckxheWVycyBkb2NzKVxuICAgICAgICAgIHN1YmxheWVycyA9IGZsYXR0ZW4oc3VibGF5ZXJzLCB7ZmlsdGVyOiBCb29sZWFufSk7XG5cbiAgICAgICAgICAvLyBwb3B1bGF0ZSByZWZlcmVuY2UgdG8gcGFyZW50IGxheWVyXG4gICAgICAgICAgc3VibGF5ZXJzLmZvckVhY2gobGF5ZXIgPT4ge1xuICAgICAgICAgICAgbGF5ZXIucGFyZW50TGF5ZXIgPSBuZXdMYXllcjtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHRoaXMuX21hdGNoU3VibGF5ZXJzKHtcbiAgICAgICAgICAgIG5ld0xheWVyczogc3VibGF5ZXJzLFxuICAgICAgICAgICAgb2xkTGF5ZXJNYXAsXG4gICAgICAgICAgICBnZW5lcmF0ZWRMYXllcnNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5vbmNlKDAsXG4gICAgICAgICAgYGRlY2suZ2wgZXJyb3IgZHVyaW5nIG1hdGNoaW5nIG9mICR7bGF5ZXJOYW1lKG5ld0xheWVyKX0gJHtlcnJ9YCwgZXJyKTtcbiAgICAgICAgLy8gU2F2ZSBmaXJzdCBlcnJvclxuICAgICAgICBlcnJvciA9IGVycm9yIHx8IGVycjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgX3RyYW5zZmVyTGF5ZXJTdGF0ZShvbGRMYXllciwgbmV3TGF5ZXIpIHtcbiAgICBjb25zdCB7c3RhdGUsIHByb3BzfSA9IG9sZExheWVyO1xuXG4gICAgLy8gc2FuaXR5IGNoZWNrXG4gICAgYXNzZXJ0KHN0YXRlLCAnZGVjay5nbCBzYW5pdHkgY2hlY2sgLSBNYXRjaGluZyBsYXllciBoYXMgbm8gc3RhdGUnKTtcbiAgICBpZiAobmV3TGF5ZXIgIT09IG9sZExheWVyKSB7XG4gICAgICBsb2coTE9HX1BSSU9SSVRZX0xJRkVDWUNMRV9NSU5PUixcbiAgICAgICAgYG1hdGNoZWQgJHtsYXllck5hbWUobmV3TGF5ZXIpfWAsIG9sZExheWVyLCAnLT4nLCBuZXdMYXllcik7XG5cbiAgICAgIC8vIE1vdmUgc3RhdGVcbiAgICAgIHN0YXRlLmxheWVyID0gbmV3TGF5ZXI7XG4gICAgICBuZXdMYXllci5zdGF0ZSA9IHN0YXRlO1xuXG4gICAgICAvLyBVcGRhdGUgbW9kZWwgbGF5ZXIgcmVmZXJlbmNlXG4gICAgICBpZiAoc3RhdGUubW9kZWwpIHtcbiAgICAgICAgc3RhdGUubW9kZWwudXNlckRhdGEubGF5ZXIgPSBuZXdMYXllcjtcbiAgICAgIH1cbiAgICAgIC8vIEtlZXAgYSB0ZW1wb3JhcnkgcmVmIHRvIHRoZSBvbGQgcHJvcHMsIGZvciBwcm9wIGNvbXBhcmlzb25cbiAgICAgIG5ld0xheWVyLm9sZFByb3BzID0gcHJvcHM7XG4gICAgICAvLyBvbGRMYXllci5zdGF0ZSA9IG51bGw7XG5cbiAgICAgIG5ld0xheWVyLmxpZmVjeWNsZSA9IExJRkVDWUNMRS5NQVRDSEVEO1xuICAgICAgb2xkTGF5ZXIubGlmZWN5Y2xlID0gTElGRUNZQ0xFLkFXQUlUSU5HX0dDO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2cubG9nKExPR19QUklPUklUWV9MSUZFQ1lDTEVfTUlOT1IsIGBNYXRjaGluZyBsYXllciBpcyB1bmNoYW5nZWQgJHtuZXdMYXllci5pZH1gKTtcbiAgICAgIG5ld0xheWVyLmxpZmVjeWNsZSA9IExJRkVDWUNMRS5NQVRDSEVEO1xuICAgICAgbmV3TGF5ZXIub2xkUHJvcHMgPSBuZXdMYXllci5wcm9wcztcbiAgICAgIC8vIFRPRE8gLSB3ZSBjb3VsZCBhdm9pZCBwcm9wIGNvbXBhcmlzb25zIGluIHRoaXMgY2FzZVxuICAgIH1cbiAgfVxuXG4gIC8vIFVwZGF0ZSB0aGUgb2xkIGxheWVycyB0aGF0IHdlcmUgbm90IG1hdGNoZWRcbiAgX2ZpbmFsaXplT2xkTGF5ZXJzKG9sZExheWVycykge1xuICAgIGxldCBlcnJvciA9IG51bGw7XG4gICAgLy8gTWF0Y2hlZCBsYXllcnMgaGF2ZSBsaWZlY3ljbGUgc3RhdGUgXCJvdXRkYXRlZFwiXG4gICAgZm9yIChjb25zdCBsYXllciBvZiBvbGRMYXllcnMpIHtcbiAgICAgIGlmIChsYXllci5saWZlY3ljbGUgPT09IExJRkVDWUNMRS5BV0FJVElOR19GSU5BTElaQVRJT04pIHtcbiAgICAgICAgZXJyb3IgPSBlcnJvciB8fCB0aGlzLl9maW5hbGl6ZUxheWVyKGxheWVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgLy8gSW5pdGlhbGl6ZXMgYSBzaW5nbGUgbGF5ZXIsIGNhbGxpbmcgbGF5ZXIgbWV0aG9kc1xuICBfaW5pdGlhbGl6ZU5ld0xheWVyKGxheWVyKSB7XG4gICAgbGV0IGVycm9yID0gbnVsbDtcbiAgICAvLyBDaGVjayBpZiBuZXcgbGF5ZXIsIGFuZCBpbml0aWFsaXplIGl0J3Mgc3RhdGVcbiAgICBpZiAoIWxheWVyLnN0YXRlKSB7XG4gICAgICBsb2coTE9HX1BSSU9SSVRZX0xJRkVDWUNMRSwgYGluaXRpYWxpemluZyAke2xheWVyTmFtZShsYXllcil9YCk7XG4gICAgICB0cnkge1xuXG4gICAgICAgIGxheWVyLmluaXRpYWxpemVMYXllcih7XG4gICAgICAgICAgb2xkUHJvcHM6IHt9LFxuICAgICAgICAgIHByb3BzOiBsYXllci5wcm9wcyxcbiAgICAgICAgICBvbGRDb250ZXh0OiB0aGlzLm9sZENvbnRleHQsXG4gICAgICAgICAgY29udGV4dDogdGhpcy5jb250ZXh0LFxuICAgICAgICAgIGNoYW5nZUZsYWdzOiBsYXllci5kaWZmUHJvcHMoe30sIGxheWVyLnByb3BzLCB0aGlzLmNvbnRleHQpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxheWVyLmxpZmVjeWNsZSA9IExJRkVDWUNMRS5JTklUSUFMSVpFRDtcblxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5vbmNlKDAsIGBkZWNrLmdsIGVycm9yIGR1cmluZyBpbml0aWFsaXphdGlvbiBvZiAke2xheWVyTmFtZShsYXllcil9ICR7ZXJyfWAsIGVycik7XG4gICAgICAgIC8vIFNhdmUgZmlyc3QgZXJyb3JcbiAgICAgICAgZXJyb3IgPSBlcnJvciB8fCBlcnI7XG4gICAgICB9XG4gICAgICAvLyBTZXQgYmFjayBwb2ludGVyICh1c2VkIGluIHBpY2tpbmcpXG4gICAgICBpZiAobGF5ZXIuc3RhdGUpIHtcbiAgICAgICAgbGF5ZXIuc3RhdGUubGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gU2F2ZSBsYXllciBvbiBtb2RlbCBmb3IgcGlja2luZyBwdXJwb3Nlc1xuICAgICAgICAvLyBUT0RPIC0gc3RvcmUgb24gbW9kZWwudXNlckRhdGEgcmF0aGVyIHRoYW4gZGlyZWN0bHkgb24gbW9kZWxcbiAgICAgIH1cbiAgICAgIGlmIChsYXllci5zdGF0ZSAmJiBsYXllci5zdGF0ZS5tb2RlbCkge1xuICAgICAgICBsYXllci5zdGF0ZS5tb2RlbC51c2VyRGF0YS5sYXllciA9IGxheWVyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZXJyb3I7XG4gIH1cblxuICAvLyBVcGRhdGVzIGEgc2luZ2xlIGxheWVyLCBjYWxsaW5nIGxheWVyIG1ldGhvZHNcbiAgX3VwZGF0ZUxheWVyKGxheWVyKSB7XG4gICAgY29uc3Qge29sZFByb3BzLCBwcm9wc30gPSBsYXllcjtcbiAgICBsZXQgZXJyb3IgPSBudWxsO1xuICAgIGlmIChvbGRQcm9wcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGF5ZXIudXBkYXRlTGF5ZXIoe1xuICAgICAgICAgIG9sZFByb3BzLFxuICAgICAgICAgIHByb3BzLFxuICAgICAgICAgIGNvbnRleHQ6IHRoaXMuY29udGV4dCxcbiAgICAgICAgICBvbGRDb250ZXh0OiB0aGlzLm9sZENvbnRleHQsXG4gICAgICAgICAgY2hhbmdlRmxhZ3M6IGxheWVyLmRpZmZQcm9wcyhvbGRQcm9wcywgbGF5ZXIucHJvcHMsIHRoaXMuY29udGV4dClcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLm9uY2UoMCwgYGRlY2suZ2wgZXJyb3IgZHVyaW5nIHVwZGF0ZSBvZiAke2xheWVyTmFtZShsYXllcil9YCwgZXJyKTtcbiAgICAgICAgLy8gU2F2ZSBmaXJzdCBlcnJvclxuICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgIH1cbiAgICAgIGxvZyhMT0dfUFJJT1JJVFlfTElGRUNZQ0xFX01JTk9SLCBgdXBkYXRpbmcgJHtsYXllck5hbWUobGF5ZXIpfWApO1xuICAgIH1cbiAgICByZXR1cm4gZXJyb3I7XG4gIH1cblxuICAvLyBGaW5hbGl6ZXMgYSBzaW5nbGUgbGF5ZXJcbiAgX2ZpbmFsaXplTGF5ZXIobGF5ZXIpIHtcbiAgICBsZXQgZXJyb3IgPSBudWxsO1xuICAgIGNvbnN0IHtzdGF0ZX0gPSBsYXllcjtcbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxheWVyLmZpbmFsaXplTGF5ZXIoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2cub25jZSgwLFxuICAgICAgICAgIGBkZWNrLmdsIGVycm9yIGR1cmluZyBmaW5hbGl6YXRpb24gb2YgJHtsYXllck5hbWUobGF5ZXIpfWAsIGVycik7XG4gICAgICAgIC8vIFNhdmUgZmlyc3QgZXJyb3JcbiAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICB9XG4gICAgICAvLyBsYXllci5zdGF0ZSA9IG51bGw7XG4gICAgICBsYXllci5saWZlY3ljbGUgPSBMSUZFQ1lDTEUuRklOQUxJWkVEO1xuICAgICAgbG9nKExPR19QUklPUklUWV9MSUZFQ1lDTEUsIGBmaW5hbGl6aW5nICR7bGF5ZXJOYW1lKGxheWVyKX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgLyoqXG4gICAqIFdhcm4gaWYgYSBkZWNrLWxldmVsIG1vdXNlIGV2ZW50IGhhcyBiZWVuIHNwZWNpZmllZCxcbiAgICogYnV0IG5vIGxheWVycyBhcmUgYHBpY2thYmxlYC5cbiAgICovXG4gIF92YWxpZGF0ZUV2ZW50SGFuZGxpbmcoKSB7XG4gICAgaWYgKFxuICAgICAgdGhpcy5vbkxheWVyQ2xpY2sgfHxcbiAgICAgIHRoaXMub25MYXllckhvdmVyXG4gICAgKSB7XG4gICAgICBpZiAodGhpcy5sYXllcnMubGVuZ3RoICYmICF0aGlzLmxheWVycy5zb21lKGxheWVyID0+IGxheWVyLnByb3BzLnBpY2thYmxlKSkge1xuICAgICAgICBsb2cub25jZSgxLFxuICAgICAgICAgICdZb3UgaGF2ZSBzdXBwbGllZCBhIHRvcC1sZXZlbCBpbnB1dCBldmVudCBoYW5kbGVyIChlLmcuIGBvbkxheWVyQ2xpY2tgKSwgJyArXG4gICAgICAgICAgJ2J1dCBub25lIG9mIHlvdXIgbGF5ZXJzIGhhdmUgc2V0IHRoZSBgcGlja2FibGVgIGZsYWcuJ1xuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSb3V0ZSBjbGljayBldmVudHMgdG8gbGF5ZXJzLlxuICAgKiBgcGlja0xheWVyYCB3aWxsIGNhbGwgdGhlIGBvbkNsaWNrYCBwcm9wIG9mIGFueSBwaWNrZWQgbGF5ZXIsXG4gICAqIGFuZCBgb25MYXllckNsaWNrYCBpcyBjYWxsZWQgZGlyZWN0bHkgZnJvbSBoZXJlXG4gICAqIHdpdGggYW55IHBpY2tpbmcgaW5mbyBnZW5lcmF0ZWQgYnkgYHBpY2tMYXllcmAuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAgQW4gb2JqZWN0IGVuY2Fwc3VsYXRpbmcgYW4gaW5wdXQgZXZlbnQsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgd2l0aCB0aGUgZm9sbG93aW5nIHNoYXBlOlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIHtPYmplY3Q6IHt4LCB5fX0gb2Zmc2V0Q2VudGVyOiBjZW50ZXIgb2YgdGhlIGV2ZW50XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAge09iamVjdH0gc3JjRXZlbnQ6ICAgICAgICAgICAgIG5hdGl2ZSBKUyBFdmVudCBvYmplY3RcbiAgICovXG4gIF9vbkNsaWNrKGV2ZW50KSB7XG4gICAgY29uc3QgcG9zID0gZXZlbnQub2Zmc2V0Q2VudGVyO1xuICAgIGlmICghcG9zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNlbGVjdGVkSW5mb3MgPSB0aGlzLnBpY2tMYXllcih7XG4gICAgICB4OiBwb3MueCxcbiAgICAgIHk6IHBvcy55LFxuICAgICAgcmFkaXVzOiB0aGlzLl9waWNraW5nUmFkaXVzLFxuICAgICAgbW9kZTogJ2NsaWNrJ1xuICAgIH0pO1xuICAgIGlmIChzZWxlY3RlZEluZm9zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZmlyc3RJbmZvID0gc2VsZWN0ZWRJbmZvcy5maW5kKGluZm8gPT4gaW5mby5pbmRleCA+PSAwKTtcbiAgICAgIGlmICh0aGlzLl9vbkxheWVyQ2xpY2spIHtcbiAgICAgICAgdGhpcy5fb25MYXllckNsaWNrKGZpcnN0SW5mbywgc2VsZWN0ZWRJbmZvcywgZXZlbnQuc3JjRXZlbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSb3V0ZSBjbGljayBldmVudHMgdG8gbGF5ZXJzLlxuICAgKiBgcGlja0xheWVyYCB3aWxsIGNhbGwgdGhlIGBvbkhvdmVyYCBwcm9wIG9mIGFueSBwaWNrZWQgbGF5ZXIsXG4gICAqIGFuZCBgb25MYXllckhvdmVyYCBpcyBjYWxsZWQgZGlyZWN0bHkgZnJvbSBoZXJlXG4gICAqIHdpdGggYW55IHBpY2tpbmcgaW5mbyBnZW5lcmF0ZWQgYnkgYHBpY2tMYXllcmAuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAgQW4gb2JqZWN0IGVuY2Fwc3VsYXRpbmcgYW4gaW5wdXQgZXZlbnQsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgd2l0aCB0aGUgZm9sbG93aW5nIHNoYXBlOlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIHtPYmplY3Q6IHt4LCB5fX0gb2Zmc2V0Q2VudGVyOiBjZW50ZXIgb2YgdGhlIGV2ZW50XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAge09iamVjdH0gc3JjRXZlbnQ6ICAgICAgICAgICAgIG5hdGl2ZSBKUyBFdmVudCBvYmplY3RcbiAgICovXG4gIF9vblBvaW50ZXJNb3ZlKGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmlzRG93bikge1xuICAgICAgLy8gRG8gbm90IHRyaWdnZXIgb25Ib3ZlciBjYWxsYmFja3MgaWYgbW91c2UgYnV0dG9uIGlzIGRvd25cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcG9zID0gZXZlbnQub2Zmc2V0Q2VudGVyO1xuICAgIC8vIFRPRE86IGNvbnNpZGVyIHVzaW5nIHRoaXMuZXZlbnRNYW5hZ2VyLmVsZW1lbnQgc2l6ZSBpbnN0ZWFkIG9mIGxheWVyTWFuYWdlci5jb250ZXh0XG4gICAgLy8gYnV0IGRvIHNvIGluIGEgd2F5IHRoYXQgZG9lc24ndCBjYXVzZSByZWZsb3cgKGUuZy4gYG9mZnNldFdpZHRoL0hlaWdodGApLlxuICAgIC8vIG1heWJlIHRoZSBldmVudCBvYmplY3Qgb2ZmZXJzIG9mZnNldENlbnRlciBhcyBhIDA8PjEgdmFsdWUgYXMgd2VsbD9cbiAgICAvLyBzaW5jZSBpdCdzIGFscmVhZHkgZG9pbmcgc2l6ZSBjYWxjdWxhdGlvbnMuLi5cbiAgICBjb25zdCB7d2lkdGgsIGhlaWdodH0gPSB0aGlzLmNvbnRleHQudmlld3BvcnQ7XG4gICAgaWYgKCFwb3MgfHwgcG9zLnggPCAwIHx8IHBvcy55IDwgMCB8fCBwb3MueCA+IHdpZHRoIHx8IHBvcy55ID4gaGVpZ2h0KSB7XG4gICAgICAvLyBDaGVjayBpZiBwb2ludGVyIGlzIGluc2lkZSB0aGUgY2FudmFzXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNlbGVjdGVkSW5mb3MgPSB0aGlzLnBpY2tMYXllcih7XG4gICAgICB4OiBwb3MueCxcbiAgICAgIHk6IHBvcy55LFxuICAgICAgcmFkaXVzOiB0aGlzLl9waWNraW5nUmFkaXVzLFxuICAgICAgbW9kZTogJ2hvdmVyJ1xuICAgIH0pO1xuICAgIGlmIChzZWxlY3RlZEluZm9zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZmlyc3RJbmZvID0gc2VsZWN0ZWRJbmZvcy5maW5kKGluZm8gPT4gaW5mby5pbmRleCA+PSAwKTtcbiAgICAgIGlmICh0aGlzLl9vbkxheWVySG92ZXIpIHtcbiAgICAgICAgdGhpcy5fb25MYXllckhvdmVyKGZpcnN0SW5mbywgc2VsZWN0ZWRJbmZvcywgZXZlbnQuc3JjRXZlbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBsYXllck5hbWUobGF5ZXIpIHtcbiAgaWYgKGxheWVyIGluc3RhbmNlb2YgTGF5ZXIpIHtcbiAgICByZXR1cm4gYCR7bGF5ZXJ9YDtcbiAgfVxuICByZXR1cm4gIWxheWVyID8gJ251bGwgbGF5ZXInIDogJ2ludmFsaWQgbGF5ZXInO1xufVxuIl19