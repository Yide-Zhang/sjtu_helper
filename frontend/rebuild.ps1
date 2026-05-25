Remove-Item -Recurse -Force android
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .expo

npm install
node replace-jcenter.js
npx expo prebuild --clean