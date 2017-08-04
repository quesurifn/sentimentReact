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

import Layer from './layer';
import { log } from './utils';

var CompositeLayer = function (_Layer) {
  _inherits(CompositeLayer, _Layer);

  function CompositeLayer(props) {
    _classCallCheck(this, CompositeLayer);

    return _possibleConstructorReturn(this, (CompositeLayer.__proto__ || Object.getPrototypeOf(CompositeLayer)).call(this, props));
  }

  _createClass(CompositeLayer, [{
    key: 'initializeState',


    // initializeState is usually not needed for composite layers
    // Provide empty definition to disable check for missing definition
    value: function initializeState() {}

    // No-op for the invalidateAttribute function as the composite
    // layer has no AttributeManager

  }, {
    key: 'invalidateAttribute',
    value: function invalidateAttribute() {}

    // called to augment the info object that is bubbled up from a sublayer
    // override Layer.getPickingInfo() because decoding / setting uniform do
    // not apply to a composite layer.
    // @return null to cancel event

  }, {
    key: 'getPickingInfo',
    value: function getPickingInfo(_ref) {
      var info = _ref.info;

      return info;
    }

    // Implement to generate sublayers

  }, {
    key: 'renderLayers',
    value: function renderLayers() {
      return null;
    }
  }, {
    key: '_renderLayers',
    value: function _renderLayers(updateParams) {
      if (!this.shouldUpdateState(updateParams)) {
        log.log(2, 'Composite layer reusing sublayers', this.state.oldSubLayers);
        return this.state.oldSubLayers;
      }
      var subLayers = this.renderLayers();
      this.state.oldSubLayers = subLayers;
      log.log(2, 'Composite layer saving sublayers', this.state.oldSubLayers);
      return subLayers;
    }
  }, {
    key: 'isComposite',
    get: function get() {
      return true;
    }
  }]);

  return CompositeLayer;
}(Layer);

