import { Asset } from 'expo-asset';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';

let session: InferenceSession | null = null;
let sessionInitCounter = 0;

const CHARS = 'abcdefghijklmnopqrstuvwxyz';

// ============================================================
// 日志工具：每条日志带时间戳和 [Captcha] 前缀
// ============================================================
function log(...args: any[]) {
  console.log(`[Captcha][${Date.now()}]`, ...args);
}
function warn(...args: any[]) {
  console.warn(`[Captcha][${Date.now()}]`, ...args);
}

/**
 * Load the ONNX model from bundled assets
 */
export async function loadCaptchaModel(): Promise<void> {
  if (session) {
    log(`Model already loaded (sessionInitCounter=${sessionInitCounter})`);
    return;
  }
  log('Loading ONNX model from assets...');
  const asset = Asset.fromModule(require('../../assets/nn_model.onnx'));
  await asset.downloadAsync();
  log(`Asset downloaded, localUri=${asset.localUri}`);

  session = await InferenceSession.create(asset.localUri!, {
    executionProviders: ['cpu'],
  });
  sessionInitCounter++;
  log(`Model loaded successfully (sessionInitCounter=${sessionInitCounter})`);
}

/**
 * Decode the model output into a 5-char string.
 * Output is [tensor[26], tensor[26], tensor[26], tensor[26], tensor[27]]
 * Each tensor contains logits for each position.
 * The last position (idx 26) of the 5th tensor means "no character" (blank).
 */
function decodeOutput(output: Record<string, Tensor>): string {
  const keys = Object.keys(output).sort();
  log(`decodeOutput: keys=${JSON.stringify(keys)}, numOutputs=${keys.length}`);

  let result = '';
  for (let i = 0; i < keys.length; i++) {
    const rawData = output[keys[i]].data;
    const logits = rawData as Float32Array;
    const numClasses = logits.length;

    // Find argmax
    let maxIdx = 0;
    let maxVal = logits[0];
    for (let j = 1; j < numClasses; j++) {
      if (logits[j] > maxVal) {
        maxVal = logits[j];
        maxIdx = j;
      }
    }

    log(`  Position ${i}: argmax=${maxIdx}, maxVal=${maxVal.toFixed(4)}, numClasses=${numClasses}, logits[:5]=${Array.from(logits.slice(0, 5)).map(v => v.toFixed(2)).join(',')}`);

    // For the last position (5th), index 26 means blank (no character)
    if (i === keys.length - 1 && maxIdx === numClasses - 1) {
      log(`  Position ${i}: blank detected, stopping`);
      break;
    }

    if (maxIdx < CHARS.length) {
      result += CHARS[maxIdx];
    } else {
      warn(`  Position ${i}: maxIdx=${maxIdx} out of range (CHARS.length=${CHARS.length})`);
    }
  }

  log(`decodeOutput result: "${result}"`);
  return result;
}

/**
 * Preprocess raw RGBA pixel data into the input tensor [1, 1, 40, 110]
 * Takes pixel data as Uint8ClampedArray from a 110x40 canvas.
 * Pipeline: grayscale → binary threshold (<156→0, >=156→1) → float32 tensor
 */
function preprocessPixels(pixels: Uint8ClampedArray, tag: string = ''): Float32Array {
  const width = 110;
  const height = 40;
  const expectedLen = width * height * 4;

  if (pixels.length !== expectedLen) {
    warn(`preprocessPixels${tag}: unexpected pixel data length=${pixels.length}, expected=${expectedLen}`);
  }

  const input = new Float32Array(1 * 1 * height * width);
  let sumGray = 0;
  let countBlack = 0;
  let countWhite = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4; // RGBA
      // Grayscale using luminosity method
      const gray = pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
      // Binary threshold: matches original training pipeline
      const val = gray >= 156 ? 1.0 : 0.0;
      input[y * width + x] = val;
      sumGray += gray;
      if (val > 0.5) countWhite++; else countBlack++;
    }
  }

  const avgGray = sumGray / (width * height);
  log(`preprocessPixels${tag}: avgGray=${avgGray.toFixed(1)}, black=${countBlack}, white=${countWhite}, ` +
    `input[:5]=${Array.from(input.slice(0, 5)).map(v => v.toFixed(1)).join(',')}`);

  return input;
}

/**
 * Run the full inference pipeline on raw RGBA pixel data.
 * 每次都创建全新的 Float32Array 和 Tensor 实例，杜绝缓存死锁。
 */
