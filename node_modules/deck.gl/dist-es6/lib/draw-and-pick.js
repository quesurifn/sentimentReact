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

/* global window */
import { GL, withParameters, setParameters } from 'luma.gl';
import { log } from './utils';

var EMPTY_PIXEL = new Uint8Array(4);
var renderCount = 0;

export function drawLayers(_ref) {
  var layers = _ref.layers,
      pass = _ref.pass;

  // render layers in normal colors
  var visibleCount = 0;
  var compositeCount = 0;
  // render layers in normal colors
  layers.forEach(function (layer, layerIndex) {
    if (layer.isComposite) {
      compositeCount++;
    } else if (layer.props.visible) {

      layer.drawLayer({
        moduleParameters: Object.assign({}, layer.props, {
          viewport: layer.context.viewport
        }),
        uniforms: Object.assign({ renderPickingBuffer: 0, pickingEnabled: 0 }, layer.context.uniforms, { layerIndex: layerIndex }),
        parameters: layer.props.parameters || {}
      });
      visibleCount++;
    }
  });
  var totalCount = layers.length;
  var primitiveCount = totalCount - compositeCount;
  var hiddenCount = primitiveCount - visibleCount;

  var message = '#' + renderCount++ + ': Rendering ' + visibleCount + ' of ' + totalCount + ' layers ' + pass + ' (' + hiddenCount + ' hidden, ' + compositeCount + ' composite)';

  log.log(2, message);
}

// Pick all objects within the given bounding box
export function queryLayers(gl, _ref2) {
  var layers = _ref2.layers,
      pickingFBO = _ref2.pickingFBO,
      x = _ref2.x,
      y = _ref2.y,
      width = _ref2.width,
      height = _ref2.height,
      viewport = _ref2.viewport,
      mode = _ref2.mode;


  // Convert from canvas top-left to WebGL bottom-left coordinates
  // And compensate for pixelRatio
  var pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  var deviceLeft = Math.round(x * pixelRatio);
  var deviceBottom = Math.round(gl.canvas.height - y * pixelRatio);
  var deviceRight = Math.round((x + width) * pixelRatio);
  var deviceTop = Math.round(gl.canvas.height - (y + height) * pixelRatio);

  var pickInfos = getUniquesFromPickingBuffer(gl, {
    layers: layers,
    pickingFBO: pickingFBO,
    deviceRect: {
      x: deviceLeft,
      y: deviceTop,
      width: deviceRight - deviceLeft,
      height: deviceBottom - deviceTop
    }
  });

  // Only return unique infos, identified by info.object
  var uniqueInfos = new Map();

  pickInfos.forEach(function (pickInfo) {
    var info = createInfo([pickInfo.x / pixelRatio, pickInfo.y / pixelRatio], viewport);
    info.devicePixel = [pickInfo.x, pickInfo.y];
    info.pixelRatio = pixelRatio;
    info.color = pickInfo.pickedColor;
    info.index = pickInfo.pickedObjectIndex;
    info.picked = true;

    info = getLayerPickingInfo({ layer: pickInfo.pickedLayer, info: info, mode: mode });
    if (!uniqueInfos.has(info.object)) {
      uniqueInfos.set(info.object, info);
    }
  });

  return Array.from(uniqueInfos.values());
}

/* eslint-disable max-depth, max-statements */
// Pick the closest object at the given (x,y) coordinate
export function pickLayers(gl, _ref3) {
  var layers = _ref3.layers,
      pickingFBO = _ref3.pickingFBO,
      x = _ref3.x,
      y = _ref3.y,
      radius = _ref3.radius,
      viewport = _ref3.viewport,
      mode = _ref3.mode,
      lastPickedInfo = _ref3.lastPickedInfo;


  // Convert from canvas top-left to WebGL bottom-left coordinates
  // And compensate for pixelRatio
  var pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  var deviceX = Math.round(x * pixelRatio);
  var deviceY = Math.round(gl.canvas.height - y * pixelRatio);
  var deviceRadius = Math.round(radius * pixelRatio);

  var _getClosestFromPickin = getClosestFromPickingBuffer(gl, {
    layers: layers,
    pickingFBO: pickingFBO,
    deviceX: deviceX,
    deviceY: deviceY,
    deviceRadius: deviceRadius
  }),
      pickedColor = _getClosestFromPickin.pickedColor,
      pickedLayer = _getClosestFromPickin.pickedLayer,
      pickedObjectIndex = _getClosestFromPickin.pickedObjectIndex;

  var affectedLayers = pickedLayer ? [pickedLayer] : [];

  if (mode === 'hover') {
    // only invoke onHover events if picked object has changed
    var lastPickedObjectIndex = lastPickedInfo.index;
    var lastPickedLayerId = lastPickedInfo.layerId;
    var pickedLayerId = pickedLayer && pickedLayer.props.id;

    // proceed only if picked object changed
    if (pickedLayerId !== lastPickedLayerId || pickedObjectIndex !== lastPickedObjectIndex) {
      if (pickedLayerId !== lastPickedLayerId) {
        // We cannot store a ref to lastPickedLayer in the context because
        // the state of an outdated layer is no longer valid
        // and the props may have changed
        var lastPickedLayer = layers.find(function (layer) {
          return layer.props.id === lastPickedLayerId;
        });
        if (lastPickedLayer) {
          // Let leave event fire before enter event
          affectedLayers.unshift(lastPickedLayer);
        }
      }

      // Update layer manager context
      lastPickedInfo.layerId = pickedLayerId;
      lastPickedInfo.index = pickedObjectIndex;
    }
  }

  var baseInfo = createInfo([x, y], viewport);
  baseInfo.devicePixel = [deviceX, deviceY];
  baseInfo.pixelRatio = pixelRatio;

  // Use a Map to store all picking infos.
  // The following two forEach loops are the result of
  // https://github.com/uber/deck.gl/issues/443
  // Please be very careful when changing this pattern
  var infos = new Map();
  var unhandledPickInfos = [];

  affectedLayers.forEach(function (layer) {
    var info = Object.assign({}, baseInfo);

    if (layer === pickedLayer) {
      info.color = pickedColor;
      info.index = pickedObjectIndex;
      info.picked = true;
    }

    info = getLayerPickingInfo({ layer: layer, info: info, mode: mode });

    // This guarantees that there will be only one copy of info for
    // one composite layer
    if (info) {
      infos.set(info.layer.id, info);
    }
  });

  infos.forEach(function (info) {
    var handled = false;
    // Per-layer event handlers (e.g. onClick, onHover) are provided by the
    // user and out of deck.gl's control. It's very much possible that
    // the user calls React lifecycle methods in these function, such as
    // ReactComponent.setState(). React lifecycle methods sometimes induce
    // a re-render and re-generation of props of deck.gl and its layers,
    // which invalidates all layers currently passed to this very function.

    // Therefore, per-layer event handlers must be invoked at the end
    // of this function. NO operation that relies on the states of current
    // layers should be called after this code.
    switch (mode) {
      case 'click':
        handled = info.layer.props.onClick(info);break;
      case 'hover':
        handled = info.layer.props.onHover(info);break;
      case 'query':
        break;
      default:
        throw new Error('unknown pick type');
    }

    if (!handled) {
      unhandledPickInfos.push(info);
    }
  });

  return unhandledPickInfos;
}