export default CompositeLayer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvY29tcG9zaXRlLWxheWVyLmpzIl0sIm5hbWVzIjpbIkxheWVyIiwibG9nIiwiQ29tcG9zaXRlTGF5ZXIiLCJwcm9wcyIsImluZm8iLCJ1cGRhdGVQYXJhbXMiLCJzaG91bGRVcGRhdGVTdGF0ZSIsInN0YXRlIiwib2xkU3ViTGF5ZXJzIiwic3ViTGF5ZXJzIiwicmVuZGVyTGF5ZXJzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLE9BQU9BLEtBQVAsTUFBa0IsU0FBbEI7QUFDQSxTQUFRQyxHQUFSLFFBQWtCLFNBQWxCOztJQUVxQkMsYzs7O0FBQ25CLDBCQUFZQyxLQUFaLEVBQW1CO0FBQUE7O0FBQUEsMkhBQ1hBLEtBRFc7QUFFbEI7Ozs7OztBQU1EO0FBQ0E7c0NBQ2tCLENBQ2pCOztBQUVEO0FBQ0E7Ozs7MENBQ3NCLENBQ3JCOztBQUVEO0FBQ0E7QUFDQTtBQUNBOzs7O3lDQUN1QjtBQUFBLFVBQVBDLElBQU8sUUFBUEEsSUFBTzs7QUFDckIsYUFBT0EsSUFBUDtBQUNEOztBQUVEOzs7O21DQUNlO0FBQ2IsYUFBTyxJQUFQO0FBQ0Q7OztrQ0FFYUMsWSxFQUFjO0FBQzFCLFVBQUksQ0FBQyxLQUFLQyxpQkFBTCxDQUF1QkQsWUFBdkIsQ0FBTCxFQUEyQztBQUN6Q0osWUFBSUEsR0FBSixDQUFRLENBQVIsRUFBVyxtQ0FBWCxFQUFnRCxLQUFLTSxLQUFMLENBQVdDLFlBQTNEO0FBQ0EsZUFBTyxLQUFLRCxLQUFMLENBQVdDLFlBQWxCO0FBQ0Q7QUFDRCxVQUFNQyxZQUFZLEtBQUtDLFlBQUwsRUFBbEI7QUFDQSxXQUFLSCxLQUFMLENBQVdDLFlBQVgsR0FBMEJDLFNBQTFCO0FBQ0FSLFVBQUlBLEdBQUosQ0FBUSxDQUFSLEVBQVcsa0NBQVgsRUFBK0MsS0FBS00sS0FBTCxDQUFXQyxZQUExRDtBQUNBLGFBQU9DLFNBQVA7QUFDRDs7O3dCQXBDaUI7QUFDaEIsYUFBTyxJQUFQO0FBQ0Q7Ozs7RUFQeUNULEs7O2VBQXZCRSxjIiwiZmlsZSI6ImNvbXBvc2l0ZS1sYXllci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAoYykgMjAxNSAtIDIwMTcgVWJlciBUZWNobm9sb2dpZXMsIEluYy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4vLyBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4vLyBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4vLyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4vLyBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbi8vIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbi8vIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1Jcbi8vIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuLy8gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4vLyBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4vLyBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuLy8gT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuLy8gVEhFIFNPRlRXQVJFLlxuXG5pbXBvcnQgTGF5ZXIgZnJvbSAnLi9sYXllcic7XG5pbXBvcnQge2xvZ30gZnJvbSAnLi91dGlscyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbXBvc2l0ZUxheWVyIGV4dGVuZHMgTGF5ZXIge1xuICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgfVxuXG4gIGdldCBpc0NvbXBvc2l0ZSgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIGluaXRpYWxpemVTdGF0ZSBpcyB1c3VhbGx5IG5vdCBuZWVkZWQgZm9yIGNvbXBvc2l0ZSBsYXllcnNcbiAgLy8gUHJvdmlkZSBlbXB0eSBkZWZpbml0aW9uIHRvIGRpc2FibGUgY2hlY2sgZm9yIG1pc3NpbmcgZGVmaW5pdGlvblxuICBpbml0aWFsaXplU3RhdGUoKSB7XG4gIH1cblxuICAvLyBOby1vcCBmb3IgdGhlIGludmFsaWRhdGVBdHRyaWJ1dGUgZnVuY3Rpb24gYXMgdGhlIGNvbXBvc2l0ZVxuICAvLyBsYXllciBoYXMgbm8gQXR0cmlidXRlTWFuYWdlclxuICBpbnZhbGlkYXRlQXR0cmlidXRlKCkge1xuICB9XG5cbiAgLy8gY2FsbGVkIHRvIGF1Z21lbnQgdGhlIGluZm8gb2JqZWN0IHRoYXQgaXMgYnViYmxlZCB1cCBmcm9tIGEgc3VibGF5ZXJcbiAgLy8gb3ZlcnJpZGUgTGF5ZXIuZ2V0UGlja2luZ0luZm8oKSBiZWNhdXNlIGRlY29kaW5nIC8gc2V0dGluZyB1bmlmb3JtIGRvXG4gIC8vIG5vdCBhcHBseSB0byBhIGNvbXBvc2l0ZSBsYXllci5cbiAgLy8gQHJldHVybiBudWxsIHRvIGNhbmNlbCBldmVudFxuICBnZXRQaWNraW5nSW5mbyh7aW5mb30pIHtcbiAgICByZXR1cm4gaW5mbztcbiAgfVxuXG4gIC8vIEltcGxlbWVudCB0byBnZW5lcmF0ZSBzdWJsYXllcnNcbiAgcmVuZGVyTGF5ZXJzKCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgX3JlbmRlckxheWVycyh1cGRhdGVQYXJhbXMpIHtcbiAgICBpZiAoIXRoaXMuc2hvdWxkVXBkYXRlU3RhdGUodXBkYXRlUGFyYW1zKSkge1xuICAgICAgbG9nLmxvZygyLCAnQ29tcG9zaXRlIGxheWVyIHJldXNpbmcgc3VibGF5ZXJzJywgdGhpcy5zdGF0ZS5vbGRTdWJMYXllcnMpO1xuICAgICAgcmV0dXJuIHRoaXMuc3RhdGUub2xkU3ViTGF5ZXJzO1xuICAgIH1cbiAgICBjb25zdCBzdWJMYXllcnMgPSB0aGlzLnJlbmRlckxheWVycygpO1xuICAgIHRoaXMuc3RhdGUub2xkU3ViTGF5ZXJzID0gc3ViTGF5ZXJzO1xuICAgIGxvZy5sb2coMiwgJ0NvbXBvc2l0ZSBsYXllciBzYXZpbmcgc3VibGF5ZXJzJywgdGhpcy5zdGF0ZS5vbGRTdWJMYXllcnMpO1xuICAgIHJldHVybiBzdWJMYXllcnM7XG4gIH1cbn1cbiJdfQ==