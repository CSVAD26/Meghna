// Meghna/Assignments/Assignment2/sketch.js
// This sketch creates three movable swatches with toggleable triadic and adjacent palettes
// The swatches can be clicked and dragged to new positions
// Holding C while dragging shifts the shared base hue
// Pressing P toggles between triadic and adjacent palettes
// Pressing B toggles the brightness gradient strips on and off

let swatch1;
let swatch2;
let swatch3;

let swatches = [];
let colorShift = false;
let baseHue;
let paletteMode = 'triadic';
let showBrightnessGradient = true;
let swatchSaturation = 75; // set to 75% for aesthtic purposes
let swatchBrightness = 100;
let brightnessGradientInset = 10; //allows for a small margin on the brightness gradient to avoid pure black and white

// Create the swatches and initialize their shared palette
function setup() {
  createCanvas(800, 800);
  colorMode(HSB, 360, 100, 100);

  swatch1 = new Swatch(100, 100, 500, 500, 10);
  swatch2 = new Swatch(500, 100, 200, 200, 5);
  swatch3 = new Swatch(400, 200, 200, 200, 5);

  swatches.push(swatch1, swatch2, swatch3);
  baseHue = hue(swatch1.c);
  updatePalette(0);
}

// Redraw the background, swatches, and interaction instructions each frame
function draw() {
  colorMode(HSB, 360, 100, 100);
  background(0, 0, 100);

  for (let i = 0; i < swatches.length; i++) {
    swatches[i].draw();
  }

  //Text style and instructions

  push();
  textFont('Courier New');
  noStroke();

  textStyle(BOLD);
  textSize(26);
  fill(0, 0, 0);
  text('SWATCH LAB', 24, 48);

  textStyle(NORMAL);
  textSize(14);
  fill(0, 0, 42);
  text('EXPLORE RELATIONSHIPS BETWEEN COLORS', 27, 68);
  stroke(0, 0, 0);
  strokeWeight(1);
  line(24, 82, width - 24, 82);
  noStroke();

  textStyle(BOLD);
  textSize(16);
  fill(0, 0, 35);
  text('P  PALETTE', 24, height - 48);
  fill(228, 76, 80);
  text(paletteMode.toUpperCase(), 145, height - 48);

  fill(0, 0, 35);
  text('B  BRIGHTNESS', 320, height - 48);
  fill(showBrightnessGradient ? color(135, 75, 42) : color(5, 75, 55));
  text(showBrightnessGradient ? 'ON' : 'OFF', 475, height - 48);

  textStyle(NORMAL);
  textSize(15);
  fill(0, 0, 42);
  text('HOLD C + DRAG / SCROLL TO SHIFT HUE', 24, height - 18);
  pop();
}

// Select the topmost swatch under the mouse pointer
function mousePressed() {
  for (let i = swatches.length - 1; i >= 0; i--) {
    let s = swatches[i];
    let hitTest = s.hitTest(mouseX, mouseY);

    if (hitTest) {
      s.selected = true;
      print("selected", i);
      return;
    }
  }
}

// Toggle palette mode with P, brightness strips with B, or enable hue editing with C
function keyPressed() {
  if (key.toLowerCase() === 'p') {
    paletteMode = paletteMode === 'triadic' ? 'adjacent' : 'triadic';
    updatePalette(0);
  } else if (key.toLowerCase() === 'b') {
    showBrightnessGradient = !showBrightnessGradient;
  } else if (key.toLowerCase() === 'c') {
    colorShift = true;
  }
}

// Restore normal dragging after the key is released
function keyReleased() {
  colorShift = false;
}

// Clear swatch selection when the mouse button is released
function mouseReleased() {
  deselectAllSwatches();
}

// Use the mouse wheel to adjust the active palette while C is held
function mouseWheel(event) {
  let e = round(event.delta); // event.getCount() equivalent
  for (let i = 0; i < swatches.length; i++) {
    let s = swatches[i];
    if (s.selected) {
      if (colorShift) {
        updatePalette(e);
      }
      return;
    }
  }
}

// Move the selected swatch, or shift all palette hues while C is held
function mouseDragged() {
  let delta = createVector(mouseX - pmouseX, mouseY - pmouseY);
  for (let i = 0; i < swatches.length; i++) {
    let s = swatches[i];
    if (s.selected) {
      if (!colorShift) {
        s.moveBy(delta);
      } else {
        updatePalette(delta.x);
      }
      return;
    }
  }
}

// Apply either 120-degree triadic offsets or symmetric 30-degree adjacent offsets
function updatePalette(hueChange) {
  baseHue = (baseHue + hueChange + 360) % 360; // Ensure baseHue stays within 0-360
  let hueOffsets = paletteMode === 'triadic' ? [0, 120, 240] : [0, -30, 30]; // Defines hue offsets based on palette mode
  for (let i = 0; i < swatches.length; i++) {
    swatches[i].c = color(
      (baseHue + hueOffsets[i] + 360) % 360,
      swatchSaturation,
      swatchBrightness
    ); 
  } // Visits each swatch so it can apply its corresponding hue offset
  // In adjacent mode, the first swatch gets the base hue, and the other two get hues on either side
}

// Deselect every swatch.
function deselectAllSwatches() {
  for (let i = 0; i < swatches.length; i++) {
    swatches[i].selected = false;
  }
}

// ---------------- Swatch Class ----------------

// Store and draw one movable, selectable color swatch
class Swatch {
  // Set the swatch bounds, brightness sample count, initial color, and selection state
  constructor(x, y, w, h, brightnessSteps) {
    this.pos = createVector(x, y);
    this.w = w;
    this.h = h;
    this.brightnessSteps = brightnessSteps;
    this.c = color(random(360), swatchSaturation, swatchBrightness);
    this.selected = false;
  }

  // Draw the swatch and outline it when selected
  draw() {
    fill(this.c);
    rect(this.pos.x, this.pos.y, this.w, this.h);
    if (showBrightnessGradient) { // Only draw the brightness gradient if the toggle is on
      this.drawBrightnessStrip();
    }
    if (this.selected) {
      noFill();
      stroke(0);
      strokeWeight(2);
      rect(this.pos.x, this.pos.y, this.w, this.h);
      noStroke();
    }
  }

  // Draw evenly spaced brightness variations along the bottom of the swatch
  drawBrightnessStrip() {
    // Calculate the height of the strip and the width of each block based on the number of brightness steps
    let stripHeight = this.h * 0.15;
    let blockWidth = this.w / this.brightnessSteps;

    push();
    noStroke();
    for (let i = 0; i < this.brightnessSteps; i++) { // Loop through the number of brightness steps to create variations
      let brightnessValue = map(
        i,
        0,
        this.brightnessSteps - 1,
        brightnessGradientInset,
        swatchBrightness - brightnessGradientInset
      );
      let variation = color(hue(this.c), saturation(this.c), brightnessValue);
      fill(variation);
      rect(
        this.pos.x + i * blockWidth,
        this.pos.y + this.h - stripHeight,
        blockWidth,
        stripHeight
      );
    }
    pop();
  }

  // Return whether the given point falls inside this swatch
  hitTest(mx, my) {
    return (mx > this.pos.x && mx < this.pos.x + this.w &&
            my > this.pos.y && my < this.pos.y + this.h);
  }

  // Shift this swatch's position by the supplied vector
  moveBy(delta) {
    this.pos.add(delta);
  }

}