async function runInferenceOnPixels(
  clamped: Uint8ClampedArray,
  tag: string,
): Promise<string> {
  if (!session) {
    log(`runInferenceOnPixels${tag}: session not ready, loading...`);
    await loadCaptchaModel();
  }

  // 1) Preprocess: RGBA → grayscale → binary → Float32Array (全新分配)
  const inputData = preprocessPixels(clamped, tag);
  log(`runInferenceOnPixels${tag}: Float32Array created, length=${inputData.length}, ` +
    `first5=${Array.from(inputData.slice(0, 5)).map(v => v.toFixed(1)).join(',')}`);

  // 2) Create NEW tensor instance — 确保每次都是全新的 Tensor 对象
  const inputTensor = new Tensor('float32', inputData, [1, 1, 40, 110]);
  log(`runInferenceOnPixels${tag}: inputTensor created, dims=[${inputTensor.dims}], ` +
    `data length=${inputTensor.data.length}`);

  // 3) Run inference
  log(`runInferenceOnPixels${tag}: running session.run({ 'input.1': inputTensor })...`);
  const output = await session!.run({ 'input.1': inputTensor });
  log(`runInferenceOnPixels${tag}: inference complete, output keys=${Object.keys(output)}`);

  // 4) Decode output to string
  const result = decodeOutput(output);
  log(`runInferenceOnPixels${tag}: FINAL result="${result}"`);
  return result;
}

/**
 * Recognize captcha from WebView canvas pixel data (base64-encoded Uint8ClampedArray).
 * @param base64PixelData Base64-encoded raw RGBA pixel bytes (from canvas getImageData)
 */
export async function recognizeCaptcha(base64PixelData: string): Promise<string> {
  const tag = `[webview]`;
  log(`recognizeCaptcha${tag}: received pixel data, first 30 chars="${base64PixelData.substring(0, 30)}"...`);

  // Decode base64 → bytes
  const startDecode = Date.now();
  let binaryStr: string;
  try {
    binaryStr = atob(base64PixelData);
  } catch (e) {
    throw new Error(`recognizeCaptcha${tag}: atob failed - ${e}`);
  }
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
  log(`recognizeCaptcha${tag}: atob done, bytes length=${bytes.length}, ` +
    `first10 bytes=${Array.from(bytes.slice(0, 10)).join(',')}, ` +
    `decode took ${Date.now() - startDecode}ms`);

  const clamped = new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  log(`recognizeCaptcha${tag}: Uint8ClampedArray created, length=${clamped.length}`);

  return runInferenceOnPixels(clamped, tag);
}

/**
 * Recognize captcha from a base64-encoded image (JPEG/PNG) fetched from the network.
 * Auto-login 路径专用的像素数据转换。
 * IMPORTANT: React Native 的 fetch blob 返回的是图片文件的 base64，
 * 这里需要先将其解码为原始 RGBA 像素才能送入模型。
 * 注意：此函数假定传入的是已经 decode 好的原始 RGBA 像素数据。
 */
export async function recognizeCaptchaFromImage(base64ImageData: string): Promise<string> {
  const tag = `[image]`;
  log(`recognizeCaptchaFromImage${tag}: received image data, first 30 chars="${base64ImageData.substring(0, 30)}"...`);

  let binaryStr: string;
  try {
    binaryStr = atob(base64ImageData);
  } catch (e) {
    throw new Error(`recognizeCaptchaFromImage${tag}: atob failed - ${e}`);
  }
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
  log(`recognizeCaptchaFromImage${tag}: decoded bytes length=${bytes.length}`);

  const clamped = new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return runInferenceOnPixels(clamped, tag);
}

/**
 * Get the JavaScript to inject into the login page for extracting captcha pixel data
 *
 * 修复的关键点：
 * 1. 使用正确的选择器 `#captcha-img`（jAccount 页面的真实 ID）
 * 2. 等待图片的 src 不为空再提取（jAccount 的 captcha 是 JS 动态设置的）
 * 3. 用 MutationObserver 监听 captcha 刷新，确保每次模型读取的是屏幕上显示的同一张图
 * 4. 在 WebView 控制台输出详细日志，便于追踪
 */
