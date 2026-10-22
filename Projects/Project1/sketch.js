// Meghna/Projects/Project1/sketch.js
// This is a p5.js sketch for an animation lab where users can draw, color, and animate frames
// They can change the number of frames, fps, and playback mode (loop or ping-pong) using keyboard controls
// The code sets up the canvas, manages frames, handles user input for drawing and playback, and provides a user interface for controlling the animation

const MIN_FRAMES = 2; // min # of frams is 2
const MAX_FRAMES = 9; //max # of frames is 9 (using keyboard 2-9 to set frames)
const DRAWING_WIDTH = 1000;
const DRAWING_HEIGHT = 600;
const COLOR_SATURATION = 50; // set to 50% for aesthtic purposes
const OUTER_MARGIN = 25;
const DRAWING_TOP = 180;
const DRAWING_BOTTOM_SPACE = 320;
const FRAME_TILE_GAP = 10;
const FRAME_TILE_HEIGHT = 50;
const ONION_SKIN_OPACITY = 115; // sets starting opacity of nearest prev frame (255 is max opacity, so 115 is 45% decrease)
const ONION_SKIN_FADE_FACTOR = 0.8; // how much opacity each older frame keeps (keeps 80% and decreases by 20%)

let frames = [];
let totalFrames = MIN_FRAMES;
let currentFrame = 0;
let isPlaying = false;
let playbackMode = "loop";
let playbackDirection = 1;
let hasInitializedFirstFrame = false;
let fps = 24;
let frameInterval = 1000 / fps;
let lastFrameChange = 0;
let drawingArea;
let startHue = 15; // by default, start color is red
let endHue = 215; // by default, end color is blue
let startColorControl;
let endColorControl;

// called when page starts
// setup the canvas, initialize frames, and create color controls
function setup() {
  currentFrame = 0;
  isPlaying = false;
  playbackDirection = 1;
  lastFrameChange = 0;
  createCanvas(windowWidth, windowHeight);
  imageMode(CORNER);
  textFont("Courier New");
  createFrames();
  createColorControls();
  updateDrawingArea();
}

function createFrames() {
  frames = []; // store frame 1 through frame 9 in an array of graphics layers
  for (let i = 0; i < MAX_FRAMES; i++) {
    const frame = createGraphics(DRAWING_WIDTH, DRAWING_HEIGHT); // create a new graphics layer for each frame
    // each layer stores one frame's drawing seperately from the main canvas
    frame.clear(); // makes layer transparent so it starts blank
    frames.push(frame); // add layer to frames array
  }
}

// caclulates position and size of drawing area based on window size (canvas dimensions)
function updateDrawingArea() {
  drawingArea = {
    x: OUTER_MARGIN, // set box's left edge
    y: DRAWING_TOP, // set box's top edge
    width: max(100, width - OUTER_MARGIN * 2), // box width = canvas width - margin on each side (ensures box is at least 100px wide)
    height: max(100, height - DRAWING_BOTTOM_SPACE) // box height = canvas height - space reserved below it (ensures box is at least 100px tall)
  };
}

// creates color control slider interface
function createColorControls() {
  const controls = createDiv(); // creates HTML <div> element to hold both slider controls
  controls.addClass("color-controls"); // adding class to div, use CSS to position and style the 2 controls 

  // create color slider objects for start and end colors

  // start color slider object
  startColorControl = new ColorSlider(
    controls,
    "START COLOR",
    startHue,
    value => { // callback function that runs whenever the start slider changes
      startHue = value; // saves new hue in startHue
      updateColorPreviews(); // refreshes color preview swatches
    }
  );

  // end color slider object
  endColorControl = new ColorSlider(
    controls,
    "END COLOR",
    endHue,
    value => { // callback function that runs whenever the end slider changes
      endHue = value;
      updateColorPreviews();
    }
  );

  updateColorPreviews();
}

