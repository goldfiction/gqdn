const blessed = require('blessed');
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');
var file = null;

const spawnSyncExec=function(cmd,file) {
    spawnSync(cmd, [file], {
    stdio: 'inherit'
    });  
}

const spawnSelf = function (file) {
    const directory = path.dirname(file);
    const result = spawnSync(process.execPath, [process.argv[1], directory], {
        encoding: 'utf8',
        stdio: 'inherit' // Allows the child to use the parent's terminal for input/output
    });
}


// 1. Create the main screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Blessed File Manager'
});

// 2. Create the FileManager widget
const fileManager = blessed.filemanager({
  parent: screen,
  top: 'center',
  left: 'center',
  width: '80%',
  height: '80%',
  border: {
    type: 'line'
  },
  style: {
    bg: 'lightblack',
    fg: 'green',
    selected: {
      bg: 'green',
      fg: 'blue'
    }
    },
    label: ' {blue-fg}%path{/blue-fg} ',
    cwd: (process.argv[2]||process.env.HOME),
    keys: true,
    vi: true,
    scrollbar: {
      bg: 'white',
      ch: ' '
   }
});

// 3. Attach Node's native FS refresh logic
fileManager.refresh((process.argv[2]||process.env.HOME), (err) => {
  if (err) throw err;
});

txtFiles = [".js", ".md", ".txt", ".json", ".coffee", ".ini", ".log", ".html", ".css"];
isTxtFile = function (file) {
    for (var ext of txtFiles) {
        if (file.indexOf(ext) != -1) {
            return true;
        }
    }
    return false;
}


// 4. Handle file selection
fileManager.on('file', (file) => {
  // Do something with the selected file (e.g., open/read it)
  screen.destroy();
  //console.log(`You selected the file: ${file}`);
    if (file.indexOf(".sh") != -1) {
        spawnSyncExec("sh", file);
    }
    else if(file.indexOf(".bash") != -1) {
        spawnSyncExec("bash", file);
    }
    else if(isTxtFile(file)){
        spawnSyncExec("nano", file);
    }
    else {
        spawnSyncExec("sh",file);
    }
    spawnSelf(file);
  process.exit(0);
});

// 5. Handle keyboard inputs for navigation
screen.key(['escape', 'q', 'C-c'], () => {
  screen.destroy();
  process.exit(0);
});

screen.key(['s'], () => {
  screen.destroy();
  process.exit(0);   
});

// 6. Focus and render
fileManager.focus();
screen.render();