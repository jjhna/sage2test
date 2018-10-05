@rem off

rem close chrome
Taskkill /FI "WindowTitle eq SAGE2: Display - Google Chrome" /F
Taskkill /FI "WindowTitle eq SAGE2: Audio Manager - Google Chrome" /F
Taskkill /FI "WindowTitle eq Electron*" /F
Taskkill /IM Electron* /F


rem display
start "Electron" .\node_modules\.bin\electron electron.js -d 0 -n -x 0 -y 0 --width 11520 --height 3240 --server=https://canopus.evl.uic.edu