// class for creating one labeled hue slider and its preview swatch
class ColorSlider {
  constructor(parent, label, initialHue, onInput) {
    this.group = createDiv();
    this.group.addClass("color-control");
    this.group.parent(parent);

    createSpan(label).parent(this.group);

    // slider for selecting hue value (0-359)
    this.slider = createSlider(0, 359, initialHue, 1); // hue slider: min 0, max 359, initial value = initialHue, step = 1
    this.slider.addClass("color-slider");
    this.slider.parent(this.group);

    // preview swatch to show the color corresponding to the slider's hue value
    this.preview = createDiv();
    this.preview.addClass("color-preview");
    this.preview.parent(this.group);

    // whenever the slider value changes, call the onInput callback with the new value
    this.slider.input(() => {
      onInput(Number(this.slider.value()));
    });
  }

  // updating swatch
  setPreviewColor(previewColor) {
    this.preview.style("background-color", previewColor.toString());
  }
}

// refreshes the color previews in the start and end controls
function updateColorPreviews() {
  startColorControl.setPreviewColor(colorForFrame(0)); // get colorframe for first frame (start color (0)) and set as preview color for start control
  endColorControl.setPreviewColor(colorForFrame(totalFrames - 1)); // get colorframe for last frame (end color (totalFrames - 1)) and set as preview color for end control
}

// calculare and return color for given frame index
function colorForFrame(frameIndex) {
  // shortest direction to move around color wheel from startHue to endHue 
  const hueDifference = ((endHue - startHue + 540) % 360) - 180; // result is between -180 and 180, so gradient takes shorter route
  const progress = frameIndex / (totalFrames - 1); // calculates how far through anim this frame is, as a value from 0 to 1 (first frame = 0, the last = 1)
  const hue = (startHue + hueDifference * progress + 360) % 360; // interpolates bw start hue and end hue based on progress (calculation will stay in range 0-359)
  const decimalSaturation = COLOR_SATURATION / 100; // convert saturation to decimal val
  const hueSection = hue / 60; // maps hue onto one of six 60-degree sections of the color wheel, helps determine which RGB channels should be strongest
  const secondComponent = decimalSaturation * (1 - abs((hueSection % 2) - 1)); // calculates intermediate RGB cahnnel val for cur section
  const match = 1 - decimalSaturation; // amt added equally to red, green, blue. adjusts color's brightness for chosen saturation
  // initialize RGB
  let red = 0;
  let green = 0;
  let blue = 0;

  // determines whcih RGB channels should be strongest based on which section of the color wheel the hue is in
  // color = decimalSaturation means this color is the storngest
  // color = secondComponent means this color is the intermediate value
  if (hueSection < 1) { // red -> yellow transition
    red = decimalSaturation;
    green = secondComponent; // green rises
  } else if (hueSection < 2) { // yellow -> green transition
    green = decimalSaturation;
    red = secondComponent; // red falls
  } else if (hueSection < 3) { // green -> cyan transition
    blue = secondComponent;
    green = decimalSaturation; // blue rises
  } else if (hueSection < 4) { // cyan -> blue transition
    blue = decimalSaturation;
    green = secondComponent; // green falls
  } else if (hueSection < 5) { // blue -> magenta transition
    blue = decimalSaturation;
    red = secondComponent; // red rises
  } else { // magenta -> red transition
    red = decimalSaturation;
    blue = secondComponent; // blue falls
  }

  // creating and returning color object
  // adds match to each RGB component to adjust brightness and convert to 0-255 range
  return color(
    round((red + match) * 255),
    round((green + match) * 255),
    round((blue + match) * 255)
  );
}

// titnts image with color for particular frame index
function tintFrame(frameIndex, opacity = 255) {
  const frameColor = colorForFrame(frameIndex); // gets color for frame index
  tint(frameColor.levels[0], frameColor.levels[1], frameColor.levels[2], opacity); // tints images using red, green, and blue channel values
}