/**
 * Pick at a specified pixel with a tolerance radius
 * Returns the closest object to the pixel in shape `{pickedColor, pickedLayer, pickedObjectIndex}`
 */
function getClosestFromPickingBuffer(gl, _ref4) {
  var layers = _ref4.layers,
      pickingFBO = _ref4.pickingFBO,
      deviceX = _ref4.deviceX,
      deviceY = _ref4.deviceY,
      deviceRadius = _ref4.deviceRadius;

  // Create a box of size `radius * 2 + 1` centered at [deviceX, deviceY]
  var x = Math.max(0, deviceX - deviceRadius);
  var y = Math.max(0, deviceY - deviceRadius);
  var width = Math.min(pickingFBO.width, deviceX + deviceRadius) - x + 1;
  var height = Math.min(pickingFBO.height, deviceY + deviceRadius) - y + 1;

  var pickedColors = getPickedColors(gl, { layers: layers, pickingFBO: pickingFBO, deviceRect: { x: x, y: y, width: width, height: height } });

  // Traverse all pixels in picking results and find the one closest to the supplied
  // [deviceX, deviceY]
  var minSquareDistanceToCenter = deviceRadius * deviceRadius;
  var closestResultToCenter = {
    pickedColor: EMPTY_PIXEL,
    pickedLayer: null,
    pickedObjectIndex: -1
  };
  var i = 0;

  for (var row = 0; row < height; row++) {
    for (var col = 0; col < width; col++) {
      // Decode picked layer from color
      var pickedLayerIndex = pickedColors[i + 3] - 1;

      if (pickedLayerIndex >= 0) {
        var dx = col + x - deviceX;
        var dy = row + y - deviceY;
        var d2 = dx * dx + dy * dy;

        if (d2 <= minSquareDistanceToCenter) {
          minSquareDistanceToCenter = d2;

          // Decode picked object index from color
          var pickedColor = pickedColors.slice(i, i + 4);
          var pickedLayer = layers[pickedLayerIndex];
          var pickedObjectIndex = pickedLayer.decodePickingColor(pickedColor);
          closestResultToCenter = { pickedColor: pickedColor, pickedLayer: pickedLayer, pickedObjectIndex: pickedObjectIndex };
        }
      }
      i += 4;
    }
  }

  return closestResultToCenter;
}
/* eslint-enable max-depth, max-statements */

/**
 * Query within a specified rectangle
 * Returns array of unique objects in shape `{x, y, pickedColor, pickedLayer, pickedObjectIndex}`
 */
function getUniquesFromPickingBuffer(gl, _ref5) {
  var layers = _ref5.layers,
      pickingFBO = _ref5.pickingFBO,
      _ref5$deviceRect = _ref5.deviceRect,
      x = _ref5$deviceRect.x,
      y = _ref5$deviceRect.y,
      width = _ref5$deviceRect.width,
      height = _ref5$deviceRect.height;

  var pickedColors = getPickedColors(gl, { layers: layers, pickingFBO: pickingFBO, deviceRect: { x: x, y: y, width: width, height: height } });
  var uniqueColors = new Map();

  // Traverse all pixels in picking results and get unique colors
  for (var i = 0; i < pickedColors.length; i += 4) {
    // Decode picked layer from color
    var pickedLayerIndex = pickedColors[i + 3] - 1;

    if (pickedLayerIndex >= 0) {
      var pickedColor = pickedColors.slice(i, i + 4);
      var colorKey = pickedColor.join(',');
      if (!uniqueColors.has(colorKey)) {
        var pickedLayer = layers[pickedLayerIndex];
        uniqueColors.set(colorKey, {
          pickedColor: pickedColor,
          pickedLayer: pickedLayer,
          pickedObjectIndex: pickedLayer.decodePickingColor(pickedColor)
        });
      }
    }
  }

  return Array.from(uniqueColors.values());
}

// Returns an Uint8ClampedArray of picked pixels
function getPickedColors(gl, _ref6) {
  var layers = _ref6.layers,
      pickingFBO = _ref6.pickingFBO,
      _ref6$deviceRect = _ref6.deviceRect,
      x = _ref6$deviceRect.x,
      y = _ref6$deviceRect.y,
      width = _ref6$deviceRect.width,
      height = _ref6$deviceRect.height;

  // Make sure we clear scissor test and fbo bindings in case of exceptions
  // We are only interested in one pixel, no need to render anything else
  // Note that the callback here is called synchronously.
  // Set blend mode for picking
  // always overwrite existing pixel with [r,g,b,layerIndex]
  return withParameters(gl, {
    framebuffer: pickingFBO,
    scissorTest: true,
    scissor: [x, y, width, height],
    blend: true,
    blendFunc: [gl.ONE, gl.ZERO, gl.CONSTANT_ALPHA, gl.ZERO],
    blendEquation: gl.FUNC_ADD
    // TODO - Set clear color
  }, function () {

    // Clear the frame buffer
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    // Render all pickable layers in picking colors
    layers.forEach(function (layer, layerIndex) {
      if (!layer.isComposite && layer.props.visible && layer.props.pickable) {

        // Encode layerIndex with alpha
        setParameters(gl, { blendColor: [0, 0, 0, (layerIndex + 1) / 255] });
        layer.drawLayer({
          moduleParameters: Object.assign({}, layer.props, {
            viewport: layer.context.viewport
          }),
          uniforms: Object.assign({ renderPickingBuffer: 1, pickingEnabled: 1 }, layer.context.uniforms, { layerIndex: layerIndex }),
          parameters: layer.props.parameters || {}
        });
      }
    });

    // Read color in the central pixel, to be mapped with picking colors
    var pickedColors = new Uint8Array(width * height * 4);
    gl.readPixels(x, y, width, height, GL.RGBA, GL.UNSIGNED_BYTE, pickedColors);

    return pickedColors;
  });
}

function createInfo(pixel, viewport) {
  // Assign a number of potentially useful props to the "info" object
  return {
    color: EMPTY_PIXEL,
    layer: null,
    index: -1,
    picked: false,
    x: pixel[0],
    y: pixel[1],
    pixel: pixel,
    lngLat: viewport.unproject(pixel)
  };
}