export function getCaptchaExtractJS(): string {
  return `
(function() {
  console.log('[CaptchaExtract] Script injected, waiting for page ready...');

  // ========== 核心提取函数 ==========
  function captureAndSend(imgElement, source) {
    console.log('[CaptchaExtract] captureAndSend called, source=' + source + ', img.src=' + imgElement.src);

    if (!imgElement.src || imgElement.src === '' || imgElement.src === window.location.href) {
      console.log('[CaptchaExtract] img.src is empty or invalid, will retry in 500ms');
      setTimeout(function() { tryCapture(); }, 500);
      return;
    }

    var canvas = document.createElement('canvas');
    canvas.width = 110;
    canvas.height = 40;
    var ctx = canvas.getContext('2d');
    // 清空画布防止像素残留
    ctx.clearRect(0, 0, 110, 40);

    try {
      ctx.drawImage(imgElement, 0, 0, 110, 40);
    } catch (e) {
      console.log('[CaptchaExtract] drawImage failed: ' + e.message + ', will retry');
      setTimeout(function() { tryCapture(); }, 500);
      return;
    }

    var imageData = ctx.getImageData(0, 0, 110, 40);
    var pixels = imageData.data;
    console.log('[CaptchaExtract] Canvas captured, pixels.length=' + pixels.length +
      ', first 5 RGBA: (' + pixels[0] + ',' + pixels[1] + ',' + pixels[2] + ',' + pixels[3] + ')...');

    // Convert to base64
    var bytes = new Uint8Array(pixels.buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    var base64 = btoa(binary);

    console.log('[CaptchaExtract] base64 data first 30 chars: ' + base64.substring(0, 30));

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'captcha',
      data: base64
    }));
  }

  // ========== 等待 captcha-img 就绪并提取 ==========
  var pollCount = 0;

  function tryCapture() {
    pollCount++;
    console.log('[CaptchaExtract] tryCapture #' + pollCount);

    // 正确的选择器：匹配 jAccount 页面中 id="captcha-img" 的验证码图片
    var img = document.getElementById('captcha-img');

    if (!img) {
      console.log('[CaptchaExtract] #captcha-img not found in DOM, will retry in 500ms');
      if (pollCount < 60) { setTimeout(tryCapture, 500); }
      return;
    }

    if (!img.src || img.src === '' || img.src.indexOf('captcha') === -1) {
      console.log('[CaptchaExtract] #captcha-img exists but src not ready yet: "' + img.src + '", will retry');
      if (pollCount < 60) { setTimeout(tryCapture, 500); }
      return;
    }

    console.log('[CaptchaExtract] #captcha-img found, src=' + img.src + ', complete=' + img.complete +
      ', naturalWidth=' + img.naturalWidth + ', naturalHeight=' + img.naturalHeight);

    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      captureAndSend(img, 'direct');
    } else {
      // 图片还没加载完，等 onload
      img.onload = function() {
        console.log('[CaptchaExtract] img.onload fired, src=' + img.src);
        captureAndSend(img, 'onload');
      };
      img.onerror = function() {
        console.log('[CaptchaExtract] img.onerror, will retry');
        setTimeout(tryCapture, 1000);
      };
    }
  }

  // ========== MutationObserver: 检测验证码刷新 ==========
  var captchaImg = document.getElementById('captcha-img');
  if (captchaImg) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          console.log('[CaptchaExtract] captcha-img src changed to: ' + captchaImg.src);
          // 等待新图片加载完成后提取
          captchaImg.onload = function() {
            console.log('[CaptchaExtract] Refreshed img loaded, src=' + captchaImg.src);
            captureAndSend(captchaImg, 'observer');
          };
          if (captchaImg.complete) {
            setTimeout(function() { captureAndSend(captchaImg, 'observer-complete'); }, 200);
          }
        }
      });
    });
    observer.observe(captchaImg, { attributes: true, attributeFilter: ['src'] });
    console.log('[CaptchaExtract] MutationObserver attached to #captcha-img');
  } else {
    console.log('[CaptchaExtract] #captcha-img not yet in DOM, observer deferred');
  }

  // ========== 启动首次提取 ==========
  setTimeout(tryCapture, 800);
})();
true;
`;
}

/**
 * Get JavaScript to fill the captcha result into the form and submit
 */
export function getCaptchaFillJS(captcha: string): string {
  return `
(function() {
  console.log('[CaptchaFill] Filling captcha: "${captcha}"');

  // 填入验证码输入框
  var input = document.getElementById('input-login-captcha');
  if (!input) {
    input = document.querySelector('input[name="captcha"]');
  }
  if (input) {
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(input, '${captcha}');
    // 触发 React/Angular/jQuery 等框架的 input 事件
    var ev = new Event('input', { bubbles: true });
    input.dispatchEvent(ev);
    console.log('[CaptchaFill] Captcha filled, value="' + input.value + '"');
  } else {
    console.log('[CaptchaFill] WARN: captcha input not found');
  }

  // 点击提交按钮
  var btn = document.getElementById('submit-password-button');
  if (!btn) {
    btn = document.querySelector('input[type="submit"]') ||
          document.querySelector('button[type="submit"]');
  }
  if (btn) {
    console.log('[CaptchaFill] Clicking submit button');
    setTimeout(function() { btn.click(); }, 300);
  } else {
    console.log('[CaptchaFill] WARN: submit button not found, trying Enter key...');
    if (input) {
      var enterEvent = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
      input.dispatchEvent(enterEvent);
    }
  }
})();
true;
`;
}