// runs repeatedly
// updates animation state when advancing frames
// draws interface elements (header, drawing area, frame strip, footer)
function draw() {
  if (!hasInitializedFirstFrame) { // check first frame setup
    currentFrame = 0; // start anim at first frame
    isPlaying = false; // playback is paused wehn sketh first starts
    playbackDirection = 1; // 1 advances to next frame, -1 goes back to previous frame
    hasInitializedFirstFrame = true; // setup has happened!
  }

  background(250, 242, 246); // used paletton to pick colors
  updateDrawingArea();

  if (isPlaying && millis() - lastFrameChange >= frameInterval) { // check if enough time has passed to advance to next frame
    if (playbackMode === "loop") { // loop mode
      currentFrame = (currentFrame + 1) % totalFrames; // advance to next frame
    } else { // ping pong mode
      if (currentFrame === totalFrames - 1) { // check if anim is on last frame
        playbackDirection = -1; // set direction backward
      } else if (currentFrame === 0) { // check if anim is on first frame
        playbackDirection = 1; // set direction forward
      }

      currentFrame += playbackDirection; // move frame in cur direction

      if (currentFrame === totalFrames - 1 || currentFrame === 0) { // check is new frame is either endpoint (first or last frame)
        playbackDirection *= -1; // reverse direction
      }
    }
    lastFrameChange = millis(); // records cur time so the next frame won’t advance until another frameInterval has passed
  }

  // interface elements
  drawHeader();
  drawDrawingArea();
  drawFrameStrip();
  drawFooter();
}

// draw the title, header, text, and info of animation lab
// ** help of copilot for formatting and referencing my previous assignment 2 + 3 text style **
function drawHeader() {
  push();
  textFont("Courier New");
  noStroke();
  textAlign(LEFT, TOP);

  textStyle(BOLD);
  textSize(25);
  fill(30, 43, 58);
  text("FUN ANIMATION LAB", OUTER_MARGIN, 20);

  textStyle(NORMAL);
  textSize(15);
  fill(86, 101, 118);
  text("DRAW · COLOR · ANIMATE", OUTER_MARGIN, 50);

  stroke(70, 84, 99);
  strokeWeight(1);
  line(OUTER_MARGIN, 75, width - OUTER_MARGIN, 75);
  noStroke();

  textSize(15);
  text(`Frames: ${totalFrames}    Frame: ${currentFrame + 1}/${totalFrames}`, OUTER_MARGIN, 85);
  text(`FPS: ${fps}    Playback: ${playbackMode}`, OUTER_MARGIN, 105);

  textAlign(RIGHT, TOP);
  textStyle(BOLD);
  textSize(15);
  fill(isPlaying ? color(20, 120, 85) : color(86, 101, 118));
  text(isPlaying ? "PLAYING" : "EDITING", width - OUTER_MARGIN, 105);
  pop();
}

// draw main anim area where user draws for anim
function drawDrawingArea() {
  const { x, y, width: drawingAreaWidth, height: drawingAreaHeight } = drawingArea; // get drawing area position and size (destructuring)

  noStroke(); 
  fill(255);
  rect(x, y, drawingAreaWidth, drawingAreaHeight, 10); // white background for background of drawing area

  // draws the previous-frame overlays (onion skin) when the animation is not playing
  if (!isPlaying) {
    // render distant drawings first so the nearest previous frame remains clearest
    for (let i = currentFrame - 1; i >= 0; i--) { // loops backward through the frames before the current one
      const distance = currentFrame - i; // how many frames away this prev frame is
      const opacity = ONION_SKIN_OPACITY * pow(ONION_SKIN_FADE_FACTOR, distance - 1); // older frames get progressively less opacity
      tintFrame(i, opacity); // set ocolor tint and opacity for frame i
      image(frames[i], x, y, drawingAreaWidth, drawingAreaHeight); // draw frame i over drawing area and scaled to fit
    }
  }

  tintFrame(currentFrame); // set tint for cur frame
  image(frames[currentFrame], x, y, drawingAreaWidth, drawingAreaHeight); //draw cur frame on drawing area (drawn after prev frames so appears on top)
  noTint(); // turn of tiniting
  noFill(); // subsequent shapes transparent inside
  stroke(0, 0, 0); // set outline color 
  strokeWeight(2); // outline thickness to 2 pixels
  rect(x, y, drawingAreaWidth, drawingAreaHeight, 10); // outlined rounded rectangle border
}