// Walk up the layer composite chain to populate the info object
function getLayerPickingInfo(_ref7) {
  var layer = _ref7.layer,
      info = _ref7.info,
      mode = _ref7.mode;

  while (layer && info) {
    // For a composite layer, sourceLayer will point to the sublayer
    // where the event originates from.
    // It provides additional context for the composite layer's
    // getPickingInfo() method to populate the info object
    var sourceLayer = info.layer || layer;
    info.layer = layer;
    // layer.pickLayer() function requires a non-null ```layer.state```
    // object to funtion properly. So the layer refereced here
    // must be the "current" layer, not an "out-dated" / "invalidated" layer
    info = layer.pickLayer({ info: info, mode: mode, sourceLayer: sourceLayer });
    layer = layer.parentLayer;
  }
  return info;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvZHJhdy1hbmQtcGljay5qcyJdLCJuYW1lcyI6WyJHTCIsIndpdGhQYXJhbWV0ZXJzIiwic2V0UGFyYW1ldGVycyIsImxvZyIsIkVNUFRZX1BJWEVMIiwiVWludDhBcnJheSIsInJlbmRlckNvdW50IiwiZHJhd0xheWVycyIsImxheWVycyIsInBhc3MiLCJ2aXNpYmxlQ291bnQiLCJjb21wb3NpdGVDb3VudCIsImZvckVhY2giLCJsYXllciIsImxheWVySW5kZXgiLCJpc0NvbXBvc2l0ZSIsInByb3BzIiwidmlzaWJsZSIsImRyYXdMYXllciIsIm1vZHVsZVBhcmFtZXRlcnMiLCJPYmplY3QiLCJhc3NpZ24iLCJ2aWV3cG9ydCIsImNvbnRleHQiLCJ1bmlmb3JtcyIsInJlbmRlclBpY2tpbmdCdWZmZXIiLCJwaWNraW5nRW5hYmxlZCIsInBhcmFtZXRlcnMiLCJ0b3RhbENvdW50IiwibGVuZ3RoIiwicHJpbWl0aXZlQ291bnQiLCJoaWRkZW5Db3VudCIsIm1lc3NhZ2UiLCJxdWVyeUxheWVycyIsImdsIiwicGlja2luZ0ZCTyIsIngiLCJ5Iiwid2lkdGgiLCJoZWlnaHQiLCJtb2RlIiwicGl4ZWxSYXRpbyIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJkZXZpY2VMZWZ0IiwiTWF0aCIsInJvdW5kIiwiZGV2aWNlQm90dG9tIiwiY2FudmFzIiwiZGV2aWNlUmlnaHQiLCJkZXZpY2VUb3AiLCJwaWNrSW5mb3MiLCJnZXRVbmlxdWVzRnJvbVBpY2tpbmdCdWZmZXIiLCJkZXZpY2VSZWN0IiwidW5pcXVlSW5mb3MiLCJNYXAiLCJpbmZvIiwiY3JlYXRlSW5mbyIsInBpY2tJbmZvIiwiZGV2aWNlUGl4ZWwiLCJjb2xvciIsInBpY2tlZENvbG9yIiwiaW5kZXgiLCJwaWNrZWRPYmplY3RJbmRleCIsInBpY2tlZCIsImdldExheWVyUGlja2luZ0luZm8iLCJwaWNrZWRMYXllciIsImhhcyIsIm9iamVjdCIsInNldCIsIkFycmF5IiwiZnJvbSIsInZhbHVlcyIsInBpY2tMYXllcnMiLCJyYWRpdXMiLCJsYXN0UGlja2VkSW5mbyIsImRldmljZVgiLCJkZXZpY2VZIiwiZGV2aWNlUmFkaXVzIiwiZ2V0Q2xvc2VzdEZyb21QaWNraW5nQnVmZmVyIiwiYWZmZWN0ZWRMYXllcnMiLCJsYXN0UGlja2VkT2JqZWN0SW5kZXgiLCJsYXN0UGlja2VkTGF5ZXJJZCIsImxheWVySWQiLCJwaWNrZWRMYXllcklkIiwiaWQiLCJsYXN0UGlja2VkTGF5ZXIiLCJmaW5kIiwidW5zaGlmdCIsImJhc2VJbmZvIiwiaW5mb3MiLCJ1bmhhbmRsZWRQaWNrSW5mb3MiLCJoYW5kbGVkIiwib25DbGljayIsIm9uSG92ZXIiLCJFcnJvciIsInB1c2giLCJtYXgiLCJtaW4iLCJwaWNrZWRDb2xvcnMiLCJnZXRQaWNrZWRDb2xvcnMiLCJtaW5TcXVhcmVEaXN0YW5jZVRvQ2VudGVyIiwiY2xvc2VzdFJlc3VsdFRvQ2VudGVyIiwiaSIsInJvdyIsImNvbCIsInBpY2tlZExheWVySW5kZXgiLCJkeCIsImR5IiwiZDIiLCJzbGljZSIsImRlY29kZVBpY2tpbmdDb2xvciIsInVuaXF1ZUNvbG9ycyIsImNvbG9yS2V5Iiwiam9pbiIsImZyYW1lYnVmZmVyIiwic2Npc3NvclRlc3QiLCJzY2lzc29yIiwiYmxlbmQiLCJibGVuZEZ1bmMiLCJPTkUiLCJaRVJPIiwiQ09OU1RBTlRfQUxQSEEiLCJibGVuZEVxdWF0aW9uIiwiRlVOQ19BREQiLCJjbGVhciIsIkNPTE9SX0JVRkZFUl9CSVQiLCJERVBUSF9CVUZGRVJfQklUIiwicGlja2FibGUiLCJibGVuZENvbG9yIiwicmVhZFBpeGVscyIsIlJHQkEiLCJVTlNJR05FRF9CWVRFIiwicGl4ZWwiLCJsbmdMYXQiLCJ1bnByb2plY3QiLCJzb3VyY2VMYXllciIsInBpY2tMYXllciIsInBhcmVudExheWVyIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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Q0FBQyxDQUhIO0FBSUxFLFlBQVEsS0FKSDtBQUtMNUIsT0FBR2lHLE1BQU0sQ0FBTixDQUxFO0FBTUxoRyxPQUFHZ0csTUFBTSxDQUFOLENBTkU7QUFPTEEsZ0JBUEs7QUFRTEMsWUFBUWhILFNBQVNpSCxTQUFULENBQW1CRixLQUFuQjtBQVJILEdBQVA7QUFVRDs7QUFFRDtBQUNBLFNBQVNwRSxtQkFBVCxRQUFrRDtBQUFBLE1BQXBCcEQsS0FBb0IsU0FBcEJBLEtBQW9CO0FBQUEsTUFBYjJDLElBQWEsU0FBYkEsSUFBYTtBQUFBLE1BQVBoQixJQUFPLFNBQVBBLElBQU87O0FBQ2hELFNBQU8zQixTQUFTMkMsSUFBaEIsRUFBc0I7QUFDcEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFNZ0YsY0FBY2hGLEtBQUszQyxLQUFMLElBQWNBLEtBQWxDO0FBQ0EyQyxTQUFLM0MsS0FBTCxHQUFhQSxLQUFiO0FBQ0E7QUFDQTtBQUNBO0FBQ0EyQyxXQUFPM0MsTUFBTTRILFNBQU4sQ0FBZ0IsRUFBQ2pGLFVBQUQsRUFBT2hCLFVBQVAsRUFBYWdHLHdCQUFiLEVBQWhCLENBQVA7QUFDQTNILFlBQVFBLE1BQU02SCxXQUFkO0FBQ0Q7QUFDRCxTQUFPbEYsSUFBUDtBQUNEIiwiZmlsZSI6ImRyYXctYW5kLXBpY2suanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgKGMpIDIwMTUgLSAyMDE3IFViZXIgVGVjaG5vbG9naWVzLCBJbmMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuLy8gb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuLy8gaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuLy8gdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuLy8gY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4vLyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4vLyBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4vLyBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbi8vIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuLy8gQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuLy8gTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbi8vIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbi8vIFRIRSBTT0ZUV0FSRS5cblxuLyogZ2xvYmFsIHdpbmRvdyAqL1xuaW1wb3J0IHtHTCwgd2l0aFBhcmFtZXRlcnMsIHNldFBhcmFtZXRlcnN9IGZyb20gJ2x1bWEuZ2wnO1xuaW1wb3J0IHtsb2d9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBFTVBUWV9QSVhFTCA9IG5ldyBVaW50OEFycmF5KDQpO1xubGV0IHJlbmRlckNvdW50ID0gMDtcblxuZXhwb3J0IGZ1bmN0aW9uIGRyYXdMYXllcnMoe2xheWVycywgcGFzc30pIHtcbiAgLy8gcmVuZGVyIGxheWVycyBpbiBub3JtYWwgY29sb3JzXG4gIGxldCB2aXNpYmxlQ291bnQgPSAwO1xuICBsZXQgY29tcG9zaXRlQ291bnQgPSAwO1xuICAvLyByZW5kZXIgbGF5ZXJzIGluIG5vcm1hbCBjb2xvcnNcbiAgbGF5ZXJzLmZvckVhY2goKGxheWVyLCBsYXllckluZGV4KSA9PiB7XG4gICAgaWYgKGxheWVyLmlzQ29tcG9zaXRlKSB7XG4gICAgICBjb21wb3NpdGVDb3VudCsrO1xuICAgIH0gZWxzZSBpZiAobGF5ZXIucHJvcHMudmlzaWJsZSkge1xuXG4gICAgICBsYXllci5kcmF3TGF5ZXIoe1xuICAgICAgICBtb2R1bGVQYXJhbWV0ZXJzOiBPYmplY3QuYXNzaWduKHt9LCBsYXllci5wcm9wcywge1xuICAgICAgICAgIHZpZXdwb3J0OiBsYXllci5jb250ZXh0LnZpZXdwb3J0XG4gICAgICAgIH0pLFxuICAgICAgICB1bmlmb3JtczogT2JqZWN0LmFzc2lnbihcbiAgICAgICAgICB7cmVuZGVyUGlja2luZ0J1ZmZlcjogMCwgcGlja2luZ0VuYWJsZWQ6IDB9LFxuICAgICAgICAgIGxheWVyLmNvbnRleHQudW5pZm9ybXMsXG4gICAgICAgICAge2xheWVySW5kZXh9XG4gICAgICAgICksXG4gICAgICAgIHBhcmFtZXRlcnM6IGxheWVyLnByb3BzLnBhcmFtZXRlcnMgfHwge31cbiAgICAgIH0pO1xuICAgICAgdmlzaWJsZUNvdW50Kys7XG4gICAgfVxuICB9KTtcbiAgY29uc3QgdG90YWxDb3VudCA9IGxheWVycy5sZW5ndGg7XG4gIGNvbnN0IHByaW1pdGl2ZUNvdW50ID0gdG90YWxDb3VudCAtIGNvbXBvc2l0ZUNvdW50O1xuICBjb25zdCBoaWRkZW5Db3VudCA9IHByaW1pdGl2ZUNvdW50IC0gdmlzaWJsZUNvdW50O1xuXG4gIGNvbnN0IG1lc3NhZ2UgPSBgXFxcbiMke3JlbmRlckNvdW50Kyt9OiBSZW5kZXJpbmcgJHt2aXNpYmxlQ291bnR9IG9mICR7dG90YWxDb3VudH0gbGF5ZXJzICR7cGFzc30gXFxcbigke2hpZGRlbkNvdW50fSBoaWRkZW4sICR7Y29tcG9zaXRlQ291bnR9IGNvbXBvc2l0ZSlgO1xuXG4gIGxvZy5sb2coMiwgbWVzc2FnZSk7XG59XG5cbi8vIFBpY2sgYWxsIG9iamVjdHMgd2l0aGluIHRoZSBnaXZlbiBib3VuZGluZyBib3hcbmV4cG9ydCBmdW5jdGlvbiBxdWVyeUxheWVycyhnbCwge1xuICBsYXllcnMsXG4gIHBpY2tpbmdGQk8sXG4gIHgsXG4gIHksXG4gIHdpZHRoLFxuICBoZWlnaHQsXG4gIHZpZXdwb3J0LFxuICBtb2RlXG59KSB7XG5cbiAgLy8gQ29udmVydCBmcm9tIGNhbnZhcyB0b3AtbGVmdCB0byBXZWJHTCBib3R0b20tbGVmdCBjb29yZGluYXRlc1xuICAvLyBBbmQgY29tcGVuc2F0ZSBmb3IgcGl4ZWxSYXRpb1xuICBjb25zdCBwaXhlbFJhdGlvID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA6IDE7XG4gIGNvbnN0IGRldmljZUxlZnQgPSBNYXRoLnJvdW5kKHggKiBwaXhlbFJhdGlvKTtcbiAgY29uc3QgZGV2aWNlQm90dG9tID0gTWF0aC5yb3VuZChnbC5jYW52YXMuaGVpZ2h0IC0geSAqIHBpeGVsUmF0aW8pO1xuICBjb25zdCBkZXZpY2VSaWdodCA9IE1hdGgucm91bmQoKHggKyB3aWR0aCkgKiBwaXhlbFJhdGlvKTtcbiAgY29uc3QgZGV2aWNlVG9wID0gTWF0aC5yb3VuZChnbC5jYW52YXMuaGVpZ2h0IC0gKHkgKyBoZWlnaHQpICogcGl4ZWxSYXRpbyk7XG5cbiAgY29uc3QgcGlja0luZm9zID0gZ2V0VW5pcXVlc0Zyb21QaWNraW5nQnVmZmVyKGdsLCB7XG4gICAgbGF5ZXJzLFxuICAgIHBpY2tpbmdGQk8sXG4gICAgZGV2aWNlUmVjdDoge1xuICAgICAgeDogZGV2aWNlTGVmdCxcbiAgICAgIHk6IGRldmljZVRvcCxcbiAgICAgIHdpZHRoOiBkZXZpY2VSaWdodCAtIGRldmljZUxlZnQsXG4gICAgICBoZWlnaHQ6IGRldmljZUJvdHRvbSAtIGRldmljZVRvcFxuICAgIH1cbiAgfSk7XG5cbiAgLy8gT25seSByZXR1cm4gdW5pcXVlIGluZm9zLCBpZGVudGlmaWVkIGJ5IGluZm8ub2JqZWN0XG4gIGNvbnN0IHVuaXF1ZUluZm9zID0gbmV3IE1hcCgpO1xuXG4gIHBpY2tJbmZvcy5mb3JFYWNoKHBpY2tJbmZvID0+IHtcbiAgICBsZXQgaW5mbyA9IGNyZWF0ZUluZm8oW3BpY2tJbmZvLnggLyBwaXhlbFJhdGlvLCBwaWNrSW5mby55IC8gcGl4ZWxSYXRpb10sIHZpZXdwb3J0KTtcbiAgICBpbmZvLmRldmljZVBpeGVsID0gW3BpY2tJbmZvLngsIHBpY2tJbmZvLnldO1xuICAgIGluZm8ucGl4ZWxSYXRpbyA9IHBpeGVsUmF0aW87XG4gICAgaW5mby5jb2xvciA9IHBpY2tJbmZvLnBpY2tlZENvbG9yO1xuICAgIGluZm8uaW5kZXggPSBwaWNrSW5mby5waWNrZWRPYmplY3RJbmRleDtcbiAgICBpbmZvLnBpY2tlZCA9IHRydWU7XG5cbiAgICBpbmZvID0gZ2V0TGF5ZXJQaWNraW5nSW5mbyh7bGF5ZXI6IHBpY2tJbmZvLnBpY2tlZExheWVyLCBpbmZvLCBtb2RlfSk7XG4gICAgaWYgKCF1bmlxdWVJbmZvcy5oYXMoaW5mby5vYmplY3QpKSB7XG4gICAgICB1bmlxdWVJbmZvcy5zZXQoaW5mby5vYmplY3QsIGluZm8pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIEFycmF5LmZyb20odW5pcXVlSW5mb3MudmFsdWVzKCkpO1xufVxuXG4vKiBlc2xpbnQtZGlzYWJsZSBtYXgtZGVwdGgsIG1heC1zdGF0ZW1lbnRzICovXG4vLyBQaWNrIHRoZSBjbG9zZXN0IG9iamVjdCBhdCB0aGUgZ2l2ZW4gKHgseSkgY29vcmRpbmF0ZVxuZXhwb3J0IGZ1bmN0aW9uIHBpY2tMYXllcnMoZ2wsIHtcbiAgbGF5ZXJzLFxuICBwaWNraW5nRkJPLFxuICB4LFxuICB5LFxuICByYWRpdXMsXG4gIHZpZXdwb3J0LFxuICBtb2RlLFxuICBsYXN0UGlja2VkSW5mb1xufSkge1xuXG4gIC8vIENvbnZlcnQgZnJvbSBjYW52YXMgdG9wLWxlZnQgdG8gV2ViR0wgYm90dG9tLWxlZnQgY29vcmRpbmF0ZXNcbiAgLy8gQW5kIGNvbXBlbnNhdGUgZm9yIHBpeGVsUmF0aW9cbiAgY29uc3QgcGl4ZWxSYXRpbyA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmRldmljZVBpeGVsUmF0aW8gOiAxO1xuICBjb25zdCBkZXZpY2VYID0gTWF0aC5yb3VuZCh4ICogcGl4ZWxSYXRpbyk7XG4gIGNvbnN0IGRldmljZVkgPSBNYXRoLnJvdW5kKGdsLmNhbnZhcy5oZWlnaHQgLSB5ICogcGl4ZWxSYXRpbyk7XG4gIGNvbnN0IGRldmljZVJhZGl1cyA9IE1hdGgucm91bmQocmFkaXVzICogcGl4ZWxSYXRpbyk7XG5cbiAgY29uc3Qge1xuICAgIHBpY2tlZENvbG9yLFxuICAgIHBpY2tlZExheWVyLFxuICAgIHBpY2tlZE9iamVjdEluZGV4XG4gIH0gPSBnZXRDbG9zZXN0RnJvbVBpY2tpbmdCdWZmZXIoZ2wsIHtcbiAgICBsYXllcnMsXG4gICAgcGlja2luZ0ZCTyxcbiAgICBkZXZpY2VYLFxuICAgIGRldmljZVksXG4gICAgZGV2aWNlUmFkaXVzXG4gIH0pO1xuICBjb25zdCBhZmZlY3RlZExheWVycyA9IHBpY2tlZExheWVyID8gW3BpY2tlZExheWVyXSA6IFtdO1xuXG4gIGlmIChtb2RlID09PSAnaG92ZXInKSB7XG4gICAgLy8gb25seSBpbnZva2Ugb25Ib3ZlciBldmVudHMgaWYgcGlja2VkIG9iamVjdCBoYXMgY2hhbmdlZFxuICAgIGNvbnN0IGxhc3RQaWNrZWRPYmplY3RJbmRleCA9IGxhc3RQaWNrZWRJbmZvLmluZGV4O1xuICAgIGNvbnN0IGxhc3RQaWNrZWRMYXllcklkID0gbGFzdFBpY2tlZEluZm8ubGF5ZXJJZDtcbiAgICBjb25zdCBwaWNrZWRMYXllcklkID0gcGlja2VkTGF5ZXIgJiYgcGlja2VkTGF5ZXIucHJvcHMuaWQ7XG5cbiAgICAvLyBwcm9jZWVkIG9ubHkgaWYgcGlja2VkIG9iamVjdCBjaGFuZ2VkXG4gICAgaWYgKHBpY2tlZExheWVySWQgIT09IGxhc3RQaWNrZWRMYXllcklkIHx8IHBpY2tlZE9iamVjdEluZGV4ICE9PSBsYXN0UGlja2VkT2JqZWN0SW5kZXgpIHtcbiAgICAgIGlmIChwaWNrZWRMYXllcklkICE9PSBsYXN0UGlja2VkTGF5ZXJJZCkge1xuICAgICAgICAvLyBXZSBjYW5ub3Qgc3RvcmUgYSByZWYgdG8gbGFzdFBpY2tlZExheWVyIGluIHRoZSBjb250ZXh0IGJlY2F1c2VcbiAgICAgICAgLy8gdGhlIHN0YXRlIG9mIGFuIG91dGRhdGVkIGxheWVyIGlzIG5vIGxvbmdlciB2YWxpZFxuICAgICAgICAvLyBhbmQgdGhlIHByb3BzIG1heSBoYXZlIGNoYW5nZWRcbiAgICAgICAgY29uc3QgbGFzdFBpY2tlZExheWVyID0gbGF5ZXJzLmZpbmQobGF5ZXIgPT4gbGF5ZXIucHJvcHMuaWQgPT09IGxhc3RQaWNrZWRMYXllcklkKTtcbiAgICAgICAgaWYgKGxhc3RQaWNrZWRMYXllcikge1xuICAgICAgICAgIC8vIExldCBsZWF2ZSBldmVudCBmaXJlIGJlZm9yZSBlbnRlciBldmVudFxuICAgICAgICAgIGFmZmVjdGVkTGF5ZXJzLnVuc2hpZnQobGFzdFBpY2tlZExheWVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgbGF5ZXIgbWFuYWdlciBjb250ZXh0XG4gICAgICBsYXN0UGlja2VkSW5mby5sYXllcklkID0gcGlja2VkTGF5ZXJJZDtcbiAgICAgIGxhc3RQaWNrZWRJbmZvLmluZGV4ID0gcGlja2VkT2JqZWN0SW5kZXg7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYmFzZUluZm8gPSBjcmVhdGVJbmZvKFt4LCB5XSwgdmlld3BvcnQpO1xuICBiYXNlSW5mby5kZXZpY2VQaXhlbCA9IFtkZXZpY2VYLCBkZXZpY2VZXTtcbiAgYmFzZUluZm8ucGl4ZWxSYXRpbyA9IHBpeGVsUmF0aW87XG5cbiAgLy8gVXNlIGEgTWFwIHRvIHN0b3JlIGFsbCBwaWNraW5nIGluZm9zLlxuICAvLyBUaGUgZm9sbG93aW5nIHR3byBmb3JFYWNoIGxvb3BzIGFyZSB0aGUgcmVzdWx0IG9mXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS91YmVyL2RlY2suZ2wvaXNzdWVzLzQ0M1xuICAvLyBQbGVhc2UgYmUgdmVyeSBjYXJlZnVsIHdoZW4gY2hhbmdpbmcgdGhpcyBwYXR0ZXJuXG4gIGNvbnN0IGluZm9zID0gbmV3IE1hcCgpO1xuICBjb25zdCB1bmhhbmRsZWRQaWNrSW5mb3MgPSBbXTtcblxuICBhZmZlY3RlZExheWVycy5mb3JFYWNoKGxheWVyID0+IHtcbiAgICBsZXQgaW5mbyA9IE9iamVjdC5hc3NpZ24oe30sIGJhc2VJbmZvKTtcblxuICAgIGlmIChsYXllciA9PT0gcGlja2VkTGF5ZXIpIHtcbiAgICAgIGluZm8uY29sb3IgPSBwaWNrZWRDb2xvcjtcbiAgICAgIGluZm8uaW5kZXggPSBwaWNrZWRPYmplY3RJbmRleDtcbiAgICAgIGluZm8ucGlja2VkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpbmZvID0gZ2V0TGF5ZXJQaWNraW5nSW5mbyh7bGF5ZXIsIGluZm8sIG1vZGV9KTtcblxuICAgIC8vIFRoaXMgZ3VhcmFudGVlcyB0aGF0IHRoZXJlIHdpbGwgYmUgb25seSBvbmUgY29weSBvZiBpbmZvIGZvclxuICAgIC8vIG9uZSBjb21wb3NpdGUgbGF5ZXJcbiAgICBpZiAoaW5mbykge1xuICAgICAgaW5mb3Muc2V0KGluZm8ubGF5ZXIuaWQsIGluZm8pO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5mb3MuZm9yRWFjaChpbmZvID0+IHtcbiAgICBsZXQgaGFuZGxlZCA9IGZhbHNlO1xuICAgIC8vIFBlci1sYXllciBldmVudCBoYW5kbGVycyAoZS5nLiBvbkNsaWNrLCBvbkhvdmVyKSBhcmUgcHJvdmlkZWQgYnkgdGhlXG4gICAgLy8gdXNlciBhbmQgb3V0IG9mIGRlY2suZ2wncyBjb250cm9sLiBJdCdzIHZlcnkgbXVjaCBwb3NzaWJsZSB0aGF0XG4gICAgLy8gdGhlIHVzZXIgY2FsbHMgUmVhY3QgbGlmZWN5Y2xlIG1ldGhvZHMgaW4gdGhlc2UgZnVuY3Rpb24sIHN1Y2ggYXNcbiAgICAvLyBSZWFjdENvbXBvbmVudC5zZXRTdGF0ZSgpLiBSZWFjdCBsaWZlY3ljbGUgbWV0aG9kcyBzb21ldGltZXMgaW5kdWNlXG4gICAgLy8gYSByZS1yZW5kZXIgYW5kIHJlLWdlbmVyYXRpb24gb2YgcHJvcHMgb2YgZGVjay5nbCBhbmQgaXRzIGxheWVycyxcbiAgICAvLyB3aGljaCBpbnZhbGlkYXRlcyBhbGwgbGF5ZXJzIGN1cnJlbnRseSBwYXNzZWQgdG8gdGhpcyB2ZXJ5IGZ1bmN0aW9uLlxuXG4gICAgLy8gVGhlcmVmb3JlLCBwZXItbGF5ZXIgZXZlbnQgaGFuZGxlcnMgbXVzdCBiZSBpbnZva2VkIGF0IHRoZSBlbmRcbiAgICAvLyBvZiB0aGlzIGZ1bmN0aW9uLiBOTyBvcGVyYXRpb24gdGhhdCByZWxpZXMgb24gdGhlIHN0YXRlcyBvZiBjdXJyZW50XG4gICAgLy8gbGF5ZXJzIHNob3VsZCBiZSBjYWxsZWQgYWZ0ZXIgdGhpcyBjb2RlLlxuICAgIHN3aXRjaCAobW9kZSkge1xuICAgIGNhc2UgJ2NsaWNrJzogaGFuZGxlZCA9IGluZm8ubGF5ZXIucHJvcHMub25DbGljayhpbmZvKTsgYnJlYWs7XG4gICAgY2FzZSAnaG92ZXInOiBoYW5kbGVkID0gaW5mby5sYXllci5wcm9wcy5vbkhvdmVyKGluZm8pOyBicmVhaztcbiAgICBjYXNlICdxdWVyeSc6IGJyZWFrO1xuICAgIGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcigndW5rbm93biBwaWNrIHR5cGUnKTtcbiAgICB9XG5cbiAgICBpZiAoIWhhbmRsZWQpIHtcbiAgICAgIHVuaGFuZGxlZFBpY2tJbmZvcy5wdXNoKGluZm8pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHVuaGFuZGxlZFBpY2tJbmZvcztcbn1cblxuLyoqXG4gKiBQaWNrIGF0IGEgc3BlY2lmaWVkIHBpeGVsIHdpdGggYSB0b2xlcmFuY2UgcmFkaXVzXG4gKiBSZXR1cm5zIHRoZSBjbG9zZXN0IG9iamVjdCB0byB0aGUgcGl4ZWwgaW4gc2hhcGUgYHtwaWNrZWRDb2xvciwgcGlja2VkTGF5ZXIsIHBpY2tlZE9iamVjdEluZGV4fWBcbiAqL1xuZnVuY3Rpb24gZ2V0Q2xvc2VzdEZyb21QaWNraW5nQnVmZmVyKGdsLCB7XG4gIGxheWVycyxcbiAgcGlja2luZ0ZCTyxcbiAgZGV2aWNlWCxcbiAgZGV2aWNlWSxcbiAgZGV2aWNlUmFkaXVzXG59KSB7XG4gIC8vIENyZWF0ZSBhIGJveCBvZiBzaXplIGByYWRpdXMgKiAyICsgMWAgY2VudGVyZWQgYXQgW2RldmljZVgsIGRldmljZVldXG4gIGNvbnN0IHggPSBNYXRoLm1heCgwLCBkZXZpY2VYIC0gZGV2aWNlUmFkaXVzKTtcbiAgY29uc3QgeSA9IE1hdGgubWF4KDAsIGRldmljZVkgLSBkZXZpY2VSYWRpdXMpO1xuICBjb25zdCB3aWR0aCA9IE1hdGgubWluKHBpY2tpbmdGQk8ud2lkdGgsIGRldmljZVggKyBkZXZpY2VSYWRpdXMpIC0geCArIDE7XG4gIGNvbnN0IGhlaWdodCA9IE1hdGgubWluKHBpY2tpbmdGQk8uaGVpZ2h0LCBkZXZpY2VZICsgZGV2aWNlUmFkaXVzKSAtIHkgKyAxO1xuXG4gIGNvbnN0IHBpY2tlZENvbG9ycyA9IGdldFBpY2tlZENvbG9ycyhnbCwge2xheWVycywgcGlja2luZ0ZCTywgZGV2aWNlUmVjdDoge3gsIHksIHdpZHRoLCBoZWlnaHR9fSk7XG5cbiAgLy8gVHJhdmVyc2UgYWxsIHBpeGVscyBpbiBwaWNraW5nIHJlc3VsdHMgYW5kIGZpbmQgdGhlIG9uZSBjbG9zZXN0IHRvIHRoZSBzdXBwbGllZFxuICAvLyBbZGV2aWNlWCwgZGV2aWNlWV1cbiAgbGV0IG1pblNxdWFyZURpc3RhbmNlVG9DZW50ZXIgPSBkZXZpY2VSYWRpdXMgKiBkZXZpY2VSYWRpdXM7XG4gIGxldCBjbG9zZXN0UmVzdWx0VG9DZW50ZXIgPSB7XG4gICAgcGlja2VkQ29sb3I6IEVNUFRZX1BJWEVMLFxuICAgIHBpY2tlZExheWVyOiBudWxsLFxuICAgIHBpY2tlZE9iamVjdEluZGV4OiAtMVxuICB9O1xuICBsZXQgaSA9IDA7XG5cbiAgZm9yIChsZXQgcm93ID0gMDsgcm93IDwgaGVpZ2h0OyByb3crKykge1xuICAgIGZvciAobGV0IGNvbCA9IDA7IGNvbCA8IHdpZHRoOyBjb2wrKykge1xuICAgICAgLy8gRGVjb2RlIHBpY2tlZCBsYXllciBmcm9tIGNvbG9yXG4gICAgICBjb25zdCBwaWNrZWRMYXllckluZGV4ID0gcGlja2VkQ29sb3JzW2kgKyAzXSAtIDE7XG5cbiAgICAgIGlmIChwaWNrZWRMYXllckluZGV4ID49IDApIHtcbiAgICAgICAgY29uc3QgZHggPSBjb2wgKyB4IC0gZGV2aWNlWDtcbiAgICAgICAgY29uc3QgZHkgPSByb3cgKyB5IC0gZGV2aWNlWTtcbiAgICAgICAgY29uc3QgZDIgPSBkeCAqIGR4ICsgZHkgKiBkeTtcblxuICAgICAgICBpZiAoZDIgPD0gbWluU3F1YXJlRGlzdGFuY2VUb0NlbnRlcikge1xuICAgICAgICAgIG1pblNxdWFyZURpc3RhbmNlVG9DZW50ZXIgPSBkMjtcblxuICAgICAgICAgIC8vIERlY29kZSBwaWNrZWQgb2JqZWN0IGluZGV4IGZyb20gY29sb3JcbiAgICAgICAgICBjb25zdCBwaWNrZWRDb2xvciA9IHBpY2tlZENvbG9ycy5zbGljZShpLCBpICsgNCk7XG4gICAgICAgICAgY29uc3QgcGlja2VkTGF5ZXIgPSBsYXllcnNbcGlja2VkTGF5ZXJJbmRleF07XG4gICAgICAgICAgY29uc3QgcGlja2VkT2JqZWN0SW5kZXggPSBwaWNrZWRMYXllci5kZWNvZGVQaWNraW5nQ29sb3IocGlja2VkQ29sb3IpO1xuICAgICAgICAgIGNsb3Nlc3RSZXN1bHRUb0NlbnRlciA9IHtwaWNrZWRDb2xvciwgcGlja2VkTGF5ZXIsIHBpY2tlZE9iamVjdEluZGV4fTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaSArPSA0O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjbG9zZXN0UmVzdWx0VG9DZW50ZXI7XG59XG4vKiBlc2xpbnQtZW5hYmxlIG1heC1kZXB0aCwgbWF4LXN0YXRlbWVudHMgKi9cblxuLyoqXG4gKiBRdWVyeSB3aXRoaW4gYSBzcGVjaWZpZWQgcmVjdGFuZ2xlXG4gKiBSZXR1cm5zIGFycmF5IG9mIHVuaXF1ZSBvYmplY3RzIGluIHNoYXBlIGB7eCwgeSwgcGlja2VkQ29sb3IsIHBpY2tlZExheWVyLCBwaWNrZWRPYmplY3RJbmRleH1gXG4gKi9cbmZ1bmN0aW9uIGdldFVuaXF1ZXNGcm9tUGlja2luZ0J1ZmZlcihnbCwge1xuICBsYXllcnMsXG4gIHBpY2tpbmdGQk8sXG4gIGRldmljZVJlY3Q6IHt4LCB5LCB3aWR0aCwgaGVpZ2h0fVxufSkge1xuICBjb25zdCBwaWNrZWRDb2xvcnMgPSBnZXRQaWNrZWRDb2xvcnMoZ2wsIHtsYXllcnMsIHBpY2tpbmdGQk8sIGRldmljZVJlY3Q6IHt4LCB5LCB3aWR0aCwgaGVpZ2h0fX0pO1xuICBjb25zdCB1bmlxdWVDb2xvcnMgPSBuZXcgTWFwKCk7XG5cbiAgLy8gVHJhdmVyc2UgYWxsIHBpeGVscyBpbiBwaWNraW5nIHJlc3VsdHMgYW5kIGdldCB1bmlxdWUgY29sb3JzXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGlja2VkQ29sb3JzLmxlbmd0aDsgaSArPSA0KSB7XG4gICAgLy8gRGVjb2RlIHBpY2tlZCBsYXllciBmcm9tIGNvbG9yXG4gICAgY29uc3QgcGlja2VkTGF5ZXJJbmRleCA9IHBpY2tlZENvbG9yc1tpICsgM10gLSAxO1xuXG4gICAgaWYgKHBpY2tlZExheWVySW5kZXggPj0gMCkge1xuICAgICAgY29uc3QgcGlja2VkQ29sb3IgPSBwaWNrZWRDb2xvcnMuc2xpY2UoaSwgaSArIDQpO1xuICAgICAgY29uc3QgY29sb3JLZXkgPSBwaWNrZWRDb2xvci5qb2luKCcsJyk7XG4gICAgICBpZiAoIXVuaXF1ZUNvbG9ycy5oYXMoY29sb3JLZXkpKSB7XG4gICAgICAgIGNvbnN0IHBpY2tlZExheWVyID0gbGF5ZXJzW3BpY2tlZExheWVySW5kZXhdO1xuICAgICAgICB1bmlxdWVDb2xvcnMuc2V0KGNvbG9yS2V5LCB7XG4gICAgICAgICAgcGlja2VkQ29sb3IsXG4gICAgICAgICAgcGlja2VkTGF5ZXIsXG4gICAgICAgICAgcGlja2VkT2JqZWN0SW5kZXg6IHBpY2tlZExheWVyLmRlY29kZVBpY2tpbmdDb2xvcihwaWNrZWRDb2xvcilcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIEFycmF5LmZyb20odW5pcXVlQ29sb3JzLnZhbHVlcygpKTtcbn1cblxuLy8gUmV0dXJucyBhbiBVaW50OENsYW1wZWRBcnJheSBvZiBwaWNrZWQgcGl4ZWxzXG5mdW5jdGlvbiBnZXRQaWNrZWRDb2xvcnMoZ2wsIHtcbiAgbGF5ZXJzLFxuICBwaWNraW5nRkJPLFxuICBkZXZpY2VSZWN0OiB7eCwgeSwgd2lkdGgsIGhlaWdodH1cbn0pIHtcbiAgLy8gTWFrZSBzdXJlIHdlIGNsZWFyIHNjaXNzb3IgdGVzdCBhbmQgZmJvIGJpbmRpbmdzIGluIGNhc2Ugb2YgZXhjZXB0aW9uc1xuICAvLyBXZSBhcmUgb25seSBpbnRlcmVzdGVkIGluIG9uZSBwaXhlbCwgbm8gbmVlZCB0byByZW5kZXIgYW55dGhpbmcgZWxzZVxuICAvLyBOb3RlIHRoYXQgdGhlIGNhbGxiYWNrIGhlcmUgaXMgY2FsbGVkIHN5bmNocm9ub3VzbHkuXG4gIC8vIFNldCBibGVuZCBtb2RlIGZvciBwaWNraW5nXG4gIC8vIGFsd2F5cyBvdmVyd3JpdGUgZXhpc3RpbmcgcGl4ZWwgd2l0aCBbcixnLGIsbGF5ZXJJbmRleF1cbiAgcmV0dXJuIHdpdGhQYXJhbWV0ZXJzKGdsLCB7XG4gICAgZnJhbWVidWZmZXI6IHBpY2tpbmdGQk8sXG4gICAgc2Npc3NvclRlc3Q6IHRydWUsXG4gICAgc2Npc3NvcjogW3gsIHksIHdpZHRoLCBoZWlnaHRdLFxuICAgIGJsZW5kOiB0cnVlLFxuICAgIGJsZW5kRnVuYzogW2dsLk9ORSwgZ2wuWkVSTywgZ2wuQ09OU1RBTlRfQUxQSEEsIGdsLlpFUk9dLFxuICAgIGJsZW5kRXF1YXRpb246IGdsLkZVTkNfQUREXG4gICAgLy8gVE9ETyAtIFNldCBjbGVhciBjb2xvclxuICB9LCAoKSA9PiB7XG5cbiAgICAvLyBDbGVhciB0aGUgZnJhbWUgYnVmZmVyXG4gICAgZ2wuY2xlYXIoR0wuQ09MT1JfQlVGRkVSX0JJVCB8IEdMLkRFUFRIX0JVRkZFUl9CSVQpO1xuXG4gICAgLy8gUmVuZGVyIGFsbCBwaWNrYWJsZSBsYXllcnMgaW4gcGlja2luZyBjb2xvcnNcbiAgICBsYXllcnMuZm9yRWFjaCgobGF5ZXIsIGxheWVySW5kZXgpID0+IHtcbiAgICAgIGlmICghbGF5ZXIuaXNDb21wb3NpdGUgJiYgbGF5ZXIucHJvcHMudmlzaWJsZSAmJiBsYXllci5wcm9wcy5waWNrYWJsZSkge1xuXG4gICAgICAgIC8vIEVuY29kZSBsYXllckluZGV4IHdpdGggYWxwaGFcbiAgICAgICAgc2V0UGFyYW1ldGVycyhnbCwge2JsZW5kQ29sb3I6IFswLCAwLCAwLCAobGF5ZXJJbmRleCArIDEpIC8gMjU1XX0pO1xuICAgICAgICBsYXllci5kcmF3TGF5ZXIoe1xuICAgICAgICAgIG1vZHVsZVBhcmFtZXRlcnM6IE9iamVjdC5hc3NpZ24oe30sIGxheWVyLnByb3BzLCB7XG4gICAgICAgICAgICB2aWV3cG9ydDogbGF5ZXIuY29udGV4dC52aWV3cG9ydFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHVuaWZvcm1zOiBPYmplY3QuYXNzaWduKFxuICAgICAgICAgICAge3JlbmRlclBpY2tpbmdCdWZmZXI6IDEsIHBpY2tpbmdFbmFibGVkOiAxfSxcbiAgICAgICAgICAgIGxheWVyLmNvbnRleHQudW5pZm9ybXMsXG4gICAgICAgICAgICB7bGF5ZXJJbmRleH1cbiAgICAgICAgICApLFxuICAgICAgICAgIHBhcmFtZXRlcnM6IGxheWVyLnByb3BzLnBhcmFtZXRlcnMgfHwge31cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBSZWFkIGNvbG9yIGluIHRoZSBjZW50cmFsIHBpeGVsLCB0byBiZSBtYXBwZWQgd2l0aCBwaWNraW5nIGNvbG9yc1xuICAgIGNvbnN0IHBpY2tlZENvbG9ycyA9IG5ldyBVaW50OEFycmF5KHdpZHRoICogaGVpZ2h0ICogNCk7XG4gICAgZ2wucmVhZFBpeGVscyh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBHTC5SR0JBLCBHTC5VTlNJR05FRF9CWVRFLCBwaWNrZWRDb2xvcnMpO1xuXG4gICAgcmV0dXJuIHBpY2tlZENvbG9ycztcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUluZm8ocGl4ZWwsIHZpZXdwb3J0KSB7XG4gIC8vIEFzc2lnbiBhIG51bWJlciBvZiBwb3RlbnRpYWxseSB1c2VmdWwgcHJvcHMgdG8gdGhlIFwiaW5mb1wiIG9iamVjdFxuICByZXR1cm4ge1xuICAgIGNvbG9yOiBFTVBUWV9QSVhFTCxcbiAgICBsYXllcjogbnVsbCxcbiAgICBpbmRleDogLTEsXG4gICAgcGlja2VkOiBmYWxzZSxcbiAgICB4OiBwaXhlbFswXSxcbiAgICB5OiBwaXhlbFsxXSxcbiAgICBwaXhlbCxcbiAgICBsbmdMYXQ6IHZpZXdwb3J0LnVucHJvamVjdChwaXhlbClcbiAgfTtcbn1cblxuLy8gV2FsayB1cCB0aGUgbGF5ZXIgY29tcG9zaXRlIGNoYWluIHRvIHBvcHVsYXRlIHRoZSBpbmZvIG9iamVjdFxuZnVuY3Rpb24gZ2V0TGF5ZXJQaWNraW5nSW5mbyh7bGF5ZXIsIGluZm8sIG1vZGV9KSB7XG4gIHdoaWxlIChsYXllciAmJiBpbmZvKSB7XG4gICAgLy8gRm9yIGEgY29tcG9zaXRlIGxheWVyLCBzb3VyY2VMYXllciB3aWxsIHBvaW50IHRvIHRoZSBzdWJsYXllclxuICAgIC8vIHdoZXJlIHRoZSBldmVudCBvcmlnaW5hdGVzIGZyb20uXG4gICAgLy8gSXQgcHJvdmlkZXMgYWRkaXRpb25hbCBjb250ZXh0IGZvciB0aGUgY29tcG9zaXRlIGxheWVyJ3NcbiAgICAvLyBnZXRQaWNraW5nSW5mbygpIG1ldGhvZCB0byBwb3B1bGF0ZSB0aGUgaW5mbyBvYmplY3RcbiAgICBjb25zdCBzb3VyY2VMYXllciA9IGluZm8ubGF5ZXIgfHwgbGF5ZXI7XG4gICAgaW5mby5sYXllciA9IGxheWVyO1xuICAgIC8vIGxheWVyLnBpY2tMYXllcigpIGZ1bmN0aW9uIHJlcXVpcmVzIGEgbm9uLW51bGwgYGBgbGF5ZXIuc3RhdGVgYGBcbiAgICAvLyBvYmplY3QgdG8gZnVudGlvbiBwcm9wZXJseS4gU28gdGhlIGxheWVyIHJlZmVyZWNlZCBoZXJlXG4gICAgLy8gbXVzdCBiZSB0aGUgXCJjdXJyZW50XCIgbGF5ZXIsIG5vdCBhbiBcIm91dC1kYXRlZFwiIC8gXCJpbnZhbGlkYXRlZFwiIGxheWVyXG4gICAgaW5mbyA9IGxheWVyLnBpY2tMYXllcih7aW5mbywgbW9kZSwgc291cmNlTGF5ZXJ9KTtcbiAgICBsYXllciA9IGxheWVyLnBhcmVudExheWVyO1xuICB9XG4gIHJldHVybiBpbmZvO1xufVxuIl19