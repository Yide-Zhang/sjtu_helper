const fs = require("fs");
const path = require("path");

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith(".gradle")) {
      let content = fs.readFileSync(fullPath, "utf8");

      const newContent = content
        .replace(/jcenter\(\)/g, "mavenCentral()");

      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, "utf8");
        console.log("fixed:", fullPath);
      }
    }
  });
}

walk(".");
console.log("done");