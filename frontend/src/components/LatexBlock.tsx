import React, { useState, useCallback } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  latex: string;
  display?: boolean;
}

export const LatexBlock: React.FC<Props> = ({ latex, display = false }) => {
  const [height, setHeight] = useState(display ? 80 : 30);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const latexJson = JSON.stringify(latex);

  const html = '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">\n  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>\n  <script>\n    document.addEventListener(\'DOMContentLoaded\', function() {\n      var latex = ' + latexJson + ';\n      try {\n        katex.render(latex, document.getElementById(\'math\'), {\n          displayMode: ' + display + ',\n          throwOnError: false\n        });\n      } catch(e) {\n        document.getElementById(\'math\').textContent = latex;\n      }\n      var h = document.documentElement.scrollHeight;\n      var w = document.documentElement.scrollWidth;\n      window.ReactNativeWebView.postMessage(JSON.stringify({ height: h, width: w }));\n    });\n  <\/script>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">\n  <style>\n    body { margin: 0; padding: 0; }\n    .katex { font-size: 1.0em; }\n  <\/style>\n<\/head>\n<body>\n  <div id="math"><\/div>\n<\/body>\n<\/html>';

  const handleMessage = useCallback((e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.height) setHeight(Math.ceil(data.height) + 2);
      if (!display && data.width) setWidth(Math.ceil(data.width) + 4);
    } catch {}
  }, [display]);

  if (display) {
    return (
      <View style={{ height, marginVertical: 4 }}>
        <WebView
          source={{ html }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          onMessage={handleMessage}
          javaScriptEnabled
          originWhitelist={['*']}
        />
      </View>
    );
  }

  return (
    <WebView
      source={{ html }}
      style={{ height, width, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      onMessage={handleMessage}
      javaScriptEnabled
      originWhitelist={['*']}
    />
  );
};
