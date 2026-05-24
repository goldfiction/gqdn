const blessed = require('blessed');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
  console.error('Error: Please specify a file path. Usage: node editor.js <filename>');
  process.exit(1);
}

const screen = blessed.screen({
  smartCSR: true,
  title: `Terminal Text Editor - ${path.basename(filePath)}`
});

const textarea = blessed.textarea({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: '100%-1',
  keys: false,    // Block default hotkeys
  mouse: true,
  tags: false,    // Ignore tag syntax parsing
  style: {
    fg: 'white',
    bg: '#1a1a1a',
    focus: { border: { fg: 'cyan' } }
  },
  border: 'line'
});

// Disable blessed's internal data text-appending mechanism entirely.
textarea._listener = function() {}; 

const statusBar = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  text: ' Ctrl+S: Save | Ctrl+Q: Quit',
  style: { fg: 'black', bg: 'green' }
});

// --- STATE DEFINITIONS ---
let textLines = [''];
let cursorX = 0;   // CLEAN 0-INDEXING FIXED
let cursorY = 0;   
let scrollTop = 0; 

function getViewportHeight() {
  return textarea.height - 2; 
}

function updateEditorDisplay() {
  const viewHeight = getViewportHeight();
  const cleanLines = textLines.map(line => line.replace(/\r/g, ''));
  const visibleLines = cleanLines.slice(scrollTop, scrollTop + viewHeight);
  
  // FIXED: Clear internal cache properties to eliminate screen ghost artifacts
  textarea.clearValue(); 
  textarea.setValue(visibleLines.join('\n'));
}

function checkScroll() {
  const viewHeight = getViewportHeight();

  if (cursorY < scrollTop) {
    scrollTop = cursorY;
  }
  else if (cursorY >= scrollTop + viewHeight) {
    scrollTop = cursorY - viewHeight + 1;
  }
  updateEditorDisplay();
  screen.render();
}

function loadFile() {
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      textLines = data.replace(/\r\n/g, '\n').split('\n');
      if (textLines.length === 0 || (textLines.length === 1 && textLines[0] === '')) {
        textLines = [''];
      }
      updateEditorDisplay();
      updateStatus(` Loaded: ${path.basename(filePath)}`, 'green');
    } catch (err) {
      updateStatus(` Error loading file: ${err.message}`, 'red');
    }
  } else {
    updateStatus(` New File: ${path.basename(filePath)}`, 'yellow');
  }
}

function saveFile() {
  const cleanLines = textLines.map(line => line.replace(/\r/g, ''));
  try {
    fs.writeFileSync(filePath, cleanLines.join('\n'), 'utf8');
    updateStatus(` Saved successfully! ${new Date().toLocaleTimeString()}`, 'green');
  } catch (err) {
    updateStatus(` Error saving file: ${err.message}`, 'red');
  }
}

function updateStatus(msg, bg) {
  statusBar.setContent(` Ctrl+S: Save | Ctrl+Q: Quit |${msg}`);
  statusBar.style.bg = bg;
  screen.render();
}

function updateHardwareCursor() {
  const relativeY = cursorY - scrollTop;
  // FIXED ALIGNMENT: Uses raw cursorX calculation to match true string mapping coordinates
  screen.program.cursorPos(textarea.atop + relativeY + 1, textarea.aleft + cursorX + 1);
  screen.program.showCursor();
}

// Global Core App Commands
screen.key(['C-q'], () => process.exit(0));
screen.key(['C-s'], () => { saveFile(); screen.render(); });

// Intercept keystrokes cleanly on the textarea
textarea.on('keypress', (ch, key) => {
  if (!key) return;
  if (key.ctrl || key.meta) return; 

  let currentLine = textLines[cursorY] || '';

  // 1. Navigation Rules
  if (key.name === 'up') {
    if (cursorY > 0) {
      cursorY--;
      const prevLineLen = textLines[cursorY].length;
      if (cursorX > prevLineLen) cursorX = prevLineLen;
      checkScroll();
    }
  } 
  else if (key.name === 'down') {
    if (cursorY < textLines.length - 1) {
      cursorY++;
      const nextLineLen = textLines[cursorY].length;
      if (cursorX > nextLineLen) cursorX = nextLineLen;
      checkScroll();
    }
  } 
  else if (key.name === 'left') {
    if (cursorX > 0) {
      cursorX--;
    } else if (cursorY > 0) {
      cursorY--;
      cursorX = textLines[cursorY].length;
      checkScroll();
    }
  } 
  else if (key.name === 'right') {
    if (cursorX < currentLine.length) {
      cursorX++;
    } else if (cursorY < textLines.length - 1) {
      cursorY++;
      cursorX = 0;
      checkScroll();
    }
  }
  else if (key.name === 'home') {
    cursorX = 0;
  }
  else if (key.name === 'end') {
    cursorX = currentLine.length;
  }

  // 2. Backspace Row-Merging Logic
  else if (key.name === 'backspace') {
    if (cursorX > 0) {
      textLines[cursorY] = currentLine.slice(0, cursorX - 1) + currentLine.slice(cursorX);
      cursorX--;
    } else if (cursorY > 0) {
      const prevLine = textLines[cursorY - 1];
      cursorX = prevLine.length;
      textLines[cursorY - 1] = prevLine + currentLine;
      textLines.splice(cursorY, 1);
      cursorY--;
      checkScroll();
    }
    updateEditorDisplay();
  }

// 3. Enter Key (With structural cleanliness guarantees)
  else if (key.name === 'enter') {
    let leftText = currentLine.slice(0, cursorX).replace(/\r/g, '');
    let rightText = currentLine.slice(cursorX).replace(/\r/g, '');

    textLines[cursorY] = leftText;
    textLines.splice(cursorY + 1, 0, rightText);
    
    cursorY++;
    cursorX = 0; 
    
    // FIX: Defer the layout update so blessed updates its internal bounds first
    process.nextTick(() => {
      checkScroll(); 
      updateEditorDisplay();
      screen.render();
    });
    
    return false;
  }

  // 4. Character Typing Splice
  else if (ch || key.name === 'space') {
    const charToInsert = key.name === 'space' ? ' ' : ch;
    
    if (charToInsert=="\r" || charToInsert=="\n" ) return false;

    textLines[cursorY] = currentLine.slice(0, cursorX) + charToInsert + currentLine.slice(cursorX);
    cursorX++;
    
    updateEditorDisplay();
    screen.render();
    return false;
  }

  screen.render();
});

textarea.on('click', () => { textarea.focus(); updateHardwareCursor(); });
screen.on('render', () => { updateHardwareCursor(); });

// Launch App
loadFile();
textarea.focus();
screen.render();