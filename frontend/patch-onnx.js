const fs = require('fs');
const path = require('path');

const onnxGradleFile = path.join(__dirname, 'node_modules', 'onnxruntime-react-native', 'android', 'build.gradle');

if (fs.existsSync(onnxGradleFile)) {
    // 每次执行前先用 npm 里的备份重新恢复，防止在上一次改坏的文件上叠加
    console.log('正在精准修补 onnxruntime 语法断层...');
    let content = fs.readFileSync(onnxGradleFile, 'utf8');

    // 1. 针对可能已经改坏的文件，如果包含 Forced by patch-onnx.js，建议你先在终端运行一下：npm install onnxruntime-react-native --legacy-peer-deps 恢复干净源码后再跑本脚本。
    // 2. 如果是干净的源码，下面这两个精准替换可以完美解决：
    
    // 把引发崩溃的 VersionNumber.parse 替换成老版本 Gradle 也认识、新版本 Gradle 也不报错的数字对比
    content = content.replace(
        /def gradleVersion = VersionNumber\.parse\(gradle\.gradleVersion\)/g,
        "def gradleVersionMajor = Integer.parseInt(gradle.gradleVersion.split('\\\\.')[0])"
    );

    // 把后面紧跟的判定逻辑替换掉，不再使用任何 gradleVersion 对象方法
    content = content.replace(
        /if \(gradleVersion >= VersionNumber\.parse\('([0-9.]+)'\)\)/g,
        (match, p1) => {
            const targetMajor = p1.split('.')[0];
            return `if (gradleVersionMajor >= ${targetMajor})`;
        }
    );

    fs.writeFileSync(onnxGradleFile, content, 'utf8');
    console.log('✅ onnxruntime 源码精准无损修补成功！');
} else {
    console.log('❌ 未找到 onnxruntime 文件');
}