//draws row of frame thumbnails
function drawFrameStrip() {
  // ** copilot for spacing and formatting of strips ** 
  const stripY = height - 115; 
  const gap = FRAME_TILE_GAP;
  const tileWidth = (width - OUTER_MARGIN * 2 - gap * (totalFrames - 1)) / totalFrames;
  const tileHeight = FRAME_TILE_HEIGHT;

  for (let i = 0; i < totalFrames; i++) { // loop through every fram
    const x = OUTER_MARGIN + i * (tileWidth + gap); // each tile starts after margin and is placed one tile-width-plus-gap
    const y = stripY; // tile's vertical pos set to strip's pos

    noStroke();
    fill(i === currentFrame ? color(240, 218, 229) : color(230, 235, 240)); // used paletton to pick colors. pink color for cur frame and grey for rest
    rect(x, y, tileWidth, tileHeight, 5); // tile's rounded rectangular border

    push();
    drawingContext.save(); // clip the thumbnail image to tile interior
    drawingContext.beginPath(); // new path in canvas drawing context
    drawingContext.rect(x + 5, y + 5, tileWidth - 10, tileHeight - 10); // rectangle 5 pixels inside the tile’s edges, subtracting 10 from the width and height leaves 5 pixels of inset on both sides
    drawingContext.clip(); // restricts later drawing to that inset rectangle
    tintFrame(i);
    image(frames[i], x + 5, y + 5, tileWidth - 10, tileHeight - 10); // draw frame i inside tile inset area
    noTint();
    drawingContext.restore();
    pop();

    noFill();
    stroke(i === currentFrame ? color(205, 138, 171) : color(190, 199, 208)); // used paletton to pick colors
    strokeWeight(i === currentFrame ? 2 : 1); //cur frame’s outline is 2 px thick, others are 1 px
    rect(x, y, tileWidth, tileHeight, 5); // tile outlie

    // number the frames in the strip (1-9) for clarity
    noStroke();
    fill(0,0,0);
    textAlign(CENTER, CENTER);
    textSize(10);
    text(i + 1, x + tileWidth / 2, y + tileHeight / 2); // label from 1 to nuber of frames, centered in tile
  }
}

// draw the footer and keyboard instructions for animation lab
// ** help of copilot for formatting and referencing my previous assignment 2 + 3 text style **
function drawFooter() {
  push();
  textFont("Courier New");
  noStroke();
  fill(70, 84, 99);
  textAlign(LEFT, BOTTOM);
  if (width < 700) {
    textSize(12);
    text("Draw | N/Enter: next | B: back | C: clear | 2–9: frames", OUTER_MARGIN, height - 35);
    text("Space: play/stop | P: mode | +/−: FPS", OUTER_MARGIN, height - 15);
  } else {
    textSize(15);
    text("Draw  |  N / Enter: next  |  B: back  |  C: clear  |  2–9: frames", OUTER_MARGIN, height - 35);
    text("Space: play / stop  |  P: loop / ping-pong  |  + / −: FPS", OUTER_MARGIN, height - 15);
  }
  pop();
}

// p5 event function where it handles mouse press events for drawing
function mousePressed() {
  // isPlaying is true if anim is playing or
  // !isInsideDrawingArea(mouseX, mouseY) is true if mouse is outside the drawing area
  if (isPlaying || !isInsideDrawingArea(mouseX, mouseY)) {
    return;
  }

  // draws point at mouse’s current position (click makes a mark even if mouse doesn’t move)
  drawPoint(mouseX, mouseY);
}

// p5 event function where while mouse button is held and mouse moves
function mouseDragged() {
  if (isPlaying || !isInsideDrawingArea(mouseX, mouseY)) {
    return;
  }

  // calultes horizontal and vertical scale from visible drawing area to frame’s internal image
  const scaleX = DRAWING_WIDTH / drawingArea.width;
  const scaleY = DRAWING_HEIGHT / drawingArea.height;
  // save mouse's pos from prev update
  const previousX = pmouseX;
  const previousY = pmouseY;
  // get cur frame's graphics layer
  const frame = frames[currentFrame];

  frame.stroke(255);
  // starts with a 10-pixel display width and multiplies it by avg of horizontal and vertical scales, so stroke size is adjusted for frame’s internal resolution
  frame.strokeWeight(10 * ((scaleX + scaleY) / 2));
  // line caps and joins are rounded for smoother appearance
  frame.strokeCap(ROUND);
  frame.strokeJoin(ROUND);
  frame.line(
    (previousX - drawingArea.x) * scaleX,
    (previousY - drawingArea.y) * scaleY,
    (mouseX - drawingArea.x) * scaleX,
    (mouseY - drawingArea.y) * scaleY
  );
}

// draw dot at given canvas coordiates
function drawPoint(canvasX, canvasY) {
  const scale = (DRAWING_WIDTH / drawingArea.width + DRAWING_HEIGHT / drawingArea.height) / 2; // avg scale bw visible drawing area and frame’s internal image
  const frame = frames[currentFrame];

  frame.noStroke();
  frame.fill(255);
  frame.circle(
    (canvasX - drawingArea.x) * (DRAWING_WIDTH / drawingArea.width),
    (canvasY - drawingArea.y) * (DRAWING_HEIGHT / drawingArea.height),
    10 * scale
  );
}

// checks if given canvas coordinates are inside drawing area
function isInsideDrawingArea(x, y) {
  return (
    x >= drawingArea.x && // point is at or to right of drawing area’s left edge
    x <= drawingArea.x + drawingArea.width && // point is at or to left of drawing area’s right edge
    y >= drawingArea.y && // point is at or below drawing area’s top edge
    y <= drawingArea.y + drawingArea.height // point is at or above drawing area’s bottom edge
  );
}

// keyboard p5 event function
function keyPressed(event) {
  // check key press came from HTML input field (color slider)
  if (event && event.target && event.target.tagName === "INPUT") {
    return;
  }

  // check spacebar is being held down and repeatedly generating key events
  if (key === " " && event && event.repeat) {
    return false;
  }

  if (key >= "2" && key <= "9") { // check whether the pressed key is a digit from 2 through 9
    totalFrames = Number(key);
    currentFrame = min(currentFrame, totalFrames - 1);
    updateColorPreviews();
    isPlaying = false;
  } else if (key === "n" || key === "N" || keyCode === ENTER) { // check whether n is pressed for next frame
    isPlaying = false;
    currentFrame = min(currentFrame + 1, totalFrames - 1);
  } else if (key === "b" || key === "B") { // check whether b is pressed to go back a frame
    isPlaying = false;
    currentFrame = max(currentFrame - 1, 0);
  } else if (key === "c" || key === "C") { // check whether c is pressed, then clear cur frame's graphic
    frames[currentFrame].clear();
  } else if (key === " ") { // check whther spacebar is pressed
    isPlaying = !isPlaying; // toggle playback
    lastFrameChange = millis(); // record cur time so playback’s frame timer starts from now
  } else if (key === "p" || key === "P") { // check whether p is pressed for playback mode
    playbackMode = playbackMode === "loop" ? "ping-pong" : "loop";
    playbackDirection = currentFrame === totalFrames - 1 ? -1 : 1;
    lastFrameChange = millis();
  } else if (key === "+" || key === "=") { // check whther + or = is pressed for increasing fps
    fps = min(fps + 1, 60); // increase fps
    frameInterval = 1000 / fps;
  } else if (key === "-" || key === "_") { // check whther - or _ is pressed for increasing fps
    fps = max(fps - 1, 1); // decrease fps
    frameInterval = 1000 / fps;
  } else {
    return;
  }

  return false;
}

// p5 event function that runs when the browser window changes size
function windowResized() {
  resizeCanvas(windowWidth, windowHeight); // resizes sketch’s canvas to match browser window’s new width and height
  updateDrawingArea(); // recalculates drawing area’s position and size for new canvas dimensions
}